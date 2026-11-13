# Parth Ramesh Thorat — portfolio

A two-page portfolio built in the design language of
[Shopify Editions Winter '26](https://www.shopify.com/editions/winter2026): the same three
typefaces, the same four colours, the same very tight leading, and the same alternation
between a black stage and a bone/sage paper.

- **[index.html](index.html) — on the clock.** Who I am and what I build: profile, the
  projects from GitHub, experience, skills, education, certifications, contact.
- **[hobbies.html](hobbies.html) — off the clock.** Photography, tabla and badminton. It is
  the negative of the first page: it opens on paper where that one opens on black.

The two are joined by a camera iris that closes over the page being left and opens on the
one arrived at.

## Run it

```bash
node tools/serve.mjs        # http://127.0.0.1:8123/
```

Any static host works — the pages are plain HTML, two stylesheets, three scripts and local
fonts. The only thing fetched at runtime is the repository list from the GitHub API, and
the page is complete without it.

## After changing a stylesheet or script

The pages link their CSS and JS with a version on the end (`sections.css?v=3`). GitHub
Pages lets browsers keep those files for ten minutes and browsers often keep them far
longer, so a visitor can get the new HTML with the old stylesheet — the page then shows new
sections with no styling at all. Bump the number in both HTML files whenever a CSS or JS
file changes, and every browser fetches the new one.

## Layout

```
index.html                 the work page
hobbies.html               the off-the-clock page
assets/css/portfolio.css   design system: tokens, bands, openers, slabs, cards
assets/css/sections.css    everything that moves: iris, hero, plates, orbit, viewfinder, gallery
assets/css/fonts.css       the three @font-face rules
assets/js/portfolio.js     shared: momentum scroll, parallax, reveals, iris, cursor, marquee
assets/js/work.js          work page: stacking plates, skills orbit, GitHub sync
assets/js/hobbies.js       off the clock: viewfinder, contact sheet, viewer, teentaal, rally
assets/photos/             the photographs, and photos.js — the list the gallery is built from
assets/fonts/              NeueMontreal, HWCigars, ImperialScript
reference/editions/        static mirror of the Shopify page, for comparison
tools/                     serve / photos / screenshot / test scripts
```

## Adding photographs

```bash
# 1. drop files into assets/photos/   (a subfolder becomes a series, e.g. assets/photos/cricket/)
# 2. rebuild the list
node tools/photos.mjs
```

`photos.mjs` writes [assets/photos/photos.js](assets/photos/photos.js): each file's pixel
size (so the sheet can lay itself out before a single image has loaded), the camera
settings from EXIF where a JPEG carries them, and a title from the file name. Names a camera
or an app made up — `IMG_6748`, `WhatsApp Image 2025-12-21…`, `Untitled design (6)` — get a
blank title rather than a silly one. Open `photos.js` and type in `title`, `place` and `alt`
by hand; they are kept the next time the tool runs, and so is the order, which is the order
on the page. Byte-identical duplicates are skipped and anything over 1.5 MB is reported —
there are no thumbnails, so every visitor downloads the file you put there. About 2400px on
the long edge is plenty.

With an empty list the sheet shows nine unexposed frames instead of a hole. Two or more
series turn into filter buttons above it.

## Sections

**Work**

| | | |
| --- | --- | --- |
| — | Hero | the name in a golden rectangle, which opens into the profile |
| I | Profile | three scroll-read sentences: who, what, and what else |
| II | Projects | the résumé’s SAP Invoice Exception Manager, then one plate per public GitHub repository — each with its own drawn figure |
| III | Experience | the MDIAS internship |
| IV | Skills | Python & SQL at the centre of an orbit; the seven stack groups beside it |
| V | Education | RAIT / P.E. Society / D.A.V.; then extracurriculars — the events covered as a marquee, Student Union Council (Media Head), Photo Circle RAIT (Chief Coordinator) |
| VI | Certifications | all twelve; the ten with a scan open it |
| — | Intermission | the door to the other page |
| VII | Contact | email as the primary call to action, résumé PDF, GitHub, LinkedIn |

**Off the clock**

| | | |
| --- | --- | --- |
| — | Viewfinder | corner brackets, a focus point that follows the pointer, a readout that stops down |
| I | Photography | assignments, then the contact sheet and its full-screen viewer |
| II | Plane spotting | a radar plot on which an aircraft turns onto final as it scrolls |
| III | Tabla | teentaal as a sixteen-beat wheel that can be played |
| IV | Badminton | a court to scale, with a rally that plays out as it scrolls |
| V | Contact | the same footer, pointing back at the work page |

## The projects section

Every plate is written into [index.html](index.html), from the repositories' own READMEs,
so the page reads in full with no network. [work.js](assets/js/work.js) then asks the GitHub
API once per session for the account's public repositories and does two things with the
answer: refreshes each plate's "Updated" month, and lists under the plates any repository
the markup has not heard of yet — so a new project shows up the day it is pushed, and gets
a plate of its own when there is time to write one. The two repositories that *are* this
site are left out. If the request fails, nothing changes.

To give a new repository a plate, copy an `<article class="plate">`, set `data-repo` to the
repository name, and draw a figure: a 400 × 400 SVG of hairlines, no fills. The classes
`a-spin`, `a-scan`, `a-sweep`, `a-bar`, `a-blink`, `a-pulse` and `a-flow` animate whatever
they are put on, and only while the plate is on screen.

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
| Iris | Eight blades drawn as one SVG path with an even-odd hole. It closes in 0.7s over the page being left; the next page is painted already covered and opens it in 1.1s. Never blocks a click. |
| Hero | Pinned for 1.4 screens. The golden frame fills with paper from its bottom edge, then opens until the paper is the whole screen and the name has grown to fill it — the profile is not scrolled to, it is what the frame becomes. Construction lines draw themselves on arrival and lean away from the pointer. |
| Statement | Each word starts as a ghost and inks in as the paragraph crosses the screen. |
| Plates | Sticky and stacking: each project slides up over the last, which shrinks and dims as it is covered. Falls back to a plain list on a small or short screen. |
| Figures | One line drawing per project — a record that spins, a scan line, a waveform — running only while its plate is visible. |
| Marquee | Two rows of event names that drift on their own and lean into the scroll: faster when the page moves, and in the direction it moves. |
| Orbit | Skill labels ride three rings around Python & SQL and stay upright as the rings turn. |
| Pinned openers | Each opener is 132svh with both its layers sticky, so the title holds for a beat before the section scrolls out from under it. |
| Parallax | Opener titles lift and fade, the construction lines scale and rotate slightly. |
| Masked titles | Display words are split at runtime and slide up from behind a clipping box, staggered 90ms apart. |
| Rail progress | The dotted leader on the active section fills left to right as you move through it. |
| Reveals | Body blocks fade up on enter, children staggered; slab rules draw in from the left; the impact figures count up once. |
| Cursor | A ring that trails the real pointer, swells over anything pressable and names the big targets. The native cursor stays. |
| Viewfinder | The off-the-clock title racks into focus on arrival and falls out of it as it scrolls away, while the readout stops down from f/1.8 to f/16. |
| Contact sheet | Frames unmask upward as they enter; the columns drift against each other; the viewer opens through a circular wipe and pages with arrow keys or a swipe. |
| Teentaal | The theka is synthesised with the Web Audio API — a falling sine for the bayan, a ringing partial stack and a noise tick for the dayan — and scheduled against the audio clock. Silent until asked. |
| Wireframes | Real 3D, no canvas and no library: points are rotated, projected with perspective and written out as three hairline SVG paths — far side, near side, key edges. An icosahedron built from three golden rectangles turns behind the contact title; an airliner on the plane-spotting section banks as it turns and can be dragged round. |
| Tilt | Project and hobby figures lean a few degrees toward the pointer, in perspective. |
| Approach | An aircraft turns onto final on a radar plot, drawn by scroll position. |
| Rally | The shuttle follows a path across the court, drawn by scroll position. |

Everything scroll-driven runs from one `requestAnimationFrame` loop that stops when the page
is still; page scripts hang their own work off it through `window.PF.onFrame`. The few
things that move on their own — marquee, orbit, cursor — each run a loop only while they are
on screen.

Under `prefers-reduced-motion: reduce` the scroll hijack, the iris, the pinned hero, the
stacking, the parallax, the word splitting and every transition are skipped; the openers
collapse from pinned to ordinary blocks and the marquee wraps into plain lines.
Touch devices keep native scrolling — it already has momentum.

## Checks

```bash
npm install --prefix tools      # puppeteer-core, drives your installed Chrome
node tools/shots.mjs            # screenshots every section at 1440px and 390px
node tools/shots.mjs http://127.0.0.1:8123/hobbies.html
node tools/motion.mjs           # asserts the scroll behaviour, including reduced motion
node tools/certs.mjs            # asserts the certificate viewer
node tools/offclock.mjs         # asserts the gallery, the viewer, teentaal, the rally and the iris
```

`shots.mjs` fails loudly on console errors, 4xx responses and horizontal overflow — last
run: no problems on either page, at both widths. `motion.mjs` checks that a wheel tick eases
over frames rather than jumping, that titles pin, that parallax transforms actually change
with scroll, that the rail leader tracks progress, that the copy button and clock behave,
that the hero stays pinned while its frame opens to the full screen, and that reduced
motion turns all of it off — last run 18/18. `offclock.mjs` checks that the contact sheet
matches the manifest, that a photograph never runs under its caption, that the viewer
pages and releases the scroll lock, that teentaal advances and stops, and that the switch
closes the iris, lands on the other page and opens it again — last run 18/18. `certs.mjs` checks
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

Things that need your attention:

1. **Two certifications have no scan.** Azure AI Cloud Developer Associate (AI-200) and
   Azure AI Apps and Agents Developer Associate (AI-103) are on the résumé but not in
   `assets/certificates/`, so their cards are plain headings. Add the scans and wrap each
   name in a `.cert__open` button like its neighbours.
2. **The fonts are licensed.** Neue Montreal (Pangram Pangram) and HW Cigars are
   commercial faces taken from Shopify's site; Imperial Script is a free Google font.
   For a public deploy, buy licences or swap the first two in
   [assets/css/fonts.css](assets/css/fonts.css) — nothing else references them by name.

3. **The photographs have no titles yet.** Files with camera or app names get a blank
   title. Fill in `title`, `place` and `alt` in
   [assets/photos/photos.js](assets/photos/photos.js), and re-export anything the tool
   reports as over 1.5 MB.
4. **The script face is now the full Latin set.** The file lifted from Shopify held capitals
   only, so every lowercase swash — the *e* in Ramesh — was silently falling back to
   whatever each device calls `cursive`. `ImperialScript-Latin.woff2` is the complete face
   from Google Fonts (OFL) and is loaded first.

The résumé at `assets/resume/Parth_Thorat_Resume.pdf` is linked from the top bar and from
the contact section. It carries the phone number, which the page itself no longer shows —
worth knowing before you hand the link around.

`reference/editions/` is a study copy of Shopify's page — their copy, images and
JavaScript. It is in this repository deliberately, as the design reference. Keep it out of
any public *deploy*: serving it from your own domain is a different thing from keeping it
here for comparison.

Everything in this repository that is not mine is catalogued in [NOTICE.md](NOTICE.md).
