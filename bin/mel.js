#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Tenta carregar do dist local ou do pacote instalado
let MEL;
try {
    MEL = require('../dist/melscript.node.js');
} catch (e) {
    try {
        MEL = require('melscript/dist/melscript.node.js');
    } catch (e2) {
        console.error('Erro: Não foi possível carregar o runtime do MelScript.');
        console.error(e);
        process.exit(1);
    }
}

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
