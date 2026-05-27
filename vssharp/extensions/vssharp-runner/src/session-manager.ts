import * as vscode from 'vscode';
import { ProjectProfile } from './launch-settings';
import { keyOf } from './profile-store';
import { isActiveSessionStatus, SessionKind, SessionStatus } from './session-state';

export { SessionKind, SessionStatus } from './session-state';

export interface Session {
  profile: ProjectProfile;
  kind: SessionKind;
  status: SessionStatus;
  startedAt: Date;
  message?: string;
  taskExecution?: vscode.TaskExecution;
  debugSession?: vscode.DebugSession;
}

export class SessionManager implements vscode.Disposable {
  private readonly sessions = new Map<string, Session>();
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  register(s: Session): void {
    this.sessions.set(keyOf(s.profile), s);
    this._onDidChange.fire();
  }

  update(profileKey: string, patch: Partial<Session>): void {
    const cur = this.sessions.get(profileKey);
    if (!cur) return;
    Object.assign(cur, patch);
    this._onDidChange.fire();
  }

  remove(profileKey: string): void {
    if (this.sessions.delete(profileKey)) this._onDidChange.fire();
  }

  get(profileKey: string): Session | undefined {
    return this.sessions.get(profileKey);
  }

  getAll(): Session[] {
    return [...this.sessions.values()];
  }

  getActive(): Session[] {
    return [...this.sessions.values()].filter(s => isActiveSessionStatus(s.status));
  }

  dispose(): void { this._onDidChange.dispose(); }
}
