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

## Popup lane columns

Three `.lane` cards (block / mute / notinterested). Managed-account lists use `.geo-list--accounts` with a locked height (`height`/`min-height`/`max-height` = 148px; 320px under `html.xcd-taller-columns`) so empty and full lanes keep the same managed-section size; overflow scrolls inside the list.
