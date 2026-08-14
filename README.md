# МИРА / 2015—2026

A personal birthday site. One continuous scroll, ten chapters, in Russian.
Editorial fashion layout that gets progressively more absurd.

Live at <https://v0l0dka.github.io/>

---

## running it locally

Modules are loaded with `<script type="module">`, and browsers refuse to load
modules from `file://`. So you need a server - opening `index.html` by
double-clicking will show a blank page.

```bash
cd ~/workspace/w-website-project
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Stop it with `Ctrl+C`.

---

## what is where

```
index.html              all ten chapters, semantic sections
css/
  main.css              tokens, @font-face, typography, chapter layouts
  animations.css        keyframes + the reduced-motion block
  games.css             game stages, HUD, configurator
  responsive.css        mobile - a rebuild, not a shrink
js/
  assets.js             THE ASSET MAP - edit this to change any photo
  asset-manifest.js     GENERATED. Pixel sizes. Do not edit by hand.
  dom.js                shared helpers ($, el, picture, loopVideo)
  main.js               entry point, wires modules together
  scroll.js             every GSAP/ScrollTrigger call, nothing else
  archive.js            chapter 03
  activities.js         chapter 04
  statistics.js         chapter 05
  customization.js      chapter 07
  interactions.js       chapters 01, 02, 08, 09 + audio
  games/                one module per game, shared contract
  vendor/               GSAP, self-hosted
assets/
  photos/               .jpg + .webp of every still
  videos/               .mp4 + poster of every clip
  fonts/                Playfair Display, self-hosted
tools/
  build-assets.sh       camera originals -> everything in assets/
```

### the one file you will actually edit

`js/assets.js`. Every path, caption, year and statistic is declared there.
Moving a photograph from 2021 to 2023 is a one-line change and nothing else
needs touching - the layout adapts to how many images a year has.

---

## assets

**The originals are not in this repo, on purpose.** They are ~680 MB and live
in `/mnt/c/Users/Volodka/Desktop/miracle`. Keep that folder - it is the master
copy. `.gitignore` blocks `.MOV` so a 147 MB file cannot be committed by
accident (GitHub hard-rejects anything over 100 MB, and committed files stay in
git history permanently).

To regenerate everything in `assets/` from the originals:

```bash
sudo apt install ffmpeg          # once per machine
bash tools/build-assets.sh
```

What it does and why:

- **HEIC → JPEG + WebP.** No browser except Safari can display HEIC. Nine of
  the photographs, including the 2026 reveal, are HEIC. This is not an
  optimisation, it is what makes them appear at all.
- **4K video → 720p H.264.** The clips are 39–147 MB each straight off the
  phone. They end up 0.5–2 MB, muted, with a poster frame.
- **Writes `js/asset-manifest.js`** with the real pixel size of every file.
  Images need `width`/`height` before they download or the browser reserves no
  space, and every photo shoves the page down as it loads. With the manifest,
  measured layout shift is 0.

Result: 680 MB of originals → about 10 MB served.

### year mapping, and what is a guess

2015–2020 and 2022 use dated files. **2021 and 2023 have no dated assets**, so
the photographs there were picked by eye and are marked `provisional: true` in
`js/assets.js`. Change them freely.

**2024 and 2025 are deliberately empty.** The absence is the story. Do not
"fix" them by adding a photograph.

---

## dependencies, and what they cost

Two, both self-hosted. Nothing is fetched from a CDN at runtime, so no outage
elsewhere can break the site, and there is still no build step.

| what | size | why | cost |
| ---- | ---- | --- | ---- |
| GSAP + ScrollTrigger | 116 KB | Scroll-driven pinning and scrubbing. Doing this by hand means reimplementing sticky positioning and scroll math, badly. | Updating means re-downloading two files. All GSAP calls are isolated in `js/scroll.js`, so it can be removed without touching chapter code. |
| Playfair Display | 94 KB | The whole art direction rests on a high-contrast editorial serif. No such face ships with Windows or Linux - the system stack fell back to Georgia and DejaVu Serif, which read as a document. | One more thing in the repo. SIL Open Font Licence, free to embed. Cyrillic and Latin are separate files so only the alphabet in use downloads. |

---

## deployment

`git push` is the deploy. See `CLAUDE.md` for the GitHub Pages settings.
Roughly 30–60 seconds to go live.

---

## phase 1 is done. phase 2 is not.

Working now: the full scroll, intro sequence, the escaping НЕТ button, the
archive with real photographs, the empty years, the 2026 reveal, activities,
statistics with counters and click-to-expand, the configurator UI, the gift,
the future list, the final chapter, mobile, reduced-motion.

**Deliberately not built yet:**

- The three mini games are stubs. Each has a working HUD and a fixed contract
  (`init(stage, hud) -> {start, stop, destroy}`), so Phase 2 fills in bodies
  without touching anything else.
- The Sur-Ron configurator has a working interface and state machine but no
  artwork. Each variant needs a transparent PNG; fill in `layer:` in
  `js/customization.js` and the stacking already works.
- The TMNT chapter is a placeholder pattern, not the real comic art.
- No sound files exist yet. The mute control is wired and the site is fully
  understandable without audio.
- **The final personal message is empty.** It is in `index.html`, marked
  `data-final-message`. That one is for you to write.
