#!/usr/bin/env node
// vssharp-icons: VS Code file icon theme builder.
//
// Scans JetBrains SVG dirs → builds media/vssharp-jetbrains-icons.json
// in VS Code file icon theme format (iconPath-based, light+dark).
//
// Priority order (later wins same key):
//   jetbrains/fileTypes  →  jetbrains/file-types  →  jetbrains/expui/fileTypes
//   →  jetbrains/expui/nodes  →  jetbrains/nodes  →  dotnet

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT    = resolve(__dirname, '..');
const MEDIA_DIR   = join(EXT_ROOT, 'media');
const ICONS_DIR   = join(MEDIA_DIR, 'icons');
const OUT_FILE    = join(MEDIA_DIR, 'vssharp-file-icons.json');
const THEME_FILE  = join(ICONS_DIR, 'theme.json');  // read by icon-resolver.ts

// Icon path relative to the output JSON file (which is at media/)
const rel = (absPath) => './' + absPath.slice(MEDIA_DIR.length + 1).replace(/\\/g, '/');

// --- 1. Build icon index -----------------------------------------------
// Scan directories in increasing priority. Later dirs override same key.
const SCAN_DIRS = [
  'jetbrains/fileTypes',
  'jetbrains/nodes',
  'jetbrains/file-types',
  'jetbrains/expui/fileTypes',
  'jetbrains/expui/nodes',
  'dotnet',
];

// index: lowercased stem → { light: absPath, dark: absPath }
const index = {};
for (const d of SCAN_DIRS) {
  const full = join(ICONS_DIR, d);
  if (!existsSync(full)) continue;
  for (const f of readdirSync(full)) {
    if (!f.endsWith('.svg') || f.includes('@')) continue;
    const isDark = f.endsWith('_dark.svg');
    const stem = isDark ? f.slice(0, -'_dark.svg'.length) : f.slice(0, -'.svg'.length);
    const key = stem.toLowerCase();
    if (!index[key]) index[key] = { light: '', dark: '' };
    const abs = join(ICONS_DIR, d, f);
    if (isDark) index[key].dark = abs;
    else        index[key].light = abs;
  }
}

// Helper: resolve an icon key to { light, dark } paths.
// If only one variant exists, use it for both.
// Returns null if not found.
function resolve_icon(key) {
  const e = index[key.toLowerCase()];
  if (!e) return null;
  const light = e.light || e.dark;
  const dark  = e.dark  || e.light;
  if (!light && !dark) return null;
  return { light, dark };
}

// --- 2. Define all file extension / name / folder mappings ---------------
// Maps from "icon key" (matching index) to list of:
//   { ext: [...] }   → fileExtensions
//   { name: [...] }  → fileNames
//   { folder: [...] } → folderNames
//   { kind: string }  → special (file, folder, folderExpanded)

