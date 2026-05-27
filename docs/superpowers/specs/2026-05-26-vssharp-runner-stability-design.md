# VS Sharp Runner Stability Design

Date: 2026-05-26

## Goal

Make VS Sharp reliable as a full internal C# IDE for the user's current .NET solution shape. Phase 1 focuses only on build/run/debug correctness and predictability for supported projects, not broad public .NET compatibility.

## Product Scope

Supported in this phase:

- SDK-style `.csproj` projects inside `.sln` workspaces.
- `Properties/launchSettings.json` profiles with `commandName: "Project"`.
- Build, run, and debug from the runner tree, editor title actions, and keyboard shortcuts.
- Project selection based on the active editor file.
- Default .NET CLI based workflow through `dotnet build` and `dotnet run`.

Explicitly out of scope for this phase:

- `Executable`, `Docker`, `IIS`, `IISExpress`, and custom launch profile support.
- NuGet UI, publish UI, multi-project startup UI, and project templates.
- General public IDE compatibility for all .NET project shapes.

Unsupported profile types should not look runnable. They should either be hidden or shown as disabled with a clear reason.

## Architecture

The runner should be organized around four responsibilities.

### Profile Discovery

Profile discovery reads `Properties/launchSettings.json`, finds the owning `.csproj`, and returns discovery entries with validation status. It should not silently drop invalid data during discovery, because the tree and diagnostics need enough information to explain why something is not runnable.

Use two explicit surfaces:

- A complete discovery result for UI and diagnostics.
- A runnable profile list filtered to supported `Project` profiles for run/debug commands.

Validation should produce actionable status:

- Supported profile.
- Unsupported command type.
- Missing project file.
- Invalid or unreadable launch settings.

The runner tree can use this status to avoid presenting unsupported profiles as runnable. Unsupported entries may be hidden from the normal tree or shown as disabled, but run/debug commands must only accept supported `Project` profiles.

### Project Profile Resolution

Create a focused resolver module that owns profile selection rules:

- `discoverProfiles()`
- `runnableProfiles(discoveryResult)`
- `findProjectForFile(filePath)`
- `selectedForProject(projectPath)`
- `validateProfile(profile)`

Editor actions and keyboard shortcuts should call active-file commands:

- `F5` -> `vssharp.runner.debugActive`
- `Ctrl+F5` / `Cmd+F5` -> `vssharp.runner.runActive`

Active-file commands should run only a supported profile belonging to the active editor file's project. If the active file cannot be mapped to a supported project profile, fail with a clear message or ask the user to pick a profile; do not silently fall back to an unrelated globally selected profile.

Tree item commands should keep running the exact clicked supported profile. Command palette commands may fall back to the selected profile or ask the user to pick one.

### Build Output Resolution

Debug should not guess the DLL path from `ProjectName`. After build, the runner should resolve the actual output assembly path.

The preferred implementation is to query MSBuild for the final `TargetPath` after a successful build, using the same configuration and selected target framework that debug will launch. This avoids reconstructing paths from partial metadata and handles customized output settings.

Minimum fallback metadata, only if `TargetPath` cannot be queried directly:

- `TargetFramework` or the selected first `TargetFrameworks` value.
- `AssemblyName`, falling back to project file name.
- `OutputPath` when used by the user's projects.

The first implementation can use a small MSBuild metadata query through `dotnet msbuild`, for example a `TargetPath` property query, or an equivalent target that prints the resolved path. If the resolved file path cannot be determined or does not exist, debug should fail with a clear message instead of launching a guessed path.

### Session State

Each profile should expose a predictable lifecycle:

- `idle`
- `building`
- `running`
- `debugging`
- `failed`
- `stopped`

The tree, status bar, and stop commands should derive from this state. Errors should point users to the relevant terminal or unsupported profile reason.

Minimum transition rules:

- Starting debug moves `idle -> building -> debugging`.
- Starting run moves `idle -> running`; `dotnet run` owns its build unless an explicit build step is added later.
- A failed build or failed debug launch moves to `failed` and keeps the error visible until the next run/debug, refresh, or explicit clear.
- A manual stop moves to `stopped`; a normal task/debug termination may move to `stopped` briefly or clear to `idle`, but the behavior must be consistent across tree and status bar.
- Starting a new run/debug for the same profile clears any previous `failed` or `stopped` state.

## Error Handling

Errors should be short and actionable:

- `No supported Project launch profile found.`
- `Unsupported launch profile type: Docker.`
- `Build failed. See terminal: Build <project>.`
- `Cannot resolve output DLL from MSBuild metadata.`
- `Project is outside the current workspace.`

Parsing errors should be logged for diagnostics but should not break extension activation.

## Verification

Add fixture-based tests for runner logic. Suggested fixtures:

- `simple-web-api`
- `assembly-name-differs`
- `multi-target-project`
- `no-launch-settings`
- `unsupported-profile`

Minimum tests:

- Discovers only supported `Project` profiles for runnable commands.
- Active file maps to the correct project.
- Unsupported profiles are hidden or disabled.
- Profile selection falls back in the documented order.
- Command-line arguments split as expected.
- Debug configuration uses resolved assembly path, `cwd`, and environment variables.

Test strategy:

- Extract resolver, validation, argument splitting, and output-path resolution into modules that do not import `vscode`.
- Add a Node-based test runner, such as Vitest or the built-in Node test runner, for fixture-based unit tests.
- Keep VS Code extension-host tests optional for command registration and UI wiring only.

CI should compile at least:

- `vssharp/extensions/vssharp-runner`
- `vssharp/extensions/vssharp-explorer`
- `vssharp/extensions/vssharp-icons`

CI changes should update the existing VS Sharp extension build workflow so all three extension packages run `npm install --prefer-offline` and `npm run compile`. Runner unit tests should run in the same workflow once the test harness exists.

## Implementation Order

1. Fix keybindings to call active-file commands.
2. Filter or disable unsupported launch profile types.
3. Extract profile resolution into a dedicated module.
4. Resolve debug output DLL from project metadata instead of guessing.
5. Add explicit session states and better user-facing errors.
6. Add fixtures, unit tests, and CI compile checks.

## Success Criteria

For the user's supported project set:

- `F5` debugs the active file's project.
- `Ctrl+F5` runs the active file's project.
- Clicking Run/Debug in the tree runs the clicked profile.
- Unsupported profiles do not start broken run/debug flows.
- Debug launches the real output assembly.
- Build/run/debug failures are visible, understandable, and recoverable.
