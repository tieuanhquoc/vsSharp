#!/usr/bin/env bash
# Set vscode/package.json + Electron app Info.plist version.
# Workaround for prepare_vscode.sh running in subshell without RELEASE_VERSION.
# Idempotent — safe to re-run.
#
# Reads tag from upstream/stable.json (e.g. "1.116.0").

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
QUALITY="${VSCODE_QUALITY:-stable}"

TAG=$( jq -r '.tag' "${PROJECT_ROOT}/upstream/${QUALITY}.json" )
if [[ -z "${TAG}" || "${TAG}" == "null" ]]; then
  echo "Error: no tag in upstream/${QUALITY}.json" >&2
  exit 1
fi

PKG="${PROJECT_ROOT}/vscode/package.json"
jq --arg v "${TAG}" '.version = $v' "${PKG}" > "${PKG}.tmp" && mv "${PKG}.tmp" "${PKG}"
echo "vscode/package.json version -> ${TAG}"

# Update macOS Info.plist if app bundle exists
PLIST=$( find "${PROJECT_ROOT}/vscode/.build/electron" -maxdepth 3 -name "Info.plist" -path "*.app/Contents/Info.plist" 2>/dev/null | head -1 )
if [[ -n "${PLIST}" && -f "${PLIST}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${TAG}" "${PLIST}" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string ${TAG}" "${PLIST}"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${TAG}" "${PLIST}" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string ${TAG}" "${PLIST}"
  echo "Info.plist version -> ${TAG}"
fi

echo "Done."
