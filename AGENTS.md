# AGENTS.md

## Scope, Priority, and Portability

This file is the canonical agent operating contract for this repository.

1. Universal rules first; project-specific contracts last.
2. On conflict: **project-specific** wins over universal; both override casual chat.
3. Repo-root mirrors `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` must stay **byte-identical**.

## Triple Mirror Contract

`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` are mandatory repo-root mirror files.

1. Keep all three present at the repository root at all times.
2. Whenever any one is modified, immediately replicate to the other two before ending the task.
3. If one is missing, recreate it from the current canonical content.
4. Use `npm run agents:sync` / `npm run agents:verify` to enforce identity.

## 👤 Language and style (project + user global)

1. Always respond to the user in **Spanish**.
2. **`/breve` always on:** extreme brevity; core only; no filler.
3. **`/ponytail-ultra` always on:** YAGNI, minimal diff, reuse existing code, no unsolicited abstractions.
4. Prefer complete sentences only when clarity requires it; otherwise short and precise.

## 💾 Backups

1. **Always before starting work:** copy every file you will edit into `Backups UI/ui-YYYY-MM-DD/` (create folder if missing; clear names, e.g. `content-engine-toast.js`). No edits until the backup exists.
2. **UI backups:** before non-trivial UI edits to `extension/popup/*` (or brand CSS/HTML), same folder as above. Keep working tree clean of loose backups.
3. **`.txt` code (global rule):** if editing code that lives in a `.txt` file, backup first into `Backups .txt/` beside that file.
4. Do not commit large dump folders of secrets; `Backups UI/` is gitignored like peer Premium11 repos.

## 🛠️ Technical rules

