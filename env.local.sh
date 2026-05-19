#!/usr/bin/env bash
# Source this file in every shell before running VSCodium build scripts.
# Usage:  source ./env.local.sh

# --- Node via nvm (project-local, not global) ---
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use --delete-prefix --silent 2>/dev/null || nvm use --silent

# --- Python via project venv ---
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck disable=SC1091
. "${PROJECT_ROOT}/.venv/bin/activate"

# --- VSCodium build env ---
export OS_NAME=osx
export VSCODE_ARCH=arm64
export VSCODE_QUALITY=stable
# --- Branding (override via apply-branding.sh after prepare_vscode.sh) ---
export APP_NAME="VS Sharp"
export BINARY_NAME=vssharp
export ORG_NAME=VSSharp
export ASSETS_REPOSITORY=VSSharp/vs-sharp
export GH_REPO_PATH=VSSharp/vs-sharp
export CI_BUILD=no
export SHOULD_BUILD=yes
export VSCODE_SKIP_NODE_VERSION_CHECK=yes
export NODE_OPTIONS="--max-old-space-size=8192"

echo "VSCodium env ready:"
echo "  node:   $( node --version )  ($( which node ))"
echo "  npm:    $( npm --version )"
echo "  python: $( python --version )  ($( which python ))"
echo "  arch:   ${VSCODE_ARCH}  quality: ${VSCODE_QUALITY}"
