# Translation Program Status

## Source locale

- `en` — frozen surface after phase 0 (premium facts a11y, FALLBACK sync, `en_US` in manifest)

## Readiness

- Status: **IN PROGRESS** (W1 done; craft remaining)
- Last update: 2026-07-27
- Blockers: none

## Queue

| State | Locales |
|-------|---------|
| Completed | `en`, `es`, `es_419` |
| In progress | — |
| Pending waves | W2 `pt_BR` `pt_PT` · W3 `de` `fr` `it` `nl` · W4 `ja` `ko` `zh_CN` `zh_TW` · W5 `ru` `uk` `pl` `tr` · W6 `ar` `he` `fa` · W7 India scripts · W8 SEA · W9 EU rest · W10 `ca` `sw` `am` · W11 `en_GB` `en_AU` `en_US` |

## Variant notes (W1)

- `es` vs `es_419`: tuits/tweets; Ajustes/Configuración; AVISO/ADVERTENCIA; gestionadas/administradas; Atrás/Volver; lista blanca/lista de permitidos; voseo en tips LATAM (activá/podés); rate limits / scrollear / toast en 419; posts vs publicaciones.

## Target registry

55 Chrome Web Store codes — see `chrome-web-store-locales.json` (includes `en_US`).

## Notes

- Do not ship a locale that is still 100% English unless it is an `en_*` variant with documented allowlist.
- Prefer `scripts/locale-overrides/` + `npm run i18n:apply` over hand-editing 55 catalogs.
