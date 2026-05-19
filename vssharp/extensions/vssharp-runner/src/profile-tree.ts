import * as vscode from 'vscode';
import { ProjectProfile } from './launch-settings';
import { ProfileStore, keyOf } from './profile-store';
import { SessionManager, Session } from './session-manager';

type Node = ProjectNode | ProfileNode;

class ProjectNode {
  readonly kind = 'project' as const;
  constructor(
    readonly name: string,
    readonly path: string,
    readonly profiles: ProjectProfile[],
    readonly runningCount: number,
  ) {}
}

class ProfileNode {
  readonly kind = 'profile' as const;
  constructor(
    readonly profile: ProjectProfile,
    readonly session: Session | undefined,
    readonly isSelected: boolean,
  ) {}
}

export class ProfileTreeProvider implements vscode.TreeDataProvider<Node>, vscode.Disposable {
  private readonly _onDidChange = new vscode.EventEmitter<void | Node | Node[] | null>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private readonly subs: vscode.Disposable[] = [];

  constructor(private readonly store: ProfileStore, private readonly sessions: SessionManager) {
    this.subs.push(
      this.store.onDidChange(() => this._onDidChange.fire()),
      this.sessions.onDidChange(() => this._onDidChange.fire()),
    );
  }

  getTreeItem(node: Node): vscode.TreeItem {
    return node.kind === 'project' ? this.buildProjectItem(node) : this.buildProfileItem(node);
  }

  getChildren(parent?: Node): Node[] {
    if (!parent) return this.buildProjectNodes();
    if (parent.kind === 'project') return this.buildProfileNodes(parent);
    return [];
  }

  // ---------- builders ----------

  private buildProjectNodes(): ProjectNode[] {
    const groups = new Map<string, ProjectProfile[]>();
    for (const p of this.store.profiles) {
      const list = groups.get(p.projectPath) ?? [];
      list.push(p);
      groups.set(p.projectPath, list);
    }
    const nodes: ProjectNode[] = [];
    for (const [projectPath, profiles] of groups) {
      const running = profiles.filter(p => {
        const s = this.sessions.get(keyOf(p));
        return s && s.status !== 'stopped';
      }).length;
      nodes.push(new ProjectNode(profiles[0].projectName, projectPath, profiles, running));
    }
    return nodes;
  }

  private buildProfileNodes(parent: ProjectNode): ProfileNode[] {
    const selKey = this.store.selectedKey;
    return parent.profiles.map(p =>
      new ProfileNode(p, this.sessions.get(keyOf(p)), keyOf(p) === selKey));
  }

  private buildProjectItem(n: ProjectNode): vscode.TreeItem {
    const item = new vscode.TreeItem(n.name, vscode.TreeItemCollapsibleState.Expanded);
    item.iconPath = n.runningCount > 0
      ? new vscode.ThemeIcon('package', new vscode.ThemeColor('testing.iconPassed'))
      : new vscode.ThemeIcon('package');
    item.contextValue = 'vssharp.project';
    item.tooltip = new vscode.MarkdownString(
      `**${n.name}**\n\n` +
      `Path: \`${n.path}\`\n\n` +
      `Profiles: ${n.profiles.length}` +
      (n.runningCount > 0 ? ` · 🟢 **${n.runningCount} running**` : ''));
    item.description = n.runningCount > 0
      ? `▶ ${n.runningCount} running · ${n.profiles.length} profiles`
      : `${n.profiles.length} profiles`;
    return item;
  }

  private buildProfileItem(n: ProfileNode): vscode.TreeItem {
    const label = this.labelFor(n);
    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
    item.iconPath = this.iconFor(n);
    item.description = this.descriptionFor(n);
    item.contextValue = this.contextFor(n);
    item.tooltip = this.tooltipFor(n);
    item.command = {
      command: 'vssharp.runner.selectProfileFromTree',
      title: 'Select Profile',
      arguments: [n],
    };
    return item;
  }

  // ---------- presentation helpers ----------

  private labelFor(n: ProfileNode): string {
    return n.profile.profileName;
  }

  private iconFor(n: ProfileNode): vscode.ThemeIcon {
    if (n.session && n.session.status !== 'stopped') {
      const color = n.session.kind === 'debug'
        ? new vscode.ThemeColor('debugIcon.startForeground')
        : new vscode.ThemeColor('testing.iconPassed');
      const icon = n.session.kind === 'debug' ? 'debug-alt' : 'play-circle';
      return new vscode.ThemeIcon(icon, color);
    }
    if (n.isSelected) {
      return new vscode.ThemeIcon('star-full', new vscode.ThemeColor('vssharpRunner.statusBarForeground'));
    }
    return new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('descriptionForeground'));
  }

  private descriptionFor(n: ProfileNode): string {
    const parts: string[] = [];
    if (n.session && n.session.status !== 'stopped') {
      const mins = Math.max(1, Math.round((Date.now() - n.session.startedAt.getTime()) / 60000));
      parts.push(`${n.session.kind === 'debug' ? '🐞' : '▶'} ${mins}m`);
    }
    const env = n.profile.profile.environmentVariables?.ASPNETCORE_ENVIRONMENT;
    if (env) parts.push(env);
    if (n.profile.profile.applicationUrl) {
      const firstUrl = n.profile.profile.applicationUrl.split(';')[0];
      parts.push(firstUrl);
    }
    return parts.join(' · ');
  }

  private contextFor(n: ProfileNode): string {
    if (n.session && n.session.kind === 'run' && n.session.status !== 'stopped') return 'vssharp.profile.running';
    if (n.session && n.session.kind === 'debug' && n.session.status !== 'stopped') return 'vssharp.profile.debugging';
    return 'vssharp.profile.idle';
  }

  private tooltipFor(n: ProfileNode): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${n.profile.projectName} • ${n.profile.profileName}**\n\n`);
    md.appendMarkdown(`Command: \`${n.profile.profile.commandName ?? 'Project'}\`\n\n`);
    if (n.profile.profile.applicationUrl) md.appendMarkdown(`URLs: \`${n.profile.profile.applicationUrl}\`\n\n`);
    const env = n.profile.profile.environmentVariables;
    if (env && Object.keys(env).length > 0) {
      md.appendMarkdown(`**Environment**:\n`);
      for (const [k, v] of Object.entries(env)) md.appendMarkdown(`- \`${k}\` = \`${v}\`\n`);
    }
    if (n.session) {
      md.appendMarkdown(`\n---\n🟢 **${n.session.kind} since ${n.session.startedAt.toLocaleTimeString()}**`);
    }
    return md;
  }

  dispose(): void { this._onDidChange.dispose(); this.subs.forEach(d => d.dispose()); }
}
