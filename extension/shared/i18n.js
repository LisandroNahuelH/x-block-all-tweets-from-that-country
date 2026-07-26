/**
 * Fail-safe i18n for Chromium extensions.
 * Source of truth: _locales/en/messages.json (default_locale).
 * Chrome falls back missing keys in other locales to default_locale automatically.
 */
(function (global) {
  'use strict';

  /** Emergency EN map if chrome.i18n is missing or a key typos. Keep in sync with _locales/en. */
  const EN_FALLBACK = {
    ext_name: 'X - Block all tweets from that country or region',
    ext_description:
      'Detect the country or region of X accounts on your timeline (About this account).',
    msg_location_suffix: ' · $1',
    pop_eyebrow: 'Country filter',
    pop_heading: 'X - Block all tweets from that country or region',
    pop_lane_block: 'Block',
    pop_lane_mute: 'Mute',
    pop_lane_notinterested: 'Not interested',
    a11y_toggle_lane_block: 'Enable or disable Block lane',
    a11y_toggle_lane_mute: 'Enable or disable Mute lane',
    a11y_toggle_lane_notinterested: 'Enable or disable Not interested lane',
    pop_mode_warning_label: 'WARNING:',
    pop_mode_hint_block:
      'Selected accounts are blocked on your X account. Their posts will no longer appear in any of your X apps: desktop, Android, iOS, or web.',
    pop_mode_hint_mute:
      'Selected accounts are muted on your X account. Their posts will no longer appear in any of your X apps: desktop, Android, iOS, or web.',
    pop_mode_hint_notinterested:
      'Posts from selected accounts are marked Not interested on your X account, so X will show you fewer of them across desktop, Android, iOS, and web.',
    pop_regions_label: 'Regions',
    pop_countries_label: 'Countries',
    pop_selected_count: '$1 selected',
    a11y_toggle_region: 'Toggle region',
    a11y_toggle_country: 'Toggle country',
    pop_search_regions: 'Search regions…',
    pop_search_countries: 'Search countries…',
    pop_search_no_results: 'No matches',
    pop_blocked_accounts_label: 'Blocked accounts',
    pop_muted_accounts_label: 'Muted accounts',
    pop_notinterested_accounts_label: 'Not interested accounts',
    pop_search_accounts: 'Search accounts…',
    pop_managed_empty: 'No managed accounts yet',
    pop_managed_mode_block: 'Block',
    pop_managed_mode_mute: 'Mute',
    pop_managed_mode_notinterested: 'Not interested',
    a11y_release_account: 'Release managed account',
    a11y_open_premium11: 'Open Premium11 website',
    pop_premium_chip: 'Premium Activated',
    pop_premium_chip_title: 'View your activated Premium access.',
    pop_premium_back: 'Back',
    pop_premium_eyebrow: 'Premium',
    pop_premium_title: 'Lifetime Premium activated',
    pop_premium_subtitle:
      'Enjoy the complete Premium suite inside X - Block all tweets from that country or region by Premium11.',
    pop_premium_status_title: 'Your Premium subscription',
    pop_premium_status_active: 'Lifetime Premium active',
    pop_premium_gift_badge: 'Developer gift',
    pop_premium_gift_message:
      'The extension developer has gifted you a lifetime Premium subscription (USD 29.99). Thank you for being a loyal user of X - Block all tweets from that country or region by Premium11.',
    pop_premium_fact_version: 'Extension version',
    pop_premium_fact_updated: 'Last updated',
    pop_premium_fact_license: 'Premium license validity',
    pop_premium_fact_license_value: 'Lifetime',
    pop_premium_fact_features: 'Features enabled',
    pop_premium_fact_features_value: 'All',
    pop_settings_title: 'Settings',
    pop_settings_btn_title: 'Open settings',
    pop_opt_show_country_labels:
      'Show account country next to the username on feed, explore, and profiles',
    pop_opt_show_country_note:
      'Note: This extension only works when X.com reports country or region data for an account (About this account). X often does not expose that information, so even with this option enabled the country or region may not appear next to the username. These limits come from X.com, not from this extension.',
    a11y_toggle_show_country: 'Toggle country labels on the timeline',
    pop_opt_taller_columns: 'Taller columns',
    pop_opt_taller_columns_note:
      'Makes the region, country, and managed-account lists about two to three times taller, and lets the whole popup scroll so the layout feels less cramped. Off by default.',
    a11y_toggle_taller_columns: 'Toggle taller columns layout',
    pop_opt_geo_local_cache: 'Local country cache',
    pop_opt_geo_local_cache_what:
      '1. What it does: After a successful “About this account” lookup, saves that account’s country or region on this device so the extension can reuse it later without asking X again.',
    pop_opt_geo_local_cache_benefits:
      '2. Benefits when on: Fewer network calls, lower chance of rate limits, and faster country labels plus auto mute/block decisions for accounts you have already seen.',
    pop_opt_geo_local_cache_off:
      '3. If you turn it off: Every lookup hits X again — more rate-limit risk, slower labels, and higher data use while scrolling. Existing cache is kept on disk but unused until you turn this back on.',
    pop_opt_geo_local_cache_size:
      '4. Storage: Very light — about 100,000 users ≈ 10 MB, roughly the size of one modern MP3 on your PC. Only successful country/region hits are stored.',
    a11y_toggle_geo_local_cache: 'Toggle local country cache',
    pop_opt_geo_cache_accounts: 'Cached accounts',
    pop_opt_geo_cache_storage: 'Storage used (approx.)',
    pop_opt_undo_on_list_click: 'Undo on list click',
    pop_opt_undo_on_list_click_what:
      '1. What it does: When on, clicking a managed account removes it from the list and undoes the action on X (unmute or unblock). When off, list clicks do not release accounts — they only show a tip to enable this option.',
    pop_opt_undo_on_list_click_how:
      '2. How it works: Opens a short-lived background tab to that profile, runs the same ⋯ menu flow used for mute/block, then closes the tab. Not interested entries are list-only on X (no reliable undo).',
    pop_opt_undo_on_list_click_benefits:
      '3. Benefits when on: One click both cleans the list and reverses mute/block on your X account.',
    pop_opt_undo_on_list_click_note:
      '4. Note: A background profile tab will open briefly so the extension can unmute/unblock. Off by default so accidental clicks cannot open tabs or reverse actions without you meaning to.',
    a11y_toggle_undo_on_list_click: 'Toggle undo on managed list click',
    pop_toast_undo_on_list_off:
      'To automatically unmute, unblock, or clear Not interested when you click a managed account, turn on Undo on list click. You can enable it now or later in Settings.',
    pop_toast_undo_on_list_cta: 'Enable now',
    pop_toast_undo_on_list_dismiss: 'Dismiss',
    a11y_managed_account_locked:
      'Managed account (enable Undo on list click to release)',
    pop_toast_release_confirm:
      'Release this account on X? If they still match an active country/region filter, the extension may act again unless you whitelist them.',
    pop_toast_release_whitelist: 'Release + whitelist (never re-filter)',
    pop_toast_release_once: 'Just this once',
    pop_toast_release_cancel: 'Cancel',
    toast_blocked: 'Blocked',
    toast_muted: 'Muted',
    toast_notinterested: 'Not interested'
  };

  const isDev =
    typeof chrome !== 'undefined' &&
    chrome.runtime &&
    typeof chrome.runtime.getManifest === 'function' &&
    !('update_url' in (chrome.runtime.getManifest() || {}));

  function substitute(template, substitutions) {
    if (template == null) return '';
    let out = String(template);
    const list = Array.isArray(substitutions)
      ? substitutions
      : substitutions == null
        ? []
        : [substitutions];
    for (let i = 0; i < list.length; i++) {
      const val = list[i] == null ? '' : String(list[i]);
      out = out.replace(new RegExp('\\$' + (i + 1), 'g'), val);
      out = out.replace(new RegExp('\\$' + (i + 1) + '\\$', 'g'), val);
    }
    out = out.replace(/\$[A-Z_]+\$/g, '');
    return out;
  }

  /**
   * @param {string} key
   * @param {string|string[]|undefined} substitutions
   * @returns {string} never null/undefined
   */
  function t(key, substitutions) {
    if (!key || typeof key !== 'string') return '';

    let msg = '';
    try {
      if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
        const subs = Array.isArray(substitutions)
          ? substitutions.map(s => (s == null ? '' : String(s)))
          : substitutions == null
            ? undefined
            : [String(substitutions)];
        msg = subs ? chrome.i18n.getMessage(key, subs) : chrome.i18n.getMessage(key);
      }
    } catch (_) {
      msg = '';
    }

    if (msg) return msg;

    const fb = EN_FALLBACK[key];
    if (fb) return substitute(fb, substitutions);

    if (isDev) return '⟦' + key + '⟧';
    return '';
  }

  const ATTR_MAP = {
    'data-i18n': 'text',
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-title': 'title',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-value': 'value'
  };

  /**
   * Apply data-i18n* attributes under root (for popup/options HTML).
   * @param {ParentNode} [root=document]
   */
  function applyDom(root) {
    const scope = root || (typeof document !== 'undefined' ? document : null);
    if (!scope || !scope.querySelectorAll) return;

    for (const [attr, target] of Object.entries(ATTR_MAP)) {
      const nodes = scope.querySelectorAll('[' + attr + ']');
      for (const el of nodes) {
        const key = el.getAttribute(attr);
        if (!key) continue;
        const text = t(key);
        if (target === 'text') {
          el.textContent = text;
        } else {
          el.setAttribute(target, text);
        }
      }
    }
  }

  const api = { t, applyDom, EN_FALLBACK };
  global.XCD_I18N = api;
  if (typeof self !== 'undefined') self.XCD_I18N = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
