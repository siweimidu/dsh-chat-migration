<#
  Install the dsh-chat-migration plugins on Windows.

  Desktop app (the common case) - no profile name, one line:
      DSH -> Settings -> Plugins -> Install plugin, paste:
      https://github.com/siweimidu/dsh-chat-migration/releases/download/v0.3.0/xiaozhuang-dsh-conversation-import-0.3.0.tgz

  Command line - profile name is a required host option, but this one-liner figures it out:

      $p=(Get-ChildItem "$env:USERPROFILE\.dsh\profiles" -Directory | ?{ $_.Name -notin 'desktop','node_modules' } | Select -First 1).Name; 'conversation-import','chat-preset' | %{ dsh plugin --profile $p add "https://github.com/siweimidu/dsh-chat-migration/releases/download/v0.3.0/xiaozhuang-dsh-$_-0.3.0.tgz" }

  This script is for the third case: download and unpack locally so the plugin panel
  can install from a folder. No GitHub account is needed - these are public files.

      powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1
#>
param(
  [string]$Version = 'v0.3.0'
)

$ErrorActionPreference = 'Stop'
$repo = 'siweimidu/dsh-chat-migration'
$semver = $Version.TrimStart('v')
$packages = @('conversation-import', 'chat-preset')

function Save-Plugin {
  param([string]$Name, [string]$Destination)

  $file = "xiaozhuang-dsh-$Name-$semver.tgz"
  $sources = @(
    "https://github.com/$repo/releases/download/$Version/$file",
    "https://cdn.jsdelivr.net/gh/$repo@$Version/dist/$file",
    "https://raw.githubusercontent.com/$repo/$Version/dist/$file"
  )

  foreach ($url in $sources) {
    try {
      Write-Host "  trying $url"
      Invoke-WebRequest -Uri $url -OutFile $Destination -UseBasicParsing -TimeoutSec 60
      if ((Get-Item $Destination).Length -lt 1000) { throw 'download too small' }
      return
    } catch {
      Write-Host "  unavailable: $($_.Exception.Message)"
    }
  }
  throw "no reachable download source for $Name"
}

$root = Join-Path $env:LOCALAPPDATA 'dsh-chat-migration'
New-Item -ItemType Directory -Force $root | Out-Null

foreach ($name in $packages) {
  Write-Host "fetching $name $Version"
  $tgz = Join-Path $root "$name.tgz"
  $dir = Join-Path $root $name
  Save-Plugin -Name $name -Destination $tgz
  if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
  New-Item -ItemType Directory -Force $dir | Out-Null
  tar -xzf $tgz -C $dir
  Remove-Item $tgz -Force
}

Write-Host ''
Write-Host 'Unpacked. Install them from the plugin panel (Settings -> Plugins -> install from local folder):'
foreach ($name in $packages) { Write-Host "  $(Join-Path (Join-Path $root $name) 'package')" }
