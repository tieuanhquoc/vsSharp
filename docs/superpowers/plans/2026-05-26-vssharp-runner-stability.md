# VS Sharp Runner Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the VS Sharp runner choose the correct supported `Project` profile, launch the real debug assembly, and expose predictable session state.

**Architecture:** Extract pure runner logic into testable modules that do not import `vscode`, then keep VS Code integration thin in `launch-settings.ts`, `main.ts`, and `profile-runner.ts`. Use Node's built-in test runner so the package gains tests without adding new npm dependencies.

**Tech Stack:** TypeScript, VS Code extension API, Node 20 test runner, `dotnet msbuild`, webpack.

---

## File Structure

- `vssharp/extensions/vssharp-runner/src/profile-resolver.ts`: Pure launch profile types, validation, runnable filtering, active-file project matching, per-project selection, and command-line argument splitting.
- `vssharp/extensions/vssharp-runner/src/msbuild-output.ts`: Pure helpers for target framework parsing, MSBuild argument construction, property output parsing, and a small async `TargetPath` resolver.
- `vssharp/extensions/vssharp-runner/src/launch-settings.ts`: VS Code filesystem discovery wrapper around `profile-resolver.ts`.
- `vssharp/extensions/vssharp-runner/src/main.ts`: Command wiring, active-file command behavior, and profile picking.
- `vssharp/extensions/vssharp-runner/src/profile-runner.ts`: Build/run/debug flow, MSBuild target path lookup, debug config creation, and session transitions.
- `vssharp/extensions/vssharp-runner/src/session-manager.ts`: Session status type expansion and status update support.
- `vssharp/extensions/vssharp-runner/src/profile-tree.ts`: Tree context and labels based on expanded session states.
- `vssharp/extensions/vssharp-runner/src/running-status-bar.ts`: Status bar wording for running/debugging/building states.
- `vssharp/extensions/vssharp-runner/test/*.test.ts`: Node unit tests for pure runner logic.
- `vssharp/extensions/vssharp-runner/test/fixtures/*`: Fixture project files and launch settings.
- `vssharp/extensions/vssharp-runner/tsconfig.test.json`: Test TypeScript build config.
- `vssharp/extensions/vssharp-runner/package.json`: Add `test` script and fix keybindings.
- `.github/workflows/build-vssharp-windows.yml`: Compile runner, explorer, icons, and run runner tests.
- `.gitignore`: Ignore `vssharp/extensions/*/out-test/`.

## Task 1: Add Runner Test Harness

**Files:**
- Modify: `vssharp/extensions/vssharp-runner/package.json`
- Create: `vssharp/extensions/vssharp-runner/tsconfig.test.json`
- Create: `vssharp/extensions/vssharp-runner/test/profile-resolver.test.ts`
- Create: `vssharp/extensions/vssharp-runner/test/fixtures/simple-web-api/Properties/launchSettings.json`
- Create: `vssharp/extensions/vssharp-runner/test/fixtures/simple-web-api/SimpleWebApi.csproj`
- Modify: `.gitignore`

- [ ] **Step 1: Write the failing resolver test**

```ts
import { strict as assert } from 'node:assert';
import test from 'node:test';
import path from 'node:path';
import {
  createProfileEntries,
  runnableProfiles,
  splitCommandLineArgs,
} from '../src/profile-resolver';

const root = path.resolve(__dirname, 'fixtures', 'simple-web-api');

test('runnableProfiles returns only supported Project profiles', () => {
  const entries = createProfileEntries({
    launchSettingsPath: path.join(root, 'Properties', 'launchSettings.json'),
    projectPath: path.join(root, 'SimpleWebApi.csproj'),
    profiles: {
      Http: { commandName: 'Project' },
      Docker: { commandName: 'Docker' },
    },
  });

  const runnable = runnableProfiles(entries);

  assert.deepEqual(runnable.map(p => p.profileName), ['Http']);
  assert.equal(entries.find(e => e.profileName === 'Docker')?.status, 'unsupportedCommand');
});

test('splitCommandLineArgs preserves quoted values', () => {
  assert.deepEqual(splitCommandLineArgs('--name "Ada Lovelace" --flag'), ['--name', 'Ada Lovelace', '--flag']);
});
```

