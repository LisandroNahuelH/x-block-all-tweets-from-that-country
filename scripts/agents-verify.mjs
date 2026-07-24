#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const names = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'];
const bodies = names.map(n => {
  const p = join(root, n);
  if (!existsSync(p)) {
    console.error('Missing', n);
    process.exit(1);
  }
  return readFileSync(p, 'utf8');
});
const ok = bodies.every(b => b === bodies[0]);
if (!ok) {
  console.error('AGENTS/CLAUDE/GEMINI diverge');
  process.exit(1);
}
console.log('agents triplet OK');
