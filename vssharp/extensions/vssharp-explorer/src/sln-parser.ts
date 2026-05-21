// Minimal .sln / .slnx parser. Format reference adapted from
// https://github.com/fernandoescolar/vscode-solution-explorer (MIT)
// src/core/Solutions/{sln,slnx}/
//
// Scope: discover projects inside a solution + folder hierarchy.
// Out of scope (Phase 3+): build configurations, dependencies, items.

import * as vscode from 'vscode';
import * as path from 'path';

export interface SolutionProject {
  /** Display name from solution file. */
  name: string;
  /** Path relative to .sln/.slnx file (normalized to forward slashes). */
  relativePath: string;
  /** Resolved absolute path of the .csproj/.fsproj/.vbproj. */
  absolutePath: string;
  /** Project type GUID (.sln only). */
  typeGuid?: string;
  /** Solution Folder (virtual container) — not a real project. */
  isFolder: boolean;
  /** GUID of the project itself (.sln only) — used for nesting. */
  projectGuid?: string;
  /** Parent folder GUID, if nested via NestedProjects section. */
  parentGuid?: string;
}

export interface SolutionData {
  filePath: string;
  name: string;
  format: 'sln' | 'slnx';
  projects: SolutionProject[];
}

// Solution Folder type GUIDs — the ONLY reliable way to detect virtual folders.
// MS Visual Studio canonical:  {2150E333-8FDD-4A28-B287-D3F0B7AF1683}
// Rider / newer tooling:       {2150E333-8FDC-42A3-9474-1A3956D46DE8}
const FOLDER_GUIDS = new Set<string>([
  '{2150E333-8FDD-4A28-B287-D3F0B7AF1683}',
  '{2150E333-8FDC-42A3-9474-1A3956D46DE8}',
]);

// A node is a Solution Folder if and only if its typeGuid is in FOLDER_GUIDS.
// Extension-based heuristics are unreliable — new project types (.appxproj,
// .esproj, etc.) would be misclassified as folders if the extension is unknown.
function classifyAsFolder(typeGuid: string): boolean {
  return FOLDER_GUIDS.has(typeGuid.toUpperCase());
}

export async function findSolutionFiles(): Promise<vscode.Uri[]> {
  // Exclude common non-user dirs (node_modules, built-in extensions, build output).
  // Depth: only match up to 3 levels deep to avoid scanning deeply-nested vendor code.
  const exclude = '{**/node_modules/**,**/extensions/**,**/.git/**,**/bin/**,**/obj/**,**/packages/**}';
  const shallow = [
    '*.{sln,slnx}',
    '*/*.{sln,slnx}',
    '*/*/*.{sln,slnx}',
  ];
  const results = await Promise.all(
    shallow.map(p => vscode.workspace.findFiles(p, exclude))
  );
  // Deduplicate by fsPath
  const seen = new Set<string>();
  return results.flat().filter(u => { const k = u.fsPath; return seen.has(k) ? false : (seen.add(k), true); });
}

export async function parseSolution(uri: vscode.Uri): Promise<SolutionData | undefined> {
  const ext = path.extname(uri.fsPath).toLowerCase();
  const buf = await vscode.workspace.fs.readFile(uri);
  const text = Buffer.from(buf).toString('utf8').replace(/^﻿/, '');
  if (ext === '.sln') return parseSln(uri.fsPath, text);
  if (ext === '.slnx') return parseSlnx(uri.fsPath, text);
  return undefined;
}

// ---------- .sln (Visual Studio text format) ----------

function parseSln(filePath: string, text: string): SolutionData {
  const dir = path.dirname(filePath);
  const projects: SolutionProject[] = [];

  // Project("{typeGuid}") = "name", "relPath", "{projGuid}"
  const projRe = /^Project\("(\{[^}]+\})"\)\s*=\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"(\{[^}]+\})"/gm;
  let m: RegExpExecArray | null;
  while ((m = projRe.exec(text)) !== null) {
    const typeGuid = m[1].toUpperCase();
    const relPath = m[3].replace(/\\/g, '/');
    const isFolder = classifyAsFolder(typeGuid);
    projects.push({
      name: m[2],
      relativePath: relPath,
      absolutePath: path.resolve(dir, relPath),
      typeGuid,
      isFolder,
      projectGuid: m[4].toUpperCase(),
    });
  }

  // GlobalSection(NestedProjects) = preSolution
  //   {childGuid} = {parentGuid}
  // EndGlobalSection
  const nestedBlock = /GlobalSection\(NestedProjects\)\s*=\s*preSolution([\s\S]*?)EndGlobalSection/i.exec(text);
  if (nestedBlock) {
    const nestRe = /(\{[^}]+\})\s*=\s*(\{[^}]+\})/g;
    let n: RegExpExecArray | null;
    const parentMap = new Map<string, string>();
    while ((n = nestRe.exec(nestedBlock[1])) !== null) {
      parentMap.set(n[1].toUpperCase(), n[2].toUpperCase());
    }
    for (const p of projects) {
      if (p.projectGuid) p.parentGuid = parentMap.get(p.projectGuid);
    }
  }

  return { filePath, name: path.basename(filePath, '.sln'), format: 'sln', projects };
}

// ---------- .slnx (newer XML format, .NET 9+) ----------

function parseSlnx(filePath: string, text: string): SolutionData {
  const dir = path.dirname(filePath);
  const projects: SolutionProject[] = [];

  // <Project Path="..."/>  or <Project Path="..."> ... </Project>
  const projRe = /<Project\s+[^>]*Path\s*=\s*"([^"]+)"[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = projRe.exec(text)) !== null) {
    const relPath = m[1].replace(/\\/g, '/');
    projects.push({
      name: path.basename(relPath, path.extname(relPath)),
      relativePath: relPath,
      absolutePath: path.resolve(dir, relPath),
      isFolder: false,
    });
  }

  return { filePath, name: path.basename(filePath, '.slnx'), format: 'slnx', projects };
}
