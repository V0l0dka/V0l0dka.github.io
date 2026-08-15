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

## the games

Three canvas games, all inside the one page - no separate routes. They share
`js/games/engine.js` (canvas sizing, frame loop, pointer input, auto-pause) and
each exports the same `init(stage, hud)`.

| mission | goal | win | lose |
| ------- | ---- | --- | ---- |
| 01 CATCH THE COAL | catch 10, speed climbs | `PROFESSIONAL` | 3 missed → `УГОЛЬ ПОБЕДИЛ` |
| 02 DON'T CRASH | survive 40 s | `ну нормально` | `зато красиво` |
| 03 GO DEEPER | torch out 3 objects | `ALL ITEMS RECOVERED` | — |

Rules they all obey:

- **They never steal the scroll.** A game only captures input while a run is
  actually in progress. SPACE scrolls the page normally everywhere else, and a
  finger dragged across an idle canvas still scrolls.
- **They stop when you look away.** Off-screen or background tab pauses the
  loop, so three canvases are never animating down a 38 000 px page.
- **Pressing start centres the stage**, because the catcher lives at the bottom
  of it and used to sit below the fold.

Sound is synthesised in `js/audio.js` with WebAudio - there are no audio files.
Off by default, wired to the existing toggle.

## external media

Reaction clips, TMNT, the cut-outs and the gift photograph all live under
`assets/external/`. **Every path is declared in `js/media-config.js`** and
nowhere else - that file is where you swap a clip for a different one.

`PLACEMENTS` maps a slot to an asset plus how it behaves:

```js
'stat-injuries': { asset: 'fail1', loops: 2, size: 'md' },
```

`loops` is how many times it plays before freezing on its last frame. A
reaction that repeats forever stops being a joke and becomes wallpaper, so
most are 2-3. `0` loops indefinitely and is used only for the loading spinner.

Rebuild the converted media from the originals with:

```bash
SRC="/mnt/c/Users/Volodka/Desktop/miracle" bash tools/build-external.sh
```

The supplied GIFs were ~58 MB. None used transparency, so they are converted
to MP4 and come out around 20x smaller - 3.7 MB for the whole library. The
six cut-outs stay WebP-with-alpha, because their transparent background is the
point: the hookah stands on the game's own backdrop, the diving objects sit in
the water.

**A missing file is not an error.** Any slot may point at something that does
not exist, or be `null`. The element removes itself, so a decoration can never
leave a hole or a broken-image icon.

## language

The site is Russian. English survives only where it is a brand, a model or a
deliberate designation: `Sur-Ron`, `Light Bee X`, `Revo`, `METAN`, and the
chapter title `MIRA IRL`.

## what is left

- **The final personal message is empty.** It is in `index.html`, marked
  `data-final-message`. That one is for you to write.
- **`diving-win` has no reaction** on purpose - recovering all three already
  triggers the surfacing transition, and a GIF on top would talk over it. Set
  an asset on that slot in `js/media-config.js` if you want one.
- **Unused supplied clips:** none. All 13 GIFs and all 6 cut-outs are placed.
