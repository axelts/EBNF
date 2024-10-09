/** A module which extends the {@link module:Base Base module}
  * and supports creating scanners and recursive descent parsers
  * from [LL(1) grammars](https://en.wikipedia.org/wiki/LL_parser) 
  * and actions written in JavaScript.
  *
  * The fundamental object created by this module
  * is a {@linkcode module:EBNF~Grammar Grammar} prepared from grammar rules
  * using the syntax defined {@link module:EBNF~Grammar.ebnf here}.
  * The syntax includes alternative and optional and iterated sequences,
  * all of which must not recognize empty input.
  * [This book chapter]{@tutorial 02-grammars} explains how to write grammar rules.
  *
  * A {@linkcode module:EBNF~Grammar Grammar}, optionally with precedences,
  * can be imported by the {@link module:BNF BNF module} for stack-based parsing,
  * but the {@link module:BNF BNF} and {@link module:EBNF EBNF} modules
  * do not depend on each other.
  *
  * The grammar rules are represented using a number of classes
  * as discussed in [this book chapter]{@tutorial 04-parser}
  * and summarized in the following table:

| tree structure | getters | checking  | parsing |
| --- | --- | --- | --- |
| {@linkcode module:EBNF~Grammar Grammar} | `config`, `rules`, `prefix` | {@linkcode module:EBNF~Grammar#check check()} | {@linkcode module:EBNF~Grammar#parser parser().}{@linkcode module:EBNF~Parser#parse parse()} |
| {@linkcode module:EBNF~Node Node} | `grammar`, `expect`, `#follow` | {@linkcode module:EBNF~Node#shallow shallow()}, {@linkcode module:EBNF~Node#deep deep()}, {@linkcode module:EBNF~Node#follow follow()}, {@linkcode module:EBNF~Node#check check()} | {@linkcode module:EBNF~Node#parse parse()}: `string`<br>for terminals |
| {@linkcode module:EBNF~Lit Lit}: {@linkcode module:Base~Lit Lit}: {@linkcode module:Base~T T}: {@linkcode module:Base~Symbol Symbol} + {@linkcode module:EBNF~Node Node} | `name`, `value`, `prec`, `used`, `expect` | | : `string` | 
| {@linkcode module:EBNF~Token Token}: {@linkcode module:Base~Token Token}: {@linkcode module:Base~T T}: {@linkcode module:Base~Symbol Symbol} + {@linkcode module:EBNF~Node Node} | `name`, `pat`, `prec`, `used`, `expect` | | : `string` |
| {@linkcode module:EBNF~NT NT}: {@linkcode module:Base~NT NT}: {@linkcode module:Base~Symbol Symbol} + {@linkcode module:EBNF~Node Node} | `name`, `rule`: {@linkcode module:EBNF~Rule Rule}, `expect` | {@linkcode module:EBNF~NT#shallow shallow()}, {@linkcode module:EBNF~NT#deep deep()}, {@linkcode module:EBNF~NT#follow follow()} | {@linkcode module:EBNF~NT#parse parse()}: `Array`<br>\|{@linkcode module:Base~Action action} *value* |
| {@linkcode module:EBNF~Alt Alt} + {@linkcode module:EBNF~Node Node} | `seqs`: {@linkcode module:EBNF~Seq Seq[]}, `expect` | {@linkcode module:EBNF~Alt#shallow shallow()}, {@linkcode module:EBNF~Alt#deep deep()}, {@linkcode module:EBNF~Alt#follow follow()}, {@linkcode module:EBNF~Alt#check check()} | {@linkcode module:EBNF~Alt#parse parse()}: `Array` |
| {@linkcode module:EBNF~Rule Rule}: {@linkcode module:EBNF~Alt Alt} | `nt`, `recursed`, `reached` | {@linkcode module:EBNF~Rule#shallow shallow()}, {@linkcode module:EBNF~Rule#deep deep()} | {@linkcode module:EBNF~Rule#parse parse()}: `Array`<br>\|{@linkcode module:Base~Action action} *value* |
| {@linkcode module:EBNF~Opt Opt}: {@linkcode module:EBNF~Alt Alt} | | {@linkcode module:EBNF~Opt#check check()} | : `null`\|`Array` |
| {@linkcode module:EBNF~Some Some}: {@linkcode module:EBNF~Alt Alt} | | {@linkcode module:EBNF~Some#follow follow()}, {@linkcode module:EBNF~Some#check check()} | {@linkcode module:EBNF~Some#parse parse()}: `Array`\<`Array`\> |
| {@linkcode module:EBNF~Seq Seq} + {@linkcode module:EBNF~Node Node} | `nodes`: `Array<`{@linkcode module:Base~Symbol Symbol}\|{@linkcode module:EBNF~Opt Opt}\|{@linkcode module:EBNF~Some Some>}, `prec`: {@linkcode module:EBNF~Term Term} , `expect` | {@linkcode module:EBNF~Seq#shallow shallow()}, {@linkcode module:EBNF~Seq#deep deep()}, {@linkcode module:EBNF~Seq#follow follow()}, {@linkcode module:EBNF~Seq#check check()} | {@linkcode module:EBNF~Seq#parse parse()}: `Array` |

    @module EBNF
    @see module:Base
    @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-02-12
*/

import * as Base from './base.js';

