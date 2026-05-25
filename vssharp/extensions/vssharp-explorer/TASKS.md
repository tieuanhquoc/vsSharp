# VS Sharp Explorer — Context Menu Tasks

Goal: clone Rider's Solution Explorer context menu behavior.

---

## Status Legend
- `[ ]` todo
- `[x]` done
- `[~]` stub (registered but shows "not yet implemented")
- `[-]` low priority / skip

---

## Group 1 — Quick wins (missing across multiple nodes)

### Open in Terminal
- [ ] `project` node — add menu entry `6_tools@1`
- [ ] `folder` node — add menu entry `6_tools@1`
- [ ] `file` node — add menu entry `6_tools@1` (opens terminal at file's parent dir)
- [ ] `solutionFolder` node — add menu entry `6_tools@1`

### Open in Finder (macOS) / Reveal in File Explorer
- [ ] `project` node — add menu entry `6_tools@2`
- [ ] `folder` node — add menu entry `6_tools@2`
- [ ] `file` node — add menu entry `6_tools@2`
- [ ] Fix: `openInFinder` on `solution` currently calls `revealFileInOS` (same as Reveal in Explorer). Should open the *folder* containing the file, not the file itself.

### Reveal in Explorer
- [ ] `solutionFolder` node — add menu entry `2_open@1`

### Rename
- [ ] `solutionFolder` node — add menu entry `2_modify@3`

### Delete
- [ ] `solutionFolder` node — add menu entry `2_modify@4`
- [ ] `project` node — add menu entry `2_modify@4` (remove from solution, optionally delete from disk)

### Rename on solution
- [ ] `solution` node — add `Rename` (renames .sln file)

---

## Group 2 — Build actions

### Rebuild
- [ ] Add command `vssharp.explorer.rebuild`
- [ ] Register in `package.json` commands + menus:
  - `solution` group `5_dotnet@2`
  - `solutionFolder` group `5_dotnet@2`
  - `project` group `5_dotnet@2`
- [ ] Implement: `dotnet build --no-incremental "<path>"`

---

## Group 3 — File operations

### Add → Existing Item
- [ ] Add command `vssharp.explorer.addExistingItem`
- [ ] Register in menus for `project` and `folder` nodes (submenu or direct)
- [ ] Implement: show file open dialog, copy/link file into target dir, refresh

### Copy File Name
- [ ] Add command `vssharp.explorer.copyFileName`
- [ ] Register in `file` node menu, group `3_clipboard@3`
- [ ] Implement: `path.basename(fsPath)` → clipboard

---

## Group 4 — Project-level advanced

### Set as Startup Project
- [ ] Add command `vssharp.explorer.setStartupProject`
- [ ] Register in `project` node menu, group `4_dotnet@2`
- [ ] Implement: write to workspace state, persist, expose for launch config

### Manage NuGet Packages (real UI)
- [~] `solution` node — currently stub
- [ ] Implement: delegate to `dotnet nuget` CLI or open dedicated webview panel

### Add New Project
- [~] `solution` / `solutionFolder` — currently stub
- [ ] Implement: show template picker → `dotnet new` → add to .sln

### Add Existing Project
- [~] `solution` / `solutionFolder` — file dialog works, but doesn't modify .sln
- [ ] Implement: run `dotnet sln add "<path>"`, then refresh

### Add New Solution Folder
- [~] `solution` — currently stub
- [ ] Implement: mutate .sln file to add virtual solution folder entry

### Unload / Reload Projects
- [~] `solution` — currently stubs
- [ ] Implement: track unloaded set in workspace state, exclude from tree

---

## Group 5 — Properties panel

### Properties...
- [~] `solution` — shows basic message
- [ ] Implement proper Properties panel (webview or quickpick):
  - Solution: path, projects count, config list
  - Project: target framework, output type, nullable, package id

---

## Bugs / Fixes

- [ ] `openInFinder` vs `revealInExplorer` on solution node are identical — differentiate behavior
- [ ] `solutionFolder` missing many menu items (see Group 1 above)
- [ ] `Reload All Projects` just calls refresh — should restore previously unloaded projects

---

## Reference: Rider context menu by node (source of truth)

### solution
Add (New Project, Existing Project, Solution Folder) | Build | Rebuild | Clean | Restore | Manage NuGet | Unload | Reload All | Reveal in Explorer | Open in Terminal | Open in Finder | Run Multiple | Publish | Rename | Properties

### solutionFolder
Add (New Project, Solution Folder, Existing Item) | Build | Rebuild | Clean | Restore | Rename | Delete | Reveal in Explorer | Open in Terminal

### project
Add (New File, New Folder, Existing Item) | Build | Rebuild | Clean | Restore | Pack | Run | Debug | Test | Set as Startup | Manage NuGet | Add Package | Edit Project File | Rename | Delete | Reveal in Explorer | Open in Terminal | Open in Finder | Copy Relative Path | Copy Absolute Path | Properties

### folder
Add (New File, New Folder, Existing Item) | Rename | Delete | Reveal in Explorer | Open in Terminal | Open in Finder | Copy Relative Path | Copy Absolute Path

### file
Reveal in Explorer | Open in Finder | Open in Terminal | Rename | Delete | Duplicate | Copy Relative Path | Copy Absolute Path | Copy File Name
