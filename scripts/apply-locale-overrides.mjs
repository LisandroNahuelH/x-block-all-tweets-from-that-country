#!/usr/bin/env node
/**
 * Build extension/_locales/<code>/messages.json from en + scripts/locale-overrides/<code>.json
 * Override file: { "key": "translated message", ... }
 * Usage: node scripts/apply-locale-overrides.mjs [locale…]
 *        (no args = all override files)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const ext = join(root, 'extension');
const localesDir = join(ext, '_locales');
const enPath = join(localesDir, 'en', 'messages.json');
const overridesDir = join(root, 'scripts', 'locale-overrides');
const manifestPath = join(ext, 'locales.manifest.json');

const en = JSON.parse(readFileSync(enPath, 'utf8'));
const allowed = new Set(JSON.parse(readFileSync(manifestPath, 'utf8')).locales || []);
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));

if (!existsSync(overridesDir)) {
  mkdirSync(overridesDir, { recursive: true });
  console.log('Created empty', overridesDir);
}

const files =
  args.length > 0
    ? args.map((code) => `${code}.json`)
    : readdirSync(overridesDir).filter((f) => f.endsWith('.json'));

if (!files.length) {
  console.log('No locale override files in scripts/locale-overrides/. Nothing to apply.');
  process.exit(0);
}

let errors = 0;

for (const fileName of files) {
  const locale = fileName.replace(/\.json$/, '');
  if (locale === 'en') {
    console.error('Skip en (source of truth)');
    continue;
  }
  if (!allowed.has(locale)) {
    console.error(`ERROR: ${locale} not in locales.manifest.json`);
    errors++;
    continue;
  }
  const oPath = join(overridesDir, fileName);
  if (!existsSync(oPath)) {
    console.error(`ERROR: missing ${oPath}`);
    errors++;
    continue;
  }
  const overrides = JSON.parse(readFileSync(oPath, 'utf8'));
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    console.error(`ERROR: ${fileName} must be a JSON object of key → message`);
    errors++;
    continue;
  }

  const catalog = {};
  for (const [key, entry] of Object.entries(en)) {
    catalog[key] = {
      message: entry.message,
      ...(entry.placeholders ? { placeholders: structuredClone(entry.placeholders) } : {})
    };
  }

  for (const [key, message] of Object.entries(overrides)) {
    if (!(key in en)) {
      console.error(`ERROR: ${locale}: unknown key "${key}"`);
      errors++;
      continue;
    }
    if (typeof message !== 'string' || !message.length) {
      console.error(`ERROR: ${locale}: ${key} message empty`);
      errors++;
      continue;
    }
    catalog[key].message = message;
  }

  const destDir = join(localesDir, locale);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, 'messages.json');
  writeFileSync(dest, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  const covered = Object.keys(overrides).length;
  const total = Object.keys(en).length;
  console.log(`Applied ${locale}: ${covered}/${total} overridden → ${dest}`);
}

process.exit(errors ? 1 : 0);
