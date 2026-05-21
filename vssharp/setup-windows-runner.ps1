# VS Sharp — Windows Runner Setup
# Installs all build dependencies needed to compile and package VS Sharp.
# Run once on the self-hosted runner (as Administrator), or called from CI.
#
# Usage (manual):  powershell -ExecutionPolicy Bypass -File vssharp\setup-windows-runner.ps1
# Usage (CI):      called automatically by build-vssharp-windows.yml

$ErrorActionPreference = "Stop"

function Installed($cmd) {
    return $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue)
}

# ── Chocolatey ────────────────────────────────────────────────────────────────
if (-not (Installed "choco")) {
    Write-Host "==> Installing Chocolatey ..."
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $env:Path += ";$env:ProgramData\chocolatey\bin"
}

# ── jq ────────────────────────────────────────────────────────────────────────
if (-not (Installed "jq")) {
    Write-Host "==> Installing jq ..."
    choco install jq -y --no-progress
}

# ── Python 3.11 ───────────────────────────────────────────────────────────────
if (-not (Installed "python")) {
    Write-Host "==> Installing Python 3.11 ..."
    choco install python311 -y --no-progress
    $env:Path += ";$env:ProgramFiles\Python311;$env:ProgramFiles\Python311\Scripts"
}

# ── .NET SDK 8 ────────────────────────────────────────────────────────────────
if (-not (Installed "dotnet")) {
    Write-Host "==> Installing .NET SDK 8 ..."
    choco install dotnet-sdk -y --no-progress --version=8.0.407
}

# ── Cake.Tool ─────────────────────────────────────────────────────────────────
if (-not (Installed "dotnet-cake")) {
    Write-Host "==> Installing Cake.Tool ..."
    dotnet tool install --global Cake.Tool
}

# ── Visual Studio Build Tools 2022 (C++ workload) ────────────────────────────
$vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasVCTools = $false
if (Test-Path $vsWhere) {
    $vsPath = & $vsWhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -latest -property installationPath 2>$null
    $hasVCTools = $vsPath -ne $null -and $vsPath -ne ""
}

if (-not $hasVCTools) {
    Write-Host "==> Installing Visual Studio Build Tools 2022 (C++ workload) ..."
    choco install visualstudio2022buildtools -y --no-progress `
        --package-parameters "--add Microsoft.VisualStudio.Workload.VCTools --add Microsoft.VisualStudio.Component.Windows11SDK.22621 --includeRecommended --passive --norestart"
}

# ── NSIS ──────────────────────────────────────────────────────────────────────
if (-not (Installed "makensis")) {
    Write-Host "==> Installing NSIS ..."
    choco install nsis -y --no-progress
}

# ── WiX Toolset v3 ────────────────────────────────────────────────────────────
if (-not (Installed "candle")) {
    Write-Host "==> Installing WiX Toolset v3 ..."
    choco install wixtoolset -y --no-progress
}

Write-Host ""
Write-Host "==> All dependencies ready."
Write-Host "  node:   $(node --version 2>$null)"
Write-Host "  python: $(python --version 2>$null)"
Write-Host "  dotnet: $(dotnet --version 2>$null)"
Write-Host "  jq:     $(jq --version 2>$null)"
