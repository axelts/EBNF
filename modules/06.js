/** This module contains the classes for all examples in chapter six.

    @module Six
    @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-02-27
*/

/** [Example 6/02](../?eg=06/02): actions to support
    signed numbers.
*/
class Eval02 {
  // list:     sum [{ ',' sum }];
  
  /** `sum: product [{ add | subtract }];` */
  sum (product, many) { puts(g.dump(product)); }

  // add:      '+' product;
  // subtract: '-' product;
  // product:  signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide:   '/' signed;

  /** `signed: [ '-' ] term;` */
  signed (minus, term) { return minus ? - term : term; }

  /** `term: number | '(' sum ')';` */
  term (...val) { return val.length == 1 ? val[0] : val[1]; }

  /** `number: Number;` */
  number (number) { return parseInt(number, 10); }
}

/** [Example 6/03](../?eg=06/03): adds actions to support multiplication and division. 
    @extends module:Six~Eval02 */
class Eval03 extends Eval02 {
  // list:     sum [{ ',' sum }];
  // sum:      product [{ add | subtract }];
  // add:      '+' product;
  // subtract: '-' product;

  /** `product: signed [{ multiply | divide }];` */
  product (signed, many) {
    return (many ? many[0] : [ ]).
      reduce((product, list) => list[0](product), signed);
  }

  /** `multiply: '*' signed;` */
  multiply (_, right) { return left => left * right; }

  /** `divide: '/' signed;` */
  divide (_, right) { return left => left / right; }

  // signed:   [ '-' ] term;
  // term:     number | '(' sum ')';
  // number:   Number;
}

/** [Example 6/04](../?eg=06/04): adds actions to support lists of numerical expressions.
    @extends module:Six~Eval03 */
class Eval04 extends Eval03 {
  /** `list: sum [{ ',' sum }];` */
  list (sum, many) {
    puts(sum);
    if (many) many[0].forEach(seq => puts(seq[1]));
  }

  /** `sum: product [{ add | subtract }];` */
  sum (product, many) {
    return this.product(product, many);
  }

  /** `add: '+' product;` */
  add (_, right) { return left => left + right; }

  /** `subtract: '-' product;` */
  subtract (_, right) { return left => left - right; }

  // product:  signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide:   '/' signed;
  // signed:   [ '-' ] term;
  // term:     number | '(' sum ')';
  // number:   Number;
}

/** [Example 6/05](../?eg=06/05): adds actions to support variable names.
    @extends module:Six~Eval04 */
