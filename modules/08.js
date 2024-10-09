/** This module contains the classes for all examples in chapter eight.
   
    @module Eight
    @author © 2024 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-06-24
  */

import * as Seven from './07.js';

/** [Example 8/01](../?eg=08/01): adds support for global higher-order functions.
    @mixin */
const Machine01 = superclass => class extends superclass {
  /** `stack: ... addr -> ... old-pc | pc: addr`
      @instance
      @memberof module:Eight~Machine01 */
  CallValue (memory) {
    memory.pc = memory.splice(-1, 1, memory.pc)[0];
  }
  /** `stack: ... x-len n*val -> ... n*val x-len`
      @instance
      @memberof module:Eight~Machine01 */
  Rotate (n, len = 1) {
    return memory => memory.push(... memory.splice(- n - len, len));
  }
};

/** [Example 8/01](../?eg=08/01): adds actions and infrastructure to compile global higher-order functions.
    @mixin
*/
const Global01 = superclass => class extends superclass {
  /** Describes a type.
      @class @extends super.Symbol
      @instance
      @memberof module:Eight~Global01
      @property {?Array<String|Type>} parms - null for scalar, else list of parameter types.
      @property {String|Type} returns - null or result type.
      @property {Boolean} isFun - `true` if function type.
      @property {function} toString() - represents as text. */
  get Type () { return this.#Type ??= class extends super.Symbol {
      parms = [];   // list of parameter types, `null` for 'number'
      returns;                                // result type if any
      get isFun () { return this.parms !== null; }

      constructor (owner, name, parms, returns) {
        super(owner, name);
        this.parms = parms; this.returns = returns;
      }
      toString () {
        const name = t => typeof t == 'string' ? t : t.name;
        return `type ${this.name}` +
          (!this.isFun ? '' :
            `(${this.parms.map(name).join(', ')})` +
              (this.returns ? `: ${name(this.returns)}` : ''));
      }
    };
  }
  #Type;

  /** Type table, maps names to descriptions.
      @instance
      @memberof module:Eight~Global01 */
  get typeSymbols () { return this.#typeSymbols; }
  #typeSymbols = new Map();

  /** Predefined type descriptor for `number`.
      @constant {Type}
      @instance
      @memberof module:Eight~Global01 */
  get numberType () { return this.#numberType; }
  #numberType;

  /** Predefined type descriptor for `main (): number`.
      @constant {Type}
      @instance
      @memberof module:Eight~Global01 */
  get mainType () { return this.#mainType; }
  #mainType;

  /** Describes a function in {@linkcode module:Eight~Global01 Global01}.
      @class @extends super.Fun
      @instance
      @memberof module:Eight~Global01
      @property {Type} type - function's type.
      @property {number[]} loads - slots to insert `Push start`.
      @property {function} setParms() - [replace] set/check types.
      @property {function} load() - generates `Push(start)`.
      @property {function} storeOk() - [extend] check type.
      @property {function} end() - [extend] fixes `loads`
      @property {function} toString() - [extend] shows type, if any. */
  get Fun () { return this.#Fun ??= class extends super.Fun {
      type;                                      // function's type
      loads = [];                     // forward references to push
      
      setParms (name) {           // [replace] sets parameter types
        this.parms = this.locals.size;   // may be wrong, see below
        this.size += 2;         // leave room for old pc and old fp
        this.addr = this.size ++;          // leave slot for result
        try {
          const type = this.owner.typeSymbols.get(name);
          if (!type) throw `${name}: not a type`;
          if (!type.isFun) throw `${name}: not a function type`;
          if (this.type && this.type != type)
            throw `${name} ${this.name}: ` +
              `previously declared as ${this.type.name}`;
          if (type.parms.length != this.locals.size)
            throw `${name} ${this.name} arguments: expects ` +
              `${type.parms.length}, receives ${this.locals.size}`;
          this.type = type;
          let n = 0;              // Map.forEach does not provide n
          this.locals.forEach(parm => parm.type = type.parms[n ++]);
        } catch (e) {
          if (e instanceof Error) throw e;      // shouldn't happen
          this.owner.parser.error(e);            // report an error
        }
      }
      load () {                           // generates 'Push start'
        if (typeof this.start == 'number')
          this.owner.machine.gen('Push', this.start);
        else
          this.loads.push(this.owner.machine.code.push(null) - 1);
      }
      storeOk (type) {                      // [extend] checks type
        try {
          if (this.type.returns) {        // return value expected?
            if (!type)                          // no return value?
              throw `must return ${this.type.returns}`;
            else if (this.type.returns != type)      // wrong type?
              throw `expects ${this.type.returns}, not ${type}`;
          } else if (type)            // return value not expected?
            throw  `doesn't return a value`;
          return super.storeOk();               // inside function?
        } catch (e) {
          if (e instanceof Error) throw e;      // shouldn't happen
          this.owner.parser.error(`${this.name}: ${e}`);
          return false;
        }
      }
      end () {                           // [extend] resolves loads
        const push = this.owner.machine.ins('Push', this.start);
        this.loads.forEach(p => this.owner.machine.code[p] = push);
        this.loads.length = 0;
        super.end();
      }
      toString () {                  // [extend] shows type, if any
        return this.type ? `${this.type.name} ${super.toString()}` :
          super.toString();
      }
    };
  }
  #Fun;

  /** Describes a variable in {@linkcode module:Eight~Global01 Global01}.
      @class @extends super.Var
      @instance
      @memberof module:Eight~Global01
      @property {Type} type - variable's type.
      @property {function} storeOk() - [replace] check type.
      @property {function} call() - code call to value
      @property {function} toString() - [extend] show type, if any. */
  get Var () { return this.#Var ??= class extends super.Var {
      type;                                      // variable's type

      storeOk (type) {                      // [replace] check type
        if (this.type == type) return true;
        this.owner.parser.error(`${this.name}: ` +
            `expects ${this.type}, not ${type}`);
        return false;
      }
      
      call () { this.load(); this.owner.machine.gen('CallValue'); }
      
      toString () {                   // [extend] show type, if any
        return this.type ? `${this.type.name} ${super.toString()}` :
          super.toString();
      }
    };
  }
  #Var;

  constructor (parser, machine) {
    super(parser, machine ?? new (Machine01(Seven.Machine06))());
    this.typeSymbols.set('number',
      this.#numberType = new this.Type(this, 'number', null, null));
    this.typeSymbols.set('main',
      this.#mainType =
        new this.Type(this, 'main', [ ], this.numberType));
  }

  /** `prog: [ typedcls ] [ vars ] funs;`
      @instance
      @memberof module:Eight~Global01 */
  prog (t, v, f) { return this.parser.call(this, super.prog, t, f); }

  /** `typedcls: { 'type' typedcl [{ ',' typedcl }] ';' };` checks and translates the types
      @instance
      @memberof module:Eight~Global01 */
  typedcls (some) {
    this.typeSymbols.forEach(sym => {  // check and translate types
      if (sym.isFun) {                       // avoid non-functions
        const check = name => { // return type description for name
          const type = this.typeSymbols.get(name);
          if (type) return type;
          this.parser.error(`${name}: not a type`);
          return this.numberType;                          // patch
        };
        sym.parms = sym.parms.map(check);     // convert to symbols
        if (typeof sym.returns == 'string') 
          sym.returns = check(sym.returns);
      }
    });
  }

  /** `typedcl: Name '(' [ types ] ')' [ ':' typename ];` declares
      @instance
      @memberof module:Eight~Global01 */
  typedcl (name, lp, types, rp, returns) {
    if (this.typeSymbols.get(name))
      this.parser.error(`${name}: duplicate type`);
    else
      this.typeSymbols.set(name, new this.Type(this, name,
        types ? types[0] : [], returns ? returns[1] : null));
  }

  /** `types: typename [{ ',' typename }];` returns list
      @instance
      @memberof module:Eight~Global01 */
  types (typename, many) {
    return [ typename ].
      concat(many ? many[0].map(list => list[1]) : []);
  }

  /** `typename: Name | 'number';` returns name or 'number'
      @instance
      @memberof module:Eight~Global01 */
  typename (name) { return name; }

  // vars: 'var' varname [{ ',' varname }] ';';

  /** `varname: Name [ ':' type ];` declares the name.
      Can be used with one or two arguments, defaults to `number`.
      @instance
      @memberof module:Eight~Global01 */
  varname (...arg) {
    let [ name, type ] = arg;
    type = type ? type[1] : this.numberType;
    this._dcl(this._alloc(name), true).type = type;
  }

  /** `type: Name | 'number';` returns type symbol
      @instance
      @memberof module:Eight~Global01 */
  type (name) {
    const type = this.typeSymbols.get(name);
    if (type) return type;
    this.parser.error(`${name}: not a type`);
    return this.numberType;
  }

  // names: Name [{ ',' Name }];
  // funs: { fun };
  // fun: head parms [ block ] ';';
  // head: 'function' Name;

  /** `parms: '(' [ names ] ')' [ ':' Name ];` declares
      @instance
      @memberof module:Eight~Global01 */
  parms (lp, names, rp, name) {   // funtion's name is default type
    this.funct.setParms(name ? name[1] : this.funct.name);
  }

  // block: begin [ vars ] stmts 'end';
  // begin: 'begin';
  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | return | block | loop | select;
  // assign: symbol action;
  // action: store | call;

  /** `store: '=' sum;` expects context, codes assignment
      @instance
      @memberof module:Eight~Global01 */
  store (_, sum) {
    if (this.context.symbol.storeOk(sum))
      this.context.symbol.store();
  }

  // call: { args };

  /** `args: '(' [ sums ] ')';` codes call, chains context
      @instance
      @memberof module:Eight~Global01 */
  args (lp, sums, rp) {
    const args = sums === null ? [ ] : sums[0];    // list of types
    const type = 'type' in this.context ?   // chained call if true
      this.context.type : this.context.symbol.type;
    try {
      if (!type) throw 'too many argument lists';
      if (!type.isFun) throw 'not a function';
      if (type.parms.length != args.length)
        throw `arguments: ${type.parms.length} expected, ` +
          `${args.length} specified`;
      const errors = [];
      type.parms.forEach(
        (parm, n) => { if (parm != args[n]) errors.push(
          `argument ${n+1} is ${args[n].toString()}, ` +
          `not ${parm.toString()}`
        ); });
      if (errors.length) throw errors.join('; ');    
      if ('type' in this.context) {                 // chained call
        this._lift(args);   // move function address past arguments
        this.machine.gen('CallValue');     // call address on stack
      } else this.context.symbol.call();  // call function/variable 
    } catch (e) {
      if (e instanceof Error) throw e;         // should not happen
      this.parser.error(`call to ${this.context.symbol.name}: ${e}`);
    }
    this.context.type = type ? type.returns : null;  // result type
  }
  
  /** Move function address past arguments to the top of the stack.
      @param {Type[]} args - list of argument types.
      @instance
      @memberof module:Eight~Global01 */
  _lift (args) {
    if (args.length) this.machine.gen('Rotate', args.length);
  }

  /** `print: 'print' sums;` checks types
      @instance
      @memberof module:Eight~Global01 */
  print (p, sums) {
    if (!sums.every(sum => sum == this.numberType))
      this.parser.error('can only print numbers');
    this.parser.call(this, super.print, p, sums.length);
  }

  /** `sums: sum [{ ',' sum }];` returns list of types
      @instance
      @memberof module:Eight~Global01 */
  sums (sum, many) {
    return [ sum ].
      concat(many ? many[0].map(list => list[1]) : []);
  }

  /** `return: 'return' [ sum ];`
      @instance
      @memberof module:Eight~Global01 */
  return (_, sum) {
    if (this.funct.storeOk(sum ? sum[0] : null))
      if (sum)
        (this.funct.store(), this.machine.gen('Pop'));
    this.funct.return();
  }

  // loop: While cmp Do [ vars ] stmts 'od';
  // While: 'while';
  // Do: 'do';
  // select: 'if' cmp then [ else ] 'fi';
  // then: Then [ [ vars ] stmts ];
  // else: Else [ vars ] stmts;
  // Then: 'then';
  // Else: 'else';

  /** `cmp: sum rel;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  cmp (sum, _) {
    if (sum != this.numberType)
      this.parser.error(`cannot compare ${sum.toString()}`);
  }

  // rel: eq | ne | gt | ge | lt | le;

  /** `eq: '=' sum;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  eq (_, sum) {
    if (sum != this.numberType)
      this.parser.error(`cannot apply '=' to ${sum.toString()}`);
    else this.parser.call(this, super.eq);
  } 

  /** `ne: '<>' sum;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  ne (_, sum) {
    if (sum != this.numberType)
      this.parser.error(`cannot apply '<>' to ${sum.toString()}`);
    else this.parser.call(this, super.ne);
  } 

  /** `gt: '>' sum;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  gt (_, sum) {
    if (sum != this.numberType)
      this.parser.error(`cannot apply '>' to ${sum.toString()}`);
    else this.parser.call(this, super.gt);
  } 

  /** `ge: '>=' sum;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  ge (_, sum) {
    if (sum != this.numberType)
      this.parser.error(`cannot apply '>=' to ${sum.toString()}`);
    else this.parser.call(this, super.ge);
  } 

  /** `lt: '<' sum;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  lt (_, sum) {
    if (sum != this.numberType)
      this.parser.error(`cannot apply '<' to ${sum.toString()}`);
    else this.parser.call(this, super.lt);
  } 

  /** `le: '<=' sum;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  le (_, sum) {
    if (sum != this.numberType)
      this.parser.error(`cannot apply '<=' to ${sum.toString()}`);
    else this.parser.call(this, super.le);
  } 

  /** `sum: product [{ add | subtract }];` returns product
      @instance
      @memberof module:Eight~Global01 */
  sum (product, many) {
    if (many && product != this.numberType)
      this.parser.error(`cannot apply '+' or '-' ` +
        `to ${product.toString()}`);
    return product;  
  }

  /** `add: '+' product;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  add (_, product) {
    if (product != this.numberType)
      this.parser.error(`cannot apply '+' to ${product.toString()}`);
    else this.parser.call(this, super.add);
  }

  /** `subtract: '-' product;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  subtract (_, product) {
    if (product != this.numberType)
      this.parser.error(`cannot apply '-' to ${product.toString()}`);
    else this.parser.call(this, super.subtract);
  }

  /** `product: signed [{ multiply | divide }];` returns signed
      @instance
      @memberof module:Eight~Global01 */
  product (signed, many) {
    if (many && signed != this.numberType)
      this.parser.error(`cannot apply '*' or '/' ` +
        `to ${signed.toString()}`);
    return signed;  
  }

  /** `multiply: '*' signed;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  multiply (_, signed) {
    if (signed != this.numberType)
      this.parser.error(`cannot apply '*' to ${signed.toString()}`);
    else this.parser.call(this, super.multiply);
  }

  /** `divide: '/' signed;` checks for number
      @instance
      @memberof module:Eight~Global01 */
  divide (_, signed) {
    if (signed != this.numberType)
      this.parser.error(`cannot apply '/' to ${product.toString()}`);
    else this.parser.call(this, super.divide);
  }

  /** `signed: [ '-' ] term;` checks for number, returns term 
      @instance
      @memberof module:Eight~Global01 */
  signed (minus, term) {
    if (minus && term != this.numberType)
      this.parser.error(`cannot apply '-' to ${term.toString()}`);
    else this.parser.call(this, super.signed, minus, term);
    return term;
  }

  /** `term: input | number | name | '(' sum ')';` returns type
      @instance
      @memberof module:Eight~Global01 */
  term (...val) { return val.length > 1 ? val[1] : val[0]; }

  /** `input: 'input' [ Number ];` returns `this.numberType
      @instance
      @memberof module:Eight~Global01 */
  input (i, number) {
    this.parser.call(this, super.input, i, number); return this.numberType;
  }

  /** `number: Number;` returns `this.numberType`
      @instance
      @memberof module:Eight~Global01 */
  number (number) { 
    this.parser.call(this, super.number, number); return this.numberType;
  }

  /** `name: symbol [{ args }];`
      @instance
      @memberof module:Eight~Global01 */
  name (sym, args) {
    const context = this.context; this.context = null;
    if (args) return context.type;
    sym.load();
    return sym.type;
  }

  // symbol: Name;
};

/** [Example 8/08](../?eg=08/08): adds support for nested functions as arguments.
    @mixin */
const Machine08 = superclass => class extends superclass {
  /** `stack: ... arguments dp old-pc  
      -> ... arguments old-pc old-fp old-dp result display locals`
      @param {number} args - size of argument values.
      @param {number} depth - number of display entries.
      @param {number} vars - size of local variables.
      @instance
      @memberof module:Eight~Machine08 */
  Entry (args, depth, vars) {
    return memory => {
      const fp = memory.length - args - 2,        // next memory.fp
        dp = memory.splice(-1, 1, memory.pop(),    // retain old-pc
               memory.fp, memory.dp, 0  // push fp, dp, result slot
          )[0];                         // extract incoming display
      memory.fp = fp;                           // new frame's base
      memory.dp = memory.length - 1;          // new display's base
                             // copy incoming display up to depth-1
      memory.push(... memory.slice(dp + 1, dp + depth),
        memory.fp,                              // append new frame
        ... Array(vars).fill(0));     // initialize local variables
    };
  }
  /** `stack: ... arguments old-pc old-fp old-dp result display locals
      -> ... result old-pc`
      @param {number} args - size of argument values.
      @instance
      @memberof module:Eight~Machine08 */
  Exit (args) {
    return memory => {
      const fp = memory.fp;                        // current frame
      memory.splice(fp, args,             // remove argument values
        memory[fp + args + 3]);                    // insert result      
                           // restore old fp dp, free rest of frame
      [ memory.fp, memory.dp ] = memory.splice(fp + 2, Infinity);
    };
  }
  /** `stack: ... -> ... dp`
      @instance
      @memberof module:Eight~Machine08 */
  PushDP (memory) {
    memory.push(memory.dp);
  }
};

/** [Example 8/08](../?eg=08/08): adds actions and infrastructure to compile nested functions as arguments.
    Requires {@linkcode module:Seven~Nest13 Nest13} and {@linkcode module:Eight~Global01 Global01}.
    @mixin */
const Pass08 = superclass => class extends superclass {
  /** Describes a variable in {@linkcode module:Eight~Pass08 Pass08}
      @class @extends super.Var
      @instance
      @memberof module:Eight~Pass08
      @property {function} load() - [replace] for function slots.
      @property {function} storeOk(type) - [extend] false for function value.
*/
  get Var () { return this.#Var ??= class extends super.Var {
      
      load () {       // [replace] load two slots for function type
        const load = addr => {
          if (!this.depth)                                // global
            this.owner.machine.gen('Load', addr);
          else if (this.depth+1 != this.owner.functs.length)
                                                          // nested
            this.owner.machine.gen('LoadDP', addr, this.depth);
          else this.owner.machine.gen('LoadFP', addr);     // local
        };
        load(this.addr);              // top:value or below:display
        if (this.type.isFun) load(this.addr + 1);  // + top:address
      }
      
      storeOk (type) {    // [extend] read-only function parameters
        if (this.type?.isFun) {
          this.owner.parser.error(`${this.name}: read only parameter`);
          return false;
        }
        return super.storeOk(type);      
      }
    };
  }
  #Var;

  /** Describes a function in {@linkcode module:Eight~Pass08 Pass08}.
      @class @extends super.Fun
      @instance
      @memberof module:Eight~Pass08
      @property {number} parms - [replace] memory slots for arguments.
      @property {function} setParms() - [replace] function values take 2 slots.
      @property {function} call() - [extend] `PushDP`, `Call(addr)`.
      @property {function} load() - [extend] `PushDP`, `Push(start)`.
      @property {function} exit() - [replace] `Entry`, `Exit`. */
  get Fun () { return this.#Fun ??= class extends super.Fun {

      setParms (name) {           // [replace] sets parameter types
        try {
          const type = this.owner.typeSymbols.get(name);
          if (!type) throw `${name}: not a type`;
          if (!type.isFun) throw `${name}: not a function type`;
          if (this.type && this.type != type)
            throw `${name} ${this.name}: ` +
              `previously declared as ${this.type.name}`;
          if (type.parms.length != this.locals.size)
            throw `${name} ${this.name} arguments: expects ` +
              `${type.parms.length}, receives ${this.locals.size}`;
          this.type = type;
          this.size = 0;          // parameter addresses start at 0
          let n = 0;              // Map.forEach does not provide n
          this.locals.forEach(parm => {
            parm.addr = this.size ++;      // set parameter address
            parm.type = type.parms[n ++];     // set parameter type
            if (parm.type.isFun) ++ this.size; // function argument
          });
          this.parms = this.size;                 // argument slots
          this.size += 3;        // room for old pc, old fp, old dp
          this.addr = this.size;               // address of result
          this.size += 1 + this.depth;  // room for result, display
        } catch (e) {
          if (e instanceof Error) throw e;      // shouldn't happen
          this.owner.parser.error(e);            // report an error
        }
      }
      
      call () {                       // [extend] generate 'PushDP'
        this.owner.machine.gen('PushDP'); super.call();
      }
      
      load () {                       // [extend] generate 'PushDP'
        this.owner.machine.gen('PushDP'); super.load();
      }
      
      exit () {                    // [replace] new 'Entry', 'Exit'
        this.owner.machine.code[this.start] =
          this.owner.machine.ins('Entry', this.parms,  // arguments
            this.depth,                  // display, variable slots
            this.frameSize - (this.parms + 4 + this.depth));
        this.owner.machine.gen('Exit', this.parms);
        const end = this.owner.machine.gen('Return');
        if (this.scope)                    // need to repair bypass
          this.owner.machine.code[this.scope.bypass] =
            this.owner.machine.ins('Branch', end);
      }    
    };
  }
  #Fun;

  constructor (parser, machine) {
    super(parser, machine ?? new (Machine08(Machine01(Seven.Machine13)))());
  }

  /** [Replace] Need `PushDP` for `main`.
      @param {Fun} main - describes `main()`.
      @instance
      @memberof module:Eight~Pass08 */
  _startup (main) {
    for (let p = 0; p < main.parms; ++ p)  // push arguments if any
      this.machine.gen('Push', 0);
    this.machine.gen('PushDP');             // push display pointer
    this.machine.gen('Call', main.start);     // call main function
    this.machine.gen('Print', 1);                  // print and pop
  }  

  // prog: [ typedcls ] [ vars ] funs;
  // typedcls: { 'type' typedcl [{ ',' typedcl }] ';' };
  // typedcl: Name '(' [ types ] ')' [ ':' 'number' ];
  // types: typename [{ ',' typename }];
  // typename: Name | 'number';
  // vars: 'var' varname [{ ',' varname }] ';';
  // varname: Name;
  // funs: { fun };
  // fun: head parms [ block ] ';';
  // head: 'function' Name;
  // parms: '(' [ names ] ')' [ ':' Name ];
  // names: Name [{ ',' Name }];
  // block: begin body 'end';
  // body: [ vars ] [ funs ] stmts;
  // begin: 'begin';
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
  // loop: While cmp Do body 'od';
  // While: 'while';
  // Do: 'do';
  // select: 'if' cmp then [ else ] 'fi';
  // then: Then [ body ];
  // else: Else body;
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

