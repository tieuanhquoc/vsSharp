#!/usr/bin/env bash
# Fetch DotRush at the commit pinned in vssharp/dotrush.UPSTREAM.txt,
# apply vssharp/dotrush.patches/*.patch, and build into vssharp/extensions/dotrush/extension/.
#
# Run once per machine, or with --force to re-clone after upstream pin bump.
#
# Requires: git, dotnet (8/9/10), Cake.Tool (dotnet-cake), npm (Node 22.x).

set -e

FORCE=0
[[ "$1" == "--force" ]] && FORCE=1

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
DOTRUSH_DIR="${PROJECT_ROOT}/vssharp/extensions/dotrush"
META_FILE="${PROJECT_ROOT}/vssharp/dotrush.UPSTREAM.txt"
PATCHES_DIR="${PROJECT_ROOT}/vssharp/dotrush.patches"

if [[ ! -f "${META_FILE}" ]]; then
  echo "Error: ${META_FILE} not found" >&2
  exit 1
fi

# Parse REPO + COMMIT from META_FILE (ignores comments)
REPO=$( grep -E '^REPO=' "${META_FILE}" | head -1 | cut -d= -f2- )
COMMIT=$( grep -E '^COMMIT=' "${META_FILE}" | head -1 | cut -d= -f2- )

if [[ -z "${REPO}" || -z "${COMMIT}" ]]; then
  echo "Error: REPO/COMMIT missing in ${META_FILE}" >&2
  exit 1
fi

echo "DotRush: ${REPO} @ ${COMMIT}"

if [[ -d "${DOTRUSH_DIR}/.git" || -d "${DOTRUSH_DIR}/src" ]]; then
  if (( FORCE )); then
    echo "Removing existing ${DOTRUSH_DIR}"
    rm -rf "${DOTRUSH_DIR}"
  else
    echo "${DOTRUSH_DIR} already exists. Pass --force to re-clone."
    exit 0
  fi
fi

# Clone shallow at exact commit, then sync submodules
mkdir -p "${DOTRUSH_DIR}"
cd "${DOTRUSH_DIR}"

git init -q
git remote add origin "${REPO}"
git fetch --depth 1 origin "${COMMIT}"
git checkout -q FETCH_HEAD
git submodule update --init --recursive --depth 1

# Apply local patches (NU1903 bypass etc.)
# Normalize CRLF → LF first (Windows git autocrlf can corrupt patches)
shopt -s nullglob
for patch in "${PATCHES_DIR}"/*.patch; do
  echo "Applying $( basename "${patch}" )"
  tmp_patch=$( mktemp )
  tr -d '\r' < "${patch}" > "${tmp_patch}"
  git apply --ignore-whitespace "${tmp_patch}"
  rm -f "${tmp_patch}"
done

# Strip nested .git folders — keep as vendored source so parent repo
# stays clean of submodule pointers.
find . -name ".git" -type d -prune -exec rm -rf {} + 2>/dev/null || true
find . -name ".git" -type f -delete 2>/dev/null || true

# Build C# server, debugger, diagnostics. All 3 are required at runtime:
#   - server      → extension/bin/LanguageServer/ (Roslyn LSP)
#   - debugging   → extension/bin/Debugger/, DebuggerMono/, DevHost/
#   - diagnostics → extension/bin/Diagnostics/  (dotnet-trace, dotnet-gcdump)
export PATH="$PATH:$HOME/.dotnet/tools"
dotnet-cake --target=server
# --bundle: pre-download ncdbg (netcoredbg) into extension/bin/Debugger/ so the
# packaged installer is self-contained. Without this, DotRush tries to download
# at runtime and fails on system-wide installs (Program Files = read-only).
dotnet-cake --target=debugging --bundle=true
dotnet-cake --target=diagnostics

# Build TS extension (webpack → extension/main.js)
npm install
npm run package

echo
echo "DotRush installed: ${DOTRUSH_DIR}/extension/"
echo "Run ./vssharp/extend-prepare.sh to copy into vscode/extensions/"
