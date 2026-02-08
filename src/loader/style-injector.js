
// Injetor de estilos MelScript
(function() {
    const css = `
mel {
    display: block;
    background-color: #1e1e1e;
    color: #d4d4d4;
    padding: 16px;
    border-radius: 8px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre;
    margin: 16px 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    border: 1px solid #333;
}

mel[hidden] {
    display: none !important;
}

.mel-keyword { color: #569cd6; font-weight: bold; }
.mel-string { color: #ce9178; }
.mel-number { color: #b5cea8; }
.mel-comment { color: #6a9955; font-style: italic; }
.mel-function { color: #dcdcaa; }
.mel-operator { color: #d4d4d4; }
.mel-boolean { color: #569cd6; }
`;

    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = 'melscript-styles';
    
    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    
    document.head.appendChild(style);
})();
