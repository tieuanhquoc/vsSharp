// Paste this in VS Sharp DevTools Console (Cmd+Shift+I).
// Walks the live DOM, reports every codicon class in use + whether each
// codicon's ::before content + font resolves through `pi-vssharp-product-icons`
// or falls back to the default codicon font.
//
// Open the views you care about (Sidebar, Search, SCM, Settings, …) BEFORE
// running, so they're rendered into DOM.

(() => {
	const PI_FONT = 'pi-vssharp-product-icons';
	const used = new Map();
	for (const el of document.querySelectorAll('[class*="codicon-"]')) {
		for (const cls of el.classList) {
			if (!cls.startsWith('codicon-') || cls === 'codicon') continue;
			const name = cls.slice('codicon-'.length);
			if (used.has(name)) continue;
			const cs = getComputedStyle(el, '::before');
			const fontHit = cs.fontFamily.includes(PI_FONT);
			used.set(name, {
				usingVssharpFont: fontHit,
				contentChar: [...(cs.content || '')].slice(1, -1).map(c => c.codePointAt(0).toString(16)).join('') || null,
			});
		}
	}
	const sorted = [...used.entries()].sort();
	const mapped = sorted.filter(([, v]) => v.usingVssharpFont);
	const fallback = sorted.filter(([, v]) => !v.usingVssharpFont);

	console.log(`%c${used.size} codicons currently on screen.`, 'font-weight:bold');
	console.log(`  ✓ ${mapped.length} use vssharp-product-icons font.`);
	console.log(`  ⚠ ${fallback.length} fall back to default codicon font (add to codicon-map.json if you want JetBrains style):`);
	console.log(fallback.map(([k]) => `  "${k}": "TODO",`).join('\n'));

	// Copy missing list to clipboard for easy paste.
	const text = fallback.map(([k]) => `  "${k}": "TODO",`).join('\n');
	try { copy(text); console.log('%c(missing list copied to clipboard)', 'color:#888'); } catch {}
})();
