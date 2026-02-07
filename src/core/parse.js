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
    error('Expected ' + type + (value ? ' "' + value + '"' : '') + ' but got ' + (token ? token.value : 'EOF'));
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
  
  if (token && token.type === 'SYMBOL' && (token.value === '-' || token.value === '+' || token.value === '!')) {
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
  
  while (peek() && (peek().type === 'OPERATOR' && ['<', '>', '<=', '>='].includes(peek().value) || peek().type === 'SYMBOL' && ['<', '>'].includes(peek().value))) {
    if (shouldStopAtLineBreak(left, peek())) break;
    
    const op = next().value;
    const right = parseAdditive();
    left = { type: 'BinaryOp', operator: op, left, right };
  }
  return left;
}

function parseEquality() {
  let left = parseComparison();
  
  while (peek() && peek().type === 'OPERATOR' && ['===', '!==', '==', '!='].includes(peek().value)) {
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
      left = { type: 'MemberAccess', object: left, property: index, computed: true, line: left.line };
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
        
        left = { type: 'MethodCall', object: left, method: propertyName, args: args, line: property.line };
      } else {       
        left = { type: 'MemberAccess', object: left, property: propertyName, computed: false, line: property.line };
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
        line: left.line 
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
  
  
  if (peek() && peek().type === 'SYMBOL' && (peek().value === ',' || peek().value === '}')) {
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
        default: defaultValue
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
    return { type: 'Literal', value: t.value, numType: t.hasDecimal ? 'float' : 'int', line: t.line };
  }
  
  if (token.type === 'TEMPLATE') {
    const t = next();
    return { 
      type: 'Template', 
      parts: t.parts, 
      expressions: t.expressions, 
      line: t.line 
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
          default: defaultValue
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
          line: token.line 
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
  
  if (token.type === 'SYMBOL' && ['*','/', '%', '.'].includes(token.value)) {
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
    
    if (!rawNextToken || rawNextToken.type === 'NEWLINE' || rawNextToken.type === 'EOF' || (rawNextToken.type === 'SYMBOL' && rawNextToken.value === ';')) {
      pos = savedPos;
      const expr = parseExpression();
      
      if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
        next();
      }
      
      return { 
        type: 'ExpressionStatement', 
        expression: expr, 
        line: nameLine 
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
        line: nameLine 
      };
    }
    
    if (nextToken && nextToken.type === 'OPERATOR' && (nextToken.value === '++' || nextToken.value === '--')) {
      const op = next().value;
      return { type: 'PostfixOp', operator: op, name: name, line: nameLine };
    }
    
    if (nextToken && nextToken.type === 'OPERATOR' && ['+=', '-=', '*=', '/='].includes(nextToken.value)) {
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
        line: nameLine 
      };
    }

    if (nextToken.type !== 'OPERATOR' && 
        (nextToken.type !== 'SYMBOL' || 
         (nextToken.value !== '=' && nextToken.value !== '(' && 
          nextToken.value !== '[' && nextToken.value !== '.'))) {
      pos = savedPos;
      const expr = parseExpression();
      
      if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
        next();
      }
      
      return { 
        type: 'ExpressionStatement', 
        expression: expr, 
        line: nameLine 
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
        } else if (peek() && peek().line === token.line && (peek().type === 'IDENTIFIER' || peek().type === 'KEYWORD')) {
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
        } else if (peek() && peek().line === token.line && (peek().type === 'IDENTIFIER' || peek().type === 'KEYWORD')) {
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
          line: token.line
        };
      }
    }
    
    if (peek() && peek().type === 'SYMBOL' && peek().value === ';') {
      next();
    } else if (peek() && peek().line === token.line && (peek().type === 'IDENTIFIER' || peek().type === 'KEYWORD')) {
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



