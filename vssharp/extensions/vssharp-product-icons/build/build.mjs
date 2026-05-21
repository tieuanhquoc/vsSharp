#!/usr/bin/env node
// vssharp-product-icons font builder.
//
// 1. Reads `codicon-map.json` (codicon → expui SVG basename).
// 2. Copies unique SVGs from ../icons/expui/ → tmp/ with sanitised glyph names.
// 3. Runs fantasticon → produces vssharp-product-icons.woff2.
// 4. Writes producticons/vssharp-product-icons.json mapping every codicon to
//    the correct font character.
//
// Re-run after editing codicon-map.json OR adding/replacing SVGs in icons/expui/.

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_ROOT  = resolve(__dirname, '..');
const MAP_FILE  = join(__dirname, 'codicon-map.json');
const SVG_DIR   = join(EXT_ROOT, 'icons', 'expui');
const TMP_DIR   = join(__dirname, 'tmp');
const OUT_DIR   = join(EXT_ROOT, 'producticons');
const FONT_ID   = 'vssharp-product-icons';

const log = (...args) => console.log('[build-font]', ...args);

// 1. Load map, drop sectional comment keys (`_*` markers and `//` doc strings).
const rawMap = JSON.parse(readFileSync(MAP_FILE, 'utf8'));
/** @type {Record<string,string>} */
const map = {};
for (const [k, v] of Object.entries(rawMap)) {
	if (k.startsWith('_') || k.startsWith('//')) continue;
	if (typeof v === 'string') map[k] = v;
}
log(`${Object.keys(map).length} codicon mappings loaded.`);

// 2. Stage unique SVGs into tmp/ with `<glyph>.svg` filename for fantasticon.
//    Multiple codicons → same SVG → only one tmp file (deduplicate by glyph name).
rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

/** @type {Set<string>} unique glyph names (= expui basenames) */
const glyphs = new Set();
const missing = new Set();
for (const [codicon, glyph] of Object.entries(map)) {
	const src = join(SVG_DIR, `${glyph}.svg`);
	if (!existsSync(src)) {
		missing.add(`${codicon} → ${glyph}.svg`);
		continue;
	}
	if (!glyphs.has(glyph)) {
		copyFileSync(src, join(TMP_DIR, `${glyph}.svg`));
		glyphs.add(glyph);
	}
}
if (missing.size) {
	log(`⚠ ${missing.size} mappings reference missing SVGs (skipped):`);
	for (const m of missing) log(`  - ${m}`);
}
log(`${glyphs.size} unique glyphs staged for font generation.`);

// 3a. Convert stroke-only SVGs to filled paths via picosvg (Google Fonts'
//     SVG normaliser — uses skia-pathops for exact geometric stroke→fill
//     expansion). svgicons2svgfont (fantasticon's backend) only renders
//     FILLED shapes; without this, stroked paths become invisible glyphs.
//     Requires `picosvg` in the project venv: `.venv/bin/pip install picosvg`.
const FIXED_DIR = join(__dirname, 'tmp-fixed');
rmSync(FIXED_DIR, { recursive: true, force: true });
mkdirSync(FIXED_DIR, { recursive: true });
const PICOSVG = resolve(EXT_ROOT, '..', '..', '..', '.venv', 'bin', 'picosvg');
if (!existsSync(PICOSVG)) {
	throw new Error(`picosvg not found at ${PICOSVG}. Install: ./.venv/bin/pip install picosvg`);
}
log('Converting stroked SVGs → filled paths (picosvg)...');
for (const file of readdirSync(TMP_DIR)) {
	if (!file.endsWith('.svg')) continue;
	const inPath  = join(TMP_DIR, file);
	const outPath = join(FIXED_DIR, file);
	try {
		execSync(`"${PICOSVG}" "${inPath}" > "${outPath}"`, { stdio: 'pipe' });
	} catch (e) {
		log(`⚠ picosvg failed on ${file} — falling back to original SVG.`);
		copyFileSync(inPath, outPath);
	}
}
log(`${readdirSync(FIXED_DIR).length} SVGs converted.`);

// 3b. Generate font with fantasticon (npx auto-installs on first run).
const ftCmd = [
	'npx', '-y', 'fantasticon',
	`"${FIXED_DIR}"`,
	'-o', `"${OUT_DIR}"`,
	'-n', FONT_ID,
	'-t', 'woff2',           // only woff2 font format
	'-g', 'json',            // only json asset (for codepoint map)
	'--normalize', 'true',   // scale icons to uniform height
].join(' ');
log('Running fantasticon...');
execSync(ftCmd, { stdio: 'inherit' });

// 4. Read fantasticon's <id>.json (glyph → codepoint hex string) + build manifest.
const ftJson = JSON.parse(readFileSync(join(OUT_DIR, `${FONT_ID}.json`), 'utf8'));
log(`fantasticon produced ${Object.keys(ftJson).length} glyphs.`);

const iconDefinitions = {};
for (const [codicon, glyph] of Object.entries(map)) {
	const codepoint = ftJson[glyph];
	if (!codepoint) continue;
	iconDefinitions[codicon] = {
		fontCharacter: `\\${codepoint.toString(16)}`,
		fontId: FONT_ID,
	};
}

const manifest = {
	fonts: [{
		id: FONT_ID,
		src: [{ path: `./${FONT_ID}.woff2`, format: 'woff2' }],
		style: 'normal',
		weight: 'normal',
	}],
	iconDefinitions,
};
writeFileSync(join(OUT_DIR, `${FONT_ID}.json`), JSON.stringify(manifest, null, 2));
log(`✓ Manifest written: ${Object.keys(iconDefinitions).length} codicons mapped.`);

// 5. Clean tmp.
rmSync(TMP_DIR, { recursive: true, force: true });
rmSync(FIXED_DIR, { recursive: true, force: true });
log('Done.');
