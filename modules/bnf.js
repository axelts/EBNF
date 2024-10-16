/** A module which extends the {@link module:Base Base module}
  * and supports creating scanners and SLR(1) parsers from BNF grammars.
  * Parsers employ the [observer pattern](https://en.wikipedia.org/wiki/Observer_pattern)
  * to be traced and to call actions written in JavaScript.
  *
  * The fundamental object created by this module is a {@linkcode module:BNF~Grammar Grammar}
  * which could be prepared from grammar rules using the syntax defined
  * {@link module:BNF~Grammar#bnf here}. 
  * Grammars are written as ordered pairs and can define precedences.
  *
  * The state table is created from sets of positions in rules,
  * and conflicts are resolved using the lookahead and follow sets,
  * and precedences, if available,
  * i.e., it is a [simplified implementation of LR(1)](https://en.wikipedia.org/wiki/Simple_LR_parser).
  * The table is not optimized.
  *
  * An {@link module:EBNF~Grammar EBNF grammar},
  * optionally with precedences and `$error`,
  * can be imported for SLR(1) parsing,
  * but the {@link module:BNF BNF} and {@link module:EBNF EBNF} modules
  * only depend on the {@link module:Base Base module} and not on each other.
  *
  * The grammar rules, precedence levels, and states
  * are represented using a number of classes summarized below.
  * {@linkcode module:BNF~Grammar#check check()} creates a state table
  * which controls a {@linkcode module:BNF~Parser Parser}.
  * A {@linkcode module:Base~Scanner Scanner} is created from the grammar's terminals.
  *
  * Objects are created using factory methods which check parameters
  * and maintain inventories. All factory methods are defined in {@linkcode module:BNF~Grammar Grammar}
  * and the factory methods for all but {@linkcode module:BNF~Message Message} have the same name as the classes
  * (with lower-case initials).
  *
  * All properties have getters, very few have setters, i.e., there is
  * no assignment outside class boundaries.

| class | main properties | main methods |
| ----- | --------------- | ------------ |
| {@linkcode module:BNF~Grammar Grammar}: {@linkcode module:Base~Factory Factory}  | `config`, `ebnf`, `sr`, `rr`, `rules`: `Array<`{@linkcode module:BNF~Rule Rule}`>`,<br>`states`: `Array<`{@linkcode module:BNF~State State}`>` | {@linkcode module:BNF~Grammar#check check()}, {@linkcode module:BNF~Grammar#parser parser()}, {@linkcode module:BNF~Parser#build build()}, {@linkcode module:BNF~Parser#trace trace()} |
| {@linkcode module:BNF~Rule Rule} | `nt`, `symbols`: `Array<`{@linkcode module:Base~Symbol Symbol}`>`, `prec`, `empty`, `reached`, `finite`, `first`, `reduced` | |
| {@linkcode module:BNF~NT NT}: {@linkcode module:Base~NT NT}: {@linkcode module:Base~Symbol Symbol} | `name`, `ord`, `rules`: `Array<`{@linkcode module:BNF~Rule Rule}`>`, `empty`, `reached`, `finite`, `first`, `follow` | |
| {@linkcode module:BNF~Lit Lit}: {@linkcode module:Base~Lit Lit}: {@linkcode module:Base~T T}: {@linkcode module:Base~Symbol Symbol} | `name`, `value`, `ord`, `prec`, `used`, `first` | {@linkcode module:BNF~Lit#unescape unescape(s)} |
| {@linkcode module:BNF~Token Token}: {@linkcode module:Base~Token Token}: {@linkcode module:Base~T T}: {@linkcode module:Base~Symbol Symbol} | `name`, `pat`, `ord`, `prec`, `used`, `first` | |
| {@linkcode module:BNF~State State} | `marks`: `Array<`{@linkcode module:BNF~Mark Mark}`>`, `core`,<br>`messages`: `Object<ord,` {@linkcode module:BNF~Message Message}`>` | {@linkcode module:BNF~State#advance advance(state)}, {@linkcode module:BNF~State#equals equals(core)} |
| {@linkcode module:BNF~Mark Mark} | `rule`, `position`, `complete` | {@linkcode module:BNF~Mark#advance advance()}, {@linkcode module:BNF~Mark#equals equals(mark)} |
| {@linkcode module:BNF~Message Message} | `message`, `symbol`, `info` | |
| {@linkcode module:BNF~Parser Parser} | `grammar`, `stack[]`, `state`: {@linkcode module:BNF~State State}, `values[]` | {@linkcode module:BNF~Parser#parse parse(input)} |

    @module BNF
    @see module:Base
    @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-07-25
*/

import * as Base from './base.js';

