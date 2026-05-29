#!/usr/bin/env bash
# Source this file in every shell before running VSCodium build scripts.
# Usage:  source ./env.local.sh

# --- Node via nvm (project-local, not global) ---
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use --delete-prefix --silent 2>/dev/null || nvm use --silent
fi

# --- Python via project venv ---
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Support both Unix (bin/activate) and Windows (Scripts/activate)
if [ -f "${PROJECT_ROOT}/.venv/bin/activate" ]; then
  . "${PROJECT_ROOT}/.venv/bin/activate"
elif [ -f "${PROJECT_ROOT}/.venv/Scripts/activate" ]; then
  . "${PROJECT_ROOT}/.venv/Scripts/activate"
fi

# --- VSCodium build env ---
case "${OSTYPE}" in
  darwin*)
    export OS_NAME="osx"
    ;;
  msys* | cygwin*)
    export OS_NAME="windows"
    ;;
  *)
    export OS_NAME="linux"
    ;;
esac

UNAME_ARCH=$( uname -m )
if [[ "${UNAME_ARCH}" == "aarch64" || "${UNAME_ARCH}" == "arm64" ]]; then
  export VSCODE_ARCH="arm64"
else
  export VSCODE_ARCH="x64"
fi
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
  if python --version &>/dev/null; then
    echo "  python: $( python --version 2>&1 | tr -d '\r' )  ($( which python ))"
  else
    echo "  python: not found or unconfigured"
  fi
  echo "  arch:   ${VSCODE_ARCH}  quality: ${VSCODE_QUALITY}"
