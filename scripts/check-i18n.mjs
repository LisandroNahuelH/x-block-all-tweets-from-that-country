#!/usr/bin/env node
/**
 * Validate extension/_locales against en (source of truth).
 * Usage: node scripts/check-i18n.mjs [--strict-parity]
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const ext = join(root, 'extension');
const localesDir = join(ext, '_locales');
const enPath = join(localesDir, 'en', 'messages.json');
const manifestPath = join(ext, 'locales.manifest.json');
const strictParity = process.argv.includes('--strict-parity');

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const PLACEHOLDER_RE = /\$([A-Z][A-Z0-9_]*)\$/g;

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error('ERROR:', msg);
  errors++;
}

function warn(msg) {
  console.warn('WARN:', msg);
  warnings++;
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`Invalid JSON: ${path} (${e.message})`);
    return null;
  }
}

if (!existsSync(enPath)) {
  fail(`Missing default locale: ${enPath}`);
  process.exit(1);
}

const en = loadJson(enPath);
if (!en) process.exit(1);

const allowed = existsSync(manifestPath)
  ? new Set(loadJson(manifestPath)?.locales || [])
  : null;

function validateMessages(locale, data, isEn) {
  if (!data || typeof data !== 'object') {
    fail(`${locale}: messages must be an object`);
    return;
  }

  for (const [key, entry] of Object.entries(data)) {
    if (!KEY_RE.test(key)) fail(`${locale}: bad key "${key}"`);
    if (!entry || typeof entry !== 'object') {
      fail(`${locale}: ${key} must be an object`);
      continue;
    }
    if (typeof entry.message !== 'string' || entry.message.length === 0) {
      fail(`${locale}: ${key}.message empty or missing`);
    }
    if (isEn && (!entry.description || !String(entry.description).trim())) {
      warn(`${locale}: ${key} missing description (recommended for translators)`);
    }

    const named = [...String(entry.message).matchAll(PLACEHOLDER_RE)].map(m => m[1]);
    const ph = entry.placeholders || {};
    if (named.length && !entry.placeholders) {
      fail(`${locale}: ${key} uses $NAME$ but has no placeholders`);
    }
    for (const name of named) {
      if (!ph[name]) fail(`${locale}: ${key} missing placeholders.${name}`);
      else if (!ph[name].content) fail(`${locale}: ${key}.placeholders.${name}.content missing`);
    }
    for (const name of Object.keys(ph)) {
      if (!named.includes(name)) {
        warn(`${locale}: ${key} has unused placeholder ${name}`);
      }
    }
  }
}

validateMessages('en', en, true);

const enKeys = new Set(Object.keys(en));
const dirs = existsSync(localesDir)
  ? readdirSync(localesDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  : [];

for (const locale of dirs) {
  if (allowed && !allowed.has(locale)) {
    warn(`Locale folder "${locale}" not in locales.manifest.json`);
  }
  const path = join(localesDir, locale, 'messages.json');
  if (!existsSync(path)) {
    fail(`${locale}: missing messages.json`);
    continue;
  }
  const data = loadJson(path);
  if (!data) continue;
  validateMessages(locale, data, locale === 'en');

  if (locale === 'en') continue;

  for (const key of Object.keys(data)) {
    if (!enKeys.has(key)) fail(`${locale}: orphan key "${key}" (not in en)`);
  }
  const missing = [...enKeys].filter(k => !(k in data));
  if (missing.length) {
    const msg = `${locale}: missing ${missing.length} key(s) vs en (Chrome will fall back to en): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`;
    if (strictParity) fail(msg);
    else warn(msg);
  }
}

// Manifest must reference __MSG_ and default_locale
const mfPath = join(ext, 'manifest.json');
if (existsSync(mfPath)) {
  const mf = loadJson(mfPath);
  if (mf) {
    if (mf.default_locale !== 'en') fail(`manifest.default_locale must be "en" (got ${mf.default_locale})`);
    if (typeof mf.name === 'string' && !mf.name.includes('__MSG_')) {
      fail('manifest.name must use __MSG_key__');
    }
    if (typeof mf.description === 'string' && !mf.description.includes('__MSG_')) {
      fail('manifest.description must use __MSG_key__');
    }
  }
}

console.log(
  errors
    ? `i18n check FAILED (${errors} error(s), ${warnings} warning(s))`
    : `i18n check OK (${dirs.length} locale(s), ${enKeys.size} en keys, ${warnings} warning(s))`
);
process.exit(errors ? 1 : 0);
