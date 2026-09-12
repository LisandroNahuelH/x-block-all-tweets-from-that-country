# x-block-all-tweets-from-that-country - developer installer (Windows v1).
#
# End users install from the Chrome Web Store; this repository is the source
# and build. This installer never touches the host system: it verifies the
# checkout against versions.json, runs the repo's own verify gate, and builds
# dist/ for "Load unpacked".
#
#   .\install.ps1            verify + build (idempotent, safe to re-run)
#   .\install.ps1 -WhatIf    full dry run: reads only, writes NOTHING
#
# Exit codes: 0 ok/no-op | 1 runtime error (integrity gate / verify / postcondition)
#             2 preflight failed | 3 another run holds the lock
[CmdletBinding(SupportsShouldProcess = $true)]
param([string]$LogPath)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot          # install/ -> repo root
$VersionsJ = Join-Path $RepoRoot 'versions.json'
$StateDir = Join-Path $env:LOCALAPPDATA 'Premium11\x-block-all-tweets-from-that-country'
$script:Log = $null

function Emit([string]$m) {
  Write-Host "[x-block] $m"
  if ($script:Log -and -not $WhatIfPreference) {
    Add-Content -Path $script:Log -Value ("[{0}] {1}" -f (Get-Date -Format s), $m)
  }
}
function Fail([int]$code, [string]$m) {
  Write-Host "[x-block] ERROR: $m" -ForegroundColor Red
  if ($script:Log -and -not $WhatIfPreference) {
    Add-Content -Path $script:Log -Value ("[{0}] ERROR {1}" -f (Get-Date -Format s), $m)
  }
  exit $code
}
function Get-ShaLf([string]$p) {
  # sha256 of the file bytes with CRLF normalized to LF - same rule as
  # scripts/check-versions.mjs. Uses the .NET API so -WhatIf cannot skip it.
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $text = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes($p)) -replace "`r`n", "`n"
    ($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text)) | ForEach-Object { $_.ToString('x2') }) -join ''
  } finally { $sha.Dispose() }
}

# -- 1. preflight (exit 2, writes nothing; also runs under -WhatIf) ----------
if (-not (Test-Path $VersionsJ)) {
  Fail 2 "versions.json not found - run installer from a full checkout of the repository."
}
$v = Get-Content $VersionsJ -Raw | ConvertFrom-Json

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) { Fail 2 "Node.js not found on PATH - install Node 18+ from https://nodejs.org and retry." }
$nodeVer = (& node --version 2>$null)
if (-not $nodeVer -or $nodeVer -notmatch '^v(\d+)\.') { Fail 2 "could not read the Node.js version (got '$nodeVer')." }
if ([int]$Matches[1] -lt 18) { Fail 2 "Node $nodeVer is too old - Node 18 or newer is required." }

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) { Fail 2 "npm not found on PATH - it ships with Node.js; reinstall Node 18+." }

$entryPaths = @($v.installer.path) + @($v.artifacts | ForEach-Object { $_.path })
foreach ($rel in $entryPaths) {
  if (-not (Test-Path (Join-Path $RepoRoot $rel))) {
    Fail 2 "required file missing from the checkout: $rel"
  }
}

if ($WhatIfPreference) { Emit 'dry run (-WhatIf): reads only, writes nothing.' }

# -- 2. integrity gate (exit 1) - sha256 of LF-normalized bytes --------------
$selfPath = Join-Path $PSScriptRoot 'install.ps1'
$selfSha = Get-ShaLf $selfPath
if ($selfSha -ne $v.installer.sha256) {
  Fail 1 ("installer drifted from versions.json (have {0}, expected {1}). If you are cutting a release run: npm run versions:update" -f $selfSha, $v.installer.sha256)
}
foreach ($a in $v.artifacts) {
  $have = Get-ShaLf (Join-Path $RepoRoot $a.path)
  if ($have -ne $a.sha256) {
    Fail 1 ("checkout drifted from versions.json: {0} (have {1}, expected {2}). If you are cutting a release run: npm run versions:update" -f $a.path, $have, $a.sha256)
  }
}
Emit 'integrity gate: sha256 OK'

