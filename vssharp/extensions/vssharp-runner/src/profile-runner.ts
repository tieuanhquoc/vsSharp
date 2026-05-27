import * as vscode from 'vscode';
import { ProjectProfile } from './launch-settings';
import { keyOf } from './profile-store';
import { SessionManager } from './session-manager';
import { parseTargetFrameworkFromProjectXml, resolveTargetPath } from './msbuild-output';
import { splitCommandLineArgs } from './profile-resolver';
import { isActiveSessionStatus } from './session-state';

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
    if (existing && isActiveSessionStatus(existing.status)) {
      vscode.window.showInformationMessage(`${p.profileName} is already running. Stop it first.`);
      return;
    }

    const task = this.buildRunTask(p);
    const execution = await vscode.tasks.executeTask(task);
    this.sessions.register({
      profile: p,
      kind: 'run',
      status: 'running',
      startedAt: new Date(),
      taskExecution: execution,
    });
  }

  async debug(p: ProjectProfile): Promise<void> {
    const existing = this.sessions.get(keyOf(p));
    if (existing && isActiveSessionStatus(existing.status)) {
      vscode.window.showInformationMessage(`${p.profileName} is already running. Stop it first.`);
      return;
    }

    const wsFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p.projectPath));
    if (!wsFolder) {
      vscode.window.showErrorMessage('Project is outside the current workspace.');
      return;
    }

    this.sessions.register({ profile: p, kind: 'debug', status: 'building', startedAt: new Date() });

    const built = await this.runBuildTask(p);
    if (!built) {
      const message = `Build failed. See terminal: Build ${p.projectName}.`;
      this.fail(p, message);
      vscode.window.showErrorMessage(message);
      return;
    }

    let projectXml: string;
    try {
      projectXml = await this.readProjectXml(p.projectPath);
    } catch {
      const message = 'Cannot resolve output DLL from MSBuild metadata.';
      this.fail(p, message);
      vscode.window.showErrorMessage(message);
      return;
    }

    const tf = parseTargetFrameworkFromProjectXml(projectXml);
    if (!tf) {
      const message = `No <TargetFramework> in ${p.projectName}.csproj`;
      this.fail(p, message);
      vscode.window.showErrorMessage(message);
      return;
    }

    const program = await resolveTargetPath({
      dotnetPath: this.getDotnet(),
      projectPath: p.projectPath,
      configuration: this.getConfiguration(),
      targetFramework: tf,
      cwd: p.projectDir,
    });
    if (!program || !(await this.fileExists(program))) {
      const message = 'Cannot resolve output DLL from MSBuild metadata.';
      this.fail(p, message);
      vscode.window.showErrorMessage(message);
      return;
    }

    const config = this.buildDebugConfig(p, program);
    const ok = await vscode.debug.startDebugging(wsFolder, config);
    if (!ok) {
      const message = `Failed to start debug for ${p.profileName}`;
      this.fail(p, message);
      vscode.window.showErrorMessage(message);
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

    this.sessions.update(profileKey, { status: 'stopped', message: 'Stopped.' });
  }

  private onTaskEnded(e: vscode.TaskProcessEndEvent): void {
    for (const s of this.sessions.getAll()) {
      if (s.taskExecution !== e.execution) continue;
      if (s.status === 'stopped') break;
      this.sessions.update(keyOf(s.profile), e.exitCode === 0
        ? { status: 'stopped', message: 'Stopped.' }
        : { status: 'failed', message: `Run failed with exit code ${e.exitCode ?? 'unknown'}.` });
      break;
    }
  }

  private onDebugStarted(ds: vscode.DebugSession): void {
    for (const s of this.sessions.getAll()) {
      if (s.kind !== 'debug' || s.status !== 'building') continue;
      if (ds.name === this.debugName(s.profile)) {
        this.sessions.update(keyOf(s.profile), { status: 'debugging', debugSession: ds, message: undefined });
        break;
      }
    }
  }

  private onDebugTerminated(ds: vscode.DebugSession): void {
    for (const s of this.sessions.getAll()) {
      if (s.debugSession === ds) {
        this.sessions.update(keyOf(s.profile), { status: 'stopped', message: 'Stopped.' });
        break;
      }
    }
  }

  private fail(p: ProjectProfile, message: string): void {
    this.sessions.update(keyOf(p), { status: 'failed', message });
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
    if (p.profile.commandLineArgs) args.push('--', ...splitCommandLineArgs(p.profile.commandLineArgs));

    const exec = new vscode.ShellExecution(this.getDotnet(), args, {
      cwd: p.profile.workingDirectory ?? p.projectDir,
      env: { ...(p.profile.environmentVariables ?? {}) },
    });
    const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(p.projectPath)) ?? vscode.TaskScope.Workspace;
    const task = new vscode.Task(
      { type: 'vssharp-runner', profile: p.profileName, project: p.projectName },
      folder, this.debugName(p), 'VS Sharp', exec,
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

  private async readProjectXml(projectPath: string): Promise<string> {
    const buf = await vscode.workspace.fs.readFile(vscode.Uri.file(projectPath));
    return Buffer.from(buf).toString('utf8');
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      return true;
    } catch {
      return false;
    }
  }

  private buildDebugConfig(p: ProjectProfile, program: string): vscode.DebugConfiguration {
    return {
      type: 'coreclr',
      name: this.debugName(p),
      request: 'launch',
      program,
      args: splitCommandLineArgs(p.profile.commandLineArgs),
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

  private debugName(p: ProjectProfile): string {
    return `${p.projectName} \u2022 ${p.profileName}`;
  }

  dispose(): void { this.subs.forEach(d => d.dispose()); }
}
