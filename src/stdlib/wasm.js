function setupWasm(Lang) {
  const wasmCache = new Map();
  let loopOptimizer = null;
  const WASM_BASE_PATH = 'src/stdlib/wasmLib/';
  
  
  function createTypedValue(value, type, config) {
    const rules = config || {};
    
    if (typeof value !== 'number') {
      Lang.error(type + ' requires a number, got ' + typeof value);
    }
    
    if (rules.unsigned && value < 0) {
      Lang.error(type + ' does not accept negative values. Got: ' + value);
    }
    
    if (rules.min !== undefined && value < rules.min) {
      Lang.error(type + ' value must be >= ' + rules.min + '. Got: ' + value);
    }
    
    if (rules.max !== undefined && value > rules.max) {
      Lang.error(type + ' value must be <= ' + rules.max + '. Got: ' + value);
    }
    
    if (rules.integer && !Number.isInteger(value)) {
      Lang.error(type + ' requires an integer. Got: ' + value);
    }
    
    return {
      __mel_typed: true,
      __mel_type: type,
      __mel_value: value,
      __mel_raw: value,
      
      valueOf: function() {
        return this.__mel_value;
      },
      
      toString: function() {
        return this.__mel_type + '(' + this.__mel_value + ')';
      }
    };
  }
  
  Lang.addHandler('Int32', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Int32() requires a value');
      }
      
      return createTypedValue(args[0], 'Int32', {
        integer: true,
        min: -2147483648,
        max: 2147483647
      });
    }
  });
  
  Lang.addHandler('UInt32', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('UInt32() requires a value');
      }
      
      return createTypedValue(args[0], 'UInt32', {
        unsigned: true,
        integer: true,
        min: 0,
        max: 4294967295
      });
    }
  });
  
  Lang.addHandler('Int64', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Int64() requires a value');
      }
      
      return createTypedValue(args[0], 'Int64', {
        integer: true,
        min: Number.MIN_SAFE_INTEGER,
        max: Number.MAX_SAFE_INTEGER
      });
    }
  });
  
  Lang.addHandler('UInt64', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('UInt64() requires a value');
      }
      
      return createTypedValue(args[0], 'UInt64', {
        unsigned: true,
        integer: true,
        min: 0,
        max: Number.MAX_SAFE_INTEGER
      });
    }
  });
  
  Lang.addHandler('Float32', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Float32() requires a value');
      }
      
      return createTypedValue(args[0], 'Float32', {
        min: -3.4028235e38,
        max: 3.4028235e38
      });
    }
  });
  
  Lang.addHandler('Float64', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Float64() requires a value');
      }
      
      return createTypedValue(args[0], 'Float64', {});
    }
  });
  
  function unwrapValue(val) {
    if (val && val.__mel_typed) {
      return val.__mel_value;
    }
    return val;
  }

  
  function ensureLoopOptimizer() {
    if (loopOptimizer) return loopOptimizer;
    
    const optimizerPath = WASM_BASE_PATH + 'loop-optimizer.wasm';
    
    const xhr = new XMLHttpRequest();
    xhr.open('GET', optimizerPath, false);
    xhr.overrideMimeType('text/plain; charset=x-user-defined');
    
    try {
      xhr.send(null);
    } catch (e) {
      throw new Error('Failed to load loop-optimizer.wasm from ' + optimizerPath);
    }
    
    if (xhr.status !== 200) {
      throw new Error('loop-optimizer.wasm not found at ' + optimizerPath);
    }
    
    const responseText = xhr.responseText;
    const wasmBuffer = new Uint8Array(responseText.length);
    for (let i = 0; i < responseText.length; i++) {
      wasmBuffer[i] = responseText.charCodeAt(i) & 0xff;
    }
    
    const wasmModule = new WebAssembly.Module(wasmBuffer);
    const wasmInstance = new WebAssembly.Instance(wasmModule, {
      env: { memory: new WebAssembly.Memory({ initial: 256 }) }
    });
    
    loopOptimizer = wasmInstance.exports;
    return loopOptimizer;
  }
  
  Lang.addHandler('WasmFor', {
    type: 'executor',
    execute: (stmt, scope, evaluate, executeStatement) => {
      
      try {
        const wasm = ensureLoopOptimizer();
        
        const start = evaluate(stmt.init.value, scope);
        const end = evaluate(stmt.condition.right, scope);
        
        if (stmt.body.length === 1 && stmt.body[0].type === 'Assignment') {
          const assignment = stmt.body[0];
          
          if (assignment.value.type === 'BinaryOp') {
            const op = assignment.value.operator;
            const varName = assignment.name;
            const initial = scope.get(varName) || 0;
            
            let result;
            
            if (op === '+') {
              result = wasm.sumLoop(start, end);
            } else if (op === '*') {
              result = wasm.multLoop(start, end, initial);
            } else {
              const opCode = { '+': 0, '-': 1, '*': 2, '/': 3 }[op] || 0;
              result = wasm.genericLoop(start, end, initial, opCode);
            }
            
            scope.set(varName, result);
            scope.set(stmt.init.name, end);
            
            return;
          }
        }
        
        throw new Error('Pattern not optimizable');
        
      } catch (e) {
        console.warn('[MelScript] WASM optimization failed, running in JS:', e.message);
        
        if (stmt.init) executeStatement(stmt.init, scope);
        
        while (evaluate(stmt.condition, scope)) {
          try {
            for (let i = 0; i < stmt.body.length; i++) {
              executeStatement(stmt.body[i], scope);
            }
          } catch (e) {
            if (e.type === 'BREAK') break;
            if (e.type === 'CONTINUE') {
              if (stmt.increment) executeStatement(stmt.increment, scope);
              continue;
            }
            throw e;
          }
          
          if (stmt.increment) executeStatement(stmt.increment, scope);
        }
      }
    }
  });
  
  Lang.addHandler('wasm', {
    type: 'method',
    call: (target, args, scope) => {
      if (args.length === 0) {
        Lang.error('wasm() requires a module name');
      }
      
      let moduleName = String(args[0]);
      const imports = args.length > 1 ? args[1] : null;
      
      let path;
      
      if (moduleName.startsWith('/') || moduleName.startsWith('http')) {
        path = moduleName;
      }
      else if (moduleName.endsWith('.wasm')) {
        path = moduleName;
      }
      else {
        path = WASM_BASE_PATH + moduleName + '.wasm';
      }
      
      if (wasmCache.has(path)) {
        return wasmCache.get(path);
      }
      
      const importObject = { env: {} };
      
      if (imports && typeof imports === 'object') {
        for (let key in imports) {
          importObject.env[key] = imports[key];
        }
      }
      
      if (!importObject.env.memory) {
        importObject.env.memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
      }
      
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, false);
      xhr.overrideMimeType('text/plain; charset=x-user-defined');
      
      try {
        xhr.send(null);
      } catch (e) {
        Lang.error('Failed to load Wasm file: ' + path + ' - ' + e.message);
      }
      
      if (xhr.status !== 200) {
        Lang.error('Wasm file not found: ' + path + ' (HTTP ' + xhr.status + ')');
      }
      
      const responseText = xhr.responseText;
      const wasmBuffer = new Uint8Array(responseText.length);
      for (let i = 0; i < responseText.length; i++) {
        wasmBuffer[i] = responseText.charCodeAt(i) & 0xff;
      }
      
      let wasmModule;
      let wasmInstance;
      
      try {
        wasmModule = new WebAssembly.Module(wasmBuffer);
        wasmInstance = new WebAssembly.Instance(wasmModule, importObject);
      } catch (e) {
        Lang.error('Failed to compile/instantiate Wasm: ' + e.message);
      }
      
      const wasmWrapper = {
        __mel_wasm: true,
        __mel_path: path,
        __mel_instance: wasmInstance,
        __mel_module: wasmModule,
        __mel_memory: wasmInstance.exports.memory || importObject.env.memory
      };
      
      const exports = wasmInstance.exports;
      for (let key in exports) {
        if (typeof exports[key] === 'function') {
          wasmWrapper[key] = function(...args) {
            const unwrappedArgs = args.map(unwrapValue);
            
            try {
              return exports[key](...unwrappedArgs);
            } catch (e) {
              Lang.error('Error calling Wasm function "' + key + '": ' + e.message);
            }
          };
        } else {
          wasmWrapper[key] = exports[key];
        }
      }
      
      wasmWrapper.getMemory = function() {
        return this.__mel_memory;
      };
      
      wasmWrapper.readString = function(ptr, length) {
        if (!this.__mel_memory) {
          Lang.error('No memory export found in Wasm module');
        }
        const bytes = new Uint8Array(this.__mel_memory.buffer, ptr, length);
        return new TextDecoder().decode(bytes);
      };
      
      wasmWrapper.writeString = function(str, ptr) {
        if (!this.__mel_memory) {
          Lang.error('No memory export found in Wasm module');
        }
        const bytes = new TextEncoder().encode(str);
        const mem = new Uint8Array(this.__mel_memory.buffer);
        for (let i = 0; i < bytes.length; i++) {
          mem[ptr + i] = bytes[i];
        }
        return bytes.length;
      };
      
      wasmWrapper.listExports = function() {
        const exportList = [];
        for (let key in exports) {
          exportList.push({
            name: key,
            type: typeof exports[key] === 'function' ? 'function' : 'value'
          });
        }
        return exportList;
      };
      
      wasmCache.set(path, wasmWrapper);
      
      return wasmWrapper;
    }
  });
}
