/**
 * Bottom toast on X after geo block / mute / not interested.
 * Single replaceable toast; 6s CSS countdown bar.
 */
(function (global) {
  'use strict';

  const STYLE_ID = 'xcd-action-toast-style-v2';
  const HOST_ID = 'xcd-action-toast';
  const DURATION_MS = 6000;

  const LANE_COLOR = {
    block: '#E53935',
    mute: '#F9A825',
    notinterested: '#42A5F5'
  };

  const LANE_I18N = {
    block: 'toast_blocked',
    mute: 'toast_muted',
    notinterested: 'toast_notinterested'
  };

  let hideTimer = 0;
  let gen = 0;

  function t(key, substitutions) {
    try {
      if (global.XCD_I18N && typeof global.XCD_I18N.t === 'function') {
        return global.XCD_I18N.t(key, substitutions) || key;
      }
    } catch (_) {
      /* ignore */
    }
    return key;
  }

  function formatFilterLabel(key) {
    const k = String(key || '').trim().toLowerCase();
    if (!k) return '';
    const geo = global.XCD_GEO;
    if (geo && Array.isArray(geo.REGION_DATA)) {
      const region = geo.REGION_DATA.find(r => r && r.key === k);
      if (region && region.name) return region.name;
    }
    if (geo && typeof geo.titleCase === 'function') return geo.titleCase(k);
    return k;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + HOST_ID + '{',
      'position:fixed;right:20px;bottom:24px;left:auto;',
      'z-index:2147483000;width:min(360px,calc(100vw - 40px));',
      'opacity:0;pointer-events:none;',
      'transform:translate3d(18px,16px,0) scale(0.98);',
      'font-family:"Segoe UI Variable","Segoe UI","Trebuchet MS",system-ui,sans-serif;',
      'transition:opacity 320ms cubic-bezier(0.22,1,0.36,1),transform 320ms cubic-bezier(0.22,1,0.36,1);',
      '}',
      '#' + HOST_ID + '.is-visible{',
      'opacity:1;pointer-events:auto;',
      'transform:translate3d(0,0,0) scale(1);',
      '}',
      '#' + HOST_ID + ' .xcd-toast__panel{',
      'position:relative;overflow:hidden;border-radius:16px;',
      'border:1px solid rgba(255,255,255,0.1);',
      'background:radial-gradient(circle at 20% 0%,rgba(255,151,82,0.14),transparent 42%),',
      'linear-gradient(180deg,rgba(18,34,48,0.98),rgba(8,18,28,0.98));',
      'box-shadow:0 16px 40px rgba(0,0,0,0.4),0 0 24px color-mix(in srgb,var(--xcd-toast-accent,#E53935) 22%,transparent),',
      'inset 0 1px 0 rgba(255,255,255,0.06);',
      '}',
      '#' + HOST_ID + ' .xcd-toast__body{',
      'display:grid;grid-template-columns:48px 1fr;gap:12px;align-items:center;',
      'padding:14px 16px 16px;',
      '}',
      '#' + HOST_ID + ' .xcd-toast__avatar{',
      'width:48px;height:48px;border-radius:50%;overflow:hidden;',
      'display:grid;place-items:center;',
      'background:rgba(255,255,255,0.08);color:#f4f7fb;font-weight:700;font-size:1.1rem;',
      'border:2px solid var(--xcd-toast-accent,#E53935);',
      '}',
      '#' + HOST_ID + ' .xcd-toast__avatar img{width:100%;height:100%;object-fit:cover;display:block;}',
      '#' + HOST_ID + ' .xcd-toast__meta{min-width:0;display:grid;gap:2px;}',
      '#' + HOST_ID + ' .xcd-toast__action{',
      'margin:0;font-size:0.68rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;',
      'color:var(--xcd-toast-accent,#E53935);',
      '}',
      '#' + HOST_ID + ' .xcd-toast__name{',
      'margin:0;color:#f4f7fb;font-size:0.95rem;font-weight:700;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      '}',
      '#' + HOST_ID + ' .xcd-toast__handle{',
      'margin:0;color:rgba(196,210,224,0.85);font-size:0.8rem;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      '}',
      '#' + HOST_ID + ' .xcd-toast__reason{',
      'margin:2px 0 0;color:rgba(196,210,224,0.72);font-size:0.72rem;font-weight:500;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;',
      '}',
      '#' + HOST_ID + ' .xcd-toast__bar{',
      'display:block;height:3px;width:100%;transform-origin:left center;',
      'background:var(--xcd-toast-accent,#E53935);transform:scaleX(1);',
      '}',
      '#' + HOST_ID + ' .xcd-toast__bar.is-running{',
      'transition:transform ' + DURATION_MS + 'ms linear;transform:scaleX(0);',
      '}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }

  function ensureHost() {
    ensureStyle();
    let host = document.getElementById(HOST_ID);
    if (host) {
      const meta = host.querySelector('.xcd-toast__meta');
      if (meta && !host.querySelector('.xcd-toast__reason')) {
        const reason = document.createElement('p');
        reason.className = 'xcd-toast__reason';
        meta.appendChild(reason);
      }
      return host;
    }
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.innerHTML =
      '<div class="xcd-toast__panel">' +
      '<div class="xcd-toast__body">' +
      '<div class="xcd-toast__avatar" aria-hidden="true"></div>' +
      '<div class="xcd-toast__meta">' +
      '<p class="xcd-toast__action"></p>' +
      '<p class="xcd-toast__name"></p>' +
      '<p class="xcd-toast__handle"></p>' +
      '<p class="xcd-toast__reason"></p>' +
      '</div></div>' +
      '<div class="xcd-toast__bar" aria-hidden="true"></div>' +
      '</div>';
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  function setAvatar(slot, name, screenName, avatarUrl) {
    slot.textContent = '';
    slot.classList.remove('xcd-toast__avatar--fallback');
    const initial = String(name || screenName || '?').charAt(0).toUpperCase() || '?';
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.addEventListener('error', () => {
        slot.textContent = initial;
        slot.classList.add('xcd-toast__avatar--fallback');
      });
      slot.appendChild(img);
      return;
    }
    slot.textContent = initial;
    slot.classList.add('xcd-toast__avatar--fallback');
  }

  function hide() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;
    host.classList.remove('is-visible');
    const bar = host.querySelector('.xcd-toast__bar');
    if (bar) {
      bar.classList.remove('is-running');
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(1)';
    }
  }

  function show({ lane, name, screenName, avatarUrl, filterKey, filterKind } = {}) {
    const host = ensureHost();
    const accent = LANE_COLOR[lane] || LANE_COLOR.block;
    const actionKey = LANE_I18N[lane] || LANE_I18N.block;
    const displayName = String(name || screenName || '').trim() || String(screenName || '');
    const handle = String(screenName || '').replace(/^@/, '');
    const label = formatFilterLabel(filterKey);
    const reasonKey =
      filterKind === 'region' ? 'toast_reason_region' : 'toast_reason_country';
    const reasonEl = host.querySelector('.xcd-toast__reason');

    host.style.setProperty('--xcd-toast-accent', accent);
    host.querySelector('.xcd-toast__action').textContent = t(actionKey);
    host.querySelector('.xcd-toast__name').textContent = displayName;
    host.querySelector('.xcd-toast__handle').textContent = handle ? '@' + handle : '';
    if (reasonEl) {
      reasonEl.textContent = label ? t(reasonKey, [label]) : '';
      reasonEl.hidden = !label;
    }
    setAvatar(host.querySelector('.xcd-toast__avatar'), displayName, handle, avatarUrl || '');

    const bar = host.querySelector('.xcd-toast__bar');
    bar.classList.remove('is-running');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(1)';

    // Force reflow so the 6s transition restarts on replace
    void bar.offsetWidth;

    host.classList.add('is-visible');
    requestAnimationFrame(() => {
      bar.style.transition = '';
      bar.classList.add('is-running');
    });

    gen += 1;
    const myGen = gen;
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (myGen !== gen) return;
      hide();
    }, DURATION_MS);
  }

  global.XCD_TOAST = { show, hide };
})(typeof globalThis !== 'undefined' ? globalThis : self);
