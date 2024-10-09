/** This module implements the model for the practice page which is
    shared by [batch](script.js.html) and [graphical user interface](index.js.html) scripting.

  @module Practice
  @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
  @version 2024-6-20
*/

import * as iBase from './base.js';
import * as iEBNF from './ebnf.js';
import * as iBNF from './bnf.js';
import * as iFive from './05.js';
import * as iSix from './06.js';
import * as iSeven from './07.js';
import * as iEight from './08.js';
import * as iTen from './10.js';
import * as iEleven from './11.js';

/** Model of the practice page.
  * The following global variables and global modules
  * will exist once the model has been constructed.
  * Pre-existing global variables `newOutput`, `prompt`, and `puts` will not be overwritten.

| name | type | content |
| ------ | ---- | ------- |
| `actions` | `string` | Defines the class and {@link module:Base~Action action methods} to be called by a parser. |
| `g` | `Grammar` | Represents `grammar`. |
| `grammar` | `string` | Rules of a grammar, argument for the construction of `g`. |
| `newOutput` | `function` | Displays it's arguments, blank-separated and marked as a new section. |
| `program` | `string` | Should be a sentence conforming to `grammar`, argument for recognition. |
| `prompt` | `function` | Displays a prompt string, returns input or a default string, else error. |
| `puts` | `function` | Displays it's arguments, blank-separated. |
| `run` | `function` | `null` or an executable compiled from `program` by the `actions`.<br>A stack machine has two arguments, other executables have none. |
| `tokens` | `string` | Defines an object with pattern properties defining the tokens used in `grammar`. |

| module | purpose |
| ------ | ------- |
| {@linkcode module:Base Base} | Base classes shared by the parser generators |
| {@linkcode module:EBNF EBNF} | LL(1) parser generator |
| {@linkcode module:BNF BNF} | SLR(1) parser generator |
| {@linkcode module:Six Six} | Classes for the examples in chapter six |
| {@linkcode module:Seven Seven} | Classes for the examples in chapter seven |
| {@linkcode module:Eight Eight} | Classes for the examples in chapter eight |
| {@linkcode module:Ten Ten} | Classes for the examples in chapter ten |
| {@linkcode module:Eleven Eleven} | Classes for the examples in chapter eleven |

  * @property {string} grammar - global `grammar`; setter clears global `g` and global `run`.
  * @property {string} tokens - global `tokens`; setter clears global `g` and global `run`.
  * @property {RegExp} skip - set by `doNew` from an empty key in `tokens`;
  *   overwrites default for scanner and parser.
  * @property {string} actions - global `actions`; setter clears global `run`.
  * @property {string} program - global `program`; setter clears global `run`.
  * @property {string} mode - `ebnf`|`stack`|`bnf`; setter clears global `g` and global `run`.

  * @property {boolean} greedy - use `expect()` rather than `check()`.
  * @property {boolean} error - insert `$error` when translating EBNF.
  * @property {boolean} tShallow - trace algorithm and display sets.
  * @property {boolean} tDeep - trace algorithm and display sets.
  * @property {boolean} tFollow - trace algorithm and display sets.
  * @property {boolean} dSets - display sets.
  * @property {boolean} dStates - display states.
  * @property {boolean} tLookahead - trace lookahead during parse.
  * @property {boolean} tParser - trace parse.
  * @property {boolean} tActions - trace actions.
  * @property {boolean} tNoargs - do not check argument count for actions.
  * @property {boolean} build - build lists.
  * 
  * @property {?Array} memory - for stepping a stack machine.
  * 
@example
// Use in scripting in a Windows environment
new Model(windows);
@example
// Use in scripting in a node.js environment
new Model(globalThis);
*/
class Model {
  get grammar () {
    return grammar;
  }       // global
  set grammar (value) {
    if (value == grammar) return;
    grammar = value.trim();
    g = run = null;
  }  // global, if different clears g and run
  
  get tokens () {
    return tokens;
  }        // global
  set tokens (value) {
    if (value == tokens) return;
    tokens = value.trim();
    g = run = null;
  }   // global, if different clears g and run
  
