# One-line install for dsh-chat-migration on any Windows machine with DSH.
#
#   irm https://cdn.jsdelivr.net/gh/siweimidu/dsh-chat-migration@master/install-oneline.ps1 | iex
#
# Downloads over the normal Windows network stack (the DSH plugin panel has its own
# egress and often cannot reach anything), then installs by writing the packages into
# the profile's node_modules and registering the bundle in dsh.profile.bundles:
# no pnpm, no npm account, no proxy, no profile name to type.
#
# Keep this file pure ASCII: Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.
#
# Override the target profile with:  $env:DSH_PLUGIN_PROFILE = 'web'

$ErrorActionPreference = 'Stop'

$version = 'v0.3.0'
$semver = $version.TrimStart('v')
$repo = 'siweimidu/dsh-chat-migration'
$packages = @('conversation-import', 'chat-preset')
$scope = '@siweimidu'

$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
$profilesRoot = Join-Path $dshHome 'profiles'
if (-not (Test-Path $profilesRoot)) {
  throw "DSH profiles folder not found: $profilesRoot (install and start DeepSeek Harness once first)"
}

$target = $env:DSH_PLUGIN_PROFILE
if (-not $target) {
  $candidates = Get-ChildItem $profilesRoot -Directory | Where-Object { $_.Name -ne 'node_modules' }
  $target = ($candidates | Where-Object { $_.Name -eq 'desktop' } | Select-Object -First 1).Name
  if (-not $target) { $target = ($candidates | Select-Object -First 1).Name }
}
if (-not $target) { throw "no profile found under $profilesRoot" }

$profileDir = Join-Path $profilesRoot $target
if (-not (Test-Path $profileDir)) { throw "profile folder missing: $profileDir" }

Write-Host "DSH home : $dshHome"
Write-Host "profile  : $target"
Write-Host ''

$temp = Join-Path $env:TEMP ("dsh-plugin-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $temp | Out-Null

function Save-Package {
  param([string]$Name, [string]$OutFile)
  $file = "siweimidu-$Name-$semver.tgz"
  $npmFile = "$Name-$semver.tgz"
  $sources = @(
    "https://registry.npmjs.org/$scope/$Name/-/$npmFile",
    "https://cdn.jsdelivr.net/gh/$repo@$version/dist/$file",
    "https://cdn.jsdelivr.net/gh/$repo@master/dist/$file",
    "https://ghfast.top/https://github.com/$repo/releases/download/$version/$file",
    "https://github.com/$repo/releases/download/$version/$file",
    "https://raw.githubusercontent.com/$repo/$version/dist/$file"
  )
  foreach ($url in $sources) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $OutFile -UseBasicParsing -TimeoutSec 90
      if ((Get-Item $OutFile).Length -gt 1000) {
        Write-Host "  ok   $($url.Split('/')[2])"
        return
      }
    } catch {
      Write-Host "  skip $($url.Split('/')[2])"
    }
  }
  throw "every download source failed for $Name"
}

$installed = @()
foreach ($name in $packages) {
  Write-Host "fetching $name"
  $tgz = Join-Path $temp "$name.tgz"
  Save-Package -Name $name -OutFile $tgz

  $unpacked = Join-Path $temp $name
  New-Item -ItemType Directory -Force $unpacked | Out-Null
  tar -xzf $tgz -C $unpacked
  $packageDir = Join-Path $unpacked 'package'
  if (-not (Test-Path (Join-Path $packageDir 'package.json'))) { throw "$name has no package.json after unpacking" }

  $scopeDir = Join-Path $profileDir "node_modules\$scope"
  New-Item -ItemType Directory -Force $scopeDir | Out-Null
  $destination = Join-Path $scopeDir $name
  if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
  Copy-Item $packageDir $destination -Recurse
  $installed += "$scope/$name"
  Write-Host "  into $destination"
}

$manifestPath = Join-Path $profileDir 'package.json'
if (Test-Path $manifestPath) {
  Copy-Item $manifestPath "$manifestPath.bak" -Force
  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
} else {
  $manifest = [pscustomobject]@{ name = "dsh-profile-$target"; private = $true }
}

if (-not $manifest.PSObject.Properties['dsh']) {
  $manifest | Add-Member -NotePropertyName dsh -NotePropertyValue ([pscustomobject]@{}) -Force
}
if (-not $manifest.dsh.PSObject.Properties['profile']) {
  $manifest.dsh | Add-Member -NotePropertyName profile -NotePropertyValue ([pscustomobject]@{}) -Force
}
if (-not $manifest.dsh.profile.PSObject.Properties['bundles']) {
  $manifest.dsh.profile | Add-Member -NotePropertyName bundles -NotePropertyValue @() -Force
}

$bundles = @($manifest.dsh.profile.bundles)
foreach ($id in $installed) {
  if ($bundles -notcontains $id) { $bundles += $id }
}
$manifest.dsh.profile.bundles = $bundles

$json = $manifest | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($manifestPath, $json, (New-Object System.Text.UTF8Encoding($false)))

Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "installed into profile '$target':"
foreach ($id in $installed) { Write-Host "  $id" }
Write-Host ''
Write-Host 'Fully quit DSH and start it again; Settings will show the "Import conversations" section.'
Write-Host "Rollback: restore $manifestPath.bak and delete $profileDir\node_modules\$scope"
