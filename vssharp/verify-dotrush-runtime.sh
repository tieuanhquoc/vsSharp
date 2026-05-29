#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-}"

if [[ -z "${ROOT}" ]]; then
  echo "Usage: $0 <dotrush-extension-root>" >&2
  exit 2
fi

missing=()

need_file() {
  local file="$1"
  if [[ ! -f "${ROOT}/${file}" ]]; then
    missing+=("file: ${ROOT}/${file}")
  fi
}

need_dir() {
  local dir="$1"
  if [[ ! -d "${ROOT}/${dir}" ]]; then
    missing+=("dir: ${ROOT}/${dir}")
  fi
}

need_glob() {
  local label="$1"
  local pattern="$2"
  shopt -s nullglob
  local matches=( "${ROOT}"/${pattern} )
  shopt -u nullglob
  if [[ ${#matches[@]} -eq 0 ]]; then
    missing+=("${label}: ${ROOT}/${pattern}")
  fi
}

need_file "package.json"

main_path=""
if [[ -f "${ROOT}/package.json" ]]; then
  main_path="$(node -e "const p=require(require('path').resolve(process.argv[1])); process.stdout.write(p.main || '')" "${ROOT}/package.json")"
fi

if [[ -z "${main_path}" ]]; then
  missing+=("package.json main field")
else
  need_file "${main_path#./}"
fi

need_file "extension/bin/LanguageServer/DotRush.exe"
need_dir "extension/bin/Debugger"
need_dir "extension/bin/DebuggerMono"
need_dir "extension/bin/DevHost"
need_dir "extension/bin/Diagnostics"
need_glob "debugger executable" "extension/bin/Debugger/*.exe"
need_glob "diagnostics executable" "extension/bin/Diagnostics/*.exe"

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "DotRush runtime is incomplete:" >&2
  printf '  missing %s\n' "${missing[@]}" >&2
  exit 1
fi

echo "DotRush runtime verified: ${ROOT}"
