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
_pkg="${PROJECT_ROOT}/vscode/package.json"
if [[ "$(python3 -c "import json; print(json.load(open('${_pkg}')).get('version',''))")" == "" ]]; then
  _orig_ver=$(git -C "${PROJECT_ROOT}/vscode" show HEAD:package.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('version','1.0.0'))")
  python3 -c "
import json
with open('${_pkg}') as f: p = json.load(f)
p['version'] = '${_orig_ver}'
with open('${_pkg}', 'w') as f: json.dump(p, f, indent=2)
"
  echo "Set dev version: ${_orig_ver}"
fi
unset _pkg _orig_ver

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
