import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { listDirectory, listWorkspaceRoots } from './file-system';
import { findSolutionFiles, parseSolution, SolutionData } from './sln-parser';
import { parseCsproj, CsprojSummary } from './csproj-parser';

type IncomingMessage =
  | { type: 'ready' }
  | { type: 'listDir'; fsPath?: string; showAll?: boolean; reqId: string }
  | { type: 'listRoots'; reqId: string }
  | { type: 'openFile'; fsPath: string }
  | { type: 'loadSolutions'; reqId: string }
  | { type: 'inspectProject'; fsPath: string; reqId: string }
  | { type: 'contextAction'; action: string; payload: Record<string, string> }
  | { type: 'showContextMenu'; kind: string; fsPath: string; label: string };

type OutgoingMessage =
  | { type: 'config'; defaultTab: string }
  | { type: 'listDirResult'; reqId: string; nodes: any[] }
  | { type: 'listRootsResult'; reqId: string; nodes: any[] }
  | { type: 'solutionsResult'; reqId: string; solutions: SolutionData[] }
  | { type: 'projectResult'; reqId: string; summary: CsprojSummary }
  | { type: 'refresh' };

export class ExplorerWebviewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'vssharp.explorer.main';

  private view?: vscode.WebviewView;
  private readonly subs: vscode.Disposable[] = [];

  constructor(private readonly ctx: vscode.ExtensionContext) {
    this.subs.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.post({ type: 'refresh' })),
    );
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{sln,slnx,csproj,fsproj,vbproj}');
    watcher.onDidCreate(() => this.post({ type: 'refresh' }));
    watcher.onDidChange(() => this.post({ type: 'refresh' }));
    watcher.onDidDelete(() => this.post({ type: 'refresh' }));
    this.subs.push(watcher);
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.ctx.extensionUri, 'extension', 'media')],
    };
    view.webview.html = await this.renderHtml(view.webview);
    view.webview.onDidReceiveMessage(msg => this.onMessage(msg as IncomingMessage));
    view.onDidDispose(() => { this.view = undefined; });
  }

  refresh(): void { this.post({ type: 'refresh' }); }

  // ---------- message handlers ----------

  private async onMessage(msg: IncomingMessage): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.post({
          type: 'config',
          defaultTab: vscode.workspace.getConfiguration('vssharp.explorer')
            .get<string>('defaultTab', 'solution'),
        });
        return;
      case 'listRoots':
        this.post({ type: 'listRootsResult', reqId: msg.reqId, nodes: await listWorkspaceRoots() });
        return;
      case 'listDir':
        if (!msg.fsPath) return;
        this.post({ type: 'listDirResult', reqId: msg.reqId, nodes: await listDirectory(msg.fsPath, msg.showAll) });
        return;
      case 'openFile': {
        const uri = vscode.Uri.file(msg.fsPath);
        try {
          const stat = await vscode.workspace.fs.stat(uri);
          if (stat.type & vscode.FileType.Directory) {
            await vscode.commands.executeCommand('revealFileInOS', uri);
            return;
          }
          await vscode.commands.executeCommand('vscode.open', uri);
        } catch (err: any) {
          vscode.window.showErrorMessage(
            `VS Sharp Explorer: cannot open\n${msg.fsPath}\n(${err?.message ?? err})`,
          );
        }
        return;
      }
      case 'loadSolutions': {
        const slnUris = await findSolutionFiles();
        const data = await Promise.all(slnUris.map(parseSolution));
        const solutions = data.filter((s): s is SolutionData => !!s);
        this.post({ type: 'solutionsResult', reqId: msg.reqId, solutions });
        return;
      }
      case 'inspectProject': {
        const summary = await parseCsproj(msg.fsPath);
        this.post({ type: 'projectResult', reqId: msg.reqId, summary });
        return;
      }
      case 'contextAction': {
        await this.handleContextAction(msg.action, msg.payload);
        return;
      }
      case 'showContextMenu': {
        await this.showContextMenu(msg.kind, msg.fsPath, msg.label);
        return;
      }
    }
  }

  // ---------- QuickPick context menu ----------

  private async showContextMenu(kind: string, fsPath: string, label: string): Promise<void> {
    const items = this.menuItemsFor(kind, fsPath, label);
    await this.runQuickPickMenu(items, fsPath, label, undefined);
  }

  /**
   * Recursively show a QuickPick for the given menu items.
   * parentPick is passed so the back button can restore the parent level.
   */
  private async runQuickPickMenu(
    items: ContextMenuItem[],
    fsPath: string,
    label: string,
    parentItems: ContextMenuItem[] | undefined,
  ): Promise<void> {
    const qp = vscode.window.createQuickPick<ContextQuickPickItem>();
    qp.placeholder = label || 'Select action';
    qp.matchOnDescription = false;

    const pickItems: ContextQuickPickItem[] = [];

    // Add back button when navigating into a sub-menu
    if (parentItems !== undefined) {
      pickItems.push({
        label: '$(arrow-left) Back',
        _isBack: true,
      });
      pickItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator, _isBack: false });
    }

    for (const item of items) {
      if (item.sep) {
        pickItems.push({ label: '', kind: vscode.QuickPickItemKind.Separator, _isBack: false });
        continue;
      }
      if (item.children) {
        pickItems.push({
          label: `$(folder-opened)  ${item.label}`,
          description: '$(chevron-right)',
          _children: item.children,
          _isBack: false,
        });
      } else if (item.disabled) {
        pickItems.push({
          label: item.label!,
          description: '(unavailable)',
          _disabled: true,
          _isBack: false,
        });
      } else {
        pickItems.push({
          label: item.label!,
          _action: item.action,
          _isBack: false,
        });
      }
    }

    qp.items = pickItems;
    qp.show();

    await new Promise<void>((resolve) => {
      qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0] as ContextQuickPickItem | undefined;
        qp.dispose();
        if (!selected) { resolve(); return; }

        if (selected._isBack) {
          // Restore parent — handled by re-opening parent from caller; just resolve here
          resolve();
          // Re-open parent level (parentItems undefined means we're at root)
          await this.runQuickPickMenu(parentItems ?? this.menuItemsFor('file', fsPath, label), fsPath, label, undefined);
          return;
        }

        if (selected._disabled) { resolve(); return; }

        if (selected._children) {
          resolve();
          await this.runQuickPickMenu(selected._children, fsPath, label, items);
          return;
        }

        if (selected._action) {
          await this.handleContextAction(selected._action, { fsPath, label });
        }
        resolve();
      });

      qp.onDidHide(() => { qp.dispose(); resolve(); });
    });
  }

  /** Build flat menu-item definitions for the given node kind. */
  private menuItemsFor(kind: string, fsPath: string, label: string): ContextMenuItem[] {
    const addFolderSubmenu: ContextMenuItem = {
      label: 'Add',
      children: [
        { label: 'Class/Interface',  action: 'addClassInterface' },
        { label: 'Directory',        action: 'addDirectory' },
        { label: 'File',             action: 'addFile' },
        { label: 'Scratch File',     action: 'addScratchFile' },
        { label: 'Existing Item...', action: 'addExistingItem' },
      ],
    };

    const addProjectSubmenu: ContextMenuItem = {
      label: 'Add',
      children: [
        { label: 'Class/Interface',      action: 'addClassInterface' },
        { label: 'Directory',            action: 'addDirectory' },
        { label: 'File',                 action: 'addFile' },
        { label: 'Scratch File',         action: 'addScratchFile' },
        { label: 'Reference...',         action: 'addReference' },
        { label: 'Existing Item...',     action: 'addExistingItem' },
        { sep: true },
        { label: 'Blazor Component',     action: 'addBlazor' },
        { label: 'Razor Page',           action: 'addRazorPage' },
        { label: 'Controller',           action: 'addController' },
        { label: 'Scaffolded Item...',   action: 'addScaffolded' },
        { label: 'Aspire Orchestration', action: 'addAspire' },
        { label: 'Dockerfile',           action: 'addDockerfile' },
        { label: 'Docker Compose File',  action: 'addDockerCompose' },
        { label: '.ignore File',         action: 'addIgnoreFile' },
        { sep: true },
        { label: 'JSON File',            action: 'addJson' },
        { label: 'JavaScript File',      action: 'addJs' },
        { label: 'TypeScript File',      action: 'addTs' },
        { label: 'Stylesheet',           action: 'addCss' },
        { label: 'HTML File',            action: 'addHtml' },
        { label: 'XML File',             action: 'addXml' },
        { label: 'Resources (.resx)',    action: 'addResx' },
        { sep: true },
        { label: 'More File Templates',  action: 'addMoreTemplates' },
        { label: 'Configuration Files',  action: 'addConfig' },
        { label: 'Web Reference...',     action: 'addWebRef' },
      ],
    };

    if (kind === 'project') {
      return [
        addProjectSubmenu,
        { sep: true },
        { label: 'Manage NuGet Packages',    action: 'nuget' },
        { sep: true },
        { label: 'Unload Project',           action: 'unloadProject' },
        { label: 'Reload Project',           action: 'reloadProject' },
        { sep: true },
        { label: 'Entity Framework Core',    action: 'efCore' },
        { sep: true },
        { label: 'Build Selected Projects',  action: 'build' },
        { label: 'Run Unit Test',            action: 'runTests', disabled: true },
        { label: 'Publish...',               action: 'publish' },
        { label: 'Advanced Build Actions',   action: 'advancedBuild' },
        { sep: true },
        { label: 'Show Local History',       action: 'localHistory' },
        { label: 'Git',                      action: 'git' },
        { sep: true },
        { label: 'Refactor This...',         action: 'refactor' },
        { label: 'Inspect Code...',          action: 'inspectCode' },
        { label: 'Reformat and Cleanup...', action: 'reformat' },
        { sep: true },
        { label: 'Edit',                     action: 'edit' },
        { label: 'Copy Path/Reference...',   action: 'copyPathRef' },
        { label: 'Open In',                  action: 'openIn' },
        { sep: true },
        { label: 'Diagrams',                 action: 'diagrams' },
        { label: 'Tools',                    action: 'tools' },
        { sep: true },
        { label: 'Properties...',            action: 'properties' },
      ];
    }

    if (kind === 'solution') {
      return [
        { label: 'Build Solution',           action: 'build' },
        { label: 'Publish...',               action: 'publish' },
        { sep: true },
        { label: 'Copy Path/Reference...',   action: 'copyPathRef' },
        { label: 'Open In',                  action: 'openIn' },
        { sep: true },
        { label: 'Properties...',            action: 'properties' },
      ];
    }

    if (kind === 'dir' || kind === 'solution-folder') {
      return [
        addFolderSubmenu,
        { sep: true },
        { label: 'Copy Path/Reference...',   action: 'copyPathRef' },
        { label: 'Open In',                  action: 'openIn' },
        { label: 'Open in Terminal',         action: 'openTerminal' },
        { sep: true },
        { label: 'Reveal in Finder',         action: 'revealInOS' },
        { sep: true },
        { label: 'Rename',                   action: 'rename' },
        { label: 'Delete',                   action: 'delete' },
      ];
    }

    // file (default)
    return [
      { label: 'Copy Path/Reference...',     action: 'copyPathRef' },
      { label: 'Open In',                    action: 'openIn' },
      { sep: true },
      { label: 'Show Local History',         action: 'localHistory' },
      { label: 'Git',                        action: 'git' },
      { sep: true },
      { label: 'Reveal in Finder',           action: 'revealInOS' },
      { label: 'Open in Terminal',           action: 'openTerminal' },
      { sep: true },
      { label: 'Rename',                     action: 'rename' },
      { label: 'Delete',                     action: 'delete' },
    ];
  }

  private async handleContextAction(action: string, payload: Record<string, string>): Promise<void> {
    const uri = payload.fsPath ? vscode.Uri.file(payload.fsPath) : undefined;
    switch (action) {
      case 'copyPath':
        if (payload.fsPath) await vscode.env.clipboard.writeText(payload.fsPath);
        break;
      case 'copyRelPath': {
        if (!payload.fsPath) break;
        const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(payload.fsPath));
        const rel = ws ? require('path').relative(ws.uri.fsPath, payload.fsPath) : payload.fsPath;
        await vscode.env.clipboard.writeText(rel);
        break;
      }
      case 'revealInOS':
        if (uri) await vscode.commands.executeCommand('revealFileInOS', uri);
        break;
      case 'openTerminal': {
        const terminal = vscode.window.createTerminal({ cwd: payload.fsPath });
        terminal.show();
        break;
      }
      case 'rename': {
        if (!payload.fsPath) break;
        const oldName = path.basename(payload.fsPath);
        const newName = await vscode.window.showInputBox({
          prompt: 'Rename to',
          value: oldName,
          valueSelection: [0, oldName.lastIndexOf('.') > 0 ? oldName.lastIndexOf('.') : oldName.length],
          validateInput: v => v?.trim() ? undefined : 'Name required',
        });
        if (!newName || newName.trim() === oldName) break;
        const oldUri = vscode.Uri.file(payload.fsPath);
        const newUri = vscode.Uri.file(path.join(path.dirname(payload.fsPath), newName.trim()));
        try {
          await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
          this.post({ type: 'refresh' });
        } catch (e: any) {
          vscode.window.showErrorMessage(`Cannot rename: ${e.message}`);
        }
        break;
      }
      case 'delete': {
        if (!payload.fsPath) break;
        const label = path.basename(payload.fsPath);
        const choice = await vscode.window.showWarningMessage(`Delete "${label}"?`, { modal: true }, 'Delete');
        if (choice === 'Delete') {
          try {
            await vscode.workspace.fs.delete(vscode.Uri.file(payload.fsPath), { recursive: true, useTrash: true });
            this.post({ type: 'refresh' });
          } catch (e: any) {
            vscode.window.showErrorMessage(`Cannot delete: ${e.message}`);
          }
        }
        break;
      }
    }
  }

  private post(msg: OutgoingMessage): void { this.view?.webview.postMessage(msg); }

  // ---------- html ----------

  private async renderHtml(webview: vscode.Webview): Promise<string> {
    const mediaRoot = vscode.Uri.joinPath(this.ctx.extensionUri, 'extension', 'media');
    const html = await fs.readFile(vscode.Uri.joinPath(mediaRoot, 'index.html').fsPath, 'utf8');
    const mediaBase = webview.asWebviewUri(mediaRoot).toString();
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'main.css'));
    const jsUri  = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'main.js'));
    return html
      .replace(/\{\{cspSource\}\}/g, webview.cspSource)
      .replace(/\{\{nonce\}\}/g, makeNonce())
      .replace(/\{\{mediaBase\}\}/g, mediaBase)
      .replace(/\{\{cssUri\}\}/g, cssUri.toString())
      .replace(/\{\{jsUri\}\}/g, jsUri.toString());
  }

  dispose(): void { this.subs.forEach(d => d.dispose()); }
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ---------- Context menu types ----------

interface ContextMenuItem {
  /** Display label (omit for separators). */
  label?: string;
  /** Action identifier forwarded to handleContextAction. */
  action?: string;
  /** Child items — triggers sub-menu navigation. */
  children?: ContextMenuItem[];
  /** True renders item as a visual separator. */
  sep?: boolean;
  /** True renders item grayed-out; clicking it does nothing. */
  disabled?: boolean;
}

interface ContextQuickPickItem extends vscode.QuickPickItem {
  _action?: string;
  _children?: ContextMenuItem[];
  _disabled?: boolean;
  _isBack: boolean;
}
