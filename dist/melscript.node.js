/** MelScript Node Bundle **/

if (typeof window === 'undefined') {
    global.window = global;
}
// Stubs para funções de UI/Canvas removidas
global.setupUI = function() {};
global.setupCanvas = function() {};
global.setupAnimation = function() {};
global.setupAudio = function() {};
global.setupStorage = function() {};
global.setupThreads = function() {};


/* FILE: src/core/state.js */
const state = {
  variables: new Map(),
  handlers: new Map(),
  keywords: new Set(),
  code: '',
  lines: [],
  currentLine: 0,
  currentSource: null,
  tokenize: null,
  parse: null,
  executeStatement: null,
  importedFiles: new Set(),
  paused: false,
  queue: [],
  currentIndex: 0,
  currentScope: null,
  astCache: new Map(),
};


/* FILE: src/runtime/error.js */
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


/* FILE: src/core/tokenizer.js */
function tokenize(code) {
  const tokens = [];
  const len = code.length;
  let i = 0;
  let line = 0;
  const openSymbols = [];

  while (i < len) {
    const c = code.charCodeAt(i);

    if (c === 10) {
      tokens.push({ type: 'NEWLINE', value: '\n', line });
      line++;
      i++;
      continue;
    }

    if (c === 32 || c === 9 || c === 13) {
      i++;
      continue;
    }

    if (c === 47) {
      const next = i + 1 < len ? code.charCodeAt(i + 1) : NaN;
      if (next === 47) {
        i += 2;
        while (i < len && code.charCodeAt(i) !== 10) {
          i++;
        }
        continue;
      }
      if (next === 42) {
        const startLine = line;
        i += 2;
        let foundEnd = false;
        while (i < len) {
          const ch = code.charCodeAt(i);
          if (ch === 42 && i + 1 < len && code.charCodeAt(i + 1) === 47) {
            i += 2;
            foundEnd = true;
            break;
          }
          if (ch === 10) {
            line++;
          }
          i++;
        }
        if (!foundEnd) {
          state.currentLine = startLine;
          error('Unterminated comment (expected */)');
        }
        continue;
      }
    }

    if (c === 34 || c === 39) {
      const quote = c;
      let str = '';
      const startLine = line;
      i++;
      let foundEnd = false;

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (ch === quote) {
          foundEnd = true;
          break;
        }
        if (ch === 10) {
          state.currentLine = startLine;
          error('String cannot contain newlines. Use backticks (`) for multi-line strings');
        }
        if (ch === 92 && i + 1 < len) {
          i++;
          const esc = code.charCodeAt(i);
          if (esc === 110) str += '\n';
          else if (esc === 116) str += '\t';
          else if (esc === 114) str += '\r';
          else str += code[i];
        } else {
          str += code[i];
        }
        i++;
      }
      if (!foundEnd) {
        state.currentLine = startLine;
        error('Unterminated string (expected ' + String.fromCharCode(quote) + ')');
      }
      i++;
      tokens.push({ type: 'STRING', value: str, line: startLine });
      continue;
    }

    if (c === 96) {
      const parts = [];
      const expressions = [];
      let currentStr = '';
      const startLine = line;
      i++;
      let foundEnd = false;

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (ch === 96) {
          foundEnd = true;
          break;
        }
        if (ch === 92 && i + 1 < len) {
          i++;
          const esc = code.charCodeAt(i);
          if (esc === 110) currentStr += '\n';
          else if (esc === 116) currentStr += '\t';
          else if (esc === 114) currentStr += '\r';
          else currentStr += code[i];
          i++;
        } else if (ch === 36 && i + 1 < len && code.charCodeAt(i + 1) === 123) {
          parts.push(currentStr);
          currentStr = '';
          i += 2;
          let expr = '';
          let braceCount = 1;
          const exprStartLine = line;

          while (i < len && braceCount > 0) {
            const ec = code.charCodeAt(i);
            if (ec === 123) braceCount++;
            else if (ec === 125) braceCount--;

            if (braceCount > 0) {
              expr += code[i];
            }
            if (ec === 10) line++;
            i++;
          }
          expressions.push({ code: expr, line: exprStartLine });
        } else {
          if (ch === 10) {
            currentStr += '\n';
            line++;
          } else {
            currentStr += code[i];
          }
          i++;
        }
      }

      if (!foundEnd) {
        state.currentLine = startLine;
        error('Unterminated template string (expected `)');
      }

      parts.push(currentStr);
      i++;

      if (expressions.length === 0) {
        tokens.push({ type: 'STRING', value: parts[0], line: startLine });
      } else {
        tokens.push({ type: 'TEMPLATE', parts: parts, expressions: expressions, line: startLine });
      }
      continue;
    }

    if (c >= 48 && c <= 57) {
      const start = i;
      const numLine = line;
      let isBigInt = false;
      let hasDecimal = false;

      if (c === 48 && i + 1 < len) {
        const next = code.charCodeAt(i + 1);
        if (next === 120 || next === 88) {
          i += 2;
          const hexStart = i;
          while (i < len) {
            const hc = code.charCodeAt(i);
            if (
              (hc >= 48 && hc <= 57) ||
              (hc >= 97 && hc <= 102) ||
              (hc >= 65 && hc <= 70) ||
              hc === 95
            ) {
              i++;
            } else {
              break;
            }
          }
          if (i < len && code.charCodeAt(i) === 110) {
            isBigInt = true;
            i++;
          }
          const raw = code.slice(hexStart, isBigInt ? i - 1 : i).replace(/_/g, '');
          tokens.push({
            type: 'NUMBER',
            value: isBigInt ? BigInt('0x' + raw) : parseInt(raw, 16),
            hasDecimal: false,
            isBigInt: isBigInt,
            line: numLine,
          });
          continue;
        }
        if (next === 111 || next === 79) {
          i += 2;
          const octStart = i;
          while (i < len) {
            const oc = code.charCodeAt(i);
            if ((oc >= 48 && oc <= 55) || oc === 95) {
              i++;
            } else {
              break;
            }
          }
          if (i < len && code.charCodeAt(i) === 110) {
            isBigInt = true;
            i++;
          }
          const raw = code.slice(octStart, isBigInt ? i - 1 : i).replace(/_/g, '');
          tokens.push({
            type: 'NUMBER',
            value: isBigInt ? BigInt('0o' + raw) : parseInt(raw, 8),
            hasDecimal: false,
            isBigInt: isBigInt,
            line: numLine,
          });
          continue;
        }
        if (next === 98 || next === 66) {
          i += 2;
          const binStart = i;
          while (i < len) {
            const bc = code.charCodeAt(i);
            if (bc === 48 || bc === 49 || bc === 95) {
              i++;
            } else {
              break;
            }
          }
          if (i < len && code.charCodeAt(i) === 110) {
            isBigInt = true;
            i++;
          }
          const raw = code.slice(binStart, isBigInt ? i - 1 : i).replace(/_/g, '');
          tokens.push({
            type: 'NUMBER',
            value: isBigInt ? BigInt('0b' + raw) : parseInt(raw, 2),
            hasDecimal: false,
            isBigInt: isBigInt,
            line: numLine,
          });
          continue;
        }
      }

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (ch >= 48 && ch <= 57) {
          i++;
        } else if (ch === 95) {
          i++;
        } else if (ch === 46 && !hasDecimal) {
          hasDecimal = true;
          i++;
        } else if ((ch === 101 || ch === 69) && i + 1 < len) {
          i++;
          const nextCh = code.charCodeAt(i);
          if (nextCh === 43 || nextCh === 45) i++;
          while (i < len) {
            const ec = code.charCodeAt(i);
            if ((ec >= 48 && ec <= 57) || ec === 95) i++;
            else break;
          }
          hasDecimal = true;
          break;
        } else {
          break;
        }
      }

      if (i < len && code.charCodeAt(i) === 110 && !hasDecimal) {
        isBigInt = true;
        i++;
      }

      const rawStr = code.slice(start, i).replace(/_/g, '');
      let value;
      if (isBigInt) {
        value = BigInt(rawStr.slice(0, -1));
      } else {
        value = parseFloat(rawStr);
      }

      tokens.push({
        type: 'NUMBER',
        value: value,
        hasDecimal: hasDecimal,
        isBigInt: isBigInt,
        line: numLine,
      });
      continue;
    }

    if (c === 64) {
      const annotationLine = line;
      i++;
      const start = i;
      while (i < len) {
        const ch = code.charCodeAt(i);
        if (
          (ch >= 97 && ch <= 122) ||
          (ch >= 65 && ch <= 90) ||
          (ch >= 48 && ch <= 57) ||
          ch === 95
        ) {
          i++;
        } else {
          break;
        }
      }
      tokens.push({ type: 'ANNOTATION', value: code.slice(start, i), line: annotationLine });
      continue;
    }

    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 95 || c >= 192) {
      if (
        c === 162 ||
        c === 163 ||
        c === 164 ||
        c === 165 ||
        c === 167 ||
        c === 172 ||
        c === 176 ||
        c === 177 ||
        c === 181 ||
        c === 182 ||
        c === 215 ||
        c === 247
      ) {
        state.currentLine = line;
        const hex = c.toString(16).toUpperCase().padStart(4, '0');
        error(`Unexpected character "${String.fromCharCode(c)}" (U+${hex})`);
      }

      const start = i;
      const wordLine = line;

      while (i < len) {
        const ch = code.charCodeAt(i);
        if (
          (ch >= 97 && ch <= 122) ||
          (ch >= 65 && ch <= 90) ||
          (ch >= 48 && ch <= 57) ||
          ch === 95 ||
          ch >= 192
        ) {
          i++;
        } else {
          break;
        }
      }

      const word = code.slice(start, i);
      if (state.keywords.has(word)) {
        tokens.push({ type: 'KEYWORD', value: word, line: wordLine });
      } else {
        tokens.push({ type: 'IDENTIFIER', value: word, line: wordLine });
      }
      continue;
    }

    let op = '';
    if (c === 46) {
      if (i + 2 < len && code.charCodeAt(i + 1) === 46 && code.charCodeAt(i + 2) === 46) op = '...';
    } else if (c === 61) {
      if (i + 2 < len && code.charCodeAt(i + 1) === 61 && code.charCodeAt(i + 2) === 61) op = '===';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '==';
    } else if (c === 33) {
      if (i + 2 < len && code.charCodeAt(i + 1) === 61 && code.charCodeAt(i + 2) === 61) op = '!==';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '!=';
    } else if (c === 60) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '<=';
    } else if (c === 62) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '>=';
    } else if (c === 38) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 38) op = '&&';
    } else if (c === 124) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 124) op = '||';
    } else if (c === 43) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '+=';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 43) op = '++';
    } else if (c === 45) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '-=';
      else if (i + 1 < len && code.charCodeAt(i + 1) === 45) op = '--';
    } else if (c === 42) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '*=';
    } else if (c === 47) {
      if (i + 1 < len && code.charCodeAt(i + 1) === 61) op = '/=';
    }

    if (op) {
      tokens.push({ type: 'OPERATOR', value: op, line });
      i += op.length;
      continue;
    }

    if (
      c === 40 ||
      c === 41 ||
      c === 123 ||
      c === 125 ||
      c === 91 ||
      c === 93 ||
      c === 44 ||
      c === 59 ||
      c === 46 ||
      c === 61 ||
      c === 43 ||
      c === 45 ||
      c === 42 ||
      c === 47 ||
      c === 37 ||
      c === 60 ||
      c === 62 ||
      c === 33 ||
      c === 38 ||
      c === 124 ||
      c === 58 ||
      c === 63
    ) {
      const char = code[i];
      if (c === 40 || c === 123 || c === 91) {
        openSymbols.push({ char: char, line: line });
      } else if (c === 41 || c === 125 || c === 93) {
        const expected = c === 41 ? '(' : c === 125 ? '{' : '[';
        if (openSymbols.length > 0 && openSymbols[openSymbols.length - 1].char === expected) {
          openSymbols.pop();
        }
      }
      tokens.push({ type: 'SYMBOL', value: char, line });
      i++;
      continue;
    }

    state.currentLine = line;
    error(
      'Unexpected character "' +
        code[i] +
        '" (Unicode: U+' +
        c.toString(16).toUpperCase().padStart(4, '0') +
        ')'
    );
  }

  if (openSymbols.length > 0) {
    const lastOpen = openSymbols[openSymbols.length - 1];
    const closeChar = lastOpen.char === '(' ? ')' : lastOpen.char === '{' ? '}' : ']';
    state.currentLine = lastOpen.line;
    error('Expected SYMBOL "' + closeChar + '" but got EOF');
  }

  return tokens;
}


