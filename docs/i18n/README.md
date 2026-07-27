# i18n — X Block All Tweets From That Country Or Region

## Architecture

| Piece | Path |
|-------|------|
| Source of truth | `extension/_locales/en/messages.json` |
| Shipping locales | `extension/_locales/<code>/messages.json` |
| Locale registry | `extension/locales.manifest.json` + `docs/i18n/chrome-web-store-locales.json` |
| Runtime helper | `extension/shared/i18n.js` (`XCD_I18N.t`, `EN_FALLBACK`, `applyDom`) |
| Overrides workspace | `scripts/locale-overrides/<code>.json` |
| Identical allowlist | `scripts/i18n-identical-allowlist.json` |
| Program status | `docs/i18n/translation-program-status.md` |

## Rules

1. Add/rename keys only in `en` (+ sync `EN_FALLBACK`).
2. Non-`en` locales: same keys and placeholders as `en`; translate only `message`.
3. Descriptions stay in `en` only (apply script strips them on promote).
4. No machine-batch of 54 locales. One locale (or variant pair) at a time.
5. If a string must stay English, list it in `i18n-identical-allowlist.json`.
6. Do **not** i18n geo matching keys (countries/regions stay English for AboutAccount match).
7. Runtime UI ≠ long Chrome Web Store listing copy (store pipeline is optional later).

## Commands

```powershell
npm run i18n:check
npm run i18n:audit
npm run i18n:apply
npm run i18n:scaffold -- <locale>
npm run verify
```

## Quality bar

See `glossary.md` and `locale-onboarding.md`. Anti-slop: contextual product copy, real `es`≠`es_419`, `pt_BR`≠`pt_PT`, `zh_CN`≠`zh_TW`.
