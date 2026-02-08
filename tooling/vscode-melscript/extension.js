const vscode = require('vscode');
const path = require('path');

function activate(context) {
    console.log('MelScript extension is now active!');

    let disposable = vscode.commands.registerCommand('melscript.run', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('Abra um arquivo .mel para executar.');
            return;
        }

        // Cria o painel Webview
        const panel = vscode.window.createWebviewPanel(
            'melScriptPreview',
            'MelScript Preview',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            }
        );

        // URI para o script do bundle
        const melScriptUri = panel.webview.asWebviewUri(vscode.Uri.file(
            path.join(context.extensionPath, 'media', 'melscript.js')
        ));

        const code = editor.document.getText();
        
        panel.webview.html = getWebviewContent(code, melScriptUri);
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(code, scriptUri) {
    // Escapar caracteres HTML básicos no código para evitar quebra da tag
    const safeCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MelScript Preview</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            padding: 20px; 
            background-color: #1e1e1e; 
            color: #d4d4d4; 
        }
        h1 { font-size: 1.2rem; color: #569cd6; border-bottom: 1px solid #333; padding-bottom: 10px; }
        .info { font-size: 0.9rem; color: #888; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>Resultado da Execução</h1>
    <p class="info">Output renderizado pelo MelScript Runtime.</p>
    
    <!-- Container para a aplicação -->
    <div id="app"></div>
    
    <!-- Configuração do Ambiente Web -->
    <mel hidden>
        // Força o modo Web para que o print() exiba no HTML em vez do console
        MEL_SCRIPT = { CONFIG: "web" };
    </mel>
    
    <!-- Código MelScript Injetado -->
    <!-- Usamos o atributo 'hidden' para não mostrar o código fonte, apenas executar -->
    <mel hidden>
${code}
    </mel>

    <!-- Runtime -->
    <script src="${scriptUri}"></script>
    
    <script>
        // Intercepta erros globais não capturados
        window.onerror = function(message, source, lineno, colno, error) {
            const outputDiv = document.getElementById('mel-output') || document.createElement('div');
            if (!outputDiv.id) {
                outputDiv.id = 'mel-output';
                document.body.appendChild(outputDiv);
            }
            const errDiv = document.createElement('div');
            errDiv.style.color = 'red';
            errDiv.style.marginTop = '10px';
            errDiv.textContent = 'Erro de Sistema: ' + message;
            outputDiv.appendChild(errDiv);
        };
    </script>
</body>
</html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
