#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcPath = join(
  root,
  '_upstream/extension/src/shared/constants.js'
);
const dest = join(root, 'extension/shared/geo-data.js');

const src = readFileSync(srcPath, 'utf8');
const flagsMatch = src.match(/export const COUNTRY_FLAGS = (\{[\s\S]*?\});/);
const regionMatch = src.match(/export const REGION_DATA = (\[[\s\S]*?\]);/);
if (!flagsMatch || !regionMatch) {
  console.error('Failed to parse COUNTRY_FLAGS / REGION_DATA');
  process.exit(1);
}

const flags = flagsMatch[1];
const regions = regionMatch[1];

const out = `/**
 * Geo data from xaitax/x-account-location-device (MIT).
 * Canonical English keys for matching X AboutAccountQuery locations.
 */
(function (global) {
  'use strict';

  const COUNTRY_FLAGS = ${flags};

  const DUPLICATES = new Set([
    'bosnia', 'czechia', 'macedonia', 'burma', 'macau', 'uk', 'usa', 'us', 'uae',
    'britain', 'great britain'
  ]);

  const COUNTRY_LIST = Object.keys(COUNTRY_FLAGS)
    .filter(name => !DUPLICATES.has(name))
    .sort((a, b) => a.localeCompare(b));

  const REGION_DATA = ${regions};

  const REGION_KEYS = new Set(REGION_DATA.map(r => r.key));
  const COUNTRY_KEYS = new Set(COUNTRY_LIST);

  function isRegionKey(key) {
    return typeof key === 'string' && REGION_KEYS.has(key.toLowerCase());
  }

  function isCountryKey(key) {
    return typeof key === 'string' && COUNTRY_KEYS.has(key.toLowerCase());
  }

  function titleCase(name) {
    if (!name) return '';
    return String(name)
      .split(' ')
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  const api = {
    COUNTRY_FLAGS,
    COUNTRY_LIST,
    COUNTRY_KEYS,
    REGION_DATA,
    REGION_KEYS,
    isRegionKey,
    isCountryKey,
    titleCase
  };

  global.XCD_GEO = api;
  if (typeof self !== 'undefined') self.XCD_GEO = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
`;

writeFileSync(dest, out);
console.log('Wrote', dest);