/* FILE: src/core/parse.js */
function parse(tokens) {
  let pos = 0;

  state.currentLine = 0;

  function peek() {
    while (pos < tokens.length && tokens[pos].type === 'NEWLINE') pos++;
    return tokens[pos];
  }

  function next() {
    while (pos < tokens.length && tokens[pos].type === 'NEWLINE') pos++;
    return tokens[pos++];
  }

  function expect(type, value) {
    const token = next();
    if (!token || token.type !== type || (value && token.value !== value)) {
      let errorLine = state.currentLine;

      if (token && token.line !== undefined) {
        errorLine = token.line;
      }

      if (!token && pos >= 2 && tokens[pos - 2]) {
        errorLine = tokens[pos - 2].line;
      }

      state.currentLine = errorLine;
      error(
        'Expected ' +
          type +
          (value ? ' "' + value + '"' : '') +
          ' but got ' +
          (token ? token.value : 'EOF')
      );
    }
    return token;
  }

  function parseExpression() {
    return parseTernary();
  }

  function parseTernary() {
    let left = parseLogicalOr();

    if (peek() && peek().type === 'SYMBOL' && peek().value === '?') {
      next();
      const consequent = parseLogicalOr();
      expect('SYMBOL', ':');
      const alternate = parseTernary();
      return { type: 'Ternary', condition: left, consequent, alternate, line: left.line };
    }

    return left;
  }

  function parseUnary() {
    const token = peek();

    if (
      token &&
      token.type === 'SYMBOL' &&
      (token.value === '-' || token.value === '+' || token.value === '!')
    ) {
      const op = next().value;

      const nextToken = peek();
      if (!nextToken) {
        state.currentLine = token.line;
        error('Unexpected operator "' + op + '" - expected expression after unary operator');
      }

      if (nextToken.line !== undefined && token.line !== undefined && nextToken.line > token.line) {
        state.currentLine = token.line;
        error('Unexpected operator "' + op + '" - cannot use as unary operator on different line');
      }

      const operand = parseUnary();
      return { type: 'UnaryOp', operator: op, operand, line: token.line };
    }

    return parseMemberAccess();
  }

  function shouldStopAtLineBreak(left, opToken) {
    if (!left || !opToken) return false;
    if (left.line === undefined || opToken.line === undefined) return false;
    return opToken.line > left.line;
  }

  function parseMultiplicative() {
    let left = parseUnary();

    while (peek() && peek().type === 'SYMBOL' && ['*', '/', '%'].includes(peek().value)) {
      if (shouldStopAtLineBreak(left, peek())) break;

      const op = next().value;
      const right = parseUnary();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();

    while (peek() && peek().type === 'SYMBOL' && ['+', '-'].includes(peek().value)) {
      if (shouldStopAtLineBreak(left, peek())) break;

      const op = next().value;
      const right = parseMultiplicative();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  function parseComparison() {
    let left = parseAdditive();

    while (
      peek() &&
      ((peek().type === 'OPERATOR' && ['<', '>', '<=', '>='].includes(peek().value)) ||
        (peek().type === 'SYMBOL' && ['<', '>'].includes(peek().value)))
    ) {
      if (shouldStopAtLineBreak(left, peek())) break;

      const op = next().value;
      const right = parseAdditive();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  function parseEquality() {
    let left = parseComparison();

    while (
      peek() &&
      peek().type === 'OPERATOR' &&
      ['===', '!==', '==', '!='].includes(peek().value)
    ) {
      if (shouldStopAtLineBreak(left, peek())) break;

      const op = next().value;
      const right = parseComparison();
      left = { type: 'BinaryOp', operator: op, left, right };
    }
    return left;
  }

  function parseLogicalAnd() {
    let left = parseEquality();

    while (peek() && peek().type === 'OPERATOR' && peek().value === '&&') {
      if (shouldStopAtLineBreak(left, peek())) break;

      next();
      const right = parseEquality();
      left = { type: 'BinaryOp', operator: '&&', left, right };
    }
    return left;
  }

  function parseLogicalOr() {
    let left = parseLogicalAnd();

    while (peek() && peek().type === 'OPERATOR' && peek().value === '||') {
      if (shouldStopAtLineBreak(left, peek())) break;

      next();
      const right = parseLogicalAnd();
      left = { type: 'BinaryOp', operator: '||', left, right };
    }
    return left;
  }

  function parseMemberAccess() {
    let left = parsePrimary();

    while (peek()) {
      if (peek().type === 'SYMBOL' && peek().value === '[') {
        next();
        const index = parseExpression();
        expect('SYMBOL', ']');
        left = {
          type: 'MemberAccess',
          object: left,
          property: index,
          computed: true,
          line: left.line,
        };
      } else if (peek().type === 'SYMBOL' && peek().value === '.') {
        if (shouldStopAtLineBreak(left, peek())) break;

        next();
        const property = expect('IDENTIFIER');
        const propertyName = property.value;

        if (peek() && peek().type === 'SYMBOL' && peek().value === '(') {
          const callStartLine = property.line;
          next();
          const args = [];
          while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
            args.push(parseExpression());
            if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
              next();
            } else if (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
              state.currentLine = peek().line;
              error('Expected "," or ")" in argument list, got "' + peek().value + '"');
            }
          }

          if (!peek()) {
            state.currentLine = callStartLine;
            error('Expected SYMBOL ")" but got EOF');
          }

          expect('SYMBOL', ')');

          left = {
            type: 'MethodCall',
            object: left,
            method: propertyName,
            args: args,
            line: property.line,
          };
        } else {
          left = {
            type: 'MemberAccess',
            object: left,
            property: propertyName,
            computed: false,
            line: property.line,
          };
        }
      } else if (peek().type === 'SYMBOL' && peek().value === '(' && left.type === 'Identifier') {
        const callStartLine = left.line;
        next();
        const args = [];

        while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
          args.push(parseExpression());
          if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
            next();
          } else if (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
            state.currentLine = peek().line;
            error('Expected "," or ")" in argument list, got "' + peek().value + '"');
          }
        }

        if (!peek()) {
          state.currentLine = callStartLine;
          error('Expected SYMBOL ")" but got EOF');
        }

        expect('SYMBOL', ')');
        left = { type: 'Call', name: left.name, args, line: left.line };
      } else if (peek().type === 'SYMBOL' && peek().value === '(' && left.type === 'MemberAccess') {
        const callStartLine = left.line;
        next();
        const args = [];

        while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
          args.push(parseExpression());
          if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
            next();
          } else if (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
            state.currentLine = peek().line;
            error('Expected "," or ")" in argument list, got "' + peek().value + '"');
          }
        }

        if (!peek()) {
          state.currentLine = callStartLine;
          error('Expected SYMBOL ")" but got EOF');
        }

        expect('SYMBOL', ')');

        left = {
          type: 'MethodCall',
          object: left.object,
          method: left.property,
          args: args,
          line: left.line,
        };
      } else if (peek().type === 'OPERATOR' && (peek().value === '++' || peek().value === '--')) {
        const op = next().value;

        if (left.type === 'MemberAccess') {
          return { type: 'PostfixMemberOp', operator: op, target: left, line: left.line };
        }

        if (left.type === 'Identifier') {
          return { type: 'PostfixOp', operator: op, name: left.name, line: left.line };
        }

        state.currentLine = peek() ? peek().line : state.currentLine;
        error('Invalid target for ' + op + ' operator');
      } else {
        break;
      }
    }

    return left;
  }

  function parseValue() {
    const token = peek();

    if (!token) {
      let lastValidLine = 0;
      for (let i = pos - 1; i >= 0; i--) {
        if (tokens[i] && tokens[i].type !== 'NEWLINE' && tokens[i].line !== undefined) {
          lastValidLine = tokens[i].line;
          break;
        }
      }
      if (lastValidLine === 0 && pos >= 1 && tokens[pos - 1]) {
        lastValidLine = tokens[pos - 1].line;
      }
      state.currentLine = lastValidLine;
      error('Unexpected end of input');
    }

    if (token.type === 'SYMBOL' && token.value === '[') {
      const arrayToken = next();
      const arrayStartLine = arrayToken.line;
      const elements = [];

      const firstToken = peek();
      if (!firstToken) {
        state.currentLine = arrayStartLine;
        error('Expected SYMBOL "]" but got EOF');
      }

      while (peek() && !(peek().type === 'SYMBOL' && peek().value === ']')) {
        if (peek() && peek().type === 'OPERATOR' && peek().value === '...') {
          next();
          const spreadExpr = parseExpression();
          elements.push({ type: 'Spread', operand: spreadExpr });
        } else {
          elements.push(parseExpression());
        }

        if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
          next();
        }
      }

      if (!peek()) {
        state.currentLine = arrayStartLine;
        error('Expected SYMBOL "]" but got EOF');
      }

      expect('SYMBOL', ']');
      return { type: 'Array', elements, line: arrayToken.line };
    }

    if (token.type === 'SYMBOL' && token.value === '{') {
      const objToken = next();
      const objStartLine = objToken.line;
      const properties = [];

      const firstToken = peek();
      if (!firstToken) {
        state.currentLine = objStartLine;
        error('Expected SYMBOL "}" but got EOF');
      }

      while (peek() && !(peek().type === 'SYMBOL' && peek().value === '}')) {
        if (peek() && peek().type === 'OPERATOR' && peek().value === '...') {
          next();
          const spreadExpr = parseExpression();
          properties.push({ type: 'spread', value: spreadExpr });

          if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
            next();
          }
          continue;
        }

        if (peek().type === 'SYMBOL' && (peek().value === '{' || peek().value === '[')) {
          const nestedValue = parseValue();
          properties.push({ key: '__nested__' + properties.length, value: nestedValue });
          if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
            next();
          }
        } else if (peek().type === 'IDENTIFIER') {
          const key = next().value;

          if (
            peek() &&
            peek().type === 'SYMBOL' &&
            (peek().value === ',' || peek().value === '}')
          ) {
            properties.push({ key, value: { type: 'Identifier', name: key } });

            if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
              next();
            }
          } else {
            if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
              next();
            } else {
              expect('SYMBOL', ':');
            }
            const value = parseValue();
            properties.push({ key, value });

            if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
              next();
            } else if (peek() && peek().type === 'SYMBOL' && peek().value === '}') {
            } else if (peek() && peek().type === 'IDENTIFIER') {
              state.currentLine = peek().line;
              error('Expected "," or "}" after object property');
            }
          }
        } else if (peek().type === 'STRING') {
          const key = next().value;
          if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
            next();
          } else {
            expect('SYMBOL', ':');
          }
          const value = parseValue();
          properties.push({ key, value });

          if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
            next();
          } else if (peek() && peek().type === 'SYMBOL' && peek().value === '}') {
          } else if (peek() && (peek().type === 'IDENTIFIER' || peek().type === 'STRING')) {
            state.currentLine = peek().line;
            error('Expected "," or "}" after object property');
          }
        } else {
          break;
        }
      }

      if (!peek()) {
        state.currentLine = objStartLine;
        error('Expected SYMBOL "}" but got EOF');
      }

      expect('SYMBOL', '}');
      return { type: 'Object', properties, line: objToken.line };
    }

    return parseExpression();
  }

  function parsePrimary() {
    const token = peek();

    if (!token) {
      if (pos >= 2 && tokens[pos - 2] && tokens[pos - 2].line !== undefined) {
        state.currentLine = tokens[pos - 2].line;
      }
      error('Unexpected end of input');
    }

    if (token.type === 'OPERATOR' && (token.value === '++' || token.value === '--')) {
      const op = next().value;

      const nextToken = peek();
      if (!nextToken || nextToken.type !== 'IDENTIFIER') {
        state.currentLine = token.line;
        error('Unexpected operator "' + op + '" - expected variable name after ' + op);
      }

      const operand = expect('IDENTIFIER').value;
      return { type: 'PrefixOp', operator: op, name: operand, line: token.line };
    }

    if (token.type === 'KEYWORD' && token.value === 'function') {
      next();

      let name = null;
      if (peek() && peek().type === 'IDENTIFIER') {
        name = next().value;
      }

      expect('SYMBOL', '(');
      const params = [];
      while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
        if (peek().type !== 'IDENTIFIER') {
          break;
        }
        const paramName = next().value;

        let defaultValue = null;
        if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
          next();
          defaultValue = parseExpression();
        }

        params.push({
          name: paramName,
          default: defaultValue,
        });

        if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
          next();
        }
      }
      expect('SYMBOL', ')');

      expect('SYMBOL', '{');
      const body = parseBlock();
      expect('SYMBOL', '}');

      return { type: 'FunctionExpression', name, params, body, line: token.line };
    }

    if (token.type === 'NUMBER') {
      const t = next();
      return {
        type: 'Literal',
        value: t.value,
        numType: t.hasDecimal ? 'float' : 'int',
        line: t.line,
      };
    }

    if (token.type === 'TEMPLATE') {
      const t = next();
      return {
        type: 'Template',
        parts: t.parts,
        expressions: t.expressions,
        line: t.line,
      };
    }

    if (token.type === 'STRING') {
      const t = next();
      return { type: 'Literal', value: t.value, line: t.line };
    }

    if (token.type === 'KEYWORD') {
      const t = next();
      return { type: 'Keyword', value: t.value, line: t.line };
    }

    if (token.type === 'SYMBOL' && token.value === '[') {
      const val = parseValue();
      return val;
    }

    if (token.type === 'OPERATOR' && token.value === '...') {
      const t = next();
      const operand = parsePrimary();
      return { type: 'Spread', operand, line: t.line };
    }

    if (token.type === 'SYMBOL' && token.value === '{') {
      return parseValue();
    }

    if (token.type === 'IDENTIFIER') {
      const t = next();
      const name = t.value;
      return { type: 'Identifier', name, line: t.line };
    }

    if (token.type === 'SYMBOL' && token.value === '(') {
      const parenLine = token.line;
      const startPos = pos;
      next();

      const params = [];
      let isArrowFunction = false;

      while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
        if (peek().type === 'IDENTIFIER') {
          const paramName = next().value;

          let defaultValue = null;
          if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
            next();
            defaultValue = parseExpression();
          }

          params.push({
            name: paramName,
            default: defaultValue,
          });

          if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
            next();
          }
        } else {
          break;
        }
      }

      if (peek() && peek().type === 'SYMBOL' && peek().value === ')') {
        next();

        if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
          const nextToken = tokens[pos + 1];
          if (nextToken && nextToken.type === 'SYMBOL' && nextToken.value === '>') {
            isArrowFunction = true;
            next();
            next();
          }
        }
      }

      if (isArrowFunction) {
        if (peek() && peek().type === 'SYMBOL' && peek().value === '{') {
          next();
          const body = parseBlock();
          expect('SYMBOL', '}');
          return { type: 'ArrowFunction', params, body, line: token.line };
        } else {
          const expr = parseExpression();
          return {
            type: 'ArrowFunction',
            params,
            body: [{ type: 'Return', value: expr }],
            line: token.line,
          };
        }
      } else {
        pos = startPos;
        next();
        const expr = parseExpression();
        state.currentLine = parenLine;
        expect('SYMBOL', ')');
        return expr;
      }
    }

    if (token.type === 'SYMBOL' && token.value === ']') {
      return { type: 'EmptyExpression', line: token.line };
    }

    if (token.line !== undefined) {
      state.currentLine = token.line;
    }
    error('Unexpected token: ' + token.value);
  }

  function parseStatement() {
    const token = peek();

    if (!token) return null;

    if (token.type === 'SYMBOL' && ['*', '/', '%', '.'].includes(token.value)) {
      state.currentLine = token.line;
      error('Unexpected operator "' + token.value + '" - cannot start a statement with this');
    }

    /* if (token.type === 'OPERATOR' && ['++', '--'].includes(token.value)) {
    state.currentLine = token.line;
    error('Unexpected operator "' + token.value + '" - expected variable before operator');
  }*/

    if (token.type === 'ANNOTATION' && token.value === 'wasm') {
      next();

      const nextToken = peek();
      if (nextToken && nextToken.type === 'KEYWORD' && nextToken.value === 'for') {
        next();
        expect('SYMBOL', '(');
        const init = parseStatement();
        const condition = parseExpression();
        expect('SYMBOL', ';');
        const increment = parseStatement();
        expect('SYMBOL', ')');
        expect('SYMBOL', '{');
        const body = parseBlock();
        expect('SYMBOL', '}');

        return { type: 'WasmFor', init, condition, increment, body, line: token.line };
      }
    }

    if (token.type === 'KEYWORD') {
      const keyword = token.value;
      const handler = state.handlers.get(keyword);

      if (token.type === 'KEYWORD' && token.value === 'this') {
        const savedPos = pos;
        const expr = parseExpression();

        if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
          if (expr.type === 'MemberAccess') {
            next();
            const value = parseExpression();

            if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
              next();
            }

            return { type: 'MemberAssignment', target: expr, value, line: token.line };
          }
        }

        if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
          next();
        }

        return { type: 'ExpressionStatement', expression: expr, line: token.line };
      }

      if (handler && handler.type === 'statement') {
        next();
        const stmt = handler.parse(expect, next, peek, parseExpression, parseBlock, parseStatement);
        stmt.line = token.line;

        if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
          next();
        }

        return stmt;
      }
    }

    if (token.type === 'SYMBOL' && token.value === ';') {
      next();
      return parseStatement();
    }

    if (token.type === 'SYMBOL' && token.value === '{') {
      next();
      const statements = parseBlock();
      expect('SYMBOL', '}');

      return { type: 'BlockStatement', statements: statements, line: token.line };
    }

    if (token.type === 'IDENTIFIER') {
      const name = token.value;
      const nameLine = token.line;

      const savedPos = pos;

      next();

      const rawNextToken = tokens[savedPos + 1];
      const nextToken = peek();

      if (
        !rawNextToken ||
        rawNextToken.type === 'NEWLINE' ||
        rawNextToken.type === 'EOF' ||
        (rawNextToken.type === 'SYMBOL' && rawNextToken.value === ';')
      ) {
        pos = savedPos;
        const expr = parseExpression();

        if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
          next();
        }

        return {
          type: 'ExpressionStatement',
          expression: expr,
          line: nameLine,
        };
      }

      if (!nextToken) {
        pos = savedPos;
        const expr = parseExpression();

        if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
          next();
        }

        return {
          type: 'ExpressionStatement',
          expression: expr,
          line: nameLine,
        };
      }

      if (
        nextToken &&
        nextToken.type === 'OPERATOR' &&
        (nextToken.value === '++' || nextToken.value === '--')
      ) {
        const op = next().value;
        return { type: 'PostfixOp', operator: op, name: name, line: nameLine };
      }

      if (
        nextToken &&
        nextToken.type === 'OPERATOR' &&
        ['+=', '-=', '*=', '/='].includes(nextToken.value)
      ) {
        const op = next().value;
        const value = parseExpression();

        if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
          next();
        }

        return {
          type: 'CompoundAssignment',
          name: name,
          operator: op,
          value: value,
          line: nameLine,
        };
      }

      if (
        nextToken.type !== 'OPERATOR' &&
        (nextToken.type !== 'SYMBOL' ||
          (nextToken.value !== '=' &&
            nextToken.value !== '(' &&
            nextToken.value !== '[' &&
            nextToken.value !== '.'))
      ) {
        pos = savedPos;
        const expr = parseExpression();

        if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
          next();
        }

        return {
          type: 'ExpressionStatement',
          expression: expr,
          line: nameLine,
        };
      }

      pos--;

      const expr = parseExpression();

      if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
        if (expr.type === 'Identifier') {
          next();
          const value = parseExpression();

          if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
            next();
          } else if (
            peek() &&
            peek().line === token.line &&
            (peek().type === 'IDENTIFIER' || peek().type === 'KEYWORD')
          ) {
            state.currentLine = peek().line;
            error('Expected ";" or newline between statements');
          }

          return { type: 'Assignment', name: expr.name, value, line: token.line };
        }

        if (expr.type === 'MemberAccess') {
          next();
          const value = parseExpression();

          if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
            next();
          } else if (
            peek() &&
            peek().line === token.line &&
            (peek().type === 'IDENTIFIER' || peek().type === 'KEYWORD')
          ) {
            state.currentLine = peek().line;
            error('Expected ";" or newline between statements');
          }

          return { type: 'MemberAssignment', target: expr, value, line: token.line };
        }
      }

      if (peek() && peek().type === 'OPERATOR' && ['+=', '-=', '*=', '/='].includes(peek().value)) {
        if (expr.type === 'MemberAccess') {
          const op = next().value;
          const value = parseExpression();

          if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
            next();
          }

          return {
            type: 'MemberCompoundAssignment',
            target: expr,
            operator: op,
            value: value,
            line: token.line,
          };
        }
      }

      if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
        next();
      } else if (
        peek() &&
        peek().line === token.line &&
        (peek().type === 'IDENTIFIER' || peek().type === 'KEYWORD')
      ) {
        state.currentLine = peek().line;
        error('Expected ";" or newline between statements');
      }

      return { type: 'ExpressionStatement', expression: expr, line: token.line };
    }

    if (peek()) {
      const expr = parseExpression();
      return { type: 'ExpressionStatement', expression: expr, line: token.line };
    }

    return null;
  }

  function parseBlock() {
    const statements = [];
    while (peek() && !(peek().type === 'SYMBOL' && peek().value === '}')) {
      const token = peek();
      const stmt = parseStatement();
      if (stmt) statements.push(stmt);
    }
    return statements;
  }

  const program = [];
  while (pos < tokens.length) {
    if (!peek()) break;
    const stmt = parseStatement();
    if (stmt) program.push(stmt);
  }

  return program;
}


