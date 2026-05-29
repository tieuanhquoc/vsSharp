#!/usr/bin/env bash
# Generate all Windows installer assets (icon + Inno banner + Start tiles)
# from a single square logo PNG, and place them in src/stable/resources/win32/.
#
# Idempotent — safe to re-run. Uses Python+Pillow from .venv.
#
# Usage:  ./apply-windows-icons.sh /path/to/logo.png

set -e

PNG_SRC="${1:-}"
if [[ -z "${PNG_SRC}" || ! -f "${PNG_SRC}" ]]; then
  echo "Usage: $0 /path/to/logo.png  (square PNG, 1024×1024 recommended)" >&2
  exit 1
fi

PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DEST="${PROJECT_ROOT}/src/stable/resources/win32"

# Activate venv if available, else require system Python with Pillow.
if [[ -f "${PROJECT_ROOT}/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  . "${PROJECT_ROOT}/.venv/bin/activate"
elif [[ -f "${PROJECT_ROOT}/.venv/Scripts/activate" ]]; then
  # shellcheck disable=SC1091
  . "${PROJECT_ROOT}/.venv/Scripts/activate"
fi

# Determine python executable
if command -v python.exe &>/dev/null; then
  PYTHON_EXE="python.exe"
elif command -v python &>/dev/null; then
  PYTHON_EXE="python"
elif command -v python3 &>/dev/null; then
  PYTHON_EXE="python3"
else
  echo "Error: Python is not installed or not in PATH." >&2
  exit 1
fi

$PYTHON_EXE -c "from PIL import Image" 2>/dev/null || {
  echo "Installing Pillow ..."
  $PYTHON_EXE -m pip install --quiet Pillow
}
# Convert Unix/WSL paths to Windows-native paths for Windows-native Python
if command -v cygpath &>/dev/null; then
  PNG_SRC_WIN=$(cygpath -w "$PNG_SRC")
  DEST_WIN=$(cygpath -w "$DEST")
elif command -v wslpath &>/dev/null; then
  PNG_SRC_WIN=$(wslpath -w "$PNG_SRC")
  DEST_WIN=$(wslpath -w "$DEST")
else
  PNG_SRC_WIN="$PNG_SRC"
  DEST_WIN="$DEST"
fi

mkdir -p "${DEST}"

$PYTHON_EXE - "$PNG_SRC_WIN" "$DEST_WIN" <<'PYEOF'
import sys
from pathlib import Path
from PIL import Image, ImageOps

src_path = Path(sys.argv[1])
dest = Path(sys.argv[2])

logo = Image.open(src_path).convert("RGBA")

# ── 1. code.ico — multi-resolution app icon ───────────────────────────────────
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
logo.save(dest / "code.ico", format="ICO", sizes=ico_sizes, bitmap_format="bmp")
print(f"  {dest/'code.ico'}  ({len(ico_sizes)} resolutions)")

# ── 2. Inno Setup wizard banners ──────────────────────────────────────────────
def make_banner(size, bg=(255, 255, 255, 255), pad=0.10):
    """Center logo on white background with padding."""
    w, h = size
    canvas = Image.new("RGBA", (w, h), bg)
    side = int(min(w, h) * (1 - pad * 2))
    fitted = logo.copy()
    fitted.thumbnail((side, side), Image.LANCZOS)
    fx = (w - fitted.width) // 2
    fy = (h - fitted.height) // 2
    canvas.paste(fitted, (fx, fy), fitted)
    return canvas.convert("RGB")  # BMP doesn't support alpha

# Big banners — left side of installer wizard (portrait)
big_sizes = {
    "100": (164, 314), "125": (192, 386), "150": (246, 459),
    "175": (273, 556), "200": (328, 604), "225": (355, 700),
    "250": (410, 797),
}
for pct, size in big_sizes.items():
    f = dest / f"inno-big-{pct}.bmp"
    make_banner(size).save(f, format="BMP")
    print(f"  {f}  {size[0]}x{size[1]}")

# Small banners — top-right corner of installer wizard (square-ish)
small_sizes = {
    "100": (55, 55),   "125": (64, 68),   "150": (83, 80),
    "175": (92, 97),   "200": (110, 106), "225": (119, 123),
    "250": (138, 140),
}
for pct, size in small_sizes.items():
    f = dest / f"inno-small-{pct}.bmp"
    make_banner(size, pad=0.05).save(f, format="BMP")
    print(f"  {f}  {size[0]}x{size[1]}")

# ── 3. Start tile PNGs (Windows tile manifest) ────────────────────────────────
for tile_size in [(70, 70), (150, 150)]:
    f = dest / f"code_{tile_size[0]}x{tile_size[1]}.png"
    make_banner(tile_size, bg=(0, 0, 0, 0), pad=0.10).save(f, format="PNG")
    # Re-open and ensure RGBA (BMP conv strips alpha)
    Image.open(src_path).convert("RGBA").resize(tile_size, Image.LANCZOS).save(f, format="PNG")
    print(f"  {f}  {tile_size[0]}x{tile_size[1]}")

print()
print("Done. Files written to:", dest)
PYEOF

# Sync to vscode/resources/win32/ if vscode/ exists, so the next build picks them up.
if [[ -d "${PROJECT_ROOT}/vscode/resources/win32" ]]; then
  cp "${DEST}"/code.ico            "${PROJECT_ROOT}/vscode/resources/win32/" 2>/dev/null || true
  cp "${DEST}"/inno-big-*.bmp      "${PROJECT_ROOT}/vscode/resources/win32/" 2>/dev/null || true
  cp "${DEST}"/inno-small-*.bmp    "${PROJECT_ROOT}/vscode/resources/win32/" 2>/dev/null || true
  cp "${DEST}"/code_*x*.png        "${PROJECT_ROOT}/vscode/resources/win32/" 2>/dev/null || true
  echo "Also synced to vscode/resources/win32/"
fi