/** [Example 8/14](../?eg=08/14): adds support for garbage-collected frames,
    cannot be mixed with {@linkcode module:Eight~Machine08 Machine08}.
    @mixin */
const Machine14 = superclass => class extends superclass {
  /** Data memory for nested functions as arguments
      @class @extends super.Memory
      @instance
      @memberof module:Eight~Machine14
      @property {?Array} fp - current frame
      @property {number} dp - no longer used
      @property {number} id - current tag for frames (trace)
      @property {number} newId - new tag for frames (trace)
      @property {?Array} dirty - changed frame (trace)
      @property {function} toString() - [replace] interpret `dirty` frame */
  get Memory () {
    return this.#Memory ??= class extends super.Memory {
      get newId () { ++ this.#id; return this.id; }
      get id () {          // returns a letter or a sequence number
        return this.#id <= 26 ? String.fromCharCode(96 + this.#id) :
          this.#id <= 52 ? String.fromCharCode(64 + this.#id - 26) :
          String(this.#id - 52);
      }
      #id = 0;                                  // current uniqe id
      dirty = null;                        // frame to be displayed
                                                    // no frame yet
      constructor (...args) { super(...args); this.fp = null; }
      
      toString () {      // [replace] global memory and dirty frame
        const dump = slot =>
          slot === null ? 'null' :
          slot instanceof Array ?
            'id' in slot ? `${slot.id}:[]` : '[?]' :
          slot;
        let result = 'mem:[ ' + this.map(dump).join(' ') + ' ] ' +
                     `fp: ${dump(this.fp)}`;
        if (this.dirty) {
          result += ` ${this.dirty.id}:[ ` +
                      this.dirty.map(dump).join(' ') + ' ]';
          this.dirty = null;
        }
        return result;
      }
    };
  }
  #Memory;

  /** `stack: ... arguments fp old-pc  
      -> ... | frame: old-pc old-fp display result arguments locals`
      @param {number} args - size of argument values.
      @param {number} depth - number of display entries.
      @param {number} result - size of result value.
      @param {number} vars - size of local variables.
      @instance
      @memberof module:Eight~Machine14 */
  Entry (args, depth, result, vars) {
    return memory => {
      const frame = [ memory.pop(), memory.fp ];  // old-pc, old-fp
      frame.id = memory.newId;                   // label new frame
      if (depth > 1)     // push (part of) incoming display, if any
        frame.push(... memory.pop().slice(1 + 1, 1 + depth));
      else memory.pop();                               // pop frame
      frame.push(frame);                   // push new frame's base
      frame.push(... Array(result).fill(0));   // push result value
      if (args)                          // move arguments to frame
        frame.push(... memory.splice(- args, Infinity));
      if (vars)                           // create local variables
        frame.push(... Array(vars).fill(0));
      memory.dirty = memory.fp = frame;                   // new fp
    };
  }
  
  /** `stack: ... | frame: old-pc old-fp display result ...  
      -> ... result old-pc | fp: old-fp | frame unchanged`
      @param {number} depth - number of display entries.
      @param {number} result - size of result value.
      @instance
      @memberof module:Eight~Machine14 */
  Exit (depth, result) {
    return memory => {
      memory.push(                                   // push result
        ... memory.fp.slice(2 + depth, 2 + depth + result),
        memory.fp[0]);                               // push old pc
      memory.fp = memory.fp[1];               // set previous frame
    };
  }

  /** `stack: ... -> ... frame[depth][addr]`
      @instance
      @memberof module:Eight~Machine14 */
  LoadGC (addr, depth) {
    return memory => memory.push(memory.fp[1 + depth][addr]);
  }

  /** `stack: ... val -> ... val | frame[depth][addr]: val`
      @instance
      @memberof module:Eight~Machine14 */
  StoreGC (addr, depth) {
    return memory =>
      (memory.dirty = memory.fp[1 + depth])[addr] = memory.at(-1);
  }

  /** `stack: ... -> ... fp`
      @instance
      @memberof module:Eight~Machine14 */
  PushFP (memory) {
    memory.push(memory.fp);
  }
};

/** [Example 8/14](../?eg=08/14): adds actions and infrastructure to compile nested functions
    as first-order values.
    Requires {@linkcode module:Seven~Nest13 Nest13} and {@linkcode module:Eight~Global01 Global01},
    cannot be mixed with {@linkcode module:Eight~Pass08 Pass08}.
    @mixin */
const First14 = superclass => class extends superclass {
  /** Describes a variable in {@linkcode module:Eight~First14 First14}.
      @class @extends super.Var
      @instance
      @memberof module:Eight~First14
      @property {function} load() - [replace] local/global and function slots
      @property {function} store() - [replace] local/global and function slots */
  get Var () { return this.#Var ??= class extends super.Var {
      load () {               // [replace] garbage-collected frames
        const load = addr => {
          if (this.depth)                                  // local
            this.owner.machine.gen('LoadGC', addr, this.depth);
          else                                            // global
            this.owner.machine.gen('Load', addr);
        };
        load(this.addr);              // top:value or below:display
        if (this.type.isFun) load(this.addr + 1);  // + top:address
      }
            
      store () {              // [replace] garbage-collected frames
        const store = addr => {
          if (this.depth)                                  // local
            this.owner.machine.gen('StoreGC', addr, this.depth);
          else                                            // global
            this.owner.machine.gen('Store', addr);
        };
        if (this.type.isFun) {
          store(this.addr + 1);                      // top:address
          this.owner.machine.gen('Rotate', 1);
          store(this.addr);                        // below:display
          this.owner.machine.gen('Rotate', 1);
        } else store(this.addr);                       // top:value 
      }
    };
  }
  #Var;
  
  /** Describes a function in {@linkcode module:Eight~First14 First14}.
      @class @extends super.Fun
      @instance
      @memberof module:Eight~First14
      @property {number} parms - [replace] memory slots for arguments.
      @property {function} setParms() - [replace] function values take 2 slots
        similar to {@linkcode module:Eight~Pass08#Fun Pass08.Fun.setParms()}.
      @property {function} call() - [extend] `PushFP`, `Call(addr)`.
      @property {function} load() - [extend] `PushFP`, `Push(start)`.
      @property {function} store() - [replace] `StoreGC`.
      @property {function} exit() - [replace] `Entry`, `Exit`. */
  get Fun () { return this.#Fun ??= class extends super.Fun {
    
      setParms (name) {           // [replace] sets parameter types
        try {
          const type = this.owner.typeSymbols.get(name);
          if (!type) throw `${name}: not a type`;
          if (!type.isFun) throw `${name}: not a function type`;
          if (this.type && this.type != type)
            throw `${name} ${this.name}: ` +
              `previously declared as ${this.type.name}`;
          if (type.parms.length != this.locals.size)
            throw `${name} ${this.name} arguments: expects ` +
              `${type.parms.length}, receives ${this.locals.size}`;
          this.type = type;
          this.size = 2 + this.depth;      // old-pc old-fp display
          this.addr = this.size ++;                       // result
          if (this.type.returns && this.type.returns.isFun)
            ++ this.size;                        // function result
          this.parms = this.size;             // begin of arguments
          let n = 0;              // Map.forEach does not provide n
          this.locals.forEach(parm => {
            parm.addr = this.size ++;      // set parameter address
            parm.type = type.parms[n ++];     // set parameter type
            if (parm.type.isFun)
               ++ this.size;                   // function argument
          });
          this.parms = this.size - this.parms;    // argument slots
        } catch (e) {
          if (e instanceof Error) throw e;      // shouldn't happen
          this.owner.parser.error(e);            // report an error
        }
      }
    
      call () {                       // [extend] generate 'PushFP'
        this.owner.machine.gen('PushFP'); super.call();
      }
      
      load () {                       // [extend] generate 'PushFP'
        this.owner.machine.gen('PushFP'); super.load();
      }
      
      store () {              // [replace] garbage-collected frames
        const store = addr =>
          this.owner.machine.gen('StoreGC', addr, this.depth);
        if (this.type.returns && this.type.returns.isFun) {
          store(this.addr + 1);                      // top:address
          this.owner.machine.gen('Rotate', 1);
          store(this.addr);                        // below:display
          this.owner.machine.gen('Rotate', 1);
        } else store(this.addr);                       // top:value 
      }

      exit () {                    // [replace] new 'Entry', 'Exit'
        const result =
          this.type.returns && this.type.returns.isFun ? 2 : 1;
        this.owner.machine.code[this.start] =
          this.owner.machine.ins('Entry', this.parms,  // arguments
            this.depth, result,          // display, result, locals
            this.frameSize - (2 + this.depth + result + this.parms));
        this.owner.machine.gen('Exit', this.depth, result);
        const end = this.owner.machine.gen('Return');
        if (this.scope)                    // need to repair bypass
          this.owner.machine.code[this.scope.bypass] =
            this.owner.machine.ins('Branch', end);
      }    
    };
  }
  #Fun;

  constructor (parser, machine) {
    super(parser, machine ?? new (Machine14(Machine01(Seven.Machine13)))());
  }

  /** [Replace] Need `PushFP` for `main`.
      @param {Fun} main - describes `main()`.
      @instance
      @memberof module:Eight~First14 */
  _startup (main) {
    for (let p = 0; p < main.parms; ++ p)  // push arguments if any
      this.machine.gen('Push', 0);
    this.machine.gen('PushFP');               // push frame pointer
    this.machine.gen('Call', main.start);     // call main function
    if (!main.type.returns?.isFun)      // only print number result
      this.machine.gen('Print', 1);                // print and pop
  }  

  // prog: [ typedcls ] [ vars ] funs;
  // typedcls: { 'type' typedcl [{ ',' typedcl }] ';' };
  // typedcl: Name '(' [ types ] ')' [ ':' typename ];
  // types: typename [{ ',' typename }];
  // typename: Name | 'number';
  // vars: 'var' varname [{ ',' varname }] ';';
  
  /** `varname: Name [ ':' type ];` [extend] two slots for function value.
      @instance
      @memberof module:Eight~First14 */
  varname (name, type) {
    super.varname(name, type);       // create single slot variable
    if (type?.[1].isFun)             // add slot for function value
      if (this.funct) this.funct.size ++;                  // local
      else this.size ++;                                  // global
  }
  
  // type: Name | 'number';
  // funs: { fun };
  // fun: head parms [ block ] ';';
  // head: 'function' Name;
  // parms: '(' [ names ] ')' [ ':' Name ];
  // names: Name [{ ',' Name }];
  // block: begin body 'end';
  // body: [ vars ] [ funs ] stmts;
  // begin: 'begin';
  // stmts: stmt [{ ';' stmt }];
  // stmt: assign | print | return | block | loop | select;
  // assign: symbol action;
  // action: store | call;
  
  /** `store: '=' sum;` [extend] pops extra slot for function value.
      @instance
      @memberof module:Eight~First14 */
  store (_, sum) {
    super.store(_, sum);
    if (sum.isFun) this.machine.gen('Pop');
  }
  
  /** `call: { args };` pops extra slot for function value.
      @instance
      @memberof module:Eight~First14 */
  call (_) {
    if (this.context.type && this.context.type.isFun)
      this.machine.gen('Pop');
  }
  
  // args: '(' [ sums ] ')';

  /** [replace] need two slots for function argument and value.
      @param {Type[]} args - list of argument types.
      @instance
      @memberof module:Eight~First14 */
  _lift (args) {
    if (args.length)
      this.machine.gen('Rotate',
        args.reduce(
          (length, type) => length + (type.isFun ? 2 : 1), 0),
        2);
  }
  
  // print: 'print' sums;
  // sums: sum [{ ',' sum }];

  /** `return: 'return' [ sum ];` [extend] pops extra slot for function value.
      @instance
      @memberof module:Eight~First14 */
  return (_, sum) {
    if (this.funct.storeOk(sum ? sum[0] : null))
      if (sum) {
        this.funct.store();
        this.machine.gen('Pop');
        if (sum[0].isFun) this.machine.gen('Pop');
      }
    this.funct.return();
  }
  
  // loop: While cmp Do body 'od';
  // While: 'while';
  // Do: 'do';
  // select: 'if' cmp then [ else ] 'fi';
  // then: Then [ body ];
  // else: Else body;
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
  // name: symbol [{ args }];
  // symbol: Name;
};

export {
  Machine01,
  Global01,
  Machine08,
  Pass08,
  Machine14,
  First14
};
