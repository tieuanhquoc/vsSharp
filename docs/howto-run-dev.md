<!-- order: 36 -->

# VS Sharp — Dev Guide

VS Sharp = **C# IDE custom** dựng trên nền VSCodium (build từ Microsoft VS Code + patches FLOSS).
Bao gồm:
- **Branding** "VS Sharp" + logo C# (purple) thay cho VSCodium
- **DotRush** (Roslyn LSP + debugger, MIT) — vendored làm built-in extension
- **VS Sharp Runner** — extension custom đọc `Properties/launchSettings.json`, multi-project run/debug song song giống Rider

> Đã verify trên **macOS arm64** · Node 22.22.1 · Python 3.11.15 (venv) · .NET SDK 8/9/10 · MS vscode @ `560a9dba` (tag 1.116.0).

---

## Quick Start (đã setup xong)

Mở **2 terminal**:

```bash
# Terminal 1 — watch (giữ chạy nền)
cd /Users/tieuanhquoc/Files/H_Source_code/vscodium
source ./env.local.sh && cd vscode && npm run watch
# Đợi log "Finished compilation with 0 errors after XXXXX ms"

# Terminal 2 — launch app
cd /Users/tieuanhquoc/Files/H_Source_code/vscodium
./run-app.sh
```

App "VS Sharp" mở. Workflow custom: edit code trong `vscode/src/...` → watch tự rebuild → `Cmd+R` reload.

---

## Setup từ đầu (lần đầu hoặc clean state)

### 1. Cài tools

```bash
brew install jq python@3.11
source ~/.nvm/nvm.sh && nvm install 22.22.1
dotnet tool install --global Cake.Tool      # build DotRush
xcode-select --install                       # native modules
```

### 2. Python venv project-local

```bash
cd /Users/tieuanhquoc/Files/H_Source_code/vscodium
/opt/homebrew/opt/python@3.11/bin/python3.11 -m venv .venv
```

### 3. Full pipeline (~25 phút lần đầu)

```bash
source ./env.local.sh
. ./get_repo.sh                                    # clone microsoft/vscode @ pin (~1GB)
. ./prepare_vscode.sh                              # ~50 patches + npm ci (10–30 phút)
./apply-version.sh                                 # fix package.json version
./apply-branding.sh                                # VSCodium → VS Sharp
./apply-logo.sh /path/to/logo.png                  # 5 SVG (workbench + letterpress 4 themes)

# Fetch + build DotRush (cần .NET SDK). Pinned commit ở vssharp/dotrush.UPSTREAM.txt
./vssharp/install-dotrush.sh

# Build vssharp-runner
( cd vssharp/extensions/vssharp-runner \
  && npm install \
  && npm run compile )

# Bundle tất cả vssharp/extensions/* vào vscode/extensions/
./vssharp/extend-prepare.sh
```

---

## Files helper (do dev workflow tạo, không thuộc VSCodium upstream)

| File | Mục đích |
|------|----------|
| `env.local.sh` | Source mỗi terminal: nvm use 22.22.1 + `.venv` + VSCODE env vars |
| `run-app.sh` | Launch app, tự unset `NODE_OPTIONS` (Electron reject) |
| `apply-version.sh` | Fix `vscode/package.json` + Info.plist version từ `upstream/stable.json` |
| `apply-branding.sh` | Override `vscode/product.json` thành "VS Sharp" / `vssharp` / `com.vssharp` |
| `apply-logo.sh <png>` | Embed PNG vào 5 SVG (workbench `code-icon.svg` + 4 letterpress) |
| `vssharp/extend-prepare.sh` | Copy `vssharp/extensions/*` → `vscode/extensions/*` |
| `.venv/` | Python 3.11 isolated |

Tất cả script đều **idempotent** — re-run an toàn.

---

## Cấu trúc

