/**
 * Shared settings (chrome.storage.local).
 * Independent block/mute lanes: enabled, countries, regions, accounts.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'xcd_settings';
  const LANES = new Set(['block', 'mute']);
  const SCREEN_RE = /^[a-zA-Z0-9_]{1,15}$/;

  function emptyLane(enabled = true) {
    return {
      enabled: enabled !== false,
      countries: [],
      regions: [],
      accounts: []
    };
  }

  const DEFAULTS = Object.freeze({
    block: Object.freeze(emptyLane(true)),
    mute: Object.freeze(emptyLane(true))
  });

  function isLane(value) {
    return typeof value === 'string' && LANES.has(value);
  }

  function uniqueLower(list) {
    const out = [];
    const seen = new Set();
    if (!Array.isArray(list)) return out;
    for (const item of list) {
      if (typeof item !== 'string') continue;
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }

  function filterKnownCountries(list) {
    const keys = uniqueLower(list);
    const geo = global.XCD_GEO;
    if (!geo || !geo.COUNTRY_KEYS) return keys;
    return keys.filter(k => geo.COUNTRY_KEYS.has(k));
  }

  function filterKnownRegions(list) {
    const keys = uniqueLower(list);
    const geo = global.XCD_GEO;
    if (!geo || !geo.REGION_KEYS) return keys;
    return keys.filter(k => geo.REGION_KEYS.has(k));
  }

  function normalizeScreenName(value) {
    if (typeof value !== 'string') return '';
    const s = value.trim().replace(/^@+/, '');
    if (!SCREEN_RE.test(s)) return '';
    return s.toLowerCase();
  }

  function normalizeAvatarUrl(value) {
    if (typeof value !== 'string') return '';
    const u = value.trim();
    if (!u) return '';
    // X serves avatars on pbs.twimg.com (http(s)); reject non-http schemes.
    if (!/^https?:\/\//i.test(u)) return '';
    return u;
  }

  function normalizeDisplayName(value, screenName) {
    if (typeof value === 'string') {
      const n = value.trim();
      if (n) return n.slice(0, 80);
    }
    return screenName || '';
  }

  /**
   * Account entries (blocked/muted). Mirrors upstream AboutAccount meta fields:
   * screenName, name (core.name), avatarUrl (avatar.image_url).
   */
  function normalizeAccounts(list) {
    if (!Array.isArray(list)) return [];
    const byName = new Map();
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const screenName = normalizeScreenName(raw.screenName);
      if (!screenName) continue;
      const ts =
        typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : Date.now();
      const prev = byName.get(screenName);
      // Prefer richer later entry; keep prior avatar/name if new ones empty.
      const name = normalizeDisplayName(raw.name, screenName) || prev?.name || screenName;
      const avatarUrl =
        normalizeAvatarUrl(raw.avatarUrl) || prev?.avatarUrl || '';
      byName.set(screenName, {
        screenName,
        name,
        avatarUrl,
        ts: prev && prev.ts > ts ? prev.ts : ts
      });
    }
    return [...byName.values()].sort((a, b) => {
      if (b.ts !== a.ts) return b.ts - a.ts;
      return a.screenName.localeCompare(b.screenName);
    });
  }

  function normalizeLane(raw, fallbackEnabled = true) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      enabled: src.enabled !== false && fallbackEnabled !== false ? src.enabled !== false : !!src.enabled,
      countries: filterKnownCountries(src.countries),
      regions: filterKnownRegions(src.regions),
      accounts: normalizeAccounts(src.accounts)
    };
  }

  /** Fix enabled default: prefer true unless explicitly false */
  function normalizeLaneStrict(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
      enabled: src.enabled !== false,
      countries: filterKnownCountries(src.countries),
      regions: filterKnownRegions(src.regions),
      accounts: normalizeAccounts(src.accounts)
    };
  }

  /**
   * Migrate legacy shape:
   * { mode, blockedCountries, blockedRegions, managedAccounts:[{screenName,mode,ts}] }
   */
  function migrateLegacy(src) {
    if (!src || typeof src !== 'object') return null;
    if (src.block && typeof src.block === 'object' && src.mute && typeof src.mute === 'object') {
      return null; // already new shape
    }
    if (
      !('mode' in src) &&
      !('blockedCountries' in src) &&
      !('blockedRegions' in src) &&
      !('managedAccounts' in src)
    ) {
      return null;
    }

    const mode = src.mode === 'mute' ? 'mute' : 'block';
    const block = emptyLane(true);
    const mute = emptyLane(true);
    const countries = filterKnownCountries(src.blockedCountries);
    const regions = filterKnownRegions(src.blockedRegions);

    if (mode === 'mute') {
      mute.countries = countries;
      mute.regions = regions;
    } else {
      block.countries = countries;
      block.regions = regions;
    }

    if (Array.isArray(src.managedAccounts)) {
      for (const raw of src.managedAccounts) {
        if (!raw || typeof raw !== 'object') continue;
        const screenName = normalizeScreenName(raw.screenName);
        if (!screenName) continue;
        const ts =
          typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : Date.now();
        const lane = raw.mode === 'mute' ? mute : block;
        lane.accounts.push({
          screenName,
          name: normalizeDisplayName(raw.name, screenName),
          avatarUrl: normalizeAvatarUrl(raw.avatarUrl),
          ts
        });
      }
      block.accounts = normalizeAccounts(block.accounts);
      mute.accounts = normalizeAccounts(mute.accounts);
    }

    return { block, mute };
  }

  function normalizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const migrated = migrateLegacy(src);
    if (migrated) {
      return {
        block: normalizeLaneStrict(migrated.block),
        mute: normalizeLaneStrict(migrated.mute)
      };
    }
    return {
      block: normalizeLaneStrict(src.block),
      mute: normalizeLaneStrict(src.mute)
    };
  }

  async function getSettings() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return normalizeSettings(data[STORAGE_KEY]);
    } catch (_) {
      return {
        block: emptyLane(true),
        mute: emptyLane(true)
      };
    }
  }

  async function setSettings(partial) {
    const current = await getSettings();
    const nextRaw = {
      block: { ...current.block, ...(partial?.block || {}) },
      mute: { ...current.mute, ...(partial?.mute || {}) }
    };
    // Deep-merge arrays if provided at top level of lane
    if (partial?.block) {
      if (Array.isArray(partial.block.countries)) nextRaw.block.countries = partial.block.countries;
      if (Array.isArray(partial.block.regions)) nextRaw.block.regions = partial.block.regions;
      if (Array.isArray(partial.block.accounts)) nextRaw.block.accounts = partial.block.accounts;
      if ('enabled' in partial.block) nextRaw.block.enabled = partial.block.enabled;
    }
    if (partial?.mute) {
      if (Array.isArray(partial.mute.countries)) nextRaw.mute.countries = partial.mute.countries;
      if (Array.isArray(partial.mute.regions)) nextRaw.mute.regions = partial.mute.regions;
      if (Array.isArray(partial.mute.accounts)) nextRaw.mute.accounts = partial.mute.accounts;
      if ('enabled' in partial.mute) nextRaw.mute.enabled = partial.mute.enabled;
    }
    const next = normalizeSettings(nextRaw);
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
    } catch (_) {
      /* ignore */
    }
    return next;
  }

  async function setLaneEnabled(lane, enabled) {
    if (!isLane(lane)) return getSettings();
    return setSettings({ [lane]: { enabled: !!enabled } });
  }

  async function toggleLaneList(lane, field, key) {
    if (!isLane(lane) || (field !== 'countries' && field !== 'regions')) {
      return getSettings();
    }
    const k = typeof key === 'string' ? key.trim().toLowerCase() : '';
    if (!k) return getSettings();
    const current = await getSettings();
    const set = new Set(current[lane][field] || []);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    const sorted = [...set].sort((a, b) => a.localeCompare(b));
    return setSettings({ [lane]: { [field]: sorted } });
  }

  async function toggleLaneCountry(lane, key) {
    return toggleLaneList(lane, 'countries', key);
  }

  async function toggleLaneRegion(lane, key) {
    return toggleLaneList(lane, 'regions', key);
  }

  async function recordManagedAccount({
    screenName,
    lane,
    name: displayName,
    avatarUrl,
    skipBadge = false
  } = {}) {
    const handle = normalizeScreenName(screenName);
    const L = isLane(lane) ? lane : 'block';
    if (!handle) return getSettings();
    const current = await getSettings();
    const prev = (current[L].accounts || []).find(a => a.screenName === handle);
    const rest = (current[L].accounts || []).filter(a => a.screenName !== handle);
    rest.unshift({
      screenName: handle,
      name:
        normalizeDisplayName(displayName, handle) ||
        prev?.name ||
        handle,
      avatarUrl: normalizeAvatarUrl(avatarUrl) || prev?.avatarUrl || '',
      ts: Date.now()
    });
    const settings = await setSettings({ [L]: { accounts: rest } });

    // Notify SW for toolbar badge (session counter + red/yellow flash).
    // skipBadge when the SW already handles the badge (RECORD_ACCOUNT path).
    if (!skipBadge) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'ACCOUNT_MANAGED',
            payload: { lane: L, screenName: handle }
          });
        }
      } catch (_) {
        /* ignore */
      }
    }

    return settings;
  }

  async function releaseManagedAccount(lane, screenName) {
    const L = isLane(lane) ? lane : '';
    const name = normalizeScreenName(screenName);
    if (!L || !name) {
      return { settings: await getSettings(), released: null };
    }
    const current = await getSettings();
    const released =
      (current[L].accounts || []).find(a => a.screenName === name) || null;
    const nextList = (current[L].accounts || []).filter(a => a.screenName !== name);
    const settings = await setSettings({ [L]: { accounts: nextList } });

    if (released) {
      try {
        chrome.runtime.sendMessage({
          type: 'RELEASE_ACCOUNT',
          payload: { screenName: released.screenName, mode: L }
        });
      } catch (_) {
        /* best-effort */
      }
    }

    return { settings, released: released ? { ...released, mode: L } : null };
  }

  const api = {
    STORAGE_KEY,
    DEFAULTS,
    LANES,
    isLane,
    normalizeScreenName,
    normalizeSettings,
    getSettings,
    setSettings,
    setLaneEnabled,
    toggleLaneCountry,
    toggleLaneRegion,
    recordManagedAccount,
    releaseManagedAccount
  };

  global.XCD_SETTINGS = api;
  if (typeof self !== 'undefined') self.XCD_SETTINGS = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
