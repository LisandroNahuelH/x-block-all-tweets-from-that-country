# Changelog

Product versions of the Chrome Web Store extension. Repository tooling lives in
the git history; this file tracks what shipped, reconstructed from the
repository log. Versions 0.1.9 and 0.1.10 were skipped (0.1.8 → 0.1.11).

## 0.1.13 — 2026-07-29

- Pseudonymous heartbeat: install/update/ping events plus an uninstall farewell
  page (see the README disclosure).
- Heartbeat wiring documented for agents and architecture.

## 0.1.12 — 2026-07-27

- Complete runtime locale catalogs for the full Chrome Web Store catalog, with
  real regional variants (e.g. es ≠ es_419, pt_BR ≠ pt_PT, zh_CN ≠ zh_TW).

## 0.1.11 — 2026-07-27

- In-page action toasts showing the matched country/region, gated by a setting;
  toolbar badge flash; MV3-safe awaits.
- Unpacked auto-reload after every build (build stamp + dev reload).
- Optional country flags and country labels next to usernames (both on by default).
- Equal managed-list heights across the popup lanes.
- i18n override pipeline, translation audit tooling and program docs;
  `EN_FALLBACK` apostrophe fix.

## 0.1.8 — 2026-07-24

- Release confirm bar and a per-lane whitelist to stop re-filtering; dropped a
  dead whitelist stub.

## 0.1.7 — 2026-07-24

- Undo-off blocks list on release, plus a bottom enable bar.

## 0.1.6 — 2026-07-24

- Undo-on-list-click setting (off by default) and optimistic list removal.

## 0.1.5 — 2026-07-24

- Let X close its menus after mute/block; collapse acted posts.

## 0.1.4 — 2026-07-24

- Faster menu actions with stealth handling and a tighter serial queue.

## 0.1.3 — 2026-07-24

- Local country cache settings toggle; more robust profile mute-menu detection
  with a post fallback.

## 0.1.2 — 2026-07-24

- Taller columns layout setting.

## 0.1.1 — 2026-07-24

- Reverse mute/block from the popup.

## 0.1.0 — 2026-07-24

- Initial Premium11 dual-lane (Block / Mute) extension baseline.