- [ ] **Step 2: Add test script and config**

`package.json` scripts:

```json
"test": "tsc -p tsconfig.test.json && node --test out-test/test/**/*.test.js"
```

`tsconfig.test.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": "out-test",
    "sourceMap": false
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "extension", "out", "out-test"]
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`

Expected: FAIL because `../src/profile-resolver` does not exist.

- [ ] **Step 4: Commit**

```bash
git add .gitignore vssharp/extensions/vssharp-runner/package.json vssharp/extensions/vssharp-runner/tsconfig.test.json vssharp/extensions/vssharp-runner/test
git commit -m "test: add vssharp runner test harness"
```

## Task 2: Implement Pure Profile Resolver

**Files:**
- Create: `vssharp/extensions/vssharp-runner/src/profile-resolver.ts`
- Modify: `vssharp/extensions/vssharp-runner/test/profile-resolver.test.ts`
- Modify: `vssharp/extensions/vssharp-runner/src/launch-settings.ts`
- Modify: `vssharp/extensions/vssharp-runner/src/profile-store.ts`

- [ ] **Step 1: Extend failing tests for active-file mapping and selection**

Add tests:

```ts
import {
  findProjectForFile,
  selectedForProject,
} from '../src/profile-resolver';

test('findProjectForFile returns the most specific owning project', () => {
  const parent = makeProfile('Parent', path.join(root, 'Parent.csproj'), path.join(root));
  const childDir = path.join(root, 'src', 'Child');
  const child = makeProfile('Child', path.join(childDir, 'Child.csproj'), childDir);

  const match = findProjectForFile([parent, child], path.join(childDir, 'Controllers', 'Home.cs'));

  assert.equal(match?.projectName, 'Child');
});

test('selectedForProject returns saved project profile or first project profile', () => {
  const profiles = [
    makeProfile('Http', path.join(root, 'SimpleWebApi.csproj'), root),
    makeProfile('Https', path.join(root, 'SimpleWebApi.csproj'), root),
  ];

  assert.equal(selectedForProject(profiles, profiles[0].projectPath, 'Https')?.profileName, 'Https');
  assert.equal(selectedForProject(profiles, profiles[0].projectPath, 'Missing')?.profileName, 'Http');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because resolver functions are not implemented.

- [ ] **Step 3: Implement minimal resolver**

Implement:

```ts
export type ProfileStatus = 'supported' | 'unsupportedCommand' | 'missingProjectFile' | 'invalidLaunchSettings';
export interface LaunchProfile { commandName: 'Project' | 'Executable' | 'IISExpress' | 'IIS' | 'Docker' | string; ... }
export interface ProjectProfile { projectPath: string; projectName: string; projectDir: string; profileName: string; profile: LaunchProfile; launchSettingsPath: string; }
export interface ProfileDiscoveryEntry { status: ProfileStatus; reason?: string; profileName?: string; profile?: LaunchProfile; project?: ProjectProfile; launchSettingsPath: string; }
export function createProfileEntries(...): ProfileDiscoveryEntry[] { ... }
export function runnableProfiles(entries: readonly ProfileDiscoveryEntry[]): ProjectProfile[] { ... }
export function findProjectForFile(profiles: readonly ProjectProfile[], filePath: string): ProjectProfile | undefined { ... }
export function selectedForProject(profiles: readonly ProjectProfile[], projectPath: string, selectedProfileName?: string): ProjectProfile | undefined { ... }
export function splitCommandLineArgs(s?: string): string[] { ... }
```

Use case-insensitive path comparison on Windows by normalizing paths with `path.resolve()` and lower-casing only when `process.platform === 'win32'`.

- [ ] **Step 4: Wire existing modules**

Update `launch-settings.ts` to import/re-export `LaunchProfile`, `ProjectProfile`, `createProfileEntries`, `runnableProfiles`, `findProjectForFile`, and `splitCommandLineArgs`.

Update `ProfileStore.selectedForProject()` to delegate to resolver `selectedForProject()`.

- [ ] **Step 5: Run tests and compile**

Run:

```bash
npm test
npm run compile
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add vssharp/extensions/vssharp-runner/src/profile-resolver.ts vssharp/extensions/vssharp-runner/src/launch-settings.ts vssharp/extensions/vssharp-runner/src/profile-store.ts vssharp/extensions/vssharp-runner/test/profile-resolver.test.ts
git commit -m "feat: add vssharp runner profile resolver"
```

## Task 3: Fix Active-File Commands and Keybindings

**Files:**
- Modify: `vssharp/extensions/vssharp-runner/package.json`
- Modify: `vssharp/extensions/vssharp-runner/src/main.ts`
- Modify: `vssharp/extensions/vssharp-runner/test/profile-resolver.test.ts`

- [ ] **Step 1: Add failing resolver test for no unrelated fallback**

Add a pure test that demonstrates project lookup returns `undefined` when no profile owns the file path.

- [ ] **Step 2: Run tests to verify the new test fails or documents current gap**

Run: `npm test`

Expected: FAIL until path normalization and no-match behavior are correct.

- [ ] **Step 3: Fix keybindings**

Change:

```json
{ "command": "vssharp.runner.debugActive", "key": "f5", "when": "vssharp.runner.hasProfiles && !inDebugMode && editorTextFocus" },
{ "command": "vssharp.runner.runActive", "key": "ctrl+f5", "when": "vssharp.runner.hasProfiles && !inDebugMode && editorTextFocus" },
{ "command": "vssharp.runner.runActive", "key": "cmd+f5", "when": "vssharp.runner.hasProfiles && !inDebugMode && editorTextFocus && isMac", "mac": "cmd+f5" }
```

- [ ] **Step 4: Remove silent global fallback from active-file commands**

In `runForActiveEditor()`:

- If there is no active editor, show `No active editor file to run.`
- If no supported profile owns the active file, show `No supported Project launch profile found for active file.`
- If a profile owns the file, use the selected profile for that same project or the first supported profile in that project.
- Keep command palette `run` and `debug` fallback behavior in `withProfile()`.

- [ ] **Step 5: Run tests and compile**

Run:

```bash
npm test
npm run compile
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add vssharp/extensions/vssharp-runner/package.json vssharp/extensions/vssharp-runner/src/main.ts vssharp/extensions/vssharp-runner/test/profile-resolver.test.ts
git commit -m "fix: run active file profile from keybindings"
```

## Task 4: Resolve Debug Assembly Through MSBuild TargetPath

**Files:**
- Create: `vssharp/extensions/vssharp-runner/src/msbuild-output.ts`
- Create: `vssharp/extensions/vssharp-runner/test/msbuild-output.test.ts`
- Modify: `vssharp/extensions/vssharp-runner/src/profile-runner.ts`

- [ ] **Step 1: Write failing MSBuild output tests**

Test:

- `parseTargetFrameworkFromProjectXml()` returns `net8.0` for `<TargetFramework>net8.0</TargetFramework>`.
- It returns the first value for `<TargetFrameworks>net8.0;net9.0</TargetFrameworks>`.
- `buildTargetPathArgs()` includes `-getProperty:TargetPath`, `-p:Configuration=Debug`, and `-p:TargetFramework=net8.0`.
- `parseMsbuildPropertyOutput()` trims output and returns the last non-empty line.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`

