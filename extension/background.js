/**
 * Service worker: cache + AboutAccountQuery fallback + toolbar badge.
 * Tech adaptada de xaitax/x-account-location-device (MIT).
 */
importScripts('shared/i18n.js');
importScripts('shared/badge.js');
importScripts('shared/settings.js');

const QUERY_ID = 'XRqGa7EeokUU5kppkh13EA';
const BASE_URL = 'https://x.com/i/api/graphql';
const CACHE_KEY = 'xcd_location_cache_v1';
const HEADERS_KEY = 'xcd_api_headers';
const CACHE_MAX = 50000;
const CACHE_TTL_MS = 60 * 24 * 60 * 60 * 1000;
const MIN_INTERVAL_MS = 150;
const MAX_CONCURRENT = 8;

/** @type {Map<string, {value: object, expiry: number}>} */
const memCache = new Map();
/** @type {Record<string, string>|null} */
let apiHeaders = null;
let lastRequestAt = 0;
let active = 0;
/** @type {Array<() => void>} */
const queue = [];
const inflight = new Map();
let saveTimer = null;

function hasHeader(headers, name) {
  const wanted = name.toLowerCase();
  return Object.keys(headers || {}).some(k => k.toLowerCase() === wanted);
}

function cacheGet(screenName) {
  const key = screenName.toLowerCase();
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    memCache.delete(key);
    return null;
  }
  memCache.delete(key);
  memCache.set(key, entry);
  return entry.value;
}

function cacheSet(screenName, value) {
  const key = screenName.toLowerCase();
  if (memCache.has(key)) memCache.delete(key);
  if (memCache.size >= CACHE_MAX) {
    const first = memCache.keys().next().value;
    memCache.delete(first);
  }
  memCache.set(key, { value, expiry: Date.now() + CACHE_TTL_MS });
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const obj = {};
    for (const [k, v] of memCache.entries()) obj[k] = v;
    await chrome.storage.local.set({ [CACHE_KEY]: obj });
  }, 5000);
}

async function loadCache() {
  const data = await chrome.storage.local.get([CACHE_KEY, HEADERS_KEY]);
  const raw = data[CACHE_KEY] || {};
  const now = Date.now();
  for (const [k, v] of Object.entries(raw)) {
    if (v?.expiry > now) memCache.set(k, v);
  }
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
  return {
    location: profile?.account_based_in || null,
    locationAccurate: profile?.location_accurate !== false
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
  const cached = cacheGet(screenName);
  if (cached) return { success: true, data: cached, source: 'local' };

  try {
    const data = await enqueue(() => fetchFromApi(screenName));
    cacheSet(screenName, data);
    return { success: true, data, source: 'api' };
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
  const key = (payload?.screenName || '').toLowerCase();
  if (!key) return resolveUser(payload);
  if (inflight.has(key)) return inflight.get(key);
  const p = resolveUser(payload).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
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
      case 'FETCH_USER_INFO':
        return await handleFetchUserInfo(payload);
      case 'CACHE_PUT': {
        if (payload?.screenName && payload?.data) {
          cacheSet(payload.screenName, payload.data);
          return { success: true };
        }
        return { success: false };
      }
      case 'RELEASE_ACCOUNT': {
        // Stub: real X unblock/unmute GraphQL lands with the block engine.
        const screenName = payload?.screenName;
        const mode = payload?.mode;
        console.log('[xcd] RELEASE_ACCOUNT', mode, screenName);
        return { success: true, stub: true, screenName, mode };
      }
      case 'OPEN_URL': {
        // Open from SW so the popup can close immediately without hanging.
        const url = typeof payload?.url === 'string' ? payload.url : '';
        if (!url || !/^https?:\/\//i.test(url)) {
          return { success: false, error: 'Invalid url' };
        }
        await chrome.tabs.create({ url, active: true });
        return { success: true };
      }
      case 'ACCOUNT_MANAGED': {
        // Flash badge + bump session counter (block=red, mute=yellow).
        const lane = payload?.lane === 'mute' ? 'mute' : 'block';
        const count = await self.XCD_BADGE.onAccountManaged(lane);
        return { success: true, count, lane };
      }
      case 'RECORD_ACCOUNT': {
        // Engine / content path: persist account + badge feedback.
        if (!self.XCD_SETTINGS) return { success: false, error: 'No settings' };
        const lane = payload?.lane === 'mute' ? 'mute' : 'block';
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

loadCache();
if (self.XCD_BADGE) self.XCD_BADGE.initBadge();

chrome.runtime.onStartup?.addListener?.(() => {
  self.XCD_BADGE?.initBadge?.();
});
chrome.runtime.onInstalled?.addListener?.(() => {
  self.XCD_BADGE?.initBadge?.();
});

