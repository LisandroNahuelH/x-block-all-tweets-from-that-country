/**
 * Shared async/DOM helpers (port patterns from I Don't Care About Your Tweets).
 */
(function (global) {
  'use strict';

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  async function waitForElement(selectors, timeoutMs) {
    const expiresAt = Date.now() + timeoutMs;
    const list = Array.isArray(selectors) ? selectors : [selectors];

    while (Date.now() < expiresAt) {
      for (const selector of list) {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) return element;
      }
      await sleep(75);
    }

    throw new Error('Timed out waiting for selectors: ' + list.join(', '));
  }

  function closeOpenMenus() {
    try {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      );
    } catch (_) {
      /* ignore */
    }
  }

  global.XCD_ENGINE_LIB = {
    sleep,
    normalizeText,
    waitForElement,
    closeOpenMenus
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
