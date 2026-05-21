// Minimal .csproj inspector — surfaces TargetFramework, package refs, and
// project refs so the Solution tab can show project metadata.
// Real item enumeration (Compile/Content/EmbeddedResource globs) is Phase 3.

import * as vscode from 'vscode';

export interface CsprojSummary {
  filePath: string;
  targetFramework?: string;
  targetFrameworks: string[];
  packageReferences: { name: string; version?: string }[];
  projectReferences: string[];   // resolved absolute paths
  outputType?: string;
}

export async function parseCsproj(filePath: string): Promise<CsprojSummary> {
  const summary: CsprojSummary = {
    filePath,
    targetFrameworks: [],
    packageReferences: [],
    projectReferences: [],
  };
  try {
    const buf = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    const text = Buffer.from(buf).toString('utf8');

    const tf = matchFirst(text, /<TargetFramework>([^<]+)<\/TargetFramework>/i);
    if (tf) {
      summary.targetFramework = tf.trim();
      summary.targetFrameworks = [tf.trim()];
    } else {
      const tfs = matchFirst(text, /<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i);
      if (tfs) summary.targetFrameworks = tfs.split(';').map(s => s.trim()).filter(Boolean);
    }

    const out = matchFirst(text, /<OutputType>([^<]+)<\/OutputType>/i);
    if (out) summary.outputType = out.trim();

    const pkgRe = /<PackageReference\s+([^>]*?)\/?>(?:[\s\S]*?<\/PackageReference>)?/gi;
    let m: RegExpExecArray | null;
    while ((m = pkgRe.exec(text)) !== null) {
      const attrs = m[1];
      const include = attrFromTag(attrs, 'Include');
      const version = attrFromTag(attrs, 'Version');
      if (include) summary.packageReferences.push({ name: include, version });
    }

    const refRe = /<ProjectReference\s+([^>]*?)\/?>(?:[\s\S]*?<\/ProjectReference>)?/gi;
    while ((m = refRe.exec(text)) !== null) {
      const include = attrFromTag(m[1], 'Include');
      if (include) summary.projectReferences.push(include.replace(/\\/g, '/'));
    }
  } catch {
    /* return empty summary */
  }
  return summary;
}

function matchFirst(text: string, re: RegExp): string | undefined {
  const m = re.exec(text);
  return m ? m[1] : undefined;
}

function attrFromTag(attrs: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`, 'i');
  const m = re.exec(attrs);
  return m ? m[1] : undefined;
}
