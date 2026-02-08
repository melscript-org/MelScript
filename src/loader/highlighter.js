// MelScript Syntax Highlighter
// Gera HTML colorido a partir de código fonte MelScript

function highlightMelScript(code) {
  // Escapar HTML básico para evitar injeção
  code = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Definição dos tokens e suas cores (classes CSS)
  const rules = [
    {
      // Strings (aspas simples ou duplas)
      regex: /(['"])(?:(?=(\\?))\2.)*?\1/g,
      class: 'mel-string'
    },
    {
      // Comentários (linha única)
      regex: /\/\/.*/g,
      class: 'mel-comment'
    },
    {
      // Números
      regex: /\b\d+(\.\d+)?\b/g,
      class: 'mel-number'
    },
    {
      // Palavras-chave de controle e declaração
      regex: /\b(if|else|while|for|function|return|var|const|let|async|await)\b/g,
      class: 'mel-keyword'
    },
    {
      // Funções nativas e comuns
      regex: /\b(print|input|wait|alert|prompt|confirm)\b/g,
      class: 'mel-function'
    },
    {
      // Operadores e pontuação
      regex: /[{}()\[\]=+\-*/;,<>!]/g,
      class: 'mel-operator'
    },
    {
      // Booleanos
      regex: /\b(true|false)\b/g,
      class: 'mel-boolean'
    }
  ];

  // Aplicar regras
  // Precisamos tomar cuidado para não substituir dentro de tags HTML já geradas
  // Uma abordagem simples é usar um parser de tokens, mas regex com placeholders funciona para casos simples

  // Vamos usar uma abordagem de substituição com placeholders para evitar conflitos
  const placeholders = [];
  
  function save(match, className) {
    placeholders.push(`<span class="${className}">${match}</span>`);
    return `%%%MEL_PLACEHOLDER_${placeholders.length - 1}%%%`;
  }

  // 1. Strings e Comentários primeiro (para não processar conteúdo dentro deles)
  code = code.replace(/(['"])(?:(?=(\\?))\2.)*?\1/g, match => save(match, 'mel-string'));
  code = code.replace(/\/\/.*/g, match => save(match, 'mel-comment'));

  // 2. Outros tokens
  code = code.replace(/\b(if|else|while|for|function|return|var|const|let|async|await)\b/g, match => save(match, 'mel-keyword'));
  code = code.replace(/\b(print|input|wait|alert|prompt|confirm)\b/g, match => save(match, 'mel-function'));
  code = code.replace(/\b(true|false)\b/g, match => save(match, 'mel-boolean'));
  code = code.replace(/\b\d+(\.\d+)?\b/g, match => save(match, 'mel-number'));
  code = code.replace(/[{}()\[\]=+\-*/;,<>!]/g, match => save(match, 'mel-operator'));

  // Restaurar placeholders
  placeholders.forEach((html, i) => {
    code = code.replace(`%%%MEL_PLACEHOLDER_${i}%%%`, html);
  });

  return code;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = highlightMelScript;
} else {
  window.highlightMelScript = highlightMelScript;
}
