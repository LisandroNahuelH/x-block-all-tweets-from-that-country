# X - Block all tweets from that country or region

Chromium MV3 extension (Premium11). Dual **Block** / **Mute** lanes by country & region on x.com.

## Status

- Popup dual-lane UI (Premium11 brand)
- Geo detection via X `AboutAccountQuery` (upstream-inspired)
- Settings + session badge (block red / mute yellow flash)
- **Pending:** apply block/mute on X account via API

## Load

```bash
npm run build
```

1. `chrome://extensions` → Developer mode  
2. **Load unpacked** → `dist/`  
3. Open popup; configure Block / Mute lanes  

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run build` | i18n check + copy `extension/` → `dist/` |
| `npm run i18n:check` | Validate locales |
| `npm run agents:sync` | Mirror AGENTS → CLAUDE + GEMINI |
| `npm run agents:verify` | Assert agent triplet identity |
| `npm run verify` | agents + i18n + build |

## Structure

```
extension/          # source (truth)
dist/               # load unpacked (gitignored)
scripts/            # build, i18n, agents
Backups UI/         # UI snapshots (gitignored)
_upstream/          # optional reference clone (gitignored)
AGENTS.md           # agent contract (mirrored)
```

## Upstream reference

Detection patterns from [xaitax/x-account-location-device](https://github.com/xaitax/x-account-location-device) (MIT, authorized).

```bash
git clone --depth 1 https://github.com/xaitax/x-account-location-device.git _upstream
```

## i18n

Default language: **English**. See `extension/_locales/en/messages.json` and `AGENTS.md`.

## Brand

Premium11 — click brand in popup opens https://www.premium11.com/
