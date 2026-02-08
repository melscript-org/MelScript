; Script gerado para Inno Setup
; MelScript Installer

#define MyAppName "MelScript"
#define MyAppVersion "1.0.1"
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

; Permite ao usuário escolher entre "Todos os usuários" (Admin) e "Apenas eu" (User)
PrivilegesRequiredOverridesAllowed=dialog
; Notifica o sistema sobre mudanças no PATH
ChangesEnvironment=yes

; Diretório padrão (Local AppData é melhor para instalação por usuário sem admin)
DefaultDirName={autopf}\MelScript
DisableProgramGroupPage=yes

; Opções de Licença e Info
LicenseFile=..\LICENSE

; Configurações de saída
OutputDir=..\dist
OutputBaseFilename=MelScript_Setup_v{#MyAppVersion}
Compression=lzma
SolidCompression=yes
WizardStyle=modern

; Ícone do instalador
SetupIconFile=icon_files.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "portuguese"; MessagesFile: "compiler:Languages\Portuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "addtopath"; Description: "Adicionar MelScript ao PATH do sistema"; GroupDescription: "Configuração do Sistema:"

[Files]
; Executável principal
Source: "..\dist\mel.exe"; DestDir: "{app}"; Flags: ignoreversion

; Bibliotecas (Web e Node)
Source: "..\dist\melscript.js"; DestDir: "{app}\lib"; Flags: ignoreversion
Source: "..\dist\melscript.node.js"; DestDir: "{app}\lib"; Flags: ignoreversion

; Exemplos e Runner
Source: "..\examples\runner.html"; DestDir: "{app}\examples"; Flags: ignoreversion
Source: "..\examples\hello.mel"; DestDir: "{app}\examples"; Flags: ignoreversion

; Ícone
Source: "icon_files.ico"; DestDir: "{app}"; DestName: "icon.ico"; Flags: ignoreversion

; Licença
Source: "..\LICENSE"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Atalho principal (CLI)
Name: "{autoprograms}\{#MyAppName} CLI"; Filename: "{cmd}"; Parameters: "/k ""{app}\{#MyAppExeName}"""; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\{#MyAppName} CLI"; Filename: "{cmd}"; Parameters: "/k ""{app}\{#MyAppExeName}"""; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

; Atalho para Web Runner
Name: "{autoprograms}\{#MyAppName} Web Runner"; Filename: "{app}\examples\runner.html"; IconFilename: "{app}\icon.ico"

[Registry]
; Associação de arquivo .mel
Root: HKCU; Subkey: "Software\Classes\.mel"; ValueType: string; ValueName: ""; ValueData: "MelScriptFile"; Flags: uninsdeletevalue
Root: HKCU; Subkey: "Software\Classes\MelScriptFile"; ValueType: string; ValueName: ""; ValueData: "MelScript Source File"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\MelScriptFile\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\icon.ico,0"
Root: HKCU; Subkey: "Software\Classes\MelScriptFile\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#MyAppExeName}"" ""%1"""

[Code]
const
  EnvironmentKey = 'SYSTEM\CurrentControlSet\Control\Session Manager\Environment';

procedure EnvAddPath(Path: string);
var
  Paths: string;
  RootKey: Integer;
  SubKey: string;
begin
  // Decide se usa HKLM (System) ou HKCU (User) baseado no modo de instalação
  if IsAdminInstallMode then
  begin
    RootKey := HKEY_LOCAL_MACHINE;
    SubKey := EnvironmentKey;
  end
  else
  begin
    RootKey := HKEY_CURRENT_USER;
    SubKey := 'Environment';
  end;

  if not RegQueryStringValue(RootKey, SubKey, 'Path', Paths) then
    Paths := '';

  if Pos(';' + Path + ';', ';' + Paths + ';') = 0 then
  begin
    if Paths = '' then
      Paths := Path
    else
      Paths := Paths + ';' + Path;
      
    RegWriteStringValue(RootKey, SubKey, 'Path', Paths);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and IsTaskSelected('addtopath') then
  begin
    EnvAddPath(ExpandConstant('{app}'));
  end;
end;

// Nota: Remoção do PATH na desinstalação é complexa e arriscada via script simples.
// O usuário pode remover manualmente se desejar.
