import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TestTreeProvider } from './tree-provider';

export function activate(ctx: vscode.ExtensionContext) {
  const tree    = new TestTreeProvider();
  const treeView = vscode.window.createTreeView('vssharp-test.tree', {
    treeDataProvider: tree,
    showCollapseAll: false,
  });
  treeView.title       = '';
  treeView.description = '';

  // WebviewView for the tab bar
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider('vssharp-test.tabs', {
      resolveWebviewView(view) {
        view.webview.options = { enableScripts: true };
        view.webview.html    = buildHtml(ctx, view.webview);

        view.webview.onDidReceiveMessage(msg => {
          if (msg.type === 'switchTab') {
            tree.setTab(msg.tab);
          }
        });
      },
    }),
    treeView,
    tree,

    // Test context menu command
    vscode.commands.registerCommand('vssharp-test.switchTab', async (item) => {
      const pick = await vscode.window.showQuickPick(
        ['Action A', 'Action B', 'Action C'],
        { title: `Context menu — ${item?.label ?? '?'}`, placeHolder: 'Select action' }
      );
      if (pick) vscode.window.showInformationMessage(`Picked: ${pick}`);
    }),
  );
}

export function deactivate() {}

function buildHtml(ctx: vscode.ExtensionContext, webview: vscode.Webview): string {
  const nonce   = Math.random().toString(36).slice(2);
  const tplPath = path.join(ctx.extensionPath, 'extension', 'media', 'tabs.html');
  return fs.readFileSync(tplPath, 'utf8').replace(/\{\{nonce\}\}/g, nonce);
}
