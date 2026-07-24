/**
 * Service worker: geo IDB cache + AboutAccountQuery + badge.
 */
importScripts('shared/i18n.js');
importScripts('shared/badge.js');
importScripts('shared/settings.js');
importScripts('shared/geo-cache-idb.js');

const QUERY_ID = 'XRqGa7EeokUU5kppkh13EA';
const BASE_URL = 'https://x.com/i/api/graphql';
const HEADERS_KEY = 'xcd_api_headers';
const MEM_MAX = 10000;
const MIN_INTERVAL_MS = 200;
const MAX_CONCURRENT = 4;

/** @type {Map<string, {value: object, expiry: number}>} */
const memCache = new Map();
/** @type {Record<string, string>|null} */
let apiHeaders = null;
let lastRequestAt = 0;
let active = 0;
/** @type {Array<() => void>} */
const queue = [];
const inflight = new Map();

function hasHeader(headers, name) {
  const wanted = name.toLowerCase();
  return Object.keys(headers || {}).some(k => k.toLowerCase() === wanted);
}

function normalizeHandle(screenName) {
  if (typeof screenName !== 'string') return '';
  return screenName.trim().replace(/^@+/, '').toLowerCase();
}

function memGet(screenName) {
  const key = normalizeHandle(screenName);
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memCache.delete(key);
    return null;
  }
  // LRU touch
  memCache.delete(key);
  memCache.set(key, entry);
  return entry.value;
}

function memSet(screenName, value) {
  const key = normalizeHandle(screenName);
  if (!value?.location) return; // never warm empty
  if (memCache.has(key)) memCache.delete(key);
  if (memCache.size >= MEM_MAX) {
    const first = memCache.keys().next().value;
    memCache.delete(first);
  }
  const ttl = self.XCD_GEO_IDB?.TTL_MS || 60 * 24 * 60 * 60 * 1000;
  memCache.set(key, { value, expiry: Date.now() + ttl });
}

async function cacheGet(screenName) {
  const warm = memGet(screenName);
  if (warm?.location) return warm;
  if (!self.XCD_GEO_IDB) return null;
  const hit = await self.XCD_GEO_IDB.get(screenName);
  if (hit?.location) {
    memSet(screenName, {
      location: hit.location,
      locationAccurate: hit.locationAccurate !== false,
      name: hit.name || ''
    });
    return {
      location: hit.location,
      locationAccurate: hit.locationAccurate !== false,
      name: hit.name || ''
    };
  }
  return null;
}

/**
 * Persist only successful location detections.
 */
async function cachePut(screenName, data) {
  if (!data?.location) return false;
  const payload = {
    location: data.location,
    locationAccurate: data.locationAccurate !== false,
    name: typeof data.name === 'string' ? data.name : ''
  };
  memSet(screenName, payload);
  if (self.XCD_GEO_IDB) {
    await self.XCD_GEO_IDB.put(screenName, payload);
  }
  return true;
}

async function loadHeaders() {
  const data = await chrome.storage.local.get([HEADERS_KEY]);
  if (
    data[HEADERS_KEY] &&
    hasHeader(data[HEADERS_KEY], 'authorization') &&
    hasHeader(data[HEADERS_KEY], 'x-csrf-token')
  ) {
    apiHeaders = data[HEADERS_KEY];
  }
}

function pump() {
  if (!queue.length || active >= MAX_CONCURRENT) return;
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) {
    setTimeout(pump, wait);
    return;
  }
  const job = queue.shift();
  if (!job) return;
  active++;
  lastRequestAt = Date.now();
  job();
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        active--;
        pump();
      }
    });
    pump();
  });
}

function parseResponse(data, requestedScreenName) {
  const user = data?.data?.user_result_by_screen_name?.result;
  const profile = user?.about_profile;
  const returned = user?.core?.screen_name || null;
  if (
    requestedScreenName &&
    returned &&
    returned.toLowerCase() !== requestedScreenName.toLowerCase()
  ) {
    throw Object.assign(new Error('screen_name mismatch'), { code: 'NOT_FOUND' });
  }
  const name = user?.core?.name || null;
  return {
    location: profile?.account_based_in || null,
    locationAccurate: profile?.location_accurate !== false,
    name: name || ''
  };
}

