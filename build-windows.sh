#!/usr/bin/env bash
# Build VS Sharp production release for Windows.
# Run on the Windows machine via Git Bash:
#   "C:\Program Files\Git\bin\bash.exe" ./build-windows.sh
# Output: VSCode-win32-x64/  +  assets/*.exe  assets/*.msi
#
# Prerequisites (install once on Windows — see docs/howto-run-dev.md):
#   - Git for Windows  (provides this bash)
#   - Node.js 22.22.1  (nvm-windows or direct installer)
#   - Python 3.11      (python.org installer, add to PATH)
#   - .NET SDK 8+      (dotnet.microsoft.com)
#   - Cake.Tool        (dotnet tool install --global Cake.Tool)
#   - NSIS 3.x         (nsis.sourceforge.io, add to PATH)
#   - WiX Toolset v3   (github.com/wixtoolset/wix3/releases, add to PATH)
#   - VS Build Tools   (C++ workload — for native node modules)

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

# ── 1. Environment ────────────────────────────────────────────────────────────
export OS_NAME=windows
export VSCODE_ARCH=x64
export VSCODE_QUALITY=stable

export APP_NAME="VS Sharp"
export BINARY_NAME=vssharp
export ORG_NAME=VSSharp
export ASSETS_REPOSITORY=VSSharp/vs-sharp
export GH_REPO_PATH=VSSharp/vs-sharp

export CI_BUILD=no
export SHOULD_BUILD=yes
export VSCODE_SKIP_NODE_VERSION_CHECK=yes
export NODE_OPTIONS="--max-old-space-size=8192"

# nvm-windows (optional — skip if Node is already on PATH)
NVM_HOME="${NVM_HOME:-$APPDATA/nvm}"
if [[ -f "${NVM_HOME}/nvm.exe" ]]; then
  export PATH="${NVM_HOME}:${PATH}"
  nvm use 22.22.1 2>/dev/null || true
fi

echo "node: $( node --version )   npm: $( npm --version )"
echo "python: $( python --version 2>&1 )"
echo "dotnet: $( dotnet --version )"

# ── 2. Ensure dev/build.env exists (needed by dev/build.sh -s) ───────────────
if [[ ! -f "dev/build.env" ]]; then
  echo "dev/build.env not found — generating from upstream/stable.json ..."
  MS_COMMIT=$( node -p "require('./upstream/stable.json').commit" )
  MS_TAG=$( node    -p "require('./upstream/stable.json').tag" )
  RELEASE_VERSION="${MS_TAG}.$(date +%Y%m%d)"
  # sha1sum comes from Git for Windows
  BUILD_SOURCEVERSION=$( printf '%s' "${RELEASE_VERSION}" | sha1sum | cut -d' ' -f1 )
  {
    echo "MS_TAG=\"${MS_TAG}\""
    echo "MS_COMMIT=\"${MS_COMMIT}\""
    echo "RELEASE_VERSION=\"${RELEASE_VERSION}\""
    echo "BUILD_SOURCEVERSION=\"${BUILD_SOURCEVERSION}\""
  } > dev/build.env
  echo "dev/build.env created: ${RELEASE_VERSION}"
fi

# ── 3. Build vssharp extensions ───────────────────────────────────────────────
echo "==> Building vssharp-runner ..."
( cd vssharp/extensions/vssharp-runner   && npm install --prefer-offline && npm run compile )

echo "==> Building vssharp-explorer ..."
( cd vssharp/extensions/vssharp-explorer && npm install --prefer-offline && npm run compile )

# ── 4. Bundle extensions into vscode/extensions/ ─────────────────────────────
echo "==> Bundling extensions ..."
./vssharp/extend-prepare.sh

# ── 5. Apply branding + version ───────────────────────────────────────────────
echo "==> Applying branding ..."
./apply-version.sh
./apply-branding.sh

# ── 6. Build release .exe + .msi ─────────────────────────────────────────────
echo "==> Building release (dev/build.sh -s -p) ..."
./dev/build.sh -s -p

echo ""
echo "Done: Windows build complete."
echo "  App :  VSCode-win32-x64/"
echo "  EXE :  assets/"
