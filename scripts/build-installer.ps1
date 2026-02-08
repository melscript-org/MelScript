# Script PowerShell para compilar o instalador Inno Setup
$ErrorActionPreference = "Stop"

# Define caminhos absolutos baseados na localização deste script
$ScriptDir = $PSScriptRoot
$ProjectRoot = Resolve-Path "$ScriptDir\.."
$DistDir = Join-Path $ProjectRoot "dist"
$MelExe = Join-Path $DistDir "mel.exe"
$IssFile = Join-Path $ScriptDir "setup.iss"

Write-Host "Iniciando build do instalador..." -ForegroundColor Cyan
Write-Host "Diretório do Projeto: $ProjectRoot" -ForegroundColor Gray

# 1. Verificar se o executável existe
if (-not (Test-Path $MelExe)) {
    Write-Host "mel.exe não encontrado em $MelExe" -ForegroundColor Yellow
    Write-Host "Executando 'npm run build:exe'..." -ForegroundColor Cyan
    
    # Muda para a raiz do projeto para rodar npm
    Push-Location $ProjectRoot
    try {
        if ($IsWindows) {
            cmd /c "npm run build:exe"
        } else {
            npm run build:exe
        }
    } finally {
        Pop-Location
    }
}

# Verificação final
if (-not (Test-Path $MelExe)) {
    Write-Error "Falha ao gerar mel.exe. Verifique os erros acima."
    exit 1
}

# 2. Compilar usando Inno Setup
Write-Host "Tentando compilar o script Inno Setup..." -ForegroundColor Cyan

# Verifica se ISCC está no PATH
if (Get-Command "iscc" -ErrorAction SilentlyContinue) {
    Write-Host "Compilador Inno Setup encontrado no PATH." -ForegroundColor Green
    iscc $IssFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCESSO! Setup criado em: $DistDir" -ForegroundColor Green
        exit 0
    }
} else {
    # Tenta usar o pacote npm 'innosetup-compiler'
    Write-Host "ISCC não encontrado no PATH. Tentando via npx..." -ForegroundColor Yellow
    
    # Muda para scripts onde está o .iss
    Push-Location $ScriptDir
    try {
        # Tenta executar via npx (requer que o usuário tenha instalado o Inno Setup mas não esteja no path, 
        # ou que o pacote consiga achar magicamente)
        # Nota: O pacote npm innosetup-compiler NÃO baixa o Inno Setup, apenas faz a ponte.
        
        # Verificação simples: Se não tiver Inno Setup instalado no Windows, isso vai falhar.
        # Não vamos rodar npx se soubermos que vai falhar, para evitar erro feio.
        
        Write-Warning "Inno Setup Compiler (ISCC) não foi detectado."
        Write-Warning "Para gerar o arquivo 'setup.exe', você precisa instalar o Inno Setup 6+."
        Write-Host ""
        Write-Host "1. Baixe e instale: https://jrsoftware.org/isdl.php" -ForegroundColor White
        Write-Host "2. Adicione ao PATH ou execute manualmente:" -ForegroundColor White
        Write-Host "   iscc ""$IssFile""" -ForegroundColor White
        Write-Host ""
        Write-Host "Enquanto isso, você pode usar o instalador manual 'scripts/install.ps1'." -ForegroundColor Green
    } finally {
        Pop-Location
    }
}
