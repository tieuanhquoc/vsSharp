# VS Sharp — Windows Runner One-Time Setup
# Run ONCE on the Windows machine as Administrator before registering the runner.
#
#   Right-click PowerShell → "Run as Administrator"
#   powershell -ExecutionPolicy Bypass -File vssharp\setup-windows-runner.ps1

#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

function Installed($cmd) { return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }

# ── Chocolatey ────────────────────────────────────────────────────────────────
if (-not (Installed "choco")) {
    Write-Host "==> Installing Chocolatey ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-Expression ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path += ";$env:ProgramData\chocolatey\bin"
}

# ── jq ────────────────────────────────────────────────────────────────────────
if (-not (Installed "jq"))         { choco install jq          -y --no-progress }

# ── Python 3.11 ───────────────────────────────────────────────────────────────
if (-not (Installed "python"))     { choco install python311    -y --no-progress }

# ── NSIS ──────────────────────────────────────────────────────────────────────
if (-not (Installed "makensis"))   { choco install nsis         -y --no-progress }

# ── WiX Toolset v3 ────────────────────────────────────────────────────────────
if (-not (Installed "candle"))     { choco install wixtoolset   -y --no-progress }

# ── Visual Studio Build Tools 2022 (C++ workload) ────────────────────────────
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVC = $false
if (Test-Path $vsWhere) {
    $p = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -latest -property installationPath 2>$null
    $hasVC = ($null -ne $p -and $p -ne "")
}
if (-not $hasVC) {
    Write-Host "==> Installing VS Build Tools 2022 (C++ workload) - this takes ~10 min ..."
    $params = "--add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended --passive --norestart"
    choco install visualstudio2022buildtools -y --no-progress --package-parameters $params
}

# ── .NET SDK 8 ────────────────────────────────────────────────────────────────
if (-not (Installed "dotnet"))     { choco install dotnet-sdk   -y --no-progress --version=8.0.407 }

# ── Cake.Tool ─────────────────────────────────────────────────────────────────
if (-not (Installed "dotnet-cake")) { dotnet tool install --global Cake.Tool }

Write-Host ""
Write-Host "==> Setup complete. Versions:"
Write-Host "  node:      $(node --version 2>$null)"
Write-Host "  python:    $((python --version 2>&1) -replace '\r?\n','')"
Write-Host "  dotnet:    $(dotnet --version 2>$null)"
Write-Host "  jq:        $(jq --version 2>$null)"
Write-Host "  makensis:  $(makensis /VERSION 2>$null)"
Write-Host ""
Write-Host "Next: register the GitHub Actions runner (run config.cmd), then start it."
