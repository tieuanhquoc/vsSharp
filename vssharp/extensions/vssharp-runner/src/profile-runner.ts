import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectProfile, parseTargetFramework } from './launch-settings';
import { keyOf } from './profile-store';
import { Session, SessionManager } from './session-manager';

export class ProfileRunner implements vscode.Disposable {
  private readonly subs: vscode.Disposable[] = [];

  constructor(private readonly sessions: SessionManager) {
    this.subs.push(
      vscode.tasks.onDidEndTaskProcess(e => this.onTaskEnded(e)),
      vscode.debug.onDidStartDebugSession(s => this.onDebugStarted(s)),
      vscode.debug.onDidTerminateDebugSession(s => this.onDebugTerminated(s)),
    );
  }

  async run(p: ProjectProfile): Promise<void> {
    const existing = this.sessions.get(keyOf(p));
    if (existing && existing.status !== 'stopped') {
      vscode.window.showInformationMessage(`${p.profileName} is already running. Stop it first.`);
      return;
    }

    const task = this.buildRunTask(p);
    const execution = await vscode.tasks.executeTask(task);
    this.sessions.register({
      profile: p, kind: 'run', status: 'running',
      startedAt: new Date(), taskExecution: execution,
    });
  }

  async debug(p: ProjectProfile): Promise<void> {
    const existing = this.sessions.get(keyOf(p));
    if (existing && existing.status !== 'stopped') {
      vscode.window.showInformationMessage(`${p.profileName} is already running. Stop it first.`);
      return;
    }
    const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p.projectPath));
    if (!wsFolder) {
      vscode.window.showErrorMessage(`Project not in workspace: ${p.projectPath}`);
      return;
    }

    this.sessions.register({ profile: p, kind: 'debug', status: 'starting', startedAt: new Date() });

    const built = await this.runBuildTask(p);
    if (!built) {
      this.sessions.remove(keyOf(p));
      vscode.window.showErrorMessage('Build failed — debug aborted');
      return;
    }

    const tf = await parseTargetFramework(p.projectPath);
    if (!tf) {
      this.sessions.remove(keyOf(p));
      vscode.window.showErrorMessage(`No <TargetFramework> in ${p.projectName}.csproj`);
      return;
    }

    const program = path.join(p.projectDir, 'bin', this.getConfiguration(), tf, `${p.projectName}.dll`);
    const config = this.buildDebugConfig(p, program);
    const ok = await vscode.debug.startDebugging(wsFolder, config);
    if (!ok) {
      this.sessions.remove(keyOf(p));
      vscode.window.showErrorMessage(`Failed to start debug for ${p.profileName}`);
    }
  }

  async stop(profileKey: string): Promise<void> {
    const s = this.sessions.get(profileKey);
    if (!s) return;
    if (s.kind === 'debug' && s.debugSession) {
      await vscode.debug.stopDebugging(s.debugSession);
    } else if (s.kind === 'run' && s.taskExecution) {
      s.taskExecution.terminate();
    }
    // Cleanup happens in event handlers
  }

  // ---------- internals ----------

  private onTaskEnded(e: vscode.TaskProcessEndEvent): void {
    for (const s of this.sessions.getAll()) {
      if (s.taskExecution === e.execution) { this.sessions.remove(keyOf(s.profile)); break; }
    }
  }

  private onDebugStarted(ds: vscode.DebugSession): void {
    for (const s of this.sessions.getAll()) {
      if (s.kind !== 'debug' || s.status !== 'starting') continue;
      if (ds.name === `${s.profile.projectName} • ${s.profile.profileName}`) {
        this.sessions.update(keyOf(s.profile), { status: 'running', debugSession: ds });
        break;
      }
    }
  }

  private onDebugTerminated(ds: vscode.DebugSession): void {
    for (const s of this.sessions.getAll()) {
      if (s.debugSession === ds) { this.sessions.remove(keyOf(s.profile)); break; }
    }
  }

  private getDotnet(): string {
    return vscode.workspace.getConfiguration('vssharp.runner').get<string>('dotnetPath', 'dotnet');
  }

  private getConfiguration(): string {
    return vscode.workspace.getConfiguration('vssharp.runner').get<string>('configuration', 'Debug');
  }

  private buildRunTask(p: ProjectProfile): vscode.Task {
    const args = ['run', '--project', p.projectPath, '--launch-profile', p.profileName,
                  '--configuration', this.getConfiguration()];
    if (p.profile.commandLineArgs) args.push('--', p.profile.commandLineArgs);

    const exec = new vscode.ShellExecution(this.getDotnet(), args, {
      cwd: p.profile.workingDirectory ?? p.projectDir,
      env: { ...(p.profile.environmentVariables ?? {}) },
    });
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p.projectPath)) ?? vscode.TaskScope.Workspace;
    const task = new vscode.Task(
      { type: 'vssharp-runner', profile: p.profileName, project: p.projectName },
      folder, `${p.projectName} • ${p.profileName}`, 'VS Sharp', exec,
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Always, clear: true, panel: vscode.TaskPanelKind.Dedicated };
    return task;
  }

  private async runBuildTask(p: ProjectProfile): Promise<boolean> {
    const exec = new vscode.ShellExecution(this.getDotnet(),
      ['build', p.projectPath, '--configuration', this.getConfiguration(), '--nologo'],
      { cwd: p.projectDir });

    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p.projectPath)) ?? vscode.TaskScope.Workspace;
    const task = new vscode.Task(
      { type: 'vssharp-runner-build', project: p.projectName },
      folder, `Build ${p.projectName}`, 'VS Sharp', exec, '$msCompile',
    );
    task.presentationOptions = { reveal: vscode.TaskRevealKind.Silent, clear: false };

    const execution = await vscode.tasks.executeTask(task);
    return await new Promise<boolean>((resolve) => {
      const sub = vscode.tasks.onDidEndTaskProcess(e => {
        if (e.execution === execution) { sub.dispose(); resolve(e.exitCode === 0); }
      });
    });
  }

  private buildDebugConfig(p: ProjectProfile, program: string): vscode.DebugConfiguration {
    return {
      type: 'coreclr',
      name: `${p.projectName} • ${p.profileName}`,
      request: 'launch',
      program,
      args: this.splitArgs(p.profile.commandLineArgs),
      cwd: p.profile.workingDirectory ?? p.projectDir,
      stopAtEntry: false,
      console: 'internalConsole',
      env: this.mergeEnv(p),
      serverReadyAction: p.profile.launchBrowser ? {
        action: 'openExternally',
        pattern: '\\bNow listening on:\\s+(https?://\\S+)',
      } : undefined,
    };
  }

  private mergeEnv(p: ProjectProfile): Record<string, string> {
    const base: Record<string, string> = { ...(p.profile.environmentVariables ?? {}) };
    if (p.profile.applicationUrl) base.ASPNETCORE_URLS = p.profile.applicationUrl;
    return base;
  }

  private splitArgs(s?: string): string[] {
    if (!s) return [];
    const out: string[] = [];
    const re = /"([^"]*)"|(\S+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) out.push(m[1] ?? m[2]);
    return out;
  }

  dispose(): void { this.subs.forEach(d => d.dispose()); }
}
