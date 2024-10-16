/** This module contains the classes for all examples in chapter seven.
   
    @module Seven
    @author © 2024 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-04-05
  */

import * as Six from './06.js';

/** [Example 7/01](../?eg=07/01): actions to compile string values and conversions into functions.
    @extends module:Six~Functions12 */
class TCheck01 extends Six.Functions12 {
  /** Removes quotes and backslash */
  _unq (s) { 
    return  s.slice(1,-1).replace(/\\([\\'])/g, "$1");
  }
  
  // prog: stmts;
  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | loop | select;
  // assign: Name '=' stringSum;
  // print: 'print' sums;
  // sums: stringSum [{ ',' stringSum }];
  // loop: 'while' cmp 'do' stmts 'od';
  // select: 'if' cmp 'then' stmts [ 'else' stmts ] 'fi';
  // cmp: sum rel | stringSum stringRel;
  // sum: product [{ add | subtract }];
  // add: '+' product;
  // subtract: '-' product;
  // product: signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed:[ '-' ] term;

  /** `term: number | '(' sum ')' | 'number' stringTerm;` returns `fct:term` */
  // term: number | '(' sum ')' | 'number' stringTerm;
  //       [0]          [1]                [1]
  term (...val) {
    switch (val.length) {
    case 1: return val[0];
    case 3: return val[1];
    case 2: return memory => parseInt(val[1](memory), 10);
    }
  }
  
  // number: Number;
  // rel: eq | ne | gt | ge | lt | le;
  // eq: '=' sum;
  // ne: '<>' sum;
  // gt: '>' sum;
  // ge: '>=' sum;
  // lt: '<' sum;
  // le: '<=' sum;

  /** `stringSum: stringTerm [{ stringTerm }];` returns fct */
  stringSum (term, many) {
    const c = (a, b) => memory => a(memory) + b(memory);
    return (many ? many[0] : []).
      reduce((sum, list) => c(sum, list[0]), term);
  }

  /** `stringTerm: string | name | input | 'string' term;` */
  //               [0]      [0]    [0]              [1]
  stringTerm (...val) {
    return val.length == 1 ? val[0] :
      memory => String(val[1](memory));
  }

  /** `string: String;` returns fct */
  string (s) { return () => this._unq(s); }
  
  // name: Name;

  /** `input: 'input' String String;` [replace] returns fct */
  input (i, prmpt, dflt) {
    return () => prompt(this._unq(prmpt), this._unq(dflt));
  }
  
  // stringRel: stringEq | stringNe | stringGt | stringGe | stringLt | stringLe;

  /** `stringEq: '=' stringSum;` returns fct for composition */
  stringEq (_, right) { return this.parser.call(this, super.eq, _, right); }

  /** `stringNe: '<>' stringSum;` returns fct for composition */
  stringNe (_, right) { return this.parser.call(this, super.ne, _, right); }
  
  /** `stringGt: '>' stringSum;` returns fct for composition */
  stringGt (_, right) { return this.parser.call(this, super.gt, _, right); }
  
  /** `stringGe: '>=' stringSum;` returns fct for composition */
  stringGe (_, right) { return this.parser.call(this, super.ge, _, right); }
  
  /** `stringLt: '<' stringSum;` returns fct for composition */
  stringLt (_, right) { return this.parser.call(this, super.lt, _, right); }
  
  /** `stringLe: '<=' stringSum;` returns fct for composition */
  stringLe (_, right) { return this.parser.call(this, super.le, _, right); }
}

/** [Example 7/02](../?eg=07/02): actions to type-check and compile int|float|string into functions.
    @extends module:Seven~TCheck01 */
class TCheck02 extends TCheck01 {
  /** For error messages */
  get parser () { return this.#parser; }
  #parser;
  /** Symbol table, maps names to types */
  get symbols () { return this.#symbols; }
  #symbols; 
  /** For symbolic computing with types */
  get stack () { return this.#stack; }
  #stack = [ ];
  
  constructor (parser, symbols = new Map()) {
    super();
    this.#parser = parser;
    this.#symbols = symbols;
  }

  /** Returns type of name, message if undefined */
  _type (name) {
    const type = this.symbols.get(name);
    if (type) return type;
    this.parser.error(name + ': undeclared');   // return undefined
  }

  /** Converts `fct:from` into `fct:to` if needed */
  _cast (fct, from, to) {
    switch (`${to} <- ${from}`) {
    default:
      this.parser.error('impossible cast from', from, 'to', to);

    case 'int <- int': case 'float <- float':
    case 'string <- string': case 'float <- int':
      return fct;

    case 'int <- float':
      return memory => Math.round(fct(memory));

    case 'int <- string':
      return memory => parseInt(fct(memory), 10);

    case 'float <- string':
      return memory => parseFloat(fct(memory));

    case 'string <- int': case 'string <- float':
      return memory => String(fct(memory));
    }
  }

  /** `prog: [{ decl ';' }] stmts;` returns executable */
  prog (many, stmts) { return this.parser.call(this, super.prog, stmts); }
  
  /** `decl: type Name [{ ',' Name }];` */
  decl (type, name, many) {
    [ name ].concat(many ? many[0].map(list => list[1]) : []).
      forEach(name => {
        if (this.symbols.has(name))
          this.parser.error(`${name}: duplicate`);
        this.symbols.set(name, type[0]);
      });
  }

  // type: 'int' | 'float' | 'string';
  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | loop | select;

  /** `assign: Name '=' sum;` returns fct */
  assign (name, _, sum) {
    const type = this._type(name),
      r = this.stack.pop();
    if (type != r)
        this.parser.error(`assigning ${r} to ${type} ${name}`);
    return this.parser.call(this, super.assign, name, _, sum);
  }

  /** `print: 'print' sums;` returns fct, string arguments only */
  print (p, sums) { 
    if (! this.stack.splice(- sums.length, sums.length).
            every(type => type == 'string'))
      this.parser.error('can only print strings');
    return this.parser.call(this, super.print, p, sums);
  }

  /** `printAny: 'print' sums;` returns fct */
  printAny (p, sums) {     // implicitly casts non-string arguments
    sums.reverse().map((sum, n) => {         // check each argument
      const type = this.stack.pop();      // requires reverse order
      if (type != 'string') {
        sum = this._cast(sum, type, 'string');  // apply conversion
        puts(`print argument ${sums.length - n} was ${type}`);
      }
      return sum;                             // returns fct:string
    }).reverse();
    return this.parser.call(this, super.print, p, sums);
  }

  // sums: sum [{ ',' sum }];

  /** `cmp: sum rel;` returns fct */
  cmp (sum, rel) {
    const [ l, r ] = this.stack.splice(-2, 2);
    if ((l == 'string' || r == 'string') && l != r)
      this.parser.error('must compare strings to strings');
    return this.parser.call(this, super.cmp, sum, rel);
  }
  
  // rel: eq | ne | gt | ge | lt | le;
  // eq: '=' sum;
  // ne: '<>' sum;
  // gt: '>' sum;
  // ge: '>=' sum;
  // lt: '<' sum;
  // le: '<=' sum;
  // sum: product [{ add | subtract }];

  /** `add: '+' product;` returns `fct:string|int|float` */
  add (_, right) {
    const [ l, r ] = this.stack.splice(-2, 2);
    this.stack.push(l == 'string' || r == 'string' ? 'string' :
        l == 'int' && r == 'int' ? 'int' : 'float');
    return this.parser.call(this, super.add, _, right);
  }
  
  /** `subtract: '-' product;` returns `fct:int|float` */
  subtract (_, right) {
    const [ l, r ] = this.stack.splice(-2, 2);
    if (l == 'string' || r == 'string')
      this.parser.error("cannot apply '-' to string");
    this.stack.push(l == 'int' && r == 'int' ? 'int' : 'float');
    return this.parser.call(this, super.subtract, _, right);
  }
  
  // product: signed [{ multiply | divide }];

  /** `multiply: '*' signed;` returns `fct:int|float` */
  multiply (_, right) {
    const [ l, r ] = this.stack.splice(-2, 2);
    if (l == 'string' || r == 'string')
      this.parser.error("cannot apply '*' to string");
    this.stack.push(l == 'int' && r == 'int' ? 'int' : 'float');
    return this.parser.call(this, super.multiply, _, right);
  }

  /** `divide: '/' signed;` returns `fct:float` */
  divide (_, right) {
    const [ l, r ] = this.stack.splice(-2, 2);
    if (l == 'string' || r == 'string')
      this.parser.error("cannot apply '/' to string");
    this.stack.push('float');
    return this.parser.call(this, super.divide, _, right);
  }

  /** `signed: [ '-' ] term;` returns `fct:term` */
  signed (minus, term) {
    if (minus && this.stack.at(-1) == 'string')
      this.parser.error("cannot apply '-' to string");
    return this.parser.call(this, super.signed, minus, term);
  }

  /** `term: int | float | string | name | input  
             | 'int' term | 'float' term | 'string' term  
             | '(' sum ')';` returns `fct:term` */
  // term: int | float | string | name | input
  //       [0]
  //     | 'int' term | 'float' term | 'string' term
  //       [0]   [1]
  //     | '(' sum ')';
  //           [1]
  term (...val) {
    switch (val.length) {
    case 1: return val[0];
    case 3: return val[1];
    }
    const to = val[0], from = this.stack.pop();
    this.stack.push(to);
    return this._cast(val[1], from, to);
  }

  /** `input: 'input' String String;` returns `fct.string` */
  input (i, prmt, dflt) {
    this.stack.push('string'); return this.parser.call(this, super.input, i, prmt, dflt);
  }

  /** `int: Int;` returns `fct:int` */
  int (int) { this.stack.push('int'); return this.parser.call(this, super.number, int); }

  /** `float: Float;` returns `fct:float` */
  float (float) {
    this.stack.push('float'); return () => parseFloat(float);
  }

  /** `string: String;` returns `fct:string` */
  string (string) {
    this.stack.push('string'); return this.parser.call(this, super.string, string);
  }

  /** `name: Name;`  returns `fct:_type(name)` */
  name (name) {
    this.stack.push(this._type(name));
    return this.parser.call(this, super.name, name);
  }
}

/** [Example 7/04](../?eg=07/04): function calls.
    @extends module:Six~Machine11 */
class Machine04 extends Six.Machine11 {
  /** `stack: ... -> ... old-pc | pc: addr` */
  Call (addr) { 
    return memory => (memory.push(memory.pc), memory.pc = addr);
  }
  /** `stack: ... old-pc -> ,,, 0 old-pc` */
  Entry (memory) { 
    memory.splice(-1, 0, 0);
  }
  /** `stack: ... old-pc -> ... | pc: old-pc` */
  Return (memory) { 
    memory.pc = memory.pop(); 
  }
  /** `stack: ... x old-pc result -> ... result old-pc result` */
  ReturnValue (memory) { 
    memory.splice(-3, 1, memory.at(-1)); 
  }    
}

/** [Example 7/04](../?eg=07/04): compile parameter-less functions into stack machine code.
    @extends module:Six~Control11 */
class Functions04 extends Six.Control11 {
  /** Manages next (global) variable address */
  get size () { return this.#size; }
  set size (size) { this.#size = size; }
  #size = 0;
  
  /** Describes current function */
  get funct () { return this.#funct; }
  set funct (sym) { this.#funct = sym; }
  #funct;

  /** (Inner) base class for symbol descriptions.
      @class
      @property {module:Seven~Functions04} owner - outer class.
      @property {string} name - variable or function name. */
  get Symbol () { return this.#Symbol ??= class {
      owner;                                   // surrounding class         
      name;                               // variable/function name
    
      constructor (owner, name) {
        this.owner = owner; this.name = name; 
      }
    };
  }
  #Symbol;

  /** Describes a variable.
      @class @extends Symbol
      @property {number} addr - memory address.
      @property {function} load() - generates load instruction.
      @property {function} storeOk() - always true.
      @property {function} store() - generates store instruction.
      @property {function} toString() - represents as text. */
  get Var () { return this.#Var ??= class extends this.Symbol {
      addr;                                       // memory address
  
      constructor (owner, name, addr) {
        super(owner, name); this.addr = addr;
      }
      load () {                        // generate load instruction
        this.owner.machine.gen('Load', this.addr);
      }
      storeOk () { return true; }       // always permit assignment
      store () {                      // generate store instruction
        this.owner.machine.gen('Store', this.addr);
      }
      toString () { return `${this.name} at ${this.addr}`; }
    };
  }
  #Var;

  /** Describes a function.
      @class @extends Symbol
      @property {boolean|number} start - code address.
      @property {number[]} calls - slots to insert `Call`.
      @property {number[]} returns - slots to insert branch to exit.
      @property {function} entry() - generates preamble code.
      @property {function} undo() - undoes `entry()`.
      @property {function} call() - generates `Call` instruction.
      @property {function} return() - generates branch to exit.
      @property {function} storeOk() - true if allowed to store.
      @property {function} store() - generates store instruction.
      @property {function} end() - fixes `calls`/`returns`, `exit()`.
      @property {function} exit() - generates postamble code.
      @property {function} toString() - represents as text. */
  get Fun () { return this.#Fun ??= class extends this.Symbol {
      start = false;                  // start address, not yet set
      calls = [];                    // forward references to entry
      returns = [];                   // forward references to exit
    
      entry () { // defines start address, arranges slot for result
        this.start = this.owner.machine.gen('Entry') - 1;
      }  
      undo () {               // ends a declaration, undoes entry()
        this.owner.machine.code.length = this.start;
        this.start = false;
      }  
      call () {    // create Call or save address for slot for Call
        if (typeof this.start == 'number')
          this.owner.machine.gen('Call', this.start);
        else
          this.calls.push(this.owner.machine.code.push(null) - 1);
      }
      return () {           // create slot for Branch, save address
        this.returns.push(this.owner.machine.code.push(null) - 1);
      }
      storeOk () {                     // ok to store result value?
        if (this == this.owner.funct) return true;
        this.owner.parser.error(`${this.name}: ` +
            `assigned to outside function`);
        return false;
      }
      store () {              // store top of stack as result value
        this.owner.machine.gen('ReturnValue');
      }
      end () {          // resolve calls and returns if any, exit()
        const call = this.owner.machine.ins('Call', this.start);
        this.calls.forEach(c => this.owner.machine.code[c] = call);
        this.calls.length = 0;

        const br = this.owner.machine.ins('Branch',
          this.owner.machine.code.length);
        this.returns.forEach(c => this.owner.machine.code[c] = br);
        this.returns.length = 0;
        this.exit();
      }
      exit () {      // generates code to return from function call
        this.owner.machine.gen('Return');
      }    
      toString () {
        return `function ${this.name} start ${this.start}`;
      }
    };
  }
  #Fun;
  
  constructor (parser, machine = new Machine04()) {
    super(parser, machine);
  }

  /** Returns symbol description for name, if any */
  _find (name, report) {
    const sym = this.symbols.get(name);
    if (report && !sym) this.parser.error(`${name}: undefined`);
    return sym;
  }
  
  /** (Re-)defines and returns `sym`, cannot be undefined */
  _dcl (sym, report) {
    if (report && this.symbols.get(sym.name))
      this.parser.error(`${sym.name}: duplicate`);
    this.symbols.set(sym.name, sym);
    return sym;
  }
  
  /** Returns new `Var` at next global address. */
  _alloc (name) { return new this.Var(this, name, this.size ++); }
  
  /** Flags undefined functions, returns main if defined */ 
  _check_defs (map) {
    let main = undefined;
    map.forEach(sym => {
      if (sym instanceof this.Fun)
        if (typeof sym.start != 'number')
          this.parser.error(`${sym.name}: undefined function`);
        else if (sym.name == 'main')
          main = sym;
    });
    return main;
  }

  /** Generates `Call` to `main.start` and `Print` result
      @param {Fun} main - describes `main()`. */
  _startup (main) {
    this.machine.gen('Call', main.start);     // call main function
    this.machine.gen('Print', 1);                  // print and pop
  }

  /** `prog: [ vars ] funs;` returns executable */
  prog (v, f) {
    const main = this._check_defs(this.symbols),  // flag undefined
      startAddr = this.machine.code.length,      // at startup code
      trace = this._find('trace'),  // does variable 'trace' exist?
      traceAddr = trace instanceof this.Var ? trace.addr : false;
    if (main) this._startup(main);         // generate call to main
    else this.parser.error('main: undefined');
    if (traceAddr !== false) {                 // if 'trace' exists
      puts(this.machine.toString());                  // show code,
      this.symbols.forEach(s => puts(s.toString()));    // symbols,
      puts('stack starts at', this.size);   // variable memory size
      if (main) puts('execution starts at', startAddr);
    }
    return this.machine.run(this.size, startAddr, traceAddr);
  }

  // vars: 'var' names ';';

  /** `names: Name [{ ',' Name }];` defines new variables,
      returns number of names */
  names (name, some) {
     const dcl = name => this._dcl(this._alloc(name), true);
     dcl(name);
     if (some) some[0].forEach(list => dcl(list[1]));
     return 1 + (some ? some[0].length : 0);
  }

  // funs: { fun };

  /** `fun: head [ 'begin' stmts 'end' ] ';';` */
  fun (head, opt, _) {
    if (opt) head.end();            // function definition: wrap up
    else head.undo();   // function declaration: discard entry code
    this.funct = null;                           // not in function
  }

  /** `head: 'function' Name;` returns function symbol */
  head (f, name) {
    let sym = this._find(name);
    if (! (sym instanceof this.Fun)) {
      if (sym instanceof this.Var)
        this.parser.error(`${name}: used as variable and function`);
      sym = this._dcl(new this.Fun(this, name));
    }
    if (typeof sym.start == 'number') {
      this.parser.error(`${name}: duplicate`);
      sym = this._dcl(new this.Fun(this, name));           // patch
    }
    sym.entry();                // generate code for function entry
    return this.funct = sym;                         // in function
  }

  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | return | loop | select;

  /** `assign: Name [ '=' sum ];` */
  assign (name, sum) {
    const sym = this._find(name, true);
    if (sym) {
      if (sym instanceof this.Var)
        if (sum && sym.storeOk()) sym.store();   // variable = sum
        else this.parser.error(`${name}: cannot call a variable`);
      else if (!sum) sym.call();                   // function call
      else if (sym.storeOk()) sym.store();        // function = sum
      this.machine.gen('Pop');                       // clear stack
    }
  }

  // print: 'print' sums;
  // sums: sum [{ ',' sum }];

  /** `return: 'return' [ sum ];` */
  return (r, sum) {
    if (sum && this.funct.storeOk())
      (this.funct.store(), this.machine.gen('Pop'));
    this.funct.return();
  }

  // loop: While cmp Do stmts 'od';
  // While: 'while';
  // Do: 'do';
  // select: 'if' cmp Then stmts [ Else stmts ] 'fi';
  // Then: 'then';
  // Else: 'else';
  // cmp: sum rel;
  // rel: eq | ne | gt | ge | lt | le;
  // eq: '=' sum;
  // ne: '<>' sum;
  // gt: '>' sum;
  // ge: '>=' sum;
  // lt: '<' sum;
  // le: '<=' sum;
  // sum: product [{ add | subtract }];
  // add: '+' product;
  // subtract: '-' product;
  // product: signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed: [ '-' ] term;
  // term: input | number | name | '(' sum ')';
  // input: 'input' [ Number ];
  // number: Number;

  /** `name: Name;` */
  name (name) {
    const sym = this._find(name, true);
    if (sym instanceof this.Fun) sym.call();
    else if (sym) sym.load();
  }
}

/** [Example 7/06](../?eg=07/06): parameters and local variables.
    @extends module:Seven~Machine04 */
class Machine06 extends Machine04 {
  /** Data memory for frames.
      @class @extends super.Memory
      @property {number} fp - frame pointer.
      @property {number[]} frames - list of number of parameters,
        in reverse order of dynamic link.
      @property {function} mapSlot() - shows one slot
      @property {function} toString() - [replace] shows frames. */
  get Memory () {
    return this.#Memory ??= class extends super.Memory {
      fp = 0;                           // global frame starts at 0
      frames = [ 0 ];   // toString(): list of number of parameters
      
      toString () {
        let fp = this.fp,                   // begin of (top) frame
          to = this.length;                   // end of (top) frame
        return this.frames.map((parms, n) => {
          try {
            return `${fp}:[ ${this.slice(fp, to).
              map(slot => this.mapSlot(slot)).join(' ')} ]`;
          } catch (e) { throw e;                // shouldn't happen
          } finally {
            to = fp;             // end and begin of previous frame
            if (n == this.frames.length-1) fp = 0;       // globals
            else fp = this[fp + parms + 1];       // previous frame
          }
        }).reverse().join(' ');
      }
      
      mapSlot (slot) {                   // hook to interpret slots
        return typeof slot == 'undefined' ? 'undefined' : slot;
      }
    };
  }
  #Memory;

  /** `stack: ... arguments old-pc
      -> ... arguments old-pc old-fp result locals` */
  Entry (parms, size) { 
    return memory => {
      const locals = size - parms - 3,           // local variables
        fp = memory.length - parms - 1;         // new frame's base
      memory.push(memory.fp, 0);             // push old-fp, result
      if (locals)                   // push local variables, if any
        memory.push(... Array(locals).fill(0));
      memory.fp = fp;                           // new dynamic link
      memory.frames.unshift(parms);  // push frames stack for trace      
    };
  } 

  /** `stack: ... arguments old-pc old-fp result locals
      -> ... result old-pc` */
  Exit (parms) {  
    return memory => {
      const fp = memory.fp;                        // current frame
      memory.fp = memory[fp + parms + 1];   // restore dynamic link
      memory.splice(fp, Infinity,  // pop frame, push result old-pc
        memory[fp + parms + 2], memory[fp + parms]);
      memory.frames.shift();            // pop frames stack (trace)
    };
  }
  
  /** `stack: ... -> ... frame[addr]` */
  LoadFP (addr) {
    return memory => memory.push(memory[memory.fp + addr]);
  }

  /** `stack: ... val -> ... val | frame[addr]: val` */
  StoreFP (addr) {
    return memory => memory[memory.fp + addr] = memory.at(-1);
  }
}

/** [Example 7/06](../?eg=07/06): compile functions with parameters and local variables.
    @extends module:Seven~Functions04 */
class Parameters06 extends Functions04 {
  /** Describes a global or local variable.
      @class @extends super.Var
      @property {number} depth - 0: global, 1: local.
      @property {function} load() - [replace] global/local.
      @property {function} store() - [replace] global/local. */
  get Var () { return this.#Var ??= class extends super.Var {
      depth;                               // 0: global, else local
      
      constructor (owner, name, addr, depth) {
        super(owner, name, addr); this.depth = depth;
      }
      load () {                        // generate load instruction
        if (this.depth)                                    // local
          this.owner.machine.gen('LoadFP', this.addr);
        else                                              // global
          this.owner.machine.gen('Load', this.addr);
      }
      store () {                      // generate store instruction
        if (this.depth)                                    // local
          this.owner.machine.gen('StoreFP', this.addr);
        else                                              // global
          this.owner.machine.gen('Store', this.addr);
      }
      toString () {
        return `${this.name} at ${this.depth ? '+' : ''}${this.addr}`;
      }
    };
  }
  #Var;
  
  /** Describes a function with parameters and local variables.
      @class @extends super.Fun
      @property {number} parms - number of parameters.
      @property {number} addr - offset of function result slot in frame.
      @property {Map} locals - maps names to local variables.
      @property {number} size - size of frame.
      @property {function} entry() - [replace] slot for `Entry`.
      @property {function} setParms() - captures number of parameters, starts frame.
      @property {function} undo() - [extend] also reset locals.
      @property {function} store() - [replace] use `StoreFP`.
      @property {function} exit() - [replace] fill `Entry`, `Exit`. */
  get Fun () { return this.#Fun ??= class extends super.Fun {
      parms;                                // number of parameters
      addr;              // offset of function result slot in frame
      #locals = new Map();      // maps local names to descriptions
      get locals () { return this.#locals; }
      set locals (locals) { this.#locals = locals; }
      #size = 0;                        // next address, frame size
      get size () { return this.#size; }
      set size (size) { this.#size = size; }
      
      entry () {  // defines start address, arranges slot for Entry
        this.start = this.owner.machine.code.push(null) - 1;
      }  
      setParms () {         // frame: parms, old-pc, old-fp, result
        if (typeof this.parms != 'undefined' 
            && this.parms != this.size)
          this.owner.parser.error(`${this.name} parameters: ` +
            `previously ${this.parms}, now ${this.size}`);
        this.parms = this.size;         // set number of parameters
        this.size += 2;         // leave room for old pc and old fp
        this.addr = this.size ++;          // leave slot for result
      }
      undo () {
        this.locals = new Map();             // undefine parameters
        this.size = 0;            // reset next address, frame size
        super.undo();
      }
      store () {                                   // use `StoreFP`
        this.owner.machine.gen('StoreFP', this.addr);
      }
      exit () {           // fills Entry, generates Exit and Return
        this.owner.machine.code[this.start] =
          this.owner.machine.ins('Entry', this.parms, this.size);
        this.owner.machine.gen('Exit', this.parms);
        this.owner.machine.gen('Return');
      }    
      toString () {
        const names = [];
        this.locals.forEach(sym => names.push(sym.name));
        return `function ${this.name} start ${this.start} ` +
          `parms ${this.parms} size ${this.size} ` +
          `[ ${names.join(' ')} ]`;
      }
    };
  }
  #Fun;
  
  /** Manages a stack of contexts for assign or call to a name */
  get context () {
    if (this.#contexts.length) return this.#contexts.at(-1);
    throw 'no context';                              //can't happen
  }
  set context (context) {            // push a value, pop with null
    if (context) this.#contexts.push(context);
    else this.#contexts.pop();
  }
  #contexts = [];

  constructor (parser, machine = new Machine06()) {
    super(parser, machine);
  }

  /** Replace: returns new `Var` at next local/global address. */
  _alloc (name) {
    if (this.funct)                      // create local variable
      return new this.Var(this, name, this.funct.size ++, 1);
    else                                // create global variable
      return new this.Var(this, name, this.size ++, 0);
  }  

  /** Extend: checks local then global map, returns `sym` */
  _find (name, report) {
    let sym;
    if (this.funct && (sym = this.funct.locals.get(name)))
      return sym;                                          // local
    return super._find(name, report);                     // global
  }

  /** Replace: sets innermost map, returns `sym` */
  _dcl (sym, report) {
    const map = this.funct ? this.funct.locals : this.symbols;
    
    if (report && map.get(sym.name))
      this.parser.error(`${sym.name}: duplicate`);
    map.set(sym.name, sym);
    return sym;
  }
  
  /** [Extend] Push 0 for `main` parameters.
      @param {Fun} main - describes `main()`. */
  _startup (main) {
    for (let p = 0; p < main.parms; ++ p)
      this.machine.gen('Push', 0);
    super._startup(main);
  }
  
  // prog: [ vars ] funs;
  // vars: 'var' names ';';
  // names: Name [{ ',' Name }];
  // funs: { fun };

  /** `fun: head parms [ block ] ';';` */
  fun (head, parms, opt, _) { super.fun(head, opt); }

  // head: 'function' Name;

  /** `parms: '(' [ names ] ')';` */
  parms (lp, names, rp) { this.funct.setParms(); }

  // block: 'begin' [ vars ] stmts 'end';
  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | return | loop | select;

  /** `assign: symbol action;` codes `Pop`, pops context */
  assign (symbol, action) {
    this.machine.gen('Pop'); this.context = null;    // pop context
  }

  // action: store | call;

  /** `store: '=' sum;` expects context, codes assignment */
  store (_, sum) {
    if (this.context.symbol.storeOk())
      this.context.symbol.store();
  }

  // call: args;

  /** `args: '(' [ sums ] ')';` expects context, codes call */
  args (lp, sums, rp) {
    const sym = this.context.symbol,            // to apply args to
      nargs = sums ? sums[0] : 0;                 // # of arguments
    if (!(sym instanceof this.Fun))
      this.parser.error(`${sym.name}: not a function`);
    else if (nargs != sym.parms)
      this.parser.error(`${sym.name} arguments: ` +
        `expected ${sym.parms}, specified ${nargs}`);
    else
      sym.call();                                  // call function
  }
  
  // print: 'print' sums;
  // sums: sum [{ ',' sum }];
  // return: 'return' [ sum ];
  // loop: While cmp Do stmts 'od';
  // While: 'while';
  // Do: 'do';
  // select: 'if' cmp Then stmts [ Else stmts ] 'fi';
  // Then: 'then';
  // Else: 'else';
  // cmp: sum rel;
  // rel: eq | ne | gt | ge | lt | le;
  // eq: '=' sum;
  // ne: '<>' sum;
  // gt: '>' sum;
  // ge: '>=' sum;
  // lt: '<' sum;
  // le: '<=' sum;
  // sum: product [{ add | subtract }];
  // add: '+' product;
  // subtract: '-' product;
  // product: signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed: [ '-' ] term;
  // term: input | number | name | '(' sum ')';
  // input: 'input' [ Number ];
  // number: Number;
  
  /** `name: symbol [ args ];` codes variable load, pops context */
  name (sym, args) {
    if (!args)
      if (sym instanceof this.Fun)
        this.parser.error(`${sym.name}: no argument list`);
      else
        sym.load();                           // variable reference
    this.context = null;                             // pop context
  }
  
  /** `symbol: Name;` pushes context, returns symbol */
  symbol (name) {
    let sym = this._find(name, true);
    if (!sym) sym = this._dcl(this._alloc(name));          // patch
    this.context = { symbol: sym };      // push symbol description
    return sym;
  }
}  

/** [Example 7/09](../?eg=07/09): compile global functions with block structure.
    @extends module:Seven~Parameters06 */
class Blocks09 extends Parameters06 {
  /** Describes a function with block structure.
      @class @extends super.Fun
      @property {Block[]} blocks - block stack, [0] is innermost
      @property {number} frameSize - must replace `size`           
      @property {Map} locals - [replace] delegate to blocks
      @property {number} size - [replace] delegate to blocks
      @property {function} push() - add a block
      @property {function} pop() - end a block, maintain size
      @property {function} end() - [extend] pop last block
      @property {function} exit() - [replace] use `frameSize` */
  get Fun () { return this.#Fun ??= class extends super.Fun {
      frameSize = 0;        // because this.size is local to blocks            
      blocks;                // block stack, [0] is innermost block
      get locals () { return this.blocks[0].locals; }
      set locals (locals) {
        try { return this.blocks[0].locals = locals; }
        catch (e) { console.trace(e); throw e; } }
      get size () { return this.blocks[0].size; }
      set size (size) { return this.blocks[0].size = size; }
      
      constructor (owner, name) {        // creates outermost block
        super(owner, name);
        this.blocks = [ new this.owner.Block(0) ];
      }
      push () {           // add block, start in encompassing block
        this.blocks.unshift(
          new this.owner.Block(this.blocks[0].size)
        );
      }      
      pop () {         // remove block, maintain maximum frame size
        this.frameSize =
          Math.max(this.frameSize, this.blocks[0].size);
        if (this.owner.symbols.get('trace')               // trace?
              instanceof this.owner.Var)
          puts(this.blocks[0].toString());
        this.blocks.shift();
      }
      end () {                    // [extend] pop outermost block
        this.pop(); super.end();
      }
      exit () {                        // [replace] uses frameSize
        this.owner.machine.code[this.start] =
          this.owner.machine.ins('Entry', this.parms, this.frameSize);
        this.owner.machine.gen('Exit', this.parms);
        this.owner.machine.gen('Return');
      }    
      toString () {         // [replace] no symbols, show frameSize
        return `function ${this.name} start ${this.start} ` +
          `parms ${this.parms} frame size ${this.frameSize}`;
      }
    };
  }
  #Fun;     

  /** Describes a block of nested symbols.
      @class
      @property {Map} locals - maps names to descriptions.
      @property {number} size - next variable address in block.
      @property {function} toString() - describes as text. */
  get Block () { return this.#Block ??= class {
      locals = new Map();    // maps names in block to descriptions
      size;                       // next variable address in block

      constructor (size) { this.size = size; }

      toString () {
        const names = [];
        this.locals.forEach(sym => names.push(sym.toString()));
        return `block [ ${names.join(', ')} ]`;
      }
    };
  }
  #Block;
  
  /** Replace: searches innermost to outermost blocks and global */
  _find (name, report) {
    let sym;
    try {
      if (this.funct)                  // loop inner to outer block
        this.funct.blocks.forEach(block => {
          sym = block.locals.get(name);
          if (typeof sym != 'undefined') throw sym;
        });
      return sym = this.symbols.get(name);                // global
    } catch (sym) {                             // found in a block
      if (sym instanceof Error) throw sym;      // shouldn't happen
      return sym;
    } finally {
      if (report && !sym)
          this.parser.error(`${name}: undefined`);
    }
  }

  // prog: [ vars ] funs;
  // vars: 'var' names ';';
  // names: Name [{ ',' Name }];
  // funs: { fun };
  // fun: head parms [ block ] ';';
  // head: 'function' Name;
  // parms: '(' [ names ] ')';

  /** `block: begin [ vars ] stmts 'end';` */
  block (b, v, s, e) { this.funct.pop(); }

  /** `begin: 'begin';` */
  begin (b) { this.funct.push(); }

  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | return | block | loop | select;
  // assign: symbol action;
  // action: store | call;
  // store: '=' sum;
  // call: args;
  // args: '(' [ sums ] ')';
  // print: 'print' sums;
  // sums: sum [{ ',' sum }];
  // return: 'return' [ sum ];

  /** `loop: While cmp Do [ vars ] stmts 'od';` */
  loop (While, c, Do, v, s, o) {
    this.funct.pop(); super.loop(While, c, Do);
  }
  
  // While: 'while';

  /** `Do: 'do';` */
  Do () { this.funct.push(); return super.Do(); }

  /** `select: 'if' cmp then [ else ] 'fi';` */
  select(i, c, t, e, f) {
    // select: 'if' cmp Then stmts [ Else stmts ] 'fi';
    super.select(i, c, t, false, e);
  }

  /** `then: Then [ [ vars ] stmts ];` */
  then (t, opt) { this.funct.pop(); return t; }

  /** `else: Else [ vars ] stmts;` */
  else (e, v, s) { this.funct.pop(); return e; }

  /** `Then: 'then';` */
  Then (t) { this.funct.push(); return super.Then(); }

  /** `Else: 'else';` */
  Else (e) { this.funct.push(); return super.Else(); }

  // cmp: sum rel;
  // rel: eq | ne | gt | ge | lt | le;
  // eq: '=' sum;
  // ne: '<>' sum;
  // gt: '>' sum;
  // ge: '>=' sum;
  // lt: '<' sum;
  // le: '<=' sum;
  // sum: product [{ add | subtract }];
  // add: '+' product;
  // subtract: '-' product;
  // product: signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed: [ '-' ] term;
  // term: input | number | name | '(' sum ')';
  // input: 'input' [ Number ];
  // number: Number;
  // name: symbol [ args ];
  // symbol: Name;
}

/** [Example 7/13](../?eg=07/13): nested functions
    @extends module:Seven~Machine06 */
class Machine13 extends Machine06 {
  /** Data memory for nested functions.
      @class @extends super.Memory
      @property {number} dp - display (static link) pointer.
      @property {number[]} frames - [remove]: unused.
      @property {function} toString() - [replace]: uses `dp`. */
  get Memory () {
    return this.#Memory ??= class extends super.Memory {
      dp = 0;                      // display (static link) pointer
      // frames[] is no longer used
      
      toString () {
        let fp = this.fp,                   // begin of (top) frame
          to = this.length,                   // end of (top) frame
          dp = this.dp,                              // static link
          output = []; 
        do {
          if (!dp) fp = 0;                          // global frame
          output.unshift(`${fp}:[ ${this.slice(fp, to).
            map(slot => this.mapSlot(slot)).join(' ')} ]`);
          to = fp;               // end and begin of previous frame
          fp = this[dp - 2];              // previous frame pointer
          dp = this[dp - 1];                // previous static link
        } while (to);
        return output.join(' ');
      }
    };
  }
  #Memory;

  /** `stack: ... arguments old-pc
      -> ... arguments old-pc old-fp old-dp result display locals` */
  Entry (parms, depth, size) {
    return memory => {
      const locals = size - parms - 4 - depth,   // local variables
        fp = memory.length - parms - 1,         // new frame's base
        dp = memory.length + 2;             // new display's bottom
                                     // push old-fp, old-dp, result
      memory.push(memory.fp, memory.dp, 0); 
      if (depth > 1) memory.push(           // push part of display
        ... memory.slice(memory.dp + 1, memory.dp + depth) );
      memory.push(fp);                     // push new frame's base
      if (locals)                    // push local variables if any
        memory.push(... Array(locals).fill(0));
      memory.fp = fp;                           // new dynamic link
      memory.dp = dp;                       // new display's bottom
    };
  }

  /** `stack: ... arguments old-pc old-fp old-dp result display locals
      -> ... result old-pc` */
  Exit (memory) {

    const fp = memory.fp,        // current frame, i.e., @arguments
      dp = memory.dp;             // current display, i.e., @result
    memory.fp = memory[dp - 2];                   // restore old-fp
    memory.dp = memory[dp - 1];                   // restore old-dp
                                    // pop frame, push old-pc result
    memory.splice(fp, Infinity, memory[dp], memory[dp - 3]);
  }
  
  /** `stack: ... -> ... frame[depth][addr]` */
  LoadDP (addr, depth) {
    return memory =>
      memory.push(memory[memory[memory.dp + depth] + addr]);
  }

  /** `stack: ... val -> ... val | frame[depth][addr]: val` */
  StoreDP (addr, depth) {
    return memory => 
      memory[memory[memory.dp+depth] + addr] = memory.at(-1);
  }
}

/** [Example 7/13](../?eg=07/13): add actions and infrastructure to compile nested functions.
    @mixin
*/
const Nest13 = superclass => class extends superclass {
  /** List of inner to outer nested frames, `null` at end.
      @instance
      @memberof module:Seven~Nest13 */
  get functs () { return this.#functs; }  // current function stack
  #functs = [ null ];

  /** Replace: manage stack of functions
      @instance
      @memberof module:Seven~Nest13 */
  get funct () { return this.functs[0]; }
  set funct (sym) {
    if (sym) this.functs.unshift(sym);             // push function  
    else this.functs.shift();                       // pop function
  }

  constructor (parser, machine = new Machine13()) {
    super(parser, machine);
  }

  /** Describes a global or nested variable in {@linkcode module:Seven-Nest13 Nest13}.
      @instance
      @memberof module:Seven~Nest13
      @class @extends super.Var
      @property {number} depth - [extend] `>=1`: nested.
      @property {function} load() - [replace] use `depth`.
      @property {function} store() - [replace] use `depth`
      @property {function} toString() - [replace] show `depth`. */
  get Var () { return this.#Var ??= class extends super.Var {
      load () {                         // [replace] load by depth
        if (!this.depth)                                  // global
          this.owner.machine.gen('Load', this.addr);
        else if (this.depth+1 != this.owner.functs.length)// nested
          this.owner.machine.gen('LoadDP', this.addr, this.depth);
        else                                               // local
          this.owner.machine.gen('LoadFP', this.addr);
      }
      store () {                       // [replace] store by depth
        if (!this.depth)                                  // global
          this.owner.machine.gen('Store', this.addr);
        else if (this.depth+1 != this.owner.functs.length)// nested
          this.owner.machine.gen('StoreDP', this.addr, this.depth);
        else                                               // local
          this.owner.machine.gen('StoreFP', this.addr);
      }
      toString () {
        if (!this.depth) return `${this.name} at ${this.addr}`;
        else return `${this.name} at ${this.addr}d${this.depth}`;
      }
    };
  }
  #Var;
  
  /** Returns new `Var` at next local/global address.
      @instance
      @memberof module:Seven~Nest13 */
  _alloc (name) {
    if (this.funct)                        // create local variable
      return new this.Var(this, name, this.funct.size ++,
        this.funct.depth);
    else                                  // create global variable
      return new this.Var(this, name, this.size ++, 0);
  }  

  /** Describes a nested function with block structure in {@linkcode module:Seven-Nest13 Nest13}.
      @instance
      @memberof module:Seven~Nest13
      @class @extends super.Fun
      @property {number} depth - length of static link
      @property {undefined|Block} scope - `.locals` contains `this`
      @property {function} entry() - [extend] create bypass
      @property {function} setParms() - [extend] room for display
      @property {function} storeOk() - [replace] consider outer functions
      @property {function} store() - [replace] consider `depth`
      @property {function} pop() - [extend] check for undefined functions
      @property {function} exit() - [replace] use `depth`, fix bypass
      @property {function} toString () - [extend] display depth */
  get Fun () { return this.#Fun ??= class extends super.Fun {
      depth;        // length of static link, 1 for global function

      constructor (owner, name) {   // sets depth from owner.functs
        super(owner, name);
        this.depth = owner.functs.length;        // functs[.. null]
      }

      entry () {                   // [extend] make room for bypass
        if (this.depth > 1) {                    // nested function
                                  // remember where this is defined
          this.scope = this.owner.funct.blocks[0];
          if (typeof this.scope.bypass == 'undefined')
            this.scope.bypass =      // make room for bypass branch
              this.owner.machine.code.push(null) - 1;
        }
        super.entry();
      }
      setParms () { // frame: parms, old-pc, old-fp, old-dp, result
        super.setParms();
        this.addr = this.size ++;         // insert slot for old-dp
        this.size += this.depth;         // leave slots for display
      }
      storeOk () {            // [replace] consider outer functions
        if (this.owner.functs.some(f => f == this)) return true;
        this.owner.parser.error(`${this.name}: ` +
          `assigned to outside function`);
        return false;
      }
      store () {                        // [replace] consider depth
        if (this == this.owner.funct)                      // local
          this.owner.machine.gen('StoreFP', this.addr);
        else                                      // outer function
          this.owner.machine.gen('StoreDP', this.addr, this.depth);
      }
      pop () {            // [extend] check for undefined functions
        this.owner._check_defs(this.locals);
        super.pop();
      }
      exit () {               // [replace] uses depth, fixes bypass
        this.owner.machine.code[this.start] =
          this.owner.machine.ins('Entry', this.parms,
            this.depth, this.frameSize);
        this.owner.machine.gen('Exit');      // needs no parms info
        const end = this.owner.machine.gen('Return');
        if (this.scope)                    // need to repair bypass
          this.owner.machine.code[this.scope.bypass] =
            this.owner.machine.ins('Branch', end);
      }    
      toString () {                     // [extend] display depth
        return super.toString() + ` depth ${this.depth}`;
      }
    };
  }
  #Fun;

  /** Describes a block of nested symbols.
      @instance
      @memberof module:Seven~Nest13
      @class Block extends super.Block
      @property {undefined|number} bypass - address of branch to bypass nested function definitions */

  /** Replace: searches blocks, functions, and global.
      @instance
      @memberof module:Seven~Nest13 */
  _find (name, report) {
    let sym;
    try {
      this.functs.forEach(funct => {   // loop inner to outer funct
        if (funct)                     // loop inner to outer block
          funct.blocks.forEach(block => {
            sym = block.locals.get(name);
            if (typeof sym != 'undefined') throw sym;
          });
      });
      return sym = this.symbols.get(name);                // global
    } catch (sym) {                             // found in a block
      if (sym instanceof Error) throw sym;      // shouldn't happen
      return sym;
    } finally {
      if (report && !sym)
          this.parser.error(`${name}: undefined`);
    }
  }

  // prog: [ vars ] funs;
  // vars: 'var' names ';';
  // names: Name [{ ',' Name }];
  // funs: { fun };
  // fun: head parms [ block ] ';';

  /** `head: 'function' Name;` returns function symbol.
      @instance
      @memberof module:Seven~Nest13 */
  head (_, name) {
    let sym = this._find(name);
    try {
      if (sym instanceof this.Fun) {
        if (sym.depth >= this.functs.length) {  // same nesting level
          if (typeof sym.start != 'number') throw true;    // forward
          this.parser.error(`${name}: duplicate`);
        }                      // else define at deeper nesting level
      } else if (sym instanceof this.Var &&     // same nesting level
                   sym.depth >= this.functs.length - 1) 
        this.parser.error(`${name}: used as variable and function`);
      sym = this._dcl(new this.Fun(this, name));       // (re-)define
    } catch (e) { throw e;                        // shouldn't happen
    } finally {
      sym.entry();                // generate code for function entry
      return this.funct = sym;                         // in function
    }
  }
  
  // parms: '(' [ names ] ')';
  
  /** `block: begin body 'end';` [inherit].
      @instance
      @memberof module:Seven~Nest13 */
  block (b, body, e) { super.block(b, undefined, undefined, e); }

  // begin: 'begin';
  // body: [ vars ] [ funs ] stmts;
  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | return | block | loop | select;
  // assign: symbol action;
  // action: store | call;
  // store: '=' sum;
  // call: args;
  // args: '(' [ sums ] ')';
  // print: 'print' sums;
  // sums: sum [{ ',' sum }];
  // return: 'return' [ sum ];

  /** `loop: While cmp Do body 'od';` [inherit]
      @instance
      @memberof module:Seven~Nest13 */
  loop (While, cmp, Do, body, od) {
    super.loop(While, cmp, Do, undefined, undefined, od);
  }

  // While: 'while';
  // Do: 'do';
  // select: 'if' cmp then [ else ] 'fi';
  // then: Then [ body ];
  
  /** `else: Else body;` [inherit]
      @instance
      @memberof module:Seven~Nest13 */
  else (e, b) { return super.else(e, undefined, undefined); }

  // Then: 'then';
  // Else: 'else';
  // cmp: sum rel;
  // rel: eq | ne | gt | ge | lt | le;
  // eq: '=' sum;
  // ne: '<>' sum;
  // gt: '>' sum;
  // ge: '>=' sum;
  // lt: '<' sum;
  // le: '<=' sum;
  // sum: product [{ add | subtract }];
  // add: '+' product;
  // subtract: '-' product;
  // product: signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed: [ '-' ] term;
  // term: input | number | name | '(' sum ')';
  // input: 'input' [ Number ];
  // number: Number;
  // name: symbol [ args ];
  // symbol: Name;
};

export {
  TCheck01,
  TCheck02,
  Machine04,
  Functions04,
  Machine06,
  Parameters06,
  Blocks09,
  Machine13,
  Nest13
};
