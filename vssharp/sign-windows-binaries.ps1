param(
  [Parameter(Mandatory = $true)]
  [string] $Path,

  [switch] $Required
)

$ErrorActionPreference = "Stop"

function Find-SignTool {
  $cmd = Get-Command signtool.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $kits = @(
    "${env:ProgramFiles(x86)}\Windows Kits\10\bin",
    "${env:ProgramFiles}\Windows Kits\10\bin"
  )

  foreach ($kit in $kits) {
    if (-not (Test-Path $kit)) { continue }
    $hit = Get-ChildItem $kit -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
      Where-Object { $_.FullName -match "\\x64\\signtool\.exe$" } |
      Sort-Object FullName -Descending |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }

  return $null
}

$pfxBase64 = $env:WINDOWS_CODESIGN_PFX_BASE64
$pfxPassword = $env:WINDOWS_CODESIGN_PFX_PASSWORD
$timestampUrl = if ($env:WINDOWS_CODESIGN_TIMESTAMP_URL) {
  $env:WINDOWS_CODESIGN_TIMESTAMP_URL
} else {
  "http://timestamp.digicert.com"
}

if ([string]::IsNullOrWhiteSpace($pfxBase64) -or [string]::IsNullOrWhiteSpace($pfxPassword)) {
  $message = "WINDOWS_CODESIGN_PFX_BASE64/WINDOWS_CODESIGN_PFX_PASSWORD are not set; skipping Windows binary signing."
  if ($Required) { throw $message }
  Write-Warning $message
  exit 0
}

if (-not (Test-Path $Path)) {
  throw "Path not found: $Path"
}

$signTool = Find-SignTool
if (-not $signTool) {
  throw "signtool.exe not found. Install Windows SDK on the runner."
}

$files = Get-ChildItem -Path $Path -Recurse -File |
  Where-Object { $_.Extension -in @(".exe", ".dll", ".node") } |
  Sort-Object FullName

if ($files.Count -eq 0) {
  throw "No Windows binaries found under $Path"
}

$pfxPath = Join-Path ([IO.Path]::GetTempPath()) "vssharp-codesign-$PID.pfx"

try {
  [IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($pfxBase64))

  foreach ($file in $files) {
    Write-Host "Signing $($file.FullName)"
    & $signTool sign /f $pfxPath /p $pfxPassword /fd SHA256 /tr $timestampUrl /td SHA256 /v $file.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "signtool sign failed for $($file.FullName)"
    }

    & $signTool verify /pa /v $file.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "signtool verify failed for $($file.FullName)"
    }
  }
} finally {
  Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Signed $($files.Count) Windows binaries under $Path"
