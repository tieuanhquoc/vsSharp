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
| Built-in extensions | **DotRush** (Roslyn LSP + .NET debugger) vendored; **VS Sharp Runner** (multi-project run/debug from `Properties/launchSettings.json`) |
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
├── src/{stable,insider}/                # VSCodium resource overrides (icons, plist)
├── vssharp/                             # ⭐ VS Sharp customizations
│   ├── extend-prepare.sh                # bundles vssharp/extensions/* → vscode/extensions/
│   ├── install-dotrush.sh               # clones DotRush at pinned commit + builds
│   ├── dotrush.UPSTREAM.txt             # pin commit hash for DotRush
│   ├── dotrush.patches/                 # local patches re-applied on each install
│   └── extensions/
│       ├── dotrush/                     # (gitignored) fetched by install-dotrush.sh
│       └── vssharp-runner/              # custom extension (launchSettings.json runner)
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
. ./prepare_vscode.sh
./apply-version.sh
./apply-branding.sh
./apply-logo.sh /path/to/your-logo.png

# Fetch + build DotRush (pinned in vssharp/dotrush.UPSTREAM.txt)
./vssharp/install-dotrush.sh

# Build vssharp-runner
( cd vssharp/extensions/vssharp-runner && npm install && npm run compile )

# Copy bundled extensions into vscode/extensions/
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

MIT. See [LICENSE](LICENSE).

VS Sharp redistributes:
- Microsoft VS Code source (MIT) via VSCodium's rebuild scripts.
- VSCodium scripts and patches (MIT).
- DotRush extension (MIT, by [@JaneySprings](https://github.com/JaneySprings)).
- VS Sharp Runner (MIT, this repo).

## Acknowledgements

- The **[VSCodium](https://github.com/VSCodium/vscodium)** team for the FLOSS rebuild infrastructure.
- **[JaneySprings/DotRush](https://github.com/JaneySprings/DotRush)** for the open-source Roslyn-based C# tooling.
- The **VS Code** team for the editor itself (MIT source).
