import * as vscode from 'vscode';
import { discoverProjectProfiles, ProjectProfile, profileLabel, findProjectByFile } from './launch-settings';
import { ProfileStore, describeProfile, keyOf } from './profile-store';
import { ProfileRunner } from './profile-runner';
import { SessionManager } from './session-manager';
import { ProfileTreeProvider } from './profile-tree';
import { RunningStatusBar } from './running-status-bar';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const store = new ProfileStore(ctx.workspaceState);
  const sessions = new SessionManager();
  const runner = new ProfileRunner(sessions);
  const tree = new ProfileTreeProvider(store, sessions);
  const statusBar = new RunningStatusBar(sessions);

  ctx.subscriptions.push(store, sessions, runner, tree, statusBar);
  ctx.subscriptions.push(vscode.window.registerTreeDataProvider('vssharp.runner.profiles', tree));

  // Update hasProfiles context so menus appear
  const updateCtx = () => vscode.commands.executeCommand(
    'setContext', 'vssharp.runner.hasProfiles', store.profiles.length > 0);
  ctx.subscriptions.push(store.onDidChange(updateCtx));

  const refresh = async () => {
    const list = await discoverProjectProfiles();
    store.setProfiles(list);
  };

  const watcher = vscode.workspace.createFileSystemWatcher('**/Properties/launchSettings.json');
  watcher.onDidCreate(() => refresh());
  watcher.onDidChange(() => refresh());
  watcher.onDidDelete(() => refresh());
  ctx.subscriptions.push(watcher);

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => refresh()),
    vscode.commands.registerCommand('vssharp.runner.refresh', () => refresh()),
    vscode.commands.registerCommand('vssharp.runner.selectProfile', () => selectProfile(store)),
    vscode.commands.registerCommand('vssharp.runner.selectProfileFromTree', async (arg: any) => {
      const p = unwrapProfile(arg);
      if (p) await store.select(p);
    }),
    vscode.commands.registerCommand('vssharp.runner.run',   (arg?: any) => withProfile(store, unwrapProfile(arg), x => runner.run(x))),
    vscode.commands.registerCommand('vssharp.runner.debug', (arg?: any) => withProfile(store, unwrapProfile(arg), x => runner.debug(x))),
    vscode.commands.registerCommand('vssharp.runner.runActive',   () => runForActiveEditor(store, runner, 'run')),
    vscode.commands.registerCommand('vssharp.runner.debugActive', () => runForActiveEditor(store, runner, 'debug')),
    vscode.commands.registerCommand('vssharp.runner.stop',  (arg: any) => {
      const p = unwrapProfile(arg);
      if (p) return runner.stop(keyOf(p));
    }),
    vscode.commands.registerCommand('vssharp.runner.stopAll', async () => {
      for (const s of sessions.getActive()) await runner.stop(keyOf(s.profile));
    }),
    vscode.commands.registerCommand('vssharp.runner.showRunning', () => showRunningPicker(sessions, runner)),
  );

  await refresh();
}

export function deactivate(): void { /* no-op */ }

async function withProfile(
  store: ProfileStore,
  passedIn: ProjectProfile | undefined,
  fn: (p: ProjectProfile) => Promise<void>,
): Promise<void> {
  let p = passedIn ?? store.selected;
  if (!p) {
    p = await pickProfile(store);
    if (!p) return;
    await store.select(p);
  }
  try { await fn(p); }
  catch (err: any) { vscode.window.showErrorMessage(`VS Sharp Runner: ${err?.message ?? err}`); }
}

/**
 * Editor toolbar handler: auto-detect project from focused file.
 * Falls back to globally selected profile if file is outside any project.
 */
async function runForActiveEditor(
  store: ProfileStore,
  runner: import('./profile-runner').ProfileRunner,
  kind: 'run' | 'debug',
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  let target: ProjectProfile | undefined;

  if (editor) {
    const match = findProjectByFile(store.profiles, editor.document.uri.fsPath);
    if (match) {
      target = store.selectedForProject(match.projectPath) ?? match;
    }
  }
  target = target ?? store.selected;
  if (!target) {
    vscode.window.showInformationMessage('No profile available. Open a .NET project with Properties/launchSettings.json.');
    return;
  }
  try {
    if (kind === 'run') await runner.run(target);
    else await runner.debug(target);
  } catch (err: any) {
    vscode.window.showErrorMessage(`VS Sharp Runner: ${err?.message ?? err}`);
  }
}

async function selectProfile(store: ProfileStore): Promise<void> {
  const picked = await pickProfile(store);
  if (picked) {
    await store.select(picked);
    vscode.window.setStatusBarMessage(`$(rocket) VS Sharp: ${profileLabel(picked)}`, 3000);
  }
}

async function pickProfile(store: ProfileStore): Promise<ProjectProfile | undefined> {
  const profiles = store.profiles;
  if (profiles.length === 0) {
    vscode.window.showInformationMessage('No launchSettings.json profiles found in workspace.');
    return undefined;
  }
  const currentKey = store.selectedKey ?? (profiles[0] && keyOf(profiles[0]));
  const items = profiles.map(p => ({
    ...describeProfile(p, keyOf(p) === currentKey),
    _profile: p,
  }));
  const current = store.selected;
  const choice = await vscode.window.showQuickPick(items, {
    title: current ? `Current: ${profileLabel(current)}` : 'Select a launch profile',
    placeHolder: 'Pick the launch profile for Run / Debug',
    matchOnDescription: true,
    matchOnDetail: true,
  });
  return choice?._profile;
}

/**
 * Tree items invoke commands with the tree element as arg.
 * Our tree elements are ProjectNode / ProfileNode (have .kind).
 * Editor toolbar / palette invokes with no arg.
 */
function unwrapProfile(arg: any): ProjectProfile | undefined {
  if (!arg) return undefined;
  if (arg.kind === 'profile' && arg.profile) return arg.profile as ProjectProfile;
  if (arg.kind === 'project') return undefined;  // can't run a project group directly
  // Raw ProjectProfile passed in
  if (typeof arg.profileName === 'string' && typeof arg.projectPath === 'string') {
    return arg as ProjectProfile;
  }
  return undefined;
}

async function showRunningPicker(sessions: SessionManager, runner: ProfileRunner): Promise<void> {
  const active = sessions.getActive();
  if (active.length === 0) {
    vscode.window.showInformationMessage('No running sessions.');
    return;
  }
  const items = active.map(s => ({
    label: `$(${s.kind === 'debug' ? 'debug-alt' : 'play-circle'}) ${profileLabel(s.profile)}`,
    description: s.kind,
    detail: `Started ${s.startedAt.toLocaleTimeString()}`,
    _session: s,
  }));
  const choice = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a running session to stop',
  });
  if (choice) await runner.stop(keyOf(choice._session.profile));
}
