#!/usr/bin/env node
/**
 * versions.json handshake.
 *
 *   node scripts/check-versions.mjs            verify every pinned sha256 (exit 1 on mismatch)
 *   node scripts/check-versions.mjs --update   refresh the pins + updated_at (release cut)
 *
 * Rule: sha256 (lowercase hex) of the file bytes with CRLF normalized to LF.
 * The Windows installer applies the same rule in PowerShell, so the pins are
 * portable across checkouts and platforms.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSIONS_PATH = resolve(ROOT, 'versions.json');

function sha256Lf(relPath) {
  const text = readFileSync(resolve(ROOT, relPath), 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const update = process.argv.includes('--update');
const v = JSON.parse(readFileSync(VERSIONS_PATH, 'utf8'));

const entries = [
  { label: 'installer', path: v.installer.path, get: () => v.installer.sha256, set: (h) => { v.installer.sha256 = h; } },
  ...v.artifacts.map((a) => ({ label: 'artifact', path: a.path, get: () => a.sha256, set: (h) => { a.sha256 = h; } })),
];

let failures = 0;
for (const e of entries) {
  const have = sha256Lf(e.path);
  if (update) {
    const was = String(e.get() || '');
    if (have !== was) console.log(`updated ${e.path}: ${was.slice(0, 12) || '(empty)'} -> ${have.slice(0, 12)}`);
    e.set(have);
  } else if (have !== e.get()) {
    failures += 1;
    console.error(`MISMATCH ${e.path}\n  have     ${have}\n  expected ${e.get()}`);
  }
}

if (update) {
  v.updated_at = today();
  writeFileSync(VERSIONS_PATH, JSON.stringify(v, null, 2) + '\n');
  console.log(`versions.json updated (v${v.version}, ${v.updated_at}, ${entries.length} pins)`);
} else if (failures > 0) {
  console.error(`\nversions.json: ${failures} mismatch(es). Cutting a release? run: npm run versions:update`);
  process.exit(1);
} else {
  console.log(`versions.json OK (v${v.version}, ${entries.length} pins)`);
}