```
vscodium/                                     ← project root
├── upstream/{stable,insider}.json            ← pin commit MS vscode
├── patches/                                  ← VSCodium patches (~50 file)
├── src/{stable,insider}/                     ← VSCodium resource overrides (icons app)
├── vscode/                                   ← MS vscode source + patches applied (~3GB)
├── vssharp/                                  ← VS Sharp customizations
│   ├── extend-prepare.sh                     ← bundle vào vscode/extensions/
│   └── extensions/
│       ├── dotrush/                          ← vendored DotRush (122MB src + 185MB built)
│       │   ├── src/VSCode/                   ← TS extension code
│       │   ├── src/DotRush.Roslyn.*/         ← C# LSP server
│       │   ├── src/DotRush.Debugging.*/      ← Debugger (Mono debugger fork)
│       │   ├── extension/                    ← built output (main.js + binaries)
│       │   └── package.json
│       ├── dotrush.UPSTREAM.txt              ← upstream commit hash
│       └── vssharp-runner/                   ← custom extension
│           ├── src/                          ← TypeScript (modular, <200 LOC/file)
│           │   ├── main.ts                   ← activate, commands
│           │   ├── launch-settings.ts        ← discover + parse launchSettings.json
│           │   ├── profile-store.ts          ← persisted state (global + per-project)
│           │   ├── profile-runner.ts         ← build task + debug config
│           │   ├── profile-tree.ts           ← TreeView sidebar
│           │   ├── session-manager.ts        ← concurrent sessions
│           │   └── running-status-bar.ts     ← count chỉ báo
│           └── extension/main.js             ← webpack output
├── docs/howto-run-dev.md                     ← FILE NÀY
├── apply-*.sh, env.local.sh, run-app.sh      ← helpers
└── .venv/                                    ← Python 3.11
```

---

## Branding (VS Sharp)

`apply-branding.sh` override `vscode/product.json`:

| Field | Giá trị |
|-------|---------|
| `nameShort` / `nameLong` | `VS Sharp` |
| `applicationName` | `vssharp` |
| `dataFolderName` | `.vssharp` |
| `darwinBundleIdentifier` | `com.vssharp` |
| `urlProtocol` / `serverApplicationName` / `tunnelApplicationName` | `vssharp[-server]` |

Đổi tên khác: edit biến đầu file `apply-branding.sh`, chạy lại.

### Logo
`apply-logo.sh /path/to/logo.png` resize + base64-embed PNG vào:
- `vscode/src/vs/workbench/browser/media/code-icon.svg` — logo UI workbench (full color)
- `vscode/src/vs/workbench/browser/parts/editor/media/letterpress-{light,dark,hcLight,hcDark}.svg` — logo mờ giữa editor (grayscale + opacity)

Logo app (Dock, Finder): file `.icns` riêng đặt manual ở:
- `vscode/resources/darwin/code.icns`
- `vscode/.build/electron/VS Sharp.app/Contents/Resources/VS Sharp.icns`
- `src/stable/resources/darwin/code.icns` (persist khi re-prepare)

---

## Extension #1 — DotRush (C# LSP + Debugger)

