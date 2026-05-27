import * as vscode from 'vscode';
import * as path from 'path';
import {
  createProfileEntries,
  findProjectForFile,
  LaunchProfile,
  ProfileDiscoveryEntry,
  ProjectProfile,
  runnableProfiles,
} from './profile-resolver';

export {
  findProjectForFile,
  LaunchProfile,
  ProfileDiscoveryEntry,
  ProjectProfile,
  splitCommandLineArgs,
} from './profile-resolver';

const SETTINGS_GLOB = '**/Properties/launchSettings.json';
const SETTINGS_EXCLUDE = '{**/node_modules/**,**/extensions/**,**/.git/**,**/bin/**,**/obj/**,**/packages/**}';

interface ParseProfilesResult {
  profiles: Record<string, LaunchProfile>;
  parseError?: unknown;
}

export async function discoverProjectProfiles(): Promise<ProjectProfile[]> {
  return runnableProfiles(await discoverProfileEntries());
}

export async function discoverProfileEntries(): Promise<ProfileDiscoveryEntry[]> {
  const uris = await vscode.workspace.findFiles(SETTINGS_GLOB, SETTINGS_EXCLUDE);
  const result: ProfileDiscoveryEntry[] = [];

  for (const uri of uris) {
    const launchSettingsPath = uri.fsPath;
    const projectDir = path.dirname(path.dirname(launchSettingsPath));
    const projectPath = await findCsprojIn(projectDir);
    const parsed = await parseProfiles(launchSettingsPath);

    result.push(...createProfileEntries({
      launchSettingsPath,
      projectPath,
      profiles: parsed.profiles,
      parseError: parsed.parseError,
    }));
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

async function parseProfiles(filePath: string): Promise<ParseProfilesResult> {
  try {
    const buf = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    const text = Buffer.from(buf).toString('utf8');
    const stripped = text
      .replace(/^\uFEFF/, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .trim();
    const data = JSON.parse(stripped);
    return { profiles: data?.profiles ?? {} };
  } catch (err) {
    console.warn(`[vssharp-runner] failed to parse ${filePath}:`, err);
    return { profiles: {}, parseError: err };
  }
}

export function profileLabel(p: ProjectProfile): string {
  return `${p.projectName} \u2022 ${p.profileName}`;
}

/**
 * Find the ProjectProfile whose projectDir is an ancestor of filePath.
 * Picks the most specific (longest dir) match.
 */
export function findProjectByFile(
  profiles: readonly ProjectProfile[],
  filePath: string,
): ProjectProfile | undefined {
  return findProjectForFile(profiles, filePath);
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
