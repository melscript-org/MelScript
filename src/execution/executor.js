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
      const className = stmt.name;
      const superClass = stmt.superClass;
      const constructor = stmt.constructor;
      const properties = stmt.properties;
      const methods = stmt.methods;

      const classConstructor = function (...args) {
        const instance = {};

        if (superClass) {
          const superValue = scope.get(superClass);
          if (!superValue || typeof superValue !== 'function') {
            error('Super class "' + superClass + '" is not defined');
          }
          const superInstance = superValue(...args);
          Object.assign(instance, superInstance);
        }

        for (const prop of properties) {
          const value = evaluate(prop.value, scope);
          instance[prop.name] = value;
        }

        for (const method of methods) {
          instance[method.name] = function (...methodArgs) {
            const methodScope = new Map(scope);

            for (let i = 0; i < method.params.length; i++) {
              methodScope.set(method.params[i], methodArgs[i]);
            }

            for (const key in instance) {
              if (typeof instance[key] !== 'function') {
                methodScope.set(key, instance[key]);
              }
            }

            let returnValue = undefined;
            try {
              for (const s of method.body) {
                executeStatement(s, methodScope);
              }
            } catch (e) {
              if (e && e.type === 'RETURN') {
                returnValue = e.value;
              } else {
                throw e;
              }
            }

            for (const key in instance) {
              if (typeof instance[key] !== 'function' && methodScope.has(key)) {
                instance[key] = methodScope.get(key);
              }
            }

            return returnValue;
          };
        }

        if (constructor) {
          const constructorScope = new Map(scope);

          for (const key in instance) {
            if (typeof instance[key] !== 'function') {
              constructorScope.set(key, instance[key]);
            }
          }

          for (let i = 0; i < constructor.params.length; i++) {
            constructorScope.set(constructor.params[i], args[i]);
          }

          try {
            for (const s of constructor.body) {
              executeStatement(s, constructorScope);
            }
          } catch (e) {
            if (e && e.type === 'RETURN') {
            } else {
              throw e;
            }
          }

          for (const [key, value] of constructorScope) {
            if (typeof value !== 'function') {
              instance[key] = value;
            }
          }
        }

        return instance;
      };

      scope.set(className, classConstructor);
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
