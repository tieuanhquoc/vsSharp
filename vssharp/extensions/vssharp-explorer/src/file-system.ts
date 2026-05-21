import * as vscode from 'vscode';
import * as path from 'path';

export interface FsNode {
  name: string;
  fsPath: string;
  isDirectory: boolean;
  isWorkspaceRoot?: boolean;
}

export async function listWorkspaceRoots(): Promise<FsNode[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  return folders.map(f => ({
    name: f.name,
    fsPath: f.uri.fsPath,
    isDirectory: true,
    isWorkspaceRoot: true,
  }));
}

export async function listDirectory(fsPath: string, showAll = false): Promise<FsNode[]> {
  const hidden = hiddenPatterns();
  try {
    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(fsPath));
    return entries
      .filter(([name]) => showAll || (!hidden.has(name) && !name.startsWith('.')))
      .map(([name, type]) => ({
        name,
        fsPath: path.join(fsPath, name),
        isDirectory: (type & vscode.FileType.Directory) !== 0,
      }))
      .sort(sortByKindThenName);
  } catch { return []; }
}

function sortByKindThenName(a: FsNode, b: FsNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function hiddenPatterns(): Set<string> {
  const arr = vscode.workspace
    .getConfiguration('vssharp.explorer')
    .get<string[]>('hiddenPatterns', []);
  return new Set(arr);
}

/** Path segments from each workspace root down to (and including) filePath. */
export function pathSegmentsFromRoot(filePath: string): { root: string; segments: string[] } | undefined {
  const ws = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!ws) return undefined;
  const rel = path.relative(ws.uri.fsPath, filePath);
  if (rel.startsWith('..')) return undefined;
  return { root: ws.uri.fsPath, segments: rel.split(path.sep).filter(Boolean) };
}
