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
Write-Host "Compilando instalador..." -ForegroundColor Cyan

# Tenta usar o pacote npm 'innosetup' (que inclui o binário)
# Executa via npx para garantir que usa a versão local instalada
$BuildCmd = "npx innosetup ""$IssFile"""
Write-Host "Executando: $BuildCmd" -ForegroundColor Gray

try {
    # Usamos cmd /c para garantir compatibilidade com npx no Windows PowerShell
    cmd /c $BuildCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCESSO! Setup criado em: $DistDir" -ForegroundColor Green
    } else {
        throw "Erro ao compilar instalador (Exit Code: $LASTEXITCODE)"
    }
} catch {
    Write-Error $_
    Write-Warning "Certifique-se de que 'innosetup' está instalado: npm install --save-dev innosetup"
    exit 1
}
