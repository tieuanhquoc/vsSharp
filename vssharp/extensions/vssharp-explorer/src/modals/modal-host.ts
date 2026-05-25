import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

// MODAL_GROUP = -4: VS Sharp workbench patch routes this viewColumn value to
// createModalEditorPart(), opening the webview as a floating overlay like the
// built-in Profile/Settings editors (editorGroupFinder.ts line 140).
const MODAL_VIEW_COLUMN = -4 as vscode.ViewColumn;

// Base viewType for all vssharp modals. When size is provided, it is encoded
// as "@WxH" suffix so mainThreadWebviewPanels.ts can set ModalEditorPart size.
const MODAL_VIEWTYPE_BASE = 'vssharp.modal';

export interface ModalOptions {
  title: string;
  /** Desired width of the ModalEditorPart dialog in pixels. */
  width?: number;
  /** Desired height of the ModalEditorPart dialog in pixels. */
  height?: number;
  /** Icon shown in the modal header next to the title. */
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri };
}

export async function openModal(
  ctx: vscode.ExtensionContext,
  opts: ModalOptions,
): Promise<vscode.WebviewPanel> {
  return createModalPanel(ctx, opts);
}

export function createModalPanel(
  ctx: vscode.ExtensionContext,
  opts: ModalOptions,
): vscode.WebviewPanel {
  const iconsExt = vscode.extensions.getExtension('vssharp.vssharp-icons');
  const localRoots: vscode.Uri[] = [
    vscode.Uri.joinPath(ctx.extensionUri, 'extension', 'media'),
  ];
  if (iconsExt) localRoots.push(vscode.Uri.joinPath(iconsExt.extensionUri, 'media'));

  const sizeTag = opts.width && opts.height ? `@${opts.width}x${opts.height}` : '';
  const panel = vscode.window.createWebviewPanel(
    `${MODAL_VIEWTYPE_BASE}${sizeTag}`,
    opts.title,
    { viewColumn: MODAL_VIEW_COLUMN, preserveFocus: false },
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: localRoots,
    },
  );
  if (opts.iconPath) panel.iconPath = opts.iconPath;
  return panel;
}

export async function renderModalHtml(
  panel: vscode.WebviewPanel,
  ctx: vscode.ExtensionContext,
  htmlFile: string,
): Promise<string> {
  const modalDir = vscode.Uri.joinPath(ctx.extensionUri, 'extension', 'media', 'modal');
  const raw = await fs.readFile(path.join(modalDir.fsPath, htmlFile), 'utf8');

  const iconsExt = vscode.extensions.getExtension('vssharp.vssharp-icons');
  const iconsBase = iconsExt
    ? panel.webview.asWebviewUri(vscode.Uri.joinPath(iconsExt.extensionUri, 'media')).toString()
    : '';

  const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(modalDir, 'modal.css')).toString();
  const jsUri  = panel.webview.asWebviewUri(vscode.Uri.joinPath(modalDir, 'modal.js')).toString();
  const nonce  = makeNonce();

  return raw
    .replace(/\{\{cspSource\}\}/g, panel.webview.cspSource)
    .replace(/\{\{nonce\}\}/g, nonce)
    .replace(/\{\{cssUri\}\}/g, cssUri)
    .replace(/\{\{jsUri\}\}/g, jsUri)
    .replace(/\{\{iconsBase\}\}/g, iconsBase);
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
