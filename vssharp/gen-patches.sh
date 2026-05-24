#!/usr/bin/env bash
# Generate patches/user/vssharp-*.patch from vssharp/vscode-overrides/.
#
# IMPORTANT: VSCodium upstream patches (patches/*.patch) are applied BEFORE
# patches/user/*.patch during prepare_vscode.sh. So our override patches MUST
# be diffed against the POST-VSCodium state, otherwise line numbers (and
# sometimes content like "VS Code" → "!!APP_NAME!!") won't match → apply fails.
#
# This script ensures vscode/ is in post-VSCodium state by applying every
# patches/*.patch to a clean baseline before diffing each override.
#
# Run after editing any override file, then commit the regenerated patches.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OVERRIDES_DIR="${PROJECT_ROOT}/vssharp/vscode-overrides"
PATCHES_DIR="${PROJECT_ROOT}/patches/user"
UPSTREAM_PATCHES_DIR="${PROJECT_ROOT}/patches"
VSCODE_DIR="${PROJECT_ROOT}/vscode"

if [[ ! -d "${VSCODE_DIR}/.git" ]]; then
  echo "Error: vscode/ not initialized. Run prepare_vscode.sh first." >&2
  exit 1
fi

apply_upstream_patches_for_file() {
  local rel_path="$1"
  # Reset to clean HEAD baseline
  git -C "${VSCODE_DIR}" checkout -- "${rel_path}" 2>/dev/null || true

  # Apply every patches/*.patch that touches this file
  shopt -s nullglob
  for patch in "${UPSTREAM_PATCHES_DIR}"/*.patch; do
    if grep -q "^diff --git a/${rel_path} b/${rel_path}" "${patch}" 2>/dev/null; then
      # Extract only the hunks for this file from the patch and apply
      awk -v target="${rel_path}" '
        /^diff --git a\// {
          in_target = ($0 == "diff --git a/" target " b/" target)
        }
        in_target { print }
      ' "${patch}" | ( cd "${VSCODE_DIR}" && git apply --whitespace=nowarn - 2>/dev/null || true )
    fi
  done
}

found=0

while IFS= read -r -d '' override_file; do
  rel_path="${override_file#${OVERRIDES_DIR}/}"

  if ! git -C "${VSCODE_DIR}" cat-file -e "HEAD:${rel_path}" 2>/dev/null; then
    echo "Warning: ${rel_path} not in vscode git HEAD, skipping" >&2
    continue
  fi

  # Apply VSCodium upstream patches that touch this file → post-VSCodium state
  apply_upstream_patches_for_file "${rel_path}"

  # Place override on top of post-VSCodium state
  cp "${override_file}" "${VSCODE_DIR}/${rel_path}"

  basename_noext="$(basename "${rel_path}" | sed 's/\.[^.]*$//')"
  patch_file="${PATCHES_DIR}/vssharp-${basename_noext}.patch"

  # Diff working-tree vs HEAD — captures (upstream changes + our override)
  # but we only want OUR diff (override vs post-upstream). So diff against a
  # temp "post-upstream" snapshot using git diff --no-index.
  tmp_baseline=$(mktemp)
  # Reset to HEAD again into temp, then re-apply upstream patches to it
  git -C "${VSCODE_DIR}" show "HEAD:${rel_path}" > "${tmp_baseline}"
  # Re-apply only hunks for this file
  shopt -s nullglob
  for patch in "${UPSTREAM_PATCHES_DIR}"/*.patch; do
    if grep -q "^diff --git a/${rel_path} b/${rel_path}" "${patch}" 2>/dev/null; then
      awk -v target="${rel_path}" '
        /^diff --git a\// {
          in_target = ($0 == "diff --git a/" target " b/" target)
        }
        in_target { print }
      ' "${patch}" | patch -s -p1 -o "${tmp_baseline}.patched" "${tmp_baseline}" 2>/dev/null && mv "${tmp_baseline}.patched" "${tmp_baseline}" || true
    fi
  done

  # Final diff: post-upstream baseline vs override
  {
    echo "diff --git a/${rel_path} b/${rel_path}"
    diff -u "${tmp_baseline}" "${override_file}" \
      | sed -e "1s|.*|--- a/${rel_path}|" -e "2s|.*|+++ b/${rel_path}|" \
      | tail -n +1
  } > "${patch_file}" || true

  rm -f "${tmp_baseline}"

  # Strip empty patches
  if [[ ! -s "${patch_file}" ]] || ! grep -q "^@@" "${patch_file}"; then
    rm -f "${patch_file}"
    echo "Skipped (no diff): ${rel_path}"
    continue
  fi

  echo "Generated: patches/user/vssharp-${basename_noext}.patch"
  found=1
done < <(find "${OVERRIDES_DIR}" -type f -print0)

if [[ "${found}" -eq 0 ]]; then
  echo "No override files found in vssharp/vscode-overrides/."
fi

# ── New-file patches (not in vscode git HEAD) ──────────────────────────────
# Bundled into 00-vssharp-rider-defaults.patch using "new file" diff format.
RIDER_PATCH="${PATCHES_DIR}/00-vssharp-rider-defaults.patch"
> "${RIDER_PATCH}"  # truncate

while IFS= read -r -d '' override_file; do
  rel_path="${override_file#${OVERRIDES_DIR}/}"

  # Skip files that ARE in git HEAD — those are handled above
  if git -C "${VSCODE_DIR}" cat-file -e "HEAD:${rel_path}" 2>/dev/null; then
    continue
  fi

  # git diff --no-index exits 1 when files differ (always for /dev/null vs file).
  # git uses the literal paths given, so "a/" and "b/" will have the full
  # absolute override path — rewrite both to the correct vscode-relative path.
  git diff --no-index -- /dev/null "${override_file}" 2>/dev/null | \
    sed "1s|diff --git a/.* b/.*|diff --git a/${rel_path} b/${rel_path}|" | \
    sed "s|^+++ b/.*|+++ b/${rel_path}|" \
    >> "${RIDER_PATCH}" || true

done < <(find "${OVERRIDES_DIR}" -type f -print0 | sort -z)

if [[ -s "${RIDER_PATCH}" ]]; then
  echo "Generated: patches/user/00-vssharp-rider-defaults.patch (new files)"
else
  rm -f "${RIDER_PATCH}"
fi
