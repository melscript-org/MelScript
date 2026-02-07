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
                errorMsg += (i + 1) + '|' + prefix + state.lines[i] + '\n';
            }
            errorMsg += 'LINE: ' + (targetLine + 1) + '\n';
            errorMsg += 'Maximum call stack size exceeded (infinite recursion)';
        }
        
        if (melScript && melScript.CONFIG === "web") {
           
            console.error(errorMsg);
        } else {
           
            console.error(errorMsg);
        }
        
       
        return;
    }
}