#!/usr/bin/env node
/**
 * Build loadable Chromium package → dist/
 * Usage: npm run build
 */
import { cpSync, rmSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
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
  'page-script.js',
  'popup/popup.html',
  'popup/popup.css',
  'popup/popup.js',
  'shared/i18n.js',
  'shared/geo-data.js',
  'shared/settings.js',
  'shared/badge.js',
  'brand/premium11-mark.svg',
  'assets/fonts/montserrat/montserrat-latin.woff2',
  '_locales/en/messages.json',
  'icons/icon16.png'
];

function fail(msg) {
  console.error('BUILD FAIL:', msg);
  process.exit(1);
}

if (!existsSync(src)) fail(`missing ${src}`);

const check = spawnSync(process.execPath, [join(root, 'scripts', 'check-i18n.mjs')], {
  cwd: root,
  stdio: 'inherit'
});
if (check.status !== 0) fail('i18n check failed');

if (existsSync(dist)) rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(src, dist, { recursive: true });

for (const rel of required) {
  const p = join(dist, rel);
  if (!existsSync(p)) fail(`missing in dist: ${rel}`);
}

function countFiles(dir) {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += statSync(p).isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

console.log(`BUILD OK → dist/ (${countFiles(dist)} files)`);
console.log('Load unpacked: dist/');
