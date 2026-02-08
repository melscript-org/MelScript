const fs = require('fs');
const path = require('path');

// Require estático para o pkg detectar e incluir o arquivo
const MEL = require('../dist/melscript.node.js');

const args = process.argv.slice(2);
if (args.length === 0) {
    console.log('MelScript CLI v1.0.0');
    console.log('Uso: mel <arquivo.mel>');
    process.exit(0);
}

const filePath = args[0];
const absPath = path.resolve(process.cwd(), filePath);

if (!fs.existsSync(absPath)) {
    console.error('Arquivo não encontrado:', absPath);
    process.exit(1);
}

const code = fs.readFileSync(absPath, 'utf8');

try {
    MEL.execute(code);
} catch (err) {
    console.error('Erro de execução:', err);
    process.exit(1);
}
