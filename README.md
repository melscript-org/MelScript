# MelScript

**MelScript** é uma linguagem de programação interpretada, leve e versátil, projetada para rodar tanto na Web quanto no Terminal. Com sintaxe amigável e integração nativa com tecnologias web, o MelScript é ideal para automação, scripts rápidos e aprendizado de lógica de programação.

![MelScript Logo](tooling/vscode-melscript/image.png)

## 🚀 Instalação

### Opção 1: Instalador Windows (Recomendado)
Baixe e execute o instalador oficial `MelScript_Setup_v1.0.0.exe` (disponível na pasta `dist` após o build).
Este instalador configura automaticamente:
- **CLI**: Adiciona o comando `mel` ao seu PATH.
- **Associação de Arquivos**: Permite executar arquivos `.mel` com duplo clique.
- **Web Runner**: Instala um ambiente de execução offline.

### Opção 2: Via NPM (Para Desenvolvedores)
Clone o repositório e instale as dependências:
```bash
git clone https://github.com/melscript-org/MelScript.git
cd MelScript
npm install
npm run build
npm link # Para usar o comando 'mel' globalmente
```

### Opção 3: Extensão VS Code
Para a melhor experiência de desenvolvimento, instale nossa extensão oficial para VS Code (localizada em `tooling/vscode-melscript`), que oferece:
- Syntax Highlighting (Colorização de código)
- Execução integrada com Webview (Command: `Run MelScript`)
- Snippets e suporte a arquivos `.mel` e tags `<mel>` em HTML.

---

## 💻 Como Usar

### 1. Terminal (CLI)
Crie um arquivo `.mel` (ex: `hello.mel`):
```javascript
print("Olá, Mundo!")
x = 10
y = 20
print("Soma: " + (x + y))
```

Execute no terminal:
```bash
mel hello.mel
```

### 2. Web (HTML)
Inclua a biblioteca `melscript.js` em seu projeto HTML (via CDN):

```html
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/gh/melscript-org/MelScript@main/dist/melscript.js"></script>
</head>
<body>
    <!-- Código MelScript embutido -->
    <mel>
        print("Executando no navegador!")
        alert("Olá Web!")
    </mel>
</body>
</html>
```

### 3. Web Runner (Offline)
Se você usou o instalador, abra o atalho **MelScript Web Runner** no Menu Iniciar para testar códigos rapidamente sem criar arquivos.

---

## 🛠️ Desenvolvimento e Build

Se você deseja contribuir ou modificar o MelScript, aqui estão os comandos principais:

| Comando | Descrição |
|---------|-----------|
| `npm run build` | Compila os bundles JS (Web e Node) na pasta `dist/`. |
| `npm run build:exe` | Gera o executável `mel.exe` (Standalone) usando PKG. |
| `npm run build:setup` | Compila o instalador `setup.exe` usando Inno Setup. |
| `npm start` | Inicia um servidor local para testes web. |

### Estrutura do Projeto
- **src/**: Código fonte do interpretador e bibliotecas padrão.
- **dist/**: Artefatos compilados (`melscript.js`, `mel.exe`, etc).
- **bin/**: Scripts de entrada para a CLI.
- **examples/**: Exemplos de código e runner.
- **scripts/**: Scripts de automação de build e instalador.
- **tooling/**: Ferramentas extras (Extensão VS Code).

---

## 📄 Licença
Este projeto está licenciado sob a licença ISC. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
