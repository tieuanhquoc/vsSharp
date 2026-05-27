import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ResolveTargetPathOptions {
  dotnetPath: string;
  projectPath: string;
  configuration: string;
  targetFramework?: string;
  cwd: string;
}

export function parseTargetFrameworkFromProjectXml(xml: string): string | undefined {
  const single = /<TargetFramework>([^<]+)<\/TargetFramework>/i.exec(xml);
  if (single) return single[1].trim();
  const multi = /<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i.exec(xml);
  if (multi) return multi[1].split(';')[0].trim();
  return undefined;
}

export function buildTargetPathArgs(
  projectPath: string,
  configuration: string,
  targetFramework?: string,
): string[] {
  const args = [
    'msbuild',
    projectPath,
    '-nologo',
    '-getProperty:TargetPath',
    `-p:Configuration=${configuration}`,
  ];

  if (targetFramework) {
    args.push(`-p:TargetFramework=${targetFramework}`);
  }

  return args;
}

export function parseMsbuildPropertyOutput(stdout: string): string | undefined {
  const lines = stdout
    .split(/\r?\n/g)
    .map(line => line.trim())
    .filter(Boolean);
  return lines[lines.length - 1];
}

export async function resolveTargetPath(options: ResolveTargetPathOptions): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(
      options.dotnetPath,
      buildTargetPathArgs(options.projectPath, options.configuration, options.targetFramework),
      { cwd: options.cwd, encoding: 'utf8', windowsHide: true },
    );
    const targetPath = parseMsbuildPropertyOutput(stdout);
    if (!targetPath) return undefined;
    return path.isAbsolute(targetPath) ? targetPath : path.resolve(options.cwd, targetPath);
  } catch {
    return undefined;
  }
}
