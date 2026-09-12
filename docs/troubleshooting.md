# Troubleshooting

## Where the logs live

| Surface | How to read it |
|---|---|
| Installer | `%LOCALAPPDATA%\Premium11\x-block-all-tweets-from-that-country\install.log` (append-only, timestamped) |
| Service worker | `chrome://extensions` → this extension → **service worker** → Inspect → Console |
| Popup | right-click the popup → Inspect |
| Page bridge | DevTools console on the x.com tab (the MAIN-world script logs there) |

## Quick probes

```powershell
# Is the build fresh? (build-stamp.json is rewritten on every build)
Get-Item .\dist\build-stamp.json | Select-Object LastWriteTime

# Do the hash pins still hold?
npm run versions:check

# What version is built?
(Get-Content .\dist\manifest.json -Raw | ConvertFrom-Json).version

# Is the working tree clean apart from ignored dirs?
git status --porcelain
```

## Installer exit codes

| Code | Meaning | Action |
|---|---|---|
| 0 | success (or safe no-op) | load `dist/` unpacked |
| 1 | integrity gate, `npm run verify`, or a postcondition failed | read the log tail; fix what the failing step names |
| 2 | preflight failed (Node < 18, no npm, not a full checkout) | install Node 18+, run from the repo root |
| 3 | another run holds the lock (fresh, under 30 min) | wait, or rerun later — it is a no-op guard |

## Recovery recipes

- **`npm run agents:verify` fails** — the three mirrors drifted. Run
  `npm run agents:sync` (it copies `AGENTS.md` onto `CLAUDE.md` / `GEMINI.md`),
  then re-run the check.
- **`npm run i18n:check` fails** — a key is missing or differs. Add it to
  `extension/_locales/en/messages.json` first, mirror it in `EN_FALLBACK`
  (`shared/i18n.js`), then re-run.
- **Service worker dies with a syntax error after editing `EN_FALLBACK`** —
  look for doubled `''` apostrophes; use `\'` or a typographic `’`.
- **The unpacked extension does not reload after a build** — confirm the build
  stamp changed (`dist/build-stamp.json`), then reload the extension manually
  once in `chrome://extensions`; auto-reload re-arms from the next build.
- **Actions stop firing on `x.com`** — X's menu structure likely changed.
  Capture the console output and the affected post URL, then open an issue with
  the template.
- **`npm run versions:check` reports a mismatch** — the checkout changed after
  the release cut. When cutting a release, refresh with
  `npm run versions:update` and commit; otherwise report it, do not "fix" it
  silently.
- **`install/uninstall.ps1` cannot delete `dist/`** — a file is locked by
  Chrome. Remove the unpacked extension in `chrome://extensions`, close Chrome,
  and run it again.

## What to include in an issue

- Extension version (store or `dist/manifest.json`) and the commit hash.
- Chrome version and OS.
- Steps to reproduce, expected vs actual.
- Log excerpts (installer log tail, console snippet).

**Never** include tokens, install IDs, or personal data in an issue.
