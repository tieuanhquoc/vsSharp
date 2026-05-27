#!/usr/bin/env bash
# shellcheck disable=SC1091

set -ex

. version.sh

if [[ "${SHOULD_BUILD}" == "yes" ]]; then
  echo "MS_COMMIT=\"${MS_COMMIT}\""

  . prepare_vscode.sh

  # Re-apply VS Sharp branding + version. dev/build.sh's `git reset --hard HEAD`
  # wipes product.json changes, so apply-branding.sh must run AFTER the reset
  # (which is now, after prepare_vscode.sh) and BEFORE gulp packages the app.
  if [[ -f "./apply-version.sh" ]];  then ./apply-version.sh;  fi
  if [[ -f "./apply-branding.sh" ]]; then ./apply-branding.sh; fi

  # Inject vssharp extensions into vscode/extensions/ before gulp bundles them.
  # Must run here (after prepare_vscode.sh's git reset via dev/build.sh) so they
  # survive into the .app and the ZIP produced by prepare_assets.sh.
  if [[ -f "./vssharp/extend-prepare.sh" ]]; then
    ./vssharp/extend-prepare.sh
    # Install production deps only for vssharp extensions (not built-in vscode ones).
    # Required because gulp's vscode-min-prepack runs `npm list --production --depth=99999`
    # and fails if package.json dependencies are not installed.
    for SRC in vssharp/extensions/*/; do
      NAME=$( basename "${SRC%/}" )
      ext_pkg="vscode/extensions/${NAME}/package.json"
      [[ -f "${ext_pkg}" ]] || continue
      has_deps="$( node -e "const p=require('./${ext_pkg}'); console.log(Object.keys(p.dependencies||{}).length > 0)" 2>/dev/null )"
      if [[ "${has_deps}" == "true" ]]; then
        echo "==> npm install --production in vscode/extensions/${NAME}"
        ( cd "vscode/extensions/${NAME}" && npm install --production --ignore-scripts --no-audit --no-fund --prefer-offline )
      fi
    done

    if [[ "${OS_NAME}" == "windows" && -d "vssharp/extensions/dotrush" ]]; then
      ./vssharp/verify-dotrush-runtime.sh "vscode/extensions/dotrush"
    fi
  fi

  cd vscode || { echo "'vscode' dir not found"; exit 1; }

  export NODE_OPTIONS="--max-old-space-size=8192"
  export VSCODE_PUBLISH_COUNTER=1

  npm run gulp vscode-min-prepack

  if [[ "${OS_NAME}" == "osx" ]]; then
    # remove win32 node modules
    rm -f .build/extensions/ms-vscode.js-debug/src/win32-app-container-tokens.*.node

    # generate Group Policy definitions
    npm run copy-policy-dto --prefix build
    node build/lib/policies/policyGenerator.ts build/lib/policies/policyData.jsonc darwin

    npm run gulp "vscode-darwin-${VSCODE_ARCH}-min-packing"

    find "../VSCode-darwin-${VSCODE_ARCH}" -print0 | xargs -0 touch -c

    if [[ "${SHOULD_BUILD_CLI}" != "no" ]]; then
      . ../build_cli.sh
    fi

    VSCODE_PLATFORM="darwin"
  elif [[ "${OS_NAME}" == "windows" ]]; then
    # in CI, packaging will be done by a different job
    if [[ "${CI_BUILD}" == "no" ]]; then
      . ../build/windows/rtf/make.sh

      # generate Group Policy definitions
      npm run copy-policy-dto --prefix build
      node build/lib/policies/policyGenerator.ts build/lib/policies/policyData.jsonc win32

      npm run gulp "vscode-win32-${VSCODE_ARCH}-min-packing"

      if [[ "${VSCODE_ARCH}" != "x64" ]]; then
        SHOULD_BUILD_REH="no"
        SHOULD_BUILD_REH_WEB="no"
      fi

      . ../build_cli.sh
    fi

    VSCODE_PLATFORM="win32"
  else # linux
    # remove win32 node modules
    rm -f .build/extensions/ms-vscode.js-debug/src/win32-app-container-tokens.*.node

    # in CI, packaging will be done by a different job
    if [[ "${CI_BUILD}" == "no" ]]; then
      # generate Group Policy definitions
      npm run copy-policy-dto --prefix build
      node build/lib/policies/policyGenerator.ts build/lib/policies/policyData.jsonc linux

      npm run gulp "vscode-linux-${VSCODE_ARCH}-min-packing"

      find "../VSCode-linux-${VSCODE_ARCH}" -print0 | xargs -0 touch -c

      . ../build_cli.sh
    fi

    VSCODE_PLATFORM="linux"
  fi

  if [[ "${SHOULD_BUILD_REH}" != "no" ]]; then
    npm run gulp minify-vscode-reh
    npm run gulp "vscode-reh-${VSCODE_PLATFORM}-${VSCODE_ARCH}-min-ci"
  fi

  if [[ "${SHOULD_BUILD_REH_WEB}" != "no" ]]; then
    npm run gulp minify-vscode-reh-web
    npm run gulp "vscode-reh-web-${VSCODE_PLATFORM}-${VSCODE_ARCH}-min-ci"
  fi

  cd ..
fi
