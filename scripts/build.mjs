#!/usr/bin/env node
/**
 * Build loadable Chromium package → dist/
 * Usage: npm run build
 *
 * Syncs in place (no wipe) so the unpacked extension can see build-stamp.json
 * and auto-reload via shared/dev-reload.js.
 */
import {
  cpSync,
  rmSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'extension');
const dist = join(root, 'dist');

const required = [
  'manifest.json',
  'background.js',
  'content.js',
  'content/engine/lib.js',
  'content/engine/actions.js',
  'content/engine/toast.js',
  'content/engine/engine.js',
  'page-script.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'shared/i18n.js',
  'shared/geo-data.js',
  'shared/settings.js',
  'shared/badge.js',
  'shared/geo-cache-idb.js',
  'shared/release-metadata.js',
  'shared/dev-reload.js',
  'brand/premium11-mark.svg',
  'assets/fonts/montserrat/montserrat-latin.woff2',
  '_locales/en/messages.json',
  'icons/icon16.png'
];

function fail(msg) {
  console.error('BUILD FAIL:', msg);
  process.exit(1);
}

/** Copy src → dest; remove dest entries that are not in src (keep build-stamp.json). */
function syncTree(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  const srcNames = new Set(readdirSync(srcDir));
  for (const name of readdirSync(destDir)) {
    if (name === 'build-stamp.json') continue;
    if (!srcNames.has(name)) {
      rmSync(join(destDir, name), { recursive: true, force: true });
    }
  }
  for (const name of srcNames) {
    const s = join(srcDir, name);
    const d = join(destDir, name);
    if (statSync(s).isDirectory()) syncTree(s, d);
    else cpSync(s, d);
  }
}

if (!existsSync(src)) fail(`missing ${src}`);

const check = spawnSync(process.execPath, [join(root, 'scripts', 'check-i18n.mjs')], {
  cwd: root,
  stdio: 'inherit'
});
if (check.status !== 0) fail('i18n check failed');

syncTree(src, dist);

for (const rel of required) {
  const p = join(dist, rel);
  if (!existsSync(p)) fail(`missing in dist: ${rel}`);
}

writeFileSync(
  join(dist, 'build-stamp.json'),
  JSON.stringify({ t: Date.now(), v: Date.now().toString(36) }) + '\n',
  'utf8'
);

function countFiles(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

console.log(`BUILD OK → dist/ (${countFiles(dist)} files)`);
console.log('Load unpacked: dist/ (dev auto-reload on next builds)');
