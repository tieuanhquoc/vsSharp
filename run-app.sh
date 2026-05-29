#!/usr/bin/env bash
# Launch VSCodium dev app (without NODE_OPTIONS which Electron rejects).
# Run AFTER `npm run watch` is compiled.

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Activate env but strip NODE_OPTIONS (Electron packaged binary rejects it)
# shellcheck disable=SC1091
. "${PROJECT_ROOT}/env.local.sh"
unset NODE_OPTIONS

# Build vssharp extensions that have a compile script
for ext_dir in "${PROJECT_ROOT}/vssharp/extensions"/*/; do
  if [[ -f "${ext_dir}package.json" ]] && grep -q '"compile"' "${ext_dir}package.json"; then
    echo "Building $(basename "${ext_dir%/}")…"
    ( cd "${ext_dir}" && npm run compile --silent )
  fi
done

# Ensure package.json has a valid version (prepare_vscode.sh sets it only when RELEASE_VERSION is set)
_pkg="./vscode/package.json"
if [[ -f "${_pkg}" ]]; then
  _has_version="$(node -e "const fs = require('fs'); try { console.log(JSON.parse(fs.readFileSync('${_pkg}', 'utf8')).version || '') } catch(e) { console.log('') }")"
  if [[ -z "${_has_version}" ]]; then
    _orig_ver="$(git -C "${PROJECT_ROOT}/vscode" show HEAD:package.json | node -e "
      let data = '';
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => {
        try { console.log(JSON.parse(data).version || '1.0.0') } catch(e) { console.log('1.0.0') }
      });
    ")"
    node -e "
      const fs = require('fs');
      const p = JSON.parse(fs.readFileSync('${_pkg}', 'utf8'));
      p.version = '${_orig_ver}';
      fs.writeFileSync('${_pkg}', JSON.stringify(p, null, 2));
    "
    echo "Set dev version: ${_orig_ver}"
  fi
fi
unset _pkg _orig_ver _has_version

# Apply vssharp/vscode-overrides directly into vscode/ (dev mode — no patch roundtrip)
OVERRIDES_DIR="${PROJECT_ROOT}/vssharp/vscode-overrides"
if [[ -d "${OVERRIDES_DIR}" ]]; then
  while IFS= read -r -d '' override_file; do
    rel_path="${override_file#${OVERRIDES_DIR}/}"
    dest="${PROJECT_ROOT}/vscode/${rel_path}"
    if [[ -f "${dest}" ]]; then
      cp "${override_file}" "${dest}"
      echo "Override: ${rel_path}"
    fi
  done < <(find "${OVERRIDES_DIR}" -type f -print0)
fi

"${PROJECT_ROOT}/vssharp/extend-prepare.sh"

cd "${PROJECT_ROOT}/vscode"
exec ./scripts/code.sh "$@"
