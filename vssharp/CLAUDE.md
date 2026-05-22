# VS Sharp — Claude Dev Rules

## Patching VS Code core files

**TUYỆT ĐỐI KHÔNG sửa file `.patch` trong `patches/user/` trực tiếp.**

Quy trình đúng:

1. **Lưu file nguồn** đã sửa vào `vssharp/vscode-overrides/<path-relative-to-vscode>/`
   - Ví dụ: `vssharp/vscode-overrides/src/vs/workbench/browser/parts/views/viewPaneContainer.ts`
   - File này là bản sao đầy đủ của file gốc + các thay đổi VS Sharp

2. **Chạy script** để generate patch + apply:
   ```bash
   ./vssharp/gen-patches.sh
   ```
   Script sẽ:
   - Diff từng file trong `vscode-overrides/` với bản gốc trong `vscode/`
   - Ghi ra `patches/user/` tương ứng
   - Apply patch vào `vscode/`

3. **Không cần đọc/sửa file `.patch`** — file đó do script tự tạo, không phải source of truth.

### Source of truth

| Muốn sửa gì | Sửa ở đâu |
|---|---|
| VS Code core (TS/CSS) | `vssharp/vscode-overrides/` |
| Extension của VS Sharp | `vssharp/extensions/` |
| Assets/icons | `src/stable/` |
| Patch files (`patches/user/`) | **KHÔNG bao giờ sửa tay** |
