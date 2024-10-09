/** A module which contains classes and methods shared by both,
    the {@link module:BNF BNF} and {@link module:EBNF EBNF} modules.
    It implements messaging, creating precedence levels, and creating scanners.

| class | main properties | main methods |
| ----- | --------------- | ------------ |
| {@linkcode module:Base~Factory Factory} | `config`, `errors`,<br>`lits`[`ByName`], `tokens`[`ByName`], `nts`[`ByName`],<br>`levels`: `Array<`{@linkcode module:Base~Precedence Precedence}`>` | {@linkcode module:Base~Factory#add add(item)}, {@linkcode module:Base~Factory#dump dump(item)},<br>{@linkcode module:Base~Factory#assert assert(condition, ...)},<br>{@linkcode module:Base~Factory#error error(...)},<br>{@linkcode module:Base~Factory#message message(...)} |
| {@linkcode module:Base~Precedence Precedence} | `assoc`, `terminals` | |
| {@linkcode module:Base~Scanner Scanner} | `pattern` | {@linkcode module:Base~Scanner#scan scan(input)}: `Array<`{@linkcode module:Base~Tuple Tuple}`>` |
| {@linkcode module:Base~Tuple Tuple} | `lineno`, `t`, `value` | {@linkcode module:Base~Tuple#escape escape(s)} |

    @module Base
    @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
    @version 2024-02-13
*/

