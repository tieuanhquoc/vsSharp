#!/usr/bin/env node
// Fast incremental compile for VS Sharp patches only.
// Transpiles only the patched vscode TS files using esbuild (same options as
// `node build/next/index.ts transpile`) — skips glob + 1255-file resource copy.
// Usage:  node compile-vssharp.mjs
// Time:   ~200ms vs ~5s for full transpile

import * as esbuild from './vscode/build/node_modules/esbuild/lib/main.js';
import { readFile, writeFile, copyFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SRC  = join(ROOT, 'vscode/src');
const OUT  = join(ROOT, 'vscode/out');

// TS files patched by VS Sharp — add more here as needed.
const PATCHED = [
  'vs/workbench/browser/parts/views/viewPaneContainer.ts',
  'vs/workbench/browser/parts/views/viewPane.ts',
  'vs/workbench/browser/composite.ts',
];

// CSS/resource files that are just copied (no transpilation).
const COPIED = [
  'vs/workbench/media/vssharp.css',
];

const TRANSFORM_OPTIONS = {
  loader: 'ts',
  format: 'esm',
  target: 'es2024',
  sourcemap: 'inline',
  sourcesContent: false,
  tsconfigRaw: JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      useDefineForClassFields: false,
    },
  }),
};

function adjustEsmUrl(code) {
  return code.replace(/\.ts(\?esm['"])/g, '.js$1');
}

async function transpileFile(rel) {
  const src  = join(SRC, rel);
  const dest = join(OUT, rel.replace(/\.ts$/, '.js'));
  const source = await readFile(src, 'utf-8');
  const { code } = await esbuild.transform(source, { ...TRANSFORM_OPTIONS, sourcefile: src });
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, adjustEsmUrl(code));
  console.log('✓', rel.replace(/^vs\//, ''));
}

async function copyResource(rel) {
  const src  = join(SRC, rel);
  const dest = join(OUT, rel);
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(src, dest);
  console.log('✓', rel.replace(/^vs\//, ''));
}

const t0 = Date.now();
await Promise.all([
  ...PATCHED.map(transpileFile),
  ...COPIED.map(copyResource),
]);
console.log(`Done in ${Date.now() - t0}ms`);
