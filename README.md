# Parth Ramesh Thorat — portfolio

A one-page portfolio built in the design language of
[Shopify Editions Winter '26](https://www.shopify.com/editions/winter2026): the same three
typefaces, the same four colours, the same very tight leading, and the same alternation
between a black stage and a bone/sage paper. All the content is from the résumé.

## Run it

```bash
node tools/serve.mjs        # http://127.0.0.1:8123/
```

Any static host works — the page is plain HTML, one stylesheet, one script, and local
fonts. Nothing is fetched at runtime.

## Layout

```
index.html                 the portfolio
assets/css/portfolio.css   design system + every component
assets/css/fonts.css       the three @font-face rules
assets/js/portfolio.js     momentum scroll, parallax, reveals, counters, rail tracking
assets/fonts/              NeueMontreal, HWCigars, ImperialScript
assets/favicon.svg
reference/editions/        static mirror of the Shopify page, for comparison
tools/                     mirror / serve / screenshot / compare scripts
```

## Sections

| | | from the résumé |
| --- | --- | --- |
| I | Profile | summary, current status, six measured outcomes |
| II | Projects | PocketCA, Banking AI Document Intelligence, Customer Churn, BI & Reservation |
| III | Experience | Student Union Council (Media Head), Photo Circle RAIT (Chief Coordinator) |
| IV | Skills | the six stack groups |
| V | Education | RAIT / P.E. Society / D.A.V. |
| VI | Certifications | all ten, grouped by issuer, each name opening its scan |
| VII | Beyond work | tabla, badminton |
| VIII | Contact | email as the primary call to action, résumé PDF, GitHub, LinkedIn |

## The contact section

The email is the one thing the page is asking for, so it is set at display scale as its own
band with a hover arrow and a copy button, rather than as 14px text in a column of three.
Around it: an availability line with a pulsing marker, the résumé PDF and the profile links
with arrows that slide on hover, and the current local time in Thane so someone in another
timezone knows whether it is a reasonable hour to expect a reply.

The copy button uses `navigator.clipboard`, confirms on the button itself and through an
`aria-live` region, and reverts after two seconds. Clipboard writes need a secure context —
where there isn't one the button removes itself rather than fail silently, and a rejected
write says so instead of claiming success.

## The certifications section

Every certification name is a button that opens its own scan in a native
`<dialog>`, so the focus trap, Esc and the top layer are the browser's job rather
than ours. The `src` is set on click, not in the markup — the scans are megabytes
each and none of them should cross the wire until somebody asks for one. Opening
sets `data-modal-open` on `<html>`, which the momentum scroller reads so the page
cannot move behind the viewer; `overflow: hidden` covers touch and reduced
motion, where the scroller is not running.

On a phone the dialog becomes the screen, and the fit view puts a landscape scan
near 20% — small enough that the certificate's own text cannot be read. So the
viewer has two states: fit, and a zoom that pans. Zoom is natural size on a
desktop and two screens wide on a phone, where natural size would be four times
the viewport and turn reading into a panning exercise. The name is the visible
affordance, but a tap anywhere on the card opens it too — the name alone is a
16px-tall target — unless the tap ended a text selection.

Hovering a card fades in the issuer set large behind it, from `data-issuer` via
`content: attr()`. That is a wordmark in the page's own display face, not the
company's logo: real brand marks are full colour and would be the only colour on
the page. To use actual logos, add a `<symbol>` per issuer to the sprite in
[index.html](index.html) and swap `.cert::after` for a positioned `<svg><use>` —
the reveal keys off `.cert`, not the glyphs.

Filenames under `assets/certificates/` are named for what they contain, so the
mapping from card to scan is readable in the markup rather than a lookup.

## Design notes

Palette and type scale were measured off the live Editions page rather than eyeballed
(`node tools/tokens.mjs` re-runs the extraction):

```
black #000000   bone #F7F7EE   sage #DCDCD0
ink   #292919   muted #909083  mid  #5C5C4E

display  13.45vw / 0.90 / -0.03em   NeueMontreal 700
lede      3.04vw / 0.96 / -0.05em   HWCigars 400
body        14px / 1.10             NeueMontreal 700
label       11px / 1.10             NeueMontreal 700
```

The hero draws a golden rectangle subdivided square by square, with the quarter arcs of
the Fibonacci spiral through it — the same conceit as the Editions hero. Each section
opener reuses one `<symbol>` of construction lines via `<use>`.

The top bar, the left rail and the mobile strip each ask which band sits under *their own*
position and re-colour themselves independently, so none of them ever ends up dark text on
a dark band while crossing a boundary.

## Motion

| | |
| --- | --- |
| Momentum scrolling | Wheel input moves a target offset; each frame the real position eases ~10% of the way toward it. Same idea as Lenis, about 40 lines, no dependency. |
| Pinned openers | Each opener is 132svh with both its layers sticky, so the title holds for a beat before the section scrolls out from under it. |
| Parallax | Opener titles lift and fade, the construction lines scale and rotate slightly, the hero separates into two planes as it leaves. |
| Masked titles | Display words are split at runtime and slide up from behind a clipping box, staggered 90ms apart. |
| Rail progress | The dotted leader on the active section fills left to right as you move through it. |
| Reveals | Body blocks fade up on enter, children staggered; slab rules draw in from the left; the impact figures count up once. |

All of it runs from one `requestAnimationFrame` loop that stops when the page is still, and
writes only `transform` and `opacity`.

Under `prefers-reduced-motion: reduce` the scroll hijack, the parallax, the word splitting
and every transition are skipped, and the openers collapse from pinned to ordinary blocks.
Touch devices keep native scrolling — it already has momentum.

## Checks

```bash
npm install --prefix tools      # puppeteer-core, drives your installed Chrome
node tools/shots.mjs            # screenshots every section at 1440px and 390px
node tools/motion.mjs           # asserts the scroll behaviour, including reduced motion
node tools/certs.mjs            # asserts the certificate viewer
```

`shots.mjs` fails loudly on console errors, 4xx responses and horizontal overflow — last
run: 8 sections, no problems, at both widths. `motion.mjs` checks that a wheel tick eases
over frames rather than jumping, that titles pin, that parallax transforms actually change
with scroll, that the rail leader tracks progress, that the copy button and clock behave,
and that reduced motion turns all of it off — last run 16/16. `certs.mjs` checks
that no scan is fetched on load, that the count matches the cards, that every
path resolves, that each name opens its own image, that the page cannot scroll
behind the viewer, and that the button, the backdrop and Esc all close it and
release the lock — last run 18/18. It also asserts that a *closed* viewer takes
up no space: setting `display` on `.lightbox` rather than `.lightbox[open]`
beats the user agent's `dialog:not([open])` rule and leaves an invisible block at
the end of every page that still swallows clicks over it. Nothing else catches
that — no overflow, no console error, no visible difference.

Headless Chrome refuses real clipboard writes even with `clipboard-write` granted over
CDP, so `motion.mjs` stubs `navigator.clipboard` and drives both the success and the
rejection branch. The write call itself is plain `writeText`; it works in a real browser
on localhost or https.

## Before this goes public

Two things need your attention:

1. **The LinkedIn URL is a guess.** The résumé shows the display name, not the slug.
   `https://www.linkedin.com/in/parth-thorat` is a placeholder — check it and correct
   the `href` in the contact section of [index.html](index.html).
2. **The fonts are licensed.** Neue Montreal (Pangram Pangram) and HW Cigars are
   commercial faces taken from Shopify's site; Imperial Script is a free Google font.
   For a public deploy, buy licences or swap the first two in
   [assets/css/fonts.css](assets/css/fonts.css) — nothing else references them by name.

The résumé at `assets/resume/Parth_Thorat_Resume.pdf` is linked from the top bar and from
the contact section. It carries the phone number, which the page itself no longer shows —
worth knowing before you hand the link around.

`reference/editions/` is a study copy of Shopify's page — their copy, images and
JavaScript. It is in this repository deliberately, as the design reference. Keep it out of
any public *deploy*: serving it from your own domain is a different thing from keeping it
here for comparison.

Everything in this repository that is not mine is catalogued in [NOTICE.md](NOTICE.md).
