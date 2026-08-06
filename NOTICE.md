# Notice — third-party material in this repository

This repository contains material that is not mine. It is here because the portfolio was
built as a study of Shopify's *Editions Winter '26* page, and `reference/editions/` is a
working copy of that page kept alongside for comparison. Anyone reusing this repository
should read this file first.

## What is original

Written for this project, and covered by [LICENSE](LICENSE):

```
index.html
assets/css/portfolio.css
assets/css/fonts.css
assets/js/portfolio.js
assets/js/site.js
assets/favicon.svg
tools/*.mjs
README.md
```

## What belongs to Shopify

Copied from <https://www.shopify.com/editions/winter2026>. Copyright Shopify Inc.
No licence has been granted for any of it; it is reproduced here for study only.

| Path | What it is |
| --- | --- |
| `reference/editions/index.html` | Their server-rendered markup and hydration payload, complete with their marketing copy |
| `assets/css/tailwind-*.css` | Their compiled Tailwind build |
| `assets/css/fonts-latin-*.css` | Their `@font-face` declarations |
| `assets/img/*.png`, `assets/img/*.jpg` | Background images from their CDN |
| `assets/fonts/` files with hashed names | Font binaries from their CDN |

The mirror also loads Shopify's JavaScript bundle and its images at runtime from
`cdn.shopify.com`. Those are never redistributed here, but the page does not work without
reaching their servers.

## Fonts

The portfolio's typography depends on three faces lifted from Shopify's CDN. Two of them
are commercial and **no licence has been purchased for the use in this repository**:

| Family | Files | Status |
| --- | --- | --- |
| Neue Montreal | `NeueMontreal-Bold.woff2/.ttf` | Commercial. Pangram Pangram Foundry. A web licence must be bought for any public deployment. |
| HW Cigars | `HWCigars-Regular.woff2/.ttf` | Commercial. I have not confirmed the foundry — verify before relying on it anywhere. |
| Imperial Script | `ImperialScript-Regular.woff2/.ttf` | Free. Google Fonts, SIL Open Font License 1.1. |
| Inter | `Inter-Variable.woff2` | Free. SIL Open Font License 1.1. Used only by the reference mirror. |

If this repository is ever deployed to a public URL, the first two need either a purchased
web licence or a substitution. They are referenced in exactly one place —
[assets/css/fonts.css](assets/css/fonts.css) — so swapping them is a single-file change.

## If you are here from a rights holder

Open an issue on this repository and the material will be removed.
