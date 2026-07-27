# i18n Glossary — X Block Country/Region

Use this glossary so every locale speaks like the product, not a dictionary.

## Product

| Term (EN) | Meaning in this extension | Localization notes |
|-----------|---------------------------|--------------------|
| Block | Lane that blocks matching X accounts account-wide | Prefer the verb X uses in that UI language |
| Mute | Lane that mutes matching accounts account-wide | Same: match X wording |
| Not interested | Lane that marks posts Not interested (weaker filter) | X product phrase; do not invent a cute synonym |
| Regions | Multi-select of X “About this account” regions | UI label only; matching keys stay English |
| Countries | Multi-select of country locations from X | Same; never translate geo keys used for matching |
| Managed accounts | Accounts this extension already acted on | List under each lane |
| Release | Remove from managed list (and optionally undo on X) | Not “free” / not software release |
| Whitelist | Never re-apply geo filter to that account | Keep short; technical but clear |
| Undo on list click | Click managed row → unmute/unblock via ⋯ menu | Settings toggle; default off |
| Local country cache | On-device IndexedDB of successful location hits | Emphasize local-only; no upload |
| About this account | X feature that exposes country/region | Use X’s localized name when stable |
| Country filter | Reason line / product focus | Toast + eyebrow sense |
| Action notifications | In-page toasts when auto block/mute/NI runs | Settings toggle |
| Premium Activated | Lifetime gift chip | Do not translate brand “Premium11” |
| Lifetime | License term | Natural equivalent |
| Developer gift | Badge on Premium panel | Warm, not hype |
| WARNING: | Prefix before mode impact copy | Serious, visible |

## Never translate

- Brand: `Premium11`
- Price token: `USD 29.99` (keep this form)
- Canonical country/region **matching** strings from X (English)
- `@screenName`, display names, URLs
- Product may keep long extension title partially English if allowlisted; default is to localize UI meaning

## Tone

- Short, product-technical, second person natural for the locale (tú / usted / você / tu).
- No marketing fluff, no “AI assistant” voice.
- Settings notes (1–4): instructional, calm, accurate about rate limits and privacy.
