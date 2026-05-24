// VS Sharp: register product-level default settings to make VS Sharp feel
// like JetBrains Rider out-of-the-box. Users can still override every key
// via Settings UI / settings.json. Loaded once from workbench.common.main.ts.

import './media/vssharp.css';
import { Registry } from '../platform/registry/common/platform.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../platform/configuration/common/configurationRegistry.js';

const VSSHARP_DEFAULTS: Record<string, unknown> = {
	// --- Editor: typography + behaviour ---------------------------------
	// JetBrains Mono is bundled with Rider; users without it fall through
	// to system monospace. Quoted because the family contains a space.
	'editor.fontFamily': "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
	'editor.fontSize': 13,
	'editor.fontLigatures': true,
	'editor.lineHeight': 1.5,
	'editor.cursorBlinking': 'smooth',
	'editor.cursorSmoothCaretAnimation': 'on',
	'editor.smoothScrolling': true,
	'editor.renderWhitespace': 'selection',
	'editor.renderLineHighlight': 'gutter',
	'editor.guides.indentation': true,
	'editor.guides.bracketPairs': 'active',
	'editor.bracketPairColorization.enabled': true,
	'editor.suggestSelection': 'first',
	'editor.tabCompletion': 'on',
	'editor.inlayHints.enabled': 'onUnlessPressed',
	'editor.stickyScroll.enabled': true,
	'editor.minimap.enabled': false,
	'editor.scrollbar.verticalScrollbarSize': 12,
	'editor.scrollbar.horizontalScrollbarSize': 12,

	// --- Themes ---
	'workbench.productIconTheme': 'vssharp-product-icon',
	'workbench.iconTheme': 'vssharp-file-icon',
	'workbench.colorTheme': 'dark-jetbrains-color-theme',
	'workbench.preferredDarkColorTheme': 'dark-jetbrains-color-theme',
	'workbench.preferredLightColorTheme': 'light-jetbrains-color-theme',

	// --- Workbench / chrome ---------------------------------------------
	'workbench.tree.indent': 16,
	'workbench.tree.renderIndentGuides': 'always',
	'workbench.tree.expandMode': 'singleClick',
	'workbench.list.smoothScrolling': true,
	'workbench.editor.tabSizing': 'fit',
	'workbench.editor.tabCloseButton': 'right',
	'workbench.editor.labelFormat': 'short',
	'workbench.editor.showTabs': 'multiple',
	'workbench.editor.enablePreview': false,
	'workbench.editor.highlightModifiedTabs': true,
	'workbench.sideBar.location': 'left',
	'workbench.activityBar.location': 'default',
	'workbench.statusBar.visible': true,
	'workbench.layoutControl.enabled': false,

	// --- Window chrome (Rider has classic menubar + title) --------------
	'window.commandCenter': false,
	'window.menuBarVisibility': 'classic',
	'window.titleBarStyle': 'custom',
	'window.customTitleBarVisibility': 'auto',

	// --- Breadcrumbs (Rider navigation bar) -----------------------------
	'breadcrumbs.enabled': true,
	'breadcrumbs.icons': true,
	'breadcrumbs.symbolSortOrder': 'position',

	// --- Files ----------------------------------------------------------
	'files.autoSave': 'afterDelay',
	'files.autoSaveDelay': 500,
	'files.trimTrailingWhitespace': true,
	'files.insertFinalNewline': true,

	// --- Terminal -------------------------------------------------------
	'terminal.integrated.fontFamily': "'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
	'terminal.integrated.fontSize': 13,
	'terminal.integrated.cursorBlinking': true,
	'terminal.integrated.smoothScrolling': true,
};

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerDefaultConfigurations([{ overrides: VSSHARP_DEFAULTS }]);
