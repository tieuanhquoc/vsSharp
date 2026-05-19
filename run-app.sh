#!/usr/bin/env bash
# Launch VSCodium dev app (without NODE_OPTIONS which Electron rejects).
# Run AFTER `npm run watch` is compiled.

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Activate env but strip NODE_OPTIONS (Electron packaged binary rejects it)
# shellcheck disable=SC1091
. "${PROJECT_ROOT}/env.local.sh"
unset NODE_OPTIONS

cd "${PROJECT_ROOT}/vscode"
exec ./scripts/code.sh "$@"
