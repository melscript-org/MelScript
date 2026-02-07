function setupData(Lang) {
    


 Lang.addKeyword('true');
  Lang.addHandler('true', {
    type: 'value',
    value: true
  });

  Lang.addKeyword('false');
  Lang.addHandler('false', {
    type: 'value',
    value: false
  });

  Lang.addKeyword('null');
  Lang.addHandler('null', {
    type: 'value',
    value: null
  });
  
  Lang.addHandler('Json', {
  type: 'value',
  value: {
    encode: function(value, space) {
      try {
        if (space !== undefined) {
          return JSON.stringify(value, null, space);
        }
        return JSON.stringify(value);
      } catch (e) {
        Lang.error('Failed to encode value: ' + e.message);
      }
    },
    
    decode: function(str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        Lang.error('Failed to decode JSON: ' + e.message);
      }
    }
  }
});

Lang.addKeyword('Json');

Lang.addHandler('Number', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) return 0;
    const value = args[0];
    const num = Number(value);
    if (isNaN(num)) {
      Lang.error('Cannot convert "' + value + '" to number');
    }
    return num;
  }
});

Lang.addHandler('String', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) return '';
    return String(args[0]);
  }
});

Lang.addHandler('Boolean', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) return false;
    return Boolean(args[0]);
  }
});

Lang.addHandler('parseInt', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) {
      Lang.error('parseInt requires at least 1 argument');
    }
    const radix = args.length > 1 ? args[1] : 10;
    const result = parseInt(args[0], radix);
    if (isNaN(result)) {
      Lang.error('Cannot parse "' + args[0] + '" as integer');
    }
    return result;
  }
});

Lang.addHandler('parseFloat', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) {
      Lang.error('parseFloat requires 1 argument');
    }
    const result = parseFloat(args[0]);
    if (isNaN(result)) {
      Lang.error('Cannot parse "' + args[0] + '" as float');
    }
    return result;
  }
});

Lang.addHandler('isNaN', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) return true;
    return isNaN(args[0]);
  }
});




Lang.addHandler('eval', {
  type: 'function',
  call: (args, scope) => {
    if (args.length === 0) {
      Lang.error('eval requires 1 argument');
    }
    const code = String(args[0]);
    
    const originalSource = Lang.state.currentSource;
    const originalCode = Lang.state.code;
    const originalLines = Lang.state.lines;
    
    Lang.state.currentSource = 'eval';
    Lang.state.code = code;
    Lang.state.lines = code.split('\n');
    
    try {
      const tempVar = '__eval_result_' + Date.now();
      const evalCode = tempVar + ' = ' + code;
      
      const tokens = Lang.state.tokenize(evalCode);
      const ast = Lang.state.parse(tokens);
      
      for (let i = 0; i < ast.length; i++) {
        Lang.state.executeStatement(ast[i], Lang.state.variables);
      }
      
      const result = Lang.state.variables.get(tempVar);
      Lang.state.variables.delete(tempVar);
      
      Lang.state.currentSource = originalSource;
      Lang.state.code = originalCode;
      Lang.state.lines = originalLines;
      
      return result;
    } catch (e) {
      throw e;
    }
  }
});

Lang.addHandler('Date', {
  type: 'value',
  value: {
    now: function() {
      return Date.now();
    }
  }
});

Lang.addHandler('performance', {
  type: 'value',
  value: {
    now: function() {
      return performance.now();
    }
  }
});

Lang.addKeyword('performance');

Lang.addKeyword('Date');

Lang.addHandler('Math', {
  type: 'value',
  value: {  
    random: () => Math.random(),
    floor: (x) => Math.floor(x),
    ceil: (x) => Math.ceil(x),
    round: (x) => Math.round(x),
    abs: (x) => Math.abs(x),
    sqrt: (x) => Math.sqrt(x),
    pow: (x, y) => Math.pow(x, y),
      
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    tan: (x) => Math.tan(x),
    asin: (x) => Math.asin(x),
    acos: (x) => Math.acos(x),
    atan: (x) => Math.atan(x),
    atan2: (y, x) => Math.atan2(y, x),
    min: (a, b) => Math.min(a, b),
    max: (a, b) => Math.max(a, b),
    sign: (x) => Math.sign(x),
    trunc: (x) => Math.trunc(x),
    
    PI: Math.PI,
    E: Math.E
  }
});

Lang.addHandler('getPixelRatio', {
  type: 'function',
  call: (args, scope) => {
    return window.devicePixelRatio || 1;
  }
});

Lang.addKeyword('Math');

Lang.addHandler('string', {
  type: 'value',
  value: {
    from: function(value) {
      if (value === null || value === undefined) {
        return '';
      }
      return String(value);
    },
    
    split: function(str, separator) {
      return String(str).split(separator);
    },
    
    join: function(arr, separator) {
      if (!Array.isArray(arr)) {
        Lang.error('join() requires an array');
      }
      return arr.join(separator || '');
    },
    
    toUpperCase: function(str) {
      return String(str).toUpperCase();
    },
    
    toLowerCase: function(str) {
      return String(str).toLowerCase();
    },
    
    trim: function(str) {
      return String(str).trim();
    },
    
    replace: function(str, search, replace) {
      return String(str).replace(search, replace);
    },
    
    includes: function(str, search) {
      return String(str).includes(search);
    },
    
    startsWith: function(str, search) {
      return String(str).startsWith(search);
    },
    
    endsWith: function(str, search) {
      return String(str).endsWith(search);
    }
  }
});

Lang.addKeyword('string');

function getDimension(target, dimension) {
  if (!target) {
    Lang.error('get' + dimension.charAt(0).toUpperCase() + dimension.slice(1) + '() requires an element');
  }
  
  if (target.__mel_ctx || target.__mel_gl) {
    return target['__mel_' + dimension] || 0;
  }
  
  if (target.__mel_dom) {
    const rect = target.__mel_dom.getBoundingClientRect();
    return rect[dimension];
  }
  
  if (target.__mel_container) {
    const rect = target.__mel_container.getBoundingClientRect();
    return rect[dimension];
  }
  
  if (target.__mel_input) {
    const rect = target.__mel_input.getBoundingClientRect();
    return rect[dimension];
  }
  
  return 0;
}

Lang.addHandler('getWidth', {
  type: 'method',
  call: (target, args, scope) => {
    return getDimension(target, 'width');
  }
});

Lang.addHandler('getHeight', {
  type: 'method',
  call: (target, args, scope) => {
    return getDimension(target, 'height');
  }
});
}
