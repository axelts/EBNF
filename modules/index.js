/** This module implements the _document ready_ event handler
    for [jQuery](https://en.wikipedia.org/wiki/JQuery)
    to control the {@link module:Practice~Model practice page model}, i.e.,
    to edit and run examples.

  @module GUI
  @author © 2023 Axel T. Schreiner <axel@schreiner-family.net>
  @version 2024-02-13
*/

import * as Practice from './practice.js';

/** The _document ready_ event handler.
*/
function browse () {
  // redirect if there is no search
  if (!location.search.length) { location = 'doc/index.html'; return; }
  
  // reference: code to detect how the page was entered
  // const entries = performance.getEntriesByType("navigation");
  // entries.forEach((entry) => {
  //   switch (entry.type) {
  //   case "navigate":     console.log(`${entry.name} was reached from address!`); break;
  //   case "reload":       console.log(`${entry.name} was reloaded!`); break;
  //   case "back_forward": console.log(`${entry.name} was reached from history!`); break;
  //   default:             console.log(`${entry.name} was reached by ${entry.type}!`);
  //   }
  // });
  
  // HTML structure               state variable(s)
  // form class='ebnf|stack|bnf'
  //   id-grammar                 model.grammar                   nested into .frame with .label
  //   id-tokens                  model.tokens                    nested into .frame with .label
  //   id-program                 model.program                   nested into .frame with .label
  //   id-actions                 model.actions                   nested into .frame with .label
  //   id-output                                                  nested into .frame with id-book label
  //   id-mode                    model.mode                      toggles ebnf|stack|bnf
  //   id-greedy    id-error      model.greedy    model.error
  //   id-tShallow  id-dSets      model.tShallow  model.dSets
  //   id-tDeep     id-dStates    model.tDeep     model.dStates
  //   id-tFollow                 model.tFollow
  //   id-new                     model.doNew()
  //   actions                    model.actionsArea               nested into .frame with .label
  //   id-scan                    model.doScan()
  //   id-tLookahead              model.tLookahead
  //   id-tParser                 model.tParser
  //   id-tActions                model.tActions
  //   id-tNoargs                 model.tNoargs
  //   id-build                   model.build
  //   id-parse                   model.doParse()
  //   id-run                     model.doRun()
  //   id-1                       model.doStep(1)
  //   id-10                      model.doStep(10)
  //   id-100                     model.doStep(100)

  // set book button
  {
    let m, book = 'doc/tutorial-a-webpage.html';
    
    if (m = /eg=[01][0-9]\/[012][0-9]/.exec(location.search))
      book = 'doc/tutorial-' + {
          '02': '02-grammars',
          '03': '03-scanner',
          '04': '04-parser',
          '05': '05-lists',
          '06': '06-compile',
          '07': '07-features',
          '08': '08-functions',
          '09': '09-bootstrap',
          '10': '10-bottom-up',
          '11': '11-trees'
        }[m[0].substring(3, 5)] + '.html?' + m[0];
    
    else if (m = /eg=[a-z_]+/.exec(location.search))
      book = {
        interpret: "doc/tutorial-06-compile.html#immediate-evaluation",
        compile: "doc/tutorial-06-compile.html#functional-evaluation",
        postfix: "doc/tutorial-06-compile.html#stack-evaluation",
        stack: "doc/tutorial-06-compile.html#stack-evaluation",
        little: "doc/tutorial-06-compile.html#control-structures",
        little_fn: "doc/tutorial-06-compile.html#functional-programming",
        typing: "doc/tutorial-07-features.html#type-checking-by-interpretation",
        recursion: "doc/tutorial-07-features.html#functions",
        functions: "doc/tutorial-07-features.html#local-variables",
        scopes: "doc/tutorial-07-features.html#block-scopes",
        nesting: "doc/tutorial-07-features.html#nested-functions",
        first_glob: "doc/tutorial-08-functions.html#global-first-order-functions",
        fn_parameter: "doc/tutorial-08-functions.html#functions-as-argument-values",
        first: "doc/tutorial-08-functions.html#nested-first-order-functions",
        curry: "doc/tutorial-08-functions.html#nested-first-order-functions",
        compose: "doc/tutorial-08-functions.html#nested-first-order-functions",
        bootstrap: "doc/tutorial-09-bootstrap.html#bootstrap-example",
        extend: "doc/tutorial-09-bootstrap.html#extending-the-grammars'-grammar"
      }[m[0].substring(3)];
          
    $('#id-book').attr('href', book);
  }
  
  // create model, creates and sets global variables
  const model = new Practice.Model(window);

  // set window.newOutput: (re)start output
  newOutput = (...s) => $('#id-output').val(s.join(' '));
  
  // set window.puts: append to output
  puts = (...s) => {
    const output = $('#id-output'),
      head = output.val(),
      nl = head.length && ! head.endsWith('\n') ? '\n' : '';
    output.val(head + nl + s.join(' '));
    output.scrollTop(output.prop("scrollHeight"));
  };

  // manage local storage, if possible
  $(document).on('visibilitychange', () => {
    try {
      localStorage.setItem('EBNF/state', [
          '%% grammar\n' + model.grammar.trim() + '\n',
          '%% tokens\n' + model.tokens.trim() + '\n',
          '%% actions\n' + model.actions.trim() + '\n',
          '%% program\n' + model.program.trim() + '\n'
        ].join('')
      );
    } catch (e) { console.error('localStorage.setItem failed: ', e.message); }          
  });
  const getState = () => {
    try {
      return localStorage.getItem('EBNF/state');
    } catch (e) {
      console.error('localStorage.getItem failed: ', e.message);
      return null;
    }          
  };
  const removeState = () => {
    try {
      localStorage.removeItem('EBNF/state');
    } catch (e) { console.error('localStorage.removeItem failed: ', e.message); }          
  };
  
  // run user interface from text, if any
  const ui = function (text) {
    
    // no text? use or clear local storage
    if (typeof text != 'string' || !text.length) {
      // failed search?
      if (document.location.search.length > 1)
        removeState();
      else
        text = getState();
    }
    
    // load from text, if any
    if (typeof text == 'string' && text.length) {
      document.title = 'Example ' + stem.replace(/^0/, '');      
      
      // clear and load all text areas, tell model
      $('textarea').val('');
      text.split(/%%/).forEach(part => {
        try {
          const id = part.match(/\s+(grammar|tokens|program|actions|output)\s+/)[1];
          part = part.replace(/^[^\n]*\n/, '').replace(/\n*$/, '');
          switch (id) {
          case 'grammar': $('#id-grammar').val(model.grammar = part); break;
          case 'tokens':  $('#id-tokens').val(model.tokens = part); break;
          case 'program': $('#id-program').val(model.program = part); break;
          case 'actions': $('#id-actions').val(model.actions = part); break;
          case 'output':  $('#id-output').val(part);
          }
        } catch (e) { }
      });      
    }
    
    // capture initial heights (?? not good if window is resized)
    const vh = { };
    $('.frame textarea').each(function () { vh[$(this).attr('id')] = $(this).height(); })

    // stack machine test
    const isStackMachine = () => typeof run == 'function' && run.length == 2;
    
    // maintain text area contents and set buttons to reflect contents
    const setButtons  = function () {
            
      // deactivate all buttons
      $('.button').removeClass('ok');
      $('#id-1, #id-10, #id-100').addClass('hidden');

      // toggle-button clicks - toggle 'on' and flag in model
      $('.button.toggle').each(function () {
        const name = $(this).attr('id').substring(3);
        console.assert(typeof model[name] == 'boolean', name, 'is not boolean');
        if (model[name]) $(this).addClass('on'); else $(this).removeClass('on');
      });

      // mode - always ok
      $('#id-mode').addClass('ok');

      // new - requires text in grammar
      if (model.grammar.length) $('#id-new').addClass('ok');
      
      switch (model.mode) {
      case 'ebnf':
        // greedy shallow deep follow - require text in grammar
        if (model.grammar.length)
          $('#id-greedy, #id-tShallow, #id-tDeep, #id-tFollow').addClass('ok');
        break;
        
      case 'stack':
        // error sets states - require text in grammar
        if (model.grammar.length) $('#id-error').addClass('ok');
      case 'bnf':
        // sets states - require text in grammar
        if (model.grammar.length) $('#id-dSets, #id-dStates').addClass('ok');
      }
      
      // scan lookahead parser actions noargs build parse - require represented grammar
      if (g != null) {
        $('#id-scan, #id-tLookahead, #id-tParser, #id-tActions, #id-tNoargs, #id-parse').addClass('ok');
        if (model.mode == 'bnf') $('#id-build').addClass('ok');
      }
      
      // run 1 10 100 - require represented grammar, run, and possibly stack machine
      if (g != null && typeof run == 'function') {
        $('#id-run').addClass('ok');
        if (isStackMachine()) $('#id-1, #id-10, #id-100').addClass('ok').removeClass('hidden');
      }
    }
    setButtons();

    // deactivate all buttons if textarea gets edited
    $('textarea').on('focus', () => {
      $('.button').removeClass('ok');
      // $('#id-1, #id-10, #id-100').addClass('hidden');
    });
    // (re-)activate once focus is out of textarea
    $('textarea').on('blur', setButtons);

    // mode click - next mode, need to recreate window.g and window.run
    $('#id-mode').click(() => {
      $('form').removeClass(model.mode);
      model.mode = model.mode == 'ebnf' ? 'stack' : model.mode == 'stack' ? 'bnf' : 'ebnf';
      $('form').addClass(model.mode);
      newOutput('');
      setButtons();
    });

    // act on change
    $('#id-grammar').change(function () {
      model.grammar = $(this).val().trim();
      newOutput('');
      setButtons();
    });   // need to recreate g and run
    $('#id-tokens').change(function () {
      model.tokens = $(this).val().trim();
      newOutput('');
      setButtons();
    });    // need to recreate g and run
    $('#id-actions').change(function () {
      model.actions = $(this).val().trim();
      newOutput('');
      setButtons();
    });   // need to recreate run
    $('#id-program').change(function () {
      model.program = $(this).val().trim();
      newOutput('');
      setButtons();
    });   // need to recreate run
        
    // click/shift-click on label to emphasize or default textarea layout
    $('#id-grammar, #id-tokens, #id-actions, #id-program').prev('.label').
      click(function (event) {
        if (event.shiftKey)
          $('.frame textarea').each(function () { $(this).height(vh[$(this).attr('id')]); });
        else if (!(event.metaKey || event.altKey)) {
          const area = $(this).next('textarea'), id = area.attr('id');
          let height = 0;
          $('#id-grammar, #id-tokens, #id-actions, #id-program').each(function () {
            height += $(this).height() - 30; $(this).height(30);
          });
          area.height(height + 30);
        }
      });

      // alt-click handler to open popup with highlighted (non-empty) text location
    const highlighter = (name, js) =>
      function (event) {
        if (!(event.metaKey || event.altKey)) return;
        const text = $(this).next('textarea').val();
        if (!text.length) return;
        const prefix = location.href.replace(/EBNF.*/, 'EBNF/doc/');
        const html = `<!DOCTYPE html>
          <html>
            <head>
              <title> ${name} </title>
                <link rel="stylesheet" type="text/css"
                  href="${prefix}styles/sunlight.default.css">
                <script src="${prefix}sunlight-all-min.js"></script>` +
                (js ? `<script src="${prefix}sunlight.javascript.js"></script>` : ``) +
            `</head>
            <body>
              <h3> ${name} </h3>
              <pre id="code" class="sunlight-highlight-${js ? 'javascript' : 'plaintext'}">${text}</pre>
              </div>
              <script> 
                new Sunlight.Highlighter({
                  lineNumbers: true,
                  tabWidth: 2 }).highlightNode(document.getElementById("code"))
              </script>
            <body>
          </html>`;
        const winUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        window.open(winUrl, 'source', 'popup,width=800,height=400,screenX=200,screenY=200');
      };

    // alt-click on label to syntax-color in popup
    $('#id-grammar').prev('.label').click(highlighter('grammar', false));
    $('#id-program').prev('.label').click(highlighter('program', false));
    $('#id-tokens').prev('.label').click(highlighter('tokens', true));
    $('#id-actions').prev('.label').click(highlighter('actions', true));
    $('#id-output').prev('.label').click(highlighter('output', false));
    
    // toggle-button clicks - toggle 'on' and flag in model
    $('.button.toggle').click(function () {
      if ($(this).hasClass('ok')) {
        const name = $(this).attr('id').substring(3);
        console.assert(typeof model[name] == 'boolean', name, 'is not boolean');
        model[name] = !model[name];
        $(this).toggleClass('on');
      }
    });

    // new Grammar
    $('#id-new').click(function () {
      if ($(this).hasClass('ok')) {
        model.doNew();
        setButtons();
      }
    });

    // scanner
    $('#id-scan').click(function () {
      if ($(this).hasClass('ok'))
        model.doScan();
    });

    // parser/compiler
    $('#id-parse').click(function () {
      if ($(this).hasClass('ok')) {
        model.doParse();
        setButtons();
      }
    });

    // run
    $('#id-run').click(function () {
      if ($(this).hasClass('ok'))
        model.doRun();
    });

    // 1 10 100
    $('#id-1, #id-10, #id-100').click(function () {
      if ($(this).hasClass('ok'))
        model.doStep(parseInt($(this).attr('id').substring(3), 10));
    });
  }

  // determine search parameters, if any 
  const params = new URLSearchParams(document.location.search),
    stem = params.get('eg');
  
  // set form class=' ebnf|stack|bnf ' from mode
  switch (model.mode = params.get('mode')) {
  default:
    model.mode = 'ebnf';
  case 'stack':
  case 'bnf':
    $('form').removeClass('ebnf stack bnf').addClass(model.mode);
  }
  
  // delegate to user interface
  if (stem && /^[/0-9a-zA-Z_]+$/.test(stem))
    $.get('eg/' + stem + '.eg', ui, 'text').fail(ui);
  else
    ui();
}
$(browse);

export { browse };