DotRush (MIT, https://github.com/JaneySprings/DotRush) **không được commit vào repo VS Sharp**. Thay vào đó:

- `vssharp/dotrush.UPSTREAM.txt` — pin commit hash + repo URL (chỉ 1 file)
- `vssharp/dotrush.patches/*.patch` — local mods của VS Sharp (vd NU1903 bypass)
- `vssharp/install-dotrush.sh` — script clone tại commit pin + apply patches + build

### Install / rebuild
```bash
./vssharp/install-dotrush.sh          # lần đầu (~5 phút)
./vssharp/install-dotrush.sh --force  # re-clone (sau khi bump pin)
```

Script làm:
1. Parse `REPO` + `COMMIT` từ `vssharp/dotrush.UPSTREAM.txt`
2. `git init` + `fetch --depth 1` tại commit đó vào `vssharp/extensions/dotrush/`
3. `git submodule update --init --recursive`
4. Apply mọi `vssharp/dotrush.patches/*.patch`
5. Strip nested `.git` (vendored, không phải submodule)
6. `dotnet-cake --target=diagnostics` (build C#)
7. `npm install && npm run package` (build TS)

Output: `vssharp/extensions/dotrush/extension/` (~185MB, gitignored).

### Custom

| Sửa gì | Edit ở đâu | Cách lưu vĩnh viễn |
|--------|-----------|-------------------|
| Commands / UI / providers | `vssharp/extensions/dotrush/src/VSCode/*.ts` | Edit → `npm run package` → sửa lại lần sau khi re-install. Persist bằng cách tạo patch trong `vssharp/dotrush.patches/` |
| LSP server (C#) | `src/DotRush.Roslyn.*/` | Như trên |
| Debugger | `src/DotRush.Debugging.*/` | Như trên |

**Workflow tạo patch từ thay đổi local:**
```bash
cd vssharp/extensions/dotrush
git diff > ../../dotrush.patches/02-my-change.patch  # nếu .git còn (chưa strip)
# Hoặc dùng diff bình thường với upstream
```

### Update upstream DotRush
```bash
# Lấy commit mới nhất
git ls-remote https://github.com/JaneySprings/DotRush.git refs/heads/main | awk '{print $1}'

# Edit vssharp/dotrush.UPSTREAM.txt — đổi COMMIT=<hash mới>

./vssharp/install-dotrush.sh --force   # re-clone + re-apply patches + rebuild
./vssharp/extend-prepare.sh             # copy vào vscode/extensions/
```

### Patches hiện có
- `vssharp/dotrush.patches/01-disable-nu1903.patch` — `Nerdbank.MessagePack 1.0.2` có security advisory NU1903; demote thành warning thường để build không fail.

---

## Extension #2 — VS Sharp Runner

Extension custom đọc `Properties/launchSettings.json` và cho phép multi-project run/debug song song giống Rider/Visual Studio.

### Features

**Sidebar 🚀 "VS Sharp Run"** (activity bar trái):
- TreeView hierarchy: **Project** → **Profile**
- Mỗi profile leaf: inline ▶ run · 🐞 debug · ⏹ stop (state-aware)
- Icon color-coded:
  - ⭐ tím — profile selected idle
  - ⭕ mờ — profile khác idle
  - ▶ xanh — đang run
  - 🐞 đỏ — đang debug
- Description: `▶ 3m · Development · http://localhost:5000`
- Tooltip Markdown: command type, URLs, env vars, session start time
- Header: 🔄 refresh · ⏹ stop-all
- Project node hiện count session đang chạy

**Editor top-right (auto-detect)**:
- 2 icon: ▶ · 🐞
- Click → detect `.csproj` chứa file đang focus → resolve profile theo thứ tự:
  1. Profile được chọn cuối cho project đó (per-project memory)
  2. Profile đầu tiên trong project
  3. Profile global đã chọn (nếu file ngoài project)

**Status bar trái**:
- Hiện count "▶ N running" khi có session đang chạy
- Click → QuickPick chọn session để stop

**Keybinds** (khi có profile + không trong debug):
- `F5` — debug active file's project
- `Ctrl+F5` / `Cmd+F5` — run active file's project

### Concurrent sessions
- Mỗi profile tối đa 1 session đồng thời
- Nhiều profile KHÁC NHAU chạy song song OK
- Mỗi run task có dedicated terminal panel (output không lẫn)
- Click ▶ trên profile đang chạy → cảnh báo "stop first"

### Custom

```bash
cd vssharp/extensions/vssharp-runner
# Edit src/*.ts (mỗi file < 200 dòng, modular)
npm run compile
cd ../../..
./vssharp/extend-prepare.sh
# Reload window: Cmd+Shift+P → "Developer: Reload Window"
```

### Limitations đã biết
- **Background color panel** không đổi được — VS Code không expose API. Cần patch upstream nếu muốn theme riêng cho VS Sharp Run panel.
- **Multi-target framework** (`<TargetFrameworks>net8.0;net9.0</TargetFrameworks>`) → pick TF đầu tiên. Sẽ add UI chọn TF sau.
- **Docker / IIS Express profile** chưa support. IIS profile bị skip.
- **launchSettings.json với BOM**: đã handle. Còn các format đặc biệt khác (env vars per-OS) chưa parse.

---

## Workflow dev hàng ngày

| Sửa gì | Build / reload |
|--------|---------------|
| `vscode/src/...` (VS Code core, TS) | `npm run watch` tự rebuild → `Cmd+R` |
| `patches/*.patch` | re-prepare cả vscode/ (nặng) |
| `apply-*.sh` | chạy lại script → `Cmd+R` hoặc restart app |
| `vssharp/extensions/dotrush/src/VSCode/` | `npm run package` → `extend-prepare.sh` → `Cmd+R` |
| `vssharp/extensions/dotrush/src/DotRush.Roslyn.*/` | `dotnet-cake --target=server` → `extend-prepare.sh` → restart app |
| `vssharp/extensions/vssharp-runner/src/` | `npm run compile` → `extend-prepare.sh` → reload |
| `vssharp/extensions/*/package.json` (manifest) | `extend-prepare.sh` → reload (no build) |

---

## Build full `.app` (đóng gói release)

```bash
./dev/build.sh -s -p
# -s: keep vscode/ (KHÔNG re-clone, KHÔNG mất custom)
# -p: gen .app + .dmg trong VSCode-darwin-arm64/
open VSCode-darwin-arm64/VSCodium.app
```

**Cảnh báo**: chạy `./dev/build.sh` **không có `-s`** sẽ `rm -rf vscode*` → mất hết custom. Luôn dùng `-s` sau lần đầu.

---

## Troubleshooting

### `vscode.json-language-features` báo "No valid VS Code version"
→ `./apply-version.sh` (RELEASE_VERSION không export khi `prepare_vscode.sh` chạy subshell)

### App không mở sau `./run-app.sh`
- `pgrep -fl "VS Sharp"` — có PID = đang chạy (Cmd+Tab tìm window)
- Lỗi `NODE_OPTIONS` warning là **bình thường**, không phải crash
- Lỗi `UNKNOWN service remoteAgentHostService/onboardingService` là **expected** (services bị patch xoá)

### `npm run watch` báo OOM
→ Tăng `NODE_OPTIONS=--max-old-space-size=16384` trong `env.local.sh`

### `npm ci` fail
- `node --version` phải = 22.22.1 (qua nvm)
- `python --version` phải = 3.11.x (qua venv, không phải system 3.13)
- Native module fail → `xcode-select --install`
- Script tự retry 5 lần

### Patch fail sau khi update upstream MS
```bash
./dev/update_patches.sh    # semi-auto, pause để fix .rej
```

### DotRush không hiện LSP
- Check Output panel > "DotRush" channel
- Verify `vscode/extensions/dotrush/extension/bin/LanguageServer/` có DLL
- Nếu file `.cs` không có completion: restart server qua `Cmd+Shift+P` → "DotRush: Restart Server"

### vssharp-runner không hiện nút
- Workspace có `Properties/launchSettings.json` không? (`find . -name launchSettings.json`)
- File có BOM lạ → đã handle BOM UTF-8, nhưng UTF-16/32 chưa
- `Cmd+Shift+P` → "VS Sharp: Refresh Launch Profiles"
- Developer Tools console → tìm lỗi `vssharp-runner`

### Profile dev folder
Settings/extensions của dev mode tách riêng tại `~/.vscode-oss-dev/`. Built app thật dùng `~/.vssharp/`.

---

## Cảnh báo

- **KHÔNG** chạy `./dev/build.sh` (không có `-s`) → `rm -rf vscode*` → **mất hết custom**
- **KHÔNG** `git reset --hard HEAD` trong `vscode/` → mất patches đã apply (HEAD = "VSCODIUM HELPER" commit)
- **KHÔNG** commit `vscode/` vào repo VS Sharp — quá lớn, đó là clone của MS
- `prepare_vscode.sh` chạy lại fail vì patches đã apply. Cần re-prepare: xoá `vscode/` rồi `. ./get_repo.sh && . ./prepare_vscode.sh`
- DotRush build artifacts (`extension/bin/`) ~185MB — nếu commit thì repo phình to. Cân nhắc `.gitignore`
