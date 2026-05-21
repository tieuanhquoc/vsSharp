<div id="vssharp-logo" align="center">
    <br />
    <h1>VS Sharp</h1>
    <h3>A Free/Libre C# IDE built on VSCodium</h3>
</div>

---

**VS Sharp** is a fork-customization of [VSCodium](https://github.com/VSCodium/vscodium) (the FLOSS rebuild of Microsoft VS Code) tailored as a dedicated **C# / .NET IDE**.

It is **not** a from-scratch fork. We follow VSCodium's pattern: re-build Microsoft's MIT-licensed `vscode` source with custom patches, branding, and bundled extensions. All customizations live in a separate `vssharp/` tree so upstream sync stays manageable.

## What's different from VSCodium

| Layer | VS Sharp customization |
|-------|------------------------|
| Branding | `VS Sharp` name, `com.vssharp` bundle ID, `vssharp` CLI/protocol, purple C# logo |
| Built-in extensions | **DotRush** (Roslyn LSP + .NET debugger); **VS Sharp Runner** (multi-project run/debug from `Properties/launchSettings.json`); **VS Sharp Explorer** (custom Rider-style webview with Solution + Files tabs, JetBrains-style icons); **JetBrains Product Icon Theme** (set as default); **JetBrains Color Theme** (set as default dark + light) |
| Icon set | JetBrains New UI file icons (fogio file-icon-theme bundle) + JetBrains New UI product icons (fogio product-icon-theme) |
| Color theme | JetBrains New UI color theme (fogio, set as default for dark + light) |
| Default Explorer | Module hidden via `patches/user/` — registered at AuxiliaryBar with no icon, no command, no toggle. VS Sharp Explorer is the only file browser. |
| Rider-like defaults | ~40 settings pre-tuned to match JetBrains Rider feel: JetBrains Mono font 13px / line-height 1.5, breadcrumbs on, indent guides, sticky scroll, tree indent 16, single-click expand, custom title bar, auto-save, no minimap, ... (override-able in user `settings.json`) |
| Marketplace | Open VSX (inherited from VSCodium) |
| Telemetry | Disabled (inherited from VSCodium) |

## Highlights

- **Roslyn-powered C# tooling** out of the box — no need to install any extension.
- **Run / Debug from `Properties/launchSettings.json`** like Rider / Visual Studio:
  - Sidebar tree view of all projects × profiles in your workspace.
  - Editor toolbar buttons auto-detect the project containing the focused file.
  - Concurrent sessions — run profile A while debugging profile B, each in its own terminal.
  - Per-project memory for last-used profile.
  - Status bar shows running session count.
- **Modular customization** in `vssharp/extensions/` — fork your own .NET / C# extensions, bundle them as core features that ship with the app.

## Project layout

```
vscodium/                                # repo root (still named vscodium from upstream)
├── upstream/{stable,insider}.json       # pinned MS vscode commit
├── patches/                             # ~50 VSCodium patches (FLOSS rebrand + telemetry off)
│   └── user/                            # VS Sharp source patches (auto-applied)
│       ├── 00-vssharp-hide-default-explorer.patch
│       ├── 00-vssharp-default-themes.patch        # color + product-icon defaults
│       └── 00-vssharp-rider-defaults.patch        # font + sizing + Rider feel
├── src/{stable,insider}/                # VSCodium resource overrides (icons, plist)
├── vssharp/                             # ⭐ VS Sharp customizations
│   ├── extend-prepare.sh                # bundles vssharp/extensions/* → vscode/extensions/
│   ├── install-dotrush.sh               # clones DotRush at pinned commit + builds
│   ├── dotrush.UPSTREAM.txt             # pinned commit
│   ├── dotrush.patches/                 # local patches
│   └── extensions/
│       ├── dotrush/                     # (gitignored) fetched by install-dotrush.sh
│       ├── jetbrains-color-theme/       # fogio color theme bundle (MIT)
│       ├── jetbrains-product-icon-theme/ # fogio product-icon bundle (MIT)
│       ├── vssharp-runner/              # custom: launchSettings.json runner
│       └── vssharp-explorer/            # custom: webview Solution|Files tabs
│           └── media/icons/fogio/       # fogio file-icon bundle (MIT, ~1.1MB)
├── apply-version.sh                     # fix vscode/package.json version
├── apply-branding.sh                    # rewrite product.json → "VS Sharp"
├── apply-logo.sh <png>                  # embed PNG into 5 SVG slots
├── env.local.sh                         # source per terminal (nvm + venv + env vars)
├── run-app.sh                           # launch helper (strips NODE_OPTIONS for Electron)
└── docs/howto-run-dev.md                # full dev guide
```

## Quick start

Full setup + usage guide: **[docs/howto-run-dev.md](docs/howto-run-dev.md)**.

```bash
# Tools
brew install jq python@3.11
source ~/.nvm/nvm.sh && nvm install 22.22.1
dotnet tool install --global Cake.Tool          # to build DotRush

# Once
/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv .venv
source ./env.local.sh

# Pipeline (~25 min first time)
. ./get_repo.sh
. ./prepare_vscode.sh                    # also auto-applies patches/user/*.patch
./apply-version.sh
./apply-branding.sh
./apply-logo.sh /path/to/your-logo.png

# Fetch + build 3rd-party extensions (pinned in vssharp/*.UPSTREAM.txt)
./vssharp/install-dotrush.sh             # ~5 min, needs .NET SDK

# Build vssharp-* custom extensions
( cd vssharp/extensions/vssharp-runner   && npm install && npm run compile )
( cd vssharp/extensions/vssharp-explorer && npm install && npm run compile )

# Copy all bundled extensions into vscode/extensions/
./vssharp/extend-prepare.sh

# Dev — two terminals
# T1: source ./env.local.sh && cd vscode && npm run watch
# T2: ./run-app.sh
```

In-app: `Cmd+R` to reload after editing `vscode/src/...` or any built extension.

## Why does this exist

C# / .NET development on VS Code today requires Microsoft's proprietary **C# Dev Kit** (license restricts use to official VS Code builds). VS Sharp ships a 100% open-source alternative stack:

- **[DotRush](https://github.com/JaneySprings/DotRush)** (MIT) — Roslyn LSP + debugger, vendored as a built-in.
- **VS Sharp Runner** — custom extension giving Rider-class run/debug UX from `Properties/launchSettings.json` (concurrent sessions, multi-project, auto-detect).
- Everything else inherited from VSCodium: telemetry off, open-vsx marketplace, FLOSS binaries.

You can `git clone`, customize, and rebrand to your own IDE name in a few minutes. See `apply-branding.sh` and `apply-logo.sh`.

## Supported platforms

Currently verified on **macOS arm64**. Linux / Windows should work (VSCodium build scripts handle them) but haven't been validated for the VS Sharp customizations yet.

## Build a release `.app`

```bash
./dev/build.sh -s -p
open VSCode-darwin-arm64/VSCodium.app   # name still "VSCodium" until full rebrand of dev/build.sh
```

⚠ **Never** run `./dev/build.sh` without `-s` — it deletes `vscode/` and all customizations.

## License

VS Sharp's own code is **MIT** — see [LICENSE](LICENSE).

The build pipeline redistributes the following third-party sources. All are
permissive (MIT). Attribution notices ship inside the relevant subtrees
(e.g. `vssharp/extensions/vssharp-explorer/media/icons/NOTICE.md`, each
extension's `LICENSE`).

### Upstream platform

| Source | License | Used as |
|--------|---------|---------|
| [Microsoft VS Code](https://github.com/microsoft/vscode) | MIT | base editor — rebuilt from source, pinned via `upstream/stable.json` |
| [VSCodium](https://github.com/VSCodium/vscodium) | MIT | rebuild scripts + patches (telemetry off, OSS-only branding) |
| [Electron](https://github.com/electron/electron) | MIT | runtime (bundled by VS Code build) |
| [Node.js](https://nodejs.org) | MIT | runtime + build toolchain |

### Bundled extensions

| Source | License | Bundle location |
|--------|---------|-----------------|
| [JaneySprings/DotRush](https://github.com/JaneySprings/DotRush) | MIT | `vssharp/extensions/dotrush/` (fetched + built by `install-dotrush.sh`, pinned commit in `vssharp/dotrush.UPSTREAM.txt`) |
| [fogio-org/vscode-jetbrains-product-icon-theme](https://github.com/fogio-org/vscode-jetbrains-product-icon-theme) | MIT | `vssharp/extensions/jetbrains-product-icon-theme/` (raw bundle — set as default via `patches/user/`) |
| [fogio-org/vscode-jetbrains-color-theme](https://github.com/fogio-org/vscode-jetbrains-color-theme) | MIT | `vssharp/extensions/jetbrains-color-theme/` (raw bundle — set as default dark + light via `patches/user/`) |

### Bundled assets

| Source | License | Bundle location |
|--------|---------|-----------------|
| [fogio-org/vscode-jetbrains-file-icon-theme](https://github.com/fogio-org/vscode-jetbrains-file-icon-theme) | MIT | `vssharp/extensions/vssharp-explorer/media/icons/fogio/` — 186 file SVGs + 44 folder SVGs + dark/light theme manifests |

### Custom (this repo)

VS Sharp Runner, VS Sharp Explorer, branding scripts, install scripts, source
patches in `patches/user/`, dev tooling — all MIT (this repo's `LICENSE`).

### Notes on trademark

Bundled icons are functional glyphs only. **No JetBrains brand assets** (Rider,
IntelliJ IDEA, ReSharper, JetBrains logos) are redistributed — those are
trademarks of JetBrains s.r.o. and excluded from all bundles. fogio's icon
themes follow the same neutral-glyph design principle, matching JetBrains'
**New UI** visual style without using any protected mark.

## Acknowledgements

- The **[VSCodium](https://github.com/VSCodium/vscodium)** team for the FLOSS rebuild infrastructure that makes this fork possible.
- The **VS Code** team for the editor itself (MIT source).
- **[JaneySprings/DotRush](https://github.com/JaneySprings/DotRush)** for the open-source Roslyn-based C# language server and debugger.
- **[fogio-org](https://github.com/fogio-org)** for the JetBrains New UI-inspired themes (`vscode-jetbrains-file-icon-theme`, `vscode-jetbrains-product-icon-theme`, `vscode-jetbrains-color-theme`) — the bedrock of VS Sharp's Rider-like appearance.
- The **JetBrains Mono** font (Apache 2.0) — not bundled, but VS Sharp's default `editor.fontFamily` falls through to it when installed (`brew install --cask font-jetbrains-mono`).
