# Guardians: waived on purpose

The sibling repositories in this project family (Hermes plugins, host-level
patchers) ship two guardians — a Windows scheduled task and a recurring
cronjob — because their target host can reset or overwrite patched files.

**Here there is no host to protect.** This repository builds a browser
extension for the Chrome Web Store:

1. End users receive the product through the store, which updates it
   automatically, server-side.
2. The "host" for the dev path is a git checkout — nothing rewrites it behind
   your back.
3. The one dev-side artifact that goes stale (`dist/`) is rebuilt by
   `npm run verify` / `install/install.ps1` whenever you work on the repo.

So no `ensure-task.ps1` and no `cronjob.md` ship here. That is a deliberate
waiver, not an omission.

## When this waiver stops being valid

Re-open the guardian decision if any of these appear:

- a self-updating channel that requires a pre-built `dist/` on a schedule;
- a host-level installer that writes outside the repo and the state dir;
- a release process that pulls this repository on a machine nobody logs into.

In those cases: add `ensure-task.ps1` (re-run `install/install.ps1` on logon
plus every few hours) and a recurring job that pulls the repo and re-runs the
installer, mirroring the sibling repositories' guardian pattern.
