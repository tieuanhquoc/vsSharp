import * as vscode from 'vscode';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { openModal, renderModalHtml } from './modal-host';
import { TEMPLATE_CATALOG } from './project-templates';
import type { TreeNode } from '../explorer-tree-provider';

const exec = promisify(execFile);

interface CreatePayload {
  name: string;
  dir: string;
  template: string;
  framework: string;
  language: string;
  // Per-template options
  auth: string;            // 'None' | 'Individual' | 'SingleOrg' | 'MultiOrg' | 'Windows'
  configureHttps: boolean;
  enableOpenApi: boolean;
  useControllers: boolean;
  interactivity: string;   // 'Server' | 'WebAssembly' | 'Auto' | 'None'
  emptyContent: boolean;
  noTopLevel: boolean;
  enableAot: boolean;
  addDockerfile: boolean;
  addDockerCompose: boolean;
  nullable: string;
  solutionFolder: string;
}

export async function openNewProjectModal(
  ctx: vscode.ExtensionContext,
  node: TreeNode,
  refresh: () => void,
): Promise<void> {
  const productIconsExt = vscode.extensions.getExtension('vssharp.vssharp-product-icons');
  const iconPath = productIconsExt
    ? vscode.Uri.joinPath(productIconsExt.extensionUri, 'icons', 'expui', 'tw_project.svg')
    : undefined;
  const panel = await openModal(ctx, { title: 'New Project', width: 900, height: 580, iconPath });
  panel.webview.html = await renderModalHtml(panel, ctx, 'new-project.html');

  const slnPath = slnPathFrom(node);
  const defaultDir = slnPath ? path.dirname(slnPath)
    : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Fetch dotnet info + available templates in parallel, don't block panel opening
  Promise.all([getSdkVersion(), getTargetFrameworks(), getAvailableTemplates()]).then(([sdk, frameworks, templates]) => {
    panel.webview.postMessage({ type: 'init', dir: defaultDir, sdk, frameworks, templates });
  });

  panel.webview.onDidReceiveMessage(async (msg: { type: string } & Record<string, any>) => {
    switch (msg.type) {
      case 'ready':
        // Send placeholder immediately so the form shows without waiting for dotnet
        panel.webview.postMessage({
          type: 'init',
          dir: defaultDir,
          sdk: '…',
          frameworks: ['net10.0', 'net9.0', 'net8.0'],
          templates: TEMPLATE_CATALOG,  // full catalog as placeholder; filtered list sent when dotnet resolves
        });
        break;

      case 'cancel':
        panel.dispose();
        break;

      case 'browsedir': {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: vscode.Uri.file(defaultDir),
          openLabel: 'Select Folder',
        });
        if (uris?.[0]) panel.webview.postMessage({ type: 'dirSelected', dir: uris[0].fsPath });
        break;
      }

      case 'manageTemplates':
        vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/dotnet-new-templates'));
        break;

      case 'create':
        await handleCreate(msg as CreatePayload & { type: string }, slnPath, panel, refresh);
        break;
    }
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

async function handleCreate(
  msg: CreatePayload & { type: string },
  slnPath: string | undefined,
  panel: vscode.WebviewPanel,
  refresh: () => void,
): Promise<void> {
  const catalog  = TEMPLATE_CATALOG.find(t => t.id === msg.template);
  const tmplName = catalog?.dotnetName ?? msg.template;
  const projDir  = path.join(msg.dir, msg.name);

  const args = [
    'new', tmplName,
    '-n', msg.name,
    '-o', projDir,
    '-f', msg.framework,
    '--language', msg.language,
    '--force',
  ];

  if (msg.auth && msg.auth !== 'None')  args.push('--auth', msg.auth);
  if (!msg.configureHttps)              args.push('--no-https');
  if (!msg.enableOpenApi)               args.push('--no-openapi');
  if (msg.useControllers)               args.push('--use-controllers');
  if (msg.interactivity)                args.push('--interactivity', msg.interactivity);
  if (msg.emptyContent)                 args.push('--empty');
  if (msg.noTopLevel)                   args.push('--use-program-main');
  if (msg.enableAot)                    args.push('--aot');
  if (msg.nullable)                     args.push('--nullable', msg.nullable);

  try {
    panel.webview.postMessage({ type: 'creating' });
    await exec('dotnet', args);

    if (slnPath) await addToSolution(slnPath, projDir, msg.name);

    refresh();
    panel.dispose();
    vscode.window.showInformationMessage(`Project "${msg.name}" created successfully.`);
  } catch (e: any) {
    panel.webview.postMessage({ type: 'createError', message: e.message ?? String(e) });
  }
}

async function addToSolution(slnPath: string, projDir: string, name: string): Promise<void> {
  const exts = ['csproj', 'fsproj', 'vbproj'];
  for (const ext of exts) {
    try {
      await exec('dotnet', ['sln', slnPath, 'add', path.join(projDir, `${name}.${ext}`)]);
      return;
    } catch { /* try next extension */ }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function slnPathFrom(node: TreeNode): string | undefined {
  if (node.kind === 'solution') return node.sln.filePath;
  if (node.kind === 'solution-folder') return node.slnFilePath;
  return undefined;
}

async function getSdkVersion(): Promise<string> {
  try {
    const { stdout } = await exec('dotnet', ['--version']);
    const parts = stdout.trim().split('.');
    return `${parts[0]}.${parts[1]}`;
  } catch {
    return '?';
  }
}

async function getTargetFrameworks(): Promise<string[]> {
  try {
    const { stdout } = await exec('dotnet', ['--list-sdks']);
    const seen = new Set<string>();
    stdout.trim().split('\n').forEach(line => {
      const major = parseInt(line.split('.')[0]);
      if (!isNaN(major)) seen.add(`net${major}.0`);
    });
    return [...seen].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } catch {
    return ['net10.0', 'net9.0', 'net8.0'];
  }
}

// Filter TEMPLATE_CATALOG to only templates installed on this machine
async function getAvailableTemplates() {
  const available = await getInstalledDotnetTemplates();
  // If dotnet is not found, show full catalog (fail-open)
  if (available.size === 0) return TEMPLATE_CATALOG;
  return TEMPLATE_CATALOG.filter(t => available.has(t.dotnetName));
}

// Run `dotnet new list` and return the set of available short names
async function getInstalledDotnetTemplates(): Promise<Set<string>> {
  try {
    const { stdout } = await exec('dotnet', ['new', 'list']);
    const lines = stdout.split('\n');
    const headerIdx = lines.findIndex(l => /Short Name/i.test(l));
    if (headerIdx < 0) return new Set();
    const col = lines[headerIdx].indexOf('Short Name');
    const available = new Set<string>();
    for (let i = headerIdx + 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim() || line.startsWith('-')) continue;
      // Each short name cell may contain comma-separated aliases (e.g. "web,webapp")
      const cell = line.substring(col).trim().split(/\s{2,}/)[0];
      cell.split(',').forEach(s => available.add(s.trim()));
    }
    return available;
  } catch {
    return new Set();
  }
}

