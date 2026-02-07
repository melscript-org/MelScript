
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
          name: stmt.name
        };
        state.variables.set(stmt.name, funcValue);
        
      }
           
      if (stmt.type === 'ExpressionStatement' && 
          stmt.expression && 
          stmt.expression.type === 'FunctionExpression' &&
          stmt.expression.name) {
        
        const funcExpr = stmt.expression;
        const funcValue = {
          params: funcExpr.params,
          body: funcExpr.body,
          name: funcExpr.name
        };
        
        state.variables.set(funcExpr.name, funcValue);
        console.log('Hoisted function:', funcExpr.name);
      }
           
      if (stmt.type === 'Assignment' && 
          stmt.value && 
          stmt.value.type === 'FunctionExpression') {
        
        const funcExpr = stmt.value;
        const funcValue = {
          params: funcExpr.params,
          body: funcExpr.body,
          name: funcExpr.name || stmt.name
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
    
    const classConstructor = function(...args) {
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
        instance[method.name] = function(...methodArgs) {
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
  debug: debugAST
};
