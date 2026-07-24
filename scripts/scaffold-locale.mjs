#!/usr/bin/env node
/**
 * Create extension/_locales/<code>/messages.json from en.
 * Usage: node scripts/scaffold-locale.mjs <locale> [--force]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const ext = join(root, 'extension');
const localesDir = join(ext, '_locales');
const enPath = join(localesDir, 'en', 'messages.json');
const manifestPath = join(ext, 'locales.manifest.json');

const args = process.argv.slice(2).filter(a => a !== '--force');
const force = process.argv.includes('--force');
const code = args[0];

if (!code) {
  console.error('Usage: node scripts/scaffold-locale.mjs <locale> [--force]');
  process.exit(1);
}

const allowed = JSON.parse(readFileSync(manifestPath, 'utf8')).locales;
if (!allowed.includes(code)) {
  console.error(`Unknown locale "${code}". Must be one of locales.manifest.json`);
  process.exit(1);
}

if (code === 'en') {
  console.error('en is the source locale; nothing to scaffold.');
  process.exit(1);
}

if (!existsSync(enPath)) {
  console.error('Missing en messages:', enPath);
  process.exit(1);
}

const destDir = join(localesDir, code);
const dest = join(destDir, 'messages.json');
if (existsSync(dest) && !force) {
  console.error(`Already exists: ${dest} (use --force to overwrite)`);
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });
writeFileSync(dest, readFileSync(enPath, 'utf8'));
console.log(`Scaffolded ${dest} from en. Translate "message" values; keep keys stable.`);
