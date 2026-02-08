function setupNetwork(Lang) {
  function markNodes(node, source, code, lines) {
    if (!node) return;
    if (typeof node !== 'object') return;

    node.__mel_source = source;
    node.__mel_code = code;
    node.__mel_lines = lines;

    for (let key in node) {
      const value = node[key];

      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            markNodes(value[i], source, code, lines);
          }
        } else {
          markNodes(value, source, code, lines);
        }
      }
    }
  }

  Lang.addHandler('import', {
    type: 'function',
    call: (args, scope, executeStatement) => {
      if (args.length === 0) {
        Lang.error('import() requires a file path');
      }

      for (let argIndex = 0; argIndex < args.length; argIndex++) {
        const path = String(args[argIndex]);

        if (Lang.state.importedFiles.has(path)) {
          continue;
        }

        Lang.state.importedFiles.add(path);

        const xhr = new XMLHttpRequest();
        xhr.open('GET', path, false);

        try {
          xhr.send(null);
        } catch (e) {
          Lang.error('Failed to load file: ' + path + ' - ' + e.message);
        }

        if (xhr.status !== 200) {
          Lang.error('File not found: ' + path + ' (HTTP ' + xhr.status + ')');
        }

        const code = xhr.responseText;

        const savedSource = Lang.state.currentSource;
        const savedCode = Lang.state.code;
        const savedLines = Lang.state.lines;

        Lang.state.currentSource = path;
        Lang.state.code = code;
        Lang.state.lines = code.split('\n');

        try {
          const tokens = Lang.state.tokenize(code);
          const ast = Lang.state.parse(tokens);

          for (let i = 0; i < ast.length; i++) {
            markNodes(ast[i], path, code, code.split('\n'));
          }

          for (let i = 0; i < ast.length; i++) {
            executeStatement(ast[i], scope);
          }

          Lang.state.currentSource = savedSource;
          Lang.state.code = savedCode;
          Lang.state.lines = savedLines;
        } catch (err) {
          Lang.state.currentSource = savedSource;
          Lang.state.code = savedCode;
          Lang.state.lines = savedLines;
          throw err;
        }
      }

      return null;
    },
  });

  Lang.addHandler('request', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('request() requires a URL');
      }

      const url = String(args[0]);

      if (args.length === 1) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);

        try {
          xhr.send(null);
        } catch (e) {
          return 'Request Error: Connection failed';
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          return xhr.responseText;
        } else if (xhr.status === 0) {
          return 'Request Error: Connection failed';
        } else {
          return 'Request Error: HTTP ' + xhr.status;
        }
      }

      const options = args[1] || {};
      const method = options.method || 'GET';
      const headers = options.headers || {};
      const body = options.body;

      const xhr = new XMLHttpRequest();
      xhr.open(method, url, false);

      for (let key in headers) {
        xhr.setRequestHeader(key, headers[key]);
      }

      try {
        if (body) {
          if (typeof body === 'object') {
            const jsonBody = JSON.stringify(body);
            xhr.send(jsonBody);
          } else {
            xhr.send(String(body));
          }
        } else {
          xhr.send(null);
        }
      } catch (e) {
        return 'Request Error: Connection failed';
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        return xhr.responseText;
      } else if (xhr.status === 0) {
        return 'Request Error: Connection failed';
      } else {
        return 'Request Error: HTTP ' + xhr.status;
      }
    },
  });

  const jsScriptCache = new Map();
  const callModeCache = new WeakMap();

  function detectCallMode(fn) {
    if (callModeCache.has(fn)) return callModeCache.get(fn);
    try {
      fn.call(undefined);
      callModeCache.set(fn, 'call');
      return 'call';
    } catch (e) {
      if (e instanceof TypeError) {
        callModeCache.set(fn, 'new');
        return 'new';
      }
      return null;
    }
  }

  function createSmartCallable(fn) {
    const mode = detectCallMode(fn);

    if (mode === 'new') {
      const wrapper = function (...args) {
        return new fn(...args);
      };
      wrapper.__mel_original = fn;
      return wrapper;
    }
    if (mode === 'call') {
      const wrapper = function (...args) {
        return fn(...args);
      };
      wrapper.__mel_original = fn;
      return wrapper;
    }

    let resolvedMode = null;
    const wrapper = function (...args) {
      if (resolvedMode === 'new') return new fn(...args);
      if (resolvedMode === 'call') return fn(...args);
      try {
        const result = fn(...args);
        resolvedMode = 'call';
        return result;
      } catch (e) {
        resolvedMode = 'new';
        return new fn(...args);
      }
    };
    wrapper.__mel_original = fn;
    return wrapper;
  }

  function wrapLibrary(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    if (obj.__mel_wrapped) return obj;

    const cache = new Map();

    const proxy = new Proxy(obj, {
      get(target, prop) {
        if (prop === '__mel_wrapped') return true;
        if (cache.has(prop)) return cache.get(prop);

        const value = target[prop];
        if (value === undefined || value === null) return value;

        let result;
        if (typeof value === 'function') {
          result = createSmartCallable(value);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          result = wrapLibrary(value);
        } else {
          result = value;
        }

        if (typeof result === 'function' || (typeof result === 'object' && result !== null)) {
          cache.set(prop, result);
        }
        return result;
      },
    });

    return proxy;
  }

  Lang.addHandler('js', {
    type: 'method',
    call: (target, args, scope) => {
      if (args.length === 0) {
        Lang.error('import.js() requires a URL');
      }

      const url = String(args[0]);

      if (jsScriptCache.has(url)) {
        return jsScriptCache.get(url);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);

      try {
        xhr.send(null);
      } catch (e) {
        Lang.error('Failed to load JS library: ' + url + ' - ' + e.message);
      }

      if (xhr.status !== 200) {
        Lang.error('JS library not found: ' + url + ' (HTTP ' + xhr.status + ')');
      }

      const code = xhr.responseText;
      const hasExport = /\bexport\s+(default\s+|{|\*|const|let|var|function|class)/i.test(code);

      if (hasExport) {
        const libName =
          url
            .split('/')
            .reverse()
            .find((p) => p && p !== 'dist' && p !== 'build' && !p.includes('.'))
            ?.replace(/-es$/, '')
            .replace(/-/g, '_')
            .toUpperCase() || 'LIB';

        const waitObj = {
          __mel_waiting: true,
          __mel_return_value: null,
          __mel_submit: null,
          __mel_rendered: false,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            Lang.state.paused = true;

            import(url)
              .then((module) => {
                const exported = module.default || module;
                const realLib = wrapLibrary(exported);

                scope.set(libName, realLib);
                jsScriptCache.set(url, realLib);
                this.__mel_return_value = realLib;

                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              })
              .catch((e) => {
                Lang.error('Failed to load ES6 module: ' + url + ' - ' + e.message);
              });
          },
        };

        return waitObj;
      }

      try {
        const beforeKeys = new Set(Object.keys(window));

        const inlineScript = document.createElement('script');
        inlineScript.textContent = code;
        document.head.appendChild(inlineScript);

        const newKeys = Object.keys(window).filter((key) => !beforeKeys.has(key));
        let mainLib = null;

        for (let i = 0; i < newKeys.length; i++) {
          const name = newKeys[i];
          const value = window[name];

          if (typeof value === 'function') {
            const smart = createSmartCallable(value);
            Lang.addHandler(name, {
              type: 'function',
              call: (args) => smart(...args),
            });
          } else if (typeof value === 'object' && value !== null) {
            const wrapped = wrapLibrary(value);
            scope.set(name, wrapped);
            if (!mainLib) mainLib = wrapped;
          } else {
            scope.set(name, value);
          }
        }

        scope.set('document', document);
        scope.set('window', window);

        jsScriptCache.set(url, mainLib || true);
        return mainLib || true;
      } catch (e) {
        Lang.error('Failed to execute JS library: ' + url + ' - ' + e.message);
      }
    },
  });
}