# -- 3. lock (skipped entirely under -WhatIf) --------------------------------
$lock = Join-Path $StateDir 'install.lock'
if (-not $WhatIfPreference) {
  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  $script:Log = if ($LogPath) { $LogPath } else { Join-Path $StateDir 'install.log' }
  if (Test-Path $lock) {
    $age = (Get-Date) - (Get-Item $lock).LastWriteTime
    if ($age.TotalMinutes -lt 30) {
      Write-Host '[x-block] another run holds the lock (< 30 min) - exiting without changes.'
      exit 3
    }
    Remove-Item $lock -Force
  }
  Set-Content -Path $lock -Value ("{0} {1}" -f $PID, (Get-Date -Format s))
}

function Complete([int]$code) {
  if (-not $WhatIfPreference -and (Test-Path $lock)) { Remove-Item $lock -Force -ErrorAction SilentlyContinue }
  exit $code
}

try {
  Emit (("start ({0})") -f $(if ($WhatIfPreference) { 'dry-run' } else { 'install' }))

  # -- 4. verify gate BEFORE anything is declared installed ------------------
  if (-not $WhatIfPreference) {
    Emit 'running: npm run verify'
    $out = & npm run verify 2>&1
    $code = $LASTEXITCODE
    ($out | Select-Object -Last 30) | ForEach-Object { if ($script:Log) { Add-Content -Path $script:Log -Value ("    $_") } }
    if ($code -ne 0) {
      $out | Select-Object -Last 15 | ForEach-Object { Write-Host "    $_" }
      Fail 1 ("npm run verify failed (exit $code) - see the log tail above.")
    }
    Emit 'verify: OK'
  } else {
    Emit 'would run: npm run verify (mirrors + i18n + build)'
  }

  # -- 5. postconditions (exit 1) --------------------------------------------
  if (-not $WhatIfPreference) {
    $distManifest = Join-Path $RepoRoot 'dist\manifest.json'
    $distStamp = Join-Path $RepoRoot 'dist\build-stamp.json'
    if (-not (Test-Path $distManifest)) { Fail 1 'postcondition failed: dist/manifest.json missing after build.' }
    if (-not (Test-Path $distStamp)) { Fail 1 'postcondition failed: dist/build-stamp.json missing after build.' }
    $builtVersion = (Get-Content $distManifest -Raw | ConvertFrom-Json).version
    if ($builtVersion -ne $v.version) {
      Fail 1 ("postcondition failed: built version {0} does not match versions.json {1}." -f $builtVersion, $v.version)
    }

    # Informative status file (state dir only).
    [pscustomobject]@{
      version      = $v.version
      installedAt  = (Get-Date -Format s)
      installerSha = $selfSha
      distStamp    = (Get-Content $distStamp -Raw)
    } | ConvertTo-Json | Set-Content -Path (Join-Path $StateDir 'installed.json')

    Emit ("OK - dist/ ready (v{0})." -f $v.version)
    Write-Host '    1. open chrome://extensions'
    Write-Host '    2. Developer mode ON'
    Write-Host ("    3. Load unpacked -> {0}" -f (Join-Path $RepoRoot 'dist'))
    Write-Host '    Unpacked builds auto-reload after the next build (build-stamp.json).'
    Write-Host '    End users: https://chromewebstore.google.com/detail/obpgcigehkijhgjdldddiaijimhihpma'
  } else {
    Emit 'dry run: would check dist/manifest.json + dist/build-stamp.json and write installed.json'
    Emit 'dry run ... OK'
  }
  Complete 0
} finally {
  if (-not $WhatIfPreference -and (Test-Path $lock)) { Remove-Item $lock -Force -ErrorAction SilentlyContinue }
}
