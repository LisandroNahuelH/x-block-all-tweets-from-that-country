# Third-party notices

This repository adapts ideas and data from other projects. The notices below
record what was used and under which terms.

## xaitax/x-account-location-device

- **What was used:** the detection approach (reading an account's public
  "About this account" location through X's own GraphQL `AboutAccountQuery`
  from the logged-in page) and portions of the country/region reference data
  in `extension/shared/geo-data.js`.
- **Terms:** the upstream project states the MIT license in its README. At the
  time of adaptation (checked 2026-09-11) the upstream repository published no
  `LICENSE` file. Our records note that this use was authorized by the author;
  attribution comments are kept in the source files that carry adapted
  material.
- **Scope:** no third-party code is bundled verbatim beyond identifiers that
  belong to X's own web client (for example, its public GraphQL query id).

## Montserrat typeface

The popup ships the Montserrat font files (`extension/assets/fonts/montserrat/`).
Montserrat is by Julieta Ulanovsky and contributors, licensed under the
**SIL Open Font License 1.1**.

## Twemoji country flags

Country and region flag images are loaded from X's own CDN
(`abs-0.twimg.com`, Twemoji artwork by Twitter/X, licensed **CC-BY 4.0**).
They are not redistributed in this repository.

## X and Twitter

"X" and "Twitter" are trademarks of X Corp. This is an independent,
non-official project — see the disclaimer in [README.md](README.md).
