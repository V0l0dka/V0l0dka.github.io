/* ============================================================
   PROXIMITY PRELOAD

   Some media is not rendered by js/media.js and so is not covered by
   its prepare pass. The gift photograph is the important case: it
   lives inside an element that stays `hidden` until ПОКАЗАТЬ is
   pressed, and a `loading="lazy"` image inside a hidden element is
   never fetched at all. The reader would press the button and then
   watch a 1200 px photograph download.

   This module fixes that class of problem in the only way that is
   actually simple: when the reader gets near section A, start
   fetching the media that section B needs.

   It deliberately does NOT try to be a general asset pipeline. It is
   a list of "when you see this, go and get that", because that is
   all the page needs and anything more would be machinery to
   maintain for no benefit.
   ============================================================ */

import { $ } from './dom.js';

/* How much warning each trigger gets. A whole viewport is plenty:
   these are single files of 100-250 KB, not a video stream. */
const MARGIN = '900px 0px 900px 0px';

/* Fetch without rendering. The browser caches the response, so the
   real <img> or <video> that appears later is served from memory.

   `fetch` rather than `new Image()` because it works for video as
   well, and the result is thrown away on purpose - the point is the
   cache entry, not the bytes. */
function warm(url) {
  if (!url || warm.done.has(url)) return;
  warm.done.add(url);
  fetch(url, { credentials: 'same-origin' }).catch(() => {
    /* Offline, 404, whatever. This is an optimisation, never a
       requirement - the element still loads normally on its own. */
  });
}
warm.done = new Set();

/* Run `fn` once, when `sel` comes within MARGIN of the viewport. */
function near(sel, fn) {
  const el = $(sel);
  if (!el) return;

  if (typeof IntersectionObserver === 'undefined') { fn(); return; }

  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    fn();
  }, { rootMargin: MARGIN });

  io.observe(el);
}

/* ------------------------------------------------------------
   THE SCHEDULE

   Each line reads "while the reader is here, fetch what comes next".
   Ordered down the page. Nothing here is on the initial load: at the
   top of the page every trigger is far outside its margin.
   ------------------------------------------------------------ */
export function initPreload(assets, photos = {}) {
  const src = (name) => assets(name)?.src || null;

  /* Still in the early archive: fetch the 2026 reveal. It is the
     payoff of two empty years and the one image on the page that
     must absolutely not pop in, so it gets the longest run-up of
     anything here - roughly four chapters of warning. */
  near('[data-year="2020"]', () => warm(photos.reveal2026));

  // Approaching the games: the bike the Sur-Ron game draws. The
  // games' own sprites are already handled by loadSprite(), which
  // has its own 800 px proximity rule - this only covers the
  // showcase, which shares the same file.
  near('#stats', () => warm(src('surronSilhouette')));

  // Approaching the showcase: its poster is the largest single image
  // in the chapter and it arrives behind a mask, so a late load is
  // very visible.
  near('#game-diving', () => warm(src('surronShowcase')));

  /* Approaching the showcase: fetch the gift. This is the one that
     matters. By the time the reader has read three characteristics,
     looked at the poster and reached "60+ ТРАВМ", the photograph is
     already in cache and ПОКАЗАТЬ is instant. */
  near('#showcase', () => {
    warm(src('present'));
    warm(src('tmntReveal'));
  });
}
