const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcIndex = fs.readFileSync(path.join(projectRoot, 'src', 'index.js'), 'utf8');

// Extrair a lista de arquivos
const match = srcIndex.match(/const files = \[\s*([\s\S]*?)\s*\];/);
if (!match) {
    console.error('Não foi possível encontrar a lista de arquivos em src/index.js');
    process.exit(1);
}

const allFiles = match[1]
    .split(',')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/['"]/g, ''));

// Filtro de arquivos para Node
const excludedPatterns = [
    'src/stdlib/ui.js',
    'src/stdlib/canvas/',
    'src/stdlib/audio.js',
    'src/stdlib/animation.js',
    'src/loader/',
    'src/stdlib/storage.js',
    'src/stdlib/threads.js'
];

const files = allFiles.filter(f => !excludedPatterns.some(p => f.includes(p)));

let bundleContent = '/** MelScript Node Bundle **/\n';

// Header com Polyfills
bundleContent += `
if (typeof window === 'undefined') {
    global.window = global;
}
// Stubs para funções de UI/Canvas removidas
global.setupUI = function() {};
global.setupCanvas = function() {};
global.setupAnimation = function() {};
global.setupAudio = function() {};
global.setupStorage = function() {};
global.setupThreads = function() {};
\n`;

files.forEach(file => {
    if (file.startsWith('//') || file === '') return;
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
        console.log(`Adicionando: ${file}`);
        bundleContent += `\n/* FILE: ${file} */\n`;
        bundleContent += fs.readFileSync(filePath, 'utf8') + '\n';
    } else {
        console.warn(`Arquivo ignorado (não encontrado): ${file}`);
    }
});

// Adicionar mel-init.js se existir (igual ao build.js original)
// const melInitPath = path.join(projectRoot, 'src', 'mel-init.js');
// if (fs.existsSync(melInitPath)) {
//      console.log(`Adicionando: src/mel-init.js`);
//      let content = fs.readFileSync(melInitPath, 'utf8');
//      bundleContent += `\n/* FILE: src/mel-init.js */\n`;
//      bundleContent += content + '\n';
// }

// Export
bundleContent += `
if (typeof module !== 'undefined') {
    module.exports = window.MEL;
}
`;

if (!fs.existsSync(path.join(projectRoot, 'dist'))) {
    fs.mkdirSync(path.join(projectRoot, 'dist'));
}

fs.writeFileSync(path.join(projectRoot, 'dist', 'melscript.node.js'), bundleContent);
console.log('Node Bundle criado em dist/melscript.node.js');
