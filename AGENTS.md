# AGENTS.md

## Scope, Priority, and Portability

This file is the canonical agent operating contract for this repository.

1. Universal rules first; project-specific contracts last.
2. On conflict: **project-specific** wins over universal; both override casual chat.
3. Repo-root mirrors `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` must stay **byte-identical**.

## Triple Mirror Contract

`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` are mandatory repo-root mirror files.

1. Keep all three present at the repository root at all times.
2. Whenever any one is modified, immediately replicate to the other two before ending the task.
3. If one is missing, recreate it from the current canonical content.
4. Use `npm run agents:sync` / `npm run agents:verify` to enforce identity.

## 👤 Language and style (project + user global)

1. Always respond to the user in **Spanish**.
2. **`/breve` always on:** extreme brevity; core only; no filler.
3. **`/ponytail-ultra` always on:** YAGNI, minimal diff, reuse existing code, no unsolicited abstractions.
4. Prefer complete sentences only when clarity requires it; otherwise short and precise.

## 💾 Backups

1. **UI backups:** before non-trivial UI edits to `extension/popup/*` (or brand CSS/HTML), copy current files into  
   `Backups UI/ui-YYYY-MM-DD/` (create folder if missing). Keep working tree clean of loose backups.
2. **`.txt` code (global rule):** if editing code that lives in a `.txt` file, backup first into `Backups .txt/` beside that file.
3. Do not commit large dump folders of secrets; `Backups UI/` is gitignored like peer Premium11 repos.

## 🛠️ Technical rules

1. UTF-8 for all tracked text files.
2. Source of truth for the loadable extension is `extension/`. Ship via `npm run build` → `dist/` (gitignored).
3. **Do not** invent build tools unless asked; keep zero-bundler layout unless product requires it.
4. Premium11 identity: tokens/fonts/brand from peer extensions (Volume Booster / Super Tab Suspender / Delete All My Tweets). Do not invent a new design system.
5. Detection tech origin: `_upstream` = [xaitax/x-account-location-device](https://github.com/xaitax/x-account-location-device) (MIT, authorized). Prefer extracting only needed pieces.

### i18n contract

1. Default locale: **English** (`extension/_locales/en/messages.json`).
2. User-facing strings via `chrome.i18n` / `XCD_I18N.t` / `data-i18n*`. No hard-coded UI copy.
3. New keys: add to `en` first (with `description`), update `shared/i18n.js` `EN_FALLBACK`, run `npm run i18n:check`.
4. Country/region names from X stay **English canonical** for matching; do not i18n those keys for block logic.
5. Locale codes: only those in `extension/locales.manifest.json`.

### Settings / lanes contract

1. Block and Mute are **independent** lanes:  
   `{ block: { enabled, countries, regions, accounts }, mute: { ... } }`.
2. Account entries: `{ screenName, name, avatarUrl, ts }`.
3. Toolbar badge: session counter + red flash (block) / yellow flash (mute) via `shared/badge.js` + SW.
4. Opening external URLs (Premium11 home): message SW `OPEN_URL` then `window.close()` — never hang the popup.

### Build and verify

Before considering a task done when code changed:

```bash
npm run i18n:check
npm run build
```

Load unpacked from **`dist/`**. After `manifest.json` changes, user must reload the extension in Chrome.

### Chrome Web Store release (when packaging)

Follow global extension release rule: bump minimum version in all truth sources, `build` + release zip, commit, leave store-ready artifact. Prefer skill `empaquetar-para-release-chrome-store` when applicable.

## 🌿 Git workflow

1. Prefer small, conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.
2. Do not force-push unless explicitly requested.
3. Do not commit `dist/`, `node_modules/`, secrets, or personal dumps.
4. `_upstream/` is reference only (gitignored); re-clone if needed:
   `git clone --depth 1 https://github.com/xaitax/x-account-location-device.git _upstream`

## 💬 Communication

1. Spanish, brief, decision-first.
2. State risks and assumptions explicitly when relevant.
3. Never hide uncertainty.

## ✅ Task completion checklist

1. Backup UI if UI changed.
2. Code + i18n updated.
3. `npm run i18n:check` and `npm run build` pass.
4. Mirrors `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` still identical.
5. Meaningful git commit when the user asked to commit or closed a complete unit of work.

## Project-specific product notes

| Item | Value |
|------|--------|
| Product name | `X - Block all tweets from that country or region` |
| Brand | Premium11 (`extension/brand/premium11-mark.svg`) |
| Homepage | `https://www.premium11.com/` |
| Target | Chromium MV3, x.com / twitter.com |
| Current stage | Popup dual-lane UI + geo detection + settings/badge; **block/mute engine on X still pending** |

When implementing the block/mute engine: reuse session headers + GraphQL patterns from `_upstream` / `extension/page-script.js` + `background.js`; always `recordManagedAccount` / `RECORD_ACCOUNT` so lists and badge update.
