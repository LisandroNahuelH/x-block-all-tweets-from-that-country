# AGENTS.md — the runbook and dev contracts (read me before touching anything)

You are an agent asked to install, build, or work on **X - Block All Tweets
From That Country Or Region** from this repository. This file is self-contained:
repo map, exact commands, expected output, failure protocol, and the project's
development contracts.

**Installer boundary: Windows v1.** `install/install.ps1` is Windows-only. The
build itself is plain Node and runs anywhere — on macOS/Linux skip the
installer, run `npm run verify`, and load `dist/` unpacked. If a step below
cannot run, stop and report exactly which one — do not improvise.

## Repository map

| Path | What it is |
|---|---|
| `extension/` | the extension source (truth). Plain JavaScript, Manifest V3, no bundler |
| `scripts/` | build, i18n and mirror tooling (plain Node, zero dependencies) |
| `docs/` | architecture, limits, troubleshooting, i18n program |
| `install/` | Windows dev installer + uninstaller; POSIX refusal stub |
| `dist/` | build output (gitignored) — the "Load unpacked" target |
| `versions.json` | hash-pinned handshake for the installer and the release cut |

## 0. Preflight — verify, then stop or continue

```powershell
[System.Environment]::OSVersion.Platform   # expect Win32NT for the installer path
node --version                             # expect v18.x or newer
npm --version                              # any (ships with Node)
Test-Path .\versions.json                  # True expected (run from the repo root)
git rev-parse HEAD                         # record this for the report
```

## 1. Clone to a stable path

```powershell
$repo = Join-Path $env:USERPROFILE 'x-block-all-tweets-from-that-country'
if (Test-Path $repo) { git -C $repo pull --ff-only } else { git clone https://github.com/LisandroNahuelH/x-block-all-tweets-from-that-country.git $repo }
```

Remember `$repo` — the commands below reuse it.

## 2. Dry run (writes nothing)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$repo\install\install.ps1" -WhatIf
```

Expected: lines prefixed `[x-block]`, a final `dry run ... OK`, exit code 0,
and **no files created**.

## 3. Install (the real run — verify + build)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$repo\install\install.ps1"
```

Read the log — the authoritative record:

```powershell
Get-Content "$env:LOCALAPPDATA\Premium11\x-block-all-tweets-from-that-country\install.log" -Tail 40
```

Expected: sha256 gate passes, `npm run verify` green, `dist/` written, exit 0.
Then load it: `chrome://extensions` → Developer mode → **Load unpacked** →
`$repo\dist`. End users install from the Chrome Web Store instead — see README.

## 4. Verification checklist (prove it, then report)

```powershell
npm run versions:check                                          # expect: versions.json OK
Get-Content "$repo\dist\manifest.json" | Select-String '"version"'   # expect: matches versions.json
git -C $repo status --porcelain                                 # expect: clean (only ignored dirs)
```

Report to the user, in their language, as a small table: repo commit, installer
exit code, `npm run verify` result, `versions:check` result, and the
load-unpacked path.

## Failure protocol

| Symptom | Meaning | Do |
|---|---|---|
| installer exit 2 | preflight failed (no Node 18+, no npm, not a full checkout) | report the exact message; nothing was touched |
| installer exit 1 | integrity gate, `npm run verify`, or a postcondition failed | read the log tail; if the gate fired, the checkout drifted from `versions.json` — refresh with `npm run versions:update` only when cutting a release; otherwise report |
| installer exit 3 | another run holds the lock (fresh, under 30 min) | wait, or rerun later; it is a no-op guard, not an error |
| `versions:check` mismatch | files changed after the release cut | releases: `npm run versions:update`, then commit; otherwise report |
| `npm run verify` red | mirror drift / locale structure / build error | the failing step names the fix (see Dev contracts) |

Never hand-edit files to make a gate pass — drift is reported, not patched.

## Manual path (for the user, if they prefer)

```powershell
git clone https://github.com/LisandroNahuelH/x-block-all-tweets-from-that-country.git "$env:USERPROFILE\x-block-all-tweets-from-that-country"
cd "$env:USERPROFILE\x-block-all-tweets-from-that-country"
npm run verify
# then: chrome://extensions -> Developer mode -> Load unpacked -> .\dist
```

Uninstall: remove the extension in `chrome://extensions`, then run
`install/uninstall.ps1` (dry run with `-WhatIf`).

## What you must not do

- Do not write outside: the repo checkout, `dist/`, and `%LOCALAPPDATA%\Premium11\`.
- Do not commit `dist/`, `release/`, `Backups/`, or anything gitignored.
- Do not run the installer twice in parallel (respect exit 3).
- Do not edit `AGENTS.md` without re-running `npm run agents:sync`.

## Dev contracts (keep these true)

### Triple mirror

`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` stay byte-identical. Edit `AGENTS.md`,
then run `npm run agents:sync`; `npm run agents:verify` asserts identity — CI
runs it too.

### i18n

- Source of truth: `extension/_locales/en/messages.json`. New keys land in `en`
  first (with `description`), then in `EN_FALLBACK` (`shared/i18n.js`); run
  `npm run i18n:check` and `npm run i18n:audit`.
- Never use doubled `''` apostrophes in `EN_FALLBACK` literals — it breaks the
  service worker.
- Country/region names coming from X stay canonical English for matching —
  never localized.
- Locales are generated one at a time from `scripts/locale-overrides/` via
  `npm run i18n:apply`. The shipping set is `extension/locales.manifest.json`;
  program status lives in `docs/i18n/translation-program-status.md`.

### Settings & lanes

- Three independent lanes: `{ block, mute, notinterested }`, each
  `{ enabled, countries, regions, accounts }`, persisted in
  `chrome.storage.local` under `xcd_settings`.
- Managed account entries: `{ screenName, name, avatarUrl, ts }`.
- Toolbar badge: session counters; red / yellow / blue flash per lane.
- Timeline marks: optional flag and country label next to usernames, order
  flag → name, both on by default (opt-out).
- Action execution follows the menu flow (caret → menu → keyword item →
  optional confirm), serial queue (concurrency 1), dedupe plus self-skip, and
  records the account after a successful action.

### Geo cache

- IndexedDB `xcd_geo_v1`, device-only. Write only complete positive hits
  (`screenName` + non-empty location). Never persist rate-limit failures,
  empty lookups, or unknowns. Settings stay in `chrome.storage.local`; the
  bulk cache is not dumped there.

### Heartbeat

- Product slug: `x-block-all-tweets-from-that-country`. Module
  `extension/shared/heartbeat.js`: pseudonymous `install` / `update` / `ping`
  events, storage keys `xcd_installId` / `xcd_lastHeartbeatAt`, and the
  uninstall farewell via `chrome.runtime.setUninstallURL`.
- The client key in the module is public by design — it ships in every
  released build. Keep the disclosure in README and SECURITY.md accurate.

### Build, verify, release

- `npm run verify` = mirror check + `i18n:check` + `i18n:audit` + build.
- Release cut (maintainer): bump the version in all three truth sources —
  `package.json`, `extension/manifest.json`,
  `extension/shared/release-metadata.js` — set `EXTENSION_LAST_UPDATE_ISO` to
  the release day, run `npm run agents:sync` if this file changed, run
  `npm run verify`, refresh `npm run versions:update`, then package the store
  zip. Never bake volatile facts (counts, prices, dates) into README or docs.
- The Chrome Web Store listing and the publish pipeline live outside this
  repository; the store ID is stable and appears in `docs/architecture.md`.

Architecture source of truth: [`docs/architecture.md`](docs/architecture.md).
