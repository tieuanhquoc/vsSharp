import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export type IconPair = { light: vscode.Uri; dark: vscode.Uri };

interface ThemeJson {
  kindMap:        Record<string, string>;
  folderNames:    Record<string, string>;
  fileExtensions: Record<string, string>;
  fileNames:      Record<string, string>;
  file:           string;
  folder:         string;
}

interface IconEntry { dark: string; light: string }

export class IconResolver {
  private theme: ThemeJson | null = null;
  private index: Record<string, IconEntry> = {};
  private readonly iconsDir: string;

  constructor(extensionUri: vscode.Uri) {
    this.iconsDir = vscode.Uri.joinPath(extensionUri, 'media', 'icons').fsPath;
  }

  async load(): Promise<void> {
    // Scan in ascending priority — later wins for same icon name.
    await this.scanDir('jetbrains/fileTypes');         // classic file types
    await this.scanDir('jetbrains/nodes');             // classic nodes
    await this.scanDir('jetbrains/expui/fileTypes');   // new UI overrides classic
    await this.scanDir('jetbrains/expui/nodes');       // new UI overrides classic
    await this.scanDir('dotnet');                      // .NET specific — highest priority

    const raw = await fs.readFile(path.join(this.iconsDir, 'theme.json'), 'utf8');
    this.theme = JSON.parse(raw);
  }

  resolveKind(kind: 'solution' | 'project' | 'solution-folder'): IconPair | undefined {
    const key = this.theme?.kindMap[kind];
    return key ? this.pair(key) : undefined;
  }

  resolveFolder(name: string): IconPair | undefined {
    if (!this.theme) return undefined;
    const key = this.theme.folderNames[name.toLowerCase()] ?? this.theme.folder;
    return this.pair(key);
  }

  resolveFile(name: string): IconPair | undefined {
    if (!this.theme) return undefined;
    const lower = name.toLowerCase();

    const byName = this.theme.fileNames[name] ?? this.theme.fileNames[lower];
    if (byName) return this.pair(byName);

    const dot = lower.indexOf('.');
    if (dot < 0) return this.pair(this.theme.file);
    let ext = lower.slice(dot + 1);
    while (ext) {
      const key = this.theme.fileExtensions[ext];
      if (key) return this.pair(key);
      const next = ext.indexOf('.');
      if (next < 0) break;
      ext = ext.slice(next + 1);
    }
    return this.pair(this.theme.file);
  }

  private async scanDir(relDir: string): Promise<void> {
    const dir = path.join(this.iconsDir, relDir);
    const files = await fs.readdir(dir).catch(() => []);
    for (const f of files) {
      if (!f.endsWith('.svg')) continue;
      if (f.includes('@')) continue;  // skip @2x variants
      const isDark = f.endsWith('_dark.svg');
      const stem = isDark ? f.slice(0, -'_dark.svg'.length) : f.slice(0, -'.svg'.length);
      const key = stem.toLowerCase();
      if (!this.index[key]) this.index[key] = { dark: '', light: '' };
      const full = path.join(this.iconsDir, relDir, f);
      if (isDark) this.index[key].dark = full;
      else        this.index[key].light = full;
    }
  }

  private pair(key: string): IconPair | undefined {
    const entry = this.index[key.toLowerCase()];
    if (!entry) return undefined;
    const dark  = entry.dark  || entry.light;
    const light = entry.light || entry.dark;
    if (!dark || !light) return undefined;
    return { dark: vscode.Uri.file(dark), light: vscode.Uri.file(light) };
  }
}
