#!/usr/bin/env bash
# shellcheck disable=SC1091,2154

set -e

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  cp -rp src/insider/* vscode/
else
  cp -rp src/stable/* vscode/
fi

cp -f LICENSE vscode/LICENSE.txt

cd vscode || { echo "'vscode' dir not found"; exit 1; }

xattr -cr extensions/copilot 2>/dev/null || true; rm -rf extensions/copilot

{ set +x; } 2>/dev/null

# {{{ product.json
cp product.json{,.bak}

setpath() {
  local jsonTmp
  { set +x; } 2>/dev/null
  jsonTmp=$( jq --arg 'value' "${3}" "setpath(path(.${2}); \$value)" "${1}.json" )
  echo "${jsonTmp}" > "${1}.json"
  set -x
}

setpath_json() {
  local jsonTmp
  { set +x; } 2>/dev/null
  jsonTmp=$( jq --argjson 'value' "${3}" "setpath(path(.${2}); \$value)" "${1}.json" )
  echo "${jsonTmp}" > "${1}.json"
  set -x
}

setpath "product" "checksumFailMoreInfoUrl" "https://go.microsoft.com/fwlink/?LinkId=828886"
setpath "product" "documentationUrl" "https://go.microsoft.com/fwlink/?LinkID=533484#vscode"
setpath_json "product" "extensionsGallery" '{"serviceUrl": "https://open-vsx.org/vscode/gallery", "itemUrl": "https://open-vsx.org/vscode/item", "latestUrlTemplate": "https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest", "controlUrl": "https://raw.githubusercontent.com/EclipseFdn/publish-extensions/refs/heads/master/extension-control/extensions.json"}'

setpath "product" "introductoryVideosUrl" "https://go.microsoft.com/fwlink/?linkid=832146"
setpath "product" "keyboardShortcutsUrlLinux" "https://go.microsoft.com/fwlink/?linkid=832144"
setpath "product" "keyboardShortcutsUrlMac" "https://go.microsoft.com/fwlink/?linkid=832143"
setpath "product" "keyboardShortcutsUrlWin" "https://go.microsoft.com/fwlink/?linkid=832145"
setpath "product" "licenseUrl" "https://github.com/VSCodium/vscodium/blob/master/LICENSE"
setpath_json "product" "linkProtectionTrustedDomains" '["https://open-vsx.org"]'
setpath "product" "releaseNotesUrl" "https://go.microsoft.com/fwlink/?LinkID=533483#vscode"
setpath "product" "reportIssueUrl" "https://github.com/VSCodium/vscodium/issues/new"
setpath "product" "requestFeatureUrl" "https://go.microsoft.com/fwlink/?LinkID=533482"
setpath "product" "tipsAndTricksUrl" "https://go.microsoft.com/fwlink/?linkid=852118"
setpath "product" "twitterUrl" "https://go.microsoft.com/fwlink/?LinkID=533687"

if [[ "${DISABLE_UPDATE}" != "yes" ]]; then
  # VS Sharp update channel — served by a Cloudflare Worker that proxies
  # GitHub Releases of tieuanhquoc/vsSharp into the VS Code update API
  # schema. Worker source + deploy guide: docs/howto-update-channel.md.
  # Override at build time with VSSHARP_UPDATE_URL.
  setpath "product" "updateUrl" "${VSSHARP_UPDATE_URL:-https://vssharp-updates.dotnet.id.vn}"
  setpath "product" "downloadUrl" "https://github.com/tieuanhquoc/vsSharp/releases"

  # if [[ "${OS_NAME}" == "windows" ]]; then
  #   setpath_json "product" "win32VersionedUpdate" "true"
  # fi
fi

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  # VS Sharp Preview — channel for prerelease tags (vX.Y.Z-preview*).
  # Bundle ID + data folder + CLI are distinct from stable so both apps can
  # coexist on the same machine and share no settings.
  setpath "product" "nameShort" "VS Sharp - Preview"
  setpath "product" "nameLong" "VS Sharp - Preview"
  setpath "product" "applicationName" "vssharp-preview"
  setpath "product" "dataFolderName" ".vssharp-preview"
  setpath "product" "linuxIconName" "vssharp-preview"
  setpath "product" "quality" "insider"
  setpath "product" "urlProtocol" "vssharp-preview"
  setpath "product" "serverApplicationName" "vssharp-preview-server"
  setpath "product" "serverDataFolderName" ".vssharp-preview-server"
  setpath "product" "tunnelApplicationName" "vssharp-preview-tunnel"
  setpath "product" "darwinBundleIdentifier" "com.vssharp.preview"
  setpath "product" "win32AppUserModelId" "VSSharp.VSSharpPreview"
  setpath "product" "win32DirName" "VS Sharp Preview"
  setpath "product" "win32MutexName" "vssharppreview"
  setpath "product" "win32NameVersion" "VS Sharp Preview"
  setpath "product" "win32RegValueName" "VSSharpPreview"
  setpath "product" "win32ShellNameShort" "VS Sharp Preview"
  setpath "product" "win32AppId" "{{C380FB6E-CAA6-4A26-8545-AF4CC20F0AD0}"
  setpath "product" "win32x64AppId" "{{900767CE-1855-417B-8CB0-53B12C950E98}"
  setpath "product" "win32arm64AppId" "{{9DA27553-45CB-4AAB-8E1B-910A8FB2DE8A}"
  setpath "product" "win32UserAppId" "{{7ECFC784-7498-4A0E-A6F6-0ABDCEAF3517}"
  setpath "product" "win32x64UserAppId" "{{0F14F3E2-80E8-4CF7-9847-C7DB2312978A}"
  setpath "product" "win32arm64UserAppId" "{{F20746DE-B80C-4FD0-82F5-45DA94E24876}"
  setpath "product" "win32TunnelServiceMutex" "vssharppreview-tunnelservice"
  setpath "product" "win32TunnelMutex" "vssharppreview-tunnel"
  setpath "product" "win32ContextMenu.x64.clsid" "0E5E4755-B685-4E1B-AD28-75929C383E14"
  setpath "product" "win32ContextMenu.arm64.clsid" "A4D78AFB-10D2-43F3-BD27-1B4A25CEBB10"
else
  setpath "product" "nameShort" "VS Sharp"
  setpath "product" "nameLong" "VS Sharp"
  setpath "product" "applicationName" "vssharp"
  setpath "product" "dataFolderName" ".vssharp"
  setpath "product" "linuxIconName" "vssharp"
  setpath "product" "quality" "stable"
  setpath "product" "urlProtocol" "vssharp"
  setpath "product" "serverApplicationName" "vssharp-server"
  setpath "product" "serverDataFolderName" ".vssharp-server"
  setpath "product" "tunnelApplicationName" "vssharp-tunnel"
  setpath "product" "darwinBundleIdentifier" "com.vssharp"
  setpath "product" "win32AppUserModelId" "VSSharp.VSSharp"
  setpath "product" "win32DirName" "VS Sharp"
  setpath "product" "win32MutexName" "vssharp"
  setpath "product" "win32NameVersion" "VS Sharp"
  setpath "product" "win32RegValueName" "VSSharp"
  setpath "product" "win32ShellNameShort" "VS Sharp"
  setpath "product" "win32AppId" "{{763CBF88-25C6-4B10-952F-326AE657F16B}"
  setpath "product" "win32x64AppId" "{{88DA3577-054F-4CA1-8122-7D820494CFFB}"
  setpath "product" "win32arm64AppId" "{{67DEE444-3D04-4258-B92A-BC1F0FF2CAE4}"
  setpath "product" "win32UserAppId" "{{0FD05EB4-651E-4E78-A062-515204B47A3A}"
  setpath "product" "win32x64UserAppId" "{{2E1F05D1-C245-4562-81EE-28188DB6FD17}"
  setpath "product" "win32arm64UserAppId" "{{57FD70A5-1B8D-4875-9F40-C5553F094828}"
  setpath "product" "win32TunnelServiceMutex" "vssharp-tunnelservice"
  setpath "product" "win32TunnelMutex" "vssharp-tunnel"
  setpath "product" "win32ContextMenu.x64.clsid" "D910D5E6-B277-4F4A-BDC5-759A34EEE25D"
  setpath "product" "win32ContextMenu.arm64.clsid" "4852FC55-4A84-4EA1-9C86-D53BE3DF83C0"
fi

setpath_json "product" "tunnelApplicationConfig" '{}'

jsonTmp=$( jq -s '.[0] * .[1]' product.json ../product.json )
echo "${jsonTmp}" > product.json && unset jsonTmp

cat product.json
# }}}

# include common functions
. ../utils.sh

# {{{ apply patches

echo "APP_NAME=\"${APP_NAME}\""
echo "APP_NAME_LC=\"${APP_NAME_LC}\""
echo "ASSETS_REPOSITORY=\"${ASSETS_REPOSITORY}\""
echo "BINARY_NAME=\"${BINARY_NAME}\""
echo "GH_REPO_PATH=\"${GH_REPO_PATH}\""
echo "GLOBAL_DIRNAME=\"${GLOBAL_DIRNAME}\""
echo "ORG_NAME=\"${ORG_NAME}\""
echo "TUNNEL_APP_NAME=\"${TUNNEL_APP_NAME}\""

if [[ "${DISABLE_UPDATE}" == "yes" ]]; then
  mv ../patches/00-update-disable.patch.yet ../patches/00-update-disable.patch
fi

for file in ../patches/*.patch; do
  if [[ -f "${file}" ]]; then
    apply_patch "${file}"
  fi
done

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  for file in ../patches/insider/*.patch; do
    if [[ -f "${file}" ]]; then
      apply_patch "${file}"
    fi
  done
fi

if [[ -d "../patches/${OS_NAME}/" ]]; then
  for file in "../patches/${OS_NAME}/"*.patch; do
    if [[ -f "${file}" ]]; then
      apply_patch "${file}"
    fi
  done
fi

for file in ../patches/user/*.patch; do
  if [[ -f "${file}" ]]; then
    apply_patch "${file}"
  fi
done
# }}}

set -x

# {{{ install dependencies
export ELECTRON_SKIP_BINARY_DOWNLOAD=1
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

if [[ "${OS_NAME}" == "linux" ]]; then
  export VSCODE_SKIP_NODE_VERSION_CHECK=1

   if [[ "${npm_config_arch}" == "arm" ]]; then
    export npm_config_arm_version=7
  fi
elif [[ "${OS_NAME}" == "windows" ]]; then
  if [[ "${npm_config_arch}" == "arm" ]]; then
    export npm_config_arm_version=7
  fi
else
  if [[ "${CI_BUILD}" != "no" ]]; then
    clang++ --version
  fi
fi

node build/npm/preinstall.ts

mv .npmrc .npmrc.bak
cp ../npmrc .npmrc

for i in {1..5}; do # try 5 times
  if [[ "${CI_BUILD}" != "no" && "${OS_NAME}" == "osx" ]]; then
    CXX=clang++ npm ci && break
  else
    npm ci && break
  fi

  if [[ $i == 5 ]]; then
    echo "Npm install failed too many times" >&2
    exit 1
  fi
  echo "Npm install failed $i, trying again..."

  sleep $(( 15 * (i + 1)))
done

mv .npmrc.bak .npmrc
# }}}

# package.json
cp package.json{,.bak}

# PACKAGE_VERSION is clean SemVer (e.g. 0.0.2) resolved by vssharp/get-version.sh.
# VS Code's `version` field is strict SemVer; using RELEASE_VERSION (which may
# carry prerelease suffix like -preview-01) would break electron-builder, MSI
# VersionInfo, and Info.plist CFBundleShortVersionString.
setpath "package" "version" "${PACKAGE_VERSION:-${RELEASE_VERSION%-insider}}"

replace 's|Microsoft Corporation|VS Sharp|' package.json

cp resources/server/manifest.json{,.bak}

if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
  setpath "resources/server/manifest" "name" "VSCodium - Insiders"
  setpath "resources/server/manifest" "short_name" "VSCodium - Insiders"
else
  setpath "resources/server/manifest" "name" "VS Sharp"
  setpath "resources/server/manifest" "short_name" "VS Sharp"
fi

# announcements
replace "s|\\[\\/\\* BUILTIN_ANNOUNCEMENTS \\*\\/\\]|$( tr -d '\n' < ../announcements-builtin.json )|" src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts

../undo_telemetry.sh

replace 's|Microsoft Corporation|VS Sharp|' build/lib/electron.ts
replace 's|([0-9]) Microsoft|\1 VS Sharp|' build/lib/electron.ts

if [[ "${OS_NAME}" == "linux" ]]; then
  # microsoft adds their apt repo to sources
  # unless the app name is code-oss
  # as we are renaming the application to vscodium
  # we need to edit a line in the post install template
  if [[ "${VSCODE_QUALITY}" == "insider" ]]; then
    sed -i "s/code-oss/codium-insiders/" resources/linux/debian/postinst.template
  else
    sed -i "s/code-oss/codium/" resources/linux/debian/postinst.template
  fi

  # fix the packages metadata
  # code.appdata.xml
  sed -i 's|Visual Studio Code|VSCodium|g' resources/linux/code.appdata.xml
  sed -i 's|https://code.visualstudio.com/docs/setup/linux|https://github.com/VSCodium/vscodium#download-install|' resources/linux/code.appdata.xml
  sed -i 's|https://code.visualstudio.com/home/home-screenshot-linux-lg.png|https://vscodium.com/img/vscodium.png|' resources/linux/code.appdata.xml
  sed -i 's|https://code.visualstudio.com|https://vscodium.com|' resources/linux/code.appdata.xml

  # control.template
  sed -i 's|Microsoft Corporation <vscode-linux@microsoft.com>|VSCodium Team https://github.com/VSCodium/vscodium/graphs/contributors|'  resources/linux/debian/control.template
  sed -i 's|Visual Studio Code|VSCodium|g' resources/linux/debian/control.template
  sed -i 's|https://code.visualstudio.com/docs/setup/linux|https://github.com/VSCodium/vscodium#download-install|' resources/linux/debian/control.template
  sed -i 's|https://code.visualstudio.com|https://vscodium.com|' resources/linux/debian/control.template

  # code.spec.template
  sed -i 's|Microsoft Corporation|VSCodium Team|' resources/linux/rpm/code.spec.template
  sed -i 's|Visual Studio Code Team <vscode-linux@microsoft.com>|VSCodium Team https://github.com/VSCodium/vscodium/graphs/contributors|' resources/linux/rpm/code.spec.template
  sed -i 's|Visual Studio Code|VSCodium|' resources/linux/rpm/code.spec.template
  sed -i 's|https://code.visualstudio.com/docs/setup/linux|https://github.com/VSCodium/vscodium#download-install|' resources/linux/rpm/code.spec.template
  sed -i 's|https://code.visualstudio.com|https://vscodium.com|' resources/linux/rpm/code.spec.template

  # snapcraft.yaml
  sed -i 's|Visual Studio Code|VSCodium|' resources/linux/rpm/code.spec.template
elif [[ "${OS_NAME}" == "windows" ]]; then
  # code.iss
  sed -i 's|https://code.visualstudio.com|https://vscodium.com|' build/win32/code.iss
  sed -i 's|Microsoft Corporation|VSCodium|' build/win32/code.iss
fi

cd ..
