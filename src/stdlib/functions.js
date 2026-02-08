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
