/**
 * Shared async/DOM helpers (IDC patterns + XCD auto-engine extras).
 */
(function (global) {
  'use strict';

  const STEALTH_STYLE_ID = 'xcd-menu-stealth-style';
  let stealthDepth = 0;

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

  async function waitForElement(selectors, timeoutMs, pollMs) {
    const expiresAt = Date.now() + timeoutMs;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    const step = typeof pollMs === 'number' ? pollMs : 50;

    while (Date.now() < expiresAt) {
      for (const selector of list) {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) return element;
      }
      await sleep(step);
    }

    throw new Error('Timed out waiting for selectors: ' + list.join(', '));
  }

  function fireEscape(target) {
    if (!target || typeof target.dispatchEvent !== 'function') return;
    const base = {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
      view: typeof window !== 'undefined' ? window : undefined
    };
    try {
      target.dispatchEvent(new KeyboardEvent('keydown', base));
      target.dispatchEvent(new KeyboardEvent('keyup', base));
    } catch (_) {
      /* ignore */
    }
  }

  /** Stronger Escape — IDC never needs this; we use only as fallback. */
  function closeOpenMenus() {
    try {
      const active = document.activeElement;
      fireEscape(active);
      fireEscape(document.body);
      fireEscape(document);
      if (typeof window !== 'undefined') fireEscape(window);
    } catch (_) {
      /* ignore */
    }
  }

  function ensureStealthStyle() {
    if (document.getElementById(STEALTH_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STEALTH_STYLE_ID;
    style.textContent =
      'html.xcd-menu-stealth [data-testid="Dropdown"],' +
      'html.xcd-menu-stealth [role="menu"],' +
      'html.xcd-menu-stealth div[data-testid="HoverCard"] [role="menu"]{' +
      'opacity:0!important;' +
      'pointer-events:auto!important;' +
      '}';
    (document.documentElement || document.head).appendChild(style);
  }

  /** Hide X dropdowns while we click programmatically (auto-engine only). */
  function beginMenuStealth() {
    stealthDepth++;
    if (stealthDepth !== 1) return;
    try {
      ensureStealthStyle();
      document.documentElement.classList.add('xcd-menu-stealth');
    } catch (_) {
      /* ignore */
    }
  }

  function endMenuStealth() {
    stealthDepth = Math.max(0, stealthDepth - 1);
    if (stealthDepth !== 0) return;
    try {
      document.documentElement.classList.remove('xcd-menu-stealth');
    } catch (_) {
      /* ignore */
    }
  }

  function anyMenuOpen() {
    const selectors = [
      'div[data-testid="Dropdown"]',
      'div[role="menu"]',
      'div[data-testid="confirmationSheet"]',
      '[data-testid="confirmationSheetConfirm"]'
    ];
    for (const sel of selectors) {
      const nodes = document.querySelectorAll(sel);
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
      }
    }
    return false;
  }

  async function waitForMenusClosed(timeoutMs, pollMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : 1200;
    const step = typeof pollMs === 'number' ? pollMs : 40;
    const expires = Date.now() + limit;
    while (Date.now() < expires) {
      if (!anyMenuOpen()) return true;
      await sleep(step);
    }
    return !anyMenuOpen();
  }

  global.XCD_ENGINE_LIB = {
    sleep,
    normalizeText,
    waitForElement,
    closeOpenMenus,
    beginMenuStealth,
    endMenuStealth,
    anyMenuOpen,
    waitForMenusClosed
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
