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

# ── 2. Limit CPU usage (prevent thermal throttling) ──────────────────────────
TOTAL_CORES="$( sysctl -n hw.logicalcpu )"
BUILD_JOBS="${BUILD_JOBS:-$(( TOTAL_CORES / 3 < 2 ? 2 : TOTAL_CORES / 3 ))}"
export CARGO_BUILD_JOBS="${BUILD_JOBS}"
export MAKEFLAGS="-j${BUILD_JOBS}"
export UV_THREADPOOL_SIZE="${BUILD_JOBS}"
echo "==> CPU cores: ${TOTAL_CORES}, build jobs capped at: ${BUILD_JOBS} (override: BUILD_JOBS=N ./build-macos.sh)"

# ── 3. Ensure Rust / rustup is available ─────────────────────────────────────
if ! command -v rustup &>/dev/null; then
  echo "==> rustup not found — installing Rust toolchain ..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path
  source "$HOME/.cargo/env"
fi
# Always ensure cargo env is on PATH (handles cases where rustup exists but cargo is not in PATH)
[[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"

# ── 4. Ensure dev/build.env exists (needed by dev/build.sh -s) ───────────────
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

# ── 5. Build vssharp extensions ───────────────────────────────────────────────
echo "==> Building vssharp-runner ..."
( cd vssharp/extensions/vssharp-runner   && npm install --prefer-offline && npm run compile )

echo "==> Building vssharp-explorer ..."
( cd vssharp/extensions/vssharp-explorer && npm install --prefer-offline && npm run compile )

# ── 6. Build release .app ────────────────────────────────────────────────────
# Extensions are injected by build.sh (calls extend-prepare.sh after prepare_vscode.sh,
# before gulp) so they're bundled into both the .app and the ZIP.
# Default: app ZIP only. Override with env vars to include extras:
#   VSSHARP_BUILD_CLI=yes ./build-macos.sh   → include CLI binary
#   VSSHARP_BUILD_REH=yes ./build-macos.sh   → include remote server components
export SHOULD_BUILD_CLI="${VSSHARP_BUILD_CLI:-no}"
export SHOULD_BUILD_REH="${VSSHARP_BUILD_REH:-no}"
export SHOULD_BUILD_REH_WEB="${VSSHARP_BUILD_REH:-no}"
echo "==> Building release (dev/build.sh -s -p) ..."
nice -n 15 ./dev/build.sh -s -p

echo ""
echo "✓ macOS build complete."
echo "  App :  VSCode-darwin-${VSCODE_ARCH}/"
echo "  DMG :  assets/"
