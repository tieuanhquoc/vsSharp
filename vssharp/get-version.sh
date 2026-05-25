#!/usr/bin/env bash
# Resolve VS Sharp version + quality from GitHub Release tag.
# Source of truth: tags on https://github.com/tieuanhquoc/vsSharp/releases
#
# Convention:
#   vX.Y.Z              → prod    → VSCODE_QUALITY=stable
#   vX.Y.Z-preview[-NN] → preview → VSCODE_QUALITY=insider
#
# Inputs (first match wins):
#   1. $1 (positional arg)              — explicit tag
#   2. $VSSHARP_TAG                     — explicit env override
#   3. $GITHUB_REF (refs/tags/...)      — auto-set by GitHub Actions on release
#   4. `git describe --tags`            — latest local tag
#   5. `gh release list --repo ...`     — remote API (needs gh + auth)
#   6. fallback                         → 0.0.0-dev (quality=insider)
#
# Exports:
#   VSSHARP_VERSION   e.g. 0.0.2-preview-01
#   PACKAGE_VERSION   e.g. 0.0.2          (clean SemVer for package.json / Info.plist / MSI)
#   MS_TAG            e.g. 1.116.0        (from upstream/stable.json — used by get_repo.sh)
#   VSCODE_QUALITY    stable | insider
#   RELEASE_VERSION   = VSSHARP_VERSION   (back-compat alias for VSCodium pipeline)
#
# Source this file, do not exec.

VSSHARP_REPO="${VSSHARP_REPO:-tieuanhquoc/vsSharp}"
VSSHARP_PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

_vssharp_resolve_tag() {
  local tag=""

  if [[ -n "${1}" ]]; then
    tag="${1}"
  elif [[ -n "${VSSHARP_TAG}" ]]; then
    tag="${VSSHARP_TAG}"
  elif [[ "${GITHUB_REF}" == refs/tags/* ]]; then
    tag="${GITHUB_REF#refs/tags/}"
  elif tag=$( git -C "${VSSHARP_PROJECT_ROOT}" describe --tags --abbrev=0 2>/dev/null ) && [[ -n "${tag}" ]]; then
    :
  elif command -v gh &> /dev/null; then
    tag=$( gh release list --repo "${VSSHARP_REPO}" --limit 1 --json tagName --jq '.[0].tagName' 2>/dev/null )
  fi

  echo "${tag}"
}

_vssharp_parse_tag() {
  # Strip leading "v", validate, derive PACKAGE_VERSION + VSCODE_QUALITY.
  local tag="${1}"
  local stripped="${tag#v}"

  if [[ -z "${stripped}" ]]; then
    VSSHARP_VERSION="0.0.0-dev"
    PACKAGE_VERSION="0.0.0"
    VSCODE_QUALITY="${VSCODE_QUALITY:-insider}"
    return 0
  fi

  # vX.Y.Z (prod) or vX.Y.Z-<anything> (preview)
  if [[ "${stripped}" =~ ^([0-9]+\.[0-9]+\.[0-9]+)(-.+)?$ ]]; then
    PACKAGE_VERSION="${BASH_REMATCH[1]}"
    VSSHARP_VERSION="${stripped}"
    if [[ -n "${BASH_REMATCH[2]}" ]]; then
      VSCODE_QUALITY="insider"
    else
      VSCODE_QUALITY="stable"
    fi
  else
    echo "Error: tag '${tag}' does not match vX.Y.Z[-suffix]" >&2
    return 1
  fi
}

_vssharp_resolve_ms_tag() {
  local upstream_file="${VSSHARP_PROJECT_ROOT}/upstream/stable.json"
  if [[ -f "${upstream_file}" ]]; then
    MS_TAG=$( jq -r '.tag' "${upstream_file}" )
    MS_COMMIT=$( jq -r '.commit' "${upstream_file}" )
  fi
}

_resolved_tag=$( _vssharp_resolve_tag "${1}" )
_vssharp_parse_tag "${_resolved_tag}" || return 1
_vssharp_resolve_ms_tag

RELEASE_VERSION="${VSSHARP_VERSION}"

export VSSHARP_VERSION PACKAGE_VERSION VSCODE_QUALITY RELEASE_VERSION MS_TAG MS_COMMIT

if [[ "${GITHUB_ENV}" ]]; then
  {
    echo "VSSHARP_VERSION=${VSSHARP_VERSION}"
    echo "PACKAGE_VERSION=${PACKAGE_VERSION}"
    echo "VSCODE_QUALITY=${VSCODE_QUALITY}"
    echo "RELEASE_VERSION=${RELEASE_VERSION}"
    echo "MS_TAG=${MS_TAG}"
    echo "MS_COMMIT=${MS_COMMIT}"
  } >> "${GITHUB_ENV}"
fi

echo "VSSHARP_VERSION=${VSSHARP_VERSION}"
echo "PACKAGE_VERSION=${PACKAGE_VERSION}"
echo "VSCODE_QUALITY=${VSCODE_QUALITY}"
echo "MS_TAG=${MS_TAG}"

unset -f _vssharp_resolve_tag _vssharp_parse_tag _vssharp_resolve_ms_tag
unset _resolved_tag
