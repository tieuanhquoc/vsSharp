import * as vscode from 'vscode';

type Tab = 'solution' | 'files';
type TabChangedCallback = (tab: Tab) => void;
type ToggleShowAllCallback = () => void;

// breakpointFieldMuted SVG as CSS mask data URI — same technique as main.css .tool-btn-icon.
// Single-quote delimiters inside url() so the inner SVG attribute double-quotes are safe.
const EYE_MASK_URL = `url('data:image/svg+xml;utf8,<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 9C8.10457 9 9 8.10457 9 7C9 5.89543 8.10457 5 7 5C5.89543 5 5 5.89543 5 7C5 8.10457 5.89543 9 7 9Z" fill="black"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7 2C3.64058 2 0.75 4.32822 0 7C0.75 9.67178 3.64058 12 7 12C10.3594 12 13.25 9.67178 14 7C13.25 4.32822 10.3594 2 7 2ZM10.5 7C10.5 8.933 8.933 10.5 7 10.5C5.067 10.5 3.5 8.933 3.5 7C3.5 5.067 5.067 3.5 7 3.5C8.933 3.5 10.5 5.067 10.5 7Z" fill="black"/></svg>') center / 14px 14px no-repeat`;

export class ExplorerTabsProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = 'vssharp.explorer.tabs';

  private view?: vscode.WebviewView;
  private tabChangedCb?: TabChangedCallback;
  private toggleShowAllCb?: ToggleShowAllCallback;
  private currentShowAll = false;

  constructor(private readonly ctx: vscode.ExtensionContext) {}

  onDidChangeTab(cb: TabChangedCallback): void { this.tabChangedCb = cb; }
  onDidToggleShowAll(cb: ToggleShowAllCallback): void { this.toggleShowAllCb = cb; }

  /** Called by the tree provider after it applies the toggle — keeps button state in sync. */
  setShowAll(val: boolean): void {
    this.currentShowAll = val;
    this.view?.webview.postMessage({ type: 'syncShowAll', showAll: val });
  }

  /** Sync active tab pill from tree provider (e.g. auto-switch when no .sln found). */
  setActiveTab(tab: Tab): void {
    this.view?.webview.postMessage({ type: 'syncTab', tab });
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.renderHtml();
    view.webview.onDidReceiveMessage((msg: { type: string; tab?: string }) => {
      if (msg.type === 'switchTab' && (msg.tab === 'solution' || msg.tab === 'files')) {
        this.tabChangedCb?.(msg.tab);
      }
      if (msg.type === 'toggleShowAll') {
        this.toggleShowAllCb?.();
      }
    });
    view.onDidDispose(() => { this.view = undefined; });
  }

  private renderHtml(): string {
    const defaultTab = vscode.workspace.getConfiguration('vssharp.explorer')
      .get<string>('defaultTab', 'solution');
    const nonce = makeNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'nonce-${nonce}';" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; }
    body {
      display: flex;
      align-items: center;
      height: 100%;
      padding: 0 6px;
      background: transparent;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    .tab {
      border: none;
      background: transparent;
      color: var(--vscode-foreground);
      padding: 3px 10px;
      border-radius: 5px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      opacity: 0.65;
      transition: background 120ms, opacity 120ms;
      white-space: nowrap;
    }
    .tab:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.07)); }
    .tab.active { opacity: 1; background: var(--vscode-toolbar-activeBackground, rgba(255,255,255,0.14)); }
    .spacer { flex: 1 1 auto; min-width: 4px; }
    .eye-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      opacity: 0.65;
      transition: background 100ms, opacity 100ms;
      flex-shrink: 0;
    }
    .eye-btn:hover { opacity: 1; background: var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.07)); }
    .eye-btn.active {
      opacity: 1;
      background: var(--vscode-toolbar-activeBackground, rgba(255,255,255,0.14));
    }
    .eye-icon {
      display: inline-block;
      width: 22px;
      height: 22px;
      background-color: var(--vscode-icon-foreground);
      -webkit-mask: ${EYE_MASK_URL};
              mask: ${EYE_MASK_URL};
    }
  </style>
</head>
<body>
  <button class="tab${defaultTab === 'solution' ? ' active' : ''}" data-tab="solution">Solution</button>
  <button class="tab${defaultTab === 'files' ? ' active' : ''}" data-tab="files">Files</button>
  <span class="spacer"></span>
  <button class="eye-btn" id="btn-eye" title="Show hidden files (bin, obj, dot-files…)" aria-pressed="false">
    <span class="eye-icon"></span>
  </button>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const tabs = document.querySelectorAll('.tab');
    const btnEye = document.getElementById('btn-eye');

    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.toggle('active', x === t));
      vscode.postMessage({ type: 'switchTab', tab: t.dataset.tab });
    }));

    btnEye.addEventListener('click', () => {
      vscode.postMessage({ type: 'toggleShowAll' });
    });

    window.addEventListener('message', e => {
      const msg = e.data;
      if (!msg) return;
      if (msg.type === 'syncShowAll') {
        btnEye.classList.toggle('active', !!msg.showAll);
        btnEye.setAttribute('aria-pressed', msg.showAll ? 'true' : 'false');
        btnEye.title = msg.showAll
          ? 'Hide hidden files (bin, obj, dot-files…)'
          : 'Show hidden files (bin, obj, dot-files…)';
      }
      if (msg.type === 'syncTab') {
        tabs.forEach(x => x.classList.toggle('active', x.dataset.tab === msg.tab));
      }
    });
  </script>
</body>
</html>`;
  }

  dispose(): void { this.view = undefined; }
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
