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
