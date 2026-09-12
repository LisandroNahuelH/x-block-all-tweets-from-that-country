# x-block-all-tweets-from-that-country - uninstaller for the dev path.
#
# Removes what the repository's own dev workflow created on this machine:
#   - <repo>\dist\            (the build output / "Load unpacked" target)
#   - %LOCALAPPDATA%\Premium11\x-block-all-tweets-from-that-country\  (state dir)
#
# It never touches: your git checkout, your commits, or anything inside the
# Chrome profile. Extension settings and the geo cache live in the browser
# profile and are removed by Chrome when you remove the extension itself.
#
#   .\uninstall.ps1            remove dist/ and the state dir
#   .\uninstall.ps1 -WhatIf    show what would be removed; change nothing
#
# Exit codes: 0 ok/no-op | 1 some item could not be removed | 2 invalid invocation
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $env:LOCALAPPDATA 'Premium11\x-block-all-tweets-from-that-country'
$DistDir = Join-Path $RepoRoot 'dist'

if (-not (Test-Path (Join-Path $RepoRoot 'versions.json'))) {
  Write-Host '[x-block] ERROR: run the uninstaller from install/ inside a full checkout.' -ForegroundColor Red
  exit 2
}

function Try-RemoveDir([string]$dir, [string]$label) {
  if (-not (Test-Path $dir)) { Write-Host "[x-block] $label not present - nothing to do."; return $true }
  if ($WhatIfPreference) { Write-Host "[x-block] would remove: $dir"; return $true }
  try {
    [System.IO.Directory]::Delete($dir, $true)
    Write-Host "[x-block] removed: $dir"
    return $true
  } catch {
    Write-Host "[x-block] could not remove $label ($dir): $($_.Exception.Message)" -ForegroundColor Red
    if ($label -eq 'dist') {
      Write-Host '    A file is probably locked by Chrome. Remove the unpacked extension in'
      Write-Host '    chrome://extensions, close Chrome, and run this script again.'
    }
    Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue |
      Select-Object -First 10 -ExpandProperty FullName | ForEach-Object { Write-Host "    leftover: $_" }
    return $false
  }
}

$ok = $true
$ok = (Try-RemoveDir $DistDir 'dist') -and $ok
$ok = (Try-RemoveDir $StateDir 'state dir') -and $ok

if ($WhatIfPreference) {
  Write-Host '[x-block] dry run ... OK (nothing changed)'
} else {
  Write-Host ''
  Write-Host '[x-block] Out of scope on purpose:'
  Write-Host '    - the git checkout and its commits'
  Write-Host '    - the extension inside Chrome (remove it in chrome://extensions;'
  Write-Host '      Chrome then wipes its settings and the local geo cache)'
  Write-Host '    - any blocks or mutes you applied on X (undo those on X itself)'
}

if ($ok) { exit 0 } else { exit 1 }
