# Security policy & threat model

## What this project changes on your machine

| Surface | Path | Change |
|---|---|---|
| Extension source | `extension/` | read; built into `dist/` by `npm run build` |
| Build output | `dist/` | generated; gitignored; the "Load unpacked" target |
| Installer state | `%LOCALAPPDATA%\Premium11\x-block-all-tweets-from-that-country\` | `install.log`, `install.lock`, `installed.json` — written only by the installer |
| Your Chrome profile | inside the browser profile | extension settings (`chrome.storage.local`) and the geo cache (IndexedDB `xcd_geo_v1`) — created by the extension, removed when you remove it |

Nothing else is read or written. `install/uninstall.ps1` removes `dist/` and
the installer state directory — and nothing beyond that.

## Network surface

| Destination | Why | When |
|---|---|---|
| `x.com` / `twitter.com` (including `abs-0.twimg.com`, `pbs.twimg.com`) | About-account lookups run as you, from your logged-in page; flag images from X's CDN | while you browse x.com |
| `www.premium11.com` | the pseudonymous heartbeat (install/update/ping) and the uninstall farewell page; links opened from the popup | install, update, daily popup open, uninstall |

No other endpoints are contacted. Full disclosure of the heartbeat payload is
in the [README](README.md#privacy--the-heartbeat-disclosure).

## About the heartbeat client key

`extension/shared/heartbeat.js` contains a client key that is **public by
design**: it ships inside every released build, so anyone can extract it — it
identifies the product on the heartbeat endpoint, never a user, and grants no
access to any data. Hash-pinning it would be theater, so the repository keeps
the shipped code as-is. Server-side hardening (per-install-ID rate limiting,
strict schema validation, key rotation) is documented in
[`docs/limits.md`](docs/limits.md).

## Guarantees

1. **No remote code.** Everything the extension executes is in this repository (Manifest V3, no CDN scripts, no `eval`).
2. **Hash-pinned checkout.** `versions.json` publishes sha256 (LF-normalized bytes) for the installer and key build inputs; `npm run versions:check` verifies them anywhere.
3. **All-or-nothing dev install.** `install/install.ps1` gates on the sha256 pins, runs `npm run verify`, and refuses to report success if any postcondition fails.
4. **Loud on drift.** A checkout whose files no longer match `versions.json` is refused by the installer instead of being silently built.

## Reporting a vulnerability

Use GitHub's **private vulnerability reporting** on this repository
(Security → Report a vulnerability). Include:

- the affected file(s) or behavior, with steps to reproduce;
- the extension version and commit hash;
- relevant log excerpts — **never** tokens, install IDs, or personal data.

If private reporting is unavailable, open an issue titled `security: ...`
without sensitive details.

## Out of scope

- X itself, and anything on the x.com side of the boundary (report upstream).
- Forks re-hosting these files — verify the sha256 in `versions.json` against
  the source you cloned.