Expected: FAIL because `msbuild-output.ts` does not exist.

- [ ] **Step 3: Implement minimal MSBuild helpers**

Implement:

```ts
export function parseTargetFrameworkFromProjectXml(xml: string): string | undefined;
export function buildTargetPathArgs(projectPath: string, configuration: string, targetFramework?: string): string[];
export function parseMsbuildPropertyOutput(stdout: string): string | undefined;
export async function resolveTargetPath(options: { dotnetPath: string; projectPath: string; configuration: string; targetFramework?: string; cwd: string; }): Promise<string | undefined>;
```

Use `child_process.execFile` for `resolveTargetPath()`.

- [ ] **Step 4: Update debug flow**

In `ProfileRunner.debug()`:

- Set session status to `building` before build.
- After build succeeds, read the project XML, select target framework, call `resolveTargetPath()`, and verify the returned file exists.
- Fail with `Cannot resolve output DLL from MSBuild metadata.` when path lookup fails.
- Pass the resolved path into debug config.

- [ ] **Step 5: Run tests and compile**

Run:

```bash
npm test
npm run compile
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add vssharp/extensions/vssharp-runner/src/msbuild-output.ts vssharp/extensions/vssharp-runner/src/profile-runner.ts vssharp/extensions/vssharp-runner/test/msbuild-output.test.ts
git commit -m "fix: resolve debug assembly from msbuild target path"
```

