(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  // ── Message bridge ────────────────────────────────────────────────────────
  const handlers = {};

  window.__modal = {
    /** Send a message to the extension host. */
    post(type, payload) {
      vscode.postMessage({ type, ...(payload ?? {}) });
    },
    /** Register a handler for messages coming FROM the extension host. */
    on(type, fn) {
      handlers[type] = fn;
    },
  };

  window.addEventListener('message', ({ data }) => {
    if (data?.type && handlers[data.type]) handlers[data.type](data);
  });

  // ── Collapsible sections ─────────────────────────────────────────────────
  document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const id = trigger.dataset.target;
      if (id) document.getElementById(id)?.classList.toggle('open');
    });
  });

  // ── Generic close / cancel buttons ──────────────────────────────────────
  ['btn-close', 'btn-cancel'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      window.__modal.post('cancel');
    });
  });

  // ── Notify extension that the webview is ready ───────────────────────────
  window.__modal.post('ready');
})();
