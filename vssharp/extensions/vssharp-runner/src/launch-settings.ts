import * as vscode from 'vscode';
import * as path from 'path';

export interface LaunchProfile {
  commandName: 'Project' | 'Executable' | 'IISExpress' | 'IIS' | 'Docker' | string;
  executablePath?: string;
  commandLineArgs?: string;
  workingDirectory?: string;
  launchBrowser?: boolean;
  launchUrl?: string;
  applicationUrl?: string;
  environmentVariables?: Record<string, string>;
  dotnetRunMessages?: boolean;
}

export interface ProjectProfile {
  projectPath: string;       // absolute path to .csproj
  projectName: string;       // basename without .csproj
  projectDir: string;        // dirname of .csproj
  profileName: string;       // key in profiles
  profile: LaunchProfile;
  launchSettingsPath: string;
}

const SETTINGS_GLOB = '**/Properties/launchSettings.json';

export async function discoverProjectProfiles(): Promise<ProjectProfile[]> {
  const uris = await vscode.workspace.findFiles(SETTINGS_GLOB, '**/node_modules/**');
  const result: ProjectProfile[] = [];

  for (const uri of uris) {
    const launchSettingsPath = uri.fsPath;
    const projectDir = path.dirname(path.dirname(launchSettingsPath));
    const projectPath = await findCsprojIn(projectDir);
    if (!projectPath) continue;

    const profiles = await parseProfiles(launchSettingsPath);
    const projectName = path.basename(projectPath, '.csproj');

    for (const [profileName, profile] of Object.entries(profiles)) {
      if (profile.commandName === 'IISExpress' || profile.commandName === 'IIS') continue;
      result.push({
        projectPath, projectName, projectDir,
        profileName, profile, launchSettingsPath,
      });
    }
  }

  return result;
}

async function findCsprojIn(dir: string): Promise<string | undefined> {
  const dirUri = vscode.Uri.file(dir);
  try {
    const entries = await vscode.workspace.fs.readDirectory(dirUri);
    for (const [name, type] of entries) {
      if (type === vscode.FileType.File && name.endsWith('.csproj')) {
        return path.join(dir, name);
      }
    }
  } catch { /* ignore */ }
  return undefined;
}

async function parseProfiles(filePath: string): Promise<Record<string, LaunchProfile>> {
  try {
    const buf = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    const text = Buffer.from(buf).toString('utf8');
    // Strip BOM (VS often saves with UTF-8 BOM) + comments (// and /* */)
    const stripped = text
      .replace(/^﻿/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .trim();
    const data = JSON.parse(stripped);
    return data?.profiles ?? {};
  } catch (err) {
    console.warn(`[vssharp-runner] failed to parse ${filePath}:`, err);
    return {};
  }
}

export function profileLabel(p: ProjectProfile): string {
  return `${p.projectName} • ${p.profileName}`;
}

/**
 * Find the ProjectProfile whose projectDir is an ancestor of filePath.
 * Picks the most specific (longest dir) match.
 */
export function findProjectByFile(
  profiles: readonly ProjectProfile[],
  filePath: string,
): ProjectProfile | undefined {
  const sep = path.sep;
  const matches = profiles.filter(p =>
    filePath === p.projectDir || filePath.startsWith(p.projectDir + sep));
  if (matches.length === 0) return undefined;
  matches.sort((a, b) => b.projectDir.length - a.projectDir.length);
  return matches[0];
}

export async function parseTargetFramework(csprojPath: string): Promise<string | undefined> {
  try {
    const buf = await vscode.workspace.fs.readFile(vscode.Uri.file(csprojPath));
    const text = Buffer.from(buf).toString('utf8');
    const single = /<TargetFramework>([^<]+)<\/TargetFramework>/i.exec(text);
    if (single) return single[1].trim();
    const multi = /<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i.exec(text);
    if (multi) return multi[1].split(';')[0].trim();
  } catch (err) {
    console.warn(`[vssharp-runner] failed to parse ${csprojPath}:`, err);
  }
  return undefined;
}
