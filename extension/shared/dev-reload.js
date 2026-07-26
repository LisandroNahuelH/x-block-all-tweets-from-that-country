/**
 * Dev-only: poll dist build-stamp and chrome.runtime.reload() when it changes.
 * No-op for Chrome Web Store builds (manifest has update_url).
 */
(function () {
  'use strict';

  try {
    const manifest = chrome.runtime.getManifest();
    if ('update_url' in (manifest || {})) return;
  } catch (_) {
    return;
  }

  let last = '';
  let busy = false;

  async function tick() {
    if (busy) return;
    busy = true;
    try {
      const url = chrome.runtime.getURL('build-stamp.json');
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const text = await res.text();
      if (last && text !== last) {
        console.log('[xcd] build-stamp changed → reload extension');
        chrome.runtime.reload();
        return;
      }
      last = text;
    } catch (_) {
      /* stamp missing or transient read error */
    } finally {
      busy = false;
    }
  }

  setInterval(tick, 900);
  tick();
})();
