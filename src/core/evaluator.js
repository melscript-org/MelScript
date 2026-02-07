const argsPool = [];

function getArgsArray(size) {
  if (argsPool.length > 0) {
    const arr = argsPool.pop();
    arr.length = 0;
    return arr;
  }
  return [];
}

function returnArgsArray(arr) {
  if (argsPool.length < 100) {
    argsPool.push(arr);
  }
}

function evaluate(node, scope) {
    if (!scope) scope = state.variables;
    if (!node) return null;
       
    const previousSource = state.currentSource;
    const previousCode = state.code;
    const previousLines = state.lines;
    
    if (node.__mel_source) {
      state.currentSource = node.__mel_source;
      state.code = node.__mel_code;
      state.lines = node.__mel_lines;
    }
    
    if (node.line !== undefined) {
      state.currentLine = node.line;
    }
    
    try {
    
    if (node.type === 'Literal') {
      return node.value;
    }    
    
    if (node.type === 'FunctionExpression') {   
    return {
      params: node.params,
      body: node.body,
      name: node.name || null
    };
  }
  
if (node.type === 'PostfixMemberOp') {
  const object = evaluate(node.target.object, scope);
  
  if (object === undefined || object === null) {
    error('Cannot read property of undefined');
  }
  
  const property = node.target.computed ? evaluate(node.target.property, scope) : node.target.property;
  const currentValue = object[property];
  
  if (node.operator === '++') {
    object[property] = currentValue + 1;
    return currentValue;
  } else if (node.operator === '--') {
    object[property] = currentValue - 1;
    return currentValue;
  }
}  
  
if (node.type === 'PrefixOp') {
  if (!scope.has(node.name)) {
    error('Variable "' + node.name + '" is not defined');
  }
  
  const currentValue = scope.get(node.name);
  
  if (node.operator === '++') {
    scope.set(node.name, currentValue + 1);
    return currentValue + 1;
  } else if (node.operator === '--') {
    scope.set(node.name, currentValue - 1);
    return currentValue - 1;
  }
}

 if (node.type === 'PostfixOp') {
  if (!scope.has(node.name)) {
    error('Variable "' + node.name + '" is not defined');
  }
  
  const currentValue = scope.get(node.name);
  
  if (node.operator === '++') {
    scope.set(node.name, currentValue + 1);
    return currentValue;
  } else if (node.operator === '--') {
    scope.set(node.name, currentValue - 1);
    return currentValue;
  }
}



if (node.type === 'Template') {
  let result = '';
  
  for (let i = 0; i < node.parts.length; i++) {
    result += node.parts[i];
    
    if (i < node.expressions.length) {
      const expr = node.expressions[i];
      
      const exprCode = typeof expr === 'string' ? expr : expr.code;
      const exprLine = typeof expr === 'object' && expr.line !== undefined ? expr.line : node.line;
      
      const exprTokens = state.tokenize(exprCode);
      
      let pos = 0;
      
      function peek() {
        while (pos < exprTokens.length && exprTokens[pos].type === 'NEWLINE') pos++;
        return exprTokens[pos];
      }
      
      function next() {
        while (pos < exprTokens.length && exprTokens[pos].type === 'NEWLINE') pos++;
        return exprTokens[pos++];
      }
          
      const wrappedCode = `__temp = ${exprCode}`;
      const wrappedTokens = state.tokenize(wrappedCode);
      const wrappedAst = state.parse(wrappedTokens);
      
      let exprValue;
      if (wrappedAst.length > 0 && wrappedAst[0].type === 'Assignment') {
        exprValue = evaluate(wrappedAst[0].value, scope);
      } else {
        exprValue = '';
      }
      
      result += String(exprValue);
    }
  }
  
  return result;
}

if (node.type === 'Spread') {
  const value = evaluate(node.operand, scope);
  if (!Array.isArray(value)) {
    error('Spread operator can only be used on arrays');
  }
  return { __mel_spread: true, values: value };
}
    
   if (node.type === 'Array') {
  const result = [];
  for (let i = 0; i < node.elements.length; i++) {
    const el = node.elements[i];
    const evaluated = evaluate(el, scope);
    
    if (evaluated && evaluated.__mel_spread) {
      for (let j = 0; j < evaluated.values.length; j++) {
        result.push(evaluated.values[j]);
      }
    } else {
      result.push(evaluated);
    }
  }
  return result;
}

if (node.type === 'ExpressionStatement') {
  return evaluate(node.expression, scope);
}

if (node.type === 'UnaryOp') {
  const operand = evaluate(node.operand, scope);
  if (node.operator === '!') return !operand;
  if (node.operator === '-') return -operand;
  if (node.operator === '+') return +operand;
  error('Unknown unary operator: ' + node.operator);
}    
    
if (node.type === 'Object') {
  const obj = {};
  for (let i = 0; i < node.properties.length; i++) {
    const prop = node.properties[i];
    
    if (prop.type === 'spread') {
      const spreadValue = evaluate(prop.value, scope);
      if (typeof spreadValue !== 'object' || spreadValue === null || Array.isArray(spreadValue)) {
        error('Spread in objects can only be used with objects');
      }
      for (let key in spreadValue) {
        obj[key] = spreadValue[key];
      }
    } else {
      obj[prop.key] = evaluate(prop.value, scope);
    }
  }
  return obj;
}  
    
    if (node.type === 'MemberAccess') {
      const object = evaluate(node.object, scope);
      
      if (object === null || object === undefined) {
        const propName = node.computed ? evaluate(node.property, scope) : node.property;
        error('Cannot read property "' + propName + '" of ' + object);
      }
      
      const property = node.computed ? evaluate(node.property, scope) : node.property;
      return object[property];
    }
    
   if (node.type === 'Keyword') {
  if (node.value === 'this') {
    if (scope.has('this')) {
      return scope.get('this');
    }
    error('Cannot use "this" outside of a class method');
  }
  
  const handler = state.handlers.get(node.value);
  if (handler && handler.type === 'value') {
    return handler.value;
  }
  error('Unknown keyword: ' + node.value);
}
    
   if (node.type === 'Identifier') {
  if (state.handlers.has(node.name)) {
    const handler = state.handlers.get(node.name);
    if (handler && handler.type === 'function') {
      return handler;
    }
  }
  
  if (!scope.has(node.name)) {
    error('Variable "' + node.name + '" is not defined');
  }
  return scope.get(node.name);
}
    
    if (node.type === 'Ternary') {
  const condition = evaluate(node.condition, scope);
  if (condition) {
    return evaluate(node.consequent, scope);
  } else {
    return evaluate(node.alternate, scope);
  }
}

if (node.type === 'ArrowFunction') {
    return {
      params: node.params,
      body: node.body,
      isArrow: true
    };
  }
  
 
if (node.type === 'BinaryOp') {
  const left = evaluate(node.left, scope);
  const right = evaluate(node.right, scope);
  
  const leftType = typeof left;
  const rightType = typeof right;
  
  const melScript = scope.get('MEL_SCRIPT');
  const strictTypes = melScript && melScript.STRICT_TYPES === true;
  
  if (node.line !== undefined) {
    state.currentLine = node.line;
  }
  
  switch (node.operator) {
    case '+':    
    if (strictTypes) {
        if (leftType === 'string' && rightType === 'number') {
          error('Cannot concatenate string with number', undefined, {
            expected: 'string',
            got: 'number',
            value: right,
            operator: '+',
            suggestion: 'Use string() to convert'
          });
        }
        if (leftType === 'number' && rightType === 'string') {
          error('Cannot concatenate number with string', undefined, {
            expected: 'number',
            got: 'string',
            value: right,
            operator: '+',
            suggestion: 'Use Number() to convert'
          });
        }
      }
      
            
      if (leftType === 'string' || rightType === 'string') {
        return String(left) + String(right);
      }     
      if (leftType === 'number' && rightType === 'number') {
        return left + right;
      }      
      if (Array.isArray(left) && Array.isArray(right)) {
        return left.concat(right);
      }
      error('Unsupported operand type(s) for +: "' + leftType + '" and "' + rightType + '"');
      
    case '-':
    case '*':
    case '/':
    case '%':
    
      if (strictTypes) {
        if (leftType !== 'number' || rightType !== 'number') {
          const opName = {'-': 'subtraction', '*': 'multiplication', '/': 'division', '%': 'modulo'}[node.operator];
          error('Cannot perform ' + opName + ' with "' + leftType + '" and "' + rightType + '"', undefined, {
            expected: 'number',
            got: leftType !== 'number' ? leftType : rightType,
            value: leftType !== 'number' ? left : right,
            operator: node.operator,
            suggestion: 'Use Number() to convert'
          });
        }
      
      } else {

        const leftNum = Number(left);
        const rightNum = Number(right);
        
        if (isNaN(leftNum) || isNaN(rightNum)) {
          const opName = {'-': 'subtraction', '*': 'multiplication', '/': 'division', '%': 'modulo'}[node.operator];
          error('Cannot perform ' + opName + ' - invalid number conversion');
        }
        
        if (node.operator === '-') return leftNum - rightNum;
        if (node.operator === '*') return leftNum * rightNum;
        if (node.operator === '/') return leftNum / rightNum;
        if (node.operator === '%') return leftNum % rightNum;
      }
          
      if (node.operator === '-') return left - right;
      if (node.operator === '*') return left * right;
      if (node.operator === '/') return left / right;
      if (node.operator === '%') return left % right;
      
    case '===':
    case '!==':
    case '==':
    case '!=':
    case '<':
    case '>':
    case '<=':
    case '>=':
      
      if (node.operator === '===') return left === right;
      if (node.operator === '!==') return left !== right;
      
      if (node.operator === '==') {     
        if ((typeof left === 'object' && left !== null) || (typeof right === 'object' && right !== null)) {
          return left === right;
        }
       
        if (typeof left !== typeof right) {
          return false;
        }       
        return left == right;
      }
      
      if (node.operator === '!=') {     
        if ((typeof left === 'object' && left !== null) || (typeof right === 'object' && right !== null)) {
          return left !== right;
        }
        if (typeof left !== typeof right) {
          return true;
        }
        return left != right;
      }
      
      if (node.operator === '<') return left < right;
      if (node.operator === '>') return left > right;
      if (node.operator === '<=') return left <= right;
      if (node.operator === '>=') return left >= right;
      
    case '&&':
    case '||':
      return node.operator === '&&' ? left && right : left || right;
      
    default:
      error('Unknown operator: ' + node.operator);
  }
}
    
if (node.type === 'MethodCall') {
  const object = evaluate(node.object, scope);
  const methodName = node.method;
  
  const handler = state.handlers.get(methodName);
  
  if (handler && (handler.type === 'method' || handler.type === 'dual')) {
    const args = node.args.map(function(arg) { return evaluate(arg, scope); });
      
    if (handler.type === 'dual' && handler.callAsMethod) {
      return handler.callAsMethod(object, args, scope);
    }   
    return handler.call(object, args, scope);
  }
 
  if (object && typeof object[methodName] === 'function') {
    const args = node.args.map(function(arg) { return evaluate(arg, scope); });
    return object[methodName].apply(object, args);
  }
  
  if (object && object[methodName] && object[methodName].params) {
    const func = object[methodName];
    const newScope = new Map();
    const originalGet = Map.prototype.get;
    const originalSet = Map.prototype.set;
    const originalHas = Map.prototype.has;
    
    newScope.__parent = scope;
    
    newScope.get = function(key) {
      if (originalHas.call(this, key)) {
        return originalGet.call(this, key);
      }
      if (this.__parent) {
        return this.__parent.get(key);
      }
      return undefined;
    };
    
    newScope.set = function(key, value) {
  
  if (this.__parent && this.__parent.has(key)) {
    return this.__parent.set(key, value);
  }
  return originalSet.call(this, key, value);
};
    
    newScope.has = function(key) {
      if (originalHas.call(this, key)) return true;
      if (this.__parent) return this.__parent.has(key);
      return false;
    };
    
   for (let i = 0; i < func.params.length; i++) {
      const param = func.params[i];
      const paramName = typeof param === 'string' ? param : param.name;
      
      let argValue;
      if (i < node.args.length) {
        argValue = evaluate(node.args[i], scope);
        if (argValue && argValue.__mel_waiting) {
          return argValue;
        }
      } else if (typeof param === 'object' && param.default !== null) {
        argValue = evaluate(param.default, newScope);
      } else {
        argValue = undefined;
      }
      
      originalSet.call(newScope, paramName, argValue);
    }
    
    try {
      let returnValue = null;
      for (let i = 0; i < func.body.length; i++) {
        const stmtResult = state.executeStatement(func.body[i], newScope);
        if (stmtResult && stmtResult.__mel_waiting) {
          return stmtResult;
        }
      }
      return returnValue;
    } catch (e) {
      if (e.type === 'RETURN') {
        if (e.value && e.value.__mel_waiting) {
          return e.value;
        }
        return e.value;
      }
      throw e;
    }
  }
  
  error('Method "' + methodName + '" is not defined');
}    

if (node.type === 'Keyword') {
  if (node.value === 'this') {
    if (scope.has('this')) {
      return scope.get('this');
    }
    error('Cannot use "this" outside of a class method');
  }
  
  const handler = state.handlers.get(node.value);
  if (handler && handler.type === 'value') {
    return handler.value;
  }
  error('Unknown keyword: ' + node.value);
}

if (node.type === 'Call') {
  const handler = state.handlers.get(node.name);

  if (handler && (handler.type === 'function' || handler.type === 'dual')) {
    const values = getArgsArray();
    for (let i = 0; i < node.args.length; i++) {
      values.push(evaluate(node.args[i], scope));
    }
       
    let result;
    if (handler.type === 'dual' && handler.callAsFunction) {
      result = handler.callAsFunction(values, scope, state.executeStatement);
    } else {
      result = handler.call(values, scope, state.executeStatement);
    }
    
    returnArgsArray(values);
    
    if (result && result.__mel_waiting) {
      return result;
    }
    
    return result;
  }
  
  if (handler && handler.type === 'function') {
    const values = getArgsArray();
    for (let i = 0; i < node.args.length; i++) {
      values.push(evaluate(node.args[i], scope));
    }
    
    const result = handler.call(values, scope, state.executeStatement);
    
    returnArgsArray(values);
    
    if (result && result.__mel_waiting) {
      return result;
    }
    
    return result;
  }
  
  if (!scope.has(node.name)) {
    error('Function "' + node.name + '" is not defined');
  }
  
  const func = scope.get(node.name);
  
  if (typeof func === 'object' && func !== null && !func.params) {
    error('"' + node.name + '" is an object, not a function');
  }
  
if (!func || (typeof func !== 'function' && !func.params)) {
  error('"' + node.name + '" is not a function');
}  
  
  const newScope = new Map();
  
  if (typeof func === 'function') {
  const values = getArgsArray();
  for (let i = 0; i < node.args.length; i++) {
    values.push(evaluate(node.args[i], scope));
  }
  const result = func.apply(null, values);
  returnArgsArray(values);
  return result;
}
 
  newScope.__parent = scope;
  
  const originalGet = Map.prototype.get;
  const originalSet = Map.prototype.set;
  const originalHas = Map.prototype.has;
  
  newScope.get = function(key) {
    if (originalHas.call(this, key)) {
      return originalGet.call(this, key);
    }
    if (this.__parent) {
      return this.__parent.get(key);
    }
    return undefined;
  };
  
  newScope.set = function(key, value) {

  if (this.__parent && this.__parent.has(key)) {
    return this.__parent.set(key, value);
  }
  return originalSet.call(this, key, value);
};
  
  newScope.has = function(key) {
    if (originalHas.call(this, key)) {
      return true;
    }
    if (this.__parent) {
      return this.__parent.has(key);
    }
    return false;
  };
  
  if (func.restParam) {
    const restArgs = [];
    for (let i = func.params.length; i < node.args.length; i++) {
      const argValue = evaluate(node.args[i], scope);
      if (argValue && argValue.__mel_waiting) {
        return argValue;
      }
      restArgs.push(argValue);
    }
    originalSet.call(newScope, func.restParam, restArgs);
  }
    
for (let i = 0; i < func.params.length; i++) {
  const param = func.params[i];
  const paramName = typeof param === 'string' ? param : param.name;
  
  let argValue;
  if (i < node.args.length) {   
    const arg = node.args[i];
    if (arg.type === 'Identifier' && !scope.has(arg.name)) {
      error('Variable "' + arg.name + '" is not defined');
    }
    
    argValue = evaluate(arg, scope);
    if (argValue && argValue.__mel_waiting) {
      return argValue;
    }
  } else if (typeof param === 'object' && param.default !== null) {
    argValue = evaluate(param.default, newScope);
  } else {
    argValue = undefined;
  }
  
  originalSet.call(newScope, paramName, argValue);
}
  
  try {
    let returnValue = null;
    for (let i = 0; i < func.body.length; i++) {
      const stmtResult = state.executeStatement(func.body[i], newScope);
      
      if (stmtResult && stmtResult.__mel_waiting) {
        return stmtResult;
      }
    }
    return returnValue;
  } catch (e) {
    if (e.type === 'RETURN') {
      if (e.value && e.value.__mel_waiting) {
        return e.value;
      }
      return e.value;
    }
    throw e;
  }
}

  } finally {
  
    if (node.__mel_source) {
      state.currentSource = previousSource;
      state.code = previousCode;
      state.lines = previousLines;
    }
  }
}
