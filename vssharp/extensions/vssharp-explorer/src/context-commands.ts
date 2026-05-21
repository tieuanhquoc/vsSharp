import * as vscode from 'vscode';
import * as path from 'path';
import type { TreeNode } from './explorer-tree-provider';

type RefreshFn = () => void;

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveFilePath(node: TreeNode): string | undefined {
  if (node.kind === 'solution') return node.sln.filePath;
  // solution-folder is virtual — delegate Build/Restore/Clean to the parent .sln
  if (node.kind === 'solution-folder') return node.slnFilePath;
  if (node.kind === 'project') return node.proj.absolutePath;
  if (node.kind === 'fs') return node.node.fsPath;
  return undefined;
}

function resolveDir(node: TreeNode): string | undefined {
  if (node.kind === 'solution') return path.dirname(node.sln.filePath);
  if (node.kind === 'solution-folder') return path.dirname(node.slnFilePath);
  if (node.kind === 'project') return path.dirname(node.proj.absolutePath);
  if (node.kind === 'fs') return node.node.isDirectory ? node.node.fsPath : path.dirname(node.node.fsPath);
  return undefined;
}

function runInTerminal(name: string, cmd: string, cwd?: string): void {
  const term = vscode.window.createTerminal({ name, cwd });
  term.show(true);
  term.sendText(cmd);
}

// ── File / Folder CRUD ────────────────────────────────────────────────────────

export async function newFile(node: TreeNode, refresh: RefreshFn): Promise<void> {
  const dir = resolveDir(node);
  if (!dir) return;
  const name = await vscode.window.showInputBox({
    prompt: 'File name',
    placeHolder: 'MyClass.cs',
    validateInput: v => (!v?.trim() ? 'Name required' : undefined),
  });
  if (!name) return;
  const uri = vscode.Uri.file(path.join(dir, name.trim()));
  try {
    await vscode.workspace.fs.writeFile(uri, new Uint8Array());
    refresh();
    await vscode.window.showTextDocument(uri);
  } catch (e: any) {
    vscode.window.showErrorMessage(`Cannot create file: ${e.message}`);
  }
}

export async function newFolder(node: TreeNode, refresh: RefreshFn): Promise<void> {
  const dir = resolveDir(node);
  if (!dir) return;
  const name = await vscode.window.showInputBox({
    prompt: 'Folder name',
    placeHolder: 'MyFolder',
    validateInput: v => (!v?.trim() ? 'Name required' : undefined),
  });
  if (!name) return;
  const uri = vscode.Uri.file(path.join(dir, name.trim()));
  try {
    await vscode.workspace.fs.createDirectory(uri);
    refresh();
  } catch (e: any) {
    vscode.window.showErrorMessage(`Cannot create folder: ${e.message}`);
  }
}

export async function renameItem(node: TreeNode, refresh: RefreshFn): Promise<void> {
  let fsPath: string | undefined;
  if (node.kind === 'fs') fsPath = node.node.fsPath;
  else if (node.kind === 'project') fsPath = node.proj.absolutePath;
  if (!fsPath) return;

  const oldName = path.basename(fsPath);
  const newName = await vscode.window.showInputBox({
    prompt: 'New name',
    value: oldName,
    valueSelection: [0, oldName.lastIndexOf('.') > 0 ? oldName.lastIndexOf('.') : oldName.length],
    validateInput: v => (!v?.trim() ? 'Name required' : undefined),
  });
  if (!newName || newName.trim() === oldName) return;

  const src = vscode.Uri.file(fsPath);
  const dst = vscode.Uri.file(path.join(path.dirname(fsPath), newName.trim()));
  try {
    await vscode.workspace.fs.rename(src, dst, { overwrite: false });
    refresh();
  } catch (e: any) {
    vscode.window.showErrorMessage(`Cannot rename: ${e.message}`);
  }
}

export async function deleteItem(node: TreeNode, refresh: RefreshFn): Promise<void> {
  if (node.kind !== 'fs') return;
  const { fsPath, name, isDirectory } = node.node;
  const label = isDirectory ? 'folder' : 'file';
  const answer = await vscode.window.showWarningMessage(
    `Delete ${label} "${name}"?`,
    { modal: true },
    'Delete',
  );
  if (answer !== 'Delete') return;
  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(fsPath), { recursive: isDirectory, useTrash: true });
    refresh();
  } catch (e: any) {
    vscode.window.showErrorMessage(`Cannot delete: ${e.message}`);
  }
}