async function fetchFromApi(screenName) {
  const headers = apiHeaders;
  if (!headers) {
    throw Object.assign(new Error('No API headers'), { code: 'NO_HEADERS' });
  }

  const variables = encodeURIComponent(JSON.stringify({ screenName }));
  const url = `${BASE_URL}/${QUERY_ID}/AboutAccountQuery?variables=${variables}`;
  const response = await fetch(url, {
    headers: { ...headers, 'accept-language': 'en-US,en;q=0.9' },
    method: 'GET',
    credentials: 'include',
    mode: 'cors'
  });

  if (response.status === 429) {
    const reset = response.headers.get('x-rate-limit-reset');
    throw Object.assign(new Error('Rate limited'), {
      code: 'RATE_LIMITED',
      retryAfter: reset ? parseInt(reset, 10) * 1000 : Date.now() + 60000
    });
  }
  if (response.status === 401 || response.status === 403) {
    apiHeaders = null;
    await chrome.storage.local.remove(HEADERS_KEY);
    throw Object.assign(new Error('Authentication failed'), { code: 'UNAUTHORIZED' });
  }
  if (response.status === 404) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(`API error: ${response.status}`), { code: 'UNKNOWN' });
  }

  return parseResponse(await response.json(), screenName);
}

async function resolveUser({ screenName }) {
  const cached = await cacheGet(screenName);
  if (cached?.location) {
    return { success: true, data: cached, source: 'cache' };
  }

  try {
    const data = await enqueue(() => fetchFromApi(screenName));
    // Only persist complete positive detections
    if (data?.location) {
      await cachePut(screenName, data);
      return { success: true, data, source: 'api' };
    }
    // No location: return success with null location but DO NOT store
    return { success: true, data: data || { location: null }, source: 'api', stored: false };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code || 'UNKNOWN',
      retryAfter: error.retryAfter || null
    };
  }
}

function handleFetchUserInfo(payload) {
  const key = normalizeHandle(payload?.screenName || '');
  if (!key) return resolveUser(payload);
  if (inflight.has(key)) return inflight.get(key);
  const p = resolveUser(payload).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

function putFromPayload(payload) {
  const screenName = payload?.screenName;
  const data = payload?.data || payload;
  if (!screenName || !data?.location) {
    return { success: false, stored: false, reason: 'incomplete' };
  }
  return cachePut(screenName, {
    location: data.location,
    locationAccurate: data.locationAccurate,
    name: data.name || payload?.name || ''
  }).then(stored => ({ success: stored, stored }));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitTabComplete(tabId, timeoutMs) {
  const limit = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = ok => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        chrome.tabs.onUpdated.removeListener(onUpdated);
      } catch (_) {
        /* ignore */
      }
      if (ok) resolve();
      else reject(new Error('Tab load timeout'));
    };
    const timer = setTimeout(() => finish(false), limit);
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') finish(true);
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs
      .get(tabId)
      .then(tab => {
        if (tab?.status === 'complete') finish(true);
      })
      .catch(() => {
        /* wait for onUpdated */
      });
  });
}

async function sendReleaseToTab(tabId, payload, attempts) {
  const n = attempts || 10;
  let lastErr = 'Content script not ready';
  for (let i = 0; i < n; i++) {
    try {
      const res = await chrome.tabs.sendMessage(tabId, {
        type: 'RUN_RELEASE_ACTION',
        payload
      });
      if (res && res.success) return res;
      if (res && res.success === false) {
        lastErr = res.error || 'Release action failed';
        // Action ran but failed — don't spin forever
        if (i >= 2) throw new Error(lastErr);
      }
    } catch (e) {
      lastErr = e?.message || String(e);
    }
    await sleep(450);
  }
  throw new Error(lastErr);
}

/**
 * Open profile in background tab → unmute/unblock via content engine → close tab.
 */
async function runReleaseOnX(screenName, action) {
  const handle = normalizeHandle(screenName);
  if (!handle) throw new Error('Missing screenName');
  if (action !== 'unmute' && action !== 'unblock') {
    throw new Error('Unsupported action: ' + action);
  }

  const url = 'https://x.com/' + handle;
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitTabComplete(tab.id, 15000);
    // Give SPA + content scripts a beat to mount profile chrome
    await sleep(900);
    const result = await sendReleaseToTab(
      tab.id,
      { screenName: handle, action },
      10
    );
    return result;
  } finally {
    try {
      if (tab?.id != null) await chrome.tabs.remove(tab.id);
    } catch (_) {
      /* ignore */
    }
  }
}