  get skip () { return this.#skip; }
  #skip = undefined;
  
  get actions () {
    return actions;
  }        // global
  set actions (value) {
    if (value == actions) return;
    actions = value.trim();
    run = null;
  }   // global, if different clears run
  
  get program () {
    return program;
  }        // global
  set program (value) {
    if (value == program) return;
    program = value.trim();
    run = null;
  }   // global, if different clears run
    
  #mode = 'ebnf';
  get mode () {
    return this.#mode;
  }
  set mode (value) {
    if (value == this.#mode) return;
    this.greedy = this.error = this.tShallow = this.tDeep = this.tFollow =
    this.dSets = this.dStates = this.tLookAhead = this.tParser = this.tActions = this.tNoargs =
    this.build = false;
    g = run = null;
    this.#mode = value;
  }      // if different clears all flags, g, run
  
  greedy = false;
  error = false;
  tShallow = false;
  tDeep = false;
  tFollow = false;
  dSets = false;
  dStates = false;
  tLookahead = false;
  tParser = false;
  tActions = false;
  tNoargs = false;
  build = false;
  
  #memory = null;
  get memory () { return this.#memory; }
  
  /** Create a model.
      @param {object} global - either `windows` or `globalThis`.
  */
  constructor (global) {
    // create and initialize "global" variables
    global.actions = '';
    global.g = null;
    global.grammar = '';
    global.program = '';
    global.run = null;
    global.tokens = '';

    if (!('newOutput' in global))
      global.newOutput = (...arg) => {
        console.log('> newOutput');
        if (arg.length > 1 || arg[0].length) console.log(...arg);
      };
    
    if (!('prompt' in global))
      global.prompt = (text, dflt) => { console.log(text + ' > ' + dflt); return dflt; };
    
    if (!('puts' in global))
      global.puts = console.log.bind(console);    

    global.Base = iBase;
    global.EBNF = iEBNF;
    global.BNF = iBNF;
    
    global.Five = iFive;
    global.Six = iSix;
    global.Seven = iSeven;
    global.Eight = iEight;
    global.Ten = iTen;
    global.Eleven = iEleven;
  }
    
  /** Event: `eval?.(tokens)`, if any, and represent and check the grammar;
      modifies `g`, clears `run`, and removes `memory`.
  */
  doNew () {
    // clear globals and remove memory
    const clearAll = () => g = run = this.#memory = null;
    clearAll();

    // compile this.tokens into tokens, set this.skip
    let tokens = null;
    try {
      this.#skip = undefined;
      if (this.tokens.length) {
        tokens = eval?.('(' + this.tokens + '\n)');
        if (tokens[''] instanceof RegExp) this.#skip = tokens[''];
      }
    } catch (e) {
      clearAll();
      newOutput('Error in tokens: ' + (e instanceof Error ? e.message : e));
      return;
    }

    // represent this.grammar as g
    try {
      let cmd;
      switch (this.mode) {

      case 'ebnf':
        const flags = [];
        if (this.tShallow) flags.push('shallow: true');
        if (this.tDeep) flags.push('deep: true');
        if (this.tFollow) flags.push('follow: true');

        cmd = '> g = new EBNF.Grammar(grammar, tokens';
        if (flags.length) cmd += ', { ' + flags.join(', ') + ' }';
        newOutput(cmd + ')');

        g = new EBNF.Grammar(this.grammar, tokens, {
          shallow: this.tShallow,
          deep: this.tDeep,
          follow: this.tFollow,
          log: puts
        });

        if (g && !g.errors) {
          if (this.greedy)
            puts('> g.expect()'), g.expect();
          else
            puts('> g.check()'), g.check();
          puts(this.tShallow|this.tDeep|this.tFollow ? g.dump() : g.toString());
        }
        break;

      case 'stack':
        cmd = '> g = BNF.Grammar.fromEBNF(new EBNF.Grammar(grammar, tokens)';
        if (this.error) cmd += ', { error: true }';
        newOutput(cmd + ')');

        g = BNF.Grammar.fromEBNF(
          new EBNF.Grammar(this.grammar, tokens, {
            log: puts
          }), {
            error: this.error,
            log: puts
          });

        if (g && !g.errors)
          puts(this.dSets ? g.dump(undefined, this.dStates) : g.toString(this.dStates));
        break;

      case 'bnf':
        newOutput('> g = new BNF.Grammar(grammar, tokens)');

        g = new BNF.Grammar(this.grammar, tokens, {
          log: puts
        });

        if (g && !g.errors)
          puts(this.dSets ? g.dump() : g.toString(this.dStates));
      }
    } catch (e) {
      newOutput('Error in new grammar: ' + (e instanceof Error ? e.message : e));
      clearAll();
    }

    if (g && g.errors)
      clearAll();
  }
  
  /** Event: create a scanner and apply it to this.program.
  */
  doScan () {
    puts('do scan', g == null)
    if (!g) return;

    const s = g.scanner(this.skip);
    newOutput(`> g.scanner(${this.skip ?? ''}).pattern =`, s.pattern.toString());
    puts(`> g.scanner(${this.skip ?? ''}).scan(program)`);
    puts(s.scan(this.program.trim()).join('\n'));
  }
  
  /** Event: `eval?.(this.actions)`, if any, create a parser, and parse the program;
      modifies `run` and removes `memory`.
  */ 
  doParse () {
    if (!g) return;

    // clear run and remove memory
    run = this.#memory = null;

    // compile actions, if any
    let actions = null;
    if (this.actions.length)
      try {
        actions = eval?.('(' + this.actions + '\n)');
        if (typeof actions != 'function' && typeof actions != 'object')
          throw 'actions must define a class or an object';
      } catch (e) {
        newOutput('Error in actions: ' + (e instanceof Error ? e.message : e));
        return;
      }

    // parse/compile this.program
    newOutput('');
    switch (this.mode) {

    case 'ebnf':
      if (g.config.lookahead = this.tLookahead) puts('> g.config.lookahead = true');
      if (g.config.parse = this.tParser) puts('> g.config.parse = true');
      if (g.config.actions = this.tActions) puts('> g.config.actions = true');
      if (g.config.noargs = this.tNoargs) puts('> g.config.noargs = true');
      break;

    case 'stack':
      if (g.config.error = this.error) puts('> g.config.error = true');
      if (g.config.lookahead = this.tLookahead) puts('> g.config.lookahead = true');
      if (this.tParser) puts(`> g.config.trace = ${g.config.trace = /./}`);
      else if (this.tActions) puts(`> g.config.trace = ${g.config.trace = /reduce/}`);
      else g.config.trace = null;
      if (g.config.noargs = this.tNoargs) puts('> g.config.noargs = true');
      break;

    case 'bnf':
      if (g.config.build = this.build) puts('> g.config.build = true');
      if (this.tParser) puts(`> g.config.trace = ${g.config.trace = /./}`);
      else if (this.tActions) puts(`> g.config.trace = ${g.config.trace = /reduce/}`);
      else g.config.trace = null;
      if (g.config.noargs = this.tNoargs) puts('> g.config.noargs = true');
    }

    try {
      if (actions) puts(`> run = g.parser(${this.skip ?? ''}).parse(program, actions)`);
      else puts(`> g.parser(${this.skip ?? ''}).parse(program)`);
      puts(g.dump(run = g.parser(this.skip).parse(this.program, actions)));
      if (g.errors) run = null;  // don't allow execution
    } catch (e) {
      if (this.mode != 'ebnf') puts(e instanceof Error ? e.message : e);
      run = null;  // don't allow execution
    } finally {
      if (typeof run != 'function') run = null;  // don't allow execution
    }
  }
  
  /** Event: run the executable, if any.
  */
  doRun () {
    if (typeof run != 'function') return;

    try {
      this.#memory = null;  // no stepping
      newOutput('> run()');
      const result = run();
      puts(run.length == 2 ? result.toString() : g.dump(result));
    } catch (e) { puts(e instanceof Error ? e.message : e); }
  }

  /** Event: step the stack machine, if any.
      @param {number} n - number of steps to execute.
  */
  doStep (n) {
    if (!typeof run == 'function' || run.length != 2) return;

    try {
      if (!this.memory || !this.memory.continue) {
        newOutput(`> memory = run(null, ${n})`);
        this.#memory = run(null, n);
      } else {
        puts(`> memory = run(memory, ${n})`);
        this.#memory = run(this.memory, n);
      }
      if (!this.memory.continue) {
        puts(this.memory.toString());
        this.#memory = null;
      }
    } catch (e) { puts(e instanceof Error ? e.message : e); this.#memory = null; }
  }
}

export { Model };