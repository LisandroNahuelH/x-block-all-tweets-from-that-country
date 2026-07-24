/**
 * Release metadata shown in the Premium status submenu (Volume Booster pattern).
 * Update on every Chrome Web Store package/release — see AGENTS.md.
 */
(function (global) {
  'use strict';

  /** ISO date (YYYY-MM-DD) of the latest published release. */
  const EXTENSION_LAST_UPDATE_ISO = '2026-07-24';

  /** Fallback when chrome.runtime.getManifest() is unavailable. Keep in sync with manifest/package.json. */
  const EXTENSION_RELEASE_VERSION = '0.1.6';

  const api = {
    EXTENSION_LAST_UPDATE_ISO,
    EXTENSION_RELEASE_VERSION
  };

  global.XCD_RELEASE = api;
  if (typeof self !== 'undefined') self.XCD_RELEASE = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
