function setupMethods(Lang) {
  Lang.addHandler('value', {
    type: 'method',
    call: (target, args, scope) => {
      if (target && target.__mel_waiting) {
        const sourceElement = args.length > 0 ? args[0] : target.__mel_element_ref;
        target.__mel_value_source = sourceElement;
        return target;
      }

      if (!target || !target.__mel_element) {
        Lang.error('value() only works on UI elements.');
      }

      if (!target.__mel_dom) {
        Lang.error('The element has not yet been rendered.');
      }

      if (args.length > 0) {
        target.__mel_dom.value = String(args[0]);
        return target;
      }

      return target.__mel_dom.value || '';
    },
  });

  Lang.addHandler('text', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_element) {
        Lang.error('text() only works on UI elements');
      }

      if (!target.__mel_dom) {
        Lang.error('Element not rendered yet');
      }

      if (args.length > 0) {
        target.__mel_dom.textContent = String(args[0]);
        return target;
      }

      return target.__mel_dom.textContent;
    },
  });

  Lang.addHandler('placeholder', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_element) {
        Lang.error('placeholder() only works on UI elements');
      }

      if (!target.__mel_dom) {
        Lang.error('Element not rendered yet');
      }

      target.__mel_dom.placeholder = String(args[0]);
      return target;
    },
  });

  Lang.addHandler('html', {
    type: 'method',
    call: (target, args, scope) => {
      if (!target || !target.__mel_element) {
        Lang.error('html() only works on MEL elements');
      }

      if (args.length === 0) {
        Lang.error('html() requires HTML content');
      }

      const htmlContent = String(args[0]);
      target.__mel_html = htmlContent;

      if (target.__mel_rendered && target.__mel_dom) {
        target.__mel_dom.innerHTML = htmlContent;
      } else {
        const originalRender = target.__mel_render;
        if (originalRender) {
          target.__mel_render = function () {
            originalRender.call(this);
            if (this.__mel_dom && this.__mel_html) {
              this.__mel_dom.innerHTML = this.__mel_html;
            }
          };
        }
      }

      return target;
    },
  });

  Lang.addHandler('length', {
    type: 'method',
    call: (target, args, scope) => {
      if (Array.isArray(target)) {
        return target.length;
      }

      if (typeof target === 'string') {
        return target.length;
      }

      if (target && typeof target === 'object') {
        return Object.keys(target).length;
      }

      Lang.error('length only works on arrays, strings, or objects');
    },
  });

  Lang.addHandler('startsWith', {
    type: 'method',
    call: (target, args, scope) => {
      const search = String(args[0]);
      return String(target).startsWith(search);
    },
  });

  Lang.addHandler('endsWith', {
    type: 'method',
    call: (target, args, scope) => {
      const search = String(args[0]);
      return String(target).endsWith(search);
    },
  });

  Lang.addHandler('includes', {
    type: 'method',
    call: (target, args, scope) => {
      const search = args[0];
      if (Array.isArray(target)) {
        return target.includes(search);
      }
      return String(target).includes(String(search));
    },
  });

  Lang.addHandler('replace', {
    type: 'method',
    call: (target, args, scope) => {
      const search = String(args[0]);
      const replace = String(args[1]);
      return String(target).replace(search, replace);
    },
  });

  Lang.addHandler('replaceAll', {
    type: 'method',
    call: (target, args, scope) => {
      const search = String(args[0]);
      const replace = String(args[1]);
      return String(target).replaceAll(search, replace);
    },
  });

  Lang.addHandler('split', {
    type: 'method',
    call: (target, args, scope) => {
      const separator = args[0] !== undefined ? String(args[0]) : ',';
      return String(target).split(separator);
    },
  });

  Lang.addHandler('join', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('join() only works on arrays');
      }
      const separator = args[0] !== undefined ? String(args[0]) : ',';
      return target.join(separator);
    },
  });

  Lang.addHandler('trim', {
    type: 'method',
    call: (target, args, scope) => {
      return String(target).trim();
    },
  });

  Lang.addHandler('toLowerCase', {
    type: 'method',
    call: (target, args, scope) => {
      return String(target).toLowerCase();
    },
  });

  Lang.addHandler('toUpperCase', {
    type: 'method',
    call: (target, args, scope) => {
      return String(target).toUpperCase();
    },
  });

  Lang.addHandler('substring', {
    type: 'method',
    call: (target, args, scope) => {
      const start = args[0] || 0;
      const end = args[1];
      return String(target).substring(start, end);
    },
  });

  Lang.addHandler('charAt', {
    type: 'method',
    call: (target, args, scope) => {
      const index = args[0] || 0;
      return String(target).charAt(index);
    },
  });

  Lang.addHandler('indexOf', {
    type: 'method',
    call: (target, args, scope) => {
      const search = args[0];
      if (Array.isArray(target)) {
        return target.indexOf(search);
      }
      return String(target).indexOf(String(search));
    },
  });

  Lang.addHandler('lastIndexOf', {
    type: 'method',
    call: (target, args, scope) => {
      const search = args[0];
      if (Array.isArray(target)) {
        return target.lastIndexOf(search);
      }
      return String(target).lastIndexOf(String(search));
    },
  });

  Lang.addHandler('slice', {
    type: 'method',
    call: (target, args, scope) => {
      const start = args[0] || 0;
      const end = args[1];
      if (Array.isArray(target)) {
        return target.slice(start, end);
      }
      return String(target).slice(start, end);
    },
  });

  Lang.addHandler('reverse', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('reverse() only works on arrays');
      }
      return target.reverse();
    },
  });

  Lang.addHandler('sort', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('sort() only works on arrays');
      }
      return target.sort();
    },
  });

  Lang.addHandler('push', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('push() only works on arrays');
      }
      for (let i = 0; i < args.length; i++) {
        target.push(args[i]);
      }
      return target.length;
    },
  });

  Lang.addHandler('pop', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('pop() only works on arrays');
      }
      return target.pop();
    },
  });

  Lang.addHandler('shift', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('shift() only works on arrays');
      }
      return target.shift();
    },
  });

  Lang.addHandler('unshift', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('unshift() only works on arrays');
      }
      for (let i = 0; i < args.length; i++) {
        target.unshift(args[i]);
      }
      return target.length;
    },
  });

  Lang.addHandler('concat', {
    type: 'method',
    call: (target, args, scope) => {
      if (Array.isArray(target)) {
        return target.concat(...args);
      }
      return String(target).concat(...args.map((a) => String(a)));
    },
  });

  Lang.addHandler('repeat', {
    type: 'method',
    call: (target, args, scope) => {
      const count = args[0] || 1;
      return String(target).repeat(count);
    },
  });

  Lang.addHandler('padStart', {
    type: 'method',
    call: (target, args, scope) => {
      const length = args[0] || 0;
      const fill = args[1] !== undefined ? String(args[1]) : ' ';
      return String(target).padStart(length, fill);
    },
  });

  Lang.addHandler('padEnd', {
    type: 'method',
    call: (target, args, scope) => {
      const length = args[0] || 0;
      const fill = args[1] !== undefined ? String(args[1]) : ' ';
      return String(target).padEnd(length, fill);
    },
  });

  Lang.addHandler('length', {
    type: 'method',
    call: (target, args, scope) => {
      if (Array.isArray(target) || typeof target === 'string') {
        return target.length;
      }
      Lang.error('length only works on arrays and strings');
    },
  });

  Lang.addHandler('keys', {
    type: 'method',
    call: (target, args, scope) => {
      if (typeof target !== 'object' || target === null) {
        Lang.error('keys() only works on objects');
      }
      return Object.keys(target);
    },
  });

  Lang.addHandler('values', {
    type: 'method',
    call: (target, args, scope) => {
      if (typeof target !== 'object' || target === null) {
        Lang.error('values() only works on objects');
      }
      return Object.values(target);
    },
  });

  Lang.addHandler('entries', {
    type: 'method',
    call: (target, args, scope) => {
      if (typeof target !== 'object' || target === null) {
        Lang.error('entries() only works on objects');
      }
      return Object.entries(target);
    },
  });

  Lang.addHandler('map', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('map() only works on arrays');
      }

      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('map() requires a function as argument');
      }

      const result = [];

      for (let i = 0; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], target[i]);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], i);
        }
        if (callback.params.length > 2) {
          originalSet.call(newScope, callback.params[2], target);
        }

        let returnValue = null;

        for (let j = 0; j < callback.body.length; j++) {
          try {
            Lang.state.executeStatement(callback.body[j], newScope);
          } catch (e) {
            if (e.type === 'RETURN') {
              returnValue = e.value;
              break;
            }
            throw e;
          }
        }

        result.push(returnValue);
      }

      return result;
    },
  });

  Lang.addHandler('filter', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('filter() only works on arrays');
      }

      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('filter() requires a function as argument');
      }

      const result = [];

      for (let i = 0; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], target[i]);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], i);
        }
        if (callback.params.length > 2) {
          originalSet.call(newScope, callback.params[2], target);
        }

        let returnValue = false;

        for (let j = 0; j < callback.body.length; j++) {
          try {
            Lang.state.executeStatement(callback.body[j], newScope);
          } catch (e) {
            if (e.type === 'RETURN') {
              returnValue = e.value;
              break;
            }
            throw e;
          }
        }

        if (returnValue) {
          result.push(target[i]);
        }
      }

      return result;
    },
  });

  Lang.addHandler('reduce', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('reduce() only works on arrays');
      }

      const callback = args[0];
      const initialValue = args[1];

      if (!callback || !callback.params) {
        Lang.error('reduce() requires a function as argument');
      }

      let accumulator = initialValue !== undefined ? initialValue : target[0];
      let startIndex = initialValue !== undefined ? 0 : 1;

      for (let i = startIndex; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], accumulator);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], target[i]);
        }
        if (callback.params.length > 2) {
          originalSet.call(newScope, callback.params[2], i);
        }
        if (callback.params.length > 3) {
          originalSet.call(newScope, callback.params[3], target);
        }

        let returnValue = accumulator;

        for (let j = 0; j < callback.body.length; j++) {
          try {
            Lang.state.executeStatement(callback.body[j], newScope);
          } catch (e) {
            if (e.type === 'RETURN') {
              returnValue = e.value;
              break;
            }
            throw e;
          }
        }

        accumulator = returnValue;
      }

      return accumulator;
    },
  });

  Lang.addHandler('forEach', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('forEach() only works on arrays');
      }

      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('forEach() requires a function as argument');
      }

      for (let i = 0; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], target[i]);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], i);
        }
        if (callback.params.length > 2) {
          originalSet.call(newScope, callback.params[2], target);
        }

        for (let j = 0; j < callback.body.length; j++) {
          Lang.state.executeStatement(callback.body[j], newScope);
        }
      }

      return target;
    },
  });

  Lang.addHandler('find', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('find() only works on arrays');
      }

      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('find() requires a function as argument');
      }

      for (let i = 0; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], target[i]);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], i);
        }
        if (callback.params.length > 2) {
          originalSet.call(newScope, callback.params[2], target);
        }

        let returnValue = false;

        for (let j = 0; j < callback.body.length; j++) {
          try {
            Lang.state.executeStatement(callback.body[j], newScope);
          } catch (e) {
            if (e.type === 'RETURN') {
              returnValue = e.value;
              break;
            }
            throw e;
          }
        }

        if (returnValue) {
          return target[i];
        }
      }

      return null;
    },
  });

  Lang.addHandler('every', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('every() only works on arrays');
      }

      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('every() requires a function as argument');
      }

      for (let i = 0; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], target[i]);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], i);
        }

        let returnValue = false;

        for (let j = 0; j < callback.body.length; j++) {
          try {
            Lang.state.executeStatement(callback.body[j], newScope);
          } catch (e) {
            if (e.type === 'RETURN') {
              returnValue = e.value;
              break;
            }
            throw e;
          }
        }

        if (!returnValue) {
          return false;
        }
      }

      return true;
    },
  });

  Lang.addHandler('some', {
    type: 'method',
    call: (target, args, scope) => {
      if (!Array.isArray(target)) {
        Lang.error('some() only works on arrays');
      }

      const callback = args[0];
      if (!callback || !callback.params) {
        Lang.error('some() requires a function as argument');
      }

      for (let i = 0; i < target.length; i++) {
        const newScope = new Map();
        const originalGet = Map.prototype.get;
        const originalSet = Map.prototype.set;
        const originalHas = Map.prototype.has;

        newScope.__parent = scope;

        newScope.get = function (key) {
          if (originalHas.call(this, key)) {
            return originalGet.call(this, key);
          }
          if (this.__parent) {
            return this.__parent.get(key);
          }
          return undefined;
        };

        newScope.set = function (key, value) {
          if (this.__parent && this.__parent.has(key) && !originalHas.call(this, key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
          if (originalHas.call(this, key)) return true;
          if (this.__parent) return this.__parent.has(key);
          return false;
        };

        if (callback.params.length > 0) {
          originalSet.call(newScope, callback.params[0], target[i]);
        }
        if (callback.params.length > 1) {
          originalSet.call(newScope, callback.params[1], i);
        }

        let returnValue = false;

        for (let j = 0; j < callback.body.length; j++) {
          try {
            Lang.state.executeStatement(callback.body[j], newScope);
          } catch (e) {
            if (e.type === 'RETURN') {
              returnValue = e.value;
              break;
            }
            throw e;
          }
        }

        if (returnValue) {
          return true;
        }
      }

      return false;
    },
  });
}
