/**
 * Geo-driven auto actions on X: detect posts/profile → match settings → run menu action.
 */
(function (global) {
  'use strict';

  const LANE_PRIORITY = ['block', 'mute', 'notinterested'];
  const LANE_TO_ACTION = {
    block: 'block',
    mute: 'mute',
    notinterested: 'dismiss'
  };
  const RESERVED = new Set([
    'home',
    'explore',
    'notifications',
    'messages',
    'search',
    'settings',
    'i',
    'compose',
    'login',
    'signup',
    'tos',
    'privacy',
    'jobs',
    'about'
  ]);

  /** @type {object|null} */
  let settings = null;
  /** @type {Set<string>} keys `${lane}:${screenName}` already handled this session */
  const handled = new Set();
  /** @type {Set<string>} in-flight soft-lock `${lane}:${screenName}` */
  const inflight = new Set();
  /** @type {Set<string>} screenNames currently being unmuted/unblocked from popup */
  const releasing = new Set();
  /** @type {Array<() => Promise<void>>} */
  const queue = [];
  let draining = false;
  const QUEUE_GAP_MS = 150;
  let started = false;
  let scanTimer = null;
  let lastProfileKey = '';
  let messageBound = false;

  const lib = () => global.XCD_ENGINE_LIB;
  const actions = () => global.XCD_ENGINE_ACTIONS;

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

  async function loadSettings() {
    if (global.XCD_SETTINGS?.getSettings) {
      settings = await global.XCD_SETTINGS.getSettings();
      return settings;
    }
    return null;
  }

  function getLoggedInUsername() {
    const profileLink = document.querySelector('[data-testid="AppTabBar_Profile_Link"]');
    if (!profileLink) return null;
    const href = profileLink.getAttribute('href') || '';
    if (href.startsWith('/')) return href.slice(1).split(/[/?#]/)[0] || null;
    return null;
  }

  function extractUsernameFromUserNameEl(element) {
    if (!(element instanceof HTMLElement)) return null;
    const link = element.querySelector('a[href^="/"]');
    if (link) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/([^/?#]+)$/);
      if (match && !RESERVED.has(match[1].toLowerCase())) return match[1];
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

  function extractAuthorFromArticle(article) {
    if (!(article instanceof HTMLElement)) return null;
    // Prefer primary author User-Name not inside quoted tweet
    const nameNodes = article.querySelectorAll(
      '[data-testid="User-Name"], [data-testid="UserName"]'
    );
    for (const node of nameNodes) {
      if (!(node instanceof HTMLElement)) continue;
      // skip quoted tweet user cells
      const inQuote =
        node.closest('[role="link"][tabindex="0"]') &&
        node.closest('[role="link"][tabindex="0"]') !== article;
      if (inQuote && article.contains(node.closest('[role="link"][tabindex="0"]'))) {
        // quoted card inside article
        const quoteRoot = node.closest('[role="link"][tabindex="0"]');
        if (quoteRoot && article.contains(quoteRoot) && !quoteRoot.querySelector('time')) {
          continue;
        }
      }
      const name = extractUsernameFromUserNameEl(node);
      if (name) return name;
    }
    // Fallback: first status link
    const statusLink = article.querySelector('a[href*="/status/"]');
    if (statusLink) {
      const href = statusLink.getAttribute('href') || '';
      const m = href.match(/^\/([^/?#]+)\/status\//);
      if (m && !RESERVED.has(m[1].toLowerCase())) return m[1];
    }
    return null;
  }

  function profileScreenNameFromUrl() {
    const path = location.pathname || '';
    const m = path.match(/^\/([^/?#]+)\/?$/);
    if (!m) return null;
    const user = m[1];
    if (RESERVED.has(user.toLowerCase())) return null;
    if (!/^[a-zA-Z0-9_]{1,15}$/.test(user)) return null;
    return user;
  }

  function locationMatchesLane(location, laneState) {
    if (!location || !laneState || laneState.enabled === false) return false;
    const loc = String(location).trim().toLowerCase();
    if (!loc) return false;
    const countries = laneState.countries || [];
    const regions = laneState.regions || [];
    if (countries.includes(loc)) return true;
    if (regions.includes(loc)) return true;
    return false;
  }

  /** Which filter key fired the lane (country before region), same order as locationMatchesLane. */
  function matchedFilter(location, laneState) {
    const loc = String(location || '').trim().toLowerCase();
    if (!loc || !laneState) return null;
    if ((laneState.countries || []).includes(loc)) return { key: loc, kind: 'country' };
    if ((laneState.regions || []).includes(loc)) return { key: loc, kind: 'region' };
    return null;
  }

  /**
   * @returns {{ lane: string, action: string }|null}
   */
  function resolveActionForLocation(location) {
    if (!settings) return null;
    for (const lane of LANE_PRIORITY) {
      const state = settings[lane];
      if (!locationMatchesLane(location, state)) continue;
      return { lane, action: LANE_TO_ACTION[lane] };
    }
    return null;
  }

  function handledKey(lane, screenName) {
    return lane + ':' + String(screenName || '').toLowerCase();
  }

  function isWhitelisted(lane, screenName) {
    const name = String(screenName || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    if (!name) return false;
    const list = settings?.[lane]?.whitelist || [];
    return list.some(s => String(s).toLowerCase() === name);
  }

  function isAlreadyManaged(lane, screenName) {
    const key = handledKey(lane, screenName);
    if (handled.has(key) || inflight.has(key)) return true;
    if (isWhitelisted(lane, screenName)) return true;
    const accounts = settings?.[lane]?.accounts || [];
    return accounts.some(a => (a.screenName || '').toLowerCase() === String(screenName || '').toLowerCase());
  }

  function markHandled(lane, screenName) {
    handled.add(handledKey(lane, screenName));
  }

  function enqueue(job) {
    queue.push(job);
    drainQueue();
  }

  /** Same serial queue; returns a promise for the job result. */
  function enqueueJob(fn) {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        }
      });
      drainQueue();
    });
  }

  async function drainQueue() {
    if (draining) return;
    draining = true;
    while (queue.length) {
      const job = queue.shift();
      try {
        await job();
      } catch (err) {
        console.warn('[xcd] engine job failed', err);
      }
      if (queue.length) await lib().sleep(QUEUE_GAP_MS);
    }
    draining = false;
  }

  function profilePathMatches(screenName) {
    const want = String(screenName || '')
      .trim()
      .replace(/^@+/, '')
      .toLowerCase();
    if (!want) return false;
    const path = (location.pathname || '').split(/[/?#]/)[1] || '';
    return path.toLowerCase() === want;
  }

  async function waitOnProfile(screenName, timeoutMs) {
    const expires = Date.now() + (timeoutMs || 12000);
    while (Date.now() < expires) {
      if (profilePathMatches(screenName)) {
        try {
          await lib().waitForElement(
            [
              'div[data-testid="primaryColumn"]',
              'button[data-testid="userActions"]',
              '[data-testid="userActions"]'
            ],
            1500
          );
          return;
        } catch (_) {
          /* keep waiting */
        }
      }
      await lib().sleep(200);
    }
    throw new Error('Profile not ready for release');
  }

  /**
   * Popup release → reverse mute/block on this tab's profile.
   * @param {string} screenName
   * @param {'unmute'|'unblock'} action
   */
  async function runReleaseAction(screenName, action) {
    const handle = String(screenName || '')
      .trim()
      .replace(/^@+/, '');
    const key = handle.toLowerCase();
    if (!handle) throw new Error('Missing screenName');
    if (action !== 'unmute' && action !== 'unblock') {
      throw new Error('Unsupported release action: ' + action);
    }

    releasing.add(key);
    try {
      await waitOnProfile(handle, 12000);
      await enqueueJob(async () => {
        await actions().runProfileAction(action);
      });
      // Avoid immediate re-apply on this session while list is empty
      if (action === 'unmute') markHandled('mute', handle);
      if (action === 'unblock') markHandled('block', handle);
      return { success: true, screenName: handle, action };
    } finally {
      releasing.delete(key);
    }
  }

  function onRuntimeMessage(message, _sender, sendResponse) {
    if (!message || message.type !== 'RUN_RELEASE_ACTION') return false;
    const payload = message.payload || {};
    runReleaseAction(payload.screenName, payload.action)
      .then(result => sendResponse(result))
      .catch(err =>
        sendResponse({
          success: false,
          error: err?.message || String(err)
        })
      );
    return true;
  }

  function bindMessageListener() {
    if (messageBound) return;
    messageBound = true;
    try {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    } catch (_) {
      /* ignore */
    }
  }

  async function resolveLocation(screenName) {
    // Prefer content.js cache if exposed
    if (global.__xcd?.resolveLocation) {
      return global.__xcd.resolveLocation(screenName);
    }
    return sendMessage({
      type: 'FETCH_USER_INFO',
      payload: { screenName }
    });
  }

  function extractAvatarAndName(article, screenName) {
    let name = '';
    let avatarUrl = '';
    if (article instanceof HTMLElement) {
      const avatar = article.querySelector('img[src*="profile_images"]');
      if (avatar) avatarUrl = avatar.getAttribute('src') || '';
      const nameEl = article.querySelector('[data-testid="User-Name"] a span, [data-testid="UserName"] a span');
      if (nameEl) {
        const t = (nameEl.textContent || '').trim();
        if (t && !t.startsWith('@')) name = t;
      }
    }
    if (!avatarUrl) {
      const img = document.querySelector(
        `img[src*="profile_images"][alt*="${screenName}"], a[href="/${screenName}"] img[src*="profile_images"]`
      );
      if (img) avatarUrl = img.getAttribute('src') || '';
    }
    return { name, avatarUrl };
  }

  async function handleTarget({ screenName, location, article, isProfile }) {
    const self = getLoggedInUsername();
    if (self && self.toLowerCase() === screenName.toLowerCase()) return;
    if (releasing.has(String(screenName || '').toLowerCase())) return;

    const resolved = resolveActionForLocation(location);
    if (!resolved) return;

    const { lane, action } = resolved;
    // Whitelist / already managed → never re-apply geo filter action
    if (isWhitelisted(lane, screenName) || isAlreadyManaged(lane, screenName)) return;

    // Only notinterested needs a tweet article; mute/block work on profile too
    if (action === 'dismiss' && isProfile && !article) return;

    const lockKey = handledKey(lane, screenName);
    inflight.add(lockKey);

    enqueue(async () => {
      if (releasing.has(String(screenName || '').toLowerCase())) {
        inflight.delete(lockKey);
        return;
      }
      if (!locationMatchesLane(location, settings?.[lane])) {
        inflight.delete(lockKey);
        return;
      }

      try {
        // Re-scan for a tweet at job time (SPA may load posts after location resolve)
        let targetArticle = article;
        if (
          targetArticle &&
          (!(targetArticle instanceof HTMLElement) || !targetArticle.isConnected)
        ) {
          targetArticle = null;
        }
        if (
          !targetArticle &&
          (action === 'mute' || action === 'block' || action === 'dismiss')
        ) {
          try {
            targetArticle =
              actions().findTweetArticleByScreenName?.(screenName) || null;
          } catch (_) {
            targetArticle = null;
          }
        }

        // Capture identity before action — settle/collapse may remove the article
        const meta = extractAvatarAndName(targetArticle || article, screenName);

        // Prefer post ⋯ when we have a tweet (more reliable than profile header)
        if (targetArticle) {
          await actions().runPostAction(targetArticle, action);
          article = targetArticle;
        } else if (isProfile) {
          await actions().runProfileAction(action, { screenName });
        } else {
          inflight.delete(lockKey);
          return;
        }

        markHandled(lane, screenName);
        try {
          if (settings?.showActionToasts !== false) {
            const match = matchedFilter(location, settings?.[lane]);
            global.XCD_TOAST?.show?.({
              lane,
              name: meta.name,
              screenName,
              avatarUrl: meta.avatarUrl,
              filterKey: match?.key || '',
              filterKind: match?.kind || ''
            });
          }
        } catch (_) {
          /* ignore */
        }
        // Badge ASAP (do not await — SW keeps alive via sendResponse until flash ends)
        void sendMessage({ type: 'ACCOUNT_MANAGED', payload: { lane } });
        await sendMessage({
          type: 'RECORD_ACCOUNT',
          payload: {
            screenName,
            lane,
            name: meta.name,
            avatarUrl: meta.avatarUrl
          }
        });
        await loadSettings();
      } catch (err) {
        if (isProfile) lastProfileKey = '';
        console.warn('[xcd] action failed', action, screenName, err);
      } finally {
        inflight.delete(lockKey);
      }
    });
  }

  async function processArticle(article) {
    if (!(article instanceof HTMLElement)) return;
    if (article.dataset.xcdEngineDone === '1') return;

    const screenName = extractAuthorFromArticle(article);
    if (!screenName) return;

    article.dataset.xcdEngineDone = '1';
    article.dataset.xScreenName = screenName;

    const result = await resolveLocation(screenName);
    const location = result?.success ? result.data?.location : null;
    if (!location) return;

    article.dataset.xCountry = location;
    await handleTarget({
      screenName,
      location,
      article,
      isProfile: false
    });
  }

  async function processProfile() {
    const screenName = profileScreenNameFromUrl();
    if (!screenName) {
      lastProfileKey = '';
      return;
    }
    const key = screenName.toLowerCase();
    if (lastProfileKey === key) return;
    lastProfileKey = key;

    const result = await resolveLocation(screenName);
    const location = result?.success ? result.data?.location : null;
    if (!location) return;

    // Prefer a timeline tweet by this user (post menu); else profile ⋯ with wait
    let article = null;
    try {
      article = actions().findTweetArticleByScreenName?.(screenName) || null;
    } catch (_) {
      article = null;
    }

    await handleTarget({
      screenName,
      location,
      article,
      isProfile: true
    });
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, 120);
  }

  async function scan() {
    if (!settings) await loadSettings();
    // IDC scavenger: remove "Thanks… Undo" feedback cards from timeline
    try {
      actions().hideDismissFeedbackCards?.();
    } catch (_) {
      /* ignore */
    }
    const articles = actions().findTweetArticles();
    for (const article of articles) {
      processArticle(article);
    }
    processProfile();
  }

  function onStorageChanged(changes, area) {
    if (area !== 'local') return;
    if (!changes[global.XCD_SETTINGS?.STORAGE_KEY || 'xcd_settings']) return;
    loadSettings();
  }

  function start() {
    if (started) return;
    started = true;
    bindMessageListener();

    loadSettings().then(() => {
      scan();
    });

    const observer = new MutationObserver(() => scheduleScan());
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          observer.observe(document.body, { childList: true, subtree: true });
          scan();
        },
        { once: true }
      );
    }

    // SPA navigations
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        lastProfileKey = '';
        scheduleScan();
      }
    }, 800);

    try {
      chrome.storage.onChanged.addListener(onStorageChanged);
    } catch (_) {
      /* ignore */
    }

    global.__xcdEngine = {
      scan,
      loadSettings,
      handled,
      runReleaseAction
    };
  }

  // Accept release messages even before start() (ephemeral profile tabs)
  bindMessageListener();

  global.XCD_ENGINE = { start, scan, loadSettings, runReleaseAction };
})(typeof globalThis !== 'undefined' ? globalThis : self);
