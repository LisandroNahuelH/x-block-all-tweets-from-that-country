#!/usr/bin/env node
/**
 * Fail if non-English shipping locales still have message === en
 * (except allowlist and en_* variants).
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const localesRoot = join(root, 'extension', '_locales');
const enPath = join(localesRoot, 'en', 'messages.json');
const allowPath = join(root, 'scripts', 'i18n-identical-allowlist.json');

const ENGLISH_VARIANTS = new Set(['en_AU', 'en_GB', 'en_US']);

const en = JSON.parse(readFileSync(enPath, 'utf8'));
const allowlist = new Set(
  (existsSync(allowPath)
    ? JSON.parse(readFileSync(allowPath, 'utf8')).identicalMessageKeys
    : []) || []
);

const dirs = readdirSync(localesRoot, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const issues = [];
let audited = 0;

for (const locale of dirs) {
  if (locale === 'en' || ENGLISH_VARIANTS.has(locale)) continue;
  const path = join(localesRoot, locale, 'messages.json');
  if (!existsSync(path)) {
    issues.push(`[${locale}] missing messages.json`);
    continue;
  }
  const catalog = JSON.parse(readFileSync(path, 'utf8'));
  audited++;
  for (const key of Object.keys(en)) {
    if (allowlist.has(key)) continue;
    const em = en[key]?.message;
    const lm = catalog[key]?.message;
    if (lm == null) {
      issues.push(`[${locale}] missing key ${key}`);
      continue;
    }
    if (lm === em) {
      issues.push(`[${locale}] ${key} still identical to English`);
    }
  }
  for (const key of Object.keys(catalog)) {
    if (!(key in en)) issues.push(`[${locale}] orphan key ${key}`);
  }
}

if (issues.length) {
  console.error(`i18n audit FAILED (${issues.length} issue(s)):`);
  for (const line of issues.slice(0, 80)) console.error(' -', line);
  if (issues.length > 80) console.error(` … +${issues.length - 80} more`);
  process.exit(1);
}

console.log(
  audited === 0
    ? 'i18n audit OK (no non-English shipping locales yet; only en/en_*)'
    : `i18n audit OK (${audited} non-English locale(s), ${Object.keys(en).length} keys)`
);
