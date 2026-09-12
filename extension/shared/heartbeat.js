/**
 * Pseudonymous usage heartbeat → Premium11 (install / update / ping).
 * Fire-and-forget; never blocks SW or popup.
 */
;(() => {
  const PRODUCT = 'x-block-all-tweets-from-that-country';
  const ENDPOINT = 'https://www.premium11.com/api/heartbeat';
  // Public client key: identifies this product; ships in every released build, not confidential.
  const API_KEY = '0xathm93deqzsbw6u1folgj7kric4ynv';
  const THROTTLE_MS = 24 * 60 * 60 * 1000;
  const INSTALL_ID_KEY = 'xcd_installId';
  const LAST_AT_KEY = 'xcd_lastHeartbeatAt';
  const FAREWELL_BASE =
    'https://www.premium11.com/goodbye/x-block-all-tweets-from-that-country';

  function storageGet(keys) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(keys, (r) => resolve(r || {}));
      } catch (_) {
        resolve({});
      }
    });
  }

  function storageSet(obj) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(obj, () => resolve());
      } catch (_) {
        resolve();
      }
    });
  }

  async function ensureInstallId() {
    const cur = await storageGet([INSTALL_ID_KEY]);
    const existing = cur[INSTALL_ID_KEY];
    if (typeof existing === 'string' && existing.length >= 32) return existing;
    const id = crypto.randomUUID();
    await storageSet({ [INSTALL_ID_KEY]: id });
    return id;
  }

  function resolveExtVersion() {
    try {
      return chrome.runtime.getManifest()?.version || 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }

  function resolveLocale() {
    try {
      return chrome.i18n?.getUILanguage?.() || 'und';
    } catch (_) {
      return 'und';
    }
  }

  function resolveTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (typeof tz === 'string' && tz.length > 0 && tz.length <= 64) return tz;
      return 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }

  async function resolveInstallChannel() {
    try {
      const selfInfo = await chrome.management?.getSelf?.();
      const t = selfInfo?.installType;
      if (t === 'development') return 'unpacked';
      if (t === 'normal') return 'store';
      if (t === 'sideload') return 'sideload';
      if (t === 'admin') return 'admin';
      return 'unknown';
    } catch (_) {
      return 'unknown';
    }
  }

  async function sendAnonymousHeartbeat(event) {
    try {
      const now = Date.now();
      if (event === 'ping') {
        const cur = await storageGet([LAST_AT_KEY]);
        const last = cur[LAST_AT_KEY];
        if (typeof last === 'number' && now - last < THROTTLE_MS) return;
      }

      const installId = await ensureInstallId();
      const body = {
        v: 1,
        product: PRODUCT,
        event,
        extVersion: resolveExtVersion(),
        installId,
        installChannel: await resolveInstallChannel(),
        locale: resolveLocale(),
        timezone: resolveTimezone(),
        ts: now
      };

      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Heartbeat-Key': API_KEY
        },
        body: JSON.stringify(body),
        keepalive: true
      });

      if (!response.ok) return;
      let throttled = false;
      try {
        const data = await response.json();
        throttled = data?.throttled === true;
      } catch (_) {}
      if (throttled) return;
      if (event === 'ping') await storageSet({ [LAST_AT_KEY]: now });
    } catch (_) {
      /* never block */
    }
  }

  async function registerUninstallFarewellUrl() {
    try {
      if (!chrome.runtime?.setUninstallURL) return;
      const installId = await ensureInstallId();
      const url = new URL(FAREWELL_BASE);
      url.searchParams.set('id', installId);
      url.searchParams.set('v', resolveExtVersion());
      await chrome.runtime.setUninstallURL(url.toString());
    } catch (_) {
      /* never block */
    }
  }

  self.XCD_HEARTBEAT = {
    PRODUCT,
    ensureInstallId,
    sendAnonymousHeartbeat,
    registerUninstallFarewellUrl
  };
})();