async function handleReleaseAccount(payload) {
  const screenName = payload?.screenName;
  const mode = payload?.mode;
  const name = payload?.name;
  const avatarUrl = payload?.avatarUrl;

  if (mode === 'notinterested') {
    return { success: true, localOnly: true, screenName, mode };
  }

  const action = mode === 'mute' ? 'unmute' : mode === 'block' ? 'unblock' : null;
  if (!action) {
    return { success: false, error: 'Unsupported mode', screenName, mode };
  }

  try {
    const result = await runReleaseOnX(screenName, action);
    return {
      success: true,
      screenName,
      mode,
      action,
      ...(result || {})
    };
  } catch (err) {
    // Re-insert so user can retry; list is source of managed state
    try {
      if (self.XCD_SETTINGS?.recordManagedAccount) {
        await self.XCD_SETTINGS.recordManagedAccount({
          screenName,
          lane: mode,
          name,
          avatarUrl,
          skipBadge: true
        });
      }
    } catch (e) {
      console.warn('[xcd] re-insert after failed release', e);
    }
    console.warn('[xcd] RELEASE_ACCOUNT failed', mode, screenName, err);
    return {
      success: false,
      error: err?.message || String(err),
      screenName,
      mode,
      action,
      reinserted: true
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const { type, payload } = message || {};
    switch (type) {
      case 'CAPTURE_HEADERS': {
        const headers = payload?.headers;
        if (
          headers &&
          hasHeader(headers, 'authorization') &&
          hasHeader(headers, 'x-csrf-token')
        ) {
          apiHeaders = { ...headers };
          await chrome.storage.local.set({ [HEADERS_KEY]: apiHeaders });
          return { success: true };
        }
        return { success: false, error: 'Invalid headers' };
      }
      case 'GEO_CACHE_GET': {
        const data = await cacheGet(payload?.screenName);
        return { success: true, hit: !!(data && data.location), data };
      }
      case 'GEO_CACHE_PUT':
      case 'CACHE_PUT': {
        // Only store successful location detections
        return await putFromPayload(payload);
      }
      case 'GEO_CACHE_STATS': {
        const stats = self.XCD_GEO_IDB
          ? await self.XCD_GEO_IDB.stats()
          : { count: 0 };
        return { success: true, ...stats, mem: memCache.size };
      }
      case 'FETCH_USER_INFO':
        return await handleFetchUserInfo(payload);
      case 'RELEASE_ACCOUNT':
        return await handleReleaseAccount(payload);
      case 'OPEN_URL': {
        const url = typeof payload?.url === 'string' ? payload.url : '';
        if (!url || !/^https?:\/\//i.test(url)) {
          return { success: false, error: 'Invalid url' };
        }
        await chrome.tabs.create({ url, active: true });
        return { success: true };
      }
      case 'ACCOUNT_MANAGED': {
        let lane = 'block';
        if (payload?.lane === 'mute') lane = 'mute';
        else if (payload?.lane === 'notinterested') lane = 'notinterested';
        const count = await self.XCD_BADGE.onAccountManaged(lane);
        return { success: true, count, lane };
      }
      case 'RECORD_ACCOUNT': {
        if (!self.XCD_SETTINGS) return { success: false, error: 'No settings' };
        let lane = 'block';
        if (payload?.lane === 'mute') lane = 'mute';
        else if (payload?.lane === 'notinterested') lane = 'notinterested';
        const settings = await self.XCD_SETTINGS.recordManagedAccount({
          screenName: payload?.screenName,
          lane,
          name: payload?.name,
          avatarUrl: payload?.avatarUrl,
          skipBadge: true
        });
        const count = await self.XCD_BADGE.onAccountManaged(lane);
        return { success: true, settings, count, lane };
      }
      case 'GET_SESSION_MANAGED_COUNT': {
        const count = await self.XCD_BADGE.getSessionCount();
        return { success: true, count };
      }
      default:
        return { success: false, error: 'Unknown type' };
    }
  })()
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));
  return true;
});

async function boot() {
  await loadHeaders();
  if (self.XCD_GEO_IDB?.migrateFromChromeStorage) {
    try {
      const r = await self.XCD_GEO_IDB.migrateFromChromeStorage();
      if (r?.migrated) console.log('[xcd] migrated geo cache entries', r.migrated);
    } catch (e) {
      console.warn('[xcd] geo migrate error', e);
    }
  }
  if (self.XCD_BADGE) self.XCD_BADGE.initBadge();
}

boot();

chrome.runtime.onStartup?.addListener?.(() => {
  self.XCD_BADGE?.initBadge?.();
});
chrome.runtime.onInstalled?.addListener?.(() => {
  self.XCD_BADGE?.initBadge?.();
  boot();
});
