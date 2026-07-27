# Translation Program Status

## Source locale

- `en` — frozen surface after phase 0 (premium facts a11y, FALLBACK sync, `en_US` in manifest)

## Readiness

- Status: **IN PROGRESS** (W1–W5 done)
- Last update: 2026-07-27
- Blockers: none

## Queue

| State | Locales |
|-------|---------|
| Completed | `en`, `es`, `es_419`, `pt_BR`, `pt_PT`, `de`, `fr`, `it`, `nl`, `ja`, `ko`, `zh_CN`, `zh_TW`, `ru`, `uk`, `pl`, `tr` (**17** shipping) |
| In progress | — |
| Pending waves | W6 `ar` `he` `fa` · W7 India · W8 SEA · W9 EU rest · W10 `ca` `sw` `am` · W11 `en_GB` `en_AU` `en_US` |

## Variant notes

- W1 `es`/`es_419`: tuits/tweets; Ajustes/Configuración; AVISO/ADVERTENCIA; gestionadas/administradas; voseo LATAM.
- W2 `pt_BR`/`pt_PT`: você vs tu; Configurações/Definições; postagens/publicações; gerenciadas/geridas; Buscar/Pesquisar.
- W4 `zh_CN`/`zh_TW`: 简/繁; 屏蔽/封鎖; 隐藏/靜音; 设置/設定; 缓存/快取.

## Target registry

55 Chrome Web Store codes — see `chrome-web-store-locales.json` (includes `en_US`).

## Notes

- Do not ship a locale that is still 100% English unless it is an `en_*` variant with documented allowlist.
- Prefer `scripts/locale-overrides/` + `npm run i18n:apply` over hand-editing 55 catalogs.