/** Contains configurable values, inventories, and factory methods to create
    scanners, tokenized input tuples, and precedence levels.

    @property {Object.<string, Object>} config - maps names to configurable values.
    @property {function(string[])} config.log - function to print strings, by default `console.log`.
    @property {RegExp} config.lits - restricts literal representation, by default single-quoted;
      must be anchored.
    @property {RegExp} config.tokens - restricts token names, by default alphanumeric;
      must be anchored.
    @property {RegExp} config.nts - restricts non-terminal names, by default alphanumeric;
      must be anchored.
    @property {string} config.uniq - prefix for unique non-terminal names, by default `$-`.
    @property {Array<module:Base~Lit>} lits - list of unique literals, can be pushed.
    @property {Object.<string, module:Base~Lit>} litsByName - maps `'x'` to unique literal.
    @property {Array<module:Base~Token>} tokens - list of unique tokens, can be pushed.
    @property {Object.<string, module:Base~Token>} tokensByName - maps name to unique token.
    @property {Array<module:Base~Precedence>} levels - list of precedence levels, can be pushed.
    @property {Array<module:Base~NT>} nts - list of unique non-terminals, can be pushed.
    @property {Object.<string, module:Base~NT>} ntsByName - maps name to unique non-terminal.
    @property {number} errors - incremented by {@linkcode module:Base~Factory#error error()} method;
      can be reset, e.g., to count during recognition.
    @property {boolean} noargs - don't check for argument count errors in {@linkcode module:Base~Parser#act act()} method.
    @abstract
*/
class Factory {
  #config = {
    log: console.log,
    lits: /^'(?:[^'\\]|\\['\\])+'$/,
    tokens: /^[A-Za-z][A-Za-z0-9_]*$/,
    nts: /^[A-Za-z][A-Za-z0-9_]*$/,
    uniq: '$-',
    noargs: false
  };
  get config () { return this.#config; }
    
  #lits = [];
  get lits () { return this.#lits; }

  #litsByName = { };
  get litsByName () { return this.#litsByName; }
  
  #tokens = [ ];
  get tokens () { return this.#tokens; }

  #tokensByName = { };
  get tokensByName () { return this.#tokensByName; }
  
  #levels = [];
  get levels () { return this.#levels; }

  #nts = [ ];
  get nts () { return this.#nts; }

  #ntsByName = { };
  get ntsByName () { return this.#ntsByName; }
  
  #errors = 0;
  get errors () { return this.#errors; }
  set errors (errors) { this.#errors = errors; }

  /** Adds a new symbol to the proper inventory or creates and adds new tokens.
      Must be called with a new, unique symbol or with a map of token names to patterns.
      Validates item names against `.config`.
      Token patterns  must not accept empty input, must not use `d`, `g`, or `y` flag,
      should not be anchored, and should use `(:? )` rather than `( )` for grouping.
      @param {Symbol|Object.<string, RegExp>} item - to add to the proper inventory or create and add.
  */
  add (item) {
    if (item instanceof Symbol) {
      this.assert(typeof item.name == 'string', 'add():', item, 'name not a string');
    
      if (item instanceof Lit) {
        this.assert(item.name == '' || this.config.lits.test(item.name), 'add():', item, 'invalid literal');
        this.assert(!(item.name in this.litsByName), 'add():', item, 'already in litsByName');
        this.lits.push(item);
        this.litsByName[item.name] = item;
      
      } else if (item instanceof Token) {
        this.assert(item.name == '' || this.config.tokens.test(item.name), 'add():', item, 'invalid token name');
        this.assert(item.pat instanceof RegExp, 'add():', item, 'not a regular expression pattern');
        if (item.name.length) {
          this.assert(!item.pat.test(''), 'add():', item, 'pattern accepts empty input');
          this.assert(!/[dgy]/.test(item.pat.flags), 'add():', item, 'pattern uses "d", "g", or "y" flag(s)');
        }
        this.assert(!(item.name in this.tokensByName), 'add():', item, 'already in tokensByName');
        this.tokens.push(item);
        this.tokensByName[item.name] = item;
      
      } else if (item instanceof NT) {
        this.assert(item.name == '' || item.name.startsWith(this.config.uniq) || this.config.nts.test(item.name),
          'add():', item, 'invalid non-terminal name');
        this.assert(!(item.name in this.ntsByName), 'add():', item, 'already in ntsByName');
        this.nts.push(item);
        this.ntsByName[item.name] = item;
      
      } else
        this.assert(false, 'add():', item, 'no suitable inventory');
        
    } else {
      this.assert(item instanceof Object, item, 'not a map of token definitions');
      
      Object.entries(item).forEach(kv => this.token(kv[0], kv[1]), this); 
    }
  }

  /** Displays an object as a string; in particular, nested arrays.
      This is useful because `console.debug` only reaches 3 levels.
      @param {Object} [a] - the object to display;
        if omitted, returns an empty string.
      @returns {string}
  */
  dump (a) {
    if (!arguments.length) return '';
    switch (typeof a) {
    case 'string':
      return "'" + a.replace(/([\\'])/g, "\\$1") + "'"; // could do more...
    case 'object':
      if (a)
        switch (a.constructor.name) {
        case 'Array':
          return '[ ' + a.map(elt => this.dump(elt)).join(' ') + ' ]';
        default:
          return a.constructor.name + ' { ' + a.toString() + ' }';
        }
      return 'null';
    }
    return '' + a;
  }
  
  /** Factory method to represent a list of terminals
      with equal precedence level and equal associativity.
      Creates a new {@linkcode module:Base~Precedence Precedence} object,
      adds it to `.levels`,
      adds `.prec.level` and `.prec.assoc` to all terminals in the list,
      and checks for duplicates.
      @param {string} assoc - associativity: `'%left'`, `'%right'`, or `'%nonassoc'`.
      @param {Array.<?module:Base~T>} terminals - to add, `null` elements are ignored; no duplicates.
      @returns {?module:Base~Precedence} representing the set,
        or `null` if there are no terminals.
  */
  precedence (assoc, terminals) {
    this.assert(/^%(left|right|nonassoc)$/.test(assoc), 'precedence():', assoc, 'invalid associativity');
    this.assert(terminals instanceof Array && terminals.every(t => t === null || t instanceof T),
      'precedence():', terminals, 'invalid list of termials');
      
    let result = null;
    terminals = terminals.filter(t => !!t);
    if (terminals.length) {
      terminals.forEach(t => {
        this.assert(!t.prec.assoc, 'precedence():', t, 'is a duplicate precedence definition');
        t.prec.level = this.levels.length, t.prec.assoc = assoc;
      }, this);

      result = new Precedence(assoc, terminals);
      this.levels.push(result);
    }
    return result;
  }
    
  /** Factory method to create a scanner.
      @param {RegExp} [skip] - a pattern to define ignorable character sequences,
        by default white space,
        must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, should use `(:? )` rather than `( )` for grouping.
      @param {Array<T>} [terminals] - ordered list to create the lexical analysis pattern.
      @returns {?module:Base~Scanner} the scanner.
  */
  scanner (skip = new RegExp('\\s+'), terminals) {   // /\s+/ crashes jsdoc
    this.assert(skip instanceof RegExp, 'scanner():', skip, 'not a regular expression');
    this.assert(!skip.test(''), 'scanner():', skip, 'skip accepts empty input');
    this.assert(!/[dgy]/.test(skip.flags), 'scanner():', skip, 'skip uses "d", "g", or "y" flag(s)');
    // can't check anchor and grouping.
    
    this.assert(!terminals || (terminals instanceof Array && terminals.every(t => t instanceof T)),
      'scanner():', terminals + ':', 'not a list of terminals');
    
    return new Scanner(this, skip, terminals);
  }
  
  /** Factory method to create an element of a tokenized input stream.
      @param {number} lineno - input position.
      @param {?module:Base~T} t - terminal, i.e., literal or token object;
        {@linkcode module:Base~Scanner#scan scan()} uses `null` for an illegal character.
      @param {?string} [value] - terminal's representation in the input.
      @returns {module:Base~Tuple} an element of a tokenized input stream.
  */
  tuple (lineno, t, value = null) {
    this.assert(typeof lineno == 'number' && lineno >= 0, 'tuple():', lineno, 'invalid line number');
    this.assert(t === null || t instanceof T, 'tuple():', t, 'invalid terminal');
    this.assert(value === null || typeof value == 'string', 'tuple():', value, 'invalid value');

    return new Tuple(lineno, t, value === null ? '' : value);
  }
  
  /** Displays a message and throws an error if a condition is not met;
      primarily used for stronger argument typing.
      @param {boolean} condition - should be true.
      @param {Array<?object>} s - message, to be displayed; joined by blanks.
      @throws {string} message if condition is not met.
  */
  assert (condition, ...s) { if (!condition) throw this.message('assertion error:', ... s); }

  /** Displays a message and counts it as an error.
      @param {Array<?object>} s - message, to be displayed; joined by blanks.
      @return {string} the message.
  */
  error (...s) { ++ this.errors; return this.message('error:', ... s); }

  /** Displays a message on the configured `.log`.
      @param {Array<?object>} s - message, to be displayed; joined by blanks.
      @return {string} the message.
  */
  message (...s) {
    const message = s.map(s => s === null ? 'null' : s.toString()).join(' ');
    this.config.log(message);
    return message;
  }
}

/** Represents a symbol in the grammar alphabets.
    Symbols are only created through factory methods in the grammar which arrange for uniqueness.

    @property {string} name - name for a token or non-terminal, representation for a literal.
      An empty string is used for one reserved symbol in each subclass.
    @abstract
*/
class Symbol {
  #name;
  get name () { return this.#name; }

  /** Creates a symbol; should only be used by subclass.
      @param {string} name - symbol name. 
  */
  constructor (name) { this.#name = name; }
}

/** Represents a terminal, i.e., a literal or a token.
    @property {Object} prec - precedence.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {boolean} used - true if used in a grammar.

    @extends module:Base~Symbol
    @property {string} name - name for a token, representation for a literal.
    @abstract
*/
class T extends Symbol {
  #prec = { };
  get prec () { return this.#prec; }

  #used = false;
  get used () { return this.#used; }
  set used (_) { this.#used = true; } // cannot clear

  /** Creates a terminal; should only be used by subclass.
      @param {string} name - name for a token, representation for a literal.
  */
  constructor (name) { super(name); }
  
  /** Displays description and precedence, if any.
      @returns {string}
  */
  dump () {
    return this.toString() + (this.prec.assoc ? ' ' + this.prec.assoc + ' ' + this.prec.level : '');
  }
}

/** Represents a literal symbol.
    @property {string} value - (unquoted) value for the literal; empty string for `$eof`, too.
    @property {boolean} [screened] - set true only during scanner construction
      if literal value matches a token pattern.

    @extends module:Base~T
    @property {Object} prec - precedence.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {boolean} used - true if used in a grammar.
    @property {string} name - name for a token, representation for a literal.
    @abstract
*/
class Lit extends T {
  #value;
  get value () { return this.#value; } 
  
  /** Creates a literal symbol; should only be used by factory method.
      Extracts value from representation.
      @param {string} name - (quoted) representation for the literal.
        Empty string is reserved for `$eof`, the end of input.
  */
  constructor (name) {
    super(name);
    this.#value = name.length ? this.unescape(name) : '';
  }

  /** Displays representation of a literal or `$eof`.
      @returns {string}
  */
  toString () { return this.name.length ? this.name : '$eof'; }
  
  /** Removes leading and trailing delimiter character
      and elaboarates backslash escapes.
      @param {string} s - string to unescape.
      @returns {string} unquoted, unescaped string.
  */
  unescape (s) {

    let result = '', c;

    for (let i = 1; i < s.length - 1; )
      if ((c = s.charAt(i ++)) != '\\')
        result += c;
      
      else if (i >= s.length - 1)
        result += '\\'; // trailing backslash in literal
      
      else if ((c = 'bfnrtv\\\''.indexOf(s.charAt(i ++))) >= 0)
        result += '\b\f\n\r\t\v\\\''.charAt(c);
    
      else switch (c = s.charAt(i - 1)) {
      case 'x':
        if (i + 1 < s.length-1 &&
            '0123456789abcdef'.indexOf(s.charAt(i)) >= 0 && 
            '0123456789abcdef'.indexOf(s.charAt(i + 1)) >= 0) {
          result += String.fromCharCode(parseInt(s.substr(i, 2), 16));
          i += 2;
        } else
          result += 'x'; // bad \x
        break;
          
      case 'u':
        if (i + 3 < s.length-1 &&
            '0123456789abcdef'.indexOf(s.charAt(i)) >= 0 && 
            '0123456789abcdef'.indexOf(s.charAt(i + 1)) >= 0 &&
            '0123456789abcdef'.indexOf(s.charAt(i + 2)) >= 0 &&
            '0123456789abcdef'.indexOf(s.charAt(i + 3)) >= 0) {
          result += String.fromCharCode(parseInt(s.substr(i, 4), 16));
          i += 4;
        } else
          result += 'u'; // bad \u
        break;
      
      default: // bad \
        result += c;
      }

    return result;
  }
}

/** Represents a token symbol.
    @property {RegExp} pat - pattern for token; empty `RegExp` for `$error`.
    @property {Array<Lit>} [screen] - contains literals with values matching the pattern, if any.

    @extends module:Base~T
    @property {Object} prec - precedence.
    @property {string} [prec.assoc] - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`, if any.
    @property {number} [prec.level] - precedence level, from 0, if any.
    @property {boolean} used - true if used in a grammar.
    @property {string} name - name for a token, representation for a literal.
      Empty string is reserved for `$error`, can be something unexpected.
    @abstract
*/
class Token extends T {
  #pat;
  get pat () { return this.#pat; }  
  
  /** Creates a token symbol; should only be used by factory method.
      @param {string} name - token name.
        Empty string is reserved for `$error`, something unexpected.
      @param {RegExp} pat - pattern for token; empty `RegExp` for `$error`.
  */
  constructor (name, pat) {
    super(name);
    this.#pat = pat;
  }

  /** Displays name of a token or `$error`.
      @returns {string}
  */
  toString () { return this.name.length ? this.name : '$error'; }
}

/** Represents a list of terminal symbols of equal precedence and associativity.
    @property {string} assoc - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`.
    @property {Array<module:Base~T>} terminals - list of terminal symbols.
*/
class Precedence {
  #assoc;
  get assoc () { return this.#assoc; }
  
  #terminals;
  get terminals () { return this.#terminals; }
  
  /** Creates a new precedence level;
      see factory method {@linkcode module:Base~Factory grammar.precedence()}.
      @param {string} assoc - associativity, `'%left'`, `'%right'`, or `'%nonassoc'`.
      @property {Array<module:Base~T>} terminals - list of terminals.
  */
  constructor (assoc, terminals) {
    this.#assoc = assoc;
    this.#terminals = terminals;
  }

  /** Displays associativity and the list of terminals.
      @returns {string}.
  */
  toString () { return this.assoc + ' ' + this.terminals.join(' '); }

  /** Displays associativity and the list of terminals.
      @returns {string}.
  */
  dump () { return this.toString(); }
}

/** Represents a non-terminal symbol.

    @extends module:Base~Symbol
    @property {string} name - name for the non-terminal.
      Empty string is reserved for `$accept`, can be left-hand side of a start rule.
    @abstract
*/
class NT extends Symbol {

  /** Creates a non-terminal symbol; should only be used by factory method.
      @param {string} name - non-terminal's name.
  */
  constructor (name) { super(name); }
  
  /** Displays name of a non-terminal or `$accept`.
      @returns {string}
  */
  toString () { return this.name.length ? this.name : '$accept'; }
  
  /** Displays name of a non-terminal or `$accept`.
      @returns {string}
  */
  dump () { return this.toString(); }
}

/** Represents an element of a tokenized input stream.
    @property {number} lineno - input position.
    @property {?module:Base~T} t - terminal, i.e., literal or token object.
      `null` is reserved for unrecognizable input.
    @property {string} value - `t`'s representation in the input.
*/
class Tuple {
  #lineno;
  get lineno () { return this.#lineno; }

  #t;
  get t () { return this.#t; }

  #value;
  get value () { return this.#value; }
  
  /** Creates an element of a tokenized input stream;
      see factory method {@linkcode module:Base~Factory#tuple grammar.tuple()}.
      @param {number} lineno - input position.
      @param {?module:Base~T} t - terminal, i.e., literal or token object.
        `null` is reserved for unrecognizable input.
      @param {string} value - `t`'s representation in the input.
  */
  constructor (lineno, t, value) {
    this.#lineno = lineno;
    this.#t = t;
    this.#value = value;
  }

  /** Displays position, terminal, and associated value.
      @returns {string}.
  */
  toString () {
    return (this.lineno > 0 ? '(' + this.lineno + ') ' : 'eof ') + 
      (!this.t ? this.escape(this.value)            // unrecognizable input
        : this.t instanceof Lit ? this.t.toString() // literal representation or `$eof`
        : this.t.toString == '$error' ? '$error'
        : this.escape(this.value) + ' ' + this.t);  // token
  }

  /** Escapes non-ASCII and invisible characters using backslash.
      Similar to {@linkcode module:Base~Scanner#escape Scanner.escape()}.
      @param {string} s - string to escape.
      @returns {string} double-quoted, escaped string.
      @example
escape(null)    // returns empty string
escape('x')     // returns string containing "x"
escape('\b')    // returns string containing "\b"
escape('y')     // returns string containing "\x##" or "\u####"
*/
  escape (s) {
    if (s == null) return '';
    let result = '"';
    for (let i = 0; i < s.length; ++ i) {
      let c = s.charAt(i);
      let cc = '\b\f\n\r\t\v\\"'.indexOf(c);
      if (cc >= 0)
        result += '\\' + 'bfnrtv\\"'.charAt(cc);
      else if (c >= ' ' && c <= '~')
        result += c;
      else if ((cc = s.charCodeAt(i)) < 16)
        result += '\\x0' + cc.toString(16);
      else if (cc < 256)
        result += '\\x' + cc.toString(16);
      else if (cc < 16 * 256)
        result += '\\u0' + cc.toString(16);
      else
        result += '\\u' + cc.toString(16);
    }
    return result + '"';
  }
}

/** Wraps a function which tokenizes a string.
    Token patterns should not partially overlap literals, e.g., `/[a-z]+/` would conceal `'formula1'`.
    @property {function(string[])} assert - bound to {@linkcode module:Base~Factory#assert factory.assert()}.
    @property {function(string[])} tuple - bound to {@linkcode module:Base~Factory#tuple factory.tuple()}.
    @property {Array.<module:Base~T>} terminals - ordered for pattern;
      first tokens ordered by ascending name then literals ordered by decreasing length.
    @property {RegExp} skip - a pattern to define ignorable character sequences,
      should not accept empty input, should not use flags, should not be anchored,
      should use `(:? )` rather than `( )` for grouping.
    @property {RegExp} pattern - read-only, concatenates capture groups
      with `skip` and `terminals`, used to disect input.
*/
class Scanner {
  #assert;
  get assert () { return this.#assert; }
  
  #tuple;
  get tuple () { return this.#tuple; }
  
  #terminals;
  get terminals () { return this.#terminals; }

  #skip;
  get skip () { return this.#skip; }
  
  #pattern;
  get pattern () { return this.#pattern; }
  
  /** Creates the pattern used to tokenize a string;
      see factory method {@linkcode module:Base~Factory#scanner grammar.scanner()}.
      @param {module:Base~Factory} factory - supplies literals and tokens;
        unused terminals and `$eof` and `$error`, if any, are ignored.
      @param {RegExp} skip - a pattern to define ignorable character sequences,
        must not accept empty input, must not use `d`, `g`, or `y` flag,
        should not be anchored, should use `(:? )` rather than `( )` for grouping.
      @param {Array<T>} [terminals] - ordered list corresponding to `.pattern`;
        if omitted, tokens by ascending name and then literals by decreasing length.
  */
  constructor (factory, skip, terminals) {
    // "inherit" assert() and tuple()
    this.#assert = factory.constructor.prototype.assert.bind(factory);
    this.#tuple = factory.constructor.prototype.tuple.bind(factory);
    
    if (terminals)
      this.#terminals = terminals;                // and we hope for the best
    
    else {
      // import non-empty, used literals, sorted by decreasing length
      const lits = factory.lits.filter(lit => lit.used && lit.name.length).sort(
        (a, b) => a === b ? 0 : a.value < b.value ? 1 : -1);

      // import non-empty, used tokens, sorted by ascending name
      const tokens = factory.tokens.filter(token => token.used && token.name.length).sort(
        (a, b) => a === b ? 0 : a.name < b.name ? -1 : 1);
 
      // token.screen = non-empty map of covered literals, if any
      // lit.screened = true if literal is covered by one token, two or more is bad
      tokens.forEach(token => {
        let keep = false;
        token.screen = lits.reduce((map, lit) => {
          const match = token.pat.exec(lit.value);    // match?
          if (match && match[0] == lit.value) {       // exact
            this.assert(!lit.screened, lit + ': must not be recognized by more than one token pattern');
            lit.screened = true;
            keep = true;
            map[lit.value] = lit;                     // to be screened for
          }
          return map;            
        }, { });
        if (!keep) delete token.screen;               // nothing to screen
      });
      
      // tokens followed by non-screened literals
      this.#terminals = tokens.concat(lits.filter(lit => !lit.screened));

      // remove screened flags if any
      lits.forEach(lit => { delete lit.screened; });
    }
       
    this.#skip = skip;

    // pattern =  ^(:? ( skip ) | ( token ) |.. | ( literal ) |.. ) flags: mg
    let pattern = [ ];

    // skip
    pattern.push('(' + skip.toString().slice(1, -1) + ')');

    // terminals
    pattern.push(... this.terminals.map(t => '(' + 
      (t instanceof Lit ? this.escape(t.value) :  t.pat.toString().slice(1, -1)) + ')'));

    this.#pattern = new RegExp(pattern.join('|'), 'mg');
  }
  
  /** Tokenizes a string.
      @param {string} input - to be divided into literals and tokens.
      @returns {Array.<module:Base~Tuple>} a list of literals and tokens.
        The list contains one `Tuple` with a `null` terminal for each
        character sequence which is neither ignorable nor a literal or a token.
  */
  scan (input) {
    this.assert(typeof input == 'string', 'scan():', input, 'not a string');
    
    // returns number of \n in s
    const nl = s => s.replaceAll(/[^\n]/g, '').length; 

    const result = [];
    let lineno = 1, m, begin = this.pattern.lastIndex = 0;

    while (this.pattern.lastIndex < input.length)     // loop over input
      if (m = this.pattern.exec(input)) {             // find anything?
        if (m.index > begin) {                        // illegal char at beginning?
          const illegal = input.substr(begin, m.index - begin);
          result.push(this.tuple(lineno, null, illegal));
          lineno += nl(illegal);                      // count \n
        }
        m.slice(2).some((input, n) => {               // non-skip capture groups
          if (!input || !input.length) return false;  // group did not match
          let t = this.terminals[n],                  // corresponding terminal
            lit;                                      // result of screening if any
          if (t instanceof Token && t.screen && (lit = t.screen[input]))
            t = lit;
          result.push(this.tuple(lineno, t, input));  // new tuple
          return true;
        });
        lineno += nl(m[0]);                           // count \n
        begin = this.pattern.lastIndex;               // next scan starts here
      } else {                                        // nothing left to find
        result.push(this.tuple(lineno, null, input.substr(begin)));
        break;
      }
    return result;
  }
  
  /** Escapes most characters by `\.` or `\x..` or `\u....`.
      Similar to {@linkcode module:Base~Tuple#escape Tuple.escape()}.
      @param {string} s - string to escape.
      @returns {string} escaped string.
escape(null)    // will crash
escape('a')     // [alphanumerics] returns string containing a
escape('\b')    // [controls] returns string containing \b
escape('s')     // [specials] returns string containing \s
escape('x')     // [other] returns string containing \x## or \u####
*/
  escape (s) {
    this.assert(typeof s == 'string', 'escape():', s, 'not a string');
    
    let result = '';
    for (let i = 0; i < s.length; ++ i) {
      let c = s.charAt(i), cc;
      if (c.search(/[a-zA-Z0-9_]/) >= 0)
        result += c;
      else if ((cc  = '"\b\f\n\r\t\v\\\''.indexOf(c)) >= 0)
        result += '\\' + '"bfnrtv\\\''.charAt(cc);
      else if (c.search(/[\x20-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/) >= 0)
        result += '\\' + c;
      else {
        c = s.charCodeAt(i);
        if (c < 16)
          result += '\\x0' + c.toString(16);
        else if (c < 256)
          result += '\\x' + c.toString(16);
        else if (c < 16*256)
          result += '\\u0' + c.toString(16);
        else
          result += '\\u' + c.toString(16);
      }
    }
    return result;
  }
}

/** Method to process values collected by a rule.
    @callback Action
    @param {...Object} value - one value collected per item on the right-hand side.
    @returns {Object} the value to be collected in the parent rule or returned by recognition.
    @throws {string|Error} a string with an error message to continue recognition
      or an `Error` with an error message to abort recognition.
*/

/** Abstract base class for recognition based on a grammar.
    Should wrap a method `parse()` which recognizes input, builds a tree of nested lists,
    and creates and calls on an object with {@link module:Base~Action action methods}, if any.

    @property {module:Base~Factory} grammar - represents the grammar, counts errors;
      concurrent recognition will trash error counting.
    @property {?Object} actions - maps rule names to action methods during recognition.
    @abstract
*/
class Parser {
  #grammar;
  get grammar () { return this.#grammar; }
  
  #actions = null;
  get actions () { return this.#actions; }
  
  /** Creates a parser; only used by subclass to set `.grammar`.
      @param {module:Base~Factory} grammar - represents grammar.
  */
  constructor (grammar) { this.#grammar = grammar; }

  /** Only used by subclass to set `.actions`; resets `.errors` for the grammar.
      Should recognize an input sentence.
      @param {Function|Object} [actions] - a function is assumed to be a class
        and a singleton is created with `this` as constructor argument.
        The object maps rule names to action methods.
      @param {Object} arg - used as further constructor arguments.
  */
  parse (actions, ...arg) {
    // action methods?
    try {
      if (actions instanceof Function) this.#actions = new actions(this, ...arg);
      else if (actions instanceof Object) this.#actions = actions;
    } catch (e) {
      throw new Error(
        this.grammar.error('parse cannot create actions:', e instanceof Error ? e.message : e)
      );
    }    
    // reset error count
    this.grammar.errors = 0;
  }
  
  /** Calls an {@link module:Base~Action action method}.
      Checks argument count unless `grammar.config.noargs` is set
      or the method expects no arguments, i.e., has a rest parameter.
      @param {string} name - rule name to match.
      @param {Array} result - list of arguments.
      @returns action method result or unchanged `result`.
  */
  act (name, result) {
    if (this.actions) {
      const method = this.actions.constructor.prototype[name];
      if (typeof method == 'function') {
                
        if (this.grammar.config.actions)    // trace before
          this.grammar.config.log(name + '(' +
              result.map(arg => this.grammar.dump(arg)).join(', ') +
            ')', 'returns');
                                            // call action method
        result = this.call(this.actions, method, ...result);
    
        if (this.grammar.config.actions)    // trace after
          this.grammar.config.log(this.grammar.dump(result));
      }
    }
    return result;
  }
  
  /** Checks if argument and parameter count of a method match
      unless the method expects no parameters, or has a rest parameter
      or `grammar.config.noargs` is true.
      @param {object} target - to apply method to.
      @param {function} method - to check.
      @param {Object} args - arguments to pass.
      @returns {Object} method result.
      @example <caption><tt> super.method(arg1, .. argn) </tt></caption>
this.parser.call(this, super.method, arg1, .. argn)
  */
  call (target, method, ...args) {
    if (method.length && !this.grammar.config.noargs && method.length != args.length)
      this.grammar.error(`${method.name} arguments: expected ${method.length}, ` +
        `received ${args.length}`);
    return method.apply(target, args);
  }
}

export {
  Factory,
  Lit,
  NT,
  Parser,
  Precedence,
  Scanner,
  Symbol,
  T,
  Token,
  Tuple
};