class Functions05 extends Eval04 {
  #parser;                                    // for error messages
  get parser () { return this.#parser; }

  constructor (parser) { super(); this.#parser = parser; }
  
  // list: sum [{ ',' sum }];
  
  /** `sum: 'let' Name '=' sum | product [{ add | subtract }];` */
  // arg          [1]      [3]   [0]     [1]
  sum (... arg) {
    if (arg.length < 4) return this.parser.call(this, super.sum, arg[0], arg[1]);
    if (!this.memory) this.memory = { };
    return this.memory[arg[1]] = arg[3];
  }
  
  // add: '+' product;
  // subtract: '-' product;
  // product:  signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed: [ '-' ] term;
  // term: number | name | '(' sum ')';
  // number: Number;

  /** `name: Name;` returns value or `0` */
  name (name) {
    if (!this.memory) this.memory = { };
    return name in this.memory ? this.memory[name] : 0;
  }
}

/** [Example 6/06](../?eg=06/06): changes actions to support
    returning names, numbers, and input as functions.
    @extends module:Six~Functions05 */
class Functions06 extends Functions05 {
  // sum: product [{ add | subtract }];
  // add: '+' product;
  // subtract: '-' product;
  // product: signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide: '/' signed;
  // signed: [ '-' ] term;
  // term: input | number | name | '(' sum ')';

  /** `input: 'input' [ Number ];` returns fct */
  input (_, number) {
    const dflt = String(number !== null ? number[0] : 0);
    return () => parseInt(prompt('input', dflt), 10);
  }

  /** `number: Number;` returns fct */
  number (number) {
    const result = parseInt(number, 10);
    return () => result;
  }

  /** `name: Name;` returns fct */
  name (name) {
    return memory => name in memory ? memory[name] : 0;
  }
}

/** [Example 6/07](../?eg=06/07): changes remaining actions to support
    returning arithmetic expressions as functions.
    @extends module:Six~Functions06 */
class Functions07 extends Functions06 {
  /** `list: sum [{ ',' sum }];` returns executable  */
  list (sum, many) {
    const list = [ sum ].
      concat(many ? many[0].map(seq => seq[1]) : [ ]);
    return () => {
      const memory = { };
      puts(... list.map(fct => fct(memory)));
    }
  }

  /** `sum: 'let' Name '=' sum | product [{ add | subtract }];` */
  //              [1]      [3]   [0]     [1]
  sum (... arg) {
    if (arg.length == 4)
      return memory => memory[arg[1]] = arg[3](memory);
    else
      return this.product(arg[0], arg[1]);
  }

  /** `add: '+' product;` returns fct for composition */
  add (_, right) {
    return left => memory => left(memory) + right(memory);
  }

  /** `subtract: '-' product;` returns fct for composition */
  subtract (_, right) {
    return left => memory => left(memory) - right(memory);
  }

  /** `product: signed [{ multiply | divide }];` returns fct */
  product (signed, many) {
    const c = (a, b) => b(a);  // function composition
    return (many ? many[0] : []).
      reduce((product, list) => c(product, list[0]), signed);
  }

  /** `multiply: '*' signed;` returns fct for composition */
  multiply (_, right) {
    return left => memory => left(memory) * right(memory);
  }

  /** `divide: '/' signed;` returns fct for composition */
  divide (_, right) {
    return left => memory => left(memory) / right(memory);
  }

  /** `signed: [ '-' ] term;` returns fct */
  signed (minus, term) {
    return minus ? memory => - term(memory) : term;
  }

  // term: input | number | name | '(' sum ')';
  // input: 'input' [ Number ];
  // number: Number;
  // name: Name;
}

/** [Example 6/08](../?eg=06/08): actions to convert to postfix. */
class Postfix08 {
  // sum: product [{ add | subtract }];
  
  /** `add: '+' right;` */
  add (_, r) { puts('add'); }

  /** `subtract: '-' right;` */
  subtract (_, r) { puts('subtract'); } 
  
  // product: signed [{ multiply | divide }];

  /** `multiply: '*' right;` */
  multiply (_, r) { puts('multiply'); }

  /** `divide: '/' signed;` */
  divide (_, r) { puts('divide'); } 

  /** `signed: [ '-' ] term;` */
  signed (minus, t) {  if (minus) puts('minus'); }

  // term: input | number | name | '(' sum ')';

  /** `input: 'input' [ Number ];` */
  input (i, n) { puts('input'); }

  /** `number: Number;` */
  number (number) { puts(number); }

  /** `name: Name;` */
  name (name) { puts(name); } 
}

/** [Example 6/09](../?eg=06/09): stack machine. */
class Machine09 {
  code = [ ];                             // holds the instructions
  
  /** Represents `code` as text */
  toString () {
    return this.code.map((f, n) => n + ': ' + f).join('\n');
  }

  /** Creates stack machine */
  run (memorySize) {
    return () => {
      const memory = Array(memorySize).fill(0);    // create memory
      this.code.forEach(code => code(memory));           // execute
      return memory;
    };
  }
}

/** [Example 6/09](../?eg=06/09): actions to generate stack machine code. */
class Arithmetic09 {
  #parser;                                    // for error messages
  get parser () { return this.#parser; }
  #machine;                                    // handles execution
  get machine () { return this.#machine; }
  #symbols = new Map();    // symbol table, maps names to addresses
  get symbols () { return this.#symbols; }
  
  constructor (parser, machine = new Machine09 ()) {
    this.#parser = parser;
    this.#machine = machine;
  }

  /** Returns memory address for name */
  _alloc (name) {
    let addr = this.symbols.get(name);               // known name?
    if (typeof addr == 'undefined')      
      this.symbols.set(name,                            // new name
        addr = this.symbols.size);       // allocate, starting at 0
    return addr;
  }

  /** `list: stmt [{ ';' stmt }];` */
  list (s, many) {
    puts(this.machine.toString());                     // show code
    this.symbols.forEach(                         // show variables
      (value, name) => puts(name, 'at', value));
    const size = this.symbols.size;          // number of variables
    puts('stack starts at', size);
    return this.machine.run(size);                 // stack machine
  }

  /** `stmt: sum;` */
  stmt (s) {                                // print and clear stack
    this.machine.code.push(memory => puts(memory.pop()));
  }
  
  /** `sum: 'let' Name '=' sum | product [{ add | subtract }];` */
  sum (...val) {
    if (val.length < 4) return;
    const addr = this._alloc(val[1]);
    this.machine.code.push(memory => memory[addr] = memory.at(-1));
  }

  /** `add: '+' right;` */
  add (_, r) { 
    this.machine.code.push(
      memory => memory.splice(-2, 2, memory.at(-2) + memory.at(-1))
    );
  }

  /** `subtract: '-' right;` */
  subtract (_, r) {
    this.machine.code.push(
      memory => memory.splice(-2, 2, memory.at(-2) - memory.at(-1))
    );
  }
  
  // product: signed [{ multiply | divide }];

  /** `multiply: '*' right;` */
  multiply (_, r) { 
    this.machine.code.push(
      memory => memory.splice(-2, 2, memory.at(-2) * memory.at(-1))
    );
  }
  
  /** `divide: '/' signed;` */
  divide (_, r) {
    this.machine.code.push(
      memory => memory.splice(-2, 2, memory.at(-2) / memory.at(-1))
    );
  }

  /** `signed: [ '-' ] term;` */
  signed (minus, t) { 
    if (minus)
      this.machine.code.push(
        memory => memory.splice(-1, 1, -memory.at(-1))
      );
  }

  // term: input | number | name | '(' sum ')';

  /** `input: 'input' [ Number ];` */
  input (_, number) {
    const dflt = String(number !== null ? number[0] : 0);
    this.machine.code.push(
      memory => memory.push(parseInt(prompt('input', dflt), 10))
    );
  }

  /** `number: Number;` */
  number (number) { 
    const result = parseInt(number, 10);
    this.machine.code.push(memory => memory.push(result));
  }

  /** `name: Name;` */
  name (name) {
    const addr = this._alloc(name);
    this.machine.code.push(memory => memory.push(memory[addr]));
  }
}

/** [Example 6/10](../?eg=06/10): stack machine with mnemonics.
    @extends module:Six~Machine09 */
class Machine10 extends Machine09 {
  /** returns `code.length` */
  gen (name, ... args) {
    return this.code.push(this.ins(name, ... args));
  }

  /** returns instruction function */
  ins (name, ... args) {
    return args.length ?
      eval(`memory => this.${name}(${args.join(', ')})(memory)`) :
      eval(`memory => this.${name}(memory)`);
  }
  
  /** `stack: ... a b -> ... a+b` */                 Add (memory) {
    memory.splice(-2, 2, memory.at(-2) + memory.at(-1));
  }
  /** `stack: ... a b -> ... a/b` */              Divide (memory) {
    memory.splice(-2, 2, memory.at(-2) / memory.at(-1));
  }
  /** `stack: ... -> ... input` */                   Input (dflt) {
    dflt = String(dflt);
    return memory =>
      memory.push(parseInt(prompt('input', dflt), 10));
  }
  /** `stack: ... -> ... memory[addr]` */             Load (addr) {
    return memory => memory.push(memory[addr]);
  }
  /** `stack: ... a -> ... -a` */                  Minus (memory) {
    memory.splice(-1, 1, -memory.at(-1));
  }
  /** `stack: ... a b -> ... a*b` */            Multiply (memory) {
    memory.splice(-2, 2, memory.at(-2) * memory.at(-1));
  }
  /** `stack: ... val -> ...` */                     Pop (memory) {
    memory.pop();
  }
  /** `stack: ... -> ... result` */                 Push (result) {
    return memory => memory.push(result);
  }
  /** `stack: ... val -> ... | puts(val)` */        Puts (memory) {
    puts(memory.at(-1));
  }
  /** `stack: ... val -> ... val  | memory[a]: val` */  Store (a) {
    return memory => memory[a] = memory.at(-1);
  }
  /** `stack: ... a b -> ... a-b` */            Subtract (memory) {
    memory.splice(-2, 2, memory.at(-2) - memory.at(-1));
  }
}

/** [Example 6/10](../?eg=06/10): actions to generate mnemonic stack machine code.
    @extends module:Six~Machine09 */
class Arithmetic10 extends Arithmetic09 {
  constructor (parser, machine = new Machine10()) {
    super(parser, machine);
  }

  // list: stmt [{ ';' stmt }];

  /** `stmt: sum;` */
  stmt (s) {                               // print and clear stack
    this.machine.gen('Puts');
    this.machine.gen('Pop');
  }

  /** `sum: 'let' Name '=' sum | product [{ add | subtract }];` */
  sum (...val) {
    if (val.length < 4) return;
    this.machine.gen('Store', this._alloc(val[1]));
  }

  /** `add: '+' product;` */
  add () { this.machine.gen('Add'); }

  /** `subtract: '-' product;` */
  subtract () { this.machine.gen('Subtract'); }
  
  // product: signed [{ multiply | divide }];

  /** `multiply: '*' signed;` */
  multiply () { this.machine.gen('Multiply'); }
  
  /** `divide: '/' signed;` */
  divide () { this.machine.gen('Divide'); }  // 

  /** `signed: [ '-' ] term;` */
  signed (minus, t) { if (minus) this.machine.gen('Minus'); }

  // term: input | number | name | '(' sum ')';

  /** `input: 'input' [ Number ];` */
  input (i, number) {
    this.machine.gen('Input', number !== null ? number[0] : 0);
  }

  /** `number: Number;` */
  number (number) { 
    const result = parseInt(number, 10);
    this.machine.gen('Push', result);
  }

  /** `name: Name;` */
  name (name) {
    this.machine.gen('Load', this._alloc(name));
  }
}

/** [Example 6/11](../?eg=06/11): branches, stepping, and tracing.
    @extends module:Six~Machine10 */
class Machine11 extends Machine10 {
  /** Returns trace function, if any */
  trace (address) {
    if (address === true)                    // unconditional trace
      return (memory, pc) =>            // traces instruction at pc
        puts(memory.toString(), pc+':', this.code[pc].toString());
    if (typeof address == 'number') // address of control variable?
      return (memory, pc) => {          // traces instruction at pc
        if (memory[address] >= 0) // variable at addr non-negative?
          puts(memory.toString(), pc+':', this.code[pc].toString());
      };
  }

  /** Data memory.
      @class extends Array
      @property {number} pc - program counter.
      @property {boolean} continue - true if execution can be continued.
      @property {function} toString() - represents as text. */
  get Memory () { return this.#Memory ??= class extends Array {
      toString () { return '[ ' + this.join(' ') + ' ]'; }
    };
  }
  #Memory;
  
  /** Returns stack machine executable */
  run (size, startAddr = 0, traceAddr) {
    let t;                      // [closure] trace function, if any
    const StackMachine = (memory, steps) => {
      if (!memory) {                                 // initialize?
        if (steps) t = this.trace(true);  // steps? permanent trace
        else {                           // no steps: don't suspend
          t = this.trace(traceAddr); steps = Infinity;
        }
        memory = new this.Memory(size).fill(0);    // create memory
        memory.pc = startAddr;        // initialize program counter
        t && puts(memory.toString());             // initial memory
      }
      while (steps -- && memory.pc < this.code.length) {  // steps?
        const pc = memory.pc ++;         // advance program counter
        this.code[pc](memory);            // execute at previous pc
        t && t(memory, pc);           // trace executed instruction
      }
      memory.continue = memory.pc < this.code.length;     // again?
      return memory;
    };
    return (memory, steps) => StackMachine(memory, steps);
  }
  
  /** `stack: ... -> ... | pc: a` */                   Branch (a) {
    return memory => memory.pc = a;
  }
  /** `stack: ... bool -> ... | pc: !bool? a` */        Bzero (a) {
    return memory => { if (!memory.pop()) memory.pc = a; }
  }
  /** `stack: ... a b -> ... a == b` */               Eq (memory) {
    memory.splice(-2, 2, memory.at(-2) == memory.at(-1));
  }
  /** `stack: ... a b -> ... a >= b` */               Ge (memory) {
    memory.splice(-2, 2, memory.at(-2) >= memory.at(-1));
  }
  /** `stack: ... a b -> ... a > b` */                Gt (memory) {
    memory.splice(-2, 2, memory.at(-2) > memory.at(-1));
  }
  /** `stack: ... a b -> ... a <= b` */               Le (memory) {
    memory.splice(-2, 2, memory.at(-2) <= memory.at(-1));
  }
  /** `stack: ... a b -> ... a < b` */                Lt (memory) {
    memory.splice(-2, 2, memory.at(-2) < memory.at(-1));
  }
  /** `stack: ... a b -> ... a != b` */               Ne (memory) {
    memory.splice(-2, 2, memory.at(-2) != memory.at(-1));
  }
  /** `stack: ... n*val -> ...` */                      Print (n) {
    return memory => puts(... memory.splice(- n));
  }
}

/** [Example 6/11](../?eg=06/11): compile a little language into stack machine code.
    @extends module:Six~Arithmetic10 */
class Control11 extends Arithmetic10 {
  constructor (parser, machine = new Machine11()) {
    super(parser, machine);
  }
  
  /** `prog: stmts;` returns executable */
  prog (_) {
    const size = this.symbols.size,          // number of variables
      traceAddr = this.symbols.get('trace'); // if a variable named
    if (typeof traceAddr != 'undefined') {     // ...'trace' exists
      puts(this.machine.toString());                   // show code
      this.symbols.forEach(              // show variable addresses
        (addr, name) => puts(`${name} at ${addr}`)
      );
      puts('stack starts at', size);
    }
    return this.machine.run(size, 0, traceAddr);   // stack machine
  }
  
  // stmts:    stmt [{ ';' stmt }];

  /** `stmt: assign | print | loop | select;` [replace] no op */
  stmt (stmt) { }

  /** `assign: Name '=' sum;` stores and pops stack */
  assign (name, e, s) {
    this.machine.gen('Store', this._alloc(name));
    this.machine.gen('Pop');
  }

  /** `print: 'print' sums;` */
  print (_, sums) { this.machine.gen('Print', sums); }

  /** `sums: sum [{ ',' sum }];` returns number of values */
  sums (sum, many) { return 1 + (many ? many[0].length : 0); }
  
  /** `loop: While cmp Do stmts 'od';` */
  loop (While, _, Do, s, o) {
    const od = this.machine.gen('Branch', While);
    this.machine.code[Do] = this.machine.ins('Bzero', od);
  }

  /** `While: 'while';` returns address for branch to `while` */
  While (w) { return this.machine.code.length; }

  /** `Do: 'do';` returns address of slot for bzero to `od` */
  Do (d) { return this.machine.code.push(null) - 1; }

  /** `select: 'if' cmp Then stmts [ Else stmts ] 'fi';` */
  select (i, c, Then, s, Else, f) {
    const fi = this.machine.code.length;         // address of 'fi'
    if (Else) {
      Else = Else[0];               // address after branch to 'fi'
      this.machine.code[Then] = this.machine.ins('Bzero', Else);
      this.machine.code[Else - 1] = this.machine.ins('Branch', fi);     
    } else
      this.machine.code[Then] = this.machine.ins('Bzero', fi);
  }

  /** `Then: 'then';` returns address for bzero to `else` `fi` */
  Then (t) { return this.machine.code.push(null) - 1; }

  /** `Else: 'else';` creates slot for branch to `fi`,
      returns address of `else` */
  Else (e) { return this.machine.code.push(null); }

  // cmp:      sum rel;
  // rel:      eq | ne | gt | ge | lt | le;

  /** `eq: '=' sum;` */   eq () { this.machine.gen('Eq'); } 

  /** `ne: '<>' sum;` */  ne () { this.machine.gen('Ne'); }
  
  /** `gt: '>' sum;` */   gt () { this.machine.gen('Gt'); }

  /** `ge: '>=' sum;` */  ge () { this.machine.gen('Ge'); }

  /** `lt: '<' sum;` */   lt () { this.machine.gen('Lt'); }
   
  /** `le: '<=' sum;` */  le () { this.machine.gen('Le'); }

  // sum:      product [{ add | subtract }];
  // add:      '+' product;
  // subtract: '-' product;
  // product:  signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide:   '/' signed;
  // signed:   [ '-' ] term;
  // term:     input | number | name | '(' sum ')';
  // input:    'input' [ Number ];
  // number:   Number;
  // name:     Name;
}

/** [Example 6/12](../?eg=06/12): compile a little language
    into JavaScript functions.
    @extends module:Six~Functions07 */
class Functions12 extends Functions07 {
  /** `prog: stmts;` returns executable */
  prog (stmts) { return () => stmts({ }); }

  /** `stmts: stmt [{ ';' stmt }];` returns fct */
  stmts (stmt, many) {
    return (many ? many[0] : []).
      reduce((left, list) => 
        memory => (left(memory), list[1][0](memory)), stmt[0]);
  }

  // stmt:     assign | print | loop | select;

  /** `assign: Name '=' sum;` returns fct */
  assign (name, e, sum) {
    return memory => memory[name] = sum(memory);
  }

  /** `print: 'print' sums;` returns function */
  print (p, sums) {
    return memory => puts(... sums.map(fct => fct(memory)));
  }

  /** `sums: sum [{ ',' sum }];` returns list of functions */
  sums (sum, many) {
    return [ sum ].concat(many ? many[0].map(seq => seq[1]) : []);
  }

  /** `loop: 'while' cmp 'do' stmts 'od';` returns fct */
  loop (w, cmp, d, stmts, o) {
    return memory => { while (cmp(memory)) stmts(memory); };
  }

  /** `select: 'if' cmp 'then' stmts [ 'else' stmts ] 'fi';` returns fct */
  select (i, cmp, t, stmts, opt, f) { 
    return opt ?
      (memory => cmp(memory) ? stmts(memory) : opt[1](memory)) :
      (memory => { if (cmp(memory)) stmts(memory); });
  }
  
  /** `cmp: sum rel;` returns fct */
  cmp (sum, rel) { return memory => rel[0](sum)(memory); }

  // rel:      eq | ne | gt | ge | lt | le;

  /** `eq: '=' expr;` returns fct for composition */
  eq (_, right) {
    return left => memory => left(memory) == right(memory);
  }
  
  /** `ne: '<>' expr;` returns fct for composition */
  ne (_, right) {
    return left => memory => left(memory) != right(memory);
  }

  /** `gt: '>' expr;` returns fct for composition */
  gt (_, right) {
    return left => memory => left(memory) > right(memory);
  }

  /** `ge: '>=' expr;` returns fct for composition */
  ge (_, right) {
    return left => memory => left(memory) >= right(memory);
  }

  /** `lt: '<' expr;` returns fct for composition */
  lt (_, right) {
    return left => memory => left(memory) < right(memory);
  }

  /** `le: '<=' expr;` returns fct for composition */
  le (_, right) {
    return left => memory => left(memory) <= right(memory);
  }

  /** `sum: product [{ add | subtract }];` returns fct */
  sum (product, many) { return this.product(product, many); }

  // add:      '+' product;
  // subtract: '-' product;
  // product:  signed [{ multiply | divide }];
  // multiply: '*' signed;
  // divide:   '/' signed;
  // signed:   [ '-' ] term;
  // term:     input | number | name | '(' sum ')';
  // input:    'input' [ Number ];
  // number:   Number;
  // name:     Name;
}

export {
  Eval02,
  Eval03,
  Eval04,
  Functions05,
  Functions06,
  Functions07,
  Postfix08,
  Arithmetic09,
  Machine09,
  Arithmetic10,
  Machine10,
  Control11,
  Machine11,
  Functions12
};
