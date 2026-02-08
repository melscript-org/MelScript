(function () {
  const originalConsoleError = console.error;

  console.error = function (...args) {
    const melScript = window.MEL?.interpreter?.state?.variables?.get('MEL_SCRIPT');

    if (
      melScript &&
      melScript.ERROR_TYPES &&
      typeof melScript.ERROR_TYPES === 'object' &&
      melScript.ERROR_TYPES.params
    ) {
      return;
    }

    if (melScript && melScript.CONFIG === 'web') {
      const errorMsg = args.join(' ');

      if (errorMsg.includes('Error in:') || errorMsg.includes('LINE:')) {
        let isMaximized = false;
        let savedStyle = {};

        const errorWindow = document.createElement('div');
        errorWindow.style.cssText =
          'position:fixed;top:20px;left:50%;transform:translateX(-50%);width:90%;max-width:600px;background:#fff;border:1px solid #0078d4;border-radius:8px 8px 0 0;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:99999;font-family:Segoe UI,Arial,sans-serif;';

        const titleBar = document.createElement('div');
        titleBar.style.cssText =
          'background:linear-gradient(to bottom, #fff 0%, #f0f0f0 100%);border-bottom:1px solid #d0d0d0;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;cursor:move;user-select:none;border-radius:8px 8px 0 0;';

        const titleLeft = document.createElement('div');
        titleLeft.style.cssText = 'display:flex;align-items:center;gap:8px;';

        const icon = document.createElement('div');
        icon.style.cssText =
          'width:16px;height:16px;background:#ff0000;border-radius:2px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:bold;';
        icon.textContent = '✕';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:13px;color:#000;';
        title.textContent = 'MEL Runtime Error';

        const buttons = document.createElement('div');
        buttons.style.cssText = 'display:flex;';

        const maximizeBtn = document.createElement('button');
        maximizeBtn.innerHTML = '□';
        maximizeBtn.style.cssText =
          'width:45px;height:29px;background:transparent;border:none;color:#000;font-size:16px;cursor:pointer;transition:background 0.2s;';
        maximizeBtn.onmouseover = function () {
          this.style.background = '#e0e0e0';
        };
        maximizeBtn.onmouseout = function () {
          this.style.background = 'transparent';
        };
        maximizeBtn.onclick = function () {
          if (!isMaximized) {
            savedStyle = {
              top: errorWindow.style.top,
              left: errorWindow.style.left,
              width: errorWindow.style.width,
              height: errorWindow.style.height,
              transform: errorWindow.style.transform,
              borderRadius: errorWindow.style.borderRadius,
            };
            errorWindow.style.top = '0';
            errorWindow.style.left = '0';
            errorWindow.style.width = '100%';
            errorWindow.style.height = '100%';
            errorWindow.style.transform = 'none';
            errorWindow.style.borderRadius = '0';
            errorWindow.style.maxWidth = 'none';
            titleBar.style.borderRadius = '0';
            titleBar.style.cursor = 'default';
            maximizeBtn.innerHTML = '❐';
            isMaximized = true;
          } else {
            errorWindow.style.top = savedStyle.top;
            errorWindow.style.left = savedStyle.left;
            errorWindow.style.width = savedStyle.width;
            errorWindow.style.height = savedStyle.height;
            errorWindow.style.transform = savedStyle.transform;
            errorWindow.style.borderRadius = savedStyle.borderRadius;
            errorWindow.style.maxWidth = '600px';
            titleBar.style.borderRadius = '8px 8px 0 0';
            titleBar.style.cursor = 'move';
            maximizeBtn.innerHTML = '□';
            isMaximized = false;
          }
        };

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText =
          'width:45px;height:29px;background:transparent;border:none;color:#000;font-size:16px;cursor:pointer;transition:background 0.2s;';
        closeBtn.onmouseover = function () {
          this.style.background = '#e81123';
          this.style.color = '#fff';
        };
        closeBtn.onmouseout = function () {
          this.style.background = 'transparent';
          this.style.color = '#000';
        };
        closeBtn.onclick = function () {
          errorWindow.remove();
        };

        buttons.appendChild(maximizeBtn);
        buttons.appendChild(closeBtn);

        titleLeft.appendChild(icon);
        titleLeft.appendChild(title);
        titleBar.appendChild(titleLeft);
        titleBar.appendChild(buttons);

        const content = document.createElement('div');
        content.style.cssText = 'padding:15px;background:#fff;max-height:70vh;overflow-y:auto;';

        const errorContent = document.createElement('pre');
        errorContent.style.cssText =
          'margin:0;font-family:Consolas,monospace;font-size:13px;color:#000;white-space:pre-wrap;word-wrap:break-word;';
        errorContent.textContent = errorMsg;

        content.appendChild(errorContent);
        errorWindow.appendChild(titleBar);
        errorWindow.appendChild(content);
        document.body.appendChild(errorWindow);

        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        titleBar.addEventListener('mousedown', function (e) {
          if (!isMaximized) {
            isDragging = true;
            initialX = e.clientX - errorWindow.offsetLeft;
            initialY = e.clientY - errorWindow.offsetTop;
          }
        });

        document.addEventListener('mousemove', function (e) {
          if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            errorWindow.style.left = currentX + 'px';
            errorWindow.style.top = currentY + 'px';
            errorWindow.style.transform = 'none';
          }
        });

        document.addEventListener('mouseup', function () {
          isDragging = false;
        });

        return;
      }
    }

    originalConsoleError.apply(console, args);
  };

  function executeMelScripts() {
    const melScripts = document.getElementsByTagName('mel');
    const scriptsArray = Array.from(melScripts);

    for (let i = 0; i < scriptsArray.length; i++) {
      const scriptEl = scriptsArray[i];
      // Normaliza o código removendo indentação comum da primeira linha se necessário
      // mas vamos manter simples por enquanto
      const code = scriptEl.textContent;

      // Highlight visual
      if (scriptEl.hasAttribute('view')) {
         if (typeof window.highlightMelScript === 'function') {
             // Remove primeira quebra de linha se existir para ficar bonito
             let displayCode = code.replace(/^\n/, ''); 
             scriptEl.innerHTML = window.highlightMelScript(displayCode);
         }
      }

      const isWebMode = /MEL_SCRIPT\s*[.=]/i.test(code) && /["']web["']/i.test(code);

      if (isWebMode) {
        window.MEL.interpreter.state.variables.set('MEL_SCRIPT', { CONFIG: 'web' });
      }

      try {
        window.MEL.execute(code);
      } catch (e) {
        window.MEL.interpreter.state.paused = true;
        window.MEL.interpreter.state.queue = [];
        window.MEL.interpreter.state.currentIndex = 0;

        if (!e.melSilent && !e.melHandled) {
          throw e;
        }
      }

      // Só remove se NÃO for para visualizar
      if (!scriptEl.hasAttribute('view')) {
        scriptEl.remove();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', executeMelScripts);
  } else {
    executeMelScripts();
  }
})();
