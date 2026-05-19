#!/usr/bin/env bash
# vssharp/extend-prepare.sh
# Copy vssharp/extensions/* into vscode/extensions/ as built-in extensions.
# Run AFTER prepare_vscode.sh (which applies VSCodium patches + npm ci).
# Idempotent — safe to re-run.

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
VSCODE_EXT="${PROJECT_ROOT}/vscode/extensions"
VSSHARP_EXT="${PROJECT_ROOT}/vssharp/extensions"

if [[ ! -d "${VSCODE_EXT}" ]]; then
  echo "Error: ${VSCODE_EXT} not found. Run prepare_vscode.sh first." >&2
  exit 1
fi

shopt -s nullglob
for SRC in "${VSSHARP_EXT}"/*/; do
  NAME=$( basename "${SRC%/}" )
  DEST="${VSCODE_EXT}/${NAME}"

  echo "::group::Installing ${NAME}"

  # Each vssharp extension MUST provide a built-and-ready 'extension/' folder
  # (compiled JS + assets) and a package.json. We treat that as the bundle root.
  if [[ -d "${SRC}extension" ]]; then
    BUNDLE_ROOT="${SRC}extension"
    PACKAGE_JSON="${SRC}package.json"
  else
    BUNDLE_ROOT="${SRC}"
    PACKAGE_JSON="${SRC}package.json"
  fi

  if [[ ! -f "${PACKAGE_JSON}" ]]; then
    echo "  skip: no package.json at ${PACKAGE_JSON}"
    continue
  fi

  rm -rf "${DEST}"
  mkdir -p "${DEST}"

  # Copy package metadata at the root
  cp "${PACKAGE_JSON}" "${DEST}/package.json"
  [[ -f "${SRC}package.nls.json" ]] && cp "${SRC}package.nls.json" "${DEST}/"
  [[ -f "${SRC}README.md" ]]        && cp "${SRC}README.md"        "${DEST}/"
  [[ -f "${SRC}LICENSE" ]]          && cp "${SRC}LICENSE"          "${DEST}/"
  [[ -d "${SRC}assets" ]]           && cp -r "${SRC}assets"        "${DEST}/"
  [[ -d "${SRC}themes" ]]           && cp -r "${SRC}themes"        "${DEST}/"
  [[ -d "${SRC}syntaxes" ]]         && cp -r "${SRC}syntaxes"      "${DEST}/"
  [[ -d "${SRC}snippets" ]]         && cp -r "${SRC}snippets"      "${DEST}/"
  [[ -d "${SRC}language-configuration" ]] && cp -r "${SRC}language-configuration" "${DEST}/"

  # Copy the compiled bundle (extension/ output from cake build) under the
  # path referenced by package.json "main". DotRush's main is "extension/main.js"
  # so we put the bundle at <DEST>/extension/.
  if [[ -d "${BUNDLE_ROOT}" && "${BUNDLE_ROOT}" != "${SRC%/}" ]]; then
    cp -r "${BUNDLE_ROOT}" "${DEST}/extension"
  fi

  echo "  installed: ${DEST}"
  echo "::endgroup::"
done

echo "vssharp extensions installed."
