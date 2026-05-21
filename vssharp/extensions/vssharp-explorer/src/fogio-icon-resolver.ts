import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

const EXT_ALIAS: Record<string, string> = {
  slnx: 'sln',
  fsproj: 'csproj', vbproj: 'csproj', vcxproj: 'csproj',
  aspx: 'cshtml', ascx: 'cshtml', vbhtml: 'cshtml',
};

const KIND_KEY: Record<string, string> = {
  solution: 'file_sln',
  project: 'folder_module',
  'solution-folder': 'folder_project',
};

export type IconPair = { light: vscode.Uri; dark: vscode.Uri };

export class FogioIconResolver {
  private dark: any = null;
  private light: any = null;
  private readonly fogioDir: string;

  constructor(extensionUri: vscode.Uri) {
    this.fogioDir = vscode.Uri.joinPath(extensionUri, 'extension', 'media', 'icons', 'fogio').fsPath;
  }

  async load(): Promise<void> {
    const [d, l] = await Promise.all([
      fs.readFile(path.join(this.fogioDir, 'dark.json'), 'utf8'),
      fs.readFile(path.join(this.fogioDir, 'light.json'), 'utf8'),
    ]);
    this.dark = JSON.parse(d);
    this.light = JSON.parse(l);
  }

  resolveFile(name: string): IconPair | undefined {
    return this.pair(t => {
      const lower = name.toLowerCase();
      const byName = t.fileNames?.[lower] ?? t.fileNames?.[name];
      if (byName) return byName;
      const dot = lower.indexOf('.');
      if (dot < 0) return t.file;
      let ext = lower.slice(dot + 1);
      while (ext) {
        const key = t.fileExtensions?.[EXT_ALIAS[ext] ?? ext];
        if (key) return key;
        const next = ext.indexOf('.');
        if (next < 0) break;
        ext = ext.slice(next + 1);
      }
      return t.file;
    });
  }

  resolveFolder(name: string): IconPair | undefined {
    return this.pair(t => t.folderNames?.[name.toLowerCase()] ?? t.folder);
  }

  resolveKind(kind: 'solution' | 'project' | 'solution-folder'): IconPair | undefined {
    const key = KIND_KEY[kind];
    return key ? this.pair(() => key) : undefined;
  }

  private pair(getKey: (t: any) => string | undefined): IconPair | undefined {
    if (!this.dark || !this.light) return undefined;
    const d = this.keyToUri(this.dark, getKey(this.dark));
    const l = this.keyToUri(this.light, getKey(this.light));
    return d && l ? { dark: d, light: l } : undefined;
  }

  private keyToUri(theme: any, key: string | undefined): vscode.Uri | undefined {
    if (!key) return undefined;
    const def = theme?.iconDefinitions?.[key];
    if (!def?.iconPath) return undefined;
    const rel = def.iconPath.replace(/^\.\/icons\//, '');
    return vscode.Uri.file(path.join(this.fogioDir, rel));
  }
}
