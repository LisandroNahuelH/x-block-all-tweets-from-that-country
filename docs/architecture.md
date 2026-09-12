# Architecture

A Chromium Manifest V3 extension for x.com. Plain JavaScript, no bundler, no
npm dependencies: `extension/` is the source of truth and `scripts/build.mjs`
syncs it into `dist/` (the load-unpacked target).

## Components

| Path | Role |
|---|---|
| `extension/manifest.json` | MV3 manifest: service worker, content scripts, permissions, store version |
| `extension/background.js` | Service worker: geo cache (IndexedDB), About-account lookups, session badge, message hub |
| `extension/page-script.js` | MAIN-world bridge: captures the logged-in session headers and resolves `AboutAccountQuery` as you |
| `extension/content.js` | Timeline observer: detects usernames, marks posts with flag + country label |
| `extension/content/engine/` | Action engine: `lib.js` helpers, `actions.js` (X menu driving), `toast.js` (in-page feedback), `engine.js` (serial queue) |
| `extension/popup/` | Popup UI: three lane cards, managed lists, settings, Premium status panel |
| `extension/shared/` | `settings.js`, `i18n.js`, `geo-data.js`, `geo-cache-idb.js`, `heartbeat.js`, `badge.js`, `release-metadata.js`, `dev-reload.js` |
| `scripts/` | Build, i18n check/audit/apply/scaffold, agent mirror sync, geo-data extraction |
| `docs/i18n/` | Localization program: glossary, onboarding, locale registry, status |

## Data flow

```
timeline post (x.com)
  └─▶ content.js observes username nodes
        └─▶ location lookup (background.js)
              ├─ IndexedDB cache (xcd_geo_v1)      — local, device-only
              └─ miss: page-script.js calls X's AboutAccountQuery as you, then caches the hit
                    └─▶ match against enabled lanes (block > mute > not interested)
                          └─▶ engine serial queue (concurrency 1)
                                └─▶ actions.js drives X's own menu (caret → menu → item → optional confirm)
                                      └─▶ record in the lane list + toast + badge flash
```

Two independent UI surfaces read the same state:

- **Timeline marks** — each processed username gets an optional flag image
  (Twemoji SVG from X's CDN) and country label; order is flag → name.
- **Popup** — the three lanes, their managed lists, and settings.

## Contracts

### Settings

Persisted in `chrome.storage.local` under `xcd_settings`. Lanes are independent:
`{ block, mute, notinterested }`, each `{ enabled, countries, regions, accounts }`.
Managed account entries: `{ screenName, name, avatarUrl, ts }`.

Timeline preferences (both default on, opt-out):

| Key | Effect |
|---|---|
| `showCountryLabels` | Text suffix ` · {location}` next to the username |
| `showCountryFlags` | Flag image next to the username |

### Action engine

- Serial queue only (concurrency 1) — one action at a time.
- Priority on match: block > mute > not interested.
- Dedupe via the handled set plus each lane's `accounts` list; the author is
  never self.
- After a successful action the account is recorded (`RECORD_ACCOUNT`) so the
  managed lists and the session badge stay truthful.

### Geo cache (IndexedDB)

- Database `xcd_geo_v1`; `unlimitedStorage` exists to give this scale.
- Write only complete positive hits (`screenName` + non-empty location). Never
  persist rate-limit failures, empty lookups, or "unknown country" rows.
- Read path: in-memory → IndexedDB → network → write-back only on a hit.
- The cache is local; it is never uploaded anywhere.

### Heartbeat

- Module `extension/shared/heartbeat.js`; product slug
  `x-block-all-tweets-from-that-country`.
- Pseudonymous events: `install` / `update` (on `onInstalled`) and a throttled
  `ping` (~24 h) when the popup opens. Storage keys: `xcd_installId`,
  `xcd_lastHeartbeatAt`.
- Uninstall farewell via `chrome.runtime.setUninstallURL` (no service worker
  fetch on removal). See README for the full payload disclosure.

### i18n surface

- Source of truth: `extension/_locales/en/messages.json`; runtime helper
  `shared/i18n.js` (`t`, `EN_FALLBACK`, `applyDom` for `data-i18n*`).
- Shipping locales: generated one at a time from `scripts/locale-overrides/`
  via `npm run i18n:apply`; the set is `extension/locales.manifest.json`.
- Checks: `i18n:check` (structure/parity), `i18n:audit` (no leftover English
  outside the allowlist; `en_*` variants exempt).
- Not localized by design: geo matching labels (English About-account text),
  handles, menu-match keywords in `engine/actions.js`, brand name.

### Build & release

- `scripts/build.mjs` syncs `extension/` into `dist/` in place (keeps
  `build-stamp.json`) and stamps a new build; unpacked installs auto-reload via
  `shared/dev-reload.js` (a no-op on store builds).
- `npm run verify` = agent mirror check + i18n check + i18n audit + build.
- `versions.json` pins sha256 hashes (LF-normalized bytes) of the installer and
  key build inputs; `npm run versions:check` verifies them.
- The Chrome Web Store listing and the publish pipeline live outside this
  repository. Store ID: `obpgcigehkijhgjdldddiaijimhihpma`.

## Why the design is like this

All detection and filtering happens client-side, in the browser: lookups run
against X's own API from your logged-in page, the geo cache lives in
IndexedDB, and actions are applied by driving X's own menus — the same clicks
a user would make. There is no server component for the product itself; the
only outbound call is the pseudonymous heartbeat described in the README.
