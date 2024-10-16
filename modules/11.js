/** This module contains classes and
  * [mix-ins](https://justinfagnani.com/2015/12/21/real-mixins-with-javascript-classes/)
  * to compile various stages of a little language
  * using builder actions to represent programs as trees
  * and visitors to interpret, check types, and compile.
  * The details are discussed in [chapter 11]{@tutorial 11-trees} and [appendix D]{@tutorial d-kit}.
  *
  * A tree consists of *nodes* represented as nested `Array` objects,
  * each consisting of a string *tag* selecting a method of a *visitor*,
  * followed by zero or more nodes or other argument values.
  * `visit` cannot be a tag.
  *
  * A tree node can have `.lineno` and `.type` properties referring to the
  * source line number and the type (`bool`, `number`, or `string`) delivered
  * by the node. {@linkcode module:Eleven~Visit#_dump visitor._dump(node)} displays
  * the properties if they exist.
  *
  * The module assumes that there are `globalThis` definitions
  * of `puts()` for output and `prompt()` for num which are available to `eval()`.
  *
  * @module Eleven
  * @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
  * @version 2024-08-04
*/

import * as EBNF from './ebnf.js';
import * as BNF from './bnf.js';
import * as Six from './06.js';

// --- 11/01

/** Base class for tree building. Private method names start with an underscore.
    @class
    @property {module:Base~Parser} parser - access to source position.
*/
class Build {
  /** Sets the property */
  constructor (parser) { this.parser = parser; }

  /** Tags node with source position as `.lineno` if available. */
  _lineno (node) {
    if (this.parser.current && this.parser.current.lineno)
      node.lineno = this.parser.current.lineno;
    return node;
  }
}

/** Class actions to represent an arithmetic expression as a tree using recursive descent.
    @mixin
    @see [example 6/07](../?eg=06/07)
*/
const Build_RD = superclass => class extends superclass {
  /** `list: sum [{ ',' sum }];` returns `[ 'list' sum ... ]`
      @memberof module:Eleven~Build_RD
      @instance */
  list (sum, many) {
    return [ 'list', sum ].concat(many ? many[0].map(alt => alt[1]) : []);
  }

  /** `sum: product [{ add | subtract }];` returns tree
      @memberof module:Eleven~Build_RD
      @instance */
  sum (product, many) { return (many ? many[0] : []).
    reduce((sum, alt) => (alt[0][1] = sum, alt[0]), product);
  }

  /** `add: '+' product;` returns `[ 'add' null product ]`
      @memberof module:Eleven~Build_RD
      @instance */
  add (x, right) { return [ 'add', null, right ]; }

  /** `subtract: '-' product;` returns `[ 'subtract' null product ]`
      @memberof module:Eleven~Build_RD
      @instance */
  subtract (x, right) { return [ 'subtract', null, right ]; }

  /** `product: signed [{ multiply | divide }];` returns tree
      @memberof module:Eleven~Build_RD
      @instance */
  product (signed, many) { return (many ? many[0] : []).
    reduce((product, alt) => (alt[0][1] = product, alt[0]), signed);
  }

  /** `multiply: '*' signed;` returns `[ 'multiply' null signed ]`
      @memberof module:Eleven~Build_RD
      @instance */
  multiply (x, right) { return [ 'multiply', null, right ]; }

  /** `divide: '/' signed;` returns `[ 'divide' null signed ]`
      @memberof module:Eleven~Build_RD
      @instance */
  divide (x, right) { return [ 'divide', null, right ]; }

  /** `signed: [ '-' ] term;` returns `term` or `[ 'minus' term ]`
      @memberof module:Eleven~Build_RD
      @instance */
  signed (minus, term) { return minus ? [ 'minus', term ] : term; }

  /** `term: number | name | '(' sum ')';` returns tree
      @memberof module:Eleven~Build_RD
      @instance */
  term (...val) { return val.length == 1 ? val[0] : val[1] }

  /** `number: Number;` returns `[ 'number' number ]`
      @memberof module:Eleven~Build_RD
      @instance */
  number (number) { return [ 'number', parseInt(number, 10) ]; }
};

// --- 11/02

/** Class actions to represent an arithmetic expression as a tree using a precedence table.
    @mixin
*/
const Build_Number = superclass => class extends superclass {
  /** `expr: add | ... | '(' expr ')' | number;` returns tree
      @memberof module:Eleven~Build_Number
      @instance */
  expr (...values) { return values.length > 1 ? values[1] : values[0]; }

  /** `add: expr '+' expr;` returns `[ 'add' a b ]`
      @memberof module:Eleven~Build_Number
      @instance */
  add (a, x, b) { return this._lineno([ 'add', a, b ]); }

  /** `subtract: expr '-' expr;` returns `[ 'subtract' a b ]`
      @memberof module:Eleven~Build_Number
      @instance */
  subtract (a, x, b) { return this._lineno([ 'subtract', a, b ]); }

  /** `multiply: expr '*' expr;` returns `[ 'multiply' a b ]`
      @memberof module:Eleven~Build_Number
      @instance */
  multiply (a, x, b) { return this._lineno([ 'multiply', a, b ]); }

  /** `divide: expr '/' expr;` returns `[ 'divide' a b ]`
      @memberof module:Eleven~Build_Number
      @instance */
  divide (a, x, b) { return this._lineno([ 'divide', a, b ]); }

  /** `power: expr '**' expr;` returns `[ 'power' a b ]`
      @memberof module:Eleven~Build_Number
      @instance */
  power (a, x, b) { return this._lineno([ 'power', a, b ]); }

  /** `minus: '-' expr;` returns `[ 'minus' b ]`
      @memberof module:Eleven~Build_Number
      @instance */
  minus (x, b) { return this._lineno([ 'minus', b ]); }

  /** `number: Number;` returns `[ 'number' number ]`
      @memberof module:Eleven~Build_Number
      @instance */
  number (number) { return this._lineno([ 'number', parseInt(number, 10) ]); }
};

// --- 11/03

/** Base class with methods to validate and visit a tree.
    Private method names start with an underscore.
    @class
    @property {RegExp} trace - selects matching tags to trace visits.
    @property {number} errors - count of calls to `_error()`.
*/
class Visit {
  trace = false;      // RegExp selects tags to display
  errors = 0;         // counts calls to _error()

  /** Displays and counts an error message. */
  _error (lno, ... s) {
    if (typeof lno == 'number' && lno > 0) lno = `line ${lno}:`;
    else lno = s.splice(0, 1)[0];
    puts(`error ${++ this.errors}: ${lno}`, ... s);
  }

