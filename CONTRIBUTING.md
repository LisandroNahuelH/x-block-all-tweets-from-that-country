# Contributing

Thanks for considering a contribution. This repository is the public source of
a Chrome Web Store extension; the maintainer cuts store releases from it.

## Setup

- Node.js 18 or newer. There are **no npm dependencies** — nothing to install.
- `npm run verify` must pass before anything else:

```bash
npm run agents:verify   # AGENTS.md / CLAUDE.md / GEMINI.md stay byte-identical
npm run i18n:check      # locale structure and key parity
npm run i18n:audit      # no leftover English outside the allowlist
npm run build           # sync extension/ -> dist/
```

- `npm run versions:check` verifies the sha256 pins in `versions.json`.

## Contracts to keep

1. **Language.** All repository documentation and commit messages are in English. Localization content lives in `extension/_locales/` only.
2. **Triple mirror.** `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` must stay byte-identical — edit `AGENTS.md`, then run `npm run agents:sync`.
3. **i18n.** The source of truth is `extension/_locales/en/messages.json`. Add new keys there first (with a `description`), update `EN_FALLBACK` in `shared/i18n.js`, then run `npm run i18n:check`. Never use doubled `''` for apostrophes in `EN_FALLBACK` literals (it breaks the service worker).
4. **One locale at a time.** Locales are generated from `scripts/locale-overrides/` via `npm run i18n:apply`; no machine-batch dumps.
5. **Build output is generated.** Never commit `dist/`, `release/`, or `Backups/`.

## Making a change

1. Small, focused branches and diffs.
2. Atomic commits in English (`feat:`, `fix:`, `docs:`, `chore:` — conventional style).
3. Run the full gate before opening a PR:

```bash
npm run verify && npm run versions:check
```

4. Don't modify files hashed in `versions.json` (`package.json`, `scripts/build.mjs`, `extension/manifest.json`, `install/install.ps1`) as part of unrelated changes — if you must, refresh with `npm run versions:update` in the same commit.

## Pull requests

- Describe **what** changed and **why**, with reproduction steps for fixes.
- Keep the PR checklist in the template honest — it is the review contract.
- UI changes: include a small before/after note (screenshots welcome — no personal data).

## Releases

Store packaging, version bumps, and the release checklist are maintainer
workflows documented in [`AGENTS.md`](AGENTS.md). Please don't bump versions
in a PR.
