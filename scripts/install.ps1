# MelScript Installer for Windows
# Instala o binário, configura o PATH e associa a extensão .mel

$ErrorActionPreference = "Stop"

# Configuração de Caminhos
$InstallDir = "$env:LOCALAPPDATA\MelScript"
$SourceExe = Join-Path $PSScriptRoot "..\dist\mel.exe"
$SourceIcon = Join-Path $PSScriptRoot "icon_files.ico"

Write-Host "Iniciando instalação do MelScript..." -ForegroundColor Cyan

# 1. Verificar Arquivos
if (-not (Test-Path $SourceExe)) {
    Write-Error "Erro: Executável não encontrado em $SourceExe. Execute 'npm run build:exe' primeiro."
    exit 1
}
if (-not (Test-Path $SourceIcon)) {
    Write-Warning "Aviso: Ícone não encontrado em $SourceIcon. O ícone padrão será usado."
}

# 2. Criar Diretório de Instalação
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    Write-Host "Diretório criado: $InstallDir" -ForegroundColor Green
}

# 3. Copiar Arquivos
Copy-Item -Path $SourceExe -Destination "$InstallDir\mel.exe" -Force
Write-Host "Executável copiado." -ForegroundColor Green

if (Test-Path $SourceIcon) {
    Copy-Item -Path $SourceIcon -Destination "$InstallDir\icon.ico" -Force
    Write-Host "Ícone copiado." -ForegroundColor Green
}

# 4. Adicionar ao PATH do Usuário
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    $NewPath = "$UserPath;$InstallDir"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "Adicionado ao PATH do usuário." -ForegroundColor Green
} else {
    Write-Host "Já está no PATH." -ForegroundColor Yellow
}

# 5. Associar Extensão .mel (Registro do Usuário - HKCU)
# Não requer privilégios de Administrador para HKCU
try {
    # .mel -> MelScriptFile
    $RegPathExt = "HKCU:\Software\Classes\.mel"
    if (-not (Test-Path $RegPathExt)) { New-Item -Path $RegPathExt -Force | Out-Null }
    Set-ItemProperty -Path $RegPathExt -Name "(default)" -Value "MelScriptFile"

    # MelScriptFile definição
    $RegPathProg = "HKCU:\Software\Classes\MelScriptFile"
    if (-not (Test-Path $RegPathProg)) { New-Item -Path $RegPathProg -Force | Out-Null }
    Set-ItemProperty -Path $RegPathProg -Name "(default)" -Value "MelScript Source File"

    # Ícone
    if (Test-Path "$InstallDir\icon.ico") {
        $RegPathIcon = "$RegPathProg\DefaultIcon"
        if (-not (Test-Path $RegPathIcon)) { New-Item -Path $RegPathIcon -Force | Out-Null }
        Set-ItemProperty -Path $RegPathIcon -Name "(default)" -Value "$InstallDir\icon.ico"
    }

    # Comando de Execução (Open)
    $RegPathCmd = "$RegPathProg\shell\open\command"
    if (-not (Test-Path $RegPathCmd)) { New-Item -Path $RegPathCmd -Force | Out-Null }
    # Aspas importantes para caminhos com espaço e argumentos
    $OpenCmd = "`"$InstallDir\mel.exe`" `"%1`""
    Set-ItemProperty -Path $RegPathCmd -Name "(default)" -Value $OpenCmd

    Write-Host "Associação de arquivo .mel configurada com sucesso!" -ForegroundColor Green
} catch {
    Write-Error "Falha ao configurar registro: $_"
}

Write-Host "`nInstalação Concluída!" -ForegroundColor Cyan
Write-Host "Tente abrir um novo terminal e digitar 'mel --help' ou clicar duas vezes em um arquivo .mel" -ForegroundColor White
Write-Host "Nota: Pode ser necessário reiniciar o Explorer ou fazer logoff para que os ícones atualizem." -ForegroundColor Gray
