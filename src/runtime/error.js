let _errorHandling = false;

function error(message, lineOverride, errorInfo) {
  const lineNum = (lineOverride !== undefined ? lineOverride : state.currentLine) + 1;
  const targetLine = lineOverride !== undefined ? lineOverride : state.currentLine;
  const startLine = Math.max(0, targetLine - 1);
  const endLine = Math.min(state.lines.length - 1, targetLine + 1);

  const source = state.currentSource || 'main';

  let errorMsg = 'Error in: ' + source + '\n';
  errorMsg += 'Code:\n';
  for (let i = startLine; i <= endLine; i++) {
    const prefix = i === targetLine ? ' -> ' : '    ';
    errorMsg += i + 1 + '|' + prefix + state.lines[i] + '\n';
  }
  errorMsg += 'LINE: ' + lineNum + '\n';
  errorMsg += message;

  const melScript = state.variables.get('MEL_SCRIPT');

  const errorObject = {
    message: message,
    fullMessage: errorMsg,
    line: lineNum,
    source: source,
    code: state.lines[targetLine] || '',
    context: {
      before: state.lines[startLine] || '',
      current: state.lines[targetLine] || '',
      after: state.lines[endLine] || '',
    },
  };

  if (errorInfo) {
    if (errorInfo.expected) errorObject.expected = errorInfo.expected;
    if (errorInfo.got) errorObject.got = errorInfo.got;
    if (errorInfo.variable) errorObject.variable = errorInfo.variable;
    if (errorInfo.value !== undefined) errorObject.value = errorInfo.value;
    if (errorInfo.operator) errorObject.operator = errorInfo.operator;
    if (errorInfo.suggestion) errorObject.suggestion = errorInfo.suggestion;
  }

  if (
    melScript &&
    typeof melScript.ERROR_TYPES === 'object' &&
    melScript.ERROR_TYPES.params &&
    !_errorHandling
  ) {
    _errorHandling = true;

    const func = melScript.ERROR_TYPES;
    const newScope = new Map();
    newScope.__parent = state.variables;

    const originalGet = Map.prototype.get;
    const originalSet = Map.prototype.set;
    const originalHas = Map.prototype.has;

    newScope.get = function (key) {
      if (originalHas.call(this, key)) return originalGet.call(this, key);
      if (this.__parent) return this.__parent.get(key);
      return undefined;
    };
    newScope.set = function (key, value) {
      if (this.__parent && this.__parent.has(key)) return this.__parent.set(key, value);
      return originalSet.call(this, key, value);
    };
    newScope.has = function (key) {
      if (originalHas.call(this, key)) return true;
      if (this.__parent) return this.__parent.has(key);
      return false;
    };

    if (func.params.length > 0) {
      const paramName = typeof func.params[0] === 'string' ? func.params[0] : func.params[0].name;
      originalSet.call(newScope, paramName, errorObject);
    }

    try {
      for (let i = 0; i < func.body.length; i++) {
        state.executeStatement(func.body[i], newScope);
      }
    } catch (e) {
      if (e.type !== 'RETURN') {
        _errorHandling = false;
        throw e;
      }
    }

    _errorHandling = false;

    const err = new Error(errorMsg);
    err.melFormatted = errorMsg;
    err.melSilent = true;
    err.melHandled = true;
    throw err;
  }

  if (melScript && melScript.CONFIG === 'web') {
    console.error(errorMsg);
  }

  const err = new Error(errorMsg);
  err.melFormatted = errorMsg;
  err.melSilent = melScript && melScript.CONFIG === 'web';
  throw err;
}
