#!/usr/bin/env bash
# Set vscode/package.json + Electron app Info.plist version.
# Workaround for prepare_vscode.sh running in subshell without env exported.
# Idempotent — safe to re-run.
#
# Uses PACKAGE_VERSION resolved by vssharp/get-version.sh (clean SemVer, no
# prerelease suffix — required by Info.plist + Windows installer).

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Resolve version if caller didn't already source get-version.sh.
if [[ -z "${PACKAGE_VERSION}" ]]; then
  # shellcheck source=vssharp/get-version.sh
  . "${PROJECT_ROOT}/vssharp/get-version.sh" "${VSSHARP_TAG:-}"
fi

if [[ -z "${PACKAGE_VERSION}" || "${PACKAGE_VERSION}" == "null" ]]; then
  echo "Error: PACKAGE_VERSION not resolved" >&2
  exit 1
fi

PKG="${PROJECT_ROOT}/vscode/package.json"
if [[ -f "${PKG}" ]]; then
  jq --arg v "${PACKAGE_VERSION}" '.version = $v' "${PKG}" > "${PKG}.tmp" && mv "${PKG}.tmp" "${PKG}"
  echo "vscode/package.json version -> ${PACKAGE_VERSION}"
fi

# Update macOS Info.plist if app bundle exists
PLIST=$( find "${PROJECT_ROOT}/vscode/.build/electron" -maxdepth 3 -name "Info.plist" -path "*.app/Contents/Info.plist" 2>/dev/null | head -1 )
if [[ -n "${PLIST}" && -f "${PLIST}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${PACKAGE_VERSION}" "${PLIST}" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string ${PACKAGE_VERSION}" "${PLIST}"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${PACKAGE_VERSION}" "${PLIST}" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleVersion string ${PACKAGE_VERSION}" "${PLIST}"
  echo "Info.plist version -> ${PACKAGE_VERSION}"
fi

echo "Done."
