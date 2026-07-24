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
      '[data-testid="userActions"] button',
      '[data-testid="userActions"] [role="button"]',
      '[data-testid="userActions"] div[tabindex="0"]',
      // Primary column header "More" (not inside a tweet)
      'div[data-testid="primaryColumn"] button[aria-haspopup="menu"]',
      'div[data-testid="primaryColumn"] div[role="button"][aria-haspopup="menu"]',
      'div[data-testid="primaryColumn"] button[data-testid="caret"]',
      'div[data-testid="primaryColumn"] div[data-testid="caret"][role="button"]'
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

  function isProfileChromeExcluded(el) {
    if (!(el instanceof HTMLElement)) return true;
    if (el.closest('article[data-testid="tweet"], article[role="article"]')) return true;
    if (el.closest('[data-testid="SidebarColumn"], [data-testid="sidebarColumn"]')) {
      return true;
    }
    if (el.closest('nav, [role="navigation"]')) return true;
    if (el.closest('[data-testid="DMDrawer"], [data-testid="toolBar"]')) return true;
    if (el.closest('[data-testid="primaryColumn"] header[role="banner"]')) {
      // top timeline back/history chrome — keep scanning body of profile
    }
    const al = (el.getAttribute('aria-label') || '').toLowerCase();
    if (
      /share|compartir|grok|reply|retweet|like|bookmark|view post|views|mensaje|message|notificaciones|notifications/.test(
        al
      )
    ) {
      return true;
    }
    return false;
  }

  function resolveClickable(el) {
    if (!(el instanceof HTMLElement)) return null;
    if (
      el.matches('button, [role="button"], [tabindex="0"]') ||
      el.getAttribute('data-testid') === 'caret'
    ) {
      return el;
    }
    const inner = el.querySelector(
      'button, [role="button"], div[tabindex="0"], [data-testid="caret"]'
    );
    return inner instanceof HTMLElement ? inner : el;
  }

  function findProfileMoreButton() {
    const primary =
      document.querySelector('[data-testid="primaryColumn"]') || document.body;
    const roots = primary !== document.body ? [primary, document.body] : [document.body];

    // 1) Explicit userActions (most reliable when present)
    for (const root of roots) {
      const ua = root.querySelector('[data-testid="userActions"]');
      if (ua instanceof HTMLElement && !isProfileChromeExcluded(ua)) {
        return resolveClickable(ua);
      }
    }

    // 2) Declared PROFILE_MORE selectors
    for (const root of roots) {
      for (const selector of SELECTORS.PROFILE_MORE) {
        const hit = root.querySelector(selector);
        if (!(hit instanceof HTMLElement) || isProfileChromeExcluded(hit)) continue;
        return resolveClickable(hit);
      }
    }

    // 3) Score header controls near Follow / DM / UserName (X UI varies by locale)
    const followZone =
      primary.querySelector(
        '[data-testid="placementTracking"], [data-testid="-follow"], [data-testid="sendDMFromProfile"]'
      ) || primary.querySelector('[data-testid="UserName"]');

    const candidates = primary.querySelectorAll(
      'button, div[role="button"], [data-testid="caret"], [aria-haspopup="menu"], [tabindex="0"]'
    );

    let best = null;
    let bestScore = -1;

    for (const el of candidates) {
      if (!(el instanceof HTMLElement) || isProfileChromeExcluded(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      if (rect.width > 96 || rect.height > 96) continue;

      let score = 0;
      const testId = (el.getAttribute('data-testid') || '').toLowerCase();
      const al = (el.getAttribute('aria-label') || '').toLowerCase();
      const hasPopup =
        el.getAttribute('aria-haspopup') === 'menu' ||
        el.getAttribute('aria-haspopup') === 'true';

      if (testId === 'useractions' || testId.includes('useraction')) score += 100;
      if (testId === 'caret') score += 45;
      if (hasPopup) score += 30;
      if (/^(more|más|mas)$/i.test(al.trim())) score += 55;
      if (
        /more options|más opciones|mas opciones|weitere optionen|plus d.options|その他/.test(
          al
        )
      ) {
        score += 50;
      } else if (al.includes('more') && al.length < 48) {
        score += 28;
      }

      if (followZone && followZone.parentElement?.contains(el)) score += 40;
      else if (followZone?.closest('div')?.parentElement?.contains(el)) score += 25;

      // Profile action row is usually upper half of primary column
      if (rect.top > 0 && rect.top < 420) score += 8;

      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return bestScore >= 28 ? resolveClickable(best) : null;
  }

  async function waitForProfileMoreButton(timeoutMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : 1500;
    const expires = Date.now() + limit;
    while (Date.now() < expires) {
      const btn = findProfileMoreButton();
      if (btn) return btn;
      await lib().sleep(50);
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

  function queryVisibleMenus() {
    const menus = [];
    for (const selector of SELECTORS.MENU_ROOT) {
      document.querySelectorAll(selector).forEach(el => {
        if (el instanceof HTMLElement) menus.push(el);
      });
    }
    return menus.filter(el => {
      const r = el.getBoundingClientRect();
      // Stealth sets opacity 0 but keeps layout box — still "open"
      return r.width > 0 && r.height > 0;
    });
  }

  /** IDC-style: poll until Dropdown/menu exists (no fixed pre-delay). */
  async function waitForMenuRoot(timeoutMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : 2000;
    const expiresAt = Date.now() + limit;
    while (Date.now() < expiresAt) {
      const visible = queryVisibleMenus();
      if (visible.length) return visible[visible.length - 1];
      await lib().sleep(40);
    }
    throw new Error('Timed out waiting for menu root');
  }

  /**
   * IDC hot-path: click caret immediately.
   * Only Escape first if a menu is already open (stale layer).
   */
  async function openMenuFromButton(button) {
    if (!button) throw new Error('Menu trigger not found');
    if (lib().anyMenuOpen && lib().anyMenuOpen()) {
      lib().closeOpenMenus();
      await lib().sleep(30);
    }
    button.click();
    return waitForMenuRoot(2000);
  }

  async function openPostMenu(article) {
    if (!(article instanceof HTMLElement) || !article.isConnected) {
      throw new Error('Post menu trigger not found');
    }
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
    const def = ACTION_DEFINITIONS[action];
    if (!def || !def.confirmKeywords || !def.confirmKeywords.length) return;

    let confirmationButton = findConfirmationButton(action);
    if (confirmationButton) {
      confirmationButton.click();
      return;
    }

    const started = Date.now();
    const expires = started + 750;
    while (Date.now() < expires) {
      confirmationButton = findConfirmationButton(action);
      if (confirmationButton) {
        confirmationButton.click();
        return;
      }
      // No sheet after ~120ms → not a confirm flow (or already gone)
      if (
        Date.now() - started >= 120 &&
        !document.querySelector(
          '[data-testid="confirmationSheetConfirm"], [data-testid="confirmationSheet"], [role="dialog"]'
        )
      ) {
        return;
      }
      await lib().sleep(40);
    }
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

  /** Unified poll for menu item (replaces sleep(200)+sleep(350) retries). */
  async function waitForActionMenuItem(menuRoot, action, timeoutMs) {
    const limit = typeof timeoutMs === 'number' ? timeoutMs : 800;
    const expires = Date.now() + limit;
    let root = menuRoot;
    while (Date.now() < expires) {
      if (!(root instanceof HTMLElement) || !root.isConnected) {
        const visible = queryVisibleMenus();
        root = visible.length ? visible[visible.length - 1] : root;
      }
      const item = findActionMenuItem(root, action);
      if (item) return item;
      await lib().sleep(40);
    }
    return findActionMenuItem(menuRoot, action);
  }

  /**
   * IDC-aligned: let X close the menu after item click.
   * Escape only as fallback if the dropdown is still mounted.
   */
  async function runMenuActionFromButton(button, action) {
    const menuRoot = await openMenuFromButton(button);
    const menuItem = await waitForActionMenuItem(menuRoot, action, 800);
    if (!menuItem) {
      debugMenuSnapshot(action);
      lib().closeOpenMenus();
      throw new Error('Action item not found: ' + action);
    }
    menuItem.click();
    await clickConfirmationIfPresent(action);

    // Critical: do NOT Escape immediately — X must process mute/block/NI and collapse the post.
    const closed = await lib().waitForMenusClosed(1200, 40);
    if (!closed) {
      lib().closeOpenMenus();
      await lib().sleep(50);
      if (lib().anyMenuOpen()) {
        lib().closeOpenMenus();
        await lib().sleep(40);
      }
    }
  }

  const FEEDBACK_THANK_YOU = [
    'thanks. x will use this to improve your timeline',
    'thanks. x will use this to make your timeline better',
    'gracias. x usara esto para mejorar tu cronologia'
  ];
  const FEEDBACK_UNDO = ['undo', 'deshacer'];

  function isDismissFeedbackCard(article) {
    if (!(article instanceof HTMLElement)) return false;
    // Real tweets keep data-testid="tweet"; feedback cards usually drop it
    if (article.dataset.testid === 'tweet') return false;
    const text = lib().normalizeText(article.innerText || article.textContent || '');
    if (!text) return false;
    const thanks = FEEDBACK_THANK_YOU.some(k => text.includes(lib().normalizeText(k)));
    if (!thanks) return false;
    return FEEDBACK_UNDO.some(k => text.includes(lib().normalizeText(k)));
  }

  function hideDismissFeedbackCards() {
    const articles = document.querySelectorAll('article[role="article"]');
    for (const article of articles) {
      if (!(article instanceof HTMLElement)) continue;
      if (!isDismissFeedbackCard(article)) continue;
      try {
        article.remove();
      } catch (_) {
        /* ignore */
      }
    }
  }

  /** Remove acted tweet from timeline if X left it fully expanded. */
  function collapseActedArticle(article) {
    if (!(article instanceof HTMLElement) || !article.isConnected) return;
    try {
      const cell =
        article.closest('[data-testid="cellInnerDiv"]') ||
        article.closest('[data-testid="tweet"]')?.parentElement ||
        article;
      if (cell && cell.isConnected) cell.remove();
      else if (article.isConnected) article.remove();
    } catch (_) {
      /* ignore */
    }
  }

  async function settlePostAfterAction(article, action) {
    // Let X swap the tweet for feedback / soft intervene
    const expires = Date.now() + 900;
    while (Date.now() < expires) {
      hideDismissFeedbackCards();
      if (!(article instanceof HTMLElement) || !article.isConnected) return;
      // Feedback replaced this node or sibling appeared
      if (isDismissFeedbackCard(article)) {
        try {
          article.remove();
        } catch (_) {
          /* ignore */
        }
        return;
      }
      // Still a full tweet with caret → wait a bit more
      if (article.dataset.testid === 'tweet' && findMoreButton(article)) {
        await lib().sleep(50);
        continue;
      }
      // Transformed / no caret → treat as handled UI
      return;
    }

    // X processed action (badge path) but left the post fully visible — remove it
    if (
      article instanceof HTMLElement &&
      article.isConnected &&
      (action === 'mute' || action === 'block' || action === 'dismiss')
    ) {
      collapseActedArticle(article);
    }
    hideDismissFeedbackCards();
  }

  /**
   * @param {HTMLElement} article
   * @param {'block'|'mute'|'dismiss'|'unmute'|'unblock'} action
   */
  async function runPostAction(article, action) {
    lib().beginMenuStealth();
    try {
      const target = article;
      if (!(target instanceof HTMLElement) || !target.isConnected) {
        throw new Error('Post menu trigger not found');
      }
      const moreButton = findMoreButton(target);
      if (!moreButton) throw new Error('Post menu trigger not found');
      await runMenuActionFromButton(moreButton, action);
      // Menus must be gone before lifting stealth (else Dropdown flashes back)
      if (lib().anyMenuOpen()) {
        lib().closeOpenMenus();
        await lib().sleep(40);
      }
      lib().endMenuStealth();
      await settlePostAfterAction(target, action);
    } catch (error) {
      lib().closeOpenMenus();
      throw error;
    } finally {
      lib().endMenuStealth();
    }
  }

  /**
   * @param {'block'|'mute'|'dismiss'|'unmute'|'unblock'} action
   * @param {{ screenName?: string }} [opts]
   */
  async function runProfileAction(action, opts) {
    const screenName = opts && opts.screenName ? String(opts.screenName) : '';

    // Prefer a timeline tweet by this author (same IDC hot-path as feed)
    if (screenName && (action === 'mute' || action === 'block' || action === 'dismiss')) {
      const article = findTweetArticleByScreenName(screenName);
      if (article) {
        await runPostAction(article, action);
        return;
      }
    }

    lib().beginMenuStealth();
    try {
      // Prefer visible CTA for reverse actions (blocked profile Unblock, etc.)
      if (action === 'unblock' || action === 'unmute') {
        const visible = findVisibleProfileActionButton(action);
        if (visible) {
          visible.click();
          await clickConfirmationIfPresent(action);
          lib().closeOpenMenus();
          return;
        }
      }

      const moreButton = await waitForProfileMoreButton(1500);
      if (!moreButton) {
        if (screenName && (action === 'mute' || action === 'block')) {
          const article = findTweetArticleByScreenName(screenName);
          if (article) {
            lib().endMenuStealth();
            try {
              await runPostAction(article, action);
            } finally {
              lib().beginMenuStealth();
            }
            return;
          }
        }
        throw new Error('Profile menu trigger not found');
      }

      try {
        await runMenuActionFromButton(moreButton, action);
      } catch (err) {
        const fallback = findVisibleProfileActionButton(action);
        if (fallback) {
          lib().closeOpenMenus();
          fallback.click();
          await clickConfirmationIfPresent(action);
          lib().closeOpenMenus();
          return;
        }
        if (screenName && (action === 'mute' || action === 'block')) {
          lib().closeOpenMenus();
          const article = findTweetArticleByScreenName(screenName);
          if (article) {
            lib().endMenuStealth();
            try {
              await runPostAction(article, action);
            } finally {
              lib().beginMenuStealth();
            }
            return;
          }
        }
        throw err;
      }
    } catch (error) {
      lib().closeOpenMenus();
      throw error;
    } finally {
      lib().endMenuStealth();
    }
  }

  function findTweetArticleByScreenName(screenName) {
    const want = String(screenName || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    if (!want) return null;
    for (const article of findTweetArticles()) {
      if (!(article instanceof HTMLElement)) continue;
      const links = article.querySelectorAll('a[href^="/"]');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const m = href.match(/^\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/);
        if (m && m[1].toLowerCase() === want) return article;
      }
      // @handle text
      const text = article.textContent || '';
      if (text.toLowerCase().includes('@' + want)) {
        if (findMoreButton(article)) return article;
      }
    }
    return null;
  }

  global.XCD_ENGINE_ACTIONS = {
    SELECTORS,
    ACTION_DEFINITIONS,
    findTweetArticles,
    findTweetArticleByScreenName,
    findMoreButton,
    findProfileMoreButton,
    waitForProfileMoreButton,
    findVisibleProfileActionButton,
    runPostAction,
    runProfileAction,
    matchesActionLabel,
    findActionMenuItem,
    hideDismissFeedbackCards,
    isDismissFeedbackCard,
    collapseActedArticle
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
