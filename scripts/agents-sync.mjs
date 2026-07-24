#!/usr/bin/env node
/**
 * Mirror AGENTS.md → CLAUDE.md + GEMINI.md (byte-identical triplet).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'AGENTS.md');
if (!existsSync(src)) {
  console.error('Missing AGENTS.md');
  process.exit(1);
}
const body = readFileSync(src);
for (const name of ['CLAUDE.md', 'GEMINI.md']) {
  writeFileSync(join(root, name), body);
  console.log('synced', name);
}
