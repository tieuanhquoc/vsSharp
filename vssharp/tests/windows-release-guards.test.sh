#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKFLOW="${ROOT}/.github/workflows/build-vssharp-windows.yml"
PREPARE="${ROOT}/prepare_vscode.sh"
VERIFY="${ROOT}/vssharp/verify-dotrush-runtime.sh"

assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -Fq "${needle}" "${file}"; then
    echo "missing ${label}: ${needle}" >&2
    exit 1
  fi
}

assert_not_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "${needle}" "${file}"; then
    echo "unexpected ${label}: ${needle}" >&2
    exit 1
  fi
}

assert_contains "${VERIFY}" "requires node" "clear node dependency error"

assert_contains "${PREPARE}" "restore_npmrc()" "npmrc restore helper"
assert_contains "${PREPARE}" "trap restore_npmrc EXIT" "npmrc restore trap"

assert_contains "${WORKFLOW}" "Smoke test DotRush server" "DotRush post-sign smoke test"
assert_contains "${WORKFLOW}" "Sign Windows installer artifacts" "installer signing step"
assert_contains "${WORKFLOW}" "verify-windows-artifacts.ps1" "artifact content verification"
assert_contains "${WORKFLOW}" "DotRush server was removed or quarantined by Windows Defender" "post-scan quarantine check"
assert_not_contains "${WORKFLOW}" "InitialDetectionTime -ge" "time-windowed Defender detection filter"

echo "windows release guard tests passed"
