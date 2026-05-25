import * as vscode from 'vscode';
import { ExplorerTabsProvider } from './tabs-provider';
import { ExplorerTreeProvider } from './explorer-tree-provider';
import * as cmd from './context-commands';
import type { TreeNode } from './explorer-tree-provider';
import { findSolutionFiles, parseSolution } from './sln-parser';
import { openNewProjectModal } from './modals/new-project-modal';
import { openNewSolutionModal } from './modals/new-solution-modal';

export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
  const defaultTab = vscode.workspace.getConfiguration('vssharp.explorer')
    .get<'solution' | 'files'>('defaultTab', 'solution');

  const iconsExt = vscode.extensions.getExtension<any>('vssharp.vssharp-icons');
  const icons = await iconsExt?.activate();

  const treeProvider = new ExplorerTreeProvider(icons, defaultTab);
  const tabsProvider = new ExplorerTabsProvider(ctx);

  // Native tree view — use createTreeView so we can set .message.
  const treeView = vscode.window.createTreeView('vssharp.explorer.tree', {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });
  treeProvider.setTreeView(treeView);

  // Tab switch: webview pill → tree content
  tabsProvider.onDidChangeTab(tab => treeProvider.setTab(tab));

  // Eye toggle: webview button → tree provider, then sync button state back
  tabsProvider.onDidToggleShowAll(() => {
    treeProvider.toggleShowAll();
    tabsProvider.setShowAll(treeProvider.isShowingAll);
  });

  const refresh = () => treeProvider.refresh();

  ctx.subscriptions.push(treeProvider, tabsProvider, treeView);
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(ExplorerTabsProvider.viewType, tabsProvider),

    // ── Global (File menu) ───────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.newSolution', () => openNewSolutionModal(ctx)),

    // ── Toolbar (view/title fallback) ────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.refresh', refresh),
    vscode.commands.registerCommand('vssharp.explorer.showNonProjectFiles', () => {
      treeProvider.toggleShowAll();
      tabsProvider.setShowAll(treeProvider.isShowingAll);
    }),
    vscode.commands.registerCommand('vssharp.explorer.hideNonProjectFiles', () => {
      treeProvider.toggleShowAll();
      tabsProvider.setShowAll(treeProvider.isShowingAll);
    }),

    // ── File / Folder CRUD ───────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.newFile',   (node: TreeNode) => cmd.newFile(node, refresh)),
    vscode.commands.registerCommand('vssharp.explorer.newFolder', (node: TreeNode) => cmd.newFolder(node, refresh)),
    vscode.commands.registerCommand('vssharp.explorer.rename',    (node: TreeNode) => cmd.renameItem(node, refresh)),
    vscode.commands.registerCommand('vssharp.explorer.delete',    (node: TreeNode) => cmd.deleteItem(node, refresh)),
    vscode.commands.registerCommand('vssharp.explorer.duplicate', (node: TreeNode) => cmd.duplicateFile(node, refresh)),

    // ── Clipboard ────────────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.copyRelativePath', (node: TreeNode) => cmd.copyRelativePath(node)),
    vscode.commands.registerCommand('vssharp.explorer.copyAbsolutePath', (node: TreeNode) => cmd.copyAbsolutePath(node)),

    // ── Reveal ───────────────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.revealInExplorer', (node: TreeNode) => cmd.revealInExplorer(node)),

    // ── Project ──────────────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.openProjectFile', (node: TreeNode) => cmd.openProjectFile(node)),
    vscode.commands.registerCommand('vssharp.explorer.addPackage',      (node: TreeNode) => cmd.addPackage(node)),

    // ── dotnet CLI ───────────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.build',   (node: TreeNode) => cmd.buildNode(node)),
    vscode.commands.registerCommand('vssharp.explorer.clean',   (node: TreeNode) => cmd.cleanNode(node)),
    vscode.commands.registerCommand('vssharp.explorer.restore', (node: TreeNode) => cmd.restoreNode(node)),
    vscode.commands.registerCommand('vssharp.explorer.run',     (node: TreeNode) => cmd.runProject(node)),
    vscode.commands.registerCommand('vssharp.explorer.test',    (node: TreeNode) => cmd.testProject(node)),

    // ── Solution: Add ────────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.addNewProject',        (node: TreeNode) => openNewProjectModal(ctx, node, refresh)),
    vscode.commands.registerCommand('vssharp.explorer.addNewSolutionFolder', (node: TreeNode) => cmd.addNewSolutionFolder(node, refresh)),
    vscode.commands.registerCommand('vssharp.explorer.addExistingProject',   (node: TreeNode) => cmd.addExistingProject(node, refresh)),

    // ── Solution: Manage ─────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.manageNuget',          (node: TreeNode) => cmd.manageNuget(node)),
    vscode.commands.registerCommand('vssharp.explorer.unloadProjects',       (node: TreeNode) => cmd.unloadProjects(node)),
    vscode.commands.registerCommand('vssharp.explorer.reloadAllProjects',    (node: TreeNode) => cmd.reloadAllProjects(node, refresh)),

    // ── Solution: Actions ────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.runMultipleProjects',  (node: TreeNode) => cmd.runMultipleProjects(node)),
    vscode.commands.registerCommand('vssharp.explorer.publish',              (node: TreeNode) => cmd.publishSolution(node)),

    // ── Solution: Tools ──────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.openInTerminal',       (node: TreeNode) => cmd.openInTerminal(node)),
    vscode.commands.registerCommand('vssharp.explorer.openInFinder',         (node: TreeNode) => cmd.openInFinder(node)),
    vscode.commands.registerCommand('vssharp.explorer.showProperties',       (node: TreeNode) => cmd.showProperties(node)),

    // ── Debug ────────────────────────────────────────────────────────────────
    vscode.commands.registerCommand('vssharp.explorer.debugDump', async () => {
      const uris = await findSolutionFiles();
      const solutions = (await Promise.all(uris.map(parseSolution))).filter(Boolean);
      const dump = { solutions };
      const doc = await vscode.workspace.openTextDocument({
        language: 'json',
        content: JSON.stringify(dump, null, 2),
      });
      await vscode.window.showTextDocument(doc);
    }),
  );
}

export function deactivate(): void { /* no-op */ }