/* FILE: src/core/evaluator.js */
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
        name: node.name || null,
      };
    }

    if (node.type === 'PostfixMemberOp') {
      const object = evaluate(node.target.object, scope);

      if (object === undefined || object === null) {
        error('Cannot read property of undefined');
      }

      const property = node.target.computed
        ? evaluate(node.target.property, scope)
        : node.target.property;
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
          const exprLine =
            typeof expr === 'object' && expr.line !== undefined ? expr.line : node.line;

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
          if (
            typeof spreadValue !== 'object' ||
            spreadValue === null ||
            Array.isArray(spreadValue)
          ) {
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
        isArrow: true,
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
                suggestion: 'Use string() to convert',
              });
            }
            if (leftType === 'number' && rightType === 'string') {
              error('Cannot concatenate number with string', undefined, {
                expected: 'number',
                got: 'string',
                value: right,
                operator: '+',
                suggestion: 'Use Number() to convert',
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
              const opName = {
                '-': 'subtraction',
                '*': 'multiplication',
                '/': 'division',
                '%': 'modulo',
              }[node.operator];
              error(
                'Cannot perform ' + opName + ' with "' + leftType + '" and "' + rightType + '"',
                undefined,
                {
                  expected: 'number',
                  got: leftType !== 'number' ? leftType : rightType,
                  value: leftType !== 'number' ? left : right,
                  operator: node.operator,
                  suggestion: 'Use Number() to convert',
                }
              );
            }
          } else {
            const leftNum = Number(left);
            const rightNum = Number(right);

            if (isNaN(leftNum) || isNaN(rightNum)) {
              const opName = {
                '-': 'subtraction',
                '*': 'multiplication',
                '/': 'division',
                '%': 'modulo',
              }[node.operator];
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
            if (
              (typeof left === 'object' && left !== null) ||
              (typeof right === 'object' && right !== null)
            ) {
              return left === right;
            }

            if (typeof left !== typeof right) {
              return false;
            }
            return left == right;
          }

          if (node.operator === '!=') {
            if (
              (typeof left === 'object' && left !== null) ||
              (typeof right === 'object' && right !== null)
            ) {
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
        const args = node.args.map(function (arg) {
          return evaluate(arg, scope);
        });

        if (handler.type === 'dual' && handler.callAsMethod) {
          return handler.callAsMethod(object, args, scope);
        }
        return handler.call(object, args, scope);
      }

      if (object && typeof object[methodName] === 'function') {
        const args = node.args.map(function (arg) {
          return evaluate(arg, scope);
        });
        return object[methodName].apply(object, args);
      }

      if (object && object[methodName] && object[methodName].params) {
        const func = object[methodName];
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
          if (this.__parent && this.__parent.has(key)) {
            return this.__parent.set(key, value);
          }
          return originalSet.call(this, key, value);
        };

        newScope.has = function (key) {
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
        if (this.__parent && this.__parent.has(key)) {
          return this.__parent.set(key, value);
        }
        return originalSet.call(this, key, value);
      };

      newScope.has = function (key) {
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


/* FILE: src/execution/executor.js */
function executeStatement(stmt, scope) {
  if (!scope) scope = state.variables;
  if (!stmt) return;

  const previousSource = state.currentSource;
  const previousCode = state.code;
  const previousLines = state.lines;

  if (stmt.__mel_source) {
    state.currentSource = stmt.__mel_source;
    state.code = stmt.__mel_code;
    state.lines = stmt.__mel_lines;
  }

  if (stmt.line !== undefined) {
    state.currentLine = stmt.line;
  }

  try {
    if (stmt.type === 'CompoundAssignment') {
      if (!scope.has(stmt.name)) {
        error('Variable "' + stmt.name + '" is not defined');
      }

      const current = scope.get(stmt.name);
      const value = evaluate(stmt.value, scope);

      if (value && value.__mel_waiting) {
        return value;
      }

      let result;
      if (stmt.operator === '+=') {
        result = current + value;
      } else if (stmt.operator === '-=') {
        result = current - value;
      } else if (stmt.operator === '*=') {
        result = current * value;
      } else if (stmt.operator === '/=') {
        result = current / value;
      }

      scope.set(stmt.name, result);
      return;
    }

    if (stmt.type === 'ExpressionStatement') {
      return evaluate(stmt.expression, scope);
    }

    if (stmt.type === 'MemberCompoundAssignment') {
      const target = stmt.target;

      if (target.type === 'MemberAccess') {
        const object = evaluate(target.object, scope);
        const property = target.computed ? evaluate(target.property, scope) : target.property;
        const currentValue = object[property];
        const addValue = evaluate(stmt.value, scope);

        let result;
        if (stmt.operator === '+=') {
          result = currentValue + addValue;
        } else if (stmt.operator === '-=') {
          result = currentValue - addValue;
        } else if (stmt.operator === '*=') {
          result = currentValue * addValue;
        } else if (stmt.operator === '/=') {
          result = currentValue / addValue;
        }

        object[property] = result;
      }

      return;
    }

    if (stmt.type === 'Assignment') {
      const value = evaluate(stmt.value, scope);

      if (value && value.__mel_waiting) {
        handleInputSubmit(value, scope, stmt.name);
        return value;
      }

      if (stmt.name === 'MEL_SCRIPT') {
        const current = scope.has('MEL_SCRIPT') ? scope.get('MEL_SCRIPT') : {};
        const merged = {};

        for (var key in current) {
          merged[key] = current[key];
        }

        for (var key in value) {
          merged[key] = value[key];
        }

        scope.set('MEL_SCRIPT', merged);
        return;
      }

      scope.set(stmt.name, value);
      return;
    }

    if (stmt.type === 'BlockStatement') {
      i = 0;
      while (i < stmt.statements.length) {
        result = state.executeStatement(stmt.statements[i], scope);

        if (result && result.__mel_waiting) {
          return result;
        }

        i++;
      }
      return;
    }

    if (stmt.type === 'PostfixOp') {
      if (!scope.has(stmt.name)) {
        error('Variable "' + stmt.name + '" is not defined');
      }

      const currentValue = scope.get(stmt.name);

      if (stmt.operator === '++') {
        scope.set(stmt.name, currentValue + 1);
      } else if (stmt.operator === '--') {
        scope.set(stmt.name, currentValue - 1);
      }

      return;
    }

    if (stmt.type === 'PostfixOp') {
      const currentValue = scope.get(stmt.name);

      if (stmt.operator === '++') {
        scope.set(stmt.name, currentValue + 1);
      } else if (stmt.operator === '--') {
        scope.set(stmt.name, currentValue - 1);
      }

      return;
    }

    if (stmt.type === 'MemberAssignment') {
      const target = stmt.target;
      const value = evaluate(stmt.value, scope);

      if (target.type === 'MemberAccess') {
        const object = evaluate(target.object, scope);
        const property = target.computed ? evaluate(target.property, scope) : target.property;
        object[property] = value;
      }
      return;
    }

    if (stmt.type === 'ExpressionStatement') {
      if (stmt.expression.type === 'Identifier') {
        state.currentLine = stmt.expression.line;
        error(
          'Unexpected identifier "' +
            stmt.expression.name +
            '" - did you mean to assign or call it?'
        );
      }

      const result = evaluate(stmt.expression, scope);

      if (result && result.__mel_waiting) {
        handleInputSubmit(result, scope, null);
        return result;
      }

      return;
    }

    const handler = state.handlers.get(stmt.type);
    if (handler && handler.type === 'executor') {
      return handler.execute(stmt, scope, evaluate, executeStatement);
    }
    if (stmt.type === 'ClassDeclaration') {
      return;
    }

    error('Unknown statement type: ' + stmt.type);
  } finally {
    if (stmt.__mel_source) {
      state.currentSource = previousSource;
      state.code = previousCode;
      state.lines = previousLines;
    }
  }
}


/* FILE: src/execution/continuation.js */
function continueExecution() {
  if (state.paused) return;

  state.currentIndex++;

  if (state.currentIndex >= state.queue.length) {
    return;
  }

  try {
    executeStatement(state.queue[state.currentIndex], state.currentScope);

    if (!state.paused) {
      continueExecution();
    }
  } catch (e) {
    state.paused = true;
    state.queue = [];
    state.currentIndex = 0;

    const melScript = state.variables.get('MEL_SCRIPT');

    let errorMsg = e.melFormatted || e.message || String(e);

    if (e instanceof RangeError && e.message.includes('call stack')) {
      errorMsg = 'Error in: ' + (state.currentSource || 'main') + '\n';
      errorMsg += 'Code:\n';
      const targetLine = state.currentLine;
      const startLine = Math.max(0, targetLine - 1);
      const endLine = Math.min(state.lines.length - 1, targetLine + 1);

      for (let i = startLine; i <= endLine; i++) {
        const prefix = i === targetLine ? ' -> ' : '    ';
        errorMsg += i + 1 + '|' + prefix + state.lines[i] + '\n';
      }
      errorMsg += 'LINE: ' + (targetLine + 1) + '\n';
      errorMsg += 'Maximum call stack size exceeded (infinite recursion)';
    }

    if (melScript && melScript.CONFIG === 'web') {
      console.error(errorMsg);
    } else {
      console.error(errorMsg);
    }

    return;
  }
}


/* FILE: src/execution/input-handler.js */
function handleInputSubmit(inputObject, scope, variableName) {
  if (variableName) {
    scope.set(variableName, inputObject);
  }

  state.currentIndex++;
  if (state.currentIndex < state.queue.length) {
    const nextStmt = state.queue[state.currentIndex];

    if (
      nextStmt.type === 'ExpressionStatement' &&
      nextStmt.expression.type === 'MethodCall' &&
      nextStmt.expression.method === 'style'
    ) {
      executeStatement(nextStmt, scope);
    } else {
      state.currentIndex--;
    }
  }

  if (typeof inputObject.__mel_render === 'function') {
    inputObject.__mel_render();
  }

  state.paused = true;

  const submitValue = () => {
    let finalValue = null;

    if (inputObject.__mel_input) {
      finalValue = inputObject.__mel_input.value;

      if (inputObject.__mel_theme === 'terminal') {
        inputObject.__mel_container.style.display = 'none';
      } else {
        document.body.removeChild(inputObject.__mel_overlay);
      }
    } else if (inputObject.__mel_return_value !== undefined) {
      finalValue = inputObject.__mel_return_value;
    }

    if (variableName) {
      scope.set(variableName, finalValue);
    }

    state.paused = false;
    continueExecution();
  };

  if (inputObject.__mel_input) {
    if (inputObject.__mel_theme === 'terminal') {
      inputObject.__mel_input.onkeypress = (e) => {
        if (e.key === 'Enter') {
          submitValue();
        }
      };
    } else {
      inputObject.__mel_button.onclick = submitValue;
      inputObject.__mel_input.onkeypress = (e) => {
        if (e.key === 'Enter') {
          submitValue();
        }
      };
    }
  } else {
    inputObject.__mel_submit = submitValue;
  }
}


/* FILE: src/core/interpreter.js */
function createInterpreter() {
  function addKeyword(name) {
    state.keywords.add(name);
  }

  function addHandler(name, config) {
    state.handlers.set(name, config);
  }

  function execute(code) {
    state.code = code;
    state.lines = code.split('\n');
    state.currentLine = 0;
    state.currentSource = state.currentSource || 'main';

    const tokens = state.tokenize(code);

    const ast = state.parse(tokens);

    for (let i = 0; i < ast.length; i++) {
      const stmt = ast[i];

      if (stmt.type === 'Function' && stmt.name) {
        const funcValue = {
          params: stmt.params,
          body: stmt.body,
          name: stmt.name,
        };
        state.variables.set(stmt.name, funcValue);
      }

      if (
        stmt.type === 'ExpressionStatement' &&
        stmt.expression &&
        stmt.expression.type === 'FunctionExpression' &&
        stmt.expression.name
      ) {
        const funcExpr = stmt.expression;
        const funcValue = {
          params: funcExpr.params,
          body: funcExpr.body,
          name: funcExpr.name,
        };

        state.variables.set(funcExpr.name, funcValue);
        console.log('Hoisted function:', funcExpr.name);
      }

      if (stmt.type === 'Assignment' && stmt.value && stmt.value.type === 'FunctionExpression') {
        const funcExpr = stmt.value;
        const funcValue = {
          params: funcExpr.params,
          body: funcExpr.body,
          name: funcExpr.name || stmt.name,
        };

        state.variables.set(stmt.name, funcValue);

        if (funcExpr.name && funcExpr.name !== stmt.name) {
          state.variables.set(funcExpr.name, funcValue);
        }
        console.log('Hoisted function:', stmt.name);
      }
    }

    for (let i = 0; i < ast.length; i++) {
      const stmt = ast[i];

      if (stmt.type === 'ClassDeclaration') {
        const className = stmt.name;
        const superClass = stmt.superClass;
        const constructor = stmt.constructor;
        const properties = stmt.properties;
        const methods = stmt.methods;

        const classConstructor = function (...args) {
          const instance = {};

          if (superClass) {
            const superValue = state.variables.get(superClass);
            if (!superValue || typeof superValue !== 'function') {
              error('Super class "' + superClass + '" is not defined');
            }
            const superInstance = superValue.apply(null, args);
            Object.assign(instance, superInstance);
          }

          for (const prop of properties) {
            const value = evaluate(prop.value, state.variables);
            instance[prop.name] = value;
          }

          for (const method of methods) {
            instance[method.name] = function (...methodArgs) {
              const methodScope = new Map(state.variables);

              const paramNames = new Set();
              for (let i = 0; i < method.params.length; i++) {
                paramNames.add(method.params[i]);
              }

              const instanceProps = new Set();
              for (const key in instance) {
                if (typeof instance[key] !== 'function') {
                  instanceProps.add(key);
                }
              }

              for (let i = 0; i < method.params.length; i++) {
                methodScope.set(method.params[i], methodArgs[i]);
              }

              for (const key in instance) {
                if (typeof instance[key] !== 'function' && !methodScope.has(key)) {
                  methodScope.set(key, instance[key]);
                }
              }

              let returnValue = undefined;
              for (const s of method.body) {
                const result = state.executeStatement(s, methodScope);
                if (result && result.type === 'return') {
                  returnValue = result.value;
                  break;
                }
              }

              for (const key of instanceProps) {
                if (!paramNames.has(key) && methodScope.has(key)) {
                  instance[key] = methodScope.get(key);
                }
              }

              return returnValue;
            };
          }

          if (constructor) {
            const constructorScope = new Map(state.variables);

            const paramNames = new Set();
            for (let i = 0; i < constructor.params.length; i++) {
              paramNames.add(constructor.params[i]);
            }

            for (const key in instance) {
              if (typeof instance[key] !== 'function') {
                constructorScope.set(key, instance[key]);
              }
            }

            for (let i = 0; i < constructor.params.length; i++) {
              constructorScope.set(constructor.params[i], args[i]);
            }

            for (const s of constructor.body) {
              state.executeStatement(s, constructorScope);
            }

            for (const [key, value] of constructorScope) {
              if (!paramNames.has(key) && typeof value !== 'function') {
                instance[key] = value;
              }
            }
          }

          return instance;
        };

        state.variables.set(className, classConstructor);
      }
    }

    state.queue = ast;
    state.currentIndex = 0;
    state.currentScope = state.variables;
    state.paused = false;

    if (ast.length > 0) {
      state.executeStatement(ast[0], state.variables);
      if (!state.paused) {
        continueExecution(state);
      }
    }
  }

  return { execute, addKeyword, addHandler, state, error: (msg, line) => error(msg, line, state) };
}

function debugAST(code) {
  const tokens = Lang.state.tokenize(code);
  const ast = Lang.state.parse(tokens);
  console.log('AST:', JSON.stringify(ast, null, 2));
}

const Lang = createInterpreter();

state.tokenize = tokenize;
state.parse = parse;
state.executeStatement = executeStatement;

window.MEL = {
  execute: (code) => Lang.execute(code),
  interpreter: Lang,
  debug: debugAST,
};


/* FILE: src/stdlib/data.js */
function setupData(Lang) {
  Lang.addKeyword('true');
  Lang.addHandler('true', {
    type: 'value',
    value: true,
  });

  Lang.addKeyword('false');
  Lang.addHandler('false', {
    type: 'value',
    value: false,
  });

  Lang.addKeyword('null');
  Lang.addHandler('null', {
    type: 'value',
    value: null,
  });

  Lang.addHandler('Json', {
    type: 'value',
    value: {
      encode: function (value, space) {
        try {
          if (space !== undefined) {
            return JSON.stringify(value, null, space);
          }
          return JSON.stringify(value);
        } catch (e) {
          Lang.error('Failed to encode value: ' + e.message);
        }
      },

      decode: function (str) {
        try {
          return JSON.parse(str);
        } catch (e) {
          Lang.error('Failed to decode JSON: ' + e.message);
        }
      },
    },
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
    },
  });

  Lang.addHandler('String', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) return '';
      return String(args[0]);
    },
  });

  Lang.addHandler('Boolean', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) return false;
      return Boolean(args[0]);
    },
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
    },
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
    },
  });

  Lang.addHandler('isNaN', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) return true;
      return isNaN(args[0]);
    },
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
    },
  });

  Lang.addHandler('Date', {
    type: 'value',
    value: {
      now: function () {
        return Date.now();
      },
    },
  });

  Lang.addHandler('performance', {
    type: 'value',
    value: {
      now: function () {
        return performance.now();
      },
    },
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
      E: Math.E,
    },
  });

  Lang.addHandler('getPixelRatio', {
    type: 'function',
    call: (args, scope) => {
      return window.devicePixelRatio || 1;
    },
  });

  Lang.addKeyword('Math');

  Lang.addHandler('string', {
    type: 'value',
    value: {
      from: function (value) {
        if (value === null || value === undefined) {
          return '';
        }
        return String(value);
      },

      split: function (str, separator) {
        return String(str).split(separator);
      },

      join: function (arr, separator) {
        if (!Array.isArray(arr)) {
          Lang.error('join() requires an array');
        }
        return arr.join(separator || '');
      },

      toUpperCase: function (str) {
        return String(str).toUpperCase();
      },

      toLowerCase: function (str) {
        return String(str).toLowerCase();
      },

      trim: function (str) {
        return String(str).trim();
      },

      replace: function (str, search, replace) {
        return String(str).replace(search, replace);
      },

      includes: function (str, search) {
        return String(str).includes(search);
      },

      startsWith: function (str, search) {
        return String(str).startsWith(search);
      },

      endsWith: function (str, search) {
        return String(str).endsWith(search);
      },
    },
  });

  Lang.addKeyword('string');

  function getDimension(target, dimension) {
    if (!target) {
      Lang.error(
        'get' + dimension.charAt(0).toUpperCase() + dimension.slice(1) + '() requires an element'
      );
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
    },
  });

  Lang.addHandler('getHeight', {
    type: 'method',
    call: (target, args, scope) => {
      return getDimension(target, 'height');
    },
  });
}


