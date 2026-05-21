#!/usr/bin/env node
// Discover VS Code codicons not yet mapped in codicon-map.json, suggest the
// closest expui SVG candidate, and (optionally) auto-write high-confidence
// matches.
//
//   node build/discover.mjs            # report only
//   node build/discover.mjs --write    # also append confident matches into codicon-map.json
//
// Source pools:
//   - vscode codicons (registry)        ~ 648 codicons
//   - icons/expui/*.svg                 (already bundled)
//   - /tmp/intellij-community-sparse/.../expui  (full upstream, ~1700 SVGs)

import { readFileSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT  = resolve(__dirname, '..');
const REPO_ROOT = resolve(EXT_ROOT, '..', '..', '..');
const CODICONS  = [
	join(REPO_ROOT, 'vscode/src/vs/base/common/codiconsLibrary.ts'),
	join(REPO_ROOT, 'vscode/src/vs/base/common/codicons.ts'),
];
const MAP_FILE  = join(__dirname, 'codicon-map.json');
const BUNDLED   = join(EXT_ROOT, 'icons', 'expui');
const UPSTREAM  = '/tmp/intellij-community-sparse/platform/icons/src/expui';

const WRITE = process.argv.includes('--write');
const CONFIDENCE = 70; // only auto-write at or above this score

// ── 1. Parse all register('<name>', ...) calls.
const allCodicons = new Set();
for (const f of CODICONS) {
	if (!existsSync(f)) continue;
	const text = readFileSync(f, 'utf8');
	for (const m of text.matchAll(/register\(\s*'([a-z][a-z0-9-]*)'/g)) {
		allCodicons.add(m[1]);
	}
}

// ── 2. Load already-mapped set.
const rawMap = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
const mapped = new Set();
for (const [k, v] of Object.entries(rawMap)) {
	if (k.startsWith('_') || k.startsWith('//')) continue;
	if (typeof v === 'string') mapped.add(k);
}

// ── 3. Index expui glyphs (bundled + upstream pool).
const bundled = new Set(
	(existsSync(BUNDLED) ? readdirSync(BUNDLED) : [])
		.filter(f => f.endsWith('.svg') && !f.includes('_dark'))
		.map(f => f.replace('.svg', ''))
);
const upstream = new Map(); // basename → upstream relative path
if (existsSync(UPSTREAM)) {
	const walk = (dir, prefix = '') => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) walk(join(dir, entry.name), `${prefix}${entry.name}/`);
			else if (entry.name.endsWith('.svg') && !entry.name.includes('_dark') && !entry.name.includes('@')) {
				const name = entry.name.replace('.svg', '');
				if (!upstream.has(name)) upstream.set(name, `${prefix}${entry.name}`);
			}
		}
	};
	walk(UPSTREAM);
}

// ── 4. Scoring: prefer exact / strong containment, penalise short names.
const norm = s => s.toLowerCase().replace(/[-_]/g, '');
function score(codicon, glyph) {
	const a = norm(codicon), b = norm(glyph);
	if (a === b) return 100;
	if (b.length < 3) return 0;                   // single/double-char glyphs → too noisy
	if (b === a + 's' || a === b + 's') return 90;
	if (b.startsWith(a) || a.startsWith(b)) {
		return Math.max(60, 90 - Math.abs(a.length - b.length) * 3);
	}
	if (b.includes(a) && a.length >= 4) return 75 - (b.length - a.length);
	if (a.includes(b) && b.length >= 4) return 70 - (a.length - b.length);
	return 0;
}

// ── 5. Compute suggestions per missing codicon.
const missing = [...allCodicons].filter(c => !mapped.has(c)).sort();
const suggestions = new Map(); // codicon → {glyph, score, src}
for (const codicon of missing) {
	let best = { glyph: null, score: 0, src: '' };
	for (const g of bundled) {
		const s = score(codicon, g);
		if (s > best.score) best = { glyph: g, score: s, src: 'bundled' };
	}
	for (const g of upstream.keys()) {
		const s = score(codicon, g);
		// Prefer bundled at tie.
		if (s > best.score + (best.src === 'bundled' ? 5 : 0)) {
			best = { glyph: g, score: s, src: 'upstream' };
		}
	}
	suggestions.set(codicon, best);
}

const high = [...suggestions].filter(([, b]) => b.score >= CONFIDENCE);
const low  = [...suggestions].filter(([, b]) => b.score < CONFIDENCE && b.score > 0);
const none = [...suggestions].filter(([, b]) => b.score === 0);

// ── 6. Report.
console.log(`Codicons registered : ${allCodicons.size}`);
console.log(`Already mapped      : ${mapped.size}`);
console.log(`Missing             : ${missing.length}`);
console.log(`Bundled expui       : ${bundled.size}`);
console.log(`Upstream expui      : ${upstream.size}`);
console.log('');
console.log(`Suggestions ≥${CONFIDENCE} (auto-writable)  : ${high.length}`);
console.log(`Suggestions <${CONFIDENCE} (review needed)  : ${low.length}`);
console.log(`No suggestion at all                : ${none.length}`);
console.log('');

if (!WRITE) {
	console.log(`High-confidence (≥${CONFIDENCE}) — pass --write to auto-add to codicon-map.json:`);
	for (const [c, b] of high.slice(0, 50)) {
		console.log(`  "${c}":  "${b.glyph}",  // ${b.score} ${b.src}${b.src === 'upstream' ? ': ' + upstream.get(b.glyph) : ''}`);
	}
	if (high.length > 50) console.log(`  … +${high.length - 50} more`);
	console.log('');
	console.log('Low-confidence (review manually):');
	for (const [c, b] of low.slice(0, 30)) {
		console.log(`  "${c}":  "${b.glyph}",  // ${b.score} ${b.src}`);
	}
	if (low.length > 30) console.log(`  … +${low.length - 30} more`);
}

// ── 7. Auto-write & copy upstream SVGs as needed.
if (WRITE && high.length) {
	// Parse → mutate → stringify (preserves valid JSON, drops comments + section markers).
	const obj = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
	const sectionKey = `_auto_added_${new Date().toISOString().slice(0, 10)}`;
	obj[sectionKey] = null;
	for (const [c, b] of high) obj[c] = b.glyph;
	writeFileSync(MAP_FILE, JSON.stringify(obj, null, 2) + '\n');
	console.log(`✓ Appended ${high.length} mappings to codicon-map.json.`);

	// Copy upstream SVGs into the bundled icons folder so build.mjs can find them.
	let copied = 0;
	for (const [, b] of high) {
		if (b.src !== 'upstream') continue;
		const rel = upstream.get(b.glyph);
		const srcLight = join(UPSTREAM, rel);
		const srcDark  = srcLight.replace(/\.svg$/, '_dark.svg');
		const dstLight = join(BUNDLED, `${b.glyph}.svg`);
		const dstDark  = join(BUNDLED, `${b.glyph}_dark.svg`);
		if (!existsSync(dstLight) && existsSync(srcLight)) { copyFileSync(srcLight, dstLight); copied++; }
		if (!existsSync(dstDark) && existsSync(srcDark)) copyFileSync(srcDark, dstDark);
	}
	console.log(`✓ Copied ${copied} new SVGs into icons/expui/.`);
	console.log('\nNext: node build/build.mjs && ./vssharp/extend-prepare.sh');
}