const ICON_GROUPS = [
  // ── Folders ──
  { key: 'folder',         folder: [] },        // default folder
  { key: 'foldergithub',   folder: ['.github'] },
  { key: 'libraryfolder',  folder: ['node_modules', 'packages'] },
  { key: 'logfolder',      folder: ['logs', '.logs'] },
  { key: 'webfolder',      folder: ['wwwroot', 'public', 'static', 'assets'] },
  { key: 'annotationFolder', folder: ['migrations'] },
  { key: 'homefolder',     folder: ['.git'] },

  // ── .NET / C# ──
  { key: 'cs',             ext: ['cs'] },
  { key: 'cshtml',         ext: ['cshtml', 'razor'] },
  { key: 'csproj',         ext: ['csproj', 'fsproj', 'vbproj', 'vcxproj', 'shproj', 'sqlproj'] },
  { key: 'solution',       ext: ['sln', 'slnx'], name: [] },

  // ── Web ──
  { key: 'html',           ext: ['html', 'htm', 'xhtml', 'aspx', 'ascx'] },
  { key: 'css',            ext: ['css'] },
  { key: 'sass',           ext: ['scss', 'sass'] },
  { key: 'less',           ext: ['less'] },
  { key: 'javascript',     ext: ['js', 'mjs', 'cjs'] },
  { key: 'typescript',     ext: ['ts', 'mts', 'cts'] },
  { key: 'react',          ext: ['jsx', 'tsx'] },
  { key: 'vue',            ext: ['vue'] },
  { key: 'svelte',         ext: ['svelte'] },

  // ── Data / Config ──
  { key: 'json',           ext: ['json', 'jsonc', 'json5'] },
  { key: 'schema',         ext: ['jsonschema'] },
  { key: 'xml',            ext: ['xml', 'xaml', 'resx', 'targets', 'props', 'nuspec', 'csproj_broken'] },
  { key: 'yaml',           ext: ['yaml', 'yml'] },
  { key: 'toml',           ext: ['toml'] },
  { key: 'config',         ext: ['config', 'cfg', 'conf', 'ini'] },
  { key: 'properties',     ext: ['properties', 'env'] },
  { key: 'editorconfig',   ext: ['editorconfig'] },

  // ── Markup / Docs ──
  { key: 'markdown',       ext: ['md', 'mdx'] },
  { key: 'mdx',            ext: [] },  // mdx handled above
  { key: 'tex',            ext: ['tex', 'latex'] },
  { key: 'pdf',            ext: ['pdf'] },

  // ── Data ──
  { key: 'sql',            ext: ['sql'] },
  { key: 'csv',            ext: ['csv', 'tsv'] },
  { key: 'database',       ext: ['db', 'sqlite', 'sqlite3'] },

  // ── Shell / Scripts ──
  { key: 'shell',          ext: ['sh', 'bash', 'zsh', 'fish'] },
  { key: 'powershell',     ext: ['ps1', 'psm1', 'psd1'] },
  { key: 'batch',          ext: ['bat', 'cmd'] },
  { key: 'makefile',       name: ['Makefile', 'makefile', 'GNUmakefile'] },

  // ── Systems / Native ──
  { key: 'c',              ext: ['c'] },
  { key: 'cpp',            ext: ['cpp', 'cc', 'cxx', 'c++'] },
  { key: 'header',         ext: ['h', 'hpp', 'hxx', 'hh'] },
  { key: 'rust',           ext: ['rs'] },
  { key: 'go',             ext: ['go'] },
  { key: 'zig',            ext: ['zig'] },
  { key: 'wasm',           ext: ['wasm', 'wat'] },

  // ── JVM ──
  { key: 'java',           ext: ['java'] },
  { key: 'kotlin',         ext: ['kt', 'kts'] },
  { key: 'scala',          ext: ['scala', 'sc'] },
  { key: 'groovy',         ext: ['groovy', 'gradle'] },
  { key: 'clojure',        ext: ['clj', 'cljs', 'cljc', 'edn'] },

  // ── Scripting ──
  { key: 'python',         ext: ['py', 'pyw', 'pyi'] },
  { key: 'ruby',           ext: ['rb', 'rake', 'gemspec'] },
  { key: 'perl',           ext: ['pl', 'pm', 'perl'] },
  { key: 'lua',            ext: ['lua'] },
  { key: 'r',              ext: ['r', 'R', 'rmd'] },
  { key: 'julia',          ext: ['jl'] },
  { key: 'swift',          ext: ['swift'] },
  { key: 'php',            ext: ['php', 'php3', 'php4', 'php5', 'phtml'] },
  { key: 'elixir',         ext: ['ex', 'exs', 'eex', 'leex'] },
  { key: 'erlang',         ext: ['erl', 'hrl'] },
  { key: 'haskell',        ext: ['hs', 'lhs'] },
  { key: 'dart',           ext: ['dart'] },
  { key: 'ocaml',          ext: ['ml', 'mli'] },
  { key: 'elm',            ext: ['elm'] },

  // ── Infra / DevOps ──
  { key: 'docker',         ext: ['dockerfile'], name: ['Dockerfile', 'dockerfile', '.dockerignore'] },
  { key: 'terraform',      ext: ['tf', 'tfvars', 'hcl'] },
  { key: 'bicep',          ext: ['bicep'] },
  { key: 'graphql',        ext: ['graphql', 'gql'] },

  // ── Media ──
  { key: 'image',          ext: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp', 'bmp', 'tiff', 'avif'] },
  { key: 'font',           ext: ['ttf', 'otf', 'woff', 'woff2', 'eot'] },
  { key: 'video',          ext: ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'] },
  { key: 'audio',          ext: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },

  // ── Archives ──
  { key: 'archive',        ext: ['zip', 'tar', 'gz', 'bz2', '7z', 'rar', 'xz', 'tgz'] },

  // ── Misc ──
  { key: 'git',            name: ['.gitignore', '.gitattributes', '.gitmodules'] },
  { key: 'text',           ext: ['txt', 'log'] },
  { key: 'diff',           ext: ['diff', 'patch'] },
  { key: 'regexp',         ext: [] },
  { key: 'license',        name: ['LICENSE', 'LICENSE.md', 'LICENSE.txt'] },
  { key: 'cmake',          ext: ['cmake'], name: ['CMakeLists.txt'] },
  { key: 'yarn',           name: ['yarn.lock', '.yarnrc', '.yarnrc.yml'] },
  { key: 'webpack',        name: ['webpack.config.js', 'webpack.config.ts'] },
  { key: 'jest',           name: ['jest.config.js', 'jest.config.ts', 'jest.config.mjs'] },
];

// --- 3. Build VS Code icon theme structure ----------------------------
const iconDefs = {};           // key → { iconPath } (dark default)
const iconDefsLight = {};      // key → { iconPath } (light override)
const fileExtMap = {};
const fileNameMap = {};
const folderNameMap = {};
const folderNameExpandedMap = {};

// Find folder-open icon (for folderExpanded)
const folderOpenIcon = resolve_icon('folderopen') || resolve_icon('folder');

let usedKeys = 0;
let skippedKeys = [];

for (const group of ICON_GROUPS) {
  const icon = resolve_icon(group.key);
  if (!icon) {
    skippedKeys.push(group.key);
    continue;
  }
  usedKeys++;

  // Register icon definition (dark)
  iconDefs[`_${group.key}`]      = { iconPath: rel(icon.dark)  };
  iconDefsLight[`_${group.key}`] = { iconPath: rel(icon.light) };

  if (group.ext) {
    for (const e of group.ext) fileExtMap[e] = `_${group.key}`;
  }
  if (group.name) {
    for (const n of group.name) fileNameMap[n] = `_${group.key}`;
  }
  if (group.folder) {
    for (const fn of group.folder) {
      folderNameMap[fn]         = `_${group.key}`;
      folderNameExpandedMap[fn] = `_${group.key}`;
    }
  }
}

// Default file / folder
const fileDefault   = resolve_icon('text') ?? resolve_icon('unknown');
const folderDefault = resolve_icon('folder');

if (fileDefault) {
  iconDefs['_file']      = { iconPath: rel(fileDefault.dark)  };
  iconDefsLight['_file'] = { iconPath: rel(fileDefault.light) };
}
if (folderDefault) {
  iconDefs['_folder']      = { iconPath: rel(folderDefault.dark)  };
  iconDefsLight['_folder'] = { iconPath: rel(folderDefault.light) };
}
if (folderOpenIcon) {
  iconDefs['_folder_open']      = { iconPath: rel(folderOpenIcon.dark)  };
  iconDefsLight['_folder_open'] = { iconPath: rel(folderOpenIcon.light) };
}

// --- 4. Assemble theme JSON ------------------------------------------
const theme = {
  iconDefinitions: iconDefs,
  file:            '_file',
  folder:          '_folder',
  folderExpanded:  '_folder',
  fileExtensions:  fileExtMap,
  fileNames:       fileNameMap,
  folderNames:     folderNameMap,
  folderNamesExpanded: folderNameExpandedMap,
  hidesExplorerArrows: false,
  light: {
    iconDefinitions: iconDefsLight,
    file:   '_file',
    folder: '_folder',
  },
};

writeFileSync(OUT_FILE, JSON.stringify(theme, null, 2));
console.log(`[build-theme] ✓ ${usedKeys} icon groups resolved.`);
if (skippedKeys.length) console.log(`[build-theme] ⚠ skipped (no SVG found): ${skippedKeys.join(', ')}`);
console.log(`[build-theme] Output: ${OUT_FILE}`);

// --- 5. Generate theme.json for icon-resolver.ts (used by vssharp-explorer) ---
// Format: { kindMap, folderNames, fileExtensions, fileNames, file, folder }
// Values are lowercased icon stem keys (as stored in IconResolver.index).

const themeJson = {
  kindMap: {
    'solution':        'solution',
    'project':         'csproj',
    'solution-folder': 'folder',
  },
  file:   'text',
  folder: 'folder',
  fileExtensions: {},
  fileNames:      {},
  folderNames:    {},
};

for (const group of ICON_GROUPS) {
  const icon = resolve_icon(group.key);
  if (!icon) continue;
  const k = group.key.toLowerCase();

  if (group.ext) {
    for (const e of group.ext) themeJson.fileExtensions[e] = k;
  }
  if (group.name) {
    for (const n of group.name) themeJson.fileNames[n] = k;
  }
  if (group.folder) {
    for (const fn of group.folder) themeJson.folderNames[fn] = k;
  }
}

writeFileSync(THEME_FILE, JSON.stringify(themeJson, null, 2));
console.log(`[build-theme] Output: ${THEME_FILE}`);
