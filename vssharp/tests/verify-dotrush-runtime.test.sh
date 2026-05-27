#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERIFY="${ROOT}/vssharp/verify-dotrush-runtime.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

make_runtime() {
  local dir="$1"
  mkdir -p "${dir}/extension/bin/LanguageServer"
  mkdir -p "${dir}/extension/bin/Debugger"
  mkdir -p "${dir}/extension/bin/DebuggerMono"
  mkdir -p "${dir}/extension/bin/DevHost"
  mkdir -p "${dir}/extension/bin/Diagnostics"
  printf '{"name":"dotrush","main":"./extension/main.js"}\n' > "${dir}/package.json"
  printf 'main\n' > "${dir}/extension/main.js"
  printf 'server\n' > "${dir}/extension/bin/LanguageServer/DotRush.exe"
  printf 'debugger\n' > "${dir}/extension/bin/Debugger/DotRush.Debugging.exe"
  printf 'diagnostics\n' > "${dir}/extension/bin/Diagnostics/dotnet-trace.exe"
}

complete="${TMP}/complete"
make_runtime "${complete}"
"${VERIFY}" "${complete}" >/dev/null

missing_server="${TMP}/missing-server"
make_runtime "${missing_server}"
rm "${missing_server}/extension/bin/LanguageServer/DotRush.exe"
if "${VERIFY}" "${missing_server}" >/dev/null 2>&1; then
  echo "expected missing DotRush.exe to fail" >&2
  exit 1
fi

missing_debugger="${TMP}/missing-debugger"
make_runtime "${missing_debugger}"
rm -rf "${missing_debugger}/extension/bin/Debugger"
if "${VERIFY}" "${missing_debugger}" >/dev/null 2>&1; then
  echo "expected missing Debugger dir to fail" >&2
  exit 1
fi

no_node="${TMP}/no-node"
make_runtime "${no_node}"
mkdir -p "${TMP}/empty-path"
if PATH="${TMP}/empty-path" "${BASH}" "${VERIFY}" "${no_node}" 2>"${TMP}/no-node.err"; then
  echo "expected missing node to fail" >&2
  exit 1
fi
if ! grep -q "requires node" "${TMP}/no-node.err"; then
  echo "expected missing node error to explain the node requirement" >&2
  cat "${TMP}/no-node.err" >&2
  exit 1
fi

echo "verify-dotrush-runtime tests passed"
