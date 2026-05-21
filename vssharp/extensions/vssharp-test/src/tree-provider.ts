import * as vscode from 'vscode';

type Tab = 'solution' | 'files';

export class TestTreeProvider implements vscode.TreeDataProvider<Item>, vscode.Disposable {
  private readonly _onChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onChange.event;

  private _tab: Tab = 'solution';

  setTab(tab: Tab) {
    this._tab = tab;
    this._onChange.fire();
  }

  getTreeItem(item: Item): vscode.TreeItem {
    const ti = new vscode.TreeItem(item.label, item.children
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None);
    ti.contextValue   = item.ctx ?? 'item';
    ti.description    = item.desc;
    ti.iconPath       = item.icon ? new vscode.ThemeIcon(item.icon) : undefined;
    ti.tooltip        = item.label;
    return ti;
  }

  getChildren(parent?: Item): Item[] {
    if (parent) return parent.children ?? [];
    return this._tab === 'solution' ? this.solutionItems() : this.filesItems();
  }

  private solutionItems(): Item[] {
    return [
      { label: 'MySolution.sln', icon: 'file', ctx: 'solution', children: [
        { label: 'MyProject', icon: 'folder', ctx: 'project', desc: 'src/MyProject.csproj', children: [
          { label: 'Controllers', icon: 'folder', ctx: 'dir', children: [
            { label: 'HomeController.cs', icon: 'file', ctx: 'file' },
          ]},
          { label: 'Program.cs', icon: 'file', ctx: 'file' },
        ]},
      ]},
    ];
  }

  private filesItems(): Item[] {
    return [
      { label: 'src',         icon: 'folder', ctx: 'dir', children: [
        { label: 'index.ts',  icon: 'file',   ctx: 'file' },
        { label: 'main.ts',   icon: 'file',   ctx: 'file' },
      ]},
      { label: '.gitignore',  icon: 'file',   ctx: 'file' },
      { label: 'README.md',   icon: 'file',   ctx: 'file' },
    ];
  }

  dispose() { this._onChange.dispose(); }
}

interface Item {
  label:     string;
  icon?:     string;
  ctx?:      string;
  desc?:     string;
  children?: Item[];
}
