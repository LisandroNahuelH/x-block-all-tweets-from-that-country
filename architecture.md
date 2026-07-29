# Architecture

## Extension layout

Chromium MV3 extension under `extension/`. Build copies to `dist/` (`npm run build`). Detection reference lives in gitignored `_upstream/` (xaitax/x-account-location-device).

## Settings

Persisted in `chrome.storage.local` key `xcd_settings` (`shared/settings.js`).

Independent geo action lanes: `block`, `mute`, `notinterested`.

UI prefs relevant to timeline marks:

| Key | Default | Semantics |
|-----|---------|-----------|
| `showCountryLabels` | `true` | Opt-out (`!== false`). Text suffix ` · {location}` next to username. |
| `showCountryFlags` | `true` | Opt-out (`!== false`). Country/region flag image next to username. |

## Timeline country mark

`content.js` observes `[data-testid="UserName"]` / `User-Name`, resolves location, then `applyInfo()` builds `.xcd-mark`:

1. If `showCountryFlags`: Twemoji `<img>` from emoji in `XCD_GEO.COUNTRY_FLAGS` or `REGION_DATA` (`https://abs-0.twimg.com/emoji/v2/svg/...`).
2. If `showCountryLabels`: i18n `msg_location_suffix` text.

Either, both, or neither may be enabled. Pref changes via `storage.onChanged` clear marks when both off, otherwise invalidate processed nodes and rescan.

## Popup Settings

`popup.html` settings view: toggle `#optShowCountryLabels`, then `#optShowCountryFlags`, then shared data-availability note.

## Heartbeat (Premium11)

Anonymous install/update/ping diagnostics via `shared/heartbeat.js` (`XCD_HEARTBEAT`). Background SW registers uninstall farewell URL and sends install/update; popup init triggers throttled ping. Payload `{ v:1, product:'x-block-all-tweets-from-that-country', event, extVersion, installId, locale, … }` to `https://www.premium11.com/api/heartbeat`. Local keys `xcd_installId` / `xcd_lastHeartbeatAt`. Admin: `https://www.premium11.com/admin/x-block-all-tweets-from-that-country`.

## Chrome Web Store

- Extension ID: `obpgcigehkijhgjdldddiaijimhihpma`
- Registry entry: `0. Chrome Web Store Publish/extensions.json` (mirrored under `~\.grok\chrome-webstore\`)
- Publish CLI: `node cws-cli.mjs release --name "X - Block" --zip <release-zip>`

## i18n surface

- **SoT:** `extension/_locales/en/messages.json` (~92 keys: manifest, popup lanes/settings/premium/bars, timeline suffix, in-page toasts).
- **Runtime:** `shared/i18n.js` (`t`, `EN_FALLBACK`, `applyDom` for `data-i18n*`).
- **Shipping locales:** `extension/_locales/<code>/` generated from overrides (`scripts/locale-overrides/` + `npm run i18n:apply`).
- **Checks:** `i18n:check` (structure/parity), `i18n:audit` (no English leftovers except allowlist / `en_*`).
- **Docs:** `docs/i18n/` (glossary, onboarding, 55-code registry, program status).
- **Not localized:** geo matching labels (English AboutAccount), handles, menu-match keywords in `actions.js`, brand Premium11, `USD 29.99`.

## Popup lane columns

Three `.lane` cards (block / mute / notinterested). Managed-account lists use `.geo-list--accounts` with a locked height (`height`/`min-height`/`max-height` = 148px; 320px under `html.xcd-taller-columns`) so empty and full lanes keep the same managed-section size; overflow scrolls inside the list.