/** Acts as a superclass of all elements of a grammar tree,
    specifies the methods to recursively check LL(1)
    and defines the `parse` method for terminal symbols.
    @mixin
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Node#follow node.follow()}.
*/
const Node = (superclass) => class extends superclass {
  #expect = new Set();
  get expect () { return this.#expect; }
  
  #follow = null;

  /** Manage `.expect` during grammar checking:
      ** `shallow()` acts as getter; override to compute `.expect` from left to right as far as necessary.
      ** `shallow(` increment `)` acts as setter; adds to `.expect`.
      ** `deep()` also acts as getter, override to completely compute `.expect`.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {module:EBNF~Set} the (incremented) set, maps terminal names to true.
      @memberof module:EBNF~Node
      @instance
  */
  shallow (increment) {
    if (increment instanceof Set) this.#expect.import(increment); // setter
    return this.#expect; // getter
  }

  /** Manage `.expect` during grammar checking:
      ** `shallow()` acts as getter; override to compute `.expect` from left to right as far as necessary.
      ** `shallow(` increment `)` acts as setter; adds to `.expect`.
      ** `deep()` also acts as getter, override to completely compute `.expect`.
      @returns {module:EBNF~Set} the set, maps terminal names to true.
      @memberof module:EBNF~Node
      @instance
  */
  deep () { return this.#expect; }
  
  /** Manage `.follow` during grammar checking, creates initial set.
      ** `follow()` getter, may return `null`.
      ** `follow(` increment `)` setter, adds to `.follow`, creates if necessary,
         override to compute from right to left.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {?module:EBNF~Set} getter: the set, maps terminal names to true,
        setter: undefined.
      @memberof module:EBNF~Node
      @instance
  */
  follow (increment) {
    // getter
    if (!increment) return this.#follow;
    
    // setter
    if (this.#follow) this.#follow.import(increment);
    else this.#follow = new Set().import(increment);
  }
  
  /** Check for ambiguity, override to report an error.
      @param {function} error - should be bound to {@linkcode module:Base~Factory#error grammar.error()}.
      @param {string} name - current rule, to label errors.
      @returns {undefined|string} error message, if any.
      @memberof module:EBNF~Node
      @instance
  */
  check (error, name) { }
  
  /** Consume the current input symbol (because it is expected).
      This method should be redefined in all but the classes representing terminal symbols.
      @param {module:EBNF~Parser} parser - context.
      @returns {string} the input string.
      @throws {string} if recognition fails.
      @memberof module:EBNF~Node
      @instance
  */
  parse (parser) {
    const result = parser.current.value;
    parser.next(this.toString());
    return result;
  }
  
  /** Displays the same as `toString()`.
      @memberof module:EBNF~Node
      @instance
  */
  dump () { return this.toString(); }
};

/** Represents a literal symbol for EBNF.

    @mixes module:EBNF~Node
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Node#follow node.follow()}.

    @extends module:Base~Lit
    @property {string} name - representation for a literal.
      Empty string is reserved for `$eof`, the end of input.
    @property {boolean} used - true if used in a grammar.
    @property {Object} prec - precedence, only for translation to BNF.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {string} value - (unquoted) value for the literal; empty string for `$eof`.
    @property {boolean} [screened] - set true only during scanner construction
      if literal value matches a token pattern.
*/
class Lit extends Node(Base.Lit) {
  /** Creates a literal symbol for EBNF;
      see factory method {@linkcode module:EBNF~Grammar#lit grammar.lit()}.
      Sets `.expect` to contain `this`.
      @param {string} [literal] - a (quoted) representation for the literal.
  */
  constructor (literal) {
    super(literal);
    this.shallow(new Set(literal));
  }
}

/** Represents a token symbol for EBNF.

    @mixes module:EBNF~Node
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Node#follow node.follow()}.

    @extends module:Base~Token
    @property {string} name - name for the token.
      Empty string is reserved for `$error`, can be something unexpected; only for translation to BNF.
    @property {boolean} used - true if used in a grammar.
    @property {Object} prec - precedence.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {RegExp} pat - pattern for token; empty `RegExp` for `$error`.
    @property {Array<Lit>} [screen] - contains literals with values matching the pattern, if any.
*/
class Token extends Node(Base.Token) {

  /** Creates a token symbol for BNF;
      see factory method {@linkcode module:BNF~Grammar#token grammar.token()}.
      Sets `.expect` to contain `this`.
      @param {string} name - token name.
      @param {RegExp} pat - for a token.
  */
  constructor (name, pat) {
    super(name, pat);
    this.shallow(new Set(name));
  }
}

/** Represents a non-terminal symbol for EBNF.
    @property {?module:EBNF~Rule} rule - defines `this`, initially `null`.

    @mixes module:EBNF~Node
    @property {module:EBNF~Set} expect - delegated to `.rule`.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~NT#follow node.follow()}.

    @extends module:Base~NT
    @property {string} name - name for the non-terminal.

*/
class NT extends Node(Base.NT) {
  #rule = null;
  get rule () { return this.#rule; }
  set rule (rule) { this.#rule = rule; }
  
  get expect () { return this.rule.expect; }

  /** Creates a non-terminal symbol for BNF;
      see factory method {@linkcode module:EBNF~Grammar#nt grammar.nt()}.
      @param {string} name - non-terminal's name.
  */
  constructor (name) { super(name); }

  /** Override getter: delegates to the referenced rule if any.
      @see {linkcode module:EBNF~Node#shallow Node.shallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {module:EBNF~Set} the (incremented) set, maps terminal names to true.
  */
  shallow (increment) {
    return increment ? super.shallow(increment) : this.rule.shallow();
  }

  /** Override getter: delegates to the referenced rule.
      @see {linkcode module:EBNF~Node#deep Node.deep(increment)}.
      @returns {module:EBNF~Set} the set, maps terminal names to true.
  */
  deep () { return this.rule.deep(); }

  /** Override setter: sets `.rule` only if it makes a difference;
        i.e., recursion stops here once there is no more change.
      @see {linkcode module:EBNF~Node#follow Node.fallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {?module:EBNF~Set} the set, maps terminal names to true.
  */
  follow (increment) {
    const old = this.rule.follow();

    // getter
    if (!increment) return old;

    // setter, any change?
    if (!old || !old.includes(increment)) this.rule.follow(increment);
  }
  
  /** Delegates to the referenced rule..
      @param {module:EBNF~Parser} parser - context.
      @returns the result produce by the referenced rule,
        see {@linkcode module:EBNF~Parser#parse parser.parse()}.
      @throws {string} if recognition fails.
  */
  parse (parser) { return this.rule.parse(parser); }
  
  /** Displays name and contents of all sets.
      @returns {string}
  */
  dump () {
    const result = [ '  ' + this.toString() ];
    if (this.rule && this.expect.length) result.push('    expect: ' + this.expect.toString());
    if (this.rule && this.follow() && this.follow().length) result.push('    follow: ' + this.follow().toString());
    return result.join('\n');
  }
}

/** Represents a sequence of nodes, i.e., one alternative.

    @property {Array<(module:Base~Symbol|module:EBNF~Opt|module:EBNF~Some)>} nodes - descendants,
      not empty, not all {@linkcode module:EBNF~Opt Opt}.
    @property {?module:Base~T} [terminal] - can define precedence; only for translation to BNF.

    @mixes module:EBNF~Node
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Seq#follow node.follow()}.
*/
class Seq extends Node(Object) {
  #nodes;
  get nodes () { return this.#nodes; }
  
  #terminal;
  get terminal () { return this.#terminal; }
    
  /** Creates a sequence of nodes, i.e., one alternative;
      see factory method {@linkcode module:EBNF~Grammar#seq grammar.seq()}.
      @param {Array<(module:Base~Symbol|module:EBNF~Opt|module:EBNF~Some)>} nodes - descendants,
        not empty, not all {@linkcode module:EBNF~Opt Opt}.
      @param {?module:Base~T} [terminal] - can define precedence; only for translation to BNF.
  */
  constructor (nodes, terminal) {
    super();
    this.#nodes = nodes;
    this.#terminal = terminal;
  }  

  /** Override getter: computes `.expect` from left to right as far as necessary.
      @see {linkcode module:EBNF~Node#shallow Node.shallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
   
      @returns {module:EBNF~Set} the (incremented) set, maps terminal names to true.
      @throws {Error} `Seq: all elements are optional` (cannot happen)
  */
  shallow (increment) {
    let result = super.shallow(increment);  // try to inherit getter and setter
    if (increment instanceof Set ||  // setter
        result.length)   // getter if set before
      return result;

    // getter if not set before
    if (! this.nodes.some(node => {
          result = super.shallow(node.shallow());   // add descendant to sequence
          return !(node instanceof Opt);            // quit on non-Opt
        })) throw Error('Seq: all elements are optional');
    return result;
  }

  /** Override getter: computes the set from right to left, implements *optional*.
      @see {linkcode module:EBNF~Node#deep Node.deep(increment)}.
      @returns {module:EBNF~Set} the set, maps terminal names to true.
  */
  deep () {
    return super.shallow(
      this.nodes.reduceRight((right, node) =>
        node instanceof Opt ?
          right.import(node.deep()) :    // add right's expect to Opt's expect 
          new Set().import(node.deep())  // expect is! descendant's                   
      , new Set())
    ); // set this expect
  }

  /** Override setter: sets me, and sets descendants, pushing from right to left;
        implements *optional*.
      @see {linkcode module:EBNF~Node#follow Node.fallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {?module:EBNF~Set} the set, maps terminal names to true.
  */
  follow (increment) {
    // getter
    if (!increment) return super.follow();
    
    // setter
    super.follow(increment); // set me
    this.nodes.reduceRight((follow, node) => {
      node.follow(follow); // set descendant
      const result = new Set().import(node.expect); // previous receives descendant's expect
      if (node instanceof Opt) result.import(follow); // and maybe follow
      return result;
    }, increment);
  }
  
  /** Check for ambiguity: delegate to descendants.
      @param {function} error - should be bound to {@linkcode module:Base~Factory#error grammar.error()}.
      @param {string} name - current rule.
      @returns {undefined|string} error message, if any.
  */
  check (error, name) {
    let anyError = false;
    this.nodes.forEach(node => {
      const e = node.check(error, name);
      if (e) anyError = e;
    });
    if (anyError) return anyError;
  }
  
  /** Recognizes a sequence of descendants;
      implements {@linkcode module:EBNF~Opt Opt} with a result of `null` or the collected array.
      @param {module:EBNF~Parser} parser - context.
      @returns {Array} list of results produced by the descendants, cannot be empty,
        see {@linkcode module:EBNF~Parser#parse parser.parse()}.
      @throws {string} if recognition fails.
  */
  parse (parser) {
    return this.nodes.reduce((result, node) => {
      if (node.expect.match(parser.current))    // match?
        result.push(node.parse(parser));        //   descend and collect result
      else if (node instanceof Opt)             // else: optional phrase?
        result.push(null);                      //   collect null
      else
        throw 'in sequence, ' + node.constructor.name + '.parse(): expects ' + node.expect.toString();
      return result;                            // move on
    }, []);
  }
  
  /** Displays all descendants and precedence terminal, if any.
      @returns {string}
  */
  toString () { return this.nodes.join(' ') + (this.terminal ? ' %prec ' + this.terminal : ''); }
}

/** Represents a list of one or more alternatives.
    Each entry is a {@linkcode Seq} representing one alternative.

    @property {Array<module:EBNF~Seq>} seqs - the alternatives.

    @mixes module:EBNF~Node
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Alt#follow node.follow()}.
*/
class Alt extends Node(Object) {
  #seqs;
  get seqs () { return this.#seqs; }
  
  /** Creates a list of one or more alternatives; should only be used by subclass.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives.
  */
  constructor (seqs) {
    super();
    this.#seqs = seqs;
  }

  /** Override getter: computes the set as sum over all descendants.
      @see {linkcode module:EBNF~Node#shallow Node.shallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {module:EBNF~Set} the (incremented) set, maps terminal names to true.
  */
  shallow (increment) {
    let result = super.shallow(increment);
    if (increment instanceof Set ||      // setter
        result.length)                   // getter if set before
      return result;

    return super.shallow(
      // getter
      this.seqs.reduce((result, seq) => result.import(seq.shallow()), new Set())
    ); // and set me
  }

  /** Override getter: computes the set as sum over all descendants.
      @see {linkcode module:EBNF~Node#deep Node.deep(increment)}.
      @returns {module:EBNF~Set} the set, maps terminal names to true.
  */
  deep () {
    return super.shallow(
      // getter
      this.seqs.reduce((result, seq) => result.import(seq.deep()), new Set())
    ); // and set me
  }
  
  /** Override setter: sets me and all descendants.
      @see {linkcode module:EBNF~Node#follow Node.fallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {?module:EBNF~Set} the set, maps terminal names to true.
  */
  follow (increment) {
    // getter
    if (!increment) return super.follow();
    
    // setter
    super.follow(increment); // set me -- could be rule involved in descendants
    this.seqs.forEach(seq => seq.follow(increment)); // set descendants
  }

  /** Check for ambiguity: descendants' `expect` must be disjoint.
      @param {function} error - should be bound to {@linkcode module:Base~Factory#error grammar.error()}.
      @param {string} name - current rule.
      @returns {undefined|string} error message, if any.
  */
  check (error, name) {
    let anyError = false;
    const len = this.seqs.reduce((sum, seq) => {
        const e = seq.check(error, name);
        if (e) anyError = e;
        return sum + seq.expect.length;
      }, 0);
    if (this.expect.length != len)
      return error(name + ':', 'ambiguous, lookahead can select more than one alternative');
    if (anyError) return anyError;
  }

  /** Recognizes one of several alternatives.
      @param {module:EBNF~Parser} parser - context.
      @returns {Array} the list produced by the selected descendant {@linkcode module:EBNF~Seq Seq},
        see {@linkcode module:EBNF~Parser#parse parser.parse()}.
      @throws {string} if recognition fails.
  */
  parse (parser) {
    const seq = this.seqs.find(seq => seq.expect.match(parser.current));
    parser.grammar.assert(seq, 'Alt parse(): only expects ' + this.expect.toString());
    return seq.parse(parser);
  }
  
  /** Displays all alternatives.
      @returns {string}
  */
  toString () { return this.seqs.join(' | '); }
}

/** Represents an EBNF rule.
    @property {module:EBNF~NT} nt - rule's non-terminal (left-hand side).

    @property {number} recursed - counts nesting during shallow lookahead computation for all rules.
    @property {boolean} reached - true if rule is reached during deep lookahead computation
      from the start rule; avoids multiple computations.

    @extends module:EBNF~Alt
    @property {Array<module:EBNF~Seq>} seqs - the alternatives.
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Alt#follow node.follow()}.
*/
class Rule extends Alt {
  #nt;
  get nt () { return this.#nt; }

  #recursed = 0;
  get recursed () { return this.#recursed; }
  
  #reached = false;
  get reached () { return this.#reached; }

  /** Creates an EBNF rule;
      see {@linkcode module:EBNF~Grammar#rule rule()} factory method.
      @param {module:EBNF~NT} nt - left-hand side, non-terminal.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives on the right-hand side.
  */
  constructor (nt, seqs) {
    super(seqs);
    this.#nt = nt;
  }

  /** Override getter: if left recursion returns empty set (which cannot happen...);
        otherwise inherits: computes the set as sum over all descendants.
      @see {linkcode module:EBNF~Node#shallow Node.shallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {module:EBNF~Set} the (incremented) set, maps terminal names to true.
  */
  shallow (increment) {
    // setter
    if (increment instanceof Set) return super.shallow(increment);

    // getter, left recursive?
    if (this.#recursed ++) return new Set();

    try {
      return this.shallow(
        // delegate to Alt
        super.shallow()
      ); // and set me
    } finally {
      -- this.#recursed;
    }
  }
  
  /** Override getter: sets `.reached`, inherits: computes the set as sum over all descendants.
      @see {linkcode module:EBNF~Node#deep Node.deep(increment)}.
      @returns {module:EBNF~Set} the set, maps terminal names to true.
  */
  deep () {
    if (this.reached) return super.shallow(); // traversed before, computed by shallow
    this.#reached = true;

    // delegate to Alt
    return super.deep();
  }

  /** Delegates to superclass to recognize the descendants
      and processes the result with the corresponding {@link module:Base~Action action} if any.
      The rule name selects either a `function`-valued property or a method of the `actions` object.
      @param {module:EBNF~Parser} parser - context.
      @returns the result produced by the selected descendant and modified by the action, if any,
        see {@linkcode module:EBNF~Parser#parse parser.parse()}.
      @throws {string} if recognition fails or if the action throws.
  */
  parse (parser) {
    try {
      parser.ruleStack = this;            // maintain
      return parser.act(this.nt.name, super.parse(parser));   // process alternatives on right-hand side
    } finally {
      parser.ruleStack = false;
    }
  }
  
  /** Displays a rule in EBNF notation.
      @returns {string}
  */
  toString () {
    return this.nt + ': ' + super.toString() + ';';
  }
}

/** Represents an optional list of alternatives.
    Note that {@linkcode module:EBNF~Seq Seq} implements *optional*.

    @extends module:EBNF~Alt
    @property {Array<module:EBNF~Seq>} seqs - the alternatives.
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Alt#follow node.follow()}.
*/
class Opt extends Alt {
  
  /** Creates an optional list of alternatives;
      see {@linkcode module:EBNF~Grammar#opt opt()} factory method.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives.
  */
  constructor (seqs) { super(seqs); }
  
  /** Check for ambiguity: `expect` and `follow` must be disjoint; delegate to superclass.
      @param {function} error - should be bound to {@linkcode module:Base~Factory#error grammar.error()}.
      @param {string} name - current rule.
      @returns {undefined|string} error message, if any.
  */
  check (error, name) {
    let anyError = super.check(error, name);
    const overlap = this.expect.overlap(this.follow());
    if (overlap.length)
      return error(name + ':', 'ambiguous, need not select optional part: ' + overlap.toString());
    if (anyError) return anyError;
  }
  
  /** Displays alternatives in brackets.
      @returns {string}
  */
  toString () { return '[ ' + super.toString() + ' ]'; }
}

/** Represents a repeatable list of alternatives.

    @extends module:EBNF~Alt
    @property {Array<module:EBNF~Seq>} seqs - the alternatives.
    @property {module:EBNF~Set} expect - set of terminals which a node
      expects to see as {@linkcode module:EBNF~Parser parser.current.t},
      maps terminal names to true; `expect` is not empty.
    @property {?module:EBNF~Set} follow - see {@linkcode module:EBNF~Alt#follow node.follow()}.
*/
class Some extends Alt {

  /** Creates a repeatable list of alternatives;
      see {@linkcode module:EBNF~Grammar#some some()} factory method.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives.
  */
  constructor (seqs) { super(seqs); }
  
  /** Override setter: sets me, and sets descendants to my `.expect` plus `increment`.
      @see {linkcode module:EBNF~Node#follow Node.fallow(increment)}.
      @param {?module:EBNF~Set} [increment] - controls getter/setter behavior, setter adds.
      @returns {?module:EBNF~Set} the set, maps terminal names to true.
  */
  follow (increment) {
    // getter
    if (!increment) return super.follow();

    // setter
    super.follow(increment); // set me
    const descendants = new Set().import(increment).import(this.expect);
    this.seqs.forEach(seq => seq.follow(descendants)); // set descendants
  }

  /** Check for ambiguity: `expect` and `follow` must be disjoint; delegate to superclass.
      @param {function} error - should be bound to {@linkcode module:Base~Factory#error grammar.error()}.
      @param {string} name - current rule.
      @returns {undefined|string} error message, if any.
  */
  check (error, name) {
    let anyError = super.check(error, name);
    const overlap = this.expect.overlap(this.follow());
    if (overlap.length)
      return error(name + ':', 'ambiguous, need not select repeatable part: ' + overlap.toString());
    if (anyError) return anyError;
  }

  /** Recognizes the descendants one or more times.
      @param {module:EBNF~Parser} parser - context.
      @returns {Array<Array>} list of at least one list created by a descendant {@linkcode module:EBNF~Alt Alt},
        see {@linkcode module:EBNF~Parser#parse parser.parse()}.
        The descendants are 
      @throws {string} if recognition fails.
  */
  parse (parser) {
    const result = [ super.parse(parser) ];
    while (parser.current && this.expect.match(parser.current))
      result.push(super.parse(parser));
    return result;
  }
  
  /** Displays a alternatives in braces.
      @returns {string}
  */
  toString () { return '{ ' + super.toString() + ' }'; }  
}

/** Class representing a set of unique, non-empty names.

    @property {Object<string,boolean>} set - maps names to true.
    @property {number} length - the number of names in the set.
*/
class Set {
  #set = {};
  get set () { return this.#set; }
  get length () { return Object.keys(this.set).length; }
  
  /** Create a set containing some unique names.
      @param {string[]} names - to be in the set, implied to be unique.
  */
  constructor (...names) {
    names.forEach(name => this.set[name] = true);
  }
  
  /** Import another set.
      @param {module:EBNF~Set} other - to import.
      @returns {module:EBNF~Set} this set, changed.
  */
  import (other) {
    Object.assign(this.set, other.set);
    return this;
  }
  
  /** Check if next input matches.
      @param {?module:Base~Tuple} tuple - next available input symbol.
      @returns {boolean} true if matched, false otherwise.
  */
  match (tuple) {
    if (!tuple) return false; // end of input, never expected in the tree
    return tuple.t.name in this.set;
  }
  
  /** Check if this set includes another set.
      @param {module:EBNF~Set} other - the other set.
      @return {boolean} true if the other set is a subset of this set.
  */
  includes (other) {
    return Object.keys(other.set).every(key => key in this.set);
  }
  
  /** Check if two sets overlap.
      @param {module:EBNF~Set} other - the other set.
      @return {module:EBNF~Set} the overlap, a new set, may be empty.
  */
  overlap (other) {
    return Object.keys(this.set).reduce((overlap, key) => {
        if (key in other.set) overlap.set[key] = true;
        return overlap;
      }, new Set());
  }
  
  /** Displays the elements.
  */
  toString () { return Object.keys(this.set).join(', '); }
}

/** Wraps a method {@linkcode module:EBNF~Parser#parse parser.parse()}
    which recognizes input and builds a tree of nested lists, calls
    {@link module:Base~Action action functions}, if any.

    @property {?module:Base~Scanner} scanner - tokenizes input.
    @property {Array.<?module:Base~Tuple>} tuples - tokenized input during recognition.
    @property {number} index - index of next tuple during recognition.
    @property {?module:Base~Tuple} current - current input tuple or `null` for end of input during recognition.
    @property {Array<?module:EBNF:Rule>} ruleStack - currently activated rules during recognition.

    @extends module:Base~Parser
    @property {module:EBNF~Grammar} grammar - represents the grammar, counts errors;
      concurrent recognition will trash error counting.
    @property {?Object<string, module:Base~Action>} actions - maps rule names to action functions
      or methods during recognition.
    @property {?Object} data - context for all actions during recognition.
    @property {module:Base~Parser} data.parser - set to `this` unless already defined by caller.
    @property {boolean} oop - true if `.actions` is set to a singleton with
      {@linkcode module:Base~ClassAction ClassAction} methods.
*/
class Parser extends Base.Parser {
  #scanner;
  get scanner () { return this.#scanner; }

  #tuples = [ ];
  get tuples () { return this.#tuples; }

  #index = 0;
  get index () { return this.#index; }

  get current () { return this.tuples[this.index]; } // can be trailing null

  #ruleStack = [];
  get ruleStack () { return this.#ruleStack; }
  set ruleStack (value) { 
    if (value instanceof Rule)  this.#ruleStack.push(value); else this.#ruleStack.pop();
  }

  /** Creates a parser;
      see {@linkcode module:EBNF~Grammar#parser parser()} factory method.
      @param {module:EBNF~Grammar} grammar - represents grammar and states.
      @param {RegExp} [skip] - a pattern to define ignorable character sequences,
        by default white space,
        must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, should use `(:? )`rather than `( )` for grouping.
  */
  constructor (grammar, skip) {
    super(grammar);
    this.#scanner = grammar.scanner(skip); 
  }

  /** Advances `.index` and, therefore, `.current` to the next element of `.tuples`, if any.
      Finds or creates `null` as `.current` to indicate end of input.
      Ignores illegal characters but only reports the first in a sequence.
      Implements lookahead trace.
      @param {string} caller - for trace.
  */
  next (caller) {
    for (let report = true; ; report = false) { // report first illegal character only
      switch (this.index) {
      default:
        this.grammar.assert(this.index <= this.tuples.length, 'next():', this.index, 'index out of bounds');
        break;                      // some tuples left
        
      case this.tuples.length:      // no tuples, maybe?
        this.tuples.push(null);     // point to null as end of input
        throw 'no more input';

      case this.tuples.length - 1:
        if (this.current)           // at last tuple
          this.tuples.push(null);   // add null as end of input
        else                        // at null as end of input
          throw 'no more input';
      }
      ++ this.#index;               // advance
      // trace lookahead
      if (this.grammar.config.lookahead)
        this.grammar.message(caller, 'lookahead:', this.current ? this.current.toString() : 'end of input');
      
      // end of input or terminal symbol?
      if (!this.current || this.current.t) return;
      
      // illegal character
      if (report) this.error('illegal input character');
    }
  }

  /** Recognizes an input sentence. Requires {@linkcode module:EBNF~Grammar#expect grammar.expect()}.
      Resets and reports `.errors` for the grammar.
      @param {string} input - to process.
      @param {Function|Object} [actions] - a function is assumed to be a class
        and a singleton is created with `this` as constructor argument.
        The object maps rule names to action methods.
      @param {Object} arg - used as further constructor arguments.
      @returns {Array|Object} the collected sequence of values or the value produced by the action
        of the {@link module:EBNF~Rule start rule}.
        The parsing methods return the following types, where `object` refers to the result
        produced by the {@link module:Base~Action action} of a {@link module:EBNF~Rule rule}.
| class | returns |
| --- | --- |
| {@linkcode module:EBNF~Lit Lit}     | `string` |
| {@linkcode module:EBNF~Token Token} | `string` |
| {@linkcode module:EBNF~Alt Alt}     |	`Array` |
| {@linkcode module:EBNF~Opt Opt}     |	`null`\|`Array` |
| {@linkcode module:EBNF~Seq Seq}     |	`Array` |
| {@linkcode module:EBNF~Some Some}   |	`Array`\<`Array`\> |
| {@linkcode module:EBNF~Rule Rule}   |	`Array`\|`object` |
| {@linkcode module:EBNF~NT NT}     |	`Array`\|`object` |
      @throws {string} error message, also reported by {@linkcode module:EBNF~Parser#error parser.error()}.
  */
  parse (input, actions = null, ...arg) {
    super.parse(actions, ...arg);
    this.#tuples = this.scanner.scan(input);
    this.#index = -1;
    this.#ruleStack = [];

    // checked?
    if (!this.grammar.rules[0].expect.length) throw this.grammar.error('parse():', 'requires expect()');

    try {
      if (this.grammar.config.parse) this.grammar.trace('parse');
      
      this.next('parser');
      
      const start = this.grammar.rules[0];
      if (!start.expect.match(this.current))            // match before enter
        throw start.nt.name + ': expects ' + start.expect.toString();
      const result = start.parse(this);                 // start rule
      if (this.current)                                 // end of input?
        throw start.nt.name + ': too much input';
      if (this.grammar.errors)                          // from actions, maybe
        this.grammar.message('parse():', this.grammar.errors, this.grammar.errors > 1 ? 'errors' : 'error');
      return result;                                    // success
    } catch (e) {
      throw this.error(e);
    } finally {
      if (this.grammar.config.parse) this.grammar.trace('parse');
    }
  }
  
  /** Displays a message and the rule stack, if any; lets grammar count it as an error.
      @param {object[]} s - message, to be displayed; prefixed by `.current` and joined by blanks.
      @return {string} the message.
  */
  error (...s) {
    return this.grammar.error(this.index >= 0 ? 'at' + ' ' + 
      (this.current ? this.current.toString() : 'end of input') + ':' : '',
        s.join(' ') + (this.ruleStack.length ? ', active rules: ' + 
          this.ruleStack.map(rule => rule.nt.name).join(' ') : ''));
  }
}

/** Represents a context-free LL(1) grammar to create recursive descent parsers.
    Contains factory methods to create objects to represent the grammar as a tree.
    <p>A `Grammar` object can be asked to generate 
    [scanners](#scanner), and [parsers](#parser)
    to process input sentences conforming to the grammar.
    If a parser is called with suitable {@link module:Base~Action actions}
    it can transform input.

    @property {module:EBNF~Rule[]} rules - list of rules; rule zero is start rule.
    @property {string} prefix - prefix for log; assign string to push, else pop.

    @extends module:Base~Factory
    @property {Object.<string, Object>} config - maps names to configurable values.
    @property {function(string[])} config.log - function to print strings, by default `console.log`.
    @property {RegExp} config.lits - restricts literal representation, by default single-quoted;
      must be anchored.
    @property {RegExp} config.tokens - restricts token names, by default alphanumeric;
      must be anchored.
    @property {RegExp} config.nts - restricts non-terminal names, by default alphanumeric;
      must be anchored.
    @property {string} config.uniq - prefix for unique non-terminal names, by default `$-`.

    @property {boolean} config.shallow - trace lookahead during `shallow`.
    @property {boolean} config.deep - trace lookahead during `deep`.
    @property {boolean} config.follow - trace follow during `follow`.
    @property {boolean} config.parse - trace {@linkcode module:EBNF~Parser#parse parse()}.
    @property {boolean} config.lookahead - trace lookahead during {@linkcode module:EBNF~Parser#parse parse()}.
    @property {boolean} config.actions - trace actions, if any,
      during {@linkcode module:EBNF~Parser#parse parse()}.

    @property {Array<module:Base~Lit>} lits - list of unique literals, can be pushed.
    @property {Object.<string, module:Base~Lit>} litsByName - maps `'x'` to unique literal.
    @property {Array<module:Base~Token>} tokens - list of unique tokens, can be pushed.
    @property {Object.<string, module:Base~Token>} tokensByName - maps name to unique token.
    @property {Array<module:Base~Precedence>} levels - list of precedence levels, can be pushed.
    @property {Array<module:Base~NT>} nts - list of unique non-terminals, can be pushed.
    @property {Object.<string, module:Base~NT>} ntsByName - maps name to unique non-terminal.
    @property {number} errors - incremented by {@linkcode module:Base~Factory#error error()} method.
*/
class Grammar extends Base.Factory {
  #rules = [];
  get rules () { return this.#rules; }
  
  #prefix = [];
  get prefix () {
    return this.#prefix.length < 2 ? (this.#prefix.length ? this.#prefix[0] : '') :
      ' '.padEnd(2 * (this.#prefix.length - 1), ' ') + this.#prefix.at(-1);
  }
  set prefix (prefix) {
    if (typeof prefix == 'string') this.#prefix.push(prefix); else this.#prefix.pop();
  }
  
  /** Creates a grammar representation. Defines tokens, if any.
      @param {?string} [grammar] - the grammar to represent,
        using the {@link module:EBNF~Grammar.ebnf EBNF grammar}
        and {@link module:EBNF~Grammar.terminals EBNF token and literal notation}.
        This can be omitted to construct the rules directly using the factory methods.
      @param {?Object.<string, RegExp>} [tokens] - maps token names, if any,
        in the new grammar to their patterns
        which must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, and should use `(:? )`rather than `( )` for grouping.
        `tokens` can map the empty string to a skip pattern
        which will be used to interpret the grammar string.
      @param {Object.<string, Object>} [config] - overwrites configurable values' defaults;
        loaded first but can only be third parameter.
  */
  constructor (grammar = '', tokens = {}, config = {}) {
    super();

    // load configuration, if any
    if (typeof config == 'object' && config !== null)
      Object.assign(this.config, config);

    // compile grammar into this?
    if (typeof grammar == 'string') {
      
      // default skip pattern
      let skip = /\s+/;

      // load tokens, [''] is skip
      if (typeof tokens == 'object' && tokens !== null) {
        if ('' in tokens) {
          skip = tokens[''];
          this.assert(skip instanceof RegExp, 'new Grammar():', skip, 'not a pattern');
          delete tokens[''];
        }
        this.add(tokens);
      }

      // need to send output to the new config
      Grammar.grammar.config.log = this.config.log;

      // compile grammar
      Grammar.grammar.parser(skip).parse(grammar, new Actions(this));

    // only load tokens (from grammar)
    } else if (typeof grammar == 'object' && grammar !== null) {
      delete grammar['']; // if any
      this.add(grammar);  // i.e., the token definitions if any
    }
  }

  /** Computes the `expect` sets; only call once.
      ** Does not permit precedences.
      ** There has to be at least one rule.
      ** All non-terminals must be defined, each by a unique rule.
      ** Detects left recursion as an error.
      ** Computes `expect` for each node; a non-terminal obtains it from the rule.
      ** All rules must be necessary, i.e., reachable from the first rule.
      @returns {undefined|string} an error message on failure.
  */
  expect () {
    // already computed?
    if (this.rules[0].expect.length) return this.error('expect():', 'already called');

    // precedences?
    if (this.levels.length) return this.error('check():', 'no precedences for recursive descent');

    // all non-terminals defined?
    if (!this.rules.length) return this.error('expect():', 'no rules');
    if (this.rules.length > this.nts.length)
      return this.error('expect():', 'duplicate rule definition(s)');
    if (this.rules.length < this.nts.length)
      return this.error('expect():',
        this.nts.filter(nt => !nt.rule).map(nt => nt.name).join(', ') + ': undefined');
    
    // set expect in each rule -- finds left recursion
    try {
      if (this.config.shallow) this.trace('shallow');
      this.rules.forEach(rule => rule.shallow());
      const bad = this.rules.filter(rule => rule.recursed).map(rule => rule.nt.name);
      if (bad.length) return this.error('expect():', bad.join(', ') + ': left recursive');
    } finally {
      if (this.config.shallow) this.trace('shallow');
    }  
  
    // set expect everywhere -- finds non-reachable rules
    try {
      if (this.config.deep) this.trace('deep');
      this.rules[0].deep();
      const bad = this.rules.filter(rule => !rule.reached).map(rule => rule.nt.name);
      if (bad.length) return this.error('expect():', bad.join(', ') + ': not reached');
    } finally {
      if (this.config.deep) this.trace('deep');
    }
  }
  
  /** Checks the grammar to be LL(1).
      ** Calls {@linkcode module:EBNF~Grammar#expect expect()} if necessary.
      ** Computes `follow` for each node; a non-terminal obtains it from the rule.
      ** Detects ambiguities.
      @returns {udefined|string} an error message on failure.
  */
  check () {
    // expect computed?
    if (!this.rules[0].expect.length) { const e = this.expect(); if (e) return e; }
        
    // need to compute follow?
    if (this.rules[0].follow() === null)
      // set follow everywhere
      try {
        if (this.config.follow) this.trace('follow');
        this.rules[0].follow(new Set());
      } finally {
        if (this.config.follow) this.trace('follow');
      }
    
    // errors?
    if (this.errors) return;

    // check each rule for ambiguities
    const error = this.constructor.prototype.error.bind(this);
    if (this.rules.reduce((errors, rule) => rule.check(error, rule.nt.name) ? ++ errors : errors, 0))
      return this.message('check():', 'found ambiguities');
  }

  /** Installs and removes trace wrappers for grammar checking and `parse` methods;
      controlled by the configuration flags `shallow`, `deep`, `follow`, and `parse`,
      should only be called by {@linkcode module:EBNF~Grammar#expect expect()}
      and {@linkcode module:EBNF~Parser#parse parser.parse()}.
      <p>The tracing wrappers use `.config.log` and `.prefix`.
      <p>Grammar checking and `parse` methods
        are cached in {@linkcode module:EBNF~Grammar.tracing Grammar.tracing} globally
        per method and class.
      @param {string} what - one of `shallow`, `deep`, `follow`, or `parse` to trace that algorithm. 
  */
  trace (what) {
    const self = this; // closure
    const classes = [ Rule, Some, Opt, Alt, Seq, NT, Lit, Token ];
    
    if (!/^(?:parse|shallow|deep|follow)$/.test(what)) return;
         
    if (what in Grammar.tracing) {                // turn method tracing off
      classes.reverse().forEach(cls => {          // for each class...
        if (cls.name in Grammar.tracing[what])    // ...which was traced
                                                  // restore method
          cls.prototype[what] = Grammar.tracing[what][cls.name];
      });
      classes.reverse();                          // undo reverse order
      delete Grammar.tracing[what];               // delete cache
    
    } else {                                      // turn method tracing on
      Grammar.tracing[what] = {};                 // create cache
      classes.forEach(cls => {                    // for each class...
        if (what in cls.prototype) {              // ...which has the method
          Grammar.tracing[what][cls.name] = cls.prototype[what];  // cache
          switch (what) {
          case 'shallow':                         // trace getter
          case 'deep':
            cls.prototype[what] =                 // replace method
              function (set) {
                try {
                  const label = (this.constructor.name == cls.name ? cls.name : 'super') +
                    (cls == Rule ? '' : '(' + this.toString() + ')');
                  if (cls == Rule)
                    self.prefix = this.nt.name;   // prefix for messages

                  if (!(set instanceof Set))      // trace getter only
                    self.config.log(self.prefix + '|', label, what, '{');

                  const result = Grammar.tracing[what][cls.name].call(this, set);

                  if (!(set instanceof Set))
                    self.config.log(self.prefix + '|', label, what, '}:', result.toString());
                  return result;
                } finally {
                  if (cls == Rule) self.prefix = false;
                }
              };
            break;
        
          case 'follow':                          // trace setter
            cls.prototype[what] =                 // setter replace method
              function (set) {
                try {
                  const label = (this.constructor.name == cls.name ? cls.name : 'super') +
                    (cls == Rule ? '' : '(' + this.toString() + ')');
                  if (cls == Rule)
                    self.prefix = this.nt.name;   // prefix for messages

                  if (set instanceof Set)         // trace setter only
                    self.config.log(self.prefix + '|', label, what + '(' + set.toString() + ')', '{');

                  const result = Grammar.tracing[what][cls.name].call(this, set);

                  if (set instanceof Set)         // call getter for display
                    self.config.log(self.prefix + '|', label, what, '}:',
                      Grammar.tracing[what][cls.name].call(this).toString());
                  return result;
                } finally {
                  if (cls == Rule) self.prefix = false;
                }
              };
            break;
        
          case 'parse':                           // trace call and result
            cls.prototype[what] =                 // replace method
              function (context) {
                try {
                  const label = (this.constructor.name == cls.name ? cls.name : 'super') +
                    (cls == Rule ? '' : '(' + this.toString() + ')');
                  if (cls == Rule)
                    self.prefix = this.nt.name;   // prefix for messages

                  self.config.log(self.prefix + '|', label, what, '{');

                  const result = Grammar.tracing[what][cls.name].call(this, context);

                  self.config.log(self.prefix + '|', label, what, '}:', self.dump(result));
                  return result;
                } finally {
                  if (cls == Rule) self.prefix = false;
                }
              };
            break;
          }
        }
      });
    }
  }

  /** Factory method to create a unique literal symbol, maintains `.lits` and `.litsByName`
      @param {string} literal - literal's representation conforming to `.config.lits`.
      @param {boolean} [used] - if `true` mark literal as used.
      @returns {module:EBNF~Lit} a unique literal.
  */
  lit (literal, used) {
    // return existing literal?
    let lit = this.litsByName[literal];
    if (! lit) {
      // create new literal
      lit =  new Lit(literal);
      this.add(lit);
    }
    if (used) lit.used = true;
    return lit;
  }

  /** Factory method to create a unique token symbol, maintains `.tokens` and `.tokensByName`.
      @param {string} [name] - token's name conforming to `.config.tokens`; error if a non-terminal.
        If omitted represents the `$error` token with an empty `RegExp` (intended for BNF translation).
      @param {RegExp} [pat] - pattern to match values representing the token in input;
        used only when the token is created,
        must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, should use `(:? )`rather than `( )` for grouping.
      @param {boolean} [used] - if `true` mark token as used.
      @returns {module:EBNF~Token} a unique token.
  */
  token (name = '', pat, used) {
    // return existing token?
    let token = this.tokensByName[name];
    if (! token) {
      // don't allow non-terminal
      if (name != '' && name in this.ntsByName)
        this.error(name, 'is already defined as a non-terminal');
      // create new token
      token = new Token(name, name.length ? pat : new RegExp());
      this.add(token);
    }
    if (used) token.used = true;
    return token;
  };

  /** Factory method to create a unique non-terminal symbol, maintains `.nts` and `.ntsByName`.
      @param {string} [name] - non-terminal's name conforming to `config.nts`; error if a token.
      If not a string creates a unique name (intended for grammar extension).
      @returns {module:EBNF~NT} a unique non-terminal.
  */
  nt (name) {
    // unique name?
    if (typeof name != 'string') name = this.config.uniq + this.nts.length;

    // return existing non-terminal?
    let nt = this.ntsByName[name];
    if (! nt) {
      // don't allow token
      if (name != '' && name in this.tokensByName) 
        this.error(name, 'is already defined as a token');
      // create new non-terminal
      nt = new NT(name);  
      this.add(nt);
    }
    return nt;
  }

  /** Factory method to create a rule representation for EBNF.
      Maintains rule's non-terminal's `.rule` and `this.rules`.
      @param {module:EBNF~NT} nt - left-hand side, non-terminal.
      @param {module:EBNF~Seq[]} seqs - right-hand side, list of alternative sequences.
      @returns {module:EBNF~Rule} a new rule representation.
  */
  rule (nt, ...seqs) {
    this.assert(nt instanceof NT, 'rule():', nt, 'not a non-terminal');
    this.assert(seqs instanceof Array && seqs.length && seqs.every(s => s instanceof Seq),
      'rule():', seqs, 'not a non-empty list of Seq');

    if (nt.rule) this.error(nt.toString(), ': duplicate definition');

    // create new rule
    const rule = new Rule(nt, seqs);

    // add new rule to rule's nt's rules and this.rules
    rule.nt.rule = rule;
    this.rules.push(rule);
    return rule;
  }

  /** Factory method to represent a sequence of nodes for EBNF.
      Precedence levels have to be defined prior to using this method.
      @param {Array<(module:Base~Symbol|module:EBNF~Opt|module:EBNF~Some)>} nodes - descendants,
        not empty, not all {@linkcode module:EBNF~Opt Opt}.
      @param {?module:Base~T} [terminal] - can define precedence for translation to BNF.
      @returns {module:EBNF~Seq} a new sequence.
  */
  seq (nodes, terminal = null) {
    this.assert(nodes instanceof Array && nodes.length &&
      nodes.every(n => n instanceof Base.Symbol || n instanceof Opt || n instanceof Some),
      'seq():', nodes, 'not a non-empty list of symbols, Opt, or Some');
    this.assert(nodes.some(n => !(n instanceof Opt)), 'seq():', nodes, 'list only contains Opt');
    this.assert(terminal === null || terminal instanceof Base.T, 'seq():', terminal, 'not a terminal');

    // create new sequence
    return new Seq(nodes, terminal);
  }

  /** Factory method to represent a list of alternatives for EBNF.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives, not empty.
      @returns {module:EBNF~Alt} a new list of alternatives.
  */
  alt (...seqs) {
    this.assert(seqs instanceof Array && seqs.length && seqs.every(s => s instanceof Seq),
      'alt():', seqs, 'not a non-empty list of Seq');

    return new Alt(seqs);
  }

  /** Factory method to represent an optional list of alternatives for EBNF.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives, not empty.
      @returns {module:EBNF~Opt} a new optional list of alternatives.
  */
  opt (...seqs) {
    this.assert(seqs instanceof Array && seqs.length && seqs.every(s => s instanceof Seq),
      'opt():', seqs, 'not a non-empty list of Seq');

    return new Opt(seqs);
  }

  /** Factory method to represent a repeatable list of alternatives for EBNF.
      @param {Array<module:EBNF~Seq>} seqs - the alternatives, not empty.
      @returns {module:EBNF~Opt} a new repeatable list of alternatives.
  */
  some (...seqs) {
    this.assert(seqs instanceof Array && seqs.length && seqs.every(s => s instanceof Seq),
      'some():', seqs, 'not a non-empty list of Seq');

    return new Some(seqs);
  }

  /** Factory method to create a parser to recognize and process input.
      Requires that the {@link module:EBNF~Grammar#expect expect sets} for this grammar have been prepared.
      @param {RegEx} [skip] - a pattern to define ignorable character sequences,
        by default white space,
        must not accept empty input, must not use flags, must not be anchored,
        should use `(:? )`rather than `( )` for grouping.
      @returns {module:EBNF~Parser} the parser.
  */
  parser (skip = new RegExp('\\s+')) {   // /\s+/ crashes jsdoc
    this.assert(this.rules[0].expect.length, 'parser():', this, 'has not been checked');    
    this.assert(skip instanceof RegExp, 'parser():', skip, 'not a regular expression');    
    return new Parser(this, skip);
  }

  /** Displays a description of the grammar.
      @returns {string}
  */
  toString () {
    const result = [];
    
    if (this.levels.length)
      result.push(... this.levels.map(level => '    ' + level.toString()), '');

    if (this.rules.length)
      result.push(... this.rules.map((rule, n) => ('  ' + n).substr(-3) + ' ' + rule.toString()), '');

    result.push('literals: ' + this.lits.filter(lit => lit.used).join(', '));
    result.push('tokens: ' + this.tokens.filter(token => token.used).join(', '));

    if (this.errors) result.push('', 'errors: ' + this.errors);

    return result.join('\n');
  }
  
  /** Displays the grammar and all symbols with name and contents of all sets.
      With argument (kludge!) acts as a static method and
      converts nested arrays to a string –
      useful because `console.debug` only reaches 3 levels.
      @param {?Object} [a] - the object to convert to a string.
      @returns {string}
  */
  dump (a) {
    // kludge part
    if (arguments.length) return super.dump(a);
  
    const result = [];

    if (this.levels.length)
      result.push(... this.levels.map(level => '    ' + level.toString()), '');

    if (this.rules.length)
      result.push(... this.rules.map((rule, n) => ('  ' + n).substr(-3) + ' ' + rule.toString()), '');

    result.push('literals: ' + this.lits.join(', '));
    result.push('tokens: ' + this.tokens.map(token => token + ' ' + token.pat).join(', '));
    result.push('non-terminals:', ...this.nts.map(nt => nt.dump()));

    if (this.errors) result.push('', 'errors: ' + this.errors);

    return result.join('\n');
  }
}

/** 
 * Common method cache for tracing grammar checking and parsing.
 * `cls.prototype.method` is cached as `Grammar.tracing[method][cls.name]`.
 * If `Grammar.tracing[method]` exists, tracing can only be turned off
 * and vice versa.
 * <p>Tracing grammar checking and parsing is static,
 * i.e., common to all grammars that might be created,
 * because the methods themselves are common to all grammars.
 * @static
 * @type {Object<string,Object<string, function>>}
*/
Grammar.tracing = { };

/**
 * Grammar describing the EBNF notation accepted by {@linkcode module:EBNF~Grammar new Grammar()}:
 * <p> A *grammar* consists of one or more rules.
 * <p> Each *rule* has a unique name on the left-hand side and alternatives
 * on the right-hand side * 
 * <p> *Alternatives* are one or more symbol sequences, separated by `|`.
 * <p> A *symbol sequence* contains one or more items, such as a rule name,
 * a self-defining {@link module:EBNF~Grammar.terminals literal},
 * the name of a {@link module:EBNF~Grammar.terminals token},
 * or alternatives enclosed by braces or brackets.
 * <p> Braces denote that the enclosed alternatives appear
 * one or more times in a sentence.
 * <p> Brackets denote that the enclosed alternatives are optional,
 * i.e., they may or may not appear (once) in a sentence.
 * A symbol sequence must not only contain optional alternatives.
 * @example <caption> EBNF grammars' grammar </caption>
 * grammar: [{ level }] { rule };
 * level:   '%left' { term } ';' |
 *          '%right' { term } ';' |
 *          '%nonassoc' { term } ';';
 * rule:    Token ':' alt ';';
 * alt:     seq [{ '|' seq }];
 * seq:     { lit | ref | opt | some } [ '%prec' term ];
 * term:    lit | ref; 
 * lit:     Lit;
 * ref:     Token;
 * opt:     '[' alt ']';
 * some:    '{' alt '}';
 * @constant {string}
 */
Grammar.ebnf = [
  "grammar: [{ level }] { rule };",
  "level:   '%left'     { term } ';' |",
  "         '%right'    { term } ';' |",
  "         '%nonassoc' { term } ';';",
  "rule:    Token ':' alt ';';",
  "alt:     seq [{ '|' seq }];",
  "seq:     { lit | ref | opt | some } [ '%prec' term ];",
  "term:    lit | ref;",
  "lit:     Lit;",
  "ref:     Token;",
  "opt:     '[' alt ']';",
  "some:    '{' alt '}';"
].join('\n');

/**
 * Token definitions for `Lit` and `Token`
 * in {@linkcode module:EBNF~Grammar.ebnf Grammar.ebnf}.
 * <p> *Literals* represent themselves and are single-quoted strings
 * using `\` only to escape single quotes and `\` itself.
 * <p> *Tokens* represent sets of inputs, such as names or numbers,
 * and are alphanumeric names which must start with a letter
 * and may include underscores.
 * <p>A `Name` can include `$error` for {@link module:BNF~Grammar.fromEBNF translation to BNF}.
 * @example <caption> EBNF grammars' tokens </caption>
 * {
 *   Lit:    /'(?:[^'\\]|\\['\\])+'/,
 *   Token:  /[A-Za-z][A-Za-z0-9_]*|\$error/
 * }
 * @see {@linkcode module:EBNF~Grammar.grammar Grammar.grammar}
 * @constant {Object<string,RegExp>}
 */
Grammar.terminals = {
  Lit:    /'(?:[^'\\]|\\['\\])+'/,
  Token:  /[A-Za-z][A-Za-z0-9_]*|\$error/
};

/**
 * The EBNF grammars' grammar; created when the module is loaded
 * and used internally in {@linkcode module:EBNF~Grammar new Grammar()}.
 * @see {@linkcode module:EBNF~Actions Actions}
 * @constant {module:EBNF~Grammar}
 * @private
 */
Grammar.grammar = new Grammar(Grammar.terminals); {
  // grammar: [{ level }] { rule };
  Grammar.grammar.rule(Grammar.grammar.nt('grammar'),
    Grammar.grammar.seq([
      Grammar.grammar.opt(
        Grammar.grammar.seq([
          Grammar.grammar.some(
            Grammar.grammar.seq([
              Grammar.grammar.nt('level')
            ], null)
          )
        ], null)
      ),
      Grammar.grammar.some(
        Grammar.grammar.seq([
          Grammar.grammar.nt('rule')
        ], null)
      ) 
    ], null)
  );
  // level: '%left' { term } ';' | '%right' { term } ';' | '%nonassoc' { term } ';';
  Grammar.grammar.rule(Grammar.grammar.nt('level'),
    Grammar.grammar.seq([
      Grammar.grammar.lit("'%left'"),
      Grammar.grammar.some(
        Grammar.grammar.seq([
          Grammar.grammar.nt('term')
        ], null)
      ),
      Grammar.grammar.lit("';'")
    ], null),
    Grammar.grammar.seq([
      Grammar.grammar.lit("'%right'"),
      Grammar.grammar.some(
        Grammar.grammar.seq([
          Grammar.grammar.nt('term')
        ], null)
      ),
      Grammar.grammar.lit("';'")
    ], null),
    Grammar.grammar.seq([
      Grammar.grammar.lit("'%nonassoc'"),
      Grammar.grammar.some(
        Grammar.grammar.seq([
          Grammar.grammar.nt('term')
        ], null)
      ),
      Grammar.grammar.lit("';'")
    ], null)
  );
  // rule: Token ':' alt ';';
  Grammar.grammar.rule(Grammar.grammar.nt('rule'),
    Grammar.grammar.seq([
      Grammar.grammar.token('Token'),
      Grammar.grammar.lit("':'"),
      Grammar.grammar.nt('alt'),
      Grammar.grammar.lit("';'")
    ], null)
  );
  // alt: seq [{ '|' seq }];
  Grammar.grammar.rule(Grammar.grammar.nt('alt'),
    Grammar.grammar.seq([
      Grammar.grammar.nt('seq'),
      Grammar.grammar.opt(
        Grammar.grammar.seq([
          Grammar.grammar.some(
            Grammar.grammar.seq([
              Grammar.grammar.lit("'|'"),
              Grammar.grammar.nt('seq')
            ], null)
          )
        ], null)
      )
    ], null)
  );
  // seq: { lit | ref | opt | some } [ '%prec' term ];
  Grammar.grammar.rule(Grammar.grammar.nt('seq'),
    Grammar.grammar.seq([
      Grammar.grammar.some(
        Grammar.grammar.seq([ Grammar.grammar.nt('lit') ], null),
        Grammar.grammar.seq([ Grammar.grammar.nt('ref') ], null),
        Grammar.grammar.seq([ Grammar.grammar.nt('opt') ], null),
        Grammar.grammar.seq([ Grammar.grammar.nt('some') ], null)
      ),
      Grammar.grammar.opt(
        Grammar.grammar.seq([
          Grammar.grammar.lit("'%prec'"),
          Grammar.grammar.nt('term')
        ], null)
      )
    ], null)
  );
  // term: lit | ref;
  Grammar.grammar.rule(Grammar.grammar.nt('term'),
    Grammar.grammar.seq([
      Grammar.grammar.nt('lit')
    ], null),
    Grammar.grammar.seq([
      Grammar.grammar.nt('ref')
    ], null)
  );
  // lit: Lit;
  Grammar.grammar.rule(Grammar.grammar.nt('lit'),
    Grammar.grammar.seq([
      Grammar.grammar.token('Lit')
    ], null)
  );
  // ref: Token;
  Grammar.grammar.rule(Grammar.grammar.nt('ref'),
    Grammar.grammar.seq([
      Grammar.grammar.token('Token')
    ], null)
  );
  // opt: '[' alt ']';
  Grammar.grammar.rule(Grammar.grammar.nt('opt'),
    Grammar.grammar.seq([
      Grammar.grammar.lit("'['"),
      Grammar.grammar.nt('alt'),
      Grammar.grammar.lit("']'")
    ], null)
  );
  // some: '{' alt '}';
  Grammar.grammar.rule(Grammar.grammar.nt('some'),
    Grammar.grammar.seq([
      Grammar.grammar.lit("'{'"),
      Grammar.grammar.nt('alt'),
      Grammar.grammar.lit("'}'")
    ], null)
  );
  
  // all but $error are used
  Grammar.grammar.lits.forEach(lit => lit.used = true);
  Grammar.grammar.tokens.forEach(token => { if (token.name.length) token.used = true; });

  Grammar.grammar.check();
}

/** The EBNF grammar parser's actions,
    used internally in {@linkcode module:EBNF~Grammar new Grammar()}.
    @property {module:EBNF~Grammar} g - the grammar to add precedences and rules to.
    @private
*/
class Actions {
  #g;
  get g () { return this.#g; }

  /** Creates the singleton with the {@link module:Base~Action action methods}.
      @param {module:EBNF~Grammar} g - to hold the rule representations.
  */  
  constructor (g) { this.#g = g; }
    
  /** `grammar: [{ level }] { rule };`
      @returns {module:EBNF~Grammar} represents the grammar, not yet checked.
  */
  grammar (l, r) { return this.g; }

  /** `level: '%left' { term } ';' | '%right' { term } ';' | '%nonassoc' { term } ';';`
      @returns {module:Base~Precedence} represents a precedence level.
  */
  level (assoc, some, _) { return this.g.precedence(assoc, some.flat()); }

  /** `rule: Token ':' alt ';';`
      @returns {module:EBNF~Rule} represents a rule.
  */
  rule (name, _, alt, s) { return this.g.rule(this.g.nt(name), ...alt.seqs); }

  /** `alt: seq [{ '|' seq }];`
      @returns {module:EBNF~Alt} represents a list of one or more alternatives.
  */
  alt (seq, many) { 
    return many ?
      this.g.alt(seq, ... many.flat(1).map(elt => elt[1])) :
      this.g.alt(seq);
  }

  /** `seq: { lit | ref | opt | some } [ '%prec' term ];`
      @returns {module:EBNF~Seq} represents a list of one or more items.
  */
  seq (some, opt) {
    if (some.flat().every(node => node instanceof Opt))
      throw this.g.error(some.flat().join(', ') + ': all sequence elements are optional');
    if (opt) {
      if (opt[1] instanceof Base.T)
        return this.g.seq(some.flat(), opt[1]);
      this.g.error(this.g.dump(opt[1]) + ': not a terminal');
    }
    return this.g.seq(some.flat(), null);
  }

  /** `term: lit | ref;`
      @returns {module:EBNF~Lit|module:EBNF~Token|module:EBNF~NT} represents a symbol.
  */
  term (term) { return term; }

  /** `lit: Lit;`
      @returns {module:EBNF~Lit} represents a used literal.
  */
  lit (literal) { return this.g.lit(literal, true); }

  /** `ref: Token;`
      @returns {module:EBNF~Token|module:EBNF~NT} represents a used token or a non-terminal.
  */
  ref (name) { 
    if (name == '$error') return this.g.token('', new RegExp(), true);
    if (name in this.g.tokensByName) return this.g.token(name, undefined, true);
    return this.g.nt(name);
  }

  /** `opt: '[' alt ']';`
      @returns {module:EBNF~Opt} represents an optional list of one or more alternatives.
  */
  opt (lb, alt, rb) { return this.g.opt(...alt.seqs); }

  /** `some: '{' alt '}';`
      @returns {module:EBNF~Some} represents a list of one or more alternatives.
  */
  some (lb, alt, rb) { return this.g.some(...alt.seqs); }
}

/** Might publish inner classes for tests
fudge: function (ebnf) {
  ebnf.Alt = Alt;
  ebnf.Lit = Lit;
  ebnf.NT = NT;
  ebnf.Opt = Opt;
  ebnf.Parser = Parser;
  ebnf.Rule = Rule;
  ebnf.Seq = Seq;
  ebnf.Set = Set;
  ebnf.Some = Some;
  ebnf.Token = Token;
}
*/

export {
  Grammar,
  Actions,
};
