const state = {
    variables: new Map(),
    handlers: new Map(),
    keywords: new Set(),
    code: '',
    lines: [],
    currentLine: 0,
    currentSource: null,
    tokenize: null,  
    parse: null,     
    executeStatement: null, 
    importedFiles: new Set(),
    paused: false,
    queue: [],
    currentIndex: 0,
    currentScope: null,
    astCache: new Map()
};
