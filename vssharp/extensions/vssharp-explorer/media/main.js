(function () {
  'use strict';

  const vscode = acquireVsCodeApi();
  const state = vscode.getState() || { activeTab: 'solution', userPickedTab: false, showNonProjectFiles: false };

  const tabs = document.querySelectorAll('.tab');
  const panes = document.querySelectorAll('.pane');
  const solutionTree = document.getElementById('solution-tree');
  const filesTree = document.getElementById('files-tree');
  const btnNonProject = document.getElementById('btn-non-project');

  // Ensure showNonProjectFiles is present in restored state (default OFF)
  if (state.showNonProjectFiles === undefined) state.showNonProjectFiles = false;

  // ---------- icons ----------
  // Icons come from vssharp-icons extension (vssharp-file-icons.json).
  // ICONS_BASE is the webview-resolved root of vssharp-icons/media/.
  const ICONS_BASE = document.getElementById('icons-base').getAttribute('content');

  // Extensions not in the icon theme — alias to nearest match.
  const EXT_ALIAS = {
    slnx: 'sln',
    fsproj: 'csproj', vbproj: 'csproj', vcxproj: 'csproj',
    aspx: 'cshtml', ascx: 'cshtml', vbhtml: 'cshtml',
  };

  // Map tree node kind to icon definition key in vssharp-file-icons.json.
  const KIND_KEY = {
    'solution':        '_solution',
    'project':         '_csproj',
    'solution-folder': '_folder',
    'folder':          '_folder',
    'file':            '_file',
  };

  let iconTheme = null;

  function isDark() {
    return /vscode-(dark|high-contrast(?!-light))/.test(document.body.className);
  }

  async function loadIconTheme() {
    if (!iconTheme && ICONS_BASE) {
      const res = await fetch(`${ICONS_BASE}/vssharp-file-icons.json`);
      iconTheme = await res.json();
    }
    reapplyAllIcons();
  }

  // Pick the right iconDefinitions for current dark/light mode.
  function defs() {
    if (!iconTheme) return null;
    return isDark() ? iconTheme.iconDefinitions : (iconTheme.light?.iconDefinitions ?? iconTheme.iconDefinitions);
  }

  function keyToUrl(key) {
    const d = defs();
    if (!d || !key) return null;
    const def = d[key];
    if (!def?.iconPath) return null;
    return `${ICONS_BASE}/${def.iconPath.replace(/^\.\//, '')}`;
  }

  function resolveFile(name) {
    if (!iconTheme) return null;
    const lower = name.toLowerCase();
    const byName = iconTheme.fileNames?.[lower] ?? iconTheme.fileNames?.[name];
    if (byName) return keyToUrl(byName);
    const dot = lower.indexOf('.');
    if (dot < 0) return keyToUrl(iconTheme.file);
    let ext = lower.slice(dot + 1);
    while (ext) {
      const aliased = EXT_ALIAS[ext] ?? ext;
      const key = iconTheme.fileExtensions?.[aliased];
      if (key) return keyToUrl(key);
      const nextDot = ext.indexOf('.');
      if (nextDot < 0) break;
      ext = ext.slice(nextDot + 1);
    }
    return keyToUrl(iconTheme.file);
  }

  function resolveFolder(name) {
    if (!iconTheme) return null;
    const key = iconTheme.folderNames?.[name.toLowerCase()] ?? iconTheme.folder;
    return keyToUrl(key);
  }

  function resolveKind(kind) {
    return keyToUrl(KIND_KEY[kind] ?? null);
  }

  // Stored attrs let us re-resolve URLs on theme change without rebuilding the tree.
  function applyIcon(iconEl, kind, name) {
    if (kind) iconEl.dataset.iconKind = kind;
    if (name !== undefined) iconEl.dataset.iconName = name;
    const k = iconEl.dataset.iconKind;
    const n = iconEl.dataset.iconName ?? '';
    let url = null;
    if (k === 'file')        url = resolveFile(n);
    else if (k === 'folder') url = resolveFolder(n);
    else                     url = resolveKind(k);
    iconEl.style.backgroundImage = url ? `url('${url}')` : '';
  }

  function reapplyAllIcons() {
    document.querySelectorAll('.icon[data-icon-kind]').forEach(el => applyIcon(el));
  }

  // VS Code toggles theme by swapping body class — re-apply icons with correct dark/light defs.
  new MutationObserver(() => reapplyAllIcons()).observe(document.body, {
    attributes: true, attributeFilter: ['class'],
  });
  loadIconTheme();

  // ---------- request/response (must be initialized before any setActiveTab call) ----------
  const pending = new Map();
  function request(type, payload) {
    const reqId = String(Date.now()) + Math.random().toString(16).slice(2, 6);
    vscode.postMessage(Object.assign({ type, reqId }, payload || {}));
    return new Promise(resolve => pending.set(reqId, resolve));
  }

  function setActiveTab(name) {
    state.activeTab = name;
    vscode.setState(state);
    tabs.forEach(t => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panes.forEach(p => p.classList.toggle('hidden', p.dataset.tab !== name));
    if (name === 'files') refreshFilesTree();
    if (name === 'solution') refreshSolutionTree();
  }

  tabs.forEach(t => t.addEventListener('click', () => {
    state.userPickedTab = true;
    setActiveTab(t.dataset.tab);
  }));
  setActiveTab(state.activeTab);

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg) return;
    if (msg.reqId && pending.has(msg.reqId)) {
      pending.get(msg.reqId)(msg);
      pending.delete(msg.reqId);
      return;
    }
    if (msg.type === 'config' && !state.userPickedTab) setActiveTab(msg.defaultTab);
    if (msg.type === 'refresh') {
      if (state.activeTab === 'files') refreshFilesTree();
      else refreshSolutionTree();
    }
  });

  // ---------- Non-project files toggle ----------
  function updateBtnNonProjectState() {
    const on = state.showNonProjectFiles;
    btnNonProject.setAttribute('aria-pressed', on ? 'true' : 'false');
    btnNonProject.title = on ? 'Hide non-project files' : 'Show non-project files';
  }

  btnNonProject.addEventListener('click', () => {
    state.showNonProjectFiles = !state.showNonProjectFiles;
    vscode.setState(state);
    updateBtnNonProjectState();
    refreshSolutionTree();
  });

  // Apply initial button state (from restored state or default)
  updateBtnNonProjectState();

  // ---------- Solution tab ----------
  async function refreshSolutionTree() {
    solutionTree.replaceChildren(text('Loading solutions…', 'placeholder'));
    const { solutions } = await request('loadSolutions');
    solutionTree.replaceChildren();
    if (!solutions || solutions.length === 0) {
      solutionTree.appendChild(text('No .sln / .slnx found in workspace.', 'placeholder'));
      // Auto-switch to Files tab if user hasn't explicitly chosen a tab
      if (!state.userPickedTab) {
        setActiveTab('files');
        refreshFilesTree();
      }
      return;
    }

    for (const sln of solutions) solutionTree.appendChild(renderSolution(sln));
  }

  function renderSolution(sln) {
    const wrap = document.createElement('div');
    const head = makeRow({
      kind: 'solution',
      label: sln.name,
      meta: `${sln.format} · ${sln.projects.filter(p => !p.isFolder).length} projects`,
      iconKind: 'solution',
      depth: 0,
      expandable: true,
    });
    head.row.dataset.fsPath = sln.filePath;

    const children = document.createElement('div');
    children.className = 'children open';

    const folders = sln.projects.filter(p => p.isFolder);
    const roots = sln.projects.filter(p => !p.isFolder && !p.parentGuid);
    for (const folder of folders.filter(f => !f.parentGuid)) {
      children.appendChild(renderFolder(folder, sln.projects, 1, sln.filePath));
    }
    for (const proj of roots) children.appendChild(renderProject(proj, 1));

    head.row.classList.add('open');
    head.row.addEventListener('click', () => toggleNode(head.row, children, head.icon, 'solution'));

    wrap.appendChild(head.row);
    wrap.appendChild(children);
    return wrap;
  }

  function renderFolder(folder, allProjects, depth, slnFilePath) {
    const wrap = document.createElement('div');
    const head = makeRow({
      kind: 'solution-folder',
      label: folder.name,
      iconKind: 'solution-folder',
      iconName: folder.name,
      depth,
      expandable: true,
    });
    head.row.dataset.fsPath = slnFilePath;
    const children = document.createElement('div');
    children.className = 'children';

    const nested = allProjects.filter(p => p.parentGuid === folder.projectGuid);
    for (const child of nested) {
      if (child.isFolder) children.appendChild(renderFolder(child, allProjects, depth + 1, slnFilePath));
      else children.appendChild(renderProject(child, depth + 1));
    }
    head.row.addEventListener('click', () => toggleNode(head.row, children, head.icon, 'folder'));
    wrap.appendChild(head.row);
    wrap.appendChild(children);
    return wrap;
  }

  function renderProject(proj, depth) {
    const wrap = document.createElement('div');
    const head = makeRow({
      kind: 'project',
      label: proj.name,
      meta: proj.relativePath,
      iconKind: 'project',
      iconName: proj.name,
      depth,
      expandable: true,
    });
    head.row.dataset.fsPath = proj.absolutePath;

    const children = document.createElement('div');
    children.className = 'children';
    let loaded = false;

    async function expand() {
      const willOpen = !head.row.classList.contains('open');
      toggleNode(head.row, children, head.icon, 'project-expand');
      if (!willOpen || loaded) return;
      loaded = true;
      const projectDir = proj.absolutePath.replace(/[\\/][^\\/]+$/, '');
      const isFsproj = /\.fsproj$/i.test(proj.absolutePath);
      const { nodes } = await request('listDir', { fsPath: projectDir, showAll: state.showNonProjectFiles });
      for (const node of sortProjectChildren(nodes || [], isFsproj)) {
        children.appendChild(renderFsNode(node, depth + 1));
      }
    }

    head.row.addEventListener('click', expand);
    head.twisty.addEventListener('click', (ev) => { ev.stopPropagation(); expand(); });

    wrap.appendChild(head.row);
    wrap.appendChild(children);
    return wrap;
  }

  // Mirrors vscode-solution-explorer TreeItemFactory.createItemsFromProject:
  // folders first with 'properties'/'wwwroot' pinned to head, then files alphabetical.
  function sortProjectChildren(nodes, isFsproj) {
    if (isFsproj) return nodes;
    const head = ['properties', 'wwwroot'];
    const folders = nodes.filter(n => n.isDirectory).sort((a, b) => {
      const x = a.name.toLowerCase(), y = b.name.toLowerCase();
      const hx = head.indexOf(x), hy = head.indexOf(y);
      if (hx >= 0 && hy >= 0) return hx - hy;
      if (hx >= 0) return -1;
      if (hy >= 0) return 1;
      return x < y ? -1 : x > y ? 1 : 0;
    });
    const files = nodes.filter(n => !n.isDirectory)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return folders.concat(files);
  }

  // ---------- Files tab ----------
  async function refreshFilesTree() {
    filesTree.replaceChildren(text('Loading…', 'placeholder'));
    const { nodes } = await request('listRoots');
    filesTree.replaceChildren();
    for (const root of (nodes || [])) {
      const wrap = renderFsNode(root, 0);
      filesTree.appendChild(wrap);
      // Auto-expand root workspace folder
      const rootRow = wrap.querySelector(':scope > .node');
      if (rootRow && rootRow.dataset.expandable === '1') {
        rootRow._expand?.();
      }
    }
  }

  function renderFsNode(node, depth) {
    const wrap = document.createElement('div');
    const head = makeRow({
      kind: node.isDirectory ? 'dir' : 'file',
      label: node.name,
      iconKind: node.isDirectory ? 'folder' : 'file',
      iconName: node.name,
      depth,
      expandable: node.isDirectory,
    });
    head.row.dataset.fsPath = node.fsPath;

    const children = document.createElement('div');
    children.className = 'children';
    let loadPromise = null;

    async function ensureLoaded() {
      if (loadPromise) return loadPromise;
      loadPromise = (async () => {
        const { nodes } = await request('listDir', { fsPath: node.fsPath, showAll: state.showNonProjectFiles });
        for (const child of (nodes || [])) {
          children.appendChild(renderFsNode(child, depth + 1));
        }
      })();
      return loadPromise;
    }

    if (node.isDirectory) {
      head.row.dataset.expandable = '1';
      head._expand = head.row._expand = async () => {
        if (!head.row.classList.contains('open')) {
          toggleNode(head.row, children, head.icon, 'folder-toggle');
        }
        await ensureLoaded();
      };
      head.row.addEventListener('click', async () => {
        const willOpen = !head.row.classList.contains('open');
        toggleNode(head.row, children, head.icon, 'folder-toggle');
        if (willOpen) await ensureLoaded();
      });
    } else {
      head.row.addEventListener('click', () =>
        vscode.postMessage({ type: 'openFile', fsPath: node.fsPath }));
    }

    wrap.appendChild(head.row);
    wrap.appendChild(children);
    return wrap;
  }


  // ---------- helpers ----------
  function makeRow({ kind, label, meta, iconKind, iconName, depth, expandable }) {
    const row = document.createElement('div');
    row.className = 'node';
    row.dataset.kind = kind;
    row.style.paddingLeft = (4 + depth * 14) + 'px';

    const twisty = document.createElement('span');
    twisty.className = 'twisty';
    if (!expandable) twisty.style.visibility = 'hidden';
    row.appendChild(twisty);

    const icon = document.createElement('span');
    icon.className = 'icon';
    applyIcon(icon, iconKind, iconName ?? '');
    row.appendChild(icon);

    const labelEl = document.createElement('span');
    labelEl.className = 'label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    if (meta) {
      const metaEl = document.createElement('span');
      metaEl.className = 'meta';
      metaEl.textContent = meta;
      row.appendChild(metaEl);
    }
    return { row, twisty, icon };
  }

  function toggleNode(row, children, _icon, _kind) {
    const isOpen = row.classList.toggle('open');
    children.classList.toggle('open', isOpen);
  }

  function text(t, className) {
    const el = document.createElement('div');
    if (className) el.className = className;
    el.textContent = t;
    return el;
  }

  // ---------- Context menu ----------
  // Context menu is handled by the extension host via VS Code QuickPick.
  // The webview only reports which node was right-clicked.

  document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.node');
    if (!row) return;
    e.preventDefault();
    const kind   = row.dataset.kind || 'file';
    const fsPath = row.dataset.fsPath || '';
    const label  = row.querySelector('.label')?.textContent || '';
    vscode.postMessage({ type: 'showContextMenu', kind, fsPath, label });
  });

  // boot — setActiveTab() above already triggered the first refresh.
  vscode.postMessage({ type: 'ready' });
})();