## Task 5: Expand Session State

**Files:**
- Modify: `vssharp/extensions/vssharp-runner/src/session-manager.ts`
- Modify: `vssharp/extensions/vssharp-runner/src/profile-runner.ts`
- Modify: `vssharp/extensions/vssharp-runner/src/profile-tree.ts`
- Modify: `vssharp/extensions/vssharp-runner/src/running-status-bar.ts`

- [ ] **Step 1: Update session status model**

Change `SessionStatus` to:

```ts
export type SessionStatus = 'idle' | 'building' | 'running' | 'debugging' | 'failed' | 'stopped';
```

Add optional `message?: string` to `Session`.

- [ ] **Step 2: Update runner transitions**

- Run starts with `running`.
- Debug starts with `building`, then `debugging` on debug session start.
- Build/debug launch failures update to `failed` with a short message instead of removing the session immediately.
- Manual stop updates to `stopped`.
- Task/debug natural termination clears or stops consistently.

- [ ] **Step 3: Update UI derivation**

- Treat `running`, `debugging`, and `building` as active.
- Show `failed` with error icon and tooltip message.
- Show `stopped` as inactive.
- Stop command appears only for `running`, `debugging`, and `building`.

- [ ] **Step 4: Run compile**

Run: `npm run compile`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add vssharp/extensions/vssharp-runner/src/session-manager.ts vssharp/extensions/vssharp-runner/src/profile-runner.ts vssharp/extensions/vssharp-runner/src/profile-tree.ts vssharp/extensions/vssharp-runner/src/running-status-bar.ts
git commit -m "feat: expose vssharp runner session states"
```

## Task 6: Add CI Compile and Test Coverage

**Files:**
- Modify: `.github/workflows/build-vssharp-windows.yml`

- [ ] **Step 1: Add runner tests to CI**

After runner `npm install --prefer-offline`, run:

```bash
npm test
npm run compile
```

- [ ] **Step 2: Add icons compile to CI**

Add a build step:

```yaml
- name: Build vssharp-icons
  run: |
    cd vssharp/extensions/vssharp-icons
    npm install --prefer-offline
    npm run compile
```

- [ ] **Step 3: Run local compile checks**

Run:

```bash
cd vssharp/extensions/vssharp-runner && npm test && npm run compile
cd ../vssharp-explorer && npm run compile
cd ../vssharp-icons && npm run compile
```

Expected: all pass. If dependencies are missing and network is unavailable, report that verification is blocked by dependency installation.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/build-vssharp-windows.yml
git commit -m "ci: compile and test vssharp extensions"
```