/** @mixin
    @property {number} ord - global index; set in {@linkcode module:BNF~Grammar#check check()}.
    @property {Object.<number, module:Base~T>} first - maps `ord` to `this`.
*/
const T = (superclass) => class extends superclass {

  #ord = undefined;
  get ord () { return this.#ord; }
  set ord (value) { typeof this.#ord == 'undefined' && (this.#ord = value); }
  
  #first = { };
  get first () { return this.#first; }
  
  /** Displays ordinal number, if any, and description of terminal.
      @returns {string}
      @memberof module:BNF~T
      @instance
  */
  dump () { return (this.ord >= 0 ? this.ord : '?') + ': ' + super.dump(); }
}

/** Represents a literal symbol for BNF.

    @mixes module:BNF~T
    @property {number} ord - global index; set in {@linkcode module:BNF~Grammar#check check()}.
    @property {Object.<number, module:Base~T>} first - maps `ord` to `this`.

    @extends module:Base~Lit
    @property {string} name - representation for a literal.
      Empty string is reserved for `$eof`, the end of input.
    @property {Object} prec - precedence.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {string} value - (unquoted) value for the literal; empty string for `$eof`, too.
    @property {boolean} [screened] - set true only during scanner construction
      if literal value matches a token pattern.
*/
class Lit extends T(Base.Lit) {

  /** Creates a literal symbol for BNF;
      see factory method {@linkcode module:BNF~Grammar#lit grammar.lit()}.
      @param {string} [name] - a (quoted) representation for the literal.
  */
  constructor (name) { super(name); }
}

/** Represents a token symbol for BNF.

    mixes module:BNF~T
    @property {number} ord - global index; set in {@linkcode module:BNF~Grammar#check check()}.
    @property {Object.<number, module:Base~T>} first - maps `ord` to `this`.

    @extends module:Base~Token
    @property {string} name - name for the token.
      Empty string is reserved for `$error`, can be something unexpected.
    @property {Object} prec - precedence.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {RegExp} pat - pattern for token; empty `RegExp` for `$error`.
    @property {Array<Lit>} [screen] - contains literals with values matching the pattern, if any.
*/
class Token extends T(Base.Token) {

  /** Creates a token symbol for BNF;
      see factory method {@linkcode module:BNF~Grammar#token grammar.token()}.
      @param {string} name - token name.
      @param {RegExp} pat - for a token.
  */
  constructor (name, pat) { super(name, pat); }
}

/** Represents a non-terminal symbol for BNF.
    @property {number} index - non-terminal's index in `.nts`.
    @property {number} ord - non-terminal's global index;
      set in {@linkcode module:BNF~Grammar#check check()}.
    @property {module:BNF~Rule[]} rules - defining `this`.
    @property {boolean} empty - true if no input can be accepted.
    @property {boolean} reached - true if this can be reached from rule zero.
    @property {boolean} finite - true if there is a non-recursive expansion.
    @property {Object.<number, module:BNF~T>} first - terminals at front,
      maps ord to {@link module:BNF~T}.
    @property {Object.<number, module:BNF~T>} follow - terminals following,
      maps ord to {@link module:BNF~T}.

    @extends module:Base~NT
    @property {string} name - name for the non-terminal.
      Empty string is reserved for `$accept`, can be left-hand side of a start rule.
*/
class NT extends Base.NT {
  #index;
  get index () { return this.#index; }

  #ord = undefined;
  get ord () { return this.#ord; }
  set ord (value) { typeof this.#ord == 'undefined' && (this.#ord = value); }

  #rules = [];
  get rules () { return this.#rules; }

  #empty;
  get empty () { return this.#empty; }
  set empty (_) { this.#empty = true; } // cannot unset it

  #reached = false;
  get reached () { return this.#reached; }
  set reached (_) { this.#reached = true; } // cannot unset it

  #finite = false;
  get finite () { return this.#finite; }
  set finite (_) { this.#finite = true; } // cannot unset it

  #first = {};
  get first () { return this.#first; }

  #follow = {};
  get follow () { return this.#follow; }

  /** Creates a non-terminal symbol for BNF;
      see factory method {@linkcode module:BNF~Grammar#nt grammar.nt()}.
      @param {string} name - non-terminal's name.
      @param {number} index - non-terminal's index in `.nts`.
  */
  constructor (name, index) {
    super(name);
    this.#index = index;
  }

  /** Displays index or ord and name and contents of all sets.
      @returns {string}
  */
  dump () {
    const result = [
      ('  ' + (this.ord ? this.ord : this.index)).substr(-3) + ': ' + this.toString()
    ];

    if (this.empty) result.push('empty: true');

    for (let set in { first:0, follow:0 }) {
      const r = Object.values(this[set]).map(t => t.toString()).join(' ');
      if (r.length) result.push(set + ': ' + r);
    }

    return result.join('\n\t');
  }
}

/** Represents a BNF rule, i.e., an ordered pair.
    @property {module:BNF~NT} nt - rule's non-terminal (left-hand side).
    @property {Array<module:Base~Symbol>} symbols - rule's right-hand side.
    @property {number} index - rule's index in {@linkcode module:BNF~Grammar grammar.rules}.
    @property {boolean} empty - computed from `.symbols`.
    @property {boolean} reached - true if this can be reached from rule zero.
    @property {boolean} finite - true if all non-terminals in the
      right-hand side have {@link module:BNF~NT}`.finite` set.
    @property {Object.<number, module:BNF~T>} first - terminals at front,
      maps ord to {@link module:BNF~T}.
    @property {boolean} reduced - true if this rule has been reduced.
    @property {?Object} prec - precedence.
    @property {string} prec.assoc - associativity, `'%left'`, `'%right'` or `'%nonassoc'`
      if any.
    @property {number} prec.level - precedence level, from 0.
    @property {module:BNF~T} prec.t - terminal providing the precedence.
*/
class Rule {
  #nt;
  get nt () { return this.#nt; }

  #symbols;
  get symbols () { return this.#symbols; }

  #index;
  get index () { return this.#index; }

  get empty () { return !this.symbols.length; }

  #reached = false;
  get reached () { return this.#reached; }
  set reached (_) { this.#reached = true; } // cannot unset it

  #finite = false;
  get finite () { return this.#finite; }
  set finite (_) { this.#finite = true; } // cannot unset it

  #first = {};
  get first () { return this.#first; }

  #reduced = false;
  get reduced () { return this.#reduced; }
  set reduced (_) { this.#reduced = true; } // cannot unset it ??

  #prec;
  get prec () { return this.#prec; }

  /** Creates a BNF rule;
      see {@linkcode module:BNF~Grammar#rule rule()} factory method.
      @param {module:BNF~NT} nt - left-hand side, non-terminal.
      @param {module:Base~Symbol[]} symbols right-hand side.
      @param {number} index - rule's index in {@link module:BNF~Grammar}`.rules`.
      @param {?Object} [prec] - precedence, if any.
  */
  constructor (nt, symbols, index, prec) {
    this.#nt = nt;
    this.#symbols = symbols;
    this.#index = index;
    this.#prec = prec;
  }

  /** Displays a rule in BNF notation.
      @param {number} [mark] - precedes a symbol on the right-hand side if it is in range.
      @returns {string}
  */
  toString (mark) {
    let result = this.nt + ': ' +
      this.symbols.map((symbol, n) => (n == mark ? '● ' : '') + symbol).join(' ');

    if (this.symbols.length == mark) result += (this.symbols.length ? ' ●' : '●');

    if (this.prec) result += ' %prec ' + this.prec.t;

    return result + ';';
  }

  /** Displays index, rule, `empty`, and content of `first`.
      @returns {string}
  */
  dump () {
    const result = [
      (this.index >= 0 ? ('  ' + this.index).substr(-3) + ': ' : '') + this.toString()
    ];

    if (this.empty) result.push('empty: true');

    const r = Object.values(this.first).map(t => t.toString()).join(' ');
    if (r.length) result.push('first: ' + r);

    return result.join('\n\t');
  }
}

/** Represents a message of the parser automaton.
    @property {string} verb - one of `'accept'`, `'error'`, `'goto'`, `'reduce'`, or `'shift'`.
    @property {module:Base~Symbol} symbol - symbol on which to message.
    @property {Number|module:BNF~Rule} info - additional information, if any.
*/
class Message {
  #verb;
  get verb () { return this.#verb; }

  #symbol;
  get symbol () { return this.#symbol; }

  #info;
  get info () { return this.#info; }
  set info (info) { this.#info = info; }

  /** Creates a new message;
      see factory methods {@linkcode module:BNF~Grammar#accept grammar.accept()},
        {@linkcode module:BNF~Grammar#reduce grammar.reduce()},
        {@linkcode module:BNF~Grammar#shift_or_goto grammar.shift_or_goto()},
        and {@linkcode module:BNF~Parser#observe parser.observe()}.
      @param {string} verb - one of `'accept'`, `'error'`, `'goto'`, `'reduce'`, or `'shift'`.
      @param {module:BNF~T|module:BNF~NT} symbol - symbol on which to send message.
      @param {Number|module:BNF~Rule} info - additional information, if any.
  */
  constructor (verb, symbol, info) {
    this.#verb = verb;
    this.#symbol = symbol;
    this.#info = info;
  }

  /** Displays symbol, message, and additional information if any.
      @returns {string}
  */
  toString () {
    let result = (this.symbol + '             ').substr(0, 13) + this.verb;
    switch (this.verb) {
      case 'goto':
      case 'shift':  result += ' ' + this.info; break;
      case 'reduce': result += ' (' + this.info + ')'; break;
    }
    return result;
  };
}

/** Represents a mark in a rule.
    @property {function()} assert - bound to {@linkcode module:BNF~Grammar#assert grammar.assert()}.
    @property {function()} mark - bound to {@linkcode module:BNF~Grammar#mark grammar.mark()}.
    @property {module:BNF~Rule} rule - rule to mark.
    @property {number} position - position in rule, before a symbol or after all.
    @property {boolean} complete - true if position is after all symbols.
*/
class Mark {
  #assert;
  get assert () { return this.#assert; }

  #mark;
  get mark () { return this.#mark; }

  #rule;
  get rule () { return this.#rule; }

  #position;
  get position () { return this.#position; }

  #complete;
  get complete () { return this.#complete; }

  /** Creates a new mark for a rule; 
      see factory method {@linkcode module:BNF~Grammar#mark grammar.mark()}.
      @param {module:BNF~Grammar} grammar - supplies factory method.
      @param {module:BNF~Rule} rule - rule to mark.
      @param {number} position - position in rule, before a symbol or after all.
  */
  constructor (grammar, rule, position) {
    // "inherit" assert() and mark()
    this.#assert = grammar.constructor.prototype.assert.bind(grammar);
    this.#mark = grammar.constructor.prototype.mark.bind(grammar);

    this.#rule = rule;
    this.#position = position;
    this.#complete = position == this.rule.symbols.length;
  }

  /** Displays the marked rule.
      @returns {string}
  */
  toString () { return this.rule.toString(this.position); }

  /** Compares two marks.
      @param {module:BNF~Mark} c to compare to `this`.
      @returns true if same rule and same position.
  */
  equals (c) {
    this.assert(c instanceof Mark, 'equals():', c, 'not a marked rule');
    return this.rule === c.rule && this.position == c.position;
  }

  /** Advances the mark.
      @returns {module:BNF~Mark} a new configuration with the mark moved right,
        i.e., `position` increased by 1.
  */
  advance () { return this.mark(this.rule, this.position + 1); }
}

/** Represents a state of the automaton.
    @property {module:BNF~Grammar} grammar - owner of this state.
    @property {module:BNF~Mark[]} marks - core and closure defining this state.
    @property {number} core - number of marked rules in the core.
    @property {Object.<number, module:BNF~Message>} messages - maps possible next symbols to messages.
    @property {string[]} errors - errors detected in this state, if any.
*/
class State {
  #grammar;
  get grammar () { return this.#grammar; }

  #marks;
  get marks () { return this.#marks; }

  #core;
  get core () { return this.#core; }

  #messages;
  get messages () { return this.#messages; }

  #errors = [];
  get errors () { return this.#errors; }

  /** Creates a new state of the automaton;
      see factory method {@linkcode module:BNF~Grammar#state grammar.state()}.
      @param {module:BNF~Grammar} grammar - owner of this state.
      @param {module:BNF~Mark[]} marks - core and closure defining this state.
      @param {number} core - number of marked rules in the core.
      @param {Object.<number, module:BNF~Message>} messages - maps possible next symbols to `null`.
  */
  constructor (grammar, marks, core, messages) {
    this.#grammar = grammar;
    this.#marks = marks;
    this.#core = core;
    this.#messages = messages;
  }

  /** Displays core configurations and messages.
      @returns {string}
  */
  toString () { return this.dump(true); }

  /** Displays all marked rules and messages.
      @param {boolean} core if true, only displays core configurations.
      @returns {string}
  */
  dump (core) {
    return '  ' +
      (core ? this.marks.slice(0, this.core) : this.marks).
        map(mark => mark.toString()).
        concat('', ... Object.values(this.messages).
          map(a => (a ? a.toString() : 'null'))).join('\n  ') +
      (this.errors.length ? '\n' + this.errors.join('\n') : '');
  }

  /** Compares a core of marked rules to this state's core.
      @param {module:BNF~Mark[]} core - to compare to `this`.
      @returns true if this state has the same core (in any order).
  */
  equals (core) {
    this.grammar.assert(core instanceof Array && core.every(mark => mark instanceof Mark),
      'equals():', core, 'not a list of marked rules');
      
    // same core sizes?
    return this.core == core.length &&
      // same elements?
      this.marks.slice(0, this.core).every(a => core.some(b => a.equals(b)));
  }

  /** Populates the `.messages` table. Fills in `reduce` for
      complete rules, `shift` for terminals, `accept`
      for the end of input terminal, and `goto` for non-terminals.
      @param {number} stateNumber - this state's number for error messages.
  */
  advance (stateNumber) {
    this.grammar.assert(typeof stateNumber == 'number' && this.grammar.states[stateNumber] === this,
      'advance():', stateNumber, 'invalid state number');
      
    // following construction, messages maps every literal/token/non-terminal
    // which can follow this state to null.

    const error = (... s) =>
      (this.errors.push(s.join(' ')), this.grammar.message('state', stateNumber + ':', ... s));

    // create reduce messages for complete rules
    this.marks.forEach(mark => {
      if (mark.complete) {
        const rule = mark.rule;          // rule we are in

        // for each terminal which can follow the rule in the grammar
        for (let t in rule.nt.follow) {  // ordinal number
          const f = rule.nt.follow[t];   // terminal which can follow

          if (!(t in this.messages)) {   // can it follow in this state?
            // if t is not in messages it cannot follow this state -> reduce
            rule.reduced = true;
            this.messages[t] = this.grammar.reduce(f, rule);

          } else if (this.messages[t] == null) {
            // if (t, null) is in messages, depending on precedences we might have a s/r conflict
            if (rule.prec && f.prec.assoc) {   // rule and terminal have defined precedence

              if (rule.prec.level > f.prec.level) {  // rule's precedence is higher -> reduce
                rule.reduced = true;
                this.messages[t] = this.grammar.reduce(f, rule);

              } else if (rule.prec.level < f.prec.level) {
                                                     // rule's precedence is lower -> shift (below)
              } else                                 // equal precedence
                switch (rule.prec.assoc) {
                case '%left':                         // left-associative -> reduce
                  rule.reduced = true;
                  this.messages[t] = this.grammar.reduce(f, rule);

                case '%right':                        // right-associative -> shift (below)
                  break;

                case '%nonassoc':                     // non-associative -> error action
                  rule.reduced = true;               // avoid message
                  delete this.messages[t];           // i.e. f as input would be an error
                }

            } else {                                 // no precedence available
              ++ this.grammar.sr;
              error('shift/reduce conflict between',
                f.toString(), 'and rule', '(' + rule + ')');
            }                                        // resolved as a shift (below)

          } else {
            // t is in messages and messages[t] is already set as a reduce
            const r2 = this.messages[t].info;          // the conflict
            ++ this.grammar.rr;
            error('for', f.toString(), 'reduce/reduce conflict between',
              '(' + rule + ')', 'and', '(' + r2 + ')');
            // resolve for rule which is first in the grammar
            if (rule.index < r2.index) this.messages[t].info = rule;
          } // done with this t
        } // done with every t which can follow
      } // done with every complete mark
    }, this);

    // create accept/shift messages for each next symbol which has none
    for (let a in this.messages) {
      if (this.messages[a] == null) {
        if (a == this.grammar.lit().ord) {
          // special case: $eof
          this.messages[a] = this.grammar.accept();
          this.grammar.rules[0].reduced = true;

        } else {
          // create next core by advancing marker over one symbol
          const next = [ ];
          let symbol = null;
          this.marks.forEach(mark => {
            // find a as next symbol in all marks
            if (!mark.complete && a == mark.rule.symbols[mark.position].ord) {
              // remember symbol and push mark after symbol
              symbol = mark.rule.symbols[mark.position];
              next.push(mark.advance());
            }
          }, this);

          // add new state with next as core, if any
          // shift/goto existent or new state
          if (!this.grammar.states.some((state, s) => state.equals(next) ?
               (this.messages[a] = this.grammar.shift_or_goto(symbol, s), true) : false
               , this)) {
            this.messages[a] = this.grammar.shift_or_goto(symbol, this.grammar.states.length);
            this.grammar.states.push(this.grammar.state(next));
          }
        }
      } // done with all symbols w/out a message
    } // done with all symbols
  }
}

/**
 * Represents a context-free grammar to create SLR(1) parsers.
 * Contains factory methods to create objects to represent the grammar as a tree
 * and to represent the parsers' state table.
 * <p>A `Grammar` object can be asked to generate
 * {@link module:Base~Factory#scanner scanners} and [parsers](#parser)
 * to process input sentences conforming to the grammar.
 * If a parser is called with suitable {@link module:Base~Action actions}
 * it can transform input.
 * @property {?module:EBNF~Grammar} ebnf - set only if created from EBNF Grammar.
 * @property {Array<module:BNF~Rule>} rules - list of grammar rules, can be pushed.
 * @property {Array<module:BNF~State>} states - list of possible states for parser.
 * @property {number} sr - number of shift/reduce conflicts.
 * @property {number} rr - number of reduce/reduce conflicts.
 * 
 * @extends module:Base~Factory
 * @property {Object.<string, Object>} config - maps names to configurable values.
 * @property {function(string[])} config.log - function to print strings, by default `console.log`.
 * @property {RegExp} config.lits - restricts literal representation, by default single-quoted;
 *   must be anchored.
 * @property {RegExp} config.tokens - restricts token names, by default alphanumeric;
 *   must be anchored.
 * @property {RegExp} config.nts - restricts non-terminal names, by default alphanumeric;
 *   must be anchored.
 * @property {string} config.uniq - prefix for unique non-terminal names, by default `$-`.
 * 
 * @property {boolean} [config.error] - if true, insert `$error` when translating `some`.
 * @property {boolean} [config.lookahead] - if true, trace lookahead when parsing.
 * @property {RegEx} [config.trace] - if set, observe with
 *   {@linkcode module:BNF~Parser#trace grammar.trace( , config.trace)};
 *   only affects {@linkcode module:BNF~Grammar#parser grammar.parser()}.
 * @property {boolean} [config.build] - if set, build with
 *   {@linkcode module:BNF~Parser#build grammar.build()};
 *   only affects {@linkcode module:BNF~Grammar#parser grammar.parser()}.
 * 
 * @property {Array<module:Base~Lit>} lits - list of unique literals, can be pushed.
 * @property {Object.<string, module:Base~Lit>} litsByName - maps `'x'` to unique literal.
 * @property {Array<module:Base~Token>} tokens - list of unique tokens, can be pushed.
 * @property {Object.<string, module:Base~Token>} tokensByName - maps name to unique token.
 * @property {Array<module:Base~Precedence>} levels - list of precedence levels, can be pushed.
 * @property {Array<module:Base~NT>} nts - list of unique non-terminals, can be pushed.
 * @property {Object.<string, module:Base~NT>} ntsByName - maps name to unique non-terminal.
 * @property {number} errors - incremented by {@linkcode module:Base~Factory#error error()} method.    
 * 
 * @example <caption> LL(1) recursive descent parsing </caption>
 * const e = new EBNF.Grammar(' ... grammar ... ')
 * e.parser(/ ... skip .../)(' ... input ... ')
 * e.parser(/ ... skip .../)(' ... input ... ', { ... actions ... })
 * @example <caption> equivalent SLR(1) stack-based parsing </caption>
 * const b = BNF.Grammar.fromEBNF(e)
 * b.parser(/ ... skip .../)(' ... input ... ')
 * b.parser(/ ... skip .../)(' ... input ... ', { ... actions ... })
 * @example <caption> details </caption>
 * const b = BNF.Grammar.fromEBNF(e)
 * const s = b.scanner(/ ... skip ... /)
 * new BNF.Parser(b).parse(s.scan(' ... input ... ').concat(null), b.build())
 * new BNF.Parser(b).parse(s.scan(' ... input ... ').concat(null), b.build({ ... actions ... }))
 */
class Grammar extends Base.Factory {
  #ebnf = null;
  get ebnf () { return this.#ebnf; }
  set ebnf (value) { this.#ebnf = value; }

  #rules = [];
  get rules () { return this.#rules; }

  #states = [];
  get states () { return this.#states; }

  #sr = 0;
  get sr () { return this.#sr; }
  set sr (value) { this.#sr = value; }

  #rr = 0;
  get rr () { return this.#rr; }
  set rr (value) { this.#rr = value; }

  /** Creates a grammar representation.
      Creates the `$accept` non-terminal, `$eof` *end of input* literal, and `$error` token,
      and reserves rule zero: `$accept:` *start* `$eof;`.
      Defines tokens, if any.
      @param {?string} [grammar] - the grammar to represent,
        using the {@link module:BNF~Grammar.bnf BNF grammar}
        and {@link module:BNF~Grammar.terminals BNF token and literal notation}.
        This can be omitted to construct the rules directly using the factory methods.
      @param {?Object.<string, RegExp>} [tokens] - maps token names, if any,
        in the new grammar to their patterns
        which must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, and should use `(:? )` rather than `( )` for grouping.
        `tokens` can map the empty string to a skip pattern
        which will be used to interpret the grammar string.
      @param {Object.<string, Object>} [config] - overwrites configurable values' defaults;
        loaded first but can only be the third parameter.
      @throws {Error} an error for bad token definitions or syntax errors in the grammar.
  */
  constructor (grammar = '', tokens = {}, config = {}) {
    super();

    // create rule zero and the singletons.
    this.rule(this.nt());     // reserve $accept and rule zero
    this.lit().used = true;   // reserve $eof (used in rule zero)
    this.token();             // reserve $error

    // load configuration, if any
    if (typeof config == 'object' && config !== null)
      Object.assign(this.config, config);

    // compile grammar into this?
    if (typeof grammar == 'string') {
      // skip pattern
      let skip = /\s+/;
      
      // load tokens, [''] is skip 
      if (typeof tokens == 'object' && tokens !== null) {     
        if ('' in tokens) {
          skip = (tokens['']);
          delete tokens[''];
        }
        Object.entries(tokens).forEach(kv => this.token(kv[0], kv[1]), this);
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

  /** Completes the grammar representation and reports if there are errors;
      call exactly once.
      Creates rule zero: `$accept:` *start* `$eof;`.
      Sets ordinal number for literals, then tokens, then non-terminals.
      Checks that all rules are reached and all non-terminals can reduce to a terminal.
      Computes first and follow sets.
      Creates state table.
      Checks that all rules can be reduced.
      @param {module:BNF~NT} start - the *start* non-terminal.
  */
  check (start) {
    this.assert(!this.rules[0].symbols.length, 'check():', this, 'can only check a grammar once');
    this.assert(start instanceof NT, 'check():', start, 'start must be a non-terminal');
    
    // create rule zero
    this.rules[0].symbols.push(start, this.lit());

    // set ord, create first for literals
    this.lits.forEach((lit, n) => lit.first[lit.ord = n] = lit);

    // set ord after literals, create first for tokens
    this.tokens.forEach((token, n) => token.first[token.ord = n + this.lits.length] = token, this);

    // set ord after literals and tokens
    this.nts.forEach((nt, n) => nt.ord = n + this.tokens.length + this.lits.length, this);

    // check that all non-terminals are defined
    this.nts.forEach(nt => !nt.rules.length && this.error(nt.name, 'is undefined'), this);

    // set and check recursively that all non-terminals can be reached from rule 0
    const setReached = rule =>
      rule.reached || (
        rule.reached = rule.nt.reached = true,
        rule.symbols.forEach(nt => nt instanceof NT && nt.rules.forEach(setReached)));
    setReached(this.rules[0]);

    this.nts.forEach(
      nt => nt.reached || this.error(nt.name, 'cannot be reached from rule zero'), this);

    // check that all non-terminals have a finite expansion
    let changed;
    do {
      changed = false;                                                // until no more changes
      this.rules.forEach(rule => {                                    // check rule
        if (!rule.nt.finite &&                                        // undecided?
            rule.symbols.some(sym => sym instanceof Base.T || sym.finite)) // has T or finite NT
          changed = rule.finite = rule.nt.finite = true;              // changed: finite!
      });
    } while (changed);

    this.nts.forEach(nt => nt.finite || this.error(nt.name, 'is not finite'), this);

    // add elements in bs to as, return true if change
    const merge = (as, bs) => Object.entries(bs).reduce(
      (result, kv) => kv[0] in as ? result : (as[kv[0]] = kv[1], true), false);

    // compute first for non-terminals and rules
    do {
      changed = false;  // until no more changes
      // for each rule with non-empty rhs
      this.rules.forEach((rule, r) => {
        if (rule.symbols.length) {
          // for each symbol in rhs, as long as they accept empty
          if (rule.symbols.every(sym => {
                // add symbol's first to rule's first
                if (merge(rule.first, sym.first)) changed = true;
                // continue only if nt accepts empty
                return sym instanceof NT ? sym.empty : false;
              }))
            // if all accept empty, so does rule
            if (!rule.empty) changed = rule.empty = true;
          // add rule's first to nt's first, ditto empty
          if (merge(rule.nt.first, rule.first)) changed = true;
          if (!rule.nt.empty && rule.empty) changed = rule.nt.empty = true;
        }
      });
    } while (changed);

    // compute follow for non-terminals
    do {
      changed = false;  // until no more changes
      // for each non-empty rule
      this.rules.forEach(rule => rule.symbols.length &&
        // over rhs in reverse order
        rule.symbols.reduceRight((follow, last) => {
            if (last instanceof NT) {
              if (merge(last.follow, follow)) changed = true;
              if (last.empty) // if empty, pass follow further forward
                return Object.assign({}, last.first, follow);
            }
            // otherwise, pass first forward
            return last.first;
          }, rule.nt.follow));
    } while (changed);

    // create state[0]: mark rule 0 in position 0
    this.states.push(this.state([this.mark(this.rules[0], 0)]));

    // tell each state to advance; this creates new states which are also advanced
    for (let s = 0; s < this.states.length; ++ s)
      this.states[s].advance(s);

    // check that all rules can be reduced
    this.rules.forEach((rule, r) => rule.reduced ||
      this.error('rule', r, '(' + rule + ')', 'is never reduced'), this);

    if (this.errors) this.message('errors: ' + this.errors);
    if (this.sr)     this.message('shift/reduce conflicts: ' + this.sr);
    if (this.rr)     this.message('reduce/reduce conflicts: ' + this.rr);
  }

  /** Factory method to create a unique literal symbol, maintains `.lits` and `.litsByName`
      @param {string} [literal] - literal's representation conforming to `.config.lits`.
        If omitted represents the `$eof` literal terminal.
      @param {boolean} [used] - if `true` mark literal as used.
      @returns {module:BNF~Lit} a unique literal.
  */
  lit (literal = '', used) {
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
        If omitted represents the `$error` token with an empty `RegExp`. 
      @param {RegExp} [pat] - pattern to match values representing the token in input;
        used only when the token is created,
        must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, should use `(:? )` rather than `( )` for grouping.
      @param {boolean} [used] - if `true` mark token as used.
      @returns {module:BNF~Token} a unique token.
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
  }

  /** Factory method to create a unique non-terminal symbol, maintains `.nts` and `.ntsByName`.
    @param {string} [name] - non-terminal's name conforming to `config.nts`; error if a token.
      If omitted represents the `$accept` non-terminal,
      if not a string creates a unique name (intended for EBNF translation).
    @returns {module:BNF~NT} a unique non-terminal.
  */
  nt (name = '') {
    // unique name?
    if (typeof name != 'string') name = this.config.uniq + this.nts.length;

    // return existing non-terminal?
    let nt = this.ntsByName[name];
    if (! nt) {
      // don't allow token
      if (name != '' && name in this.tokensByName) 
        this.error(name, 'is already defined as a token');
      // create new non-terminal
      nt = new NT(name, this.nts.length);  
      this.add(nt);
    }
    return nt;
  }
  
  /** Factory method to create a rule representation for BNF.
      Maintains rule's non-terminal's `.rules` and `this.rules`.
      Maintains rule's non-terminal's `.empty`.
      Precedence levels have to be defined prior to using this method.
      @param {module:BNF~NT} nt - left-hand side, non-terminal.
      @param {module:Base~Symbol[]} [symbols] - right-hand side, list of symbols.
      @param {?module:Base~T} [terminal] - can define rule's precedence,
        by default the precedence of the rightmost terminal, if any.
      @returns {module:BNF~Rule} a new rule representation.
  */
  rule (nt, symbols = [], terminal = null) {
    this.assert(nt instanceof NT, 'rule():', nt, 'not a non-terminal');
    this.assert(symbols instanceof Array &&
      symbols.every(s => s instanceof Lit || s instanceof Token || s instanceof NT),
      'rule():', symbols, 'not an array of terminals and non-terminals');
    
    if (terminal === null) // implicit precedence from last terminal with precedence if any
      symbols.forEach(s => { if (!(s instanceof NT) && s.prec.assoc) terminal = s; });
    
    else { // explicit precedence
      this.assert(terminal instanceof Base.T, 'rule():', terminal, 'not a terminal');
      if (!terminal.prec.assoc) {
        this.error(terminal + ' has undefined precedence');
        terminal = null;
      }
    }

    // create new rule
    const rule = new Rule(nt, symbols, this.rules.length,
      terminal === null ? null : Object.assign({}, { t: terminal }, terminal.prec));

    // check for empty unless rule zero
    if (this.rules.length && !symbols.length) nt.empty = true;

    // add new rule to rule's nt's rules and this.rules
    rule.nt.rules.push(rule);
    this.rules.push(rule);
    return rule;
  }

  /** Factory method to create the `accept` message for `$eof`.
      @returns {module:BNF~Message} an object representing the message.
  */
  accept () {
    return new Message('accept', this.lit(), '');
  }

  /** Factory method to create a `reduce` message.
      @param {module:Base~T} t - terminal on which to send message.
      @param {module:BNF~Rule} rule - rule to reduce.
      @returns {module:BNF~Message} an object representing the message.
  */
  reduce (t, rule) {
    this.assert(t instanceof Base.T, 'reduce():', t, 'not a terminal symbol');
    this.assert(rule instanceof Rule, 'reduce():', rule, 'not a Rule');
    
    return new Message('reduce', t, rule);
  }

  /** Factory method to create a `shift` or `goto` message.
      @param {module:Base~Symbol} symbol - symbol on which to send message.
      @param {number} state - state to shift to.
      @returns {module:BNF~Message} an object representing the message.
  */
  shift_or_goto (symbol, state) {
    this.assert(symbol instanceof Base.Symbol, 'shift_or_goto():', symbol, 'not a symbol');
    this.assert(typeof state == 'number' && state >= 0 && state <= this.states.length,
      'shift_or_goto():', state, 'invalid state');
    
    return new Message(symbol instanceof Base.T ? 'shift' : 'goto', symbol, state);
  }

  /** Factory method to represent a mark in a rule.
      @param {module:BNF~Rule} rule - rule to mark.
      @param {number} position - position in rule, before a symbol or after all.
      @returns {module:BNF~Mark} an object representing the marked rule.
  */
  mark (rule, position) {
    this.assert(rule instanceof Rule, 'mark():', rule, 'not a Rule');
    this.assert(typeof position == 'number' && position >= 0 && position <= rule.symbols.length,
      'mark():', position, 'invalid position');

    return new Mark(this, rule, position);
  }

  /** Factory method to represent a state of the parser automaton.
      The state is created from the core marks; rules in the closure are added.
      @param {module:BNF~Mark[]} core - list of marks in the core, closure is added.
      @returns {module:BNF~State} an object representing the state.
  */
  state (core) {
    this.assert(core instanceof Array && core.every(mark => mark instanceof Mark),
      'state():', core, 'not an array of marked rules');
      
    const coreLength = core.length;  // for efficient state comparison
    const messages = {};  // initialized to map all possible next symbols to null

    // compute closure: loop over core and added marks
    for (let c = 0; c < core.length; ++ c)
      // for each incomplete mark
      if (!core[c].complete) {
        // next symbol in a mark
        const s = core[c].rule.symbols[core[c].position];
        if (s instanceof NT && !(s.ord in messages))
          // add all rules for a new non-terminal, marked at 0
          s.rules.forEach(rule => core.push(this.mark(rule, 0)), this);
        // map this next terminal or non-terminal to null
        messages[s.ord] = null;
      }
    return new State(this, core, coreLength, messages);
  }

  /** Factory method to create a parser to recognize and process input.
      @param {RegEx} [skip] - a pattern to define ignorable character sequences,
        by default white space,
        must not accept empty input, must not use flags, must not be anchored,
        should use `(:? )`rather than `( )` for grouping.
      @returns {module:BNF~Parser} the parser.
  */
  parser (skip = new RegExp('\\s+')) {   // /\s+/ crashes jsdoc
    this.assert(skip instanceof RegExp, 'parser():', skip, 'not a regular expression');    
    return new Parser(this, skip);
  }

  /** Displays description of grammar and number of errors if any.
      @param {boolean} [states] - if true, also displays state table.
      @returns {string}
  */
  toString (states) {
    const result = [];
    if (this.ebnf) result.push('EBNF:', '', this.ebnf.toString(), '', 'BNF:', '');

    if (this.levels.length)
      result.push(... this.levels.map(level => '    ' + level.toString()), '');

    if (this.rules.length)
      result.push(... this.rules.map((rule, n) => ('  ' + n).substr(-3) + ' ' + rule.toString()), '');

    result.push('literals: ' + this.lits.filter(lit => lit.used).join(', '));
    result.push('tokens: ' + this.tokens.filter(token => token.used).
      map(token => token + ' ' + token.pat).join(', '));
    result.push('non-terminals: ' + this.nts.join(', '));

    if (states && this.states.length) result.push('',
      this.states.map((state, n) => 'state ' + n + '\n' + state.toString()).join('\n\n'));

    if (this.errors + this.sr + this.rr) result.push('');
    if (this.errors) result.push('errors: ' + this.errors);
    if (this.sr)     result.push('shift/reduce conflicts: ' + this.sr);
    if (this.rr)     result.push('reduce/reduce conflicts: ' + this.rr);

    return result.join('\n');
  }

  /** Displays grammar, terminals, and non-terminals with name and contents of all sets.
      Displays number of errors if any.
      @param {?Object} a - with one argument (kludge!) acts as a static method and displays the argument
      converting nested arrays to a string –
      useful because `console.debug` only reaches 3 levels.
      @param {boolean} states - if true also displays states.
      @returns {string}
  */
  dump (a, states) {
    // kludge part
    if (arguments.length == 1) return super.dump(a);
    
    const result = [];
    if (this.ebnf) result.push('EBNF:', '', this.ebnf.toString(), '', 'BNF:', '');

    if (this.levels.length)
      result.push(... this.levels.map(level => '    ' + level.toString()), '');

    if (this.rules.length)
      result.push(... this.rules.map((rule, n) => rule.dump()), '');

    result.push('literals: ' + this.lits.join(', '));
    result.push('tokens: ' + this.tokens.map(token => token + ' ' + token.pat).join(', '));
    result.push('non-terminals:', ... this.nts.map(nt => nt.dump()));

    if (states && this.states.length) result.push('',
      this.states.map((state, n) => 'state ' + n + '\n' + state.dump()).join('\n\n'));

    if (this.errors + this.sr + this.rr) result.push('');
    if (this.errors) result.push('errors: ' + this.errors);
    if (this.sr)     result.push('shift/reduce conflicts: ' + this.sr);
    if (this.rr)     result.push('reduce/reduce conflicts: ' + this.rr);

    return result.join('\n');
  }
}

/** Wraps a method {@linkcode module:BNF~Parser#parse parser.parse()}
    which recognizes input and calls on an observer, if any.
    Unlike {@linkcode module:BNF~Grammar#parser grammar.parser().parse()},
    here input can be presented in pieces, i.e., the method throws `true`
    if it should be called with more input.

    @property {?module:Base~Scanner} scanner - tokenizes input.
    @property {boolean} parsing - true while recognition is in progress.
    @property {boolean} building - true if recognition calls {@linkcode module:BNF~Parser#build build()}.
    @property {Array.<number>} stack - stack of state numbers.
    @property {module:BNF~State} state - current state.
    @property {Array.<object>} values - parallels state stack, nested lists or action results.
    @property {?(function|Array.<module:Base~Tuple>|boolean)} input - provides input as tuples.
      `null`, an empty array, or a `null` array element act as `$eof`.
      `false` is set to request more input.
    @property {?module:Base~Tuple} current - current input tuple, if any.
    @property {Array.<module:Base~Tuple>} tuples - available tuples.
    @property {number} index - index of next tuple.

    @extends module:Base~Parser
    @property {module:BNF~Grammar} grammar - represents the grammar and states, counts errors;
      concurrent recognition will trash error counting.
    @property {?Object} actions - maps rule names to action methods during recognition.
*/
class Parser extends Base.Parser {
  #scanner;
  get scanner () { return this.#scanner; }

  #parsing = false;
  get parsing () { return this.#parsing; }

  #building;
  get building () { return this.#building; }

  #stack;
  get stack () { return this.#stack; }

  #state;
  get state () { return this.grammar.states[this.stack.at(-1)]; }

  #values;
  get values () { return this.#values; }

  #input;
  get input () { return this.#input; }

  #current = null;
  get current () { return this.#current; }

  #tuples = [];
  get tuples () { return this.#tuples; }

  #index = 0;
  get index () { return this.#index; }

  /** Creates a parser;
      see {@linkcode module:BNF~Grammar#parser parser()} factory method.
      @param {module:BNF~Grammar} grammar - represents grammar and states.
      @param {RegExp} [skip] - a pattern to define ignorable character sequences,
        by default white space,
        must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, should use `(:? )`rather than `( )` for grouping.
  */
  constructor (grammar, skip) {
    super(grammar);
    this.#scanner = grammar.scanner(skip);
  }
  
  /** Parses (some more) input. `actions` can only be supplied with the first input;
      however, the function is serially reusable.
      Resets and reports `.errors` for the grammar.
      @param {?(string|Array.<module:Base~Tuple>|function)} input - a string is scanned into tuples
        with `null` appended as end of input; can be a function which returns an array of tuples.
        `null`, an empty array, or a `null` array element act like a tuple containing `$eof`.
      @param {Function|Object} [actions] - a function is assumed to be a class
        and a singleton is created with `this` as constructor argument.
        The object maps rule names to action methods.
      @param {Object} arg - used as further constructor arguments.
      @returns {Object} result from observer, if any; ends one recognition.
      @throws {boolean|Error|string} `true` for more input,
        `Error` or error message otherwise — terminates one recognition.
  */
  parse (input, actions, ...arg) {
    this.grammar.assert(input === null || typeof input == 'string' || typeof input == 'function' ||
      (input instanceof Array && input.every(elt => elt === null || elt instanceof Base.Tuple)),
      'parse():', input, 'is not a string, a Tuple array, a function, or null');

    // initialize?
    if (this.parsing)
      this.grammar.assert(arguments.length == 1, 'parse(): cannot accept actions while parsing');
    else {
      // to start parsing, create stack in state 0
      this.#parsing = true;
      this.#stack = [ 0 ];

      // reset error count
      this.grammar.errors = 0;

      // set up actions, if any
      this.grammar.assert(!actions || actions instanceof Object || actions instanceof Function,
        'parse():', actions, 'actions has no methods');
      super.parse(actions, ...arg);

      // set up list building
      this.#building = this.grammar.config.build ||    // configured to build lists
        this.grammar.ebnf ||                          // fromEBNF grammar implicitly builds
        this.actions;                                 // actions require lists

      // create a value stack only for building
      if (this.building)
        this.#values = [ [ ] ]
      else
        delete this.values;

      // headline trace if any
      if (this.grammar.config.trace)
        this.grammar.message('STATE TUPLE           MESSAGE                                          RETURNS');
    }

    // initialize for next()
    this.#input = typeof input == 'string' ? this.scanner.scan(input).concat(null) : input;
    this.#current = null;
    this.#tuples = [];
    this.#index = 0;

    // call/cc: throw [ result ] to return result from the parser
    try {
      while (true) {
        this.current || this.next();
        if (this.current.t && this.current.t.ord in this.state.messages) {
          // expected input
          if (this.process(this.current))
            this.next();  // consumed
        } else
          // illegal character or unexpected input
          this.recover();
      }
    } catch (outcome) {
      this.grammar.assert(outcome === true ||
        (outcome instanceof Array && outcome.length == 1) ||
        typeof outcome == 'string' || outcome instanceof Error,
          'parse():', outcome, 'is not true, [ return-value ], Error, or error message');

      if (outcome !== true) {
        this.#parsing = false;
        if (this.grammar.errors)                           // from actions, maybe
          this.grammar.message('parse():', this.grammar.errors, this.grammar.errors > 1 ? 'errors' : 'error');
      }
      if (outcome instanceof Array) return outcome[0];
      if (outcome instanceof Error) console.trace(outcome.message);
      throw outcome;
    }
  }

  /** Part of {@linkcode module:BNF~Parser#parse parse()}.
      Sets `.current` to a new tuple, but not past `$eof`.
      @private
      @throws `true` to ask for more input.
  */
  next () {
    this.grammar.assert(this.tuples instanceof Array &&
      this.tuples.every(t => t === null || t instanceof Base.Tuple),
      'next():', this.tuples, 'not an array of Tuple');

    if (this.index >= this.tuples.length) {         // no tuples left
      if (typeof this.input == 'function')          // call for input
        this.#tuples = this.input();
      else if (this.input === false)                // throw true for more input
        throw true;
      else                                          // consume input
        (this.#tuples = this.input, this.#input = false);

      this.grammar.assert(this.tuples === null || (this.tuples instanceof Array &&
        this.tuples.every(t => t === null || t instanceof Base.Tuple)),
        'next():', this.tuples, 'not null or an array of Tuple');

      if (!this.tuples || this.tuples.length == 0)  // none? arrange for end of input tuple
        this.#tuples = [ null ];
      this.#index = 0;
    }

    // use 'index' tuple
    if ((this.#current = this.tuples[this.index]) == null) // null? set end of input tuple
      this.#current = this.tuples[this.index] = this.grammar.tuple(0, this.grammar.lit());

    // advance index (to later tokenize more) but don't run past end of input tuple
    if (this.current.t !== this.grammar.lit()) ++ this.#index;

    if (this.grammar.config.lookahead) this.grammar.message(this.current.toString());
  }

  /** Part of {@linkcode module:BNF~Parser#parse parse()}.
      processes an expected input: sends message to {@linkcode module:BNF~Parser#observe observe()}
      and handles the state stack and the result, if any.
      @private
      @param {module:Base~Tuple} tuple - to be processed.
      @returns {boolean} `true` if tuple is consumed (shift), `false` if not (reduce).
      @throws {string|Object[]} fatal error message or `[ result ]` if `accept` message.
  */
  process (tuple) {
    this.grammar.assert(tuple instanceof Base.Tuple, 'process():', tuple, 'not a Tuple');

    // get message and inform observer
    const verb = this.state.messages[tuple.t.ord].verb,
      info = this.state.messages[tuple.t.ord].info,
      result = this.observe(tuple, verb, info);

    // process
    switch (verb) {
    default:                                        // should not happen
      throw 'fatal error: process(): ' + verb + ' not accept, shift, or reduce';

    case 'accept':
      throw [ result ];                             // parse ends with success

    case 'shift':
      this.grammar.assert(typeof info == 'number' && info >= 0 && info < this.grammar.states.length,
        'process():', info, 'not a state number for shift');

      this.stack.push(info);                        // shift to new state
      return true;                                  // tuple consumed

    case 'reduce':                                  // reduce a rule
      this.grammar.assert(info instanceof Rule, 'process():', info, 'not a Rule for reduce');

      // pop the stack by the length of the rule, uncover state
      this.stack.length -= info.symbols.length;

      // there has to be a goto for the non-terminal
      const g = this.state.messages[info.nt.ord];

      this.grammar.assert(g instanceof Message && g.verb == 'goto',
        'process():', g.verb, 'reduce expects goto');
      this.grammar.assert(typeof g.info == 'number' && g.info >= 0 && g.info < this.grammar.states.length,
        'process():', g.info, 'not a state number for goto');

      this.observe(tuple, g.verb, g.info);       // observe the goto
      this.stack.push(g.info);                      // goto to new state
      return false;                                 // tuple still available
    }
  }

  /** Recognition observer, part of {@linkcode module:BNF~Parser#parse parse()}.
      Calls {@linkcode module:BNF~Parser#build build()} to create a result, if any;
      calls {@linkcode module:BNF~Parser#trace trace()} if configured;
      reports `info` from an `error` message, if any,
      @private
      @param {module:Base~Tuple} tuple - current input.
      @param {string} verb - of message.
      @param {module:BNF~Rule|number|string} info - of message.
      @returns {Object} the result.
  */
  observe (tuple, verb, info) {
    this.grammar.assert(tuple instanceof Base.Tuple, 'observe():', tuple, 'not a Tuple');
    this.grammar.assert(/^(accept|shift|reduce|goto|error)$/.test(verb),
      'observe():', verb, 'not accept, shift, reduce, or error');

    const result = this.building ? this.build(tuple, verb, info) : null;
    if (this.grammar.config.trace instanceof RegExp && this.grammar.config.trace.test(verb))
      this.trace(tuple, verb, info, result);
    if (verb == 'error' && info && info.length)
      this.error(info);
    return result;
  }

  /** Formats and displays trace, part of {@linkcode module:BNF~Parser#parse parse()}.
      @private
      @param {module:Base~Tuple} tuple - current input.
      @param {string} verb - of message.
      @param {module:BNF~Rule|number|string} info - of message.
      @param {Object} the result.
  */
  trace (tuple, verb, info, result) {
    const w = ('  '+ this.stack.at(-1))         .substr(-3);
    const t = (tuple + '               ')       .substr(0, 15);
    const v = (verb + '      ')                 .substr(0, 6);
    const i = (verb == 'error' ? (info === null ? 'null' : '-message- ')
      : info + ' ').padEnd(39)                  .substr(0, 39);
    const r = this.grammar.dump(result)         .substr(0, 39);
    this.grammar.message(w + '  ' + t + '  '+ v + '  ' + i + '  '+ r);
    //                   3    2    15    2    6    2    39    2    39  -> 110 max
  }

  /** List builder, part of {@linkcode module:BNF~Parser#parse parse()}.
      Manages the value stack to collect nested lists of all terminal values and applies
      {@link module:Base~Action action methods} matching rule names which can
      restructure the list of values collected for a rule.
      <p>If the grammar is created from an {@link module:EBNF~Grammar EBNF grammar}
      the generated rules `$-#: $-# other;`
      and `$-#: ;` have implicit actions to support transparency for actions.
      <p>An action should throw an `Error` to abort recognition
      or a string to report an error and return `null` as result.

| verb | effect |
| ------- | ------ |
| `'shift'` | pushes the tuple's terminal's value onto the value stack; returns `null`. |
| `'reduce'` | pops one value per symbol, presents the list to an {@link module:Base~Action action function} if any; returns the list or the result. |
| `'goto'` | the result of the preceding `'reduce'` is on top of the value stack; returns `null`. |
| `'accept'` | returns the top-level value. |
| `'error'` | if there is no `info` pops one value and returns ` null`. |

      @private
      @param {module:Base~Tuple} tuple - current input.
      @param {string} verb - `'shift'`, `'reduce'`, `'goto'`, `'accept'`, or `'error'`.
      @param {module:BNF~Rule|module:Base~T|number|string} info - a reference to the relevant rule,
        terminal, or state number, or an error message.
      @returns {object} anything on success.
      @throws {Error} with an error message to abort recognition.
  */
  build (tuple, verb, info) {
    switch (verb) {
    case 'shift':
      this.values.push(tuple.value);
      return null;

    case 'reduce':
      const len = info.symbols.length;
      let result = this.values.splice(- len, len); // can be []

      if (this.grammar.ebnf && info.nt.name.startsWith(this.grammar.config.uniq)) {
        if (len == 2 && info.symbols[0] === info.nt)
          result.splice(0, 1, ...result[0]);
        else if (!len)
          result = null;
      } else
        try {
          result = this.act(info.nt.name, result); // apply action, if any
        } catch (e) {
          if (e instanceof Error) { console.trace(e); throw e; }
          this.error(e);
          result = null;
        }
      
      // perform upcoming 'goto' message
      this.values.push(result);
      return result;

    case 'goto':
      return null;

    case 'accept':
      return this.values.pop();

    case 'error':
      if (!info) this.values.pop();
      return null;
    }
  }

  /** Part of {@linkcode module:BNF~Parser#parse parse()}. Attempts error recovery
      within the current input sequence. Sends one 'error' with an error message,
      works on input and stack until a `shift` `$error` and `shift` `current` are done.
      Sends 'error' with null message every time the stack is popped.
      Returns when `current` was consumed to resume normal processing.
      @private
      @throws `true` to ask for more input, i.e., abandons recovery.
      @throws `[ result ]` for `$accept`.
      @throws `'irrecoverable error'` if the stack is empty.
  */
  recover () {
    const error = this.grammar.token(), eof = this.grammar.lit();

    // produce error message listing expected symbols in state table
    // and run the message past the observer
    this.observe(this.current, 'error',
      `${this.current} is not allowed\nexpecting:` +
      Object.entries(this.state.messages).reduce((s, kv) => s +=
        kv[1].symbol instanceof Base.T && kv[1].symbol !== error ?
          ' ' + kv[1].symbol : '', ''));

    // drop any illegal character sent by the scanner
    while (!this.current.t)
      this.next(); // next tuple, throws true for more input
    // now at tuple with $eof or actual input

    console.assert(this.current instanceof Base.Tuple && this.current.t instanceof Base.T,
      'recover expects Tuple');

    pop: while (this.stack.length > 0) {
      if (!(error.ord in this.state.messages)) { // $error unexpected
        this.observe(this.current, 'error', null); // pop value stack
        this.stack.pop();                          // pop state stack
        continue;
      }                                       // else $error expected
      if (this.process(this.grammar.tuple(this.current.lineno, error)))
        while (true)        // did shift $error, now search for input
          if (this.current.t?.ord in this.state.messages) {
            if (this.process(this.current)) {    // did shift current
              this.#current = null;                        // consume
              return;                  // recovery should be complete
            }           // else did reduce+goto before current, retry
          } else if (this.current.t === eof) {        // end of input
            this.grammar.message('terminating at ' + this.current);
            break pop;                              // cannot recover
          } else {                // current is not expected: discard
            this.grammar.message('discarding ' + this.current);
            this.next();
          }
      //   else did reduce before $error, process $error again or pop
    }
    throw 'irrecoverable error';
  }

  /** Displays the current state stack and value stack, if any.
      @returns {string}
  */
  toString () {
    return this.stack ?
      'stack (length ' + this.stack.length +'):\n' +
        this.stack.map((state, n) =>
          ('  ' + (state + '    ').substr(0, 4) + (this.building ? this.grammar.dump(this.values[n]) : '')
          ).substr(0, 79), this).join('\n') :
      'no stack available';
  }

  /** Displays a message; lets grammar count it as an error.
      @param {object[]} s - message, to be displayed; prefixed by `.current` and joined by blanks.
      @return {string} the message.
  */
  error (... s) {
    return this.grammar.error(this.index >= 0 ? 'at' + ' ' + 
      (this.current ? this.current.toString() : 'end of input') + ':' : '', ... s);
  }
}

/** 
 * Grammar describing the BNF notation accepted by {@linkcode module:BNF~Grammar new Grammar()}:
 * <p> A *grammar* consists of an optional sequence of *precedence levels*
 *   followed by one or more rules.
 * <p> Each *precedence level* consists of  an associativity followed by one or more literals
 *   or token names and terminated with a semicolon. Precedence levels are increasing.
 * <p> Each *rule* consists of a non-terminal name on the left-hand side,
 *   a colon, a *symbol sequence* on the right-hand side, and a semicolon.
 *   Rules with the same names are alternatives.
 * <p> A *symbol sequence* contains zero or more items, such as a non-terminal name,
 *   a self-defining {@link module:BNF~Grammar.terminals literal}, or
 *   the name of a {@link module:BNF~Grammar.terminals token}.
 * @example <caption> BNF grammars' grammar </caption>
 * grammar:        precedences rules;
 * precedences:    ;
 * precedences:    precedences '%left' terminals ';';
 * precedences:    precedences '%right' terminals ';';
 * precedences:    precedences '%nonassoc' terminals ';';
 * terminals:      terminal;
 * terminals:      terminals terminal;
 * terminal:       lit;
 * terminal:       name;
 * rules:          rule;
 * rules:          rules rule;
 * rule:           Name ':' symbols ';';
 * rule:           Name ':' symbols '%prec' terminal ';';
 * symbols:        ;
 * symbols:        symbols name;
 * symbols:        symbols lit;
 * name:           Name;
 * lit:            Lit;
 * @constant {string}
 */
Grammar.bnf = [
  "grammar:        precedences rules;",
  "precedences:    ;",
  "precedences:    precedences '%left' terminals ';';",
  "precedences:    precedences '%right' terminals ';';",
  "precedences:    precedences '%nonassoc' terminals ';';",
  "terminals:      terminal;",
  "terminals:      terminals terminal;",
  "terminal:       lit;",
  "terminal:       name;",
  "rules:          rule;",
  "rules:          rules rule;",
  "rule:           Name ':' symbols ';';",
  "rule:           Name ':' symbols '%prec' terminal ';';",
  "symbols:        ;",
  "symbols:        symbols name;",
  "symbols:        symbols lit;",
  "name:           Name;",
  "lit:            Lit;"
].join('\n');

/** 
 * Token definitions for `Lit` and `Name`
 * in {@linkcode module:BNF~Grammar#bnf Grammar#bnf}.
 * <p> *Literals* represent themselves and are single-quoted strings
 * using `\` only to escape single quotes and `\` itself.
 * <p> A *Name* either represents a non-terminal or a *token*.
 * <p> *Tokens* represent sets of inputs, such as names or numbers,
 * and are alphanumeric names which must start with a letter
 * and may include underscores.
 * <p>`$error` is a special token to control error recovery.
 * @example <caption> BNF grammars' tokens </caption>
 * {
 *   Lit:   /'(?:[^'\\]|\\['\\])+'/,
 *   Name:  /[A-Za-z][A-Za-z0-9_]*|\$error/
 * }
 * @see {@linkcode module:BNF~Parser#recover recover()}
 * @see {@linkcode module:BNF~Grammar.grammar Grammar.grammar}
 * @constant {Object<string,RegExp>}
 */
Grammar.terminals = {
  Lit:   /'(?:[^'\\]|\\['\\])+'/,
  Name:  /[A-Za-z][A-Za-z0-9_]*|\$error/
};

/** 
 * The BNF grammars' grammar; created when the module is loaded
 * and used internally in {@linkcode module:BNF~Grammar new Grammar()}.
 * @see {@linkcode module:BNF~Actions Actions}
 * @constant {module:BNF~Grammar}
 * @private
 */
Grammar.grammar = new Grammar(Grammar.terminals); {
  // grammar: precedences rules;
  Grammar.grammar.rule(Grammar.grammar.nt('grammar'), [
    Grammar.grammar.nt('precedences'),
    Grammar.grammar.nt('rules')
  ]);

  // precedences: ;
  Grammar.grammar.rule(Grammar.grammar.nt('precedences'), [
  ]);

  // precedences: precedences '%left' terminals ';';
  Grammar.grammar.rule(Grammar.grammar.nt('precedences'), [
    Grammar.grammar.nt('precedences'),
    Grammar.grammar.lit("'%left'"),
    Grammar.grammar.nt('terminals'),
    Grammar.grammar.lit("';'")
  ]);

  // precedences: precedences '%right' terminals ';';
  Grammar.grammar.rule(Grammar.grammar.nt('precedences'), [
    Grammar.grammar.nt('precedences'),
    Grammar.grammar.lit("'%right'"),
    Grammar.grammar.nt('terminals'),
    Grammar.grammar.lit("';'")
  ]);

  // precedences: precedences '%nonassoc' terminals ';';
  Grammar.grammar.rule(Grammar.grammar.nt('precedences'), [
    Grammar.grammar.nt('precedences'),
    Grammar.grammar.lit("'%nonassoc'"),
    Grammar.grammar.nt('terminals'),
    Grammar.grammar.lit("';'")
  ]);

  // terminals: terminal;
  Grammar.grammar.rule(Grammar.grammar.nt('terminals'), [
    Grammar.grammar.nt('terminal')
  ]);

  // terminals: terminals terminal;
  Grammar.grammar.rule(Grammar.grammar.nt('terminals'), [
    Grammar.grammar.nt('terminals'),
    Grammar.grammar.nt('terminal')
  ]);

  // terminal: lit;
  Grammar.grammar.rule(Grammar.grammar.nt('terminal'), [
    Grammar.grammar.nt('lit')
  ]);

  // terminal: name;
  Grammar.grammar.rule(Grammar.grammar.nt('terminal'), [
    Grammar.grammar.nt('name')
  ]);

  // rules: rule;
  Grammar.grammar.rule(Grammar.grammar.nt('rules'), [
    Grammar.grammar.nt('rule')
  ]);

  // rules: rules rule;
  Grammar.grammar.rule(Grammar.grammar.nt('rules'), [
    Grammar.grammar.nt('rules'),
    Grammar.grammar.nt('rule')
  ]);

  // rule: Name ':' symbols ';';
  Grammar.grammar.rule(Grammar.grammar.nt('rule'), [
    Grammar.grammar.token('Name'),
    Grammar.grammar.lit("':'"),
    Grammar.grammar.nt('symbols'),
    Grammar.grammar.lit("';'")
  ]);

  // rule: Name ':' symbols '%prec' terminal ';';
  Grammar.grammar.rule(Grammar.grammar.nt('rule'), [
    Grammar.grammar.token('Name'),
    Grammar.grammar.lit("':'"),
    Grammar.grammar.nt('symbols'),
    Grammar.grammar.lit("'%prec'"),
    Grammar.grammar.nt('terminal'),
    Grammar.grammar.lit("';'")
  ]);

  // symbols: ;
  Grammar.grammar.rule(Grammar.grammar.nt('symbols'), [
  ]);

  // symbols: symbols name;
  Grammar.grammar.rule(Grammar.grammar.nt('symbols'), [
    Grammar.grammar.nt('symbols'),
    Grammar.grammar.nt('name')
  ]);

  // symbols: symbols lit;
  Grammar.grammar.rule(Grammar.grammar.nt('symbols'), [
    Grammar.grammar.nt('symbols'),
    Grammar.grammar.nt('lit')
  ]);

  // name: Name;
  Grammar.grammar.rule(Grammar.grammar.nt('name'), [
    Grammar.grammar.token('Name')
  ]);

  // lit: Lit;
  Grammar.grammar.rule(Grammar.grammar.nt('lit'), [
    Grammar.grammar.token('Lit')
  ]);

  // all but $error are used
  Grammar.grammar.lits.forEach(lit => lit.used = true);
  Grammar.grammar.tokens.forEach(token => { if (token.name.length) token.used = true; });

  Grammar.grammar.check(Grammar.grammar.nt('grammar'));
}

/**
 * Factory method to represent an {@link module:EBNF~Grammar EBNF grammar}
 * as a {@link module:BNF~Grammar BNF grammar} and check it.
 * @param {module:EBNF~Grammar} ebnf - grammar to represent.
 * @param {Object.<string, Object>} config - overwrites configurable values' defaults.
 * @returns the {@link module:BNF~Grammar BNF grammar}, ready for parsing.
 * @throws `'unexpected term in EBNF sequence'` *node*
 * @example <caption> Translating <code>[ s | t | ... ]</code> </caption>
 * $-#:  ;
 * $-#: s;
 * $-#: t;
 * ...
 * @example <caption> Translating <code>{ s | t | ... }</code> </caption>
 * $-##: $-#;
 * $-##: $-## $-#;
 * $-##: $error;
 * $-##: $-## $error;
 * $-#: s;
 * $-#: t;
 * ...
 * @constant {function(String,Object)}
 */
Grammar.fromEBNF = (ebnf, config) => {
  const g = new Grammar(null, null, config);
  g.ebnf = ebnf;

  // [ s | t | ... ] -> $-#: | s | t | ... ;
  const opt = opt => {
    const nt = g.nt({}); // unique
    // $-#: ;
    g.rule(nt);
    // $-#: alt; ...
    opt.seqs.forEach(s => g.rule(nt, seq(s)), g);
    return nt;
  };

  // { s | t | ... } -> $-#: s | t | ...;
  //                    $-##: $-# | $-## $-# | $error | $-## $error;
  const some = some => {
    const nt = g.nt({}), nt1 = g.nt({}); // unique
    // $-#: alt; ...
    some.seqs.forEach(s => g.rule(nt1, seq(s)), g);
    // $-##: $-#;
    g.rule(nt, [ nt1 ]);
    // $-##: $-## $-#;
    g.rule(nt, [ nt, nt1 ]);
    if (g.config.error) {
      const e = g.token();
      // $-##: $error;
      g.rule(nt, [ e ]);
      // $-##: $-## $error;
      g.rule(nt, [ nt, e ]);
    }
    return nt;
  };

  // a b ... -> [ a, b, ... ]
  const seq = (seq) => seq.nodes.reduce((list, node) => {
    switch (node.constructor.name) {
    case 'Lit':   list.push(g.lit(node.name));              return list;
    case 'Token': list.push(g.token(node.name, node.pat));  return list;
    case 'NT':    list.push(g.nt(node.name));               return list;
    case 'Opt':   list.push(opt(node));                     return list;
    case 'Some':  list.push(some(node));                    return list;
    }
    throw Error('unexpected term in EBNF sequence ' + node.toString());
  }, []);

  // (re)create (used) literals
  ebnf.lits.filter(l => l.used).forEach(l => g.lit(l.name, true));

  // (re)create (used) tokens
  ebnf.tokens.filter(t => t.used).forEach(t => g.token(t.name, t.pat, true));

    // (re)create precedences if any
  ebnf.levels.forEach(level =>
    g.precedence(level.assoc,
      level.terminals.map(t => {
        const l = g.litsByName[t.name]; if (l) return l;
        return g.tokensByName[t.name];
      })
    )
  );

  // create start non-terminal
  const start = g.nt(ebnf.rules[0].nt.name);

  // create non-terminals and rules
  ebnf.rules.forEach(rule => {
    // record non-terminal
    const nt = g.nt(rule.nt.name);

    // create rules
    rule.seqs.forEach(s => {
      if (s.terminal) {
        let prec = g.litsByName[s.terminal.name];
        if (! prec) prec = g.tokensByName[s.terminal.name];
        g.rule(nt, seq(s), prec);
      } else
        g.rule(nt, seq(s));
    });
  });

  // wrap up
  g.check(start);
  return g;
};

/** The BNF grammar parser's actions,
    used internally in {@linkcode module:BNF~Grammar new Grammar()}.
    The methods intentionally defeat the argument count checks.
    @property {module:BNF~Grammar} g - the grammar to add precedences and rules to.
    @private
*/
class Actions {
  #g;
  get g () { return this.#g; }

  /** Creates the singleton with the {@link module:Base~Action action methods}.
      @param {module:BNF~Grammar} g - to hold the rule representations.
  */  
  constructor (g) { this.#g = g; }

  /** `grammar: precedences rules;`
      @returns {module:BNF~Grammar} g - represents and checks the grammar.
  */
  grammar (p, r) { this.g.check(this.g.rules[1].nt); return this.g; }

  /** `precedences: ;`  
      `precedences: precedences '%left' terminals ';';`  
      `precedences: precedences '%right' terminals ';';`  
      `precedences: precedences '%nonassoc' terminals ';';`
  */
  precedences (... arg) {
    return ((p, assoc, terminals) => {
      if (assoc) this.g.precedence(assoc, terminals);
    })(... arg);
  }

  /** `terminals: terminal;`  
      `terminals: terminals terminal;`
      @returns {module:BNF~Lit|module:BNF~Token} represents a list of terminals.
  */
  terminals (... t) {
    if (t.length == 1) return [ t[0] ]; 
    t[0].push(t[1]);
    return t[0];
  }

  /** `terminal: lit;`  
      `terminal: name;`
      @returns {module:BNF~Lit|module:BNF~Token} represents a terminal.
  */
  terminal (item) {
    if (!(item instanceof NT)) return item;
    this.g.error(item.name + ': precedence requires a terminal');
    return null;
  }

  /** `rule: Name ':' symbols ';';`  
      `rule: Name ':' symbols '%prec' terminal ';';`
      @returns {module:BNF~Rule} represents a rule.
  */
  rule (... arg) {
    return ((name, _, symbols, p, terminal) =>
      this.g.rule(this.g.nt(name), symbols, terminal)
    )(... arg);
  }

  /** `symbols: ;`  
      `symbols: symbols name;`  
      `symbols: symbols lit;`
      @returns {module:Base~Symbol[]} represents a list of symbols.
  */
  symbols (... symbols) {
    if (!symbols.length) return [ ];
    symbols[0].push(symbols[1]);
    return symbols[0];
  }

  /** `name: Name;` 
      @returns {module:BNF~Token|module:BNF~NT} represents a used token or a non-terminal.
  */
  name (name) {
    if (name == '$error') return this.g.token('', new RegExp(), true);
    if (name in this.g.tokensByName) return this.g.token(name, undefined, true);
    return this.g.nt(name);
  }

  /** `lit: Lit;`
      @returns {module:BNF~Lit} represents a used literal.
  */
  lit (literal) { return this.g.lit(literal, true); }
}

export {
  Lit,
  Token,
  NT,
  Rule,
  Message,
  Mark,
  State,
  Grammar,
  Parser,
  Actions
};
