; Script gerado para Inno Setup
; MelScript Installer

#define MyAppName "MelScript"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "MelScript Org"
#define MyAppURL "https://github.com/melscript-org/MelScript"
#define MyAppExeName "mel.exe"

[Setup]
; Identificação
AppId={{D3F87A12-B4C1-4D2E-9F3A-8B6C7D4E5F1G}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

; Diretório padrão (Local AppData é melhor para instalação por usuário sem admin)
DefaultDirName={autopf}\MelScript
DisableProgramGroupPage=yes

; Opções de Licença e Info
LicenseFile=..\LICENSE
; InfoBeforeFile=..\README.md (Removido pois README.md não existe na raiz)

; Configurações de saída
OutputDir=..\dist
OutputBaseFilename=MelScript_Setup_v{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern

; Ícone do instalador (usar o mesmo ícone do app)
SetupIconFile=icon_files.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "addtopath"; Description: "Adicionar MelScript ao PATH do sistema"; GroupDescription: "Configuração do Sistema:"

[Files]
; Executável principal
Source: "..\dist\mel.exe"; DestDir: "{app}"; Flags: ignoreversion
; Ícone
Source: "icon_files.ico"; DestDir: "{app}"; DestName: "icon.ico"; Flags: ignoreversion
; Licença
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Registry]
; Associação de arquivo .mel
Root: HKCU; Subkey: "Software\Classes\.mel"; ValueType: string; ValueName: ""; ValueData: "MelScriptFile"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\MelScriptFile"; ValueType: string; ValueName: ""; ValueData: "MelScript Source File"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\MelScriptFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\icon.ico,0"
Root: HKCU; Subkey: "Software\Classes\MelScriptFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

; Adicionar ao PATH (método via Registry para usuário atual)
; Nota: O Inno Setup não tem comando nativo simples para PATH, vamos usar a seção [Code] ou apenas Registry se for simples.
; No entanto, modificar PATH via Registry diretamente pode sobrescrever.
; Vamos usar a abordagem recomendada: modpath.iss ou script pascal.
; Para simplificar, vamos usar uma chave de registro RunOnce ou Environment se possível,
; mas o ideal é a seção Code. Veja abaixo.

[Code]
const
  EnvironmentKey = 'Environment';

procedure EnvAddPath(Path: string);
var
  Paths: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths) then
    Paths := '';

  if Pos(';' + Path + ';', ';' + Paths + ';') = 0 then
  begin
    Paths := Paths + ';' + Path;
    RegWriteStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths);
  end;
end;

procedure EnvRemovePath(Path: string);
var
  Paths: string;
  P: Integer;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths) then
    Exit;

  P := Pos(';' + Path + ';', ';' + Paths + ';');
  if P = 0 then
  begin
    if Pos(Path + ';', Paths) = 1 then P := 1
    else if Pos(';' + Path, Paths) = Length(Paths) - Length(Path) then P := Length(Paths) - Length(Path);
  end;

  if P > 0 then
  begin
    Delete(Paths, P - 1, Length(Path) + 1);
    RegWriteStringValue(HKEY_CURRENT_USER, EnvironmentKey, 'Path', Paths);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and IsTaskSelected('addtopath') then
  begin
    EnvAddPath(ExpandConstant('{app}'));
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usPostUninstall then
  begin
    EnvRemovePath(ExpandConstant('{app}'));
  end;
end;