export async function duplicateFile(node: TreeNode, refresh: RefreshFn): Promise<void> {
  if (node.kind !== 'fs' || node.node.isDirectory) return;
  const { fsPath, name } = node.node;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const dir = path.dirname(fsPath);

  const newName = await vscode.window.showInputBox({
    prompt: 'Duplicate as',
    value: `${base}-copy${ext}`,
    valueSelection: [0, base.length + '-copy'.length],
    validateInput: v => (!v?.trim() ? 'Name required' : undefined),
  });
  if (!newName) return;

  try {
    await vscode.workspace.fs.copy(
      vscode.Uri.file(fsPath),
      vscode.Uri.file(path.join(dir, newName.trim())),
      { overwrite: false },
    );
    refresh();
  } catch (e: any) {
    vscode.window.showErrorMessage(`Cannot duplicate: ${e.message}`);
  }
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

export async function copyRelativePath(node: TreeNode): Promise<void> {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
  const rel = ws ? path.relative(ws.uri.fsPath, fsPath) : fsPath;
  await vscode.env.clipboard.writeText(rel);
  vscode.window.setStatusBarMessage(`Copied: ${rel}`, 3000);
}

export async function copyAbsolutePath(node: TreeNode): Promise<void> {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  await vscode.env.clipboard.writeText(fsPath);
  vscode.window.setStatusBarMessage(`Copied: ${fsPath}`, 3000);
}

// ── Reveal ────────────────────────────────────────────────────────────────────

export async function revealInExplorer(node: TreeNode): Promise<void> {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(fsPath));
}

// ── Project operations ────────────────────────────────────────────────────────

export async function openProjectFile(node: TreeNode): Promise<void> {
  if (node.kind !== 'project') return;
  await vscode.window.showTextDocument(vscode.Uri.file(node.proj.absolutePath));
}

export async function addPackage(node: TreeNode): Promise<void> {
  if (node.kind !== 'project') return;
  const pkg = await vscode.window.showInputBox({
    prompt: 'NuGet package name',
    placeHolder: 'Newtonsoft.Json',
    validateInput: v => (!v?.trim() ? 'Package name required' : undefined),
  });
  if (!pkg) return;
  const dir = path.dirname(node.proj.absolutePath);
  runInTerminal('Add Package', `dotnet add "${node.proj.absolutePath}" package ${pkg.trim()}`, dir);
}

// ── dotnet CLI ────────────────────────────────────────────────────────────────

export function buildNode(node: TreeNode): void {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  runInTerminal('Build', `dotnet build "${fsPath}"`, path.dirname(fsPath));
}

export function cleanNode(node: TreeNode): void {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  runInTerminal('Clean', `dotnet clean "${fsPath}"`, path.dirname(fsPath));
}

export function restoreNode(node: TreeNode): void {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  runInTerminal('Restore', `dotnet restore "${fsPath}"`, path.dirname(fsPath));
}

export function runProject(node: TreeNode): void {
  if (node.kind !== 'project') return;
  runInTerminal('Run', `dotnet run --project "${node.proj.absolutePath}"`, path.dirname(node.proj.absolutePath));
}

export function testProject(node: TreeNode): void {
  if (node.kind !== 'project') return;
  runInTerminal('Test', `dotnet test "${node.proj.absolutePath}"`, path.dirname(node.proj.absolutePath));
}

// ── Solution: Add sub-menu ────────────────────────────────────────────────────

export async function addNewProject(_node: TreeNode): Promise<void> {
  vscode.window.showInformationMessage('Add New Project — not yet implemented.');
}

export async function addNewSolutionFolder(node: TreeNode, refresh: RefreshFn): Promise<void> {
  if (node.kind !== 'solution') return;
  const name = await vscode.window.showInputBox({
    prompt: 'Solution folder name',
    placeHolder: 'src',
    validateInput: v => (!v?.trim() ? 'Name required' : undefined),
  });
  if (!name) return;
  vscode.window.showInformationMessage(`Add Solution Folder "${name.trim()}" — not yet implemented.`);
  void refresh;
}

export async function addExistingProject(_node: TreeNode, _refresh: RefreshFn): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'Project files': ['csproj', 'fsproj', 'vbproj'] },
    openLabel: 'Add',
  });
  if (!uris?.length) return;
  vscode.window.showInformationMessage(`Add Existing Project "${uris[0].fsPath}" — not yet implemented.`);
}

// ── Solution: Manage ──────────────────────────────────────────────────────────

export function manageNuget(node: TreeNode): void {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  vscode.window.showInformationMessage(`Manage NuGet Packages for "${path.basename(fsPath)}" — not yet implemented.`);
}

export function unloadProjects(_node: TreeNode): void {
  vscode.window.showInformationMessage('Unload Projects — not yet implemented.');
}

export function reloadAllProjects(_node: TreeNode, refresh: RefreshFn): void {
  refresh();
}

// ── Solution: Actions ─────────────────────────────────────────────────────────

export async function runMultipleProjects(_node: TreeNode): Promise<void> {
  vscode.window.showInformationMessage('Run Multiple Projects — not yet implemented.');
}

export async function publishSolution(node: TreeNode): Promise<void> {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  vscode.window.showInformationMessage(`Publish "${path.basename(fsPath)}" — not yet implemented.`);
}

// ── Solution: Tools ───────────────────────────────────────────────────────────

export async function openInTerminal(node: TreeNode): Promise<void> {
  const dir = resolveDir(node);
  if (!dir) return;
  runInTerminal('Terminal', '', dir);
}

export async function openInFinder(node: TreeNode): Promise<void> {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(fsPath));
}

export function showProperties(node: TreeNode): void {
  const fsPath = resolveFilePath(node);
  if (!fsPath) return;
  vscode.window.showInformationMessage(`Properties: ${fsPath}`);
}
