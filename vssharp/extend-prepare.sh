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
    # Portable fallback (works in Git Bash on Windows): cp -r then prune excludes
    cp -r "${SRC}." "${DEST}/"
    for excl in node_modules src .git .github .vscode .vscodeignore .gitignore .editorconfig webpack.config.js package-lock.json .DS_Store; do
      rm -rf "${DEST}/${excl}"
    done
    find "${DEST}" -maxdepth 2 -name "tsconfig*.json" -delete
    find "${DEST}" -maxdepth 2 -name "*.log" -delete
  fi
  # Verify copy worked — package.json MUST exist in DEST
  if [[ ! -f "${DEST}/package.json" ]]; then
    echo "ERROR: ${NAME} copy failed — no package.json in ${DEST}" >&2
    exit 1
  fi
  echo "  installed: ${DEST}"
  echo "::endgroup::"
done

echo "vssharp extensions installed."

# ── Strip built-in VS Code themes ──────────────────────────────────────────
# Remove all optional color/icon theme extensions — replaced by vssharp-color-theme
# and vssharp-icons. theme-defaults is kept but stripped down to HC themes only.
echo "Stripping built-in VS Code themes..."

REMOVE_THEMES=(
  theme-abyss
  theme-kimbie-dark
  theme-monokai
  theme-monokai-dimmed
  theme-quietlight
  theme-red
  theme-solarized-dark
  theme-solarized-light
  theme-tomorrow-night-blue
  theme-seti
)
for theme in "${REMOVE_THEMES[@]}"; do
  if [[ -d "${VSCODE_EXT}/${theme}" ]]; then
    rm -rf "${VSCODE_EXT}/${theme}"
    echo "  removed: ${theme}"
  fi
done

# Patch theme-defaults: keep only High Contrast themes (needed for accessibility).
# Removes: Light/Dark 2026, Dark+, Light+, Dark Modern, Light Modern, Visual Studio Dark/Light.
# Removes: vs-minimal icon theme (replaced by vssharp-file-icon).
THEME_DEFAULTS_PKG="${VSCODE_EXT}/theme-defaults/package.json"
if [[ -f "${THEME_DEFAULTS_PKG}" ]]; then
  python3 - "${THEME_DEFAULTS_PKG}" <<'PYEOF'
import json, sys
path = sys.argv[1]
with open(path) as f:
    pkg = json.load(f)
hc_ids = {'Default High Contrast', 'Default High Contrast Light'}
pkg['contributes']['themes'] = [t for t in pkg['contributes']['themes'] if t['id'] in hc_ids]
pkg['contributes'].pop('iconThemes', None)
with open(path, 'w') as f:
    json.dump(pkg, f, indent=2)
PYEOF
  echo "  patched: theme-defaults (High Contrast only)"
fi

echo "Theme cleanup done."
