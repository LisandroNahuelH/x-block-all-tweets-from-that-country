# Translation Program Status

## Source locale

- `en` — frozen surface (premium facts a11y, FALLBACK sync, `en_US` in manifest)

## Readiness

- Status: **READY** (all 55 CWS locales shipping)
- Last update: 2026-07-27
- Blockers: none
- Verify: `npm run i18n:check` + `npm run i18n:audit` + `npm run build` OK

## Queue

| State | Locales |
|-------|---------|
| Completed | All 55: `am` `ar` `bg` `bn` `ca` `cs` `da` `de` `el` `en` `en_AU` `en_GB` `en_US` `es` `es_419` `et` `fa` `fi` `fil` `fr` `gu` `he` `hi` `hr` `hu` `id` `it` `ja` `kn` `ko` `lt` `lv` `ml` `mr` `ms` `nl` `no` `pl` `pt_BR` `pt_PT` `ro` `ru` `sk` `sl` `sr` `sv` `sw` `ta` `te` `th` `tr` `uk` `vi` `zh_CN` `zh_TW` |
| In progress | — |
| Pending | — |

## Waves (done)

| Wave | Locales |
|------|---------|
| W0 | Tooling + EN freeze |
| W1 | `es` `es_419` |
| W2 | `pt_BR` `pt_PT` |
| W3 | `de` `fr` `it` `nl` |
| W4 | `ja` `ko` `zh_CN` `zh_TW` |
| W5 | `ru` `uk` `pl` `tr` |
| W6 | `ar` `he` `fa` |
| W7 | India scripts (`hi` `bn` `ta` `te` `mr` `gu` `kn` `ml`) |
| W8 | SEA (`th` `vi` `id` `ms` `fil`) |
| W9 | EU rest (`sv` `da` `no` `fi` `cs` `sk` `hu` `ro` `bg` `hr` `sr` `sl` `el` `et` `lv` `lt`) |
| W10 | `ca` `sw` `am` |
| W11 | `en_GB` `en_AU` `en_US` |

## Variant notes

- `es`/`es_419`: tuits/tweets; Ajustes/Configuración; voseo LATAM.
- `pt_BR`/`pt_PT`: você/tu; Configurações/Definições; postagens/publicações.
- `zh_CN`/`zh_TW`: 简/繁; 屏蔽/封鎖; 隐藏/靜音.
- `en_GB`/`en_AU`: light licence + whilst; `en_US` ≈ `en`.
- Allowlist: `msg_location_suffix`, `pop_premium_eyebrow`.
