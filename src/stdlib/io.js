function setupIO(Lang) {
    

Lang.addHandler('input', {
  type: 'function',
  call: (args, scope) => {
    const promptText = args.length > 0 ? String(args[0]) : '';
    
    let melScript = null;
    
    if (scope.has('MEL_SCRIPT')) {
      melScript = scope.get('MEL_SCRIPT');
    }
       
    if (melScript && melScript.CONFIG === "web") {
      if (typeof window !== 'undefined') {
        const inputId = 'mel-input-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        
        const inputObject = {
          __mel_waiting: true,
          __mel_id: inputId,
          __mel_rendered: false,
          __mel_prompt: promptText,
          __mel_theme: 'default',
          __mel_styles: {},
          
          __mel_render: function() {
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
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                min-width: 300px;
              `;
              
              let label = null;
              if (this.__mel_prompt) {
                label = document.createElement('div');
                label.textContent = this.__mel_prompt;
                label.style.cssText = `
                  margin-bottom: 10px;
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
                border: 1px solid #ccc;
                border-radius: 4px;
                font-family: monospace;
                box-sizing: border-box;
              `;
              
              button.style.cssText = `
                margin-top: 10px;
                padding: 8px 16px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-family: monospace;
                user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;

  -webkit-tap-highlight-color: transparent;
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
          }
        };
        
        return inputObject;
      }
    }    
    
    return prompt(promptText) || '';
  }
});

Lang.addHandler('print', {
  type: 'function',
  call: (args, scope) => {
    const formatValue = (value) => {
      if (Array.isArray(value)) {
        return '[' + value.map(v => formatValue(v)).join(', ') + ']';
      }
      if (typeof value === 'string') {
        return value;
      }
      return String(value);
    };
   
    let output;
    if (args.length === 1 && Array.isArray(args[0])) {
      
      output = args[0].map(v => formatValue(v)).join(' ');
    } else {
      
      output = args.map(arg => formatValue(arg)).join('');
    }
    
    let melScript = null;
    
    if (scope.has('MEL_SCRIPT')) {
      melScript = scope.get('MEL_SCRIPT');
    }
    
    if (melScript && melScript.CONFIG === "web") {
      if (typeof window !== 'undefined') {
        let outputDiv = document.getElementById('mel-output');
        
        if (!outputDiv) {
          outputDiv = document.createElement('div');
          outputDiv.id = 'mel-output';
          outputDiv.style.cssText = 'color:#000;padding:10px;font-family:monospace;white-space:pre-wrap;';
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
  }
});

}
