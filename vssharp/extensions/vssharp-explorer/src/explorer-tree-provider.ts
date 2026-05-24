import * as vscode from 'vscode';
import * as path from 'path';
import { FsNode, listDirectory, listWorkspaceRoots } from './file-system';
import { SolutionData, SolutionProject, findSolutionFiles, parseSolution } from './sln-parser';
type Tab = 'solution' | 'files';

interface IconPair { light: vscode.Uri; dark: vscode.Uri }
interface IconsApi {
  resolveKind(kind: 'solution' | 'project' | 'solution-folder'): IconPair | undefined;
  resolveFolder(name: string): IconPair | undefined;
  resolveFile(name: string): IconPair | undefined;
}

export type TreeNode =
  | { kind: 'solution'; sln: SolutionData }
  | { kind: 'solution-folder'; proj: SolutionProject; allProjects: SolutionProject[]; slnFilePath: string }
  | { kind: 'project'; proj: SolutionProject }
  | { kind: 'fs'; node: FsNode };

export class ExplorerTreeProvider implements vscode.TreeDataProvider<TreeNode>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tab: Tab;
  private showAll = false;
  private treeView?: vscode.TreeView<TreeNode>;
  private readonly subs: vscode.Disposable[] = [];
  private readonly icons: IconsApi;

  constructor(icons: IconsApi, defaultTab: Tab = 'solution') {
    this.tab = defaultTab;
    this.icons = icons;

    this.subs.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.refresh()));
    const slnWatcher = vscode.workspace.createFileSystemWatcher('**/*.{sln,slnx,csproj,fsproj,vbproj}');
    slnWatcher.onDidCreate(() => this.refresh());
    slnWatcher.onDidChange(() => this.refresh());
    slnWatcher.onDidDelete(() => this.refresh());
    this.subs.push(slnWatcher);
    const fsWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    fsWatcher.onDidCreate(() => this.refresh());
    fsWatcher.onDidDelete(() => this.refresh());
    this.subs.push(fsWatcher);
  }

  /** Called from main.ts after createTreeView so messages can be set. */
  setTreeView(tv: vscode.TreeView<TreeNode>): void { this.treeView = tv; }

  get isShowingAll(): boolean { return this.showAll; }

  setTab(tab: Tab): void { this.tab = tab; this.refresh(); }

  toggleShowAll(): void {
    this.showAll = !this.showAll;
    vscode.commands.executeCommand('setContext', 'vssharp.explorer.showNonProjectFiles', this.showAll);
    this.refresh();
  }

  refresh(): void { this._onDidChangeTreeData.fire(undefined); }

  private setMessage(msg: string | undefined): void {
    if (this.treeView) this.treeView.message = msg;
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    if (node.kind === 'solution') {
      const projectCount = node.sln.projects.filter(p => !p.isFolder).length;
      const item = new vscode.TreeItem(node.sln.name, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = this.icons.resolveKind('solution') ?? new vscode.ThemeIcon('symbol-class');
      item.description = `${node.sln.format} · ${projectCount} projects`;
      item.tooltip = node.sln.filePath;
      item.contextValue = 'solution';
      return item;
    }

    if (node.kind === 'solution-folder') {
      const item = new vscode.TreeItem(node.proj.name, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.icons.resolveKind('solution-folder') ?? new vscode.ThemeIcon('folder');
      item.tooltip = node.proj.name;
      item.contextValue = 'solutionFolder';
      return item;
    }

    if (node.kind === 'project') {
      const item = new vscode.TreeItem(node.proj.name, vscode.TreeItemCollapsibleState.Collapsed);
      item.iconPath = this.icons.resolveKind('project') ?? new vscode.ThemeIcon('symbol-namespace');
      item.description = node.proj.relativePath;
      item.tooltip = node.proj.absolutePath;
      item.contextValue = 'project';
      return item;
    }

    // fs node
    const { node: fsNode } = node;
    const item = new vscode.TreeItem(
      fsNode.name,
      fsNode.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
    );
    item.resourceUri = vscode.Uri.file(fsNode.fsPath);
    item.iconPath = fsNode.isDirectory
      ? (this.icons.resolveFolder(fsNode.name) ?? new vscode.ThemeIcon('folder'))
      : (this.icons.resolveFile(fsNode.name) ?? new vscode.ThemeIcon('file'));
    item.tooltip = fsNode.fsPath;
    item.contextValue = fsNode.isDirectory ? 'folder' : 'file';
    if (!fsNode.isDirectory) {
      item.command = { command: 'vscode.open', title: 'Open', arguments: [vscode.Uri.file(fsNode.fsPath)] };
    }
    return item;
  }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (this.tab === 'files') {
      this.setMessage(undefined);
      return this.filesChildren(node);
    }
    return this.solutionChildren(node);
  }

  // --- Files tab ---

  private async filesChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (!node) {
      const roots = await listWorkspaceRoots();
      // Single root: show its children directly (same as webview auto-expand)
      if (roots.length === 1) {
        return (await listDirectory(roots[0].fsPath, this.showAll)).map(n => fs(n));
      }
      return roots.map(n => fs(n));
    }
    if (node.kind === 'fs' && node.node.isDirectory) {
      return (await listDirectory(node.node.fsPath, this.showAll)).map(n => fs(n));
    }
    return [];
  }

  // --- Solution tab ---

  private async solutionChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (!node) {
      const uris = await findSolutionFiles();
      const solutions = (await Promise.all(uris.map(parseSolution))).filter((s): s is SolutionData => !!s);
      if (solutions.length === 0) {
        this.setMessage('No .sln / .slnx found — showing workspace files.');
        return this.filesChildren();
      }
      this.setMessage(undefined);
      return solutions.map(sln => ({ kind: 'solution' as const, sln }));
    }

    if (node.kind === 'solution') return this.slnRoots(node.sln);

    if (node.kind === 'solution-folder') {
      const { proj, allProjects, slnFilePath } = node;
      return allProjects
        .filter(p => p.parentGuid === proj.projectGuid)
        .map(p => p.isFolder
          ? { kind: 'solution-folder' as const, proj: p, allProjects, slnFilePath }
          : { kind: 'project' as const, proj: p });
    }

    if (node.kind === 'project') {
      const dir = path.dirname(node.proj.absolutePath);
      const isFsproj = /\.fsproj$/i.test(node.proj.absolutePath);
      const nodes = await listDirectory(dir, this.showAll);
      return sortProjectChildren(nodes, isFsproj).map(n => fs(n));
    }

    if (node.kind === 'fs' && node.node.isDirectory) {
      return (await listDirectory(node.node.fsPath, this.showAll)).map(n => fs(n));
    }

    return [];
  }

  /** Top-level items inside a solution: top-level folders then top-level projects. */
  private slnRoots(sln: SolutionData): TreeNode[] {
    const nodes: TreeNode[] = [];
    for (const p of sln.projects.filter(pr => pr.isFolder && !pr.parentGuid)) {
      nodes.push({ kind: 'solution-folder', proj: p, allProjects: sln.projects, slnFilePath: sln.filePath });
    }
    for (const p of sln.projects.filter(pr => !pr.isFolder && !pr.parentGuid)) {
      nodes.push({ kind: 'project', proj: p });
    }
    return nodes;
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.subs.forEach(d => d.dispose());
  }
}

// Mirrors webview sortProjectChildren: folders first with 'properties'/'wwwroot' pinned, then files.
function sortProjectChildren(nodes: FsNode[], isFsproj: boolean): FsNode[] {
  if (isFsproj) return nodes;
  const HEAD = ['properties', 'wwwroot'];
  const folders = nodes.filter(n => n.isDirectory).sort((a, b) => {
    const x = a.name.toLowerCase(), y = b.name.toLowerCase();
    const hx = HEAD.indexOf(x), hy = HEAD.indexOf(y);
    if (hx >= 0 && hy >= 0) return hx - hy;
    if (hx >= 0) return -1;
    if (hy >= 0) return 1;
    return x.localeCompare(y);
  });
  const files = nodes
    .filter(n => !n.isDirectory)
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return [...folders, ...files];
}

function fs(node: FsNode): TreeNode {
  return { kind: 'fs', node };
}
