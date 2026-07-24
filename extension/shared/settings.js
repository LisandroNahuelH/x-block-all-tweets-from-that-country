/**
 * Shared settings (chrome.storage.local).
 * Independent lanes: block, mute, notinterested.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'xcd_settings';
  const LANE_IDS = ['block', 'mute', 'notinterested'];
  const LANES = new Set(LANE_IDS);
  const SCREEN_RE = /^[a-zA-Z0-9_]{1,15}$/;

  function emptyLane(enabled = true) {
    return {
      enabled: enabled !== false,
      countries: [],
      regions: [],
      accounts: []
    };
  }

  function emptySettings() {
    return {
      block: emptyLane(true),
      mute: emptyLane(true),
      notinterested: emptyLane(true),
      showCountryLabels: true,
      tallerColumns: false,
      geoLocalCache: true
    };
  }

  const DEFAULTS = Object.freeze({
    block: Object.freeze(emptyLane(true)),
    mute: Object.freeze(emptyLane(true)),
    notinterested: Object.freeze(emptyLane(true)),
    showCountryLabels: true,
    tallerColumns: false,
    geoLocalCache: true
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
      const name = normalizeDisplayName(raw.name, screenName) || prev?.name || screenName;
      const avatarUrl = normalizeAvatarUrl(raw.avatarUrl) || prev?.avatarUrl || '';
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
   * Legacy: { mode, blockedCountries, blockedRegions, managedAccounts }
   * or dual-lane without notinterested.
   */
  function migrateLegacy(src) {
    if (!src || typeof src !== 'object') return null;

    // Already multi-lane product shape (has block + mute objects).
    if (src.block && typeof src.block === 'object' && src.mute && typeof src.mute === 'object') {
      return null;
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
    const out = emptySettings();
    const countries = filterKnownCountries(src.blockedCountries);
    const regions = filterKnownRegions(src.blockedRegions);
    out[mode].countries = countries;
    out[mode].regions = regions;

    if (Array.isArray(src.managedAccounts)) {
      for (const raw of src.managedAccounts) {
        if (!raw || typeof raw !== 'object') continue;
        const screenName = normalizeScreenName(raw.screenName);
        if (!screenName) continue;
        const ts =
          typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : Date.now();
        let lane = 'block';
        if (raw.mode === 'mute') lane = 'mute';
        else if (raw.mode === 'notinterested' || raw.mode === 'ni') lane = 'notinterested';
        out[lane].accounts.push({
          screenName,
          name: normalizeDisplayName(raw.name, screenName),
          avatarUrl: normalizeAvatarUrl(raw.avatarUrl),
          ts
        });
      }
      for (const id of LANE_IDS) {
        out[id].accounts = normalizeAccounts(out[id].accounts);
      }
    }

    return out;
  }

  function normalizeSettings(raw) {
    const src = raw && typeof raw === 'object' ? raw : {};
    const migrated = migrateLegacy(src);
    const base = migrated || src;
    return {
      block: normalizeLaneStrict(base.block),
      mute: normalizeLaneStrict(base.mute),
      notinterested: normalizeLaneStrict(base.notinterested),
      showCountryLabels: base.showCountryLabels !== false,
      tallerColumns: base.tallerColumns === true,
      geoLocalCache: base.geoLocalCache !== false
    };
  }

  function applyLanePartial(target, partial) {
    if (!partial || typeof partial !== 'object') return target;
    const next = { ...target, ...partial };
    if (Array.isArray(partial.countries)) next.countries = partial.countries;
    if (Array.isArray(partial.regions)) next.regions = partial.regions;
    if (Array.isArray(partial.accounts)) next.accounts = partial.accounts;
    if ('enabled' in partial) next.enabled = partial.enabled;
    return next;
  }

  async function getSettings() {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      return normalizeSettings(data[STORAGE_KEY]);
    } catch (_) {
      return emptySettings();
    }
  }

  async function setSettings(partial) {
    const current = await getSettings();
    const nextRaw = {
      block: applyLanePartial(current.block, partial?.block),
      mute: applyLanePartial(current.mute, partial?.mute),
      notinterested: applyLanePartial(current.notinterested, partial?.notinterested),
      showCountryLabels:
        partial && 'showCountryLabels' in partial
          ? !!partial.showCountryLabels
          : current.showCountryLabels !== false,
      tallerColumns:
        partial && 'tallerColumns' in partial
          ? !!partial.tallerColumns
          : current.tallerColumns === true,
      geoLocalCache:
        partial && 'geoLocalCache' in partial
          ? !!partial.geoLocalCache
          : current.geoLocalCache !== false
    };
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

  async function setShowCountryLabels(enabled) {
    return setSettings({ showCountryLabels: !!enabled });
  }

  async function setTallerColumns(enabled) {
    return setSettings({ tallerColumns: !!enabled });
  }

  async function setGeoLocalCache(enabled) {
    return setSettings({ geoLocalCache: !!enabled });
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
      name: normalizeDisplayName(displayName, handle) || prev?.name || handle,
      avatarUrl: normalizeAvatarUrl(avatarUrl) || prev?.avatarUrl || '',
      ts: Date.now()
    });
    const settings = await setSettings({ [L]: { accounts: rest } });

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

    let releaseResult = null;
    if (released) {
      try {
        releaseResult = await new Promise(resolve => {
          try {
            chrome.runtime.sendMessage(
              {
                type: 'RELEASE_ACCOUNT',
                payload: {
                  screenName: released.screenName,
                  mode: L,
                  name: released.name,
                  avatarUrl: released.avatarUrl
                }
              },
              response => {
                if (chrome.runtime.lastError) {
                  resolve({
                    success: false,
                    error: chrome.runtime.lastError.message
                  });
                } else {
                  resolve(response || { success: false, error: 'No response' });
                }
              }
            );
          } catch (e) {
            resolve({ success: false, error: e.message });
          }
        });
      } catch (_) {
        releaseResult = { success: false, error: 'send failed' };
      }
    }

    // SW may re-insert on reverse failure — reload canonical settings
    const finalSettings =
      releaseResult && releaseResult.reinserted
        ? await getSettings()
        : settings;

    return {
      settings: finalSettings,
      released: released ? { ...released, mode: L } : null,
      releaseResult
    };
  }

  const api = {
    STORAGE_KEY,
    DEFAULTS,
    LANE_IDS,
    LANES,
    isLane,
    normalizeScreenName,
    normalizeSettings,
    getSettings,
    setSettings,
    setLaneEnabled,
    setShowCountryLabels,
    setTallerColumns,
    setGeoLocalCache,
    toggleLaneCountry,
    toggleLaneRegion,
    recordManagedAccount,
    releaseManagedAccount
  };

  global.XCD_SETTINGS = api;
  if (typeof self !== 'undefined') self.XCD_SETTINGS = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
