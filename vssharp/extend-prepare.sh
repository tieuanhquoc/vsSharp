#!/usr/bin/env bash
# vssharp/extend-prepare.sh
# Copy every directory in vssharp/extensions/<name>/ into
# vscode/extensions/<name>/ as a built-in extension.
#
# Each source folder MUST already be "ready to install":
#   - package.json at root
#   - main bundle path matching package.json "main" field (out/extension.js,
#     extension/main.js, dist/main.js, etc.)
#
# install-<name>.sh scripts do the clone+build+cleanup. This script only copies.
#
# Run AFTER prepare_vscode.sh. Idempotent — safe to re-run.

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
VSCODE_EXT="${PROJECT_ROOT}/vscode/extensions"
VSSHARP_EXT="${PROJECT_ROOT}/vssharp/extensions"

if [[ ! -d "${VSCODE_EXT}" ]]; then
  echo "Error: ${VSCODE_EXT} not found. Run prepare_vscode.sh first." >&2
  exit 1
fi

# Common dev-only files we never want to ship as a built-in.
EXCLUDES=(
  --exclude='node_modules'
  --exclude='src'
  --exclude='.git'
  --exclude='.github'
  --exclude='.vscode'
  --exclude='.vscodeignore'
  --exclude='.gitignore'
  --exclude='.editorconfig'
  --exclude='tsconfig*.json'
  --exclude='webpack.config.js'
  --exclude='package-lock.json'
  --exclude='*.log'
  --exclude='.DS_Store'
)

shopt -s nullglob
for SRC in "${VSSHARP_EXT}"/*/; do
  NAME=$( basename "${SRC%/}" )
  DEST="${VSCODE_EXT}/${NAME}"

  if [[ ! -f "${SRC}package.json" ]]; then
    echo "skip ${NAME}: no package.json"
    continue
  fi

  echo "::group::Installing ${NAME}"
  rm -rf "${DEST}"
  mkdir -p "${DEST}"
  if command -v rsync &>/dev/null; then
    rsync -a "${EXCLUDES[@]}" "${SRC}" "${DEST}/"
  else
    # Windows fallback: robocopy (exit codes 0-7 are success)
    EXCLUDES_RC=( node_modules src .git .github .vscode .vscodeignore .gitignore .editorconfig tsconfig*.json webpack.config.js package-lock.json "*.log" .DS_Store )
    robocopy "$(cygpath -w "${SRC}")" "$(cygpath -w "${DEST}")" /E /XD "${EXCLUDES_RC[@]}" /XF "${EXCLUDES_RC[@]}" /NFL /NDL /NJH /NJS || true
  fi
  echo "  installed: ${DEST}"
  echo "::endgroup::"
done

echo "vssharp extensions installed."
