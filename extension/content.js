/**
 * Content script: encuentra usernames en el DOM de X y resuelve país/región.
 * Tech adaptada de xaitax/x-account-location-device (MIT).
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

  async function resolveLocation(screenName) {
    const key = screenName.toLowerCase();
    if (localInfo.has(key)) return { success: true, data: localInfo.get(key), source: 'memory' };
    if (pending.has(key)) return pending.get(key);

    const p = (async () => {
      const page = await fetchUserInfoViaPage(screenName);
      if (page?.success && page.data) {
        localInfo.set(key, page.data);
        sendMessage({ type: 'CACHE_PUT', payload: { screenName, data: page.data } });
        return { success: true, data: page.data, source: 'page' };
      }

      const bg = await sendMessage({
        type: 'FETCH_USER_INFO',
        payload: { screenName }
      });
      if (bg?.success && bg.data) {
        localInfo.set(key, bg.data);
        return bg;
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
    // Debug visual mínimo (quitar cuando haya bloqueo)
    if (info?.location && !el.querySelector('.xcd-mark')) {
      const mark = document.createElement('span');
      mark.className = 'xcd-mark';
      const t = (globalThis.XCD_I18N && XCD_I18N.t) || (k => k);
      mark.textContent = t('msg_location_suffix', [info.location]);
      mark.style.cssText = 'font-size:11px;opacity:.75;margin-left:4px;white-space:nowrap;';
      el.appendChild(mark);
    }
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
  });

  injectPageScript();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  window.__xcd = {
    resolveLocation,
    scan,
    cacheSize: () => localInfo.size
  };
})();
