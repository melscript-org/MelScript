 function handleInputSubmit(inputObject, scope, variableName) {
  if (variableName) {
    scope.set(variableName, inputObject);
  }
  
  state.currentIndex++;
  if (state.currentIndex < state.queue.length) {
    const nextStmt = state.queue[state.currentIndex];
    
    if (nextStmt.type === 'ExpressionStatement' && 
        nextStmt.expression.type === 'MethodCall' &&
        nextStmt.expression.method === 'style') {
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
    }   
    else if (inputObject.__mel_return_value !== undefined) {
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