  /** Recursively checks tree tags, throws an error if there is a problem.
      @param {Array} node - to validate. */
  _tree (node) {                  // recursively validates a tree
    if (!(node instanceof Array)) return;
    if (!node.length) throw 'empty node';
    if (typeof node[0] != 'string') throw 'node tag is not a string';
    if (!node[0].length) throw 'empty node tag';
    if (node[0] == 'visit') throw "'visit' cannot be a tag";
    if (typeof this.constructor.prototype[node[0]] != 'function')
      throw node[0] + ': unknown node tag';
    node.slice(1).forEach(node => this._tree(node));
  }

  /** Creates a deep display of a node.
      @param {Array} node - to recursively traverse.
      @param {number} [shallow] - limits depth if non-negative, by default unlimited. */
  _dump (node, shallow = -1) {    // recursively dumps a tree
    if (!(node instanceof Array))
      switch (typeof node) {
      case 'boolean':
      case 'number': return node;
      case 'string': return "'" + node.replace(/(['\\\n])/g, "\\$1") + "'";
      default:       return typeof node;
      }

    let result = '[ ' + (!shallow ? this._dump(node[0]) :
      node.map(item => this._dump(item, shallow - 1)).join(' ')) + ' ]';
    if ('lineno' in node) result += '.' + node.lineno;
    if ('type' in node) result += ':' + node.type;
    return result;
  }

  /** Visits a (valid!) tree node, returns either `node` itself or the result of calling tag as method for an array.
      @param {Array} node - to visit, using the tag as a method name and the node as argument.
      @param {RegExp} [trace] - sets `.trace` if specified. */
  visit (node, trace) {
    if (trace instanceof RegExp) this.trace = trace;
    // not a list: return it
    if (!(node instanceof Array)) return node;
    // visit
    let result;
    const show = this.trace instanceof RegExp &&
      this.trace.test(node[0]) ? this._dump(node, 0) : false;
    try {
      return result = this.constructor.prototype[node[0]].call(this, node);
    } finally {
      if (show) puts(show, 'returns', this._dump(result, 1));
    }
  }
}

/** Methods to evaluate arithmetic expressions.
    All of these expect `Number` values and return a `Number` result.
    @mixin
*/
const Eval_Number = superclass => class extends superclass {
  /** `[ 'add' a b ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  add (node) { return this.visit(node[1]) + this.visit(node[2]); }

  /** `[ 'subtract' a b ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  subtract (node) { return this.visit(node[1]) - this.visit(node[2]); }

  /** `[ 'multiply' a b ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  multiply (node) { return this.visit(node[1]) * this.visit(node[2]); }

  /** `[ 'divide' a b ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  divide (node) { return this.visit(node[1]) / this.visit(node[2]); }

  /** `[ 'power' a b ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  power (node) { return this.visit(node[1]) ** this.visit(node[2]); }

  /** `[ 'minus' a ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  minus (node) { return - this.visit(node[1]); }

  /** `[ 'number' a ]`; returns `Number`
      @memberof module:Eleven~Eval_Number
      @instance */
  number (node) { return this.visit(node[1]); }
};

/** Class actions for top-level rules to display and visit a tree.
  * For the `main` rule:
  **  Add optional arguments with visitor classes.
  **  Add an optional `RegExp` argument to display the tree between visits and trace each visit.
  * @mixin
*/
const Main = (superclass, ...args) => class extends superclass {
  /** Create and apply all but the last visitor, check the last.
      @return {Array} checked last visitor, last tree, trace if any.
      @throws {string} error message, e.g., error count or `_tree` issue.
      @memberof module:Eleven~Main
      @instance */
  _doVisits (tree, args) {
    let trace;                     // (first) trace pattern, if any
    const visitors = args.filter(arg => {        // remove patterns
        if (!(arg instanceof RegExp)) return true;
        if (!trace) trace = arg;
        return false;
      }),
      tail = visitors.splice(-1, 1);        // last visitor, others
    if (!tail.length) throw 'main: no visitors';
    let caller;          // each visitor is constructed with caller 
    [tree, caller] = visitors.reduce(([tree, caller], Visitor) => {
      const visitor = new Visitor (caller);  // create next visitor
      visitor._tree(tree);                         // validate tree
      tree = visitor.visit(tree, trace);                   // visit
      if (trace) { puts(visitor._dump(tree)); }    // trace, if any
      if (visitor.errors) throw `${visitor.errors} error(s)`;
      return [tree, visitor];            // done; next visit if any
    }, [tree, this]);                // first caller is the builder
    const lastVisitor = new tail[0](caller); // last visitor object
    lastVisitor._tree(tree);                       // validate tree
    return [ lastVisitor, tree, trace ];
  }

  /** `main: tree;` return the checked last visit as a function.
      @throws {string} error message, e.g., error count or `_tree` issue.
      @memberof module:Eleven~Main
      @instance */
  main (tree) {
    let [lastVisitor, lastTree, trace] = this._doVisits(tree, args);
    return () => lastVisitor.visit(lastTree, trace);
  }

  /** `dump: tree;` Display and return the tree.
      @memberof module:Eleven~Main
      @instance */
  dump (tree) {
    puts(new Visit()._dump(tree));
    return tree;
  }

  /** `run: funct;` Execute the function and return the result.
      @memberof module:Eleven~Main
      @instance */
  run (funct) { return funct(); }
};

// --- 11/04

/** Class actions to represent a list of statements as a tree.
    @mixin
*/
const Build_Stmts = superclass => class extends superclass {

  /** `stmts: stmt [{ ';' stmt }];` returns `stmt` or `[ 'stmts' stmt ... ]`
      @memberof module:Eleven~Build_Stmts
      @instance */
  stmts (stmt, many) { 
    return many == null ? stmt :
      this._lineno([ 'stmts', 
        ...many[0].reduce(
          (stmts, alt) => { stmts.push(alt[1]); return stmts; },
          [ stmt ])
      ]);
  }

  /** `stmt: print | ...;` returns tree
      @memberof module:Eleven~Build_Stmts
      @instance */
  stmt (stmt) { return stmt; }

  /** `print: 'print' expr [{ ',' expr }];` returns `[ 'print' expr ... ]`
      @memberof module:Eleven~Build_Stmts
      @instance */
  print (x, expr, many) {
    return this._lineno([ 'print', 
      ...(many ? many[0] : [ ]).reduce(
        (exprs, alt) => { exprs.push(alt[1]); return exprs; }, 
        [ expr ])
    ]);
  }

  /** `loop: 'while' expr 'do' stmts 'od';` returns `[ 'loop' expr stmts ]`
      @memberof module:Eleven~Build_Stmts
      @instance */
  loop (w, expr, d, stmts, o) { 
    return this._lineno([ 'loop', expr, stmts ]);
  }

  /** `select: 'if' expr 'then' stmts [ 'else' stmts ] 'fi';` returns `[ 'select' expr left right? ]`
      @memberof module:Eleven~Build_Stmts
      @instance */
  select (i, expr, t, left, opt, f) {
    const result = this._lineno([ 'select', expr, left ]);
    if (opt) result.push(opt[1]); return result;
  }
};

/** Class actions to represent names in a tree.
    @mixin
*/
const Build_Names = superclass => class extends superclass {
  /** `assign: Name '=' expr;` returns `[ 'assign' name expr ]`
      @memberof module:Eleven~Build_Names
      @instance */
  assign (name, x, expr) {
    return this._lineno([ 'assign', name, expr ]);
  }

  /** `name: Name;` returns `[ 'name' name ]`
      @memberof module:Eleven~Build_Names
      @instance */
  name (name) { return this._lineno([ 'name', name ]); }
};

/** Class actions to represent comparisons as trees.
    @mixin
*/
const Build_Cmps = superclass => class extends superclass {
  /** `eq: expr '=' expr;` returns `[ 'eq' a b ]`
      @memberof module:Eleven~Build_Cmps
      @instance */
  eq (a, x, b) { return this._lineno([ 'eq', a, b ]); }

  /** `ne: expr '<>' expr;` returns `[ 'ne' a b ]`
      @memberof module:Eleven~Build_Cmps
      @instance */
  ne (a, x, b) { return this._lineno([ 'ne', a, b ]); }

  /** `gt: expr '>' expr;` returns `[ 'gt' a b ]`
      @memberof module:Eleven~Build_Cmps
      @instance */
  gt (a, x, b) { return this._lineno([ 'gt', a, b ]); }

  /** `ge: expr '>=' expr;` returns `[ 'ge' a b ]`
      @memberof module:Eleven~Build_Cmps
      @instance */
  ge (a, x, b) { return this._lineno([ 'ge', a, b ]); }

  /** `lt: expr '<' expr;` returns `[ 'lt' a b ]`
      @memberof module:Eleven~Build_Cmps
      @instance */
  lt (a, x, b) { return this._lineno([ 'lt', a, b ]); }

  /** `le: expr '<=' expr;` returns `[ 'le' a b ]`
      @memberof module:Eleven~Build_Cmps
      @instance */
  le (a, x, b) { return this._lineno([ 'le', a, b ]); }
};

// --- 11/05

/** Methods to interpret comparisons.
    All of these expect `Number` values and return a `Boolean` result.
    @mixin
*/
const Eval_Cmps = superclass => class extends superclass {
  /** `[ 'eq' a b ]`; returns `Boolean`.
      @memberof module:Eleven~Eval_Cmps
      @instance */
  eq (node) { return this.visit(node[1]) == this.visit(node[2]); }

  /** `[ 'ne' a b ]`; returns `Boolean`.
      @memberof module:Eleven~Eval_Cmps
      @instance */
  ne (node) { return this.visit(node[1]) != this.visit(node[2]); }

  /** `[ 'gt' a b ]`; returns `Boolean`.
      @memberof module:Eleven~Eval_Cmps
      @instance */
  gt (node) { return this.visit(node[1]) >  this.visit(node[2]); }

  /** `[ 'ge' a b ]`; returns `Boolean`.
      @memberof module:Eleven~Eval_Cmps
      @instance */
  ge (node) { return this.visit(node[1]) >= this.visit(node[2]); }

  /** `[ 'lt' a b ]`; returns `Boolean`.
      @memberof module:Eleven~Eval_Cmps
      @instance */
  lt (node) { return this.visit(node[1]) <  this.visit(node[2]); }

  /** `[ 'le' a b ]`; returns `Boolean`.
      @memberof module:Eleven~Eval_Cmps
      @instance */
  le (node) { return this.visit(node[1]) <= this.visit(node[2]); }
};

/** Methods to interpret a list of statements.
    @mixin
*/
const Eval_Stmts = superclass => class extends superclass {

  /** `[ 'stmts' stmt ... ]`
      @memberof module:Eleven~Eval_Stmts
      @instance */
  stmts (node) { node.slice(1).forEach(stmt => this.visit(stmt)); }

  /** `[ 'print' value ... ]`
      @memberof module:Eleven~Eval_Stmts
      @instance */
  print (node) { puts(...node.slice(1).map(value => this.visit(value))); }

  /** `[ 'loop' cond stmt ]`
      @memberof module:Eleven~Eval_Stmts
      @instance */
  loop (node) { while (this.visit(node[1])) this.visit(node[2]); }

  /** `[ 'select' cond then else? ]`
      @memberof module:Eleven~Eval_Stmts
      @instance */
  select (node) {
    if (this.visit(node[1])) this.visit(node[2]);
    else if (node.length > 3) this.visit(node[3]);
  }
};

/** Mixin with a symbol table.
    Private method names start with an underscore.
    @property {Map} symbols - symbol table, maps names to descriptions;
      imported from previous visitor, if any.
    @mixin
*/
const Symbols = superclass => class extends superclass {
  /** Creates the `Map` for symbol descriptions or gets it from the previous processor.
      @name constructor
      @param {Object} prev - previous visitor or builder.
      @memberof module:Eleven~Symbols
      @instance */
  constructor (prev, ... more) {
    super(prev, ... more);
    this.symbols = prev?.symbols ?? new Map ();
  }
  
  /** Returns a name's description, if necessary creates it.
      @param {string} name - to allocate.
      @returns {ord:number} description which indicates creation order, starting at 1.
      @memberof module:Eleven~Symbols
      @instance */
  _alloc (name) {
    let symbol = this.symbols.get(name);         // check if exists
    if (!symbol)                             // create with ordinal
      this.symbols.set(name,
        symbol = { ord: this.symbols.size + 1 });
    return symbol;
  }
};

/** Method to interpret names, requires {@linkcode module:Eleven~Symbols Symbols}.
    @mixin
*/
const Eval_Names = superclass => class extends superclass {
  /** `[ 'name' name ]` returns the stored value.
      @memberof module:Eleven~Eval_Names
      @instance */
  name (node) {
    const symbol = this._alloc(node[1]);
    if (!('value' in symbol)) symbol.value = 0;
    return symbol.value;
  }

  /** `[ 'assign' name value ]`
      @memberof module:Eleven~Eval_Names
      @instance */
  assign (node) { this._alloc(node[1]).value = this.visit(node[2]); }
};

// --- 11/06

/** Class actions to represent Boolean expressions as trees.
    @mixin
*/
const Build_Bool = superclass => class extends superclass {
  /** `or: expr 'or' expr;` returns `[ 'or' a b ]`
      @memberof module:Eleven~Build_Bool
      @instance */
  or (a, x, b) { return this._lineno([ 'or', a, b ]); }

  /** `and: expr 'and' expr;` returns `[ 'and' a b ]`
      @memberof module:Eleven~Build_Bool
      @instance */
  and (a, x, b) { return this._lineno([ 'and', a, b ]); }

  /** `not: 'not' expr;` returns `[ 'not' b ]`
      @memberof module:Eleven~Build_Bool
      @instance */
  not (x, b) { return this._lineno([ 'not', b ]); }

  /** `bool: 'true' | 'false';` returns `[ 'bool' bool ]`
      @memberof module:Eleven~Build_Bool
      @instance */
  bool (bool) { return this._lineno([ 'bool', bool == 'true' ]); }
};

/** Class actions to represent string expressions as trees.
    @mixin
*/
const Build_String = superclass => class extends superclass {
  /** `input: 'input' [ String String ];` returns `[ 'input' unescaped-string unescaped-string ]`
      @memberof module:Eleven~Build_String
      @instance */
  input (i, opt) {
    return (opt ? opt : [ ]).
      reduce((r, s) =>
        (r.push(s.slice(1, -1).replace(/\\(.)/g, '$1')), r),
      [ 'input' ]);
  }

  /** `len: 'len' expr;` returns `[ 'len' b ]`
      @memberof module:Eleven~Build_String
      @instance */
  len (x, b) { return this._lineno([ 'len', b ]); }

  /** `string: String;` returns `[ 'string' unescaped-string ]`
      @memberof module:Eleven~Build_String
      @instance */
  string (string) {
    return this._lineno([ 'string',
      string.slice(1, -1).replace(/\\(.)/g, '$1') ]);
  }
};

/** Class action to represent type casts as trees.
    @mixin
*/
const Build_Cast = superclass => class extends superclass {
  /** `type: 'bool' | 'number' | 'string';` returns `type`
      @memberof module:Eleven~Build_Cast
      @instance */
  type (type) { return type; }

  /** `cast: '(' type ')' expr;` returns `[ 'cast' type b ]`
      @memberof module:Eleven~Build_Cast
      @instance */
  cast (l, type, r, b) { return this._lineno([ 'cast', type, b ]); }
};

/** Methods to interpret Boolean expressions.
    @mixin
*/
const Eval_Bool = superclass => class extends superclass {
  /** `[ 'or' a b ]` returns `Boolean`.
      @memberof module:Eleven~Eval_Bool
      @instance */
  or (node) {
    return node.slice(1).reduce((result, tree) => {
      if (result) return result;  // short-circuit
      result = this.visit(tree);
      if (typeof result != 'boolean')
        this._error(node.lineno, "'or' non-boolean");
      return result;
    }, false);
  }

  /** `[ 'and' a b ]` returns `Boolean`.
      @memberof module:Eleven~Eval_Bool
      @instance */
  and (node) {
    return node.slice(1).reduce((result, tree) => {
      if (!result) return result;  // short-circuit
      result = this.visit(tree);
      if (typeof result != 'boolean')
        this._error(node.lineno, "'and' non-boolean");
      return result;
    }, true);
  }

  /** `[ 'not' b ]` returns `Boolean`.
      @memberof module:Eleven~Eval_Bool
      @instance */
  not (node) {
    const result = this.visit(node[1]);
    if (typeof result != 'boolean')
      this._error(node.lineno, "'not' non-boolean");
    return !result;
  }

  /** `[ 'bool' value ]` returns `Boolean`.
      @memberof module:Eleven~Eval_Bool
      @instance */
  bool (node) {
    if (typeof node[1] != 'boolean')
      this._error(node.lineno, "'bool' non-boolean");
    return node[1];
  }
};

/** Methods to interpret string expressions.
    @mixin
*/
const Eval_String = superclass => class extends superclass {
  /** `[ 'concat' a b ]` returns `String`.
      @memberof module:Eleven~Eval_String
      @instance */
  concat (node) {
    const vals = node.slice(1).map(this.visit.bind(this));
    if (vals.some(val => typeof val != 'string'))
      this._error(node.lineno, "'concat' non-string");
    return vals[0] + vals[1];
  }

  /** `[ 'input' prompt? default? ]` returns `String`.
      @memberof module:Eleven~Eval_String
      @instance */
  input (node) {
    return prompt(node[1] ?? '', node[2] ?? '');
  }

  /** `[ 'len' b ]` returns `Number`.
      @memberof module:Eleven~Eval_String
      @instance */
  len (node) {
    const val = this.visit(node[1]);
    if (typeof val != 'string')
      this._error(node.lineno, "'len' non-string");
    return val.length;  // undefined if not string
  }

  /** `[ 'string' value ]` returns `String`.
      @memberof module:Eleven~Eval_String
      @instance */
  string (node) {
    if (typeof node[1] != 'string')
      this._error(node.lineno, "'string' non-string");
    return node[1];
  }
};

/** Method to interpret explicit typing.
    @mixin
*/
const Eval_Cast = superclass => class extends superclass {
  /** `[ 'cast' type b ]` returns type-cast value.
      @memberof module:Eleven~Eval_Cast
      @instance */
  cast (node) {
    switch (node[1]) {
    case 'bool':   return !! this.visit(node[2]);
    case 'number': return Number(this.visit(node[2]));
    case 'string': return String(this.visit(node[2]));
    default:       throw node[1] + ': not expected for cast';
    }
  }
};

// --- 11/07

/** Base class for type checking.
    @class
*/
class Check extends Visit {
  /** Utility: accepts `[ type value ]`, sets `.type` from tag, returns node.
      @param {Array} node - to check. */
  _literal (node) {
    if (!(typeof node[1]).startsWith(node[0]))
      this._error(node.lineno, `expected ${node[0]} literal`);
    node.type = node[0]; return node;
  }

  /** Utility: visits and casts `node[index]` to `type` if needed, returns node.
      @param {string} type - expected.
      @param {Array} node - parent of subtree to check.
      @param {number} index - of subtree in `node`. */
  _toType (type, node, index) {
    if (this.visit(node[index]).type != type)
      (node[index] = [ 'cast', type, node[index] ]).type = type;
    return node;
  }

  /** Utility: casts all operands to type if needed, sets `.type`, returns node.
      @param {string} type - expected.
      @param {Array} node - tree to check. */
  _require (type, node) {
    node.slice(1).forEach((_, n) => this._toType(type, node, n+1));
    node.type = type;
    return node;
  }
}

/** Methods to check arithmetic expressions, cast to `number` if needed,
    return `number` node.
    @mixin
*/
const Check_Number = superclass => class extends superclass {
  /** `[ 'add' a b ]` casts to `number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  add (node) { return this._require('number', node); }

  /** `[ 'subtract' a b ]` casts to `number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  subtract (node) { return this._require('number', node); }

  /** `[ 'multiply' a b ]` casts to `number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  multiply (node) { return this._require('number', node); }

  /** `[ 'divide' a b ]` casts to `number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  divide (node) { return this._require('number', node); }

  /** `[ 'power' a b ]` casts to `number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  power (node) { return this._require('number', node); }

  /** `[ 'minus' b ]` casts to `number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  minus (node) { return this._require('number', node); }

  /** `[ 'number' value ]` expects `number` value.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Number
      @instance */
  number (node) { return this._literal(node); }
};

/** Methods to check comparisons, cast to left operand's type if needed,
    return `bool` node.
    @mixin
*/
const Check_Cmps = superclass => class extends superclass {
  /** Casts right operand to left operand's type if needed.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  _cmp (node) {
    const type = this.visit(node[1]).type;
    this._toType(type, node, 2);
    node.type = 'bool';
    return node;
  }

  /** `[ 'eq' a b ]`
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  eq (node) { return this._cmp(node); }
  /** `[ 'ne' a b ]`
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  ne (node) { return this._cmp(node); }

  /** `[ 'gt' a b ]`
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  gt (node) { return this._cmp(node); }

  /** `[ 'ge' a b ]`
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  ge (node) { return this._cmp(node); }

  /** `[ 'lt' a b ]`
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  lt (node) { return this._cmp(node); }

  /** `[ 'le' a b ]`
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cmps
      @instance */
  le (node) { return this._cmp(node); }
};

/** Methods to check Boolean expressions, cast to `bool` if needed,
    return `bool` node.
    @mixin
*/
const Check_Bool = superclass => class extends superclass {
  /** `[ 'or' a b ]` casts to `bool`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Bool
      @instance */
  or (node) { return this._require('bool', node); }

  /** `[ 'and' a b ]` casts to `bool`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Bool
      @instance */
  and (node) { return this._require('bool', node); }

  /** `[ 'not' b ]` casts to `bool`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Bool
      @instance */
  not (node) { return this._require('bool', node); }

  /** `[ 'bool' value ]` expects `boolean` value.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Bool
      @instance */
  bool (node) { return this._literal(node); }
};

/** Methods to check string expressions, cast to `string` if needed;
    requires {@linkcode module:Eleven~Check_Number06 Check_Number06} as superclass
    to defer to `add`. Return `string` node.
    @mixin
*/
const Check_String = superclass => class extends superclass {
  /** `[ 'input' prompt? default? ]` returns `node.string`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_String
      @instance */
  input (node) {
    node.type = 'string'; return node;
  }

  /** `[ 'add' a b ]` for at least one `string` casts to `string` and returns `node` as `concat.string`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_String
      @instance */
  add (node) {
    const a = this.visit(node[1]), b = this.visit(node[2]);
    if (a.type != 'string') {
      if (b.type != 'string') return super.add(node);   // any  any
      this._toType('string', node, 1);               // any  string
    } else if (b.type != 'string')
      this._toType('string', node, 2);                // string any
    node[0] = 'concat';                            // string string
    node.type = 'string'; return node;
  }

  /** `[ 'len' b ]` casts to `string` and returns `node.number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_String
      @instance */
  len (node) {
    this._require('string', node);
    node.type = 'number'; return node;
  }

  /** `[ 'string' value ]` expects `string` value, returns  `node.string`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_String
      @instance */
  string (node) { return this._literal(node); }
};

/** Method to check explicit cast, sets `.type` from cast, returns typed node.
    @mixin
*/
const Check_Cast = superclass => class extends superclass {
  /** `[ 'cast' type b ]` returns `node.type`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Cast
      @instance */
  cast (node) {
    this.visit(node[2]);
    node.type = node[1]; return node;
  }
};

// --- 11/08

/** Class actions to represent a block with declarations and other items as a tree.
    @mixin
*/
const Build_Dcl = superclass => class extends superclass {
  /** `block: item [{ ';' item }]; item: dcl | stmt;` returns `[ 'block' dcl... stmt... ]`
      @memberof module:Eleven~Build_Dcl
      @instance */
  block (item, many) {
    const items = (many ? many[0] : []).reduce(
      (items, alt) => { items.push(alt[1][0]); return items; }, [ item[0] ]);
    return this._lineno([ 'block' ].concat(
      items.filter(item => item[0] == 'dcl'),
      items.filter(item => item[0] != 'dcl')));
  }

  /** `dcl: type Name [{ ',' Name }];` returns `[ 'dcl' type name ... ]`
      @memberof module:Eleven~Build_Dcl
      @instance */
  dcl (type, name, many) {
    return this._lineno([ 'dcl', type, name ].
      concat(many ? many[0].map(alt => alt[1]) : []));
  }
};

/** Methods to check typed statements, return node.
    @mixin
*/
const Check_Stmts = superclass => class extends superclass {
  /** `[ 'stmts' stmt ... ]` checks each `stmt`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Stmts
      @instance */
  stmts (node) {
    node.slice(1).forEach(stmt => this.visit(stmt)); return node;
  }

  /** `[ 'print' value ... ]` values cast to `string`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Stmts
      @instance */
  print (node) { return this._require('string', node); }

  /** `[ 'loop' cond stmt ]` condition cast to `bool`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Stmts
      @instance */
  loop (node) {
    this.visit(node[2]);
    return this._toType('bool', node, 1);
  }
  /** `[ 'select' cond then else? ]` condition cast to `bool`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Stmts
      @instance */
  select (node) {
    node.slice(2).forEach(node => this.visit(node));
    return this._toType('bool', node, 1);
  }
};

/** Methods to check names, return (typed) node.
    Requires {@linkcode module:Eleven~Symbols Symbols}.
    @mixin
*/
const Check_Names = superclass => class extends superclass {
  /** Returns `node.type(name)`, if undefined `node.number`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Names
      @instance */
  name (node) {
    node.type = this._type(node.lineno, node[1]);
    return node;
  }

  /** Utility: returns type of name, defaulted to `number`.
      @param {number} lineno - for error message, if any.
      @param {string} name - to find.
      @memberof module:Eleven~Check_Names
      @instance */
  _type (lineno, name) {
    const symbol = this._alloc(name);
    if (!('type' in symbol)) {
      this._error(lineno, name + ': undefined');
      symbol.type = 'number';
    }
    return symbol.type;
  }

  /** `[ 'assign' name value ]` casts `value` to type of `name`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Names
      @instance */
  assign (node) {
    return this._toType(this._type(node.lineno, node[1]), node, 2);
  }
};

/** Methods to check a list of statements and declarations, return node.
    @mixin
*/
const Check_Dcl = superclass => class extends superclass {
  /** `[ 'block' dcl ... other ... ]` replaces each node by the result of the visit, returns `node`.
      @param {Array} node - to check.
      @memberof module:Eleven~Check_Dcl
      @instance */
  block (node) {
    node.slice(1).forEach((item, n) => node[n + 1] = this.visit(item));
    return node;
  }

  /** `[ 'dcl' type Name ...]` allocates and types each `Name`, returns `node`.
      @memberof module:Eleven~Check_Dcl
      @instance */
  dcl (node) {
    node.slice(2).forEach(name => {
      if (this.symbols.has(name))
        this._error(node.lineno, name + ': duplicate');
      this._alloc(name).type = node[1];
    });
    return node;
  }
};

// --- 11/09

/** Methods to interpret a block with declarations and other items;
    requires {@linkcode module:Eleven~Symbols Symbols}.
    @mixin
*/
const Eval_Dcl = superclass => class extends superclass {
  /** `[ 'block' dcl ... other ... ]` visits all.
      @memberof module:Eleven~Eval_Dcl
      @instance */
  block (node) {  node.slice(1).forEach(item => this.visit(item)); }

  /** `[ 'dcl' type name ...]` defines as `false`, `0`, or empty strings.
      @memberof module:Eleven~Eval_Dcl
      @instance */
  dcl (node) {
    node.slice(2).forEach(name => {
      if (this.symbols.has(name) && 'value' in this.symbols.get(name))
        this._error(node.lineno, name + ': duplicate');
      switch (node[1]) {
      case 'bool':    this._alloc(name).value = false; break;
      case 'number':  this._alloc(name).value = 0; break;
      case 'string':  this._alloc(name).value = ''; break;
      default:        this._error(node.lineno, node[1] + ": not in 'dcl'");
      }
    });
  }
};

// --- 11/10

/** Class action for a top-level rule to visit a tree and return a stack machine;
    requires {@linkcode module:Eleven~Main} and {@linkcode module:Eleven~Code} as last visitor.
    @mixin
*/
const Compile = (superclass, ...args) => class extends superclass {
  /** Create and apply all visitors, return `executable`.
      @throws {string} error message, e.g., error count or `_tree` issue.
      @memberof module:Eleven~Compile
      @instance */
  compile (tree) {
    const [lastVisitor, lastTree, trace] = this._doVisits(tree, args);
    lastVisitor.visit(lastTree, trace);
    if (trace) puts(lastVisitor.machine.toString());
    return lastVisitor.executable;
  }
};

/** Base class for code generation.
    @property {Object} Machine - stack machine generator class.
    @property {module:Six~Machine10} machine - stack machine to generate code for.
    @class
    @extends module:Eleven~Visit
*/
class Code extends Visit {
  /** Stack machine generator class. */
  get Machine () { return this.#Machine ??= Six.Machine10; }
  #Machine;
  
  /** Extended stack machine instructions. */
  get Instructions () {
    return this.#Instructions ??= superclass => superclass;
  }
  #Instructions;
  
  /** Stack machine generator. */
  get machine () { 
    return this.#machine ??= new (this.Instructions(this.Machine)) ();
  }
  #machine;
  
  /** The executable. */
  get executable () { return this.machine.run(0); }
  
  /** Visits the subtrees and generates an instruction.
      @param {string} op - instruction name.
      @returns {number} end of code memory. */
  _postfix (node, op) {
    node.slice(1).forEach(node => this.visit(node));
    return this.machine.gen(op);
  }
}

/** Methods to generate code for arithmetic expressions;
    all return the next code address.
    @mixin
*/
const Code_Number = superclass => class extends superclass {
  /** `Power` instruction. */
  get Instructions () {
    return this.#Instructions ??=
      superclass => class extends super.Instructions(superclass) {
        /** `stack: ... a b -> ... a**b` */
        Power (memory) {
          memory.splice(-2, 2, memory.at(-2) ** memory.at(-1));
        }
      }; 
  }
  #Instructions;
  /** `[ 'add' a b ]`
      @memberof module:Eleven~Code_Number
      @instance */
  add (node) { return this._postfix(node, 'Add'); }

  /** `[ 'subtract' a b ]`
      @memberof module:Eleven~Code_Number
      @instance */
  subtract (node) { return this._postfix(node, 'Subtract'); }

  /** `[ 'multiply' a b ]`
      @memberof module:Eleven~Code_Number
      @instance */
  multiply (node) { return this._postfix(node, 'Multiply'); }

  /** `[ 'divide' a b ]`
      @memberof module:Eleven~Code_Number
      @instance */
  divide (node) { return this._postfix(node, 'Divide'); }

  /** `[ 'power' a b ]`
      @memberof module:Eleven~Code_Number
      @instance */
  power (node) { return this._postfix(node, 'Power'); }

  /** `[ 'minus' a ]`
      @memberof module:Eleven~Code_Number
      @instance */
  minus (node) { return this._postfix(node, 'Minus'); }

  /** `[ 'number' a ]`
      @memberof module:Eleven~Code_Number
      @instance */
  number (node) {
    if (typeof node[1] != 'number')
      this._error(node.lineno, "'number' non-number");
    return this.machine.gen('Push', node[1]);
  }
};

// --- 11/11

/** Methods to generate code for comparisons;
    all return the next code address.
    Uses {@linkcode module:Six~Machine11 Machine11}.
    Requires {@linkcode module:Eleven~Symbols Symbols} for frame size and tracing.
    @mixin
*/
const Code_Cmps = superclass => class extends superclass {
  /** [Override] Use `Six.Machine11`.
      @memberof module:Eleven~Code_Cmps
      @instance */
  get Machine () { return this.#Machine ??= Six.Machine11; }
  #Machine;

  /** [Override] The executable, checks for `trace` variable.
      @memberof module:Eleven~Code_Cmps
      @instance */
  get executable () { 
    const trace = this.symbols.get('trace');
    return this.machine.run(this.symbols.size, 0,
      trace ? trace.ord - 1 : false);
  }

  /** `[ 'eq' a b ]`
      @memberof module:Eleven~Code_Cmps
      @instance */
  eq (node) { return this._postfix(node, 'Eq'); }

  /** `[ 'ne' a b ]`
      @memberof module:Eleven~Code_Cmps
      @instance */
  ne (node) { return this._postfix(node, 'Ne'); }

  /** `[ 'gt' a b ]`
      @memberof module:Eleven~Code_Cmps
      @instance */
  gt (node) { return this._postfix(node, 'Gt'); }

  /** `[ 'ge' a b ]`
      @memberof module:Eleven~Code_Cmps
      @instance */
  ge (node) { return this._postfix(node, 'Ge'); }

  /** `[ 'lt' a b ]`
      @memberof module:Eleven~Code_Cmps
      @instance */
  lt (node) { return this._postfix(node, 'Lt'); }

  /** `[ 'le' a b ]`
      @memberof module:Eleven~Code_Cmps
      @instance */
  le (node) { return this._postfix(node, 'Le'); }
};

/** Methods to generate code for names;
    all return the next code address.
    Requires {@linkcode module:Eleven~Symbols Symbols}.
    @mixin
*/
const Code_Names = superclass => class extends superclass {
  /** `[ 'name' name ]`
      @memberof module:Eleven~Code_Names
      @instance */

  name (node) {
    return this.machine.gen('Load', this._alloc(node[1]).ord - 1);
  }

  /** `[ 'assign' name value ]` returns next code address.
      @memberof module:Eleven~Code_Names
      @instance */
  assign (node) {
    this.visit(node[2]);
    this.machine.gen('Store', this._alloc(node[1]).ord - 1);
    return this.machine.gen('Pop');
  }
};

/** Methods to generate code for statements;
    all return the next code address.
    Requires {@linkcode module:Eleven~Code_Cmps Code_Cmps}.
    Adds `Bnzero` to `super.Instructions`.
    @mixin
*/
const Code_Stmts = superclass => class extends superclass {
  /** [Override] Add `Bnzero`.
      @memberof module:Eleven~Code_Stmts
      @instance */
  get Instructions () {
    return this.#Instructions ??=
      superclass => class extends super.Instructions(superclass) {
        /** `stack: ... bool -> ... | pc: bool? a` */
        Bnzero (a) {
          return memory => { if (memory.pop()) memory.pc = a; }
        }
      };
  }
  #Instructions;

  /** `[ 'stmts' stmt ... ]`
      @memberof module:Eleven~Code_Stmts
      @instance */
  stmts (node) {
    return node.slice(1).reduce((end, stmt) => this.visit(stmt), 0);
  }

  /** `[ 'print' value ... ]`
      @memberof module:Eleven~Code_Stmts
      @instance */
  print (node) {
    node.slice(1).forEach(value => this.visit(value));
    return this.machine.gen('Print', node.length - 1);
  }

  /** `[ 'loop' cond stmt ]`
      @memberof module:Eleven~Code_Stmts
      @instance */
  loop (node) {
    const a = this.machine.code.push(null) - 1,  // a:   Branch b
      b = this.visit(node[2]);                   // a+1: stmt
    this.visit(node[1]);                         // b:   cond
    this.machine.code[a] = this.machine.ins('Branch', b); // fixup
    return this.machine.gen('Bnzero', a + 1);    //      Bnzero a+1
  }

  /** `[ 'select' cond then else? ]`
      @memberof module:Eleven~Code_Stmts
      @instance */
  select (node) {
    const a = this.visit(node[1]);         //      cond
    this.machine.code.push(null);          // a:   Bzero b
    let b = this.visit(node[2]), end = b;  //      then
    if (node.length > 3) {                 // b:end:
      this.machine.code.push(null);    //          Branch end
      end = this.visit(node[3]);           // b:   else
                                           // end:
      this.machine.code[b ++] = this.machine.ins('Branch', end);
    }
    this.machine.code[a] = this.machine.ins('Bzero', b); // fixup
    return end;
  }
};

// --- 11/12

/** Methods to generate code for Boolean expressions;
    all return the next code address.
    Adds `IfTrue`, `IfFalse`, and `Not` to `super.Instructions`.
    @mixin
*/
const Code_Bool = superclass => class extends superclass {
  /** [Override] Add `IfTrue`, `IfFalse`, and `Not`.
      @memberof module:Eleven~Code_Bool
      @instance */
  get Instructions () {
    return this.#Instructions ??=
      superclass => class extends super.Instructions(superclass) {
        /** `stack: ... bool -> ... bool | pc: bool? a` */
        IfTrue (a) {
          return memory => { if (memory.at(-1)) memory.pc = a; };
        }
        /** `stack: ... bool -> ... bool | pc: !bool? a` */
        IfFalse (a) {
          return memory => { if (!memory.at(-1)) memory.pc = a; };
        }
        /** `stack: ... a -> ... !a` */
        Not (memory) { memory.splice(-1, 1, !memory.at(-1)); }
      };
  }
  #Instructions;

  /** `[ 'or' a b ]`
      @memberof module:Eleven~Code_Bool
      @instance */
  or (node) {
    this.visit(node[1]);                        //    push a
    const x = this.machine.code.push(null) - 1; // x: IfTrue y
    this.machine.gen('Pop');                    //    pop a
    const y = this.visit(node[2]);              //    push b
                                                // y:
    this.machine.code[x] = this.machine.ins('IfTrue', y); // fixup
    return y;
  }

  /** `[ 'and' a b ]`
      @memberof module:Eleven~Code_Bool
      @instance */
  and (node) {
    this.visit(node[1]);                        //    push a
    const x = this.machine.code.push(null) - 1; // x: IfFalse y
    this.machine.gen('Pop');                    //    pop a
    const y = this.visit(node[2]);              //    push b
                                                // y:
    this.machine.code[x] = this.machine.ins('IfFalse', y); // fixup
    return y;
  }

  /** `[ 'not' b ]`
      @memberof module:Eleven~Code_Bool
      @instance */
  not (node) { return this._postfix(node, 'Not'); }

  /** `[ 'bool' value ]`
      @memberof module:Eleven~Code_Bool
      @instance */
  bool (node) {
    if (typeof node[1] != 'boolean')
      throw `[ 'bool' ${node[1]} ]: not boolean`;
    return this.machine.gen('Push', node[1]);
  }
};

/** Methods to generate code for string expressions;
    all return the next code address.
    Adds `Concat`, `Len`, and `InputString` to {@linkcode module:Six~Machine11 Machine11}.
    @mixin
*/
const Code_String = superclass => class extends superclass {
  /** Convert raw to literal string. Only escapes single quote, newline, backslash; see {@link module:Base~Tuple#escape}.
      @memberof module:Eleven~Code_String
      @instance */
  _escape (s) { return `'${s.replace(/['\n\\]/g, '\\$&')}'`; }

  /** [Override] Show strings in memory.
      @memberof module:Eleven~Code_String
      @instance */
  get Machine () {
    const escape = this._escape.bind(this);
    return this.#Machine ??= class extends super.Machine {
        /** Show strings in memory. */
        get Memory () {
            return this.#Memory ??= class extends super.Memory {
              toString () {
                return '[ ' + this.map(
                    v => typeof v == 'string' ? escape(v) : v
                  ).join(' ') + ' ]';
              }
            };
        }
        #Memory;
      };
  }
  #Machine;

  /** [Override] Add  `InputString`, `Concat`, and `Len`.
      @memberof module:Eleven~Code_String
      @instance */
  get Instructions () {
    return this.#Instructions ??=
      superclass => class extends super.Instructions(superclass) {
        /** `stack: ... a b -> ... a+b` */
        Concat (memory) {
          memory.splice(-2, 2, memory.at(-2) + memory.at(-1));
        }
        /** `stack: ... a -> ... a.length` */
        Len (memory) { 
          memory.splice(-1, 1, memory.at(-1).length);
        }
        /** `stack: ... -> ... val` */
        InputString (prmpt, dflt) { 
          return memory => memory.push(prompt(prmpt, dflt));
        }
      };
  }
  #Instructions;
    
  /** `[ 'input' prompt? default? ]` returns next code address.
      @memberof module:Eleven~Code_String
      @instance */
  input (node) {
    return this.machine.gen('InputString',
      this._escape(node[1] ?? "''"), this._escape(node[2] ?? "''"));
  }

  /** `[ 'concat' a b ]`
      @memberof module:Eleven~Code_String
      @instance */
  concat (node) { return this._postfix(node, 'Concat'); }
  /** `[ 'len' b ]` returns `number`.
      @memberof module:Eleven~Code_String
      @instance */
  len (node) { return this._postfix(node, 'Len'); }

  /** `[ 'string' value ]` returns `string`.
      @memberof module:Eleven~Code_String
      @instance */
  string (node) {
    if (typeof node[1] != 'string')
      throw `[ 'string' ${node[1]} ]: not string`;
    return this.machine.gen('Push', this._escape(node[1]));
  }
};

/** Method to generate code for `cast`; returns the next code address.
    Adds `Cast` to {@linkcode module:Six~Machine11 Machine11}.
    @mixin
*/
const Code_Cast = superclass => class extends superclass {
  /** [Override] Add  `Cast`.
      @memberof module:Eleven~Code_Cast
      @instance */
  get Instructions () {
    return this.#Instructions ??=
      superclass => class extends super.Instructions(superclass) {
        /** `stack: ... a -> ... cast a` */
        Cast (to, from) {
          let cast;
          switch (to + '-' + from) {
          case 'bool-number':   cast = x => !!x; break;
          case 'bool-string':   cast = x => /^\s*true\s*$/i.test(x); break;
          case 'number-bool':
          case 'number-string': cast = Number; break;
          case 'string-bool':
          case 'string-number': cast = String; break;
          default: throw `Cast ${to} ${from}: illegal cast`;
          }
          return memory => 
            memory.splice(-1, 1, cast(memory.at(-1)));
        }
      };
  }
  #Instructions;

  /** `[ 'cast' type b ]`
      @memberof module:Eleven~Code_Cast
      @instance */
  cast (node) {
    this.visit(node[2]);
    return this.machine.gen('Cast', `'${node[1]}'`, `'${node[2].type}'`);
  }
};

/** Methods to generate code for `block` and `dcl`;
    all return the next code address.
    Requires {@linkcode module:Eleven~Symbols Symbols}.
    @mixin
*/
const Code_Dcl = superclass => class extends superclass {
  /** `[ 'block' dcl ... stmt ... ]` visits all.
      @memberof module:Eleven~Code_Dcl
      @instance */
  block (node) {
    return node.slice(1).reduce((end, node) => this.visit(node), 0);
  }
  
  /** `[ 'dcl' type name ...]` allocate, initializes `bool` and `string`.
      @memberof module:Eleven~Code_Dcl
      @instance */
  dcl (node) {
    return node.slice(2).reduce((end, name) => {
      const addr = this._alloc(name).ord - 1;
      switch (node[1]) {
      case 'number': return this.machine.code.length;
      case 'bool':   this.machine.gen('Push', false); break;
      case 'string': this.machine.gen('Push', "''"); break;
      }
      this.machine.gen('Store', addr);
      return this.machine.gen('Pop');
    }, 0);
  }
};

export {
  Build, Build_RD                                                         // 11/01
  ,Build_Number                                                           // 11/02
  ,Visit, Eval_Number, Main                                               // 11/03
  ,Build_Stmts, Build_Names, Build_Cmps                                   // 11/04
  ,Eval_Cmps, Eval_Stmts, Symbols, Eval_Names                             // 11/05
  ,Build_String, Build_Bool, Build_Cast, Eval_String,Eval_Bool, Eval_Cast // 11/06
  ,Check, Check_Number, Check_Cmps, Check_Bool, Check_String, Check_Cast  // 11/07
  ,Build_Dcl, Check_Stmts, Check_Names, Check_Dcl                         // 11/08
  ,Eval_Dcl                                                               // 11/09
  ,Compile, Code, Code_Number                                             // 11/10
  ,Code_Cmps, Code_Names, Code_Stmts                                      // 11/11
  ,Code_Bool, Code_String, Code_Cast, Code_Dcl                            // 11/12
};
