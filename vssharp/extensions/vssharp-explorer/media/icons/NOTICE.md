# Third-party icon attribution

## `fogio/` — JetBrains File Icon Theme (fogio-org)

Source: https://github.com/fogio-org/vscode-jetbrains-file-icon-theme
Commit: 09168f7 (as of 2026-05-20)
License: MIT
Copyright (c) 2025 fogio-org

Bundle includes:
- `file/*.svg`            — 186 file-type icons (light + dark variants)
- `folder/*.svg`          — 44 folder icons (light + dark variants)
- `dark.json`, `light.json` — original theme manifests, used by the
  webview to resolve `fileExtensions` / `fileNames` / `folderNames`
  → iconPath at runtime.

The webview consumes these via fetch + JSON lookup, NOT via VS Code's
`iconThemes` contribution — so this bundle works regardless of the
user's selected icon theme.
