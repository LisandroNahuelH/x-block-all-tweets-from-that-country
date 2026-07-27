/**
 * Content script: location detection + geo auto-action engine.
 * Detection from xaitax/x-account-location-device; actions from I Don't Care About Your Tweets.
 */
(function () {
  'use strict';

  const USERNAME_SEL = '[data-testid="UserName"], [data-testid="User-Name"]';
  const PROCESSED = 'xcdProcessed';
  const localInfo = new Map();
  const pending = new Map();
  let batchTimer = null;
  /** @type {Set<Element>} */
  const pendingEls = new Set();
  let showCountryLabels = true;
  let showCountryFlags = true;

  async function loadUiPrefs() {
    try {
      if (globalThis.XCD_SETTINGS?.getSettings) {
        const s = await globalThis.XCD_SETTINGS.getSettings();
        showCountryLabels = s.showCountryLabels !== false;
        showCountryFlags = s.showCountryFlags !== false;
      }
    } catch (_) {
      showCountryLabels = true;
      showCountryFlags = true;
    }
  }

  function removeAllCountryMarks() {
    document.querySelectorAll('.xcd-mark').forEach(el => el.remove());
  }

  function emojiForLocation(location) {
    const key = String(location || '')
      .trim()
      .toLowerCase();
    if (!key) return '';
    const geo = globalThis.XCD_GEO;
    if (!geo) return '🌍';
    if (geo.COUNTRY_FLAGS && geo.COUNTRY_FLAGS[key]) return geo.COUNTRY_FLAGS[key];
    const region = Array.isArray(geo.REGION_DATA)
      ? geo.REGION_DATA.find(r => r && r.key === key)
      : null;
    if (region?.flag) return region.flag;
    return '🌍';
  }

  function appendFlagNode(container, emoji) {
    const value = emoji || '🏳️';
    try {
      const codePoints = Array.from(value)
        .map(c => c.codePointAt(0).toString(16))
        .join('-');
      if (codePoints) {
        const img = document.createElement('img');
        img.className = 'xcd-flag';
        img.src = `https://abs-0.twimg.com/emoji/v2/svg/${codePoints}.svg`;
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer';
        img.style.cssText =
          'width:14px;height:14px;vertical-align:-2px;margin-right:3px;display:inline-block';
        img.onerror = () => {
          try {
            img.replaceWith(document.createTextNode(value));
          } catch (_) {
            /* ignore */
          }
        };
        container.appendChild(img);
        return;
      }
    } catch (_) {
      /* fall through */
    }
    container.appendChild(document.createTextNode(value));
  }

  function sendMessage(message) {
    return new Promise(resolve => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  }

  function injectPageScript() {
    const url = chrome.runtime.getURL('page-script.js');
    const s = document.createElement('script');
    s.src = url;
    s.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
  }

  function fetchUserInfoViaPage(screenName) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        window.removeEventListener('xcd-fetch-user-result', onResult);
        resolve({ success: false, error: 'Timed out waiting for page fetch' });
      }, 10000);

      function onResult(event) {
        let result;
        try {
          result = JSON.parse(event.detail || '{}');
        } catch {
          return;
        }
        if (result.id !== id) return;
        clearTimeout(timeout);
        window.removeEventListener('xcd-fetch-user-result', onResult);
        resolve(result);
      }

      window.addEventListener('xcd-fetch-user-result', onResult);
      window.dispatchEvent(
        new CustomEvent('xcd-fetch-user', {
          detail: JSON.stringify({ id, screenName })
        })
      );
    });
  }

  function extractUsername(element) {
    const link = element.querySelector('a[href^="/"]');
    if (link) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/([^/?#]+)$/);
      if (match) {
        const username = match[1];
        const invalid = [
          'home',
          'explore',
          'notifications',
          'messages',
          'search',
          'settings',
          'i',
          'compose'
        ];
        if (!invalid.includes(username.toLowerCase())) return username;
      }
    }
    const nodes = element.querySelectorAll('span, div[dir="ltr"]');
    for (const node of nodes) {
      const text = (node.textContent || '').trim();
      if (text.startsWith('@') && text.length > 1) {
        const username = text.slice(1);
        if (/^[a-zA-Z0-9_]{1,15}$/.test(username)) return username;
      }
    }
    return null;
  }

  function isValidScreenName(name) {
    return typeof name === 'string' && /^[a-zA-Z0-9_]{1,15}$/.test(name);
  }

  function hasUsableLocation(data) {
    return !!(data && data.location && String(data.location).trim());
  }

  /** Persist only complete positive detections (handle + location). */
  function persistIfComplete(screenName, data, nameHint) {
    if (!hasUsableLocation(data)) return;
    const payload = {
      location: data.location,
      locationAccurate: data.locationAccurate !== false,
      name: data.name || nameHint || ''
    };
    localInfo.set(screenName.toLowerCase(), {
      location: payload.location,
      locationAccurate: payload.locationAccurate,
      name: payload.name
    });
    sendMessage({
      type: 'GEO_CACHE_PUT',
      payload: { screenName, data: payload }
    });
  }

  async function resolveLocation(screenName) {
    const key = screenName.toLowerCase();
    const warm = localInfo.get(key);
    if (hasUsableLocation(warm)) {
      return { success: true, data: warm, source: 'memory' };
    }
    if (pending.has(key)) return pending.get(key);

    const p = (async () => {
      // Durable cache (IndexedDB via SW) before network
      const cached = await sendMessage({
        type: 'GEO_CACHE_GET',
        payload: { screenName }
      });
      if (cached?.hit && hasUsableLocation(cached.data)) {
        localInfo.set(key, cached.data);
        return { success: true, data: cached.data, source: 'idb' };
      }

      const page = await fetchUserInfoViaPage(screenName);
      if (page?.success && hasUsableLocation(page.data)) {
        persistIfComplete(screenName, page.data);
        return { success: true, data: page.data, source: 'page' };
      }

      const bg = await sendMessage({
        type: 'FETCH_USER_INFO',
        payload: { screenName }
      });
      if (bg?.success && hasUsableLocation(bg.data)) {
        // SW already stored on FETCH; warm content mem
        localInfo.set(key, bg.data);
        return { success: true, data: bg.data, source: bg.source || 'api' };
      }

      // Incomplete / no location: do NOT cache — return soft result
      if (page?.success || bg?.success) {
        return {
          success: true,
          data: { location: null },
          source: 'miss',
          stored: false
        };
      }
      return bg || page || { success: false, error: 'lookup failed' };
    })().finally(() => pending.delete(key));

    pending.set(key, p);
    return p;
  }

  function applyInfo(el, screenName, info) {
    el.dataset.xCountry = info?.location || '';
    el.dataset.xLocationAccurate = info?.locationAccurate === false ? '0' : '1';
    el.dataset.xScreenName = screenName;
    const existing = el.querySelector('.xcd-mark');
    const location = info?.location;
    if (!location || (!showCountryLabels && !showCountryFlags)) {
      if (existing) existing.remove();
      return;
    }
    const mark = existing || document.createElement('span');
    mark.className = 'xcd-mark';
    mark.replaceChildren();
    mark.style.cssText = 'font-size:11px;opacity:.75;margin-left:4px;white-space:nowrap;';
    if (showCountryFlags) appendFlagNode(mark, emojiForLocation(location));
    if (showCountryLabels) {
      const t = (globalThis.XCD_I18N && XCD_I18N.t) || (k => k);
      mark.appendChild(document.createTextNode(t('msg_location_suffix', [location])));
    }
    if (!existing) el.appendChild(mark);
  }

  async function processElement(el) {
    if (!(el instanceof HTMLElement)) return;
    if (el.dataset[PROCESSED]) return;
    el.dataset[PROCESSED] = '1';

    const screenName = extractUsername(el);
    if (!isValidScreenName(screenName)) return;

    const result = await resolveLocation(screenName);
    if (result?.success && result.data) {
      applyInfo(el, screenName, result.data);
    } else {
      el.dataset.xCountry = '';
      el.dataset.xScreenName = screenName;
    }
  }

  function queueElement(el) {
    pendingEls.add(el);
    if (batchTimer) return;
    batchTimer = setTimeout(() => {
      batchTimer = null;
      const batch = [...pendingEls];
      pendingEls.clear();
      for (const node of batch) processElement(node);
    }, 50);
  }

  function scan() {
    document.querySelectorAll(USERNAME_SEL).forEach(queueElement);
  }

  function startObserver() {
    const obs = new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches?.(USERNAME_SEL)) queueElement(node);
          node.querySelectorAll?.(USERNAME_SEL).forEach(queueElement);
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    scan();
  }

  window.addEventListener('xcd-headers-captured', async event => {
    let headers;
    try {
      ({ headers } = JSON.parse(event.detail || '{}'));
    } catch {
      return;
    }
    if (!headers) return;
    await sendMessage({ type: 'CAPTURE_HEADERS', payload: { headers } });
    setTimeout(scan, 250);
    if (globalThis.XCD_ENGINE?.scan) setTimeout(() => globalThis.XCD_ENGINE.scan(), 400);
  });

  injectPageScript();

  // Expose location resolver for the action engine before it starts.
  window.__xcd = {
    resolveLocation,
    scan,
    cacheSize: () => localInfo.size
  };

  function boot() {
    loadUiPrefs().then(() => {
      startObserver();
      if (globalThis.XCD_ENGINE?.start) {
        globalThis.XCD_ENGINE.start();
      }
    });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const key = globalThis.XCD_SETTINGS?.STORAGE_KEY || 'xcd_settings';
        if (!changes[key]) return;
        loadUiPrefs().then(() => {
          if (!showCountryLabels && !showCountryFlags) removeAllCountryMarks();
          else {
            // force re-apply marks on next scan for already-processed nodes
            document.querySelectorAll('[data-xcd-processed], [data-xcdProcessed]').forEach(el => {
              if (el instanceof HTMLElement) {
                delete el.dataset.xcdProcessed;
                delete el.dataset[PROCESSED];
              }
            });
            // also clear PROCESSED camelCase dataset key used by this file
            document.querySelectorAll('[data-x-country]').forEach(el => {
              if (el instanceof HTMLElement && el.dataset[PROCESSED]) {
                delete el.dataset[PROCESSED];
              }
            });
            scan();
          }
        });
      });
    } catch (_) {
      /* ignore */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
