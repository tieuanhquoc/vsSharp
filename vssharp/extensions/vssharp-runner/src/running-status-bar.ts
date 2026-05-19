import * as vscode from 'vscode';
import { SessionManager } from './session-manager';

const PURPLE_FG = new vscode.ThemeColor('vssharpRunner.statusBarForeground');

export class RunningStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly subs: vscode.Disposable[] = [];

  constructor(private readonly sessions: SessionManager) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 95);
    this.item.command = 'vssharp.runner.showRunning';
    this.item.color = PURPLE_FG;
    this.subs.push(this.sessions.onDidChange(() => this.render()));
    this.render();
  }

  private render(): void {
    const active = this.sessions.getActive();
    if (active.length === 0) {
      this.item.hide();
      return;
    }
    const hasDebug = active.some(s => s.kind === 'debug');
    this.item.text = `$(${hasDebug ? 'debug-alt' : 'play-circle'}) ${active.length} running`;
    this.item.tooltip = active.map(s => `${s.profile.projectName} • ${s.profile.profileName} (${s.kind})`).join('\n');
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
    this.subs.forEach(d => d.dispose());
  }
}
