/**
 * Popup: independent Block / Mute / Not interested lanes (Premium11).
 * Keeps open path non-blocking: chunked lists + brand opens via SW then closes.
 */
(function () {
  'use strict';

  const CHECK_SVG =
    '<svg class="geo-check__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M6.2 11.4 2.8 8l1.2-1.2 2.2 2.2 5-5.1L12.4 5.1z"/>' +
    '</svg>';

  const PREMIUM11_HOME = 'https://www.premium11.com/';
  const LANES = ['block', 'mute', 'notinterested'];
  const COUNTRY_CHUNK = 40;

  const t = (key, subs) =>
    (globalThis.XCD_I18N && XCD_I18N.t ? XCD_I18N.t(key, subs) : '') || '';
  const applyDom = root => {
    if (globalThis.XCD_I18N && XCD_I18N.applyDom) XCD_I18N.applyDom(root);
  };

  function emptyLane() {
    return { enabled: true, countries: [], regions: [], accounts: [] };
  }

  /** @type {Record<string, object>} */
  let settings = {
    block: emptyLane(),
    mute: emptyLane(),
    notinterested: emptyLane()
  };

  const queries = {
    block: { regions: '', countries: '', accounts: '' },
    mute: { regions: '', countries: '', accounts: '' },
    notinterested: { regions: '', countries: '', accounts: '' }
  };

  /** Invalidate in-flight chunked renders when a newer render starts or popup dies. */
  const renderSeq = {
    block: { countries: 0 },
    mute: { countries: 0 },
    notinterested: { countries: 0 }
  };

  function laneEls(prefix, laneId, laneDomId) {
    return {
      lane: document.getElementById(laneDomId),
      enabled: document.getElementById(prefix + 'Enabled'),
      regionList: document.getElementById(prefix + 'RegionList'),
      countryList: document.getElementById(prefix + 'CountryList'),
      managedList: document.getElementById(prefix + 'ManagedList'),
      regionCount: document.getElementById(prefix + 'RegionCount'),
      countryCount: document.getElementById(prefix + 'CountryCount'),
      managedCount: document.getElementById(prefix + 'ManagedCount'),
      regionSearch: document.getElementById(prefix + 'RegionSearch'),
      countrySearch: document.getElementById(prefix + 'CountrySearch'),
      managedSearch: document.getElementById(prefix + 'ManagedSearch')
    };
  }

  const els = {
    block: laneEls('block', 'block', 'laneBlock'),
    mute: laneEls('mute', 'mute', 'laneMute'),
    notinterested: laneEls('notinterested', 'notinterested', 'laneNotInterested')
  };

  function yieldToMain() {
    return new Promise(resolve => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => setTimeout(resolve, 0));
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function normalizeQuery(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  function matchesQuery(haystack, query) {
    if (!query) return true;
    return normalizeQuery(haystack).includes(query);
  }

  function paintCount(el, n) {
    if (!el) return;
    el.textContent = t('pop_selected_count', [String(n)]);
  }

  function paintItem(btn, selected) {
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.dataset.selected = selected ? '1' : '0';
    btn.classList.toggle('is-selected', selected);
  }

  function paintLaneEnabled(lane) {
    const ui = els[lane];
    const on = settings[lane]?.enabled !== false;
    if (ui.enabled) ui.enabled.checked = on;
    ui.lane?.classList.toggle('is-off', !on);
  }

  function appendFlag(container, emoji) {
    const value = emoji || '🏳️';
    try {
      const codePoints = Array.from(value)
        .map(c => c.codePointAt(0).toString(16))
        .join('-');
      if (codePoints) {
        const img = document.createElement('img');
        img.className = 'geo-item__flag-img';
        img.src = `https://abs-0.twimg.com/emoji/v2/svg/${codePoints}.svg`;
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.loading = 'lazy';
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
    container.textContent = value;
  }

  function makeGeoItem({ key, flag, label, selected, kind, lane }) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'geo-item';
    btn.dataset.key = key;
    btn.dataset.kind = kind;
    btn.dataset.lane = lane;
    btn.setAttribute('role', 'listitem');
    btn.setAttribute(
      'aria-label',
      (kind === 'region' ? t('a11y_toggle_region') : t('a11y_toggle_country')) +
        ': ' +
        label
    );

    const flagEl = document.createElement('span');
    flagEl.className = 'geo-item__flag';
    flagEl.setAttribute('aria-hidden', 'true');
    appendFlag(flagEl, flag);

    const nameEl = document.createElement('span');
    nameEl.className = 'geo-item__name';
    nameEl.textContent = label;

    const check = document.createElement('span');
    check.className = 'geo-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = CHECK_SVG;

    btn.append(flagEl, nameEl, check);
    paintItem(btn, selected);
    return btn;
  }

  function makeAccountItem(entry, lane) {
    const handle = entry.screenName || '';
    const displayName = (entry.name && String(entry.name).trim()) || handle;
    const avatarUrl = entry.avatarUrl || '';
    const canUndo = settings.undoOnListClick === true;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'geo-item geo-item--account' + (canUndo ? '' : ' geo-item--readonly');
    btn.dataset.key = handle;
    btn.dataset.kind = 'account';
    btn.dataset.lane = lane;
    btn.setAttribute('role', 'listitem');
    btn.setAttribute(
      'aria-label',
      (canUndo ? t('a11y_release_account') : t('a11y_managed_account_locked')) +
        ': ' +
        displayName +
        ' (@' +
        handle +
        ')'
    );

    // Avatar slot (same column as country flags) — upstream AboutAccount avatar.image_url
    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'account-avatar';
    avatarWrap.setAttribute('aria-hidden', 'true');
    if (avatarUrl) {
      const img = document.createElement('img');
      img.className = 'account-avatar__img';
      img.src = avatarUrl;
      img.alt = '';
      img.draggable = false;
      img.decoding = 'async';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        avatarWrap.textContent = (displayName || handle || '?').charAt(0).toUpperCase();
        avatarWrap.classList.add('account-avatar--fallback');
      };
      avatarWrap.appendChild(img);
    } else {
      avatarWrap.textContent = (displayName || handle || '?').charAt(0).toUpperCase();
      avatarWrap.classList.add('account-avatar--fallback');
    }

    const meta = document.createElement('span');
    meta.className = 'account-meta';

    const nameEl = document.createElement('span');
    nameEl.className = 'account-meta__name';
    nameEl.textContent = displayName;

    const handleEl = document.createElement('span');
    handleEl.className = 'account-meta__handle';
    handleEl.textContent = '@' + handle;

    const badge = document.createElement('span');
    let badgeMod = 'account-mode-badge--block';
    let badgeText = t('pop_managed_mode_block');
    if (lane === 'mute') {
      badgeMod = 'account-mode-badge--mute';
      badgeText = t('pop_managed_mode_mute');
    } else if (lane === 'notinterested') {
      badgeMod = 'account-mode-badge--notinterested';
      badgeText = t('pop_managed_mode_notinterested');
    }
    badge.className = 'account-mode-badge ' + badgeMod;
    badge.textContent = badgeText;

    meta.append(nameEl, handleEl, badge);

    const check = document.createElement('span');
    check.className = 'geo-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = CHECK_SVG;

    // 3 slots only: avatar | meta stack | check (same grid as country rows)
    btn.append(avatarWrap, meta, check);
    // When undo is OFF, keep badge look but do not imply "release on click"
    paintItem(btn, canUndo);
    if (!canUndo) {
      btn.classList.add('is-selected');
      btn.setAttribute('aria-pressed', 'true');
    }
    return btn;
  }

  function renderEmpty(listEl, message) {
    const empty = document.createElement('p');
    empty.className = 'geo-empty';
    empty.textContent = message;
    listEl.appendChild(empty);
  }

  function renderRegions(lane) {
    const ui = els[lane];
    if (!ui.regionList || !globalThis.XCD_GEO) return;
    ui.regionList.replaceChildren();
    const q = normalizeQuery(queries[lane].regions);
    const selected = new Set(settings[lane].regions || []);
    let shown = 0;
    const frag = document.createDocumentFragment();
    for (const r of XCD_GEO.REGION_DATA) {
      if (!matchesQuery(r.name, q) && !matchesQuery(r.key, q)) continue;
      shown++;
      frag.appendChild(
        makeGeoItem({
          key: r.key,
          flag: r.flag,
          label: r.name,
          selected: selected.has(r.key),
          kind: 'region',
          lane
        })
      );
    }
    if (!shown) renderEmpty(ui.regionList, t('pop_search_no_results'));
    else ui.regionList.appendChild(frag);
    paintCount(ui.regionCount, selected.size);
  }

  async function renderCountries(lane) {
    const ui = els[lane];
    if (!ui.countryList || !globalThis.XCD_GEO) return;

    const seq = ++renderSeq[lane].countries;
    ui.countryList.replaceChildren();

    const q = normalizeQuery(queries[lane].countries);
    const selected = new Set(settings[lane].countries || []);
    paintCount(ui.countryCount, selected.size);

    // Selected first, then the rest — feels instant when reopening.
    const keys = [];
    for (const key of XCD_GEO.COUNTRY_LIST) {
      const label = XCD_GEO.titleCase(key);
      if (!matchesQuery(label, q) && !matchesQuery(key, q)) continue;
      keys.push(key);
    }
    keys.sort((a, b) => {
      const as = selected.has(a) ? 0 : 1;
      const bs = selected.has(b) ? 0 : 1;
      if (as !== bs) return as - bs;
      return a.localeCompare(b);
    });

    if (!keys.length) {
      renderEmpty(ui.countryList, t('pop_search_no_results'));
      return;
    }

    for (let i = 0; i < keys.length; i += COUNTRY_CHUNK) {
      if (seq !== renderSeq[lane].countries) return;
      const frag = document.createDocumentFragment();
      const slice = keys.slice(i, i + COUNTRY_CHUNK);
      for (const key of slice) {
        frag.appendChild(
          makeGeoItem({
            key,
            flag: XCD_GEO.COUNTRY_FLAGS[key],
            label: XCD_GEO.titleCase(key),
            selected: selected.has(key),
            kind: 'country',
            lane
          })
        );
      }
      ui.countryList.appendChild(frag);
      if (i + COUNTRY_CHUNK < keys.length) await yieldToMain();
    }
  }

  function renderManaged(lane) {
    const ui = els[lane];
    if (!ui.managedList) return;
    ui.managedList.replaceChildren();
    const accounts = settings[lane].accounts || [];
    const q = normalizeQuery(queries[lane].accounts);
    let shown = 0;
    const frag = document.createDocumentFragment();
    for (const entry of accounts) {
      if (
        !matchesQuery(entry.screenName, q) &&
        !matchesQuery('@' + entry.screenName, q)
      ) {
        continue;
      }
      shown++;
      frag.appendChild(makeAccountItem(entry, lane));
    }
    if (!shown) {
      renderEmpty(
        ui.managedList,
        accounts.length === 0 ? t('pop_managed_empty') : t('pop_search_no_results')
      );
    } else {
      ui.managedList.appendChild(frag);
    }
    paintCount(ui.managedCount, accounts.length);
  }

  function renderLaneShell(lane) {
    paintLaneEnabled(lane);
    renderRegions(lane);
    renderManaged(lane);
  }

  async function renderAll() {
    for (const lane of LANES) renderLaneShell(lane);
    // Countries are heavy — paint after first frame so popup chrome is instant.
    await yieldToMain();
    for (const lane of LANES) {
      // sequential per lane keeps main thread lighter than parallel dual 210-lists
      await renderCountries(lane);
    }
  }

  async function onGeoClick(event) {
    const btn = event.target.closest('.geo-item');
    if (!btn || !globalThis.XCD_SETTINGS) return;
    const lane = btn.dataset.lane;
    const key = btn.dataset.key;
    const kind = btn.dataset.kind;
    if (!lane || !key || !kind) return;
    if (settings[lane]?.enabled === false) return;

    if (kind === 'account') {
      if (settings.undoOnListClick !== true) {
        hideReleaseConfirmBar();
        showUndoHintBar();
        return;
      }
      // Confirm whitelist vs once before reverse
      pendingRelease = { lane, key };
      hideUndoHintBar();
      showReleaseConfirmBar();
      return;
    }

    if (kind === 'region') {
      settings = await XCD_SETTINGS.toggleLaneRegion(lane, key);
      const selected = new Set(settings[lane].regions || []);
      paintItem(btn, selected.has(key));
      paintCount(els[lane].regionCount, selected.size);
      return;
    }

    if (kind === 'country') {
      settings = await XCD_SETTINGS.toggleLaneCountry(lane, key);
      const selected = new Set(settings[lane].countries || []);
      paintItem(btn, selected.has(key));
      paintCount(els[lane].countryCount, selected.size);
    }
  }

  async function onEnabledChange(event) {
    const input = event.currentTarget;
    const lane = input?.dataset?.lane;
    if (!lane || !globalThis.XCD_SETTINGS) return;
    settings = await XCD_SETTINGS.setLaneEnabled(lane, !!input.checked);
    paintLaneEnabled(lane);
  }

  function onSearchInput(event) {
    const input = event.currentTarget;
    const lane = input?.dataset?.lane;
    const section = input?.dataset?.section;
    if (!lane || !section || !queries[lane]) return;
    queries[lane][section] = input.value || '';
    if (section === 'regions') renderRegions(lane);
    else if (section === 'countries') renderCountries(lane);
    else if (section === 'accounts') renderManaged(lane);
  }

  /**
   * Never open the site from the popup context and wait.
   * Ask the SW, then close the popup immediately so Chrome stays responsive.
   */
  function onBrandClick(event) {
    event.preventDefault();
    event.stopPropagation();

    try {
      chrome.runtime.sendMessage({ type: 'OPEN_URL', payload: { url: PREMIUM11_HOME } });
    } catch (_) {
      try {
        chrome.tabs.create({ url: PREMIUM11_HOME });
      } catch (_) {
        /* ignore */
      }
    }

    try {
      window.close();
    } catch (_) {
      /* ignore */
    }
  }

  function resolveExtensionVersion() {
    try {
      const v = chrome.runtime.getManifest()?.version;
      if (v) return v;
    } catch (_) {
      /* ignore */
    }
    return globalThis.XCD_RELEASE?.EXTENSION_RELEASE_VERSION || '0.1.0';
  }

  function formatLastUpdate(locale) {
    const iso = globalThis.XCD_RELEASE?.EXTENSION_LAST_UPDATE_ISO || '2026-07-24';
    const parsed = new Date(iso + 'T12:00:00.000Z');
    if (Number.isNaN(parsed.getTime())) return iso;
    const loc = (locale || 'en').replace(/_/g, '-');
    try {
      return new Intl.DateTimeFormat(loc, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(parsed);
    } catch (_) {
      return new Intl.DateTimeFormat('en', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(parsed);
    }
  }

  function fillPremiumFacts() {
    const verEl = document.getElementById('premiumFactVersion');
    const updEl = document.getElementById('premiumFactUpdated');
    if (verEl) verEl.textContent = resolveExtensionVersion();
    if (updEl) {
      let locale = 'en';
      try {
        locale = chrome.i18n.getUILanguage() || 'en';
      } catch (_) {
        /* ignore */
      }
      updEl.textContent = formatLastUpdate(locale);
    }
  }

  function hideAllViews() {
    const main = document.getElementById('mainView');
    const premium = document.getElementById('premiumView');
    const settings = document.getElementById('settingsView');
    if (main) main.hidden = true;
    if (premium) premium.hidden = true;
    if (settings) settings.hidden = true;
    document.getElementById('premiumChip')?.setAttribute('aria-pressed', 'false');
    document.getElementById('settingsChip')?.classList.remove('is-active');
    document.getElementById('settingsChip')?.setAttribute('aria-pressed', 'false');
  }

  function showMainView() {
    hideAllViews();
    const main = document.getElementById('mainView');
    if (main) main.hidden = false;
  }

  function openPremiumView() {
    hideAllViews();
    const view = document.getElementById('premiumView');
    if (view) view.hidden = false;
    fillPremiumFacts();
    document.getElementById('premiumChip')?.setAttribute('aria-pressed', 'true');
  }

  function closePremiumView() {
    showMainView();
  }

  function formatCacheBytes(bytes) {
    const n = typeof bytes === 'number' && Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10 * 1024 ? 1 : 0) + ' KB';
    return (n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1) + ' MB';
  }

  function formatCacheCount(count) {
    const n = typeof count === 'number' && Number.isFinite(count) ? Math.max(0, count) : 0;
    try {
      return new Intl.NumberFormat(undefined).format(n);
    } catch (_) {
      return String(n);
    }
  }

  async function refreshGeoCacheStats() {
    const countEl = document.getElementById('geoCacheCount');
    const bytesEl = document.getElementById('geoCacheBytes');
    if (!countEl && !bytesEl) return;
    try {
      const res = await new Promise(resolve => {
        try {
          chrome.runtime.sendMessage({ type: 'GEO_CACHE_STATS' }, response => {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          });
        } catch (_) {
          resolve(null);
        }
      });
      if (countEl) {
        countEl.textContent =
          res && res.success !== false ? formatCacheCount(res.count || 0) : '—';
      }
      if (bytesEl) {
        bytesEl.textContent =
          res && res.success !== false ? formatCacheBytes(res.bytes || 0) : '—';
      }
    } catch (_) {
      if (countEl) countEl.textContent = '—';
      if (bytesEl) bytesEl.textContent = '—';
    }
  }

  function openSettingsView() {
    hideAllViews();
    const view = document.getElementById('settingsView');
    if (view) view.hidden = false;
    document.getElementById('settingsChip')?.classList.add('is-active');
    document.getElementById('settingsChip')?.setAttribute('aria-pressed', 'true');
    refreshGeoCacheStats();
  }

  function closeSettingsView() {
    showMainView();
  }

  function toggleSettingsView() {
    const view = document.getElementById('settingsView');
    if (view && !view.hidden) {
      closeSettingsView();
      return;
    }
    openSettingsView();
  }

  function applyTallerColumnsClass(on) {
    document.documentElement.classList.toggle('xcd-taller-columns', !!on);
  }

  let undoHintVisible = false;
  let releaseConfirmVisible = false;
  /** @type {{ lane: string, key: string }|null} */
  let pendingRelease = null;

  function setBarVisible(bar, visible, flagRef) {
    if (!bar) return false;
    if (visible) {
      if (flagRef.value) {
        bar.classList.add('is-visible');
        bar.setAttribute('aria-hidden', 'false');
        bar.removeAttribute('inert');
        return true;
      }
      bar.classList.remove('is-visible');
      bar.setAttribute('aria-hidden', 'true');
      bar.setAttribute('inert', '');
      requestAnimationFrame(() => {
        flagRef.value = true;
        bar.classList.add('is-visible');
        bar.setAttribute('aria-hidden', 'false');
        bar.removeAttribute('inert');
      });
      return true;
    }
    flagRef.value = false;
    bar.classList.remove('is-visible');
    bar.setAttribute('aria-hidden', 'true');
    bar.setAttribute('inert', '');
    return false;
  }

  function hideUndoHintBar() {
    setBarVisible(document.getElementById('undoHintBar'), false, {
      get value() {
        return undoHintVisible;
      },
      set value(v) {
        undoHintVisible = v;
      }
    });
  }

  function showUndoHintBar() {
    hideReleaseConfirmBar();
    setBarVisible(document.getElementById('undoHintBar'), true, {
      get value() {
        return undoHintVisible;
      },
      set value(v) {
        undoHintVisible = v;
      }
    });
  }

  function hideReleaseConfirmBar() {
    setBarVisible(document.getElementById('releaseConfirmBar'), false, {
      get value() {
        return releaseConfirmVisible;
      },
      set value(v) {
        releaseConfirmVisible = v;
      }
    });
    pendingRelease = null;
  }

  function showReleaseConfirmBar() {
    hideUndoHintBar();
    setBarVisible(document.getElementById('releaseConfirmBar'), true, {
      get value() {
        return releaseConfirmVisible;
      },
      set value(v) {
        releaseConfirmVisible = v;
      }
    });
  }

  async function enableUndoOnListClickFromHint() {
    if (!globalThis.XCD_SETTINGS) return;
    settings = await XCD_SETTINGS.setUndoOnListClick(true);
    const input = document.getElementById('optUndoOnListClick');
    if (input) input.checked = true;
    for (const L of LANES) renderManaged(L);
    hideUndoHintBar();
  }

  async function confirmRelease(withWhitelist) {
    if (!pendingRelease || !globalThis.XCD_SETTINGS) {
      hideReleaseConfirmBar();
      return;
    }
    const { lane, key } = pendingRelease;
    pendingRelease = null;
    hideReleaseConfirmBar();

    const prevAccounts = settings[lane].accounts || [];
    settings = {
      ...settings,
      [lane]: {
        ...settings[lane],
        accounts: prevAccounts.filter(
          a => (a.screenName || '').toLowerCase() !== String(key).toLowerCase()
        )
      }
    };
    renderManaged(lane);

    try {
      const { settings: next } = await XCD_SETTINGS.releaseManagedAccount(lane, key, {
        reverseOnX: true,
        whitelist: !!withWhitelist
      });
      settings = next || (await XCD_SETTINGS.getSettings());
      renderManaged(lane);
    } catch (err) {
      console.warn('[xcd] release managed failed', err);
      try {
        settings = await XCD_SETTINGS.getSettings();
        renderManaged(lane);
      } catch (_) {
        /* ignore */
      }
    }
  }

  function refreshAllManagedLists() {
    for (const L of LANES) renderManaged(L);
  }

  async function syncShowCountryToggle() {
    const input = document.getElementById('optShowCountryLabels');
    if (!input || !globalThis.XCD_SETTINGS) return;
    const s = await XCD_SETTINGS.getSettings();
    input.checked = s.showCountryLabels !== false;
  }

  async function syncTallerColumnsToggle() {
    const input = document.getElementById('optTallerColumns');
    if (!globalThis.XCD_SETTINGS) return;
    const s = await XCD_SETTINGS.getSettings();
    const on = s.tallerColumns === true;
    if (input) input.checked = on;
    applyTallerColumnsClass(on);
  }

  async function syncGeoLocalCacheToggle() {
    const input = document.getElementById('optGeoLocalCache');
    if (!input || !globalThis.XCD_SETTINGS) return;
    const s = await XCD_SETTINGS.getSettings();
    input.checked = s.geoLocalCache !== false;
  }

  async function syncUndoOnListClickToggle() {
    const input = document.getElementById('optUndoOnListClick');
    if (!input || !globalThis.XCD_SETTINGS) return;
    const s = await XCD_SETTINGS.getSettings();
    input.checked = s.undoOnListClick === true;
  }

  async function onShowCountryToggle(event) {
    const input = event.currentTarget;
    if (!globalThis.XCD_SETTINGS) return;
    await XCD_SETTINGS.setShowCountryLabels(!!input.checked);
  }

  async function onTallerColumnsToggle(event) {
    const input = event.currentTarget;
    if (!globalThis.XCD_SETTINGS) return;
    const on = !!input.checked;
    applyTallerColumnsClass(on);
    await XCD_SETTINGS.setTallerColumns(on);
  }

  async function onGeoLocalCacheToggle(event) {
    const input = event.currentTarget;
    if (!globalThis.XCD_SETTINGS) return;
    await XCD_SETTINGS.setGeoLocalCache(!!input.checked);
  }

  async function onUndoOnListClickToggle(event) {
    const input = event.currentTarget;
    if (!globalThis.XCD_SETTINGS) return;
    const on = !!input.checked;
    settings = await XCD_SETTINGS.setUndoOnListClick(on);
    refreshAllManagedLists();
    if (on) hideUndoHintBar();
  }

  async function init() {
    document.title = t('ext_name') || 'X - Block all tweets from that country or region';
    applyDom(document);
    fillPremiumFacts();
    await syncShowCountryToggle();
    await syncTallerColumnsToggle();
    await syncGeoLocalCacheToggle();
    await syncUndoOnListClickToggle();

    // Wire interactions first so UI is usable even while lists fill.
    document.getElementById('p11Brand')?.addEventListener('click', onBrandClick);
    document.getElementById('premiumChip')?.addEventListener('click', openPremiumView);
    document.getElementById('premiumBack')?.addEventListener('click', closePremiumView);
    document.getElementById('settingsChip')?.addEventListener('click', toggleSettingsView);
    document.getElementById('settingsBack')?.addEventListener('click', closeSettingsView);
    document
      .getElementById('optShowCountryLabels')
      ?.addEventListener('change', onShowCountryToggle);
    document
      .getElementById('optTallerColumns')
      ?.addEventListener('change', onTallerColumnsToggle);
    document
      .getElementById('optGeoLocalCache')
      ?.addEventListener('change', onGeoLocalCacheToggle);
    document
      .getElementById('optUndoOnListClick')
      ?.addEventListener('change', onUndoOnListClickToggle);
    document
      .getElementById('undoHintEnable')
      ?.addEventListener('click', () => {
        enableUndoOnListClickFromHint().catch(() => {});
      });
    document
      .getElementById('undoHintDismiss')
      ?.addEventListener('click', hideUndoHintBar);
    document
      .getElementById('releaseConfirmWhitelist')
      ?.addEventListener('click', () => {
        confirmRelease(true).catch(() => {});
      });
    document
      .getElementById('releaseConfirmOnce')
      ?.addEventListener('click', () => {
        confirmRelease(false).catch(() => {});
      });
    document
      .getElementById('releaseConfirmCancel')
      ?.addEventListener('click', hideReleaseConfirmBar);
    for (const lane of LANES) {
      const ui = els[lane];
      ui.enabled?.addEventListener('change', onEnabledChange);
      ui.regionList?.addEventListener('click', onGeoClick);
      ui.countryList?.addEventListener('click', onGeoClick);
      ui.managedList?.addEventListener('click', onGeoClick);
      ui.regionSearch?.addEventListener('input', onSearchInput);
      ui.countrySearch?.addEventListener('input', onSearchInput);
      ui.managedSearch?.addEventListener('input', onSearchInput);
    }

    try {
      if (globalThis.XCD_SETTINGS) {
        settings = await XCD_SETTINGS.getSettings();
      }
    } catch (_) {
      /* keep defaults */
    }

    paintLaneEnabled('block');
    paintLaneEnabled('mute');
    // Non-blocking progressive fill
    renderAll();

    // SW may re-insert a managed account if unmute/unblock fails
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        const key = globalThis.XCD_SETTINGS?.STORAGE_KEY || 'xcd_settings';
        if (!changes[key]) return;
        (async () => {
          try {
            settings = await XCD_SETTINGS.getSettings();
            applyTallerColumnsClass(settings.tallerColumns === true);
            const tallEl = document.getElementById('optTallerColumns');
            if (tallEl) tallEl.checked = settings.tallerColumns === true;
            const countryEl = document.getElementById('optShowCountryLabels');
            if (countryEl) countryEl.checked = settings.showCountryLabels !== false;
            const geoEl = document.getElementById('optGeoLocalCache');
            if (geoEl) geoEl.checked = settings.geoLocalCache !== false;
            const undoEl = document.getElementById('optUndoOnListClick');
            if (undoEl) undoEl.checked = settings.undoOnListClick === true;
            for (const L of LANES) {
              paintLaneEnabled(L);
              renderManaged(L);
            }
          } catch (_) {
            /* ignore */
          }
        })();
      });
    } catch (_) {
      /* ignore */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
