#!/usr/bin/env bash
# shellcheck disable=SC1091,SC2129

set -e

# git workaround
if [[ "${CI_BUILD}" != "no" ]]; then
  git config --global --add safe.directory "/__w/$( echo "${GITHUB_REPOSITORY}" | awk '{print tolower($0)}' )"
fi

# Resolve VS Sharp version + MS_TAG via vssharp/get-version.sh.
# Sets: VSSHARP_VERSION, PACKAGE_VERSION, VSCODE_QUALITY, RELEASE_VERSION, MS_TAG, MS_COMMIT
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# shellcheck source=vssharp/get-version.sh
. "${PROJECT_ROOT}/vssharp/get-version.sh" "${VSSHARP_TAG:-}"

if [[ -z "${MS_TAG}" || "${MS_TAG}" == "null" ]]; then
  echo "Retrieve latest MS_TAG via update API"
  UPDATE_INFO=$( curl --silent --fail "https://update.code.visualstudio.com/api/update/darwin/${VSCODE_QUALITY}/0000000000000000000000000000000000000000" )
  MS_COMMIT=$( echo "${UPDATE_INFO}" | jq -r '.version' )
  MS_TAG=$( echo "${UPDATE_INFO}" | jq -r '.name' )

  if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
    MS_TAG="${MS_TAG/\-insider/}"
  fi
fi

echo "RELEASE_VERSION=\"${RELEASE_VERSION}\""
echo "MS_TAG=\"${MS_TAG}\""

mkdir -p vscode
cd vscode || { echo "'vscode' dir not found"; exit 1; }

git init -q
git remote add origin https://github.com/Microsoft/vscode.git 2>/dev/null || true

if [[ -z "${MS_COMMIT}" || "${MS_COMMIT}" == "null" ]]; then
  REFERENCE=$( git ls-remote --tags | grep -x ".*refs\/tags\/${MS_TAG}" | head -1 )

  if [[ -z "${REFERENCE}" ]]; then
    echo "Error: The following tag can't be found: ${MS_TAG}"
    exit 1
  elif [[ "${REFERENCE}" =~ ^([[:alnum:]]+)[[:space:]]+refs\/tags\/(.+)$ ]]; then
    MS_COMMIT="${BASH_REMATCH[1]}"
    MS_TAG="${BASH_REMATCH[2]}"
  else
    echo "Error: The following reference can't be parsed: ${REFERENCE}"
    exit 1
  fi
fi

echo "MS_TAG=\"${MS_TAG}\""
echo "MS_COMMIT=\"${MS_COMMIT}\""

git fetch --depth 1 origin "${MS_COMMIT}"
git checkout FETCH_HEAD

cd ..

# for GH actions
if [[ "${GITHUB_ENV}" ]]; then
  echo "MS_TAG=${MS_TAG}" >> "${GITHUB_ENV}"
  echo "MS_COMMIT=${MS_COMMIT}" >> "${GITHUB_ENV}"
  echo "RELEASE_VERSION=${RELEASE_VERSION}" >> "${GITHUB_ENV}"
fi

export MS_TAG
export MS_COMMIT
export RELEASE_VERSION
