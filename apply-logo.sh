#!/usr/bin/env bash
# Apply a single PNG logo to the 5 in-app SVG locations.
# Idempotent — safe to re-run.
#
# Usage:  ./apply-logo.sh /path/to/logo.png

set -e

PNG_SRC="${1:-}"
if [[ -z "${PNG_SRC}" || ! -f "${PNG_SRC}" ]]; then
  echo "Usage: $0 /path/to/logo.png" >&2
  exit 1
fi

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VSCODE="${PROJECT_ROOT}/vscode"
SRC_OVERRIDE="${PROJECT_ROOT}/src/stable"

TMP="$( mktemp -d )"
trap "rm -rf ${TMP}" EXIT

# Resize two variants
sips -s format png -Z 512 "${PNG_SRC}" --out "${TMP}/logo-512.png" >/dev/null
sips -s format png -Z 256 "${PNG_SRC}" --out "${TMP}/logo-256.png" >/dev/null

# Base64 (no newlines)
B64_512=$( base64 -i "${TMP}/logo-512.png" | tr -d '\n' )
B64_256=$( base64 -i "${TMP}/logo-256.png" | tr -d '\n' )

write_workbench_svg() {
  local OUT="$1"
  mkdir -p "$( dirname "${OUT}" )"
  cat > "${OUT}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024" viewBox="0 0 100 100">
  <image href="data:image/png;base64,${B64_512}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>
</svg>
EOF
}

write_letterpress_svg() {
  local OUT="$1"
  local OPACITY="$2"     # e.g. 0.10 for light, 0.18 for hc
  local FILTER="$3"      # e.g. "grayscale(1)" or "grayscale(1) brightness(1.6)"
  mkdir -p "$( dirname "${OUT}" )"
  cat > "${OUT}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="40" viewBox="0 0 40 40">
  <image href="data:image/png;base64,${B64_256}" x="0" y="0" width="40" height="40" preserveAspectRatio="xMidYMid meet" style="filter:${FILTER};opacity:${OPACITY}"/>
</svg>
EOF
}

# --- Workbench logo (code-icon.svg) — full color ---
write_workbench_svg "${VSCODE}/src/vs/workbench/browser/media/code-icon.svg"
write_workbench_svg "${SRC_OVERRIDE}/src/vs/workbench/browser/media/code-icon.svg"

# --- Letterpress (4 variants) — grayscale + low opacity ---
LP="${VSCODE}/src/vs/workbench/browser/parts/editor/media"
write_letterpress_svg "${LP}/letterpress-light.svg"   "0.10" "grayscale(1)"
write_letterpress_svg "${LP}/letterpress-dark.svg"    "0.10" "grayscale(1) brightness(2)"
write_letterpress_svg "${LP}/letterpress-hcLight.svg" "0.18" "grayscale(1)"
write_letterpress_svg "${LP}/letterpress-hcDark.svg"  "0.18" "grayscale(1) brightness(2)"

echo "Logo applied to:"
echo "  workbench: ${VSCODE}/src/vs/workbench/browser/media/code-icon.svg"
echo "  letterpress (4): ${LP}/letterpress-{light,dark,hcLight,hcDark}.svg"
echo ""
echo "Next: in app, Cmd+R to reload window."
