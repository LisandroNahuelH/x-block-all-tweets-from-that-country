# Limits — what is guaranteed, and where the edges are

Read this before promising anything. Everything below is deliberate.

## Platform

- **Chromium, Manifest V3, Chrome 111 or newer.** No Firefox, no Safari, no mobile build.
- **Installer: Windows v1.** `install/install.ps1` is Windows-only. The build itself is plain Node and runs anywhere: on macOS/Linux run `npm run verify` and load `dist/` unpacked.
- **End users install from the Chrome Web Store** — this repository is the source and dev path, not the distribution channel.

## Detection bounds

- Matching depends on X exposing a public **"About this account"** location.
  Accounts without one are left untouched — this is a filter, never a
  fingerprint.
- Country/region resolution uses X's own data; granularity is whatever X
  returns. Rate limits on those X endpoints are handled by the local cache and
  backoff, but heavy scrolling on a fresh profile can be slower to filter.
- Country/region names from X stay canonical English internally; the UI around
  them is localized.

## UI dependence

Actions are applied by driving X's own menus (caret → drop-down → item →
optional confirm). A structural change on the X side can break actions until
`extension/content/engine/actions.js` is updated. The extension reports what it
can through toasts and the badge; it never silently pretends an action
happened.

## Heartbeat (pseudonymous diagnostics)

- Install/update/ping events send a random install ID, version, event name,
  UI language, and timezone to the publisher's endpoint. There is **no
  opt-out setting** in the current version; blocking `www.premium11.com` at
  the network level silences it.
- The client key in `shared/heartbeat.js` is a public identifier by design
  (it ships in every build). Recommended server-side hardening: per-install-ID
  rate limiting, strict schema validation, and periodic key rotation.

## Tests

- There is no automated test suite yet. `npm run verify` gates the parts that
  exist: agent mirrors, locale structure and translation audit, and the build.
  `npm run versions:check` verifies the release hash pins.

## License scope

- The code is MIT. The **Premium11 name, logo, and store artwork are not
  covered** by that license.
- If paid features are added in the future, entitlement checks belong on the
  server side (outside this repository); what already shipped under MIT stays
  MIT.

## Non-goals

- No server component for the product in this repository.
- No analytics dashboards or third-party telemetry beyond the disclosed
  heartbeat.
- No automatic versioning/tags on every commit; releases are cut deliberately
  (see `AGENTS.md`).

## Not affiliated

This is an independent, non-official project. **Not affiliated with, endorsed
by, or sponsored by X Corp.** "X" and "Twitter" are trademarks of X Corp.
