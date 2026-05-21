#!/usr/bin/env bash
# Build VS Sharp production release for macOS.
# Run on the Mac machine: ./build-macos.sh
# Output: VSCode-darwin-arm64/  +  assets/*.dmg
#
# First-time setup: see docs/howto-run-dev.md "Setup từ đầu"
# Subsequent runs (vscode/ already prepared): this script handles everything.

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "${SCRIPT_DIR}"

# ── 1. Environment ────────────────────────────────────────────────────────────
source ./env.local.sh

# ── 2. Ensure dev/build.env exists (needed by dev/build.sh -s) ───────────────
if [[ ! -f "dev/build.env" ]]; then
  echo "dev/build.env not found — generating from upstream/stable.json ..."
  export VSCODE_QUALITY=stable
  MS_COMMIT=$( jq -r '.commit' "./upstream/stable.json" )
  MS_TAG=$( jq -r '.tag'    "./upstream/stable.json" )
  RELEASE_VERSION="${MS_TAG}.$(date +%Y%m%d)"
  BUILD_SOURCEVERSION=$( printf '%s' "${RELEASE_VERSION}" | shasum -a 1 | cut -d' ' -f1 )
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

# ── 6. Build release .app + .dmg ─────────────────────────────────────────────
echo "==> Building release (dev/build.sh -s -p) ..."
./dev/build.sh -s -p

echo ""
echo "✓ macOS build complete."
echo "  App :  VSCode-darwin-${VSCODE_ARCH}/"
echo "  DMG :  assets/"
