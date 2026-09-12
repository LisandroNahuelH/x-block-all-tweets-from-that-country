#!/usr/bin/env bash
# x-block-all-tweets-from-that-country - POSIX stub.
#
# This repository ships a Windows installer (install/install.ps1) on purpose
# and nothing else at the installer layer. Refusing cleanly beats guessing.
set -u

cat >&2 <<'MSG'
[x-block] No POSIX installer ships with this repository (deliberate).

- End users: install from the Chrome Web Store -
  https://chromewebstore.google.com/detail/obpgcigehkijhgjdldddiaijimhihpma

- Developers on macOS/Linux: the build is plain Node (18+), zero dependencies.
  git clone <repo> && cd <repo> && npm run verify
  then load dist/ unpacked from chrome://extensions.

Nothing on your system is modified by this refusal.
MSG
exit 1
