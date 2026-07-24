/**
 * Post/profile menu actions — ported from X - I Don't Care About Your Tweets.
 * open ⋯ menu → click Block / Mute / Not interested → optional confirm.
 */
(function (global) {
  'use strict';

  const lib = () => global.XCD_ENGINE_LIB;

  const SELECTORS = {
    TWEET_ARTICLE: 'article[data-testid="tweet"], article[role="article"]',
    MORE_BUTTON: [
      'button[data-testid="caret"]',
      'div[data-testid="caret"][role="button"]',
      'button[aria-haspopup="menu"]',
      'div[aria-haspopup="menu"][role="button"]'
    ],
    PROFILE_MORE: [
      'button[data-testid="userActions"]',
      '[data-testid="userActions"]',
      'button[data-testid="userActions"] div[role="button"]',
      // Primary column header "More" (not inside a tweet)
      'div[data-testid="primaryColumn"] button[aria-haspopup="menu"]',
      'div[data-testid="primaryColumn"] div[role="button"][aria-haspopup="menu"]'
    ],
    MENU_ROOT: [
      'div[data-testid="Dropdown"]',
      'div[role="menu"]',
      // X sometimes uses a layered sheet without role=menu on the outer node
      'div[data-testid="HoverCard"] div[role="menu"]'
    ],
    CONFIRM: [
      'button[data-testid="confirmationSheetConfirm"]',
      'div[data-testid="confirmationSheet"] button',
      '[role="dialog"] button'
    ]
  };

  /** action kinds: block | mute | dismiss | unmute | unblock */
  const ACTION_DEFINITIONS = {
    block: {
      confirmKeywords: ['block', 'bloquear'],
      // Prefer longer phrases first when scoring
      keywords: [
        'block @',
        'bloquear a @',
        'bloquear a',
        'block ',
        'bloquear',
        'block'
      ],
      excludeKeywords: ['unblock', 'desbloquear']
    },
    mute: {
      confirmKeywords: [],
      keywords: [
        'mute @',
        'silenciar a @',
        'silenciar a',
        'mute ',
        'silenciar',
        'mute'
      ],
      // Critical: "unmute" contains "mute"
      excludeKeywords: ['unmute', 'dejar de silenciar', 'unsilence']
    },
    unmute: {
      confirmKeywords: [],
      keywords: [
        'unmute @',
        'dejar de silenciar a @',
        'dejar de silenciar a',
        'dejar de silenciar',
        'unmute',
        'unsilence'
      ],
      excludeKeywords: []
    },
    unblock: {
      confirmKeywords: ['unblock', 'desbloquear'],
      keywords: [
        'unblock @',
        'desbloquear a @',
        'desbloquear a',
        'unblock',
        'desbloquear'
      ],
      excludeKeywords: []
    },
    dismiss: {
      confirmKeywords: [],
      keywords: [
        'not interested in this post',
        'no me interesa esta publicacion',
        'no me interesa este post',
        'not interested',
        'no me interesa',
        'show fewer posts like this',
        'show fewer',
        'mostrar menos',
        'ver menos'
      ],
      excludeKeywords: []
    }
  };

  function elementLabel(el) {
    if (!(el instanceof HTMLElement)) return '';
    const parts = [
      el.getAttribute('aria-label') || '',
      el.getAttribute('title') || '',
      el.innerText || '',
      el.textContent || ''
    ];
    return parts.join(' ');
  }

  function matchesActionLabel(action, label) {
    const normalizedLabel = lib().normalizeText(label);
    if (!normalizedLabel) return false;
    const def = ACTION_DEFINITIONS[action];
    if (!def) return false;

    for (const bad of def.excludeKeywords || []) {
      if (normalizedLabel.includes(lib().normalizeText(bad))) return false;
    }

    for (const keyword of def.keywords) {
      if (normalizedLabel.includes(lib().normalizeText(keyword))) return true;
    }
    return false;
  }

  function scoreActionLabel(action, label) {
    const normalizedLabel = lib().normalizeText(label);
    if (!normalizedLabel) return -1;
    const def = ACTION_DEFINITIONS[action];
    if (!def) return -1;
    for (const bad of def.excludeKeywords || []) {
      if (normalizedLabel.includes(lib().normalizeText(bad))) return -1;
    }
    let best = -1;
    for (const keyword of def.keywords) {
      const k = lib().normalizeText(keyword);
      if (normalizedLabel.includes(k)) best = Math.max(best, k.length);
    }
    return best;
  }

  function findMoreButton(root) {
    if (!(root instanceof HTMLElement)) return null;
    for (const selector of SELECTORS.MORE_BUTTON) {
      const button = root.querySelector(selector);
      if (button instanceof HTMLElement) return button;
    }
    return null;
  }

  function findProfileMoreButton() {
    // Prefer explicit userActions in primary column
    const primary = document.querySelector('[data-testid="primaryColumn"]');
    const roots = primary ? [primary, document] : [document];

    for (const root of roots) {
      for (const selector of SELECTORS.PROFILE_MORE) {
        const button = root.querySelector(selector);
        if (button instanceof HTMLElement && !button.closest('article[data-testid="tweet"]')) {
          return button;
        }
      }
    }

    // Fallback: first caret not inside a tweet, prefer near Follow/Subscribe buttons
    const candidates = document.querySelectorAll(
      'button[data-testid="caret"], div[data-testid="caret"][role="button"], button[aria-haspopup="menu"], div[role="button"][aria-haspopup="menu"]'
    );
    for (const el of candidates) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest('article[data-testid="tweet"]')) continue;
      if (el.closest('[data-testid="SidebarColumn"]')) continue;
      if (el.closest('nav')) continue;
      // Skip compose / DM style menus if possible
      const al = (el.getAttribute('aria-label') || '').toLowerCase();
      if (al.includes('share') || al.includes('compartir')) continue;
      return el;
    }
    return null;
  }

  function looksLikeTweetArticle(article) {
    if (!(article instanceof HTMLElement)) return false;
    if (article.dataset.testid === 'tweet') return true;
    if (findMoreButton(article)) return true;
    return false;
  }

  function findTweetArticles() {
    return Array.from(document.querySelectorAll(SELECTORS.TWEET_ARTICLE)).filter(
      looksLikeTweetArticle
    );
  }

  async function waitForMenuRoot() {
    // Prefer the last opened dropdown (newest in DOM)
    const expiresAt = Date.now() + 2800;
    while (Date.now() < expiresAt) {
      const menus = [];
      for (const selector of SELECTORS.MENU_ROOT) {
        document.querySelectorAll(selector).forEach(el => {
          if (el instanceof HTMLElement) menus.push(el);
        });
      }
      // visible menus only
      const visible = menus.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (visible.length) return visible[visible.length - 1];
      await lib().sleep(75);
    }
    throw new Error('Timed out waiting for menu root');
  }

  async function openMenuFromButton(button) {
    if (!button) throw new Error('Menu trigger not found');
    lib().closeOpenMenus();
    await lib().sleep(80);
    button.click();
    await lib().sleep(120);
    return waitForMenuRoot();
  }

  async function openPostMenu(article) {
    const moreButton = findMoreButton(article);
    if (!moreButton) throw new Error('Post menu trigger not found');
    return openMenuFromButton(moreButton);
  }

  function collectMenuCandidates(menuRoot) {
    const roots = [];
    if (menuRoot instanceof HTMLElement) roots.push(menuRoot);
    // Also scan all visible menus (X sometimes portals items)
    for (const selector of SELECTORS.MENU_ROOT) {
      document.querySelectorAll(selector).forEach(el => {
        if (el instanceof HTMLElement) roots.push(el);
      });
    }

    const seen = new Set();
    const candidates = [];

    for (const root of roots) {
      const nodes = root.querySelectorAll(
        'button, [role="menuitem"], div[role="menuitem"], a[role="menuitem"], div[tabindex="0"], [data-testid]'
      );
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (seen.has(node)) continue;
        seen.add(node);
        candidates.push(node);
      }
    }

    return candidates;
  }

  function findActionMenuItem(menuRoot, action) {
    const candidates = collectMenuCandidates(menuRoot);
    let best = null;
    let bestScore = -1;

    for (const candidate of candidates) {
      // data-testid hints
      const testId = (candidate.getAttribute('data-testid') || '').toLowerCase();
      if (action === 'unmute' && testId.includes('unmute')) return candidate;
      if (action === 'unblock' && testId.includes('unblock')) return candidate;
      if (action === 'mute' && testId.includes('mute') && !testId.includes('unmute')) {
        return candidate;
      }
      if (action === 'block' && testId.includes('block') && !testId.includes('unblock')) {
        return candidate;
      }

      const label = elementLabel(candidate);
      const score = scoreActionLabel(action, label);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return bestScore >= 0 ? best : null;
  }

  /** Visible profile CTA (blocked profiles often expose Unblock outside ⋯). */
  function findVisibleProfileActionButton(action) {
    if (action !== 'unblock' && action !== 'unmute') return null;
    const roots = [
      document.querySelector('div[data-testid="primaryColumn"]'),
      document.body
    ].filter(Boolean);

    let best = null;
    let bestScore = -1;
    for (const root of roots) {
      const nodes = root.querySelectorAll(
        'button, [role="button"], div[data-testid], a[role="link"]'
      );
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        // Skip tweet caret menus
        if (node.closest('article[data-testid="tweet"], article[role="article"]')) continue;
        const testId = (node.getAttribute('data-testid') || '').toLowerCase();
        if (action === 'unblock' && testId.includes('unblock')) return node;
        if (action === 'unmute' && testId.includes('unmute')) return node;
        const score = scoreActionLabel(action, elementLabel(node));
        if (score > bestScore) {
          bestScore = score;
          best = node;
        }
      }
      if (bestScore >= 0) break;
    }
    return bestScore >= 0 ? best : null;
  }

  function findConfirmationButton(action) {
    const def = ACTION_DEFINITIONS[action];
    if (!def || !def.confirmKeywords.length) return null;

    for (const selector of SELECTORS.CONFIRM) {
      const candidates = Array.from(document.querySelectorAll(selector));
      for (const candidate of candidates) {
        if (!(candidate instanceof HTMLElement)) continue;
        if (candidate.dataset.testid === 'confirmationSheetConfirm') return candidate;
        const normalizedLabel = lib().normalizeText(elementLabel(candidate));
        for (const keyword of def.confirmKeywords) {
          if (normalizedLabel.includes(lib().normalizeText(keyword))) return candidate;
        }
      }
    }
    return null;
  }

  async function clickConfirmationIfPresent(action) {
    try {
      await lib().waitForElement(SELECTORS.CONFIRM, 900);
    } catch {
      return;
    }
    const confirmationButton = findConfirmationButton(action);
    if (confirmationButton) confirmationButton.click();
  }

  function debugMenuSnapshot(action) {
    try {
      const items = collectMenuCandidates(document.body)
        .map(el => ({
          testId: el.getAttribute('data-testid'),
          role: el.getAttribute('role'),
          label: elementLabel(el).slice(0, 120)
        }))
        .filter(x => x.label && x.label.trim().length > 0)
        .slice(0, 40);
      console.warn('[xcd] menu items while looking for', action, items);
    } catch (_) {
      /* ignore */
    }
  }

  async function findActionWithRetry(menuRoot, action) {
    let item = findActionMenuItem(menuRoot, action);
    if (item) return item;
    await lib().sleep(200);
    item = findActionMenuItem(menuRoot, action);
    if (item) return item;
    // One more pass after short wait (slow render)
    await lib().sleep(350);
    return findActionMenuItem(menuRoot, action);
  }

  /**
   * @param {HTMLElement} article
   * @param {'block'|'mute'|'dismiss'|'unmute'|'unblock'} action
   */
  async function runPostAction(article, action) {
    try {
      const menuRoot = await openPostMenu(article);
      const menuItem = await findActionWithRetry(menuRoot, action);
      if (!menuItem) {
        debugMenuSnapshot(action);
        lib().closeOpenMenus();
        throw new Error('Action item not found: ' + action);
      }
      menuItem.click();
      await clickConfirmationIfPresent(action);
      await lib().sleep(250);
    } catch (error) {
      lib().closeOpenMenus();
      throw error;
    }
  }

  /**
   * @param {'block'|'mute'|'dismiss'|'unmute'|'unblock'} action
   */
  async function runProfileAction(action) {
    try {
      // Prefer visible CTA for reverse actions (blocked profile Unblock, etc.)
      if (action === 'unblock' || action === 'unmute') {
        const visible = findVisibleProfileActionButton(action);
        if (visible) {
          visible.click();
          await clickConfirmationIfPresent(action);
          await lib().sleep(250);
          return;
        }
      }

      const moreButton = findProfileMoreButton();
      if (!moreButton) throw new Error('Profile menu trigger not found');
      const menuRoot = await openMenuFromButton(moreButton);
      const menuItem = await findActionWithRetry(menuRoot, action);
      if (!menuItem) {
        // Last resort: scan page again after menu open
        const fallback = findVisibleProfileActionButton(action);
        if (fallback) {
          lib().closeOpenMenus();
          await lib().sleep(80);
          fallback.click();
          await clickConfirmationIfPresent(action);
          await lib().sleep(250);
          return;
        }
        debugMenuSnapshot(action);
        lib().closeOpenMenus();
        throw new Error('Profile action item not found: ' + action);
      }
      menuItem.click();
      await clickConfirmationIfPresent(action);
      await lib().sleep(250);
    } catch (error) {
      lib().closeOpenMenus();
      throw error;
    }
  }

  global.XCD_ENGINE_ACTIONS = {
    SELECTORS,
    ACTION_DEFINITIONS,
    findTweetArticles,
    findMoreButton,
    findProfileMoreButton,
    findVisibleProfileActionButton,
    runPostAction,
    runProfileAction,
    matchesActionLabel,
    findActionMenuItem
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
