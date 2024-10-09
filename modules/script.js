/** This module implements a server function for [node.js](https://en.wikipedia.org/wiki/Node.js)
    to script the {@link module:Practice~Model practice page model}, i.e.,
    to run the examples from the command line.

  @module Script
  @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
  @version 2024-02-13
*/

import * as readline from 'readline';
import * as fs from 'fs';
import * as Practice from './practice.js';

/** The server function.
    Blank-separated words, read from standard input, have the effects described below.
    Any other word is interpreted as a path from which an example
    is merged into the global strings.

| word | effect |
| ---- | ------ |
| `model` | resets all flags and variables. |
| `load` | resets global strings. |
| `ebnf`, `stack`, `bnf` | clear all flags and set a mode. |
| `actions`, `build`, `deep`, `error`, `follow`, `greedy`,<br>`noargs`, `lookahead`, `parser`, `sets`, `shallow`, `states` | toggle flags. |
| `new` | calls {@linkcode module:Practice~Model#doNew model.doNew()}. |
| `scan` | calls {@linkcode module:Practice~Model#doScan model.doScan()}. |
| `parse` | calls {@linkcode module:Practice~Model#doParse model.doParse()}. |
| `run` | calls {@linkcode module:Practice~Model#doRun model.doRun()}. |
| `1` | calls {@linkcode module:Practice~Model#doStep model.doStep(1)}. |
| `10` | calls {@linkcode module:Practice~Model#doStep model.doStep(10)}. |
| `100` | calls {@linkcode module:Practice~Model#doStep model.doStep(100)}. |
| exit | terminates the script |

@example <caption> Load an example, compile and run with each parser, overwrite parts, and repeat. </caption>
$ node script.js << 'end'
  model eg/06/06.eg      new parse run   stack new parse run
  ebnf  test/06-06a.eg   new parse run   stack new parse run
end
*/
async function script () {
  let model;
  const newModel = () => model = new Practice.Model(globalThis);
  newModel();
  
  for await (const line of readline.createInterface({ input: process.stdin })) {
    const words = line.split(/\s+/);
    words.forEach(word => {
      if (!word.length) return;
      console.log('>', word);
      switch (word) {
      case 'model':             // model -- reset all
        newModel();
        return;
    
      case 'load':              // load -- reset text areas
        model.grammar = '';     // %% grammar
        model.tokens = '';      // %% tokens
        model.actions = '';     // %% actions
        model.program = '';     // %% program
        return;
    
      default:                  // path (cannot contain blanks)
        try {
          const text = fs.readFileSync(word, 'utf8');
          if (!text.length) {
            console.log('no text:', word);
            return;
          }

          text.split(/%%/).forEach(part => {
            try {
              const id = part.match(/\s+(grammar|tokens|actions|program)\s+/)[1],
                value = part.replace(/^[^\n]*\n/, '').replace(/\n*$/, '');
              switch (id) {
              case 'grammar':   model.grammar = value; return;
              case 'tokens':    model.tokens = value; return;
              case 'actions':   model.actions = value; return;
              case 'program':   model.program = value; return;
              }
            } catch (e) { }
          });      
          return;
        } catch (e) {
          console.log(word + ':', e instanceof Error ? e.message : e);
          process.exit(1);
        }
    
      case 'ebnf':              // ebnf -- set mode, clear all flags
      case 'stack':             // stack -- set mode, clear all flags
      case 'bnf':               // bnf -- set mode, clear all flags
        model.mode = word;
        console.log('> model.mode =', model.mode);
        return;

      case 'greedy':            // greedy -- toggle flag
      case 'error':             // error -- toggle flag
      case 'build':             // build -- toggle flag
        model[word] = !model[word];
        console.log(`> model.${word} = ${model[word]}`);
        return;
      
      case 'shallow':           // shallow -- toggle flag
      case 'deep':              // deep -- toggle flag
      case 'follow':            // follow -- toggle flag
      case 'lookahead':         // lookahead -- toggle flag
      case 'parser':            // parser -- toggle flag
      case 'actions':           // actions -- toggle flag
      case 'noargs':            // noargs -- toggle flag
        { const name = 't' + word[0].toUpperCase() + word.substr(1);
          model[name] = !model[name];
          console.log(`> model.${name} = ${model[name]}`);
          return;
        }
      
      case 'sets':              // sets -- toggle flag
      case 'states':            // states -- toggle flag
        { const name = 'd' + word[0].toUpperCase() + word.substr(1);
          model[name] = !model[name];
          console.log(`> model.${name} = ${model[name]}`);
          return;
        }
    
      case 'new':
        model.doNew();
        return;
      
      case 'scan':
        model.doScan();
        return;

      case 'parse':
        model.doParse();
        return;

      case 'run':
        model.doRun();
        return;

      case '1':
      case '10':
      case '100':
        model.doStep(parseInt(word, 10));
        return;
    
      case 'exit':
        process.exit(0);
      }
    });
  }
}
script()

export { script };