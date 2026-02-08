const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcIndex = fs.readFileSync(path.join(projectRoot, 'src', 'index.js'), 'utf8');

// Extrair a lista de arquivos do src/index.js
// Procura por const files = [ ... ];
const match = srcIndex.match(/const files = \[\s*([\s\S]*?)\s*\];/);
if (!match) {
    console.error('Não foi possível encontrar a lista de arquivos em src/index.js');
    process.exit(1);
}

// Limpar e processar a lista
const files = match[1]
    .split(',')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/['"]/g, '')); // Remove aspas

console.log('Arquivos encontrados:', files);

let bundleContent = '';

// Header
bundleContent += '/** MelScript Bundle - Generated automatically **/\n';

// Concatenar arquivos
files.forEach(file => {
    // Pular linhas vazias ou comentários na lista
    if (file.startsWith('//') || file === '') return;
    
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        console.log(`Adicionando: ${file}`);
        let content = fs.readFileSync(filePath, 'utf8');
        bundleContent += `\n/* FILE: ${file} */\n`;
        bundleContent += content + '\n';
    } else {
        console.warn(`Arquivo não encontrado: ${file}`);
    }
});

// Adicionar mel-init.js se existir
const melInitPath = path.join(projectRoot, 'src', 'mel-init.js');
if (fs.existsSync(melInitPath)) {
     console.log(`Adicionando: src/mel-init.js`);
     let content = fs.readFileSync(melInitPath, 'utf8');
     bundleContent += `\n/* FILE: src/mel-init.js */\n`;
     bundleContent += content + '\n';
}

// Escrever o bundle
if (!fs.existsSync(path.join(projectRoot, 'dist'))) {
    fs.mkdirSync(path.join(projectRoot, 'dist'));
}

fs.writeFileSync(path.join(projectRoot, 'dist', 'melscript.js'), bundleContent);
console.log('Bundle criado em dist/melscript.js');
