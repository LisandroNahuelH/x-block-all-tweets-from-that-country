# Adding a locale (slow, product-quality)

## 1. Confirm the code

Must exist in `extension/locales.manifest.json` and `docs/i18n/chrome-web-store-locales.json` (55 CWS codes).

## 2. Write overrides only

Create `scripts/locale-overrides/<locale>.json`:

```json
{
  "ext_name": "…",
  "pop_lane_block": "…"
}
```

- Keys = English catalog keys.
- Values = translated `message` strings only.
- Keep `$COUNT$`, `$COUNTRY$`, `$FILTER$` (or `$1` only if you mirror EN_FALLBACK style — prefer named `$NAME$` as in `en`).
- Read `glossary.md` + each key’s `description` in `en/messages.json`.

## 3. Variant pairs (same session)

| Pair | Must differ in real lexical choices |
|------|-------------------------------------|
| `es` / `es_419` | Spain vs LATAM |
| `pt_BR` / `pt_PT` | você vs tu, vocabulary |
| `zh_CN` / `zh_TW` | Simplified vs Traditional |
| `en_GB` / `en_AU` / `en_US` | Light edits or deliberate identical + allowlist |

## 4. Promote

```powershell
npm run i18n:apply
npm run i18n:check
npm run i18n:audit
```

This writes `extension/_locales/<locale>/messages.json` from `en` + overrides.

## 5. Status + commit

Update `translation-program-status.md`. Atomic commit:

`feat(i18n): <locale> runtime catalog`

## 6. Smoke

Chrome UI language = locale → load `dist/` → popup lanes, settings notes, Premium panel, release bar, timeline toast. RTL (`ar`/`fa`/`he`): check alignment.

## Failure modes

- Missing/extra keys vs `en`
- Placeholder drift
- English left over without allowlist
- Cloned variants (es==es_419)
- Spanglish in Portuguese
- New UI string hardcoded instead of `_locales`
