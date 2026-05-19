#!/usr/bin/env bash
# Override VSCodium branding -> "VS Sharp" in vscode/product.json.
# Run AFTER prepare_vscode.sh (it hardcodes "VSCodium" in product.json).
# Idempotent — safe to re-run.

set -e

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PRODUCT="${PROJECT_ROOT}/vscode/product.json"

if [[ ! -f "${PRODUCT}" ]]; then
  echo "Error: ${PRODUCT} not found. Run prepare_vscode.sh first." >&2
  exit 1
fi

# Brand identity
NAME_SHORT="VS Sharp"
NAME_LONG="VS Sharp"
APPLICATION_NAME="vssharp"
DATA_FOLDER=".vssharp"
DARWIN_BUNDLE_ID="com.vssharp"
URL_PROTOCOL="vssharp"
SERVER_APP_NAME="vssharp-server"
SERVER_DATA_FOLDER=".vssharp-server"
TUNNEL_APP_NAME="vssharp-tunnel"

jq \
  --arg nameShort "${NAME_SHORT}" \
  --arg nameLong "${NAME_LONG}" \
  --arg applicationName "${APPLICATION_NAME}" \
  --arg dataFolderName "${DATA_FOLDER}" \
  --arg darwinBundleIdentifier "${DARWIN_BUNDLE_ID}" \
  --arg urlProtocol "${URL_PROTOCOL}" \
  --arg serverApplicationName "${SERVER_APP_NAME}" \
  --arg serverDataFolderName "${SERVER_DATA_FOLDER}" \
  --arg tunnelApplicationName "${TUNNEL_APP_NAME}" \
  '
    .nameShort = $nameShort |
    .nameLong = $nameLong |
    .applicationName = $applicationName |
    .dataFolderName = $dataFolderName |
    .darwinBundleIdentifier = $darwinBundleIdentifier |
    .urlProtocol = $urlProtocol |
    .serverApplicationName = $serverApplicationName |
    .serverDataFolderName = $serverDataFolderName |
    .tunnelApplicationName = $tunnelApplicationName
  ' "${PRODUCT}" > "${PRODUCT}.tmp" && mv "${PRODUCT}.tmp" "${PRODUCT}"

echo "Branding applied:"
jq '{nameShort, nameLong, applicationName, dataFolderName, darwinBundleIdentifier, urlProtocol}' "${PRODUCT}"
