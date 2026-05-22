#!/usr/bin/env bash
# Generate patches/user/vssharp-*.patch from vssharp/vscode-overrides/.
# Run this after editing any override file, then run prepare_vscode.sh.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OVERRIDES_DIR="${PROJECT_ROOT}/vssharp/vscode-overrides"
PATCHES_DIR="${PROJECT_ROOT}/patches/user"
VSCODE_DIR="${PROJECT_ROOT}/vscode"

if [[ ! -d "${VSCODE_DIR}/.git" ]]; then
  echo "Error: vscode/ not initialized. Run prepare_vscode.sh first." >&2
  exit 1
fi

found=0

while IFS= read -r -d '' override_file; do
  rel_path="${override_file#${OVERRIDES_DIR}/}"

  if ! git -C "${VSCODE_DIR}" cat-file -e "HEAD:${rel_path}" 2>/dev/null; then
    echo "Warning: ${rel_path} not in vscode git HEAD, skipping" >&2
    continue
  fi

  # Reset to HEAD baseline before diffing
  git -C "${VSCODE_DIR}" checkout -- "${rel_path}" 2>/dev/null || true

  # Temporarily place override in vscode/ so git diff shows correct paths
  cp "${override_file}" "${VSCODE_DIR}/${rel_path}"

  basename_noext="$(basename "${rel_path}" | sed 's/\.[^.]*$//')"
  patch_file="${PATCHES_DIR}/vssharp-${basename_noext}.patch"

  git -C "${VSCODE_DIR}" diff "${rel_path}" > "${patch_file}"

  # Leave override applied in vscode/ so the build sees it immediately.
  # Next run resets to HEAD via the checkout at the top of this loop,
  # so successive runs still produce a clean diff against the baseline.

  echo "Generated + applied: patches/user/vssharp-${basename_noext}.patch"
  found=1
done < <(find "${OVERRIDES_DIR}" -type f -print0)

if [[ "${found}" -eq 0 ]]; then
  echo "No override files found in vssharp/vscode-overrides/."
fi
