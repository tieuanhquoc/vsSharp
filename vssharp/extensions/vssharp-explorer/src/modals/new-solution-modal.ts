import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { openModal, renderModalHtml } from './modal-host';

const exec = promisify(execFile);

export async function openNewSolutionModal(ctx: vscode.ExtensionContext): Promise<void> {
  const panel = await openModal(ctx, { title: 'New Solution', width: 560, height: 340 });
  panel.webview.html = await renderModalHtml(panel, ctx, 'new-solution.html');

  const defaultDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir();

  panel.webview.onDidReceiveMessage(async (msg: { type: string } & Record<string, any>) => {
    switch (msg.type) {
      case 'ready':
        panel.webview.postMessage({ type: 'init', dir: defaultDir });
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

      case 'create':
        await handleCreate(msg.name?.trim(), msg.dir?.trim(), panel);
        break;
    }
  });
}

async function handleCreate(
  name: string,
  dir: string,
  panel: vscode.WebviewPanel,
): Promise<void> {
  const slnDir = path.join(dir, name);
  try {
    panel.webview.postMessage({ type: 'creating' });
    // dotnet new sln creates <name>.sln inside the output directory
    await exec('dotnet', ['new', 'sln', '-n', name, '-o', slnDir]);
    panel.dispose();

    const choice = await vscode.window.showInformationMessage(
      `Solution "${name}" created.`,
      'Open Folder',
      'Add to Workspace',
    );
    if (choice === 'Open Folder') {
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(slnDir));
    } else if (choice === 'Add to Workspace') {
      vscode.workspace.updateWorkspaceFolders(
        vscode.workspace.workspaceFolders?.length ?? 0,
        0,
        { uri: vscode.Uri.file(slnDir) },
      );
    }
  } catch (e: any) {
    panel.webview.postMessage({ type: 'createError', message: e.message ?? String(e) });
  }
}