/* FILE: src/stdlib/methods.js */
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


/* FILE: src/stdlib/io.js */
function setupIO(Lang) {
  Lang.addHandler('input', {
    type: 'function',
    call: (args, scope) => {
      const promptText = args.length > 0 ? String(args[0]) : '';

      let melScript = null;

      if (scope.has('MEL_SCRIPT')) {
        melScript = scope.get('MEL_SCRIPT');
      }

      if (melScript && melScript.CONFIG === 'web') {
        if (typeof window !== 'undefined') {
          const inputId = 'mel-input-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

          const inputObject = {
            __mel_waiting: true,
            __mel_id: inputId,
            __mel_rendered: false,
            __mel_prompt: promptText,
            __mel_theme: 'default',
            __mel_styles: {},

            __mel_render: function () {
              if (this.__mel_rendered) return;
              this.__mel_rendered = true;

              if (this.__mel_theme === 'terminal') {
                const container = document.createElement('div');
                const input = document.createElement('input');

                container.style.cssText = `
                padding: 10px;
                font-family: monospace;
              `;

                let label = null;
                if (this.__mel_prompt) {
                  label = document.createElement('div');
                  label.textContent = this.__mel_prompt;
                  label.style.cssText = `
                  margin-bottom: 5px;
                  color: #333;
                  font-family: monospace;
                `;
                  container.appendChild(label);
                }

                input.type = 'text';
                input.id = this.__mel_id;
                input.style.cssText = `
                width: 100%;
                padding: 8px;
                border: none;
                outline: none;
                background: transparent;
                color: #000;
                font-family: monospace;
                box-sizing: border-box;
              `;

                container.appendChild(input);
                document.body.appendChild(container);

                this.__mel_container = container;
                this.__mel_input = input;
                this.__mel_label = label;

                for (let prop in this.__mel_styles) {
                  input.style.setProperty(prop, this.__mel_styles[prop], 'important');

                  if (prop === 'color' && label) {
                    label.style.setProperty('color', this.__mel_styles[prop], 'important');
                  }
                }

                setTimeout(() => input.focus(), 0);
              } else {
                const overlay = document.createElement('div');
                const container = document.createElement('div');
                const input = document.createElement('input');
                const button = document.createElement('button');

                overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
              `;

                container.id = this.__mel_id + '-container';
                container.style.cssText = `
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                width: 90%;
                max-width: 400px;
                display: flex;
                flex-direction: column;
              `;

                let label = null;
                if (this.__mel_prompt) {
                  label = document.createElement('div');
                  label.textContent = this.__mel_prompt;
                  label.style.cssText = `
                  margin-bottom: 12px;
                  color: #333;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  font-size: 16px;
                  line-height: 1.4;
                `;
                  container.appendChild(label);
                }

                input.type = 'text';
                input.id = this.__mel_id;
                input.style.cssText = `
                width: 100%;
                padding: 12px;
                border: 1px solid #ccc;
                border-radius: 8px;
                font-family: monospace;
                font-size: 16px; /* Previne zoom no iOS */
                box-sizing: border-box;
                margin-bottom: 15px;
                -webkit-appearance: none;
              `;

                button.style.cssText = `
                padding: 12px 20px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 16px;
                font-weight: 500;
                min-height: 44px; /* Área de toque mínima */
                width: 100%;
                user-select: none;
                -webkit-user-select: none;
                -webkit-tap-highlight-color: transparent;
                touch-action: manipulation;
              `;
                button.textContent = 'OK';

                container.appendChild(input);
                container.appendChild(button);
                overlay.appendChild(container);
                document.body.appendChild(overlay);

                this.__mel_overlay = overlay;
                this.__mel_container = container;
                this.__mel_input = input;
                this.__mel_button = button;
                this.__mel_label = label;

                for (let prop in this.__mel_styles) {
                  container.style.setProperty(prop, this.__mel_styles[prop], 'important');

                  if (prop === 'color') {
                    if (label) {
                      label.style.setProperty('color', this.__mel_styles[prop], 'important');
                    }
                    input.style.setProperty('color', this.__mel_styles[prop], 'important');
                  }
                }

                setTimeout(() => input.focus(), 0);
              }
            },
          };

          return inputObject;
        }
      }

      return prompt(promptText) || '';
    },
  });

  Lang.addHandler('print', {
    type: 'function',
    call: (args, scope) => {
      const formatValue = (value) => {
        if (Array.isArray(value)) {
          return '[' + value.map((v) => formatValue(v)).join(', ') + ']';
        }
        if (typeof value === 'string') {
          return value;
        }
        return String(value);
      };

      let output;
      if (args.length === 1 && Array.isArray(args[0])) {
        output = args[0].map((v) => formatValue(v)).join(' ');
      } else {
        output = args.map((arg) => formatValue(arg)).join('');
      }

      let melScript = null;

      if (scope.has('MEL_SCRIPT')) {
        melScript = scope.get('MEL_SCRIPT');
      }

      if (melScript && melScript.CONFIG === 'web') {
        if (typeof window !== 'undefined') {
          let outputDiv = document.getElementById('mel-output');

          if (!outputDiv) {
            outputDiv = document.createElement('div');
            outputDiv.id = 'mel-output';
            outputDiv.style.cssText =
              'color:#000;padding:10px;font-family:monospace;white-space:pre-wrap;';
            document.body.appendChild(outputDiv);
          }

          const line = document.createElement('div');
          line.innerText = output;
          outputDiv.appendChild(line);
          outputDiv.scrollTop = outputDiv.scrollHeight;
        }
      } else {
        console.log(output);
      }

      return null;
    },
  });
}


/* FILE: src/stdlib/network.js */
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


/* FILE: src/stdlib/control-flow.js */
function setupControlFlow(Lang) {
  Lang.addKeyword('if');
  Lang.addHandler('if', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression, parseBlock, parseStatement) => {
      expect('SYMBOL', '(');
      const condition = parseExpression();
      expect('SYMBOL', ')');

      let thenBlock = [];

      if (peek() && peek().type === 'SYMBOL' && peek().value === '{') {
        expect('SYMBOL', '{');
        thenBlock = parseBlock();
        expect('SYMBOL', '}');
      } else {
        const stmt = parseStatement();
        if (stmt) thenBlock.push(stmt);
      }

      const elseIfBlocks = [];
      let elseBlock = null;

      while (peek() && peek().type === 'KEYWORD' && peek().value === 'else') {
        next();

        if (peek() && peek().type === 'KEYWORD' && peek().value === 'if') {
          next();
          expect('SYMBOL', '(');
          const elseIfCondition = parseExpression();
          expect('SYMBOL', ')');

          let elseIfBody = [];

          if (peek() && peek().type === 'SYMBOL' && peek().value === '{') {
            expect('SYMBOL', '{');
            elseIfBody = parseBlock();
            expect('SYMBOL', '}');
          } else {
            const stmt = parseStatement();
            if (stmt) elseIfBody.push(stmt);
          }

          elseIfBlocks.push({ condition: elseIfCondition, body: elseIfBody });
        } else {
          if (peek() && peek().type === 'SYMBOL' && peek().value === '{') {
            expect('SYMBOL', '{');
            elseBlock = parseBlock();
            expect('SYMBOL', '}');
          } else {
            const stmt = parseStatement();
            if (stmt) elseBlock = [stmt];
          }
          break;
        }
      }

      return { type: 'If', condition, thenBlock, elseIfBlocks, elseBlock };
    },
  });

  Lang.addHandler('If', {
    type: 'executor',
    execute: (stmt, scope, evaluate, executeStatement) => {
      const condition = evaluate(stmt.condition, scope);

      if (condition) {
        for (const s of stmt.thenBlock) {
          executeStatement(s, scope);
        }
      } else {
        let executed = false;

        for (const elseIf of stmt.elseIfBlocks) {
          if (evaluate(elseIf.condition, scope)) {
            for (const s of elseIf.body) {
              executeStatement(s, scope);
            }
            executed = true;
            break;
          }
        }

        if (!executed && stmt.elseBlock) {
          for (const s of stmt.elseBlock) {
            executeStatement(s, scope);
          }
        }
      }
    },
  });

  Lang.addKeyword('else');

  Lang.addKeyword('while');
  Lang.addHandler('while', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression, parseBlock) => {
      expect('SYMBOL', '(');
      const condition = parseExpression();
      expect('SYMBOL', ')');
      expect('SYMBOL', '{');
      const body = parseBlock();
      expect('SYMBOL', '}');

      return { type: 'While', condition, body };
    },
  });

  Lang.addHandler('While', {
    type: 'executor',
    execute: (stmt, scope, evaluate, executeStatement) => {
      while (evaluate(stmt.condition, scope)) {
        try {
          for (const s of stmt.body) {
            executeStatement(s, scope);
          }
        } catch (e) {
          if (e.type === 'BREAK') break;
          if (e.type === 'CONTINUE') continue;
          throw e;
        }
      }
    },
  });

  Lang.addKeyword('for');
  Lang.addHandler('for', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression, parseBlock, parseStatement) => {
      expect('SYMBOL', '(');
      const init = parseStatement();
      const condition = parseExpression();
      expect('SYMBOL', ';');
      const increment = parseStatement();
      expect('SYMBOL', ')');
      expect('SYMBOL', '{');
      const body = parseBlock();
      expect('SYMBOL', '}');

      return { type: 'For', init, condition, increment, body };
    },
  });

  const loopCache = new Map();
  let cacheId = 0;

  Lang.addHandler('For', {
    type: 'executor',
    execute: (stmt, scope, evaluate, executeStatement) => {
      if (stmt.init) {
        executeStatement(stmt.init, scope);
      }

      if (!stmt.__compiled_id) {
        stmt.__compiled_id = cacheId++;

        const bodyLen = stmt.body.length;
        const compiledBody = [];

        for (let i = 0; i < bodyLen; i++) {
          compiledBody.push(stmt.body[i]);
        }

        loopCache.set(stmt.__compiled_id, {
          body: compiledBody,
          bodyLen: bodyLen,
        });
      }

      const cached = loopCache.get(stmt.__compiled_id);
      const bodyLen = cached.bodyLen;
      const body = cached.body;

      while (evaluate(stmt.condition, scope)) {
        try {
          for (let i = 0; i < bodyLen; i++) {
            executeStatement(body[i], scope);
          }
        } catch (e) {
          if (e.type === 'BREAK') break;
          if (e.type === 'CONTINUE') {
            if (stmt.increment) {
              executeStatement(stmt.increment, scope);
            }
            continue;
          }
          throw e;
        }

        if (stmt.increment) {
          executeStatement(stmt.increment, scope);
        }
      }
    },
  });

  Lang.addKeyword('break');
  Lang.addHandler('break', {
    type: 'statement',
    parse: (expect, next, peek) => {
      return { type: 'Break' };
    },
  });

  Lang.addHandler('Break', {
    type: 'executor',
    execute: (stmt, scope, evaluate) => {
      throw { type: 'BREAK' };
    },
  });

  Lang.addKeyword('continue');
  Lang.addHandler('continue', {
    type: 'statement',
    parse: (expect, next, peek) => {
      return { type: 'Continue' };
    },
  });

  Lang.addHandler('Continue', {
    type: 'executor',
    execute: (stmt, scope, evaluate) => {
      throw { type: 'CONTINUE' };
    },
  });

  Lang.addKeyword('try');
  Lang.addKeyword('catch');
  Lang.addKeyword('finally');
  Lang.addKeyword('throw');

  Lang.addHandler('try', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression, parseBlock, parseStatement) => {
      expect('SYMBOL', '{');
      const tryBlock = parseBlock();
      expect('SYMBOL', '}');

      let catchBlock = null;
      let catchVar = null;
      let finallyBlock = null;

      if (peek() && peek().type === 'KEYWORD' && peek().value === 'catch') {
        next();

        if (peek() && peek().type === 'SYMBOL' && peek().value === '(') {
          expect('SYMBOL', '(');
          const varToken = peek();
          if (varToken && varToken.type === 'IDENTIFIER') {
            catchVar = varToken.value;
            next();
          }
          expect('SYMBOL', ')');
        }

        expect('SYMBOL', '{');
        catchBlock = parseBlock();
        expect('SYMBOL', '}');
      }

      if (peek() && peek().type === 'KEYWORD' && peek().value === 'finally') {
        next();
        expect('SYMBOL', '{');
        finallyBlock = parseBlock();
        expect('SYMBOL', '}');
      }

      return {
        type: 'Try',
        tryBlock: tryBlock,
        catchBlock: catchBlock,
        catchVar: catchVar,
        finallyBlock: finallyBlock,
      };
    },
  });

  Lang.addHandler('Try', {
    type: 'executor',
    execute: (stmt, scope, evaluate, executeStatement) => {
      try {
        for (let i = 0; i < stmt.tryBlock.length; i++) {
          executeStatement(stmt.tryBlock[i], scope);
        }
      } catch (error) {
        if (stmt.catchBlock) {
          const catchScope = new Map(scope);

          if (stmt.catchVar) {
            const errorObj = {
              message: error.message || String(error),
              type: error.type || 'Error',
              line: error.line,
              raw: error,
            };
            catchScope.set(stmt.catchVar, errorObj);
          }

          for (let i = 0; i < stmt.catchBlock.length; i++) {
            executeStatement(stmt.catchBlock[i], catchScope);
          }
        } else {
          throw error;
        }
      } finally {
        if (stmt.finallyBlock) {
          for (let i = 0; i < stmt.finallyBlock.length; i++) {
            executeStatement(stmt.finallyBlock[i], scope);
          }
        }
      }
    },
  });

  Lang.addHandler('throw', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression) => {
      const value = parseExpression();
      return { type: 'Throw', value: value };
    },
  });

  Lang.addHandler('Throw', {
    type: 'executor',
    execute: (stmt, scope, evaluate) => {
      const value = evaluate(stmt.value, scope);
      const error = new Error(String(value));
      error.melThrown = true;
      throw error;
    },
  });
}


/* FILE: src/stdlib/functions.js */
function setupFunctions(Lang) {
  Lang.addKeyword('function');
  Lang.addHandler('function', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression, parseBlock) => {
      const name = expect('IDENTIFIER').value;
      expect('SYMBOL', '(');
      const params = [];
      let restParam = null;

      while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
        if (peek().type === 'OPERATOR' && peek().value === '...') {
          next();
          restParam = expect('IDENTIFIER').value;
          break;
        }

        if (peek().type !== 'IDENTIFIER') {
          break;
        }
        const paramName = next().value;

        let defaultValue = null;
        if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
          next();
          defaultValue = parseExpression();
        }

        if (defaultValue !== null) {
          params.push({
            name: paramName,
            default: defaultValue,
          });
        } else {
          params.push(paramName);
        }

        if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
          next();
        }
      }
      expect('SYMBOL', ')');
      expect('SYMBOL', '{');
      const body = parseBlock();
      expect('SYMBOL', '}');

      return {
        type: 'Function',
        name,
        params,
        restParam,
        body,
      };
    },
  });

  Lang.addHandler('Function', {
    type: 'executor',
    execute: (stmt, scope) => {
      scope.set(stmt.name, {
        params: stmt.params,
        restParam: stmt.restParam,
        body: stmt.body,
      });
    },
  });

  Lang.addKeyword('return');
  Lang.addHandler('return', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression) => {
      const returnLine = peek() ? peek().line : 0;
      const nextToken = peek();

      if (
        !nextToken ||
        (nextToken.type === 'SYMBOL' && nextToken.value === '}') ||
        (nextToken.type === 'SYMBOL' && nextToken.value === ';') ||
        nextToken.type === 'NEWLINE'
      ) {
        return { type: 'Return', value: null };
      }

      const value = parseExpression();

      const afterToken = peek();
      if (
        afterToken &&
        afterToken.line === returnLine &&
        afterToken.type !== 'NEWLINE' &&
        !(afterToken.type === 'SYMBOL' && (afterToken.value === '}' || afterToken.value === ';'))
      ) {
        Lang.state.currentLine = returnLine;
        Lang.error('Unexpected token "' + afterToken.value + '" after return expression');
      }

      return { type: 'Return', value };
    },
  });

  Lang.addHandler('Return', {
    type: 'executor',
    execute: (stmt, scope, evaluate) => {
      const value = evaluate(stmt.value, scope);

      if (value && value.__mel_waiting) {
        return value;
      }

      throw { type: 'RETURN', value };
    },
  });

  Lang.addKeyword('class');
  Lang.addKeyword('extends');
  Lang.addKeyword('this');

  Lang.addHandler('class', {
    type: 'statement',
    parse: (expect, next, peek, parseExpression, parseBlock, parseStatement) => {
      const nameToken = next();
      if (!nameToken || nameToken.type !== 'IDENTIFIER') {
        Lang.error('Expected class name after "class"');
      }
      const className = nameToken.value;

      let superClass = null;
      if (peek() && peek().type === 'KEYWORD' && peek().value === 'extends') {
        next();
        const superToken = next();
        if (!superToken || superToken.type !== 'IDENTIFIER') {
          Lang.error('Expected class name after "extends"');
        }
        superClass = superToken.value;
      }

      expect('SYMBOL', '{');

      const properties = [];
      const methods = [];
      let constructor = null;

      while (peek() && !(peek().type === 'SYMBOL' && peek().value === '}')) {
        const token = peek();

        if (token.type === 'IDENTIFIER' && token.value === 'constructor') {
          next();
          expect('SYMBOL', '(');

          const params = [];
          while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
            const param = next();
            if (param.type !== 'IDENTIFIER') {
              Lang.error('Expected parameter name in constructor');
            }
            params.push(param.value);

            if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
              next();
            }
          }
          expect('SYMBOL', ')');

          expect('SYMBOL', '{');
          const body = parseBlock();
          expect('SYMBOL', '}');

          constructor = { params, body };
        } else if (token.type === 'IDENTIFIER') {
          const propName = next().value;

          if (peek() && peek().type === 'SYMBOL' && peek().value === '=') {
            next();
            const value = parseExpression();
            properties.push({ name: propName, value });
          } else if (peek() && peek().type === 'SYMBOL' && peek().value === '(') {
            expect('SYMBOL', '(');

            const params = [];
            while (peek() && !(peek().type === 'SYMBOL' && peek().value === ')')) {
              const param = next();
              if (param.type !== 'IDENTIFIER') {
                Lang.error('Expected parameter name in method');
              }
              params.push(param.value);

              if (peek() && peek().type === 'SYMBOL' && peek().value === ',') {
                next();
              }
            }
            expect('SYMBOL', ')');

            expect('SYMBOL', '{');
            const body = parseBlock();
            expect('SYMBOL', '}');

            methods.push({ name: propName, params, body });
          }
        }

        while (peek() && peek().type === 'NEWLINE') {
          next();
        }
      }

      expect('SYMBOL', '}');

      return {
        type: 'ClassDeclaration',
        name: className,
        superClass,
        constructor,
        properties,
        methods,
      };
    },
  });
}


/* FILE: src/stdlib/wasm.js */
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

      valueOf: function () {
        return this.__mel_value;
      },

      toString: function () {
        return this.__mel_type + '(' + this.__mel_value + ')';
      },
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
        max: 2147483647,
      });
    },
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
        max: 4294967295,
      });
    },
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
        max: Number.MAX_SAFE_INTEGER,
      });
    },
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
        max: Number.MAX_SAFE_INTEGER,
      });
    },
  });

  Lang.addHandler('Float32', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Float32() requires a value');
      }

      return createTypedValue(args[0], 'Float32', {
        min: -3.4028235e38,
        max: 3.4028235e38,
      });
    },
  });

  Lang.addHandler('Float64', {
    type: 'function',
    call: (args, scope) => {
      if (args.length === 0) {
        Lang.error('Float64() requires a value');
      }

      return createTypedValue(args[0], 'Float64', {});
    },
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
      env: { memory: new WebAssembly.Memory({ initial: 256 }) },
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
    },
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
      } else if (moduleName.endsWith('.wasm')) {
        path = moduleName;
      } else {
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
        __mel_memory: wasmInstance.exports.memory || importObject.env.memory,
      };

      const exports = wasmInstance.exports;
      for (let key in exports) {
        if (typeof exports[key] === 'function') {
          wasmWrapper[key] = function (...args) {
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

      wasmWrapper.getMemory = function () {
        return this.__mel_memory;
      };

      wasmWrapper.readString = function (ptr, length) {
        if (!this.__mel_memory) {
          Lang.error('No memory export found in Wasm module');
        }
        const bytes = new Uint8Array(this.__mel_memory.buffer, ptr, length);
        return new TextDecoder().decode(bytes);
      };

      wasmWrapper.writeString = function (str, ptr) {
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

      wasmWrapper.listExports = function () {
        const exportList = [];
        for (let key in exports) {
          exportList.push({
            name: key,
            type: typeof exports[key] === 'function' ? 'function' : 'value',
          });
        }
        return exportList;
      };

      wasmCache.set(path, wasmWrapper);

      return wasmWrapper;
    },
  });
}


/* FILE: src/stdlib/time.js */
function setupTime(Lang) {
  Lang.addHandler('setTimeout', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 2) {
        Lang.error('setTimeout requires 2 arguments: (callback, delay)');
      }

      const callback = args[0];
      const delay = args[1];

      if (typeof callback !== 'function' && (!callback.params || !callback.body)) {
        Lang.error('First argument of setTimeout must be a function');
      }

      const timeoutId = window.setTimeout(() => {
        if (callback.params && callback.body) {
          try {
            for (let i = 0; i < callback.body.length; i++) {
              Lang.state.executeStatement(callback.body[i], Lang.state.variables);
            }
          } catch (e) {
            if (e.type !== 'RETURN') throw e;
          }
        } else if (typeof callback === 'function') {
          callback();
        }
      }, delay);

      return timeoutId;
    },
  });

  Lang.addHandler('clearTimeout', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 1) {
        Lang.error('clearTimeout requires 1 argument: (timeoutId)');
      }

      window.clearTimeout(args[0]);
      return null;
    },
  });

  Lang.addHandler('setInterval', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 2) {
        Lang.error('setInterval requires 2 arguments: (callback, delay)');
      }

      const callback = args[0];
      const delay = args[1];

      if (typeof callback !== 'function' && (!callback.params || !callback.body)) {
        Lang.error('First argument of setInterval must be a function');
      }

      const intervalId = window.setInterval(() => {
        if (callback.params && callback.body) {
          try {
            for (let i = 0; i < callback.body.length; i++) {
              Lang.state.executeStatement(callback.body[i], Lang.state.variables);
            }
          } catch (e) {
            if (e.type !== 'RETURN') throw e;
          }
        } else if (typeof callback === 'function') {
          callback();
        }
      }, delay);

      return intervalId;
    },
  });

  Lang.addHandler('clearInterval', {
    type: 'function',
    call: (args, scope) => {
      if (args.length < 1) {
        Lang.error('clearInterval requires 1 argument: (intervalId)');
      }

      window.clearInterval(args[0]);
      return null;
    },
  });

  Lang.addHandler('getHours', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getHours();
    },
  });

  Lang.addHandler('getMinutes', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getMinutes();
    },
  });

  Lang.addHandler('getSeconds', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getSeconds();
    },
  });

  Lang.addHandler('getMilliseconds', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getMilliseconds();
    },
  });

  Lang.addHandler('getDate', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getDate();
    },
  });

  Lang.addHandler('getMonth', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getMonth();
    },
  });

  Lang.addHandler('getFullYear', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getFullYear();
    },
  });

  Lang.addHandler('getDay', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getDay();
    },
  });

  Lang.addHandler('getTime', {
    type: 'function',
    call: (args, scope) => {
      const date = args[0] ? new Date(args[0]) : new Date();
      return date.getTime();
    },
  });
}


/* FILE: src/stdlib/crypto.js */
function setupCrypto(Lang) {
  Lang.addHandler('crypto', {
    type: 'value',
    value: {
      sha256: function (text) {
        const str = String(text);
        const asyncId =
          'mel-crypto-sha256-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const encoder = new TextEncoder();
            const data = encoder.encode(str);

            crypto.subtle.digest('SHA-256', data).then((hashBuffer) => {
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              this.__mel_return_value = hashArray
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          },
        };

        return cryptoObject;
      },

      sha512: function (text) {
        const str = String(text);
        const asyncId =
          'mel-crypto-sha512-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const encoder = new TextEncoder();
            const data = encoder.encode(str);

            crypto.subtle.digest('SHA-512', data).then((hashBuffer) => {
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              this.__mel_return_value = hashArray
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          },
        };

        return cryptoObject;
      },

      sha1: function (text) {
        const str = String(text);
        const asyncId =
          'mel-crypto-sha1-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const encoder = new TextEncoder();
            const data = encoder.encode(str);

            crypto.subtle.digest('SHA-1', data).then((hashBuffer) => {
              const hashArray = Array.from(new Uint8Array(hashBuffer));
              this.__mel_return_value = hashArray
                .map((b) => b.toString(16).padStart(2, '0'))
                .join('');

              if (this.__mel_submit) {
                this.__mel_submit();
              }
            });
          },
        };

        return cryptoObject;
      },

      randomBytes: function (length) {
        const len = Number(length) || 16;
        const bytes = new Uint8Array(len);
        crypto.getRandomValues(bytes);
        return Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      },

      randomUUID: function () {
        return crypto.randomUUID();
      },

      base64encode: function (text) {
        const str = String(text);
        return btoa(unescape(encodeURIComponent(str)));
      },

      base64decode: function (text) {
        const str = String(text);
        return decodeURIComponent(escape(atob(str)));
      },

      hmac: function (message, key) {
        const msg = String(message);
        const secret = String(key);
        const asyncId =
          'mel-crypto-hmac-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const encoder = new TextEncoder();
            const keyData = encoder.encode(secret);
            const msgData = encoder.encode(msg);

            crypto.subtle
              .importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
              .then((cryptoKey) => {
                return crypto.subtle.sign('HMAC', cryptoKey, msgData);
              })
              .then((signature) => {
                const hashArray = Array.from(new Uint8Array(signature));
                this.__mel_return_value = hashArray
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');

                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              })
              .catch((err) => {
                this.__mel_return_value = 'ERROR: ' + err.message;
                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              });
          },
        };

        return cryptoObject;
      },

      aesEncrypt: function (text, password) {
        const plaintext = String(text);
        const pass = String(password);
        const asyncId =
          'mel-crypto-aes-enc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const encoder = new TextEncoder();
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const passwordData = encoder.encode(pass);

            crypto.subtle
              .importKey('raw', passwordData, 'PBKDF2', false, ['deriveBits', 'deriveKey'])
              .then((keyMaterial) => {
                return crypto.subtle.deriveKey(
                  {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 100000,
                    hash: 'SHA-256',
                  },
                  keyMaterial,
                  { name: 'AES-GCM', length: 256 },
                  false,
                  ['encrypt']
                );
              })
              .then((key) => {
                const data = encoder.encode(plaintext);
                return crypto.subtle
                  .encrypt({ name: 'AES-GCM', iv: iv }, key, data)
                  .then((encrypted) => ({ encrypted, salt, iv }));
              })
              .then(({ encrypted, salt, iv }) => {
                const encryptedArray = new Uint8Array(encrypted);
                const result = new Uint8Array(salt.length + iv.length + encryptedArray.length);
                result.set(salt, 0);
                result.set(iv, salt.length);
                result.set(encryptedArray, salt.length + iv.length);
                this.__mel_return_value = Array.from(result)
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');

                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              })
              .catch((err) => {
                this.__mel_return_value = 'ERROR: ' + err.message;
                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              });
          },
        };

        return cryptoObject;
      },

      aesDecrypt: function (encryptedHex, password) {
        const encrypted = String(encryptedHex);
        const pass = String(password);
        const asyncId =
          'mel-crypto-aes-dec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            try {
              const encoder = new TextEncoder();
              const decoder = new TextDecoder();

              const bytes = new Uint8Array(
                encrypted.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
              );
              const salt = bytes.slice(0, 16);
              const iv = bytes.slice(16, 28);
              const data = bytes.slice(28);

              const passwordData = encoder.encode(pass);

              crypto.subtle
                .importKey('raw', passwordData, 'PBKDF2', false, ['deriveBits', 'deriveKey'])
                .then((keyMaterial) => {
                  return crypto.subtle.deriveKey(
                    {
                      name: 'PBKDF2',
                      salt: salt,
                      iterations: 100000,
                      hash: 'SHA-256',
                    },
                    keyMaterial,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['decrypt']
                  );
                })
                .then((key) => {
                  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, data);
                })
                .then((decrypted) => {
                  this.__mel_return_value = decoder.decode(decrypted);

                  if (this.__mel_submit) {
                    this.__mel_submit();
                  }
                })
                .catch((err) => {
                  this.__mel_return_value = 'ERROR: ' + err.message;
                  if (this.__mel_submit) {
                    this.__mel_submit();
                  }
                });
            } catch (err) {
              this.__mel_return_value = 'ERROR: ' + err.message;
              if (this.__mel_submit) {
                this.__mel_submit();
              }
            }
          },
        };

        return cryptoObject;
      },

      pbkdf2: function (password, salt, iterations, keyLength) {
        const pass = String(password);
        const saltStr = String(salt);
        const iter = Number(iterations) || 100000;
        const len = Number(keyLength) || 32;
        const asyncId =
          'mel-crypto-pbkdf2-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const cryptoObject = {
          __mel_waiting: true,
          __mel_id: asyncId,
          __mel_rendered: false,
          __mel_return_value: null,
          __mel_submit: null,

          __mel_render: function () {
            if (this.__mel_rendered) return;
            this.__mel_rendered = true;

            const encoder = new TextEncoder();
            const passwordData = encoder.encode(pass);
            const saltData = encoder.encode(saltStr);

            crypto.subtle
              .importKey('raw', passwordData, 'PBKDF2', false, ['deriveBits'])
              .then((keyMaterial) => {
                return crypto.subtle.deriveBits(
                  {
                    name: 'PBKDF2',
                    salt: saltData,
                    iterations: iter,
                    hash: 'SHA-256',
                  },
                  keyMaterial,
                  len * 8
                );
              })
              .then((bits) => {
                const hashArray = Array.from(new Uint8Array(bits));
                this.__mel_return_value = hashArray
                  .map((b) => b.toString(16).padStart(2, '0'))
                  .join('');

                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              })
              .catch((err) => {
                this.__mel_return_value = 'ERROR: ' + err.message;
                if (this.__mel_submit) {
                  this.__mel_submit();
                }
              });
          },
        };

        return cryptoObject;
      },
    },
  });

  Lang.addKeyword('crypto');
}


/* FILE: src/stdlib/index.js */
function setupKeywords(Lang, state) {
  Lang.state.variables.set('MEL_SCRIPT', {
    CONFIG: 'console',
  });

  // Chama as funções de setup de cada módulo
  setupData(Lang);
  setupMethods(Lang);
  setupUI(Lang);
  setupIO(Lang);
  setupNetwork(Lang);
  setupControlFlow(Lang);

  setupFunctions(Lang);
  setupCanvas(Lang);
  setupAnimation(Lang);
  setupStorage(Lang);
  setupAudio(Lang);
  setupTime(Lang);
  setupCrypto(Lang);
  setupThreads(Lang);

  setupWasm(Lang);
}


/* FILE: src/stdlib/init.js */
setupKeywords(Lang);


if (typeof module !== 'undefined') {
    module.exports = window.MEL;
}
