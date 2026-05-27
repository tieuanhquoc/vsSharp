import * as vscode from 'vscode';
import { ProjectProfile, profileLabel } from './launch-settings';
import { selectedForProject as resolveSelectedForProject } from './profile-resolver';

const KEY_GLOBAL = 'vssharp.runner.selectedProfile';
const KEY_PER_PROJECT = 'vssharp.runner.selectedPerProject';

export class ProfileStore {
  private _profiles: ProjectProfile[] = [];
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private readonly state: vscode.Memento) {}

  get profiles(): readonly ProjectProfile[] { return this._profiles; }

  setProfiles(list: ProjectProfile[]): void {
    this._profiles = list;
    const cur = this.selectedKey;
    if (cur && !this._profiles.some(p => keyOf(p) === cur)) {
      void this.state.update(KEY_GLOBAL, undefined);
    }
    this._onDidChange.fire();
  }

  get selected(): ProjectProfile | undefined {
    const key = this.selectedKey;
    if (!key) return this._profiles[0];
    return this._profiles.find(p => keyOf(p) === key) ?? this._profiles[0];
  }

  get selectedKey(): string | undefined {
    return this.state.get<string>(KEY_GLOBAL);
  }

  /** Return previously-selected profile for a specific project, else first. */
  selectedForProject(projectPath: string): ProjectProfile | undefined {
    const map = this.perProjectMap;
    const name = map[projectPath];
    return resolveSelectedForProject(this._profiles, projectPath, name);
  }

  selectedProfileNameForProject(projectPath: string): string | undefined {
    return this.perProjectMap[projectPath];
  }

  async select(p: ProjectProfile): Promise<void> {
    await this.state.update(KEY_GLOBAL, keyOf(p));
    const map = { ...this.perProjectMap, [p.projectPath]: p.profileName };
    await this.state.update(KEY_PER_PROJECT, map);
    this._onDidChange.fire();
  }

  private get perProjectMap(): Record<string, string> {
    return this.state.get<Record<string, string>>(KEY_PER_PROJECT) ?? {};
  }

  dispose(): void { this._onDidChange.dispose(); }
}

export function keyOf(p: ProjectProfile): string {
  return `${p.projectPath}::${p.profileName}`;
}

export function describeProfile(p: ProjectProfile, isSelected = false): vscode.QuickPickItem {
  const detailParts: string[] = [];
  if (p.profile.commandName) detailParts.push(p.profile.commandName);
  if (p.profile.applicationUrl) detailParts.push(p.profile.applicationUrl);
  return {
    label: isSelected ? `$(check) ${profileLabel(p)}` : `      ${profileLabel(p)}`,
    description: p.profile.environmentVariables?.ASPNETCORE_ENVIRONMENT,
    detail: detailParts.join(' · '),
  };
}