1. UTF-8 for all tracked text files.
2. Source of truth for the loadable extension is `extension/`. Ship via `npm run build` → `dist/` (gitignored).
3. **Do not** invent build tools unless asked; keep zero-bundler layout unless product requires it.
4. Premium11 identity: tokens/fonts/brand from peer extensions (Volume Booster / Super Tab Suspender / Delete All My Tweets). Do not invent a new design system.
5. Detection tech origin: `_upstream` = [xaitax/x-account-location-device](https://github.com/xaitax/x-account-location-device) (MIT, authorized). Prefer extracting only needed pieces.

### i18n contract

1. Default locale: **English** (`extension/_locales/en/messages.json`).
2. User-facing strings via `chrome.i18n` / `XCD_I18N.t` / `data-i18n*`. No hard-coded UI copy.
3. New keys: add to `en` first (with `description`), update `shared/i18n.js` `EN_FALLBACK`, run `npm run i18n:check`.
4. In `EN_FALLBACK` string literals: never use doubled `''` for apostrophes (breaks SW `importScripts`). Prefer double-quoted strings or `\'` / typographic `’`.
5. Country/region names from X stay **English canonical** for matching; do not i18n those keys for block logic.
6. Locale codes: only those in `extension/locales.manifest.json` (**55** CWS codes including `en_US`). See `docs/i18n/`.
7. **Multi-locale program:** translate one locale (or variant pair) at a time via `scripts/locale-overrides/<code>.json` → `npm run i18n:apply` → `i18n:check` + `i18n:audit`. No machine-batch dumps. Product glossary: `docs/i18n/glossary.md`. Status: `docs/i18n/translation-program-status.md`.
8. Deliberate English leftovers only via `scripts/i18n-identical-allowlist.json`. Variants `en_AU`/`en_GB`/`en_US` skipped by identical audit.
9. Real variant pairs (not clones): `es`≠`es_419`, `pt_BR`≠`pt_PT`, `zh_CN`≠`zh_TW`.

### Settings / lanes contract

1. Block, Mute, and **Not interested** are **independent** lanes:  
   `{ block, mute, notinterested }` each with `{ enabled, countries, regions, accounts }`.
2. Account entries: `{ screenName, name, avatarUrl, ts }`.
3. Toolbar badge: session counter + red (block) / yellow (mute) / blue (notinterested) flash via `shared/badge.js` + SW.
4. Opening external URLs (Premium11 home): message SW `OPEN_URL` then `window.close()` — never hang the popup.
5. Timeline country UI prefs (independent): `showCountryLabels` and `showCountryFlags` (both default ON, opt-out). Both can be on/off in any combo. When both on, `.xcd-mark` order is **flag → name** (Twemoji SVG from `abs-0.twimg.com` via `XCD_GEO.COUNTRY_FLAGS` / `REGION_DATA`).
6. Popup managed-account lists (`.geo-list--accounts`) use a **fixed height** (148px; 320px with taller-columns) so the three lanes stay vertically aligned even when one lane has many accounts and others are empty.

### Build and verify

Before considering a task done when code changed:

```bash
npm run i18n:check
npm run build
```

Load unpacked from **`dist/`**. Unpacked builds auto-reload via `build-stamp.json` + `shared/dev-reload.js` (no-op on CWS). Refresh open x.com tabs if content scripts look stale.

### Chrome Web Store release (when packaging)

Follow global extension release rule: bump minimum version in all truth sources, `build` + release zip, commit, leave store-ready artifact. Prefer skill `empaquetar-para-release-chrome-store` when applicable.

### Release packaging — Premium status submenu (mandatory, Volume Booster pattern)

On **every** rebuild / package for Chrome Web Store release, **always** refresh the Premium vitalicio submenu metadata so the popup shows the correct release facts:

1. Bump version in **all** sources of truth:
   - `package.json`
   - `extension/manifest.json`
   - `extension/shared/release-metadata.js` → `EXTENSION_RELEASE_VERSION`
2. Set `EXTENSION_LAST_UPDATE_ISO` in `extension/shared/release-metadata.js` to the release day (`YYYY-MM-DD`). This drives **Last updated** in the Premium panel.
3. Confirm Premium gift copy still matches this product and price: **USD 29.99** (`pop_premium_gift_message` and EN_FALLBACK).
4. Confirm chip label remains **Premium Activated** (i18n keys `pop_premium_*`).
5. Run `npm run agents:sync` if AGENTS changed; run `npm run verify` (or at least `i18n:check` + `build`).
6. Empaquetar release; leave store-ready zip. Do not ship with stale version/date in the Premium submenu.

Source of truth for the submenu dates/version: `extension/shared/release-metadata.js` (same role as Volume Booster’s `extension-release-metadata.ts`).

## 🌿 Git workflow

1. Prefer small, conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.
2. **Always at task end (mandatory):** land the completed unit as **atomic commits** (one logical change per commit; no mixed unrelated WIP). Do not leave finished toast/feature/docs work uncommitted.
3. Do not force-push unless explicitly requested.
4. Do not commit `dist/`, `node_modules/`, secrets, or personal dumps.
5. `_upstream/` is reference only (gitignored); re-clone if needed:
   `git clone --depth 1 https://github.com/xaitax/x-account-location-device.git _upstream`

## 🔁 Mandatory task loop

On **every** non-trivial coding task:

1. **Start:** backup files to touch → then edit.
2. **End:** atomic commit(s) for the finished unit → `npm run i18n:check` + `npm run build` (or `npm run verify` if agents mirrors changed).

Skip only for pure Q&A / read-only exploration with no file changes.

## 💬 Communication

1. Spanish, brief, decision-first.
2. State risks and assumptions explicitly when relevant.
3. Never hide uncertainty.

## ✅ Task completion checklist

1. Backup done before edits (always).
2. Code + i18n updated.
3. `npm run i18n:check` and `npm run build` pass.
4. Mirrors `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` still identical.
5. Atomic git commit(s) for the finished unit (always when files changed).

## Project-specific product notes

| Item | Value |
|------|--------|
| Product name | `X - Block All Tweets From That Country Or Region` |
| Brand | Premium11 (`extension/brand/premium11-mark.svg`) |
| Homepage | `https://www.premium11.com/` |
| Target | Chromium MV3, x.com / twitter.com |
| Chrome Web Store ID | `obpgcigehkijhgjdldddiaijimhihpma` |
| CWS registry | `D:\OfiSync\0. Lisandro\0. Programacion\0. Chrome Web Store Publish\extensions.json` (name match / `--extension-id`) |
| Current stage | Popup 3 lanes + geo detection + **auto engine on X** (menu ⋯ port of I Don't Care) |

### Heartbeat (anonymous diagnostics)

1. Product slug: `x-block-all-tweets-from-that-country` — module `extension/shared/heartbeat.js` (`self.XCD_HEARTBEAT`).
2. `POST https://www.premium11.com/api/heartbeat` with header `X-Heartbeat-Key` (fire-and-forget; no tracks/handles in payload).
3. Events: `install` / `update` on SW `onInstalled`; `ping` when popup opens (`HEARTBEAT_PING` message), throttled ~24h via `xcd_lastHeartbeatAt`.
4. Storage keys: `xcd_installId` (UUID), `xcd_lastHeartbeatAt`.
5. Uninstall: `chrome.runtime.setUninstallURL` → `https://www.premium11.com/goodbye/x-block-all-tweets-from-that-country?id=<installId>&v=<extVersion>` (no SW fetch on remove).
6. Manifest `host_permissions`: `https://www.premium11.com/*`, `https://premium11.com/*`.
7. Admin dashboard: `https://www.premium11.com/admin/x-block-all-tweets-from-that-country`.

### Content engine contract

1. Action execution must follow IDC menu flow: caret → Dropdown/menu → keyword item → optional block confirm (`content/engine/actions.js`).
2. Geo matching: enabled lane countries/regions vs `AboutAccount` location string (lowercase). Priority: block > mute > notinterested.
3. Dedupe via `handled` + `settings[lane].accounts`; skip self.
4. Always `RECORD_ACCOUNT` after successful action for Managed lists + badge.
5. Serial queue only (concurrency 1).

### Geo location cache (IndexedDB, CWS-safe)

1. Store: `shared/geo-cache-idb.js` DB `xcd_geo_v1` — durable on device only; never upload.
2. **Write only complete positive hits:** `screenName` + non-empty `location` (+ optional display `name`). Never persist rate-limit failures, empty AboutAccount, or “unknown country” rows.
3. Read path: content mem → `GEO_CACHE_GET` → network → `GEO_CACHE_PUT` only if location present.
4. Settings stay in `chrome.storage.local`; bulk geo cache is **not** dumped there (legacy key migrated once then removed).
5. Permission `unlimitedStorage` is for this local cache scale (~100k entries).
6. Privacy policy must mention: local cache of public X about-account country/region for filtering; not sold/sent to third parties.
