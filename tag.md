# Como publicar a Release v1.0.0

Este documento descreve o processo para lançar a versão v1.0.0 do MelScript.

## 1. Verificações Prévias
- [x] Changelog atualizado (`CHANGELOG.md`)
- [x] Versão no `package.json` atualizada (1.0.0)
- [x] Documentação (`README.md`, `CONTRIBUTING.md`)
- [x] Licença (`LICENSE`)

## 2. Criar a Tag no Git

Abra o terminal e execute:

```bash
# Adiciona todos os arquivos pendentes (caso haja)
git add .
git commit -m "chore: prepare for v1.0.0 release"

# Cria a tag anotada
git tag -a v1.0.0 -m "Release v1.0.0 - First Public Release"

# Envia para o GitHub
git push origin v1.0.0
```

## 3. GitHub Releases

Após enviar a tag, vá para o GitHub:
1. Acesse a aba **Releases**.
2. Clique em **Draft a new release**.
3. Selecione a tag `v1.0.0`.
4. Título: `v1.0.0 - First Release`.
5. Descrição: Copie o conteúdo da versão 1.0.0 do `CHANGELOG.md`.
6. Anexe os binários se desejar (opcional, pois o instalador é local por enquanto).

## 4. Publicação NPM (Opcional)

```bash
npm publish
```
