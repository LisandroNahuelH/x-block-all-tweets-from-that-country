/**
 * Toolbar badge: session managed-account counter + flash on block (red) / mute (yellow).
 * Loaded in the service worker (importScripts).
 */
(function (global) {
  'use strict';

  const SESSION_KEY = 'xcd_session_managed_count';
  const COLOR_IDLE = '#0c8c28'; // Premium11 green — resting count
  const COLOR_BLOCK = '#E53935';
  const COLOR_MUTE = '#F9A825';
  const COLOR_NOTINTERESTED = '#42A5F5';
  const COLOR_DIM = '#102434';

  function colorForLane(lane) {
    if (lane === 'mute') return COLOR_MUTE;
    if (lane === 'notinterested') return COLOR_NOTINTERESTED;
    return COLOR_BLOCK;
  }

  let flashGen = 0;

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function formatBadge(n) {
    const v = Math.max(0, Number(n) || 0);
    if (v <= 0) return '';
    if (v > 999) return '999+';
    return String(v);
  }

  async function getSessionCount() {
    try {
      if (chrome.storage?.session) {
        const data = await chrome.storage.session.get(SESSION_KEY);
        return Math.max(0, Number(data[SESSION_KEY]) || 0);
      }
    } catch (_) {
      /* fall through */
    }
    try {
      const data = await chrome.storage.local.get(SESSION_KEY);
      return Math.max(0, Number(data[SESSION_KEY]) || 0);
    } catch (_) {
      return 0;
    }
  }

  async function setSessionCount(n) {
    const v = Math.max(0, Number(n) || 0);
    try {
      if (chrome.storage?.session) {
        await chrome.storage.session.set({ [SESSION_KEY]: v });
        return;
      }
    } catch (_) {
      /* fall through */
    }
    try {
      await chrome.storage.local.set({ [SESSION_KEY]: v });
    } catch (_) {
      /* ignore */
    }
  }

  async function paintBadgeCount() {
    const n = await getSessionCount();
    const text = formatBadge(n);
    try {
      await chrome.action.setBadgeText({ text });
      await chrome.action.setBadgeBackgroundColor({ color: text ? COLOR_IDLE : COLOR_DIM });
      if (chrome.action.setBadgeTextColor) {
        await chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
      }
    } catch (_) {
      /* ignore (no action API) */
    }
  }

  /**
   * Flash toolbar badge for a managed action, then restore the session counter.
   * @param {'block'|'mute'|'notinterested'} lane
   */
  async function flashManaged(lane) {
    const color = colorForLane(lane);
    const gen = ++flashGen;
    const n = await getSessionCount();
    const text = formatBadge(n) || '!';
    const textColor = lane === 'mute' ? '#1a1200' : '#FFFFFF';

    for (let i = 0; i < 4; i++) {
      if (gen !== flashGen) return;
      try {
        await chrome.action.setBadgeText({ text });
        await chrome.action.setBadgeBackgroundColor({ color });
        if (chrome.action.setBadgeTextColor) {
          await chrome.action.setBadgeTextColor({ color: textColor });
        }
      } catch (_) {
        /* ignore */
      }
      await sleep(160);
      if (gen !== flashGen) return;
      try {
        await chrome.action.setBadgeBackgroundColor({ color: COLOR_DIM });
        await chrome.action.setBadgeText({ text: text === '!' ? '' : text });
      } catch (_) {
        /* ignore */
      }
      await sleep(120);
    }

    if (gen === flashGen) await paintBadgeCount();
  }

  /**
   * Increment session counter + flash. Call whenever an account is managed.
   * @param {'block'|'mute'|'notinterested'} lane
   */
  async function onAccountManaged(lane) {
    const L =
      lane === 'mute'
        ? 'mute'
        : lane === 'notinterested'
          ? 'notinterested'
          : 'block';
    const n = (await getSessionCount()) + 1;
    await setSessionCount(n);
    try {
      await chrome.action.setBadgeText({ text: formatBadge(n) });
      await chrome.action.setBadgeBackgroundColor({ color: colorForLane(L) });
    } catch (_) {
      /* ignore */
    }
    flashManaged(L);
    return n;
  }

  async function initBadge() {
    await paintBadgeCount();
  }

  const api = {
    SESSION_KEY,
    getSessionCount,
    setSessionCount,
    paintBadgeCount,
    onAccountManaged,
    flashManaged,
    initBadge
  };

  global.XCD_BADGE = api;
  if (typeof self !== 'undefined') self.XCD_BADGE = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
