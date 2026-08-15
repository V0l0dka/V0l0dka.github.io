/* ============================================================
   07 - SUR-RON SHOWCASE

   A campaign page, not a configurator. This module only mounts the
   two images; all the movement is scroll-driven and lives in
   js/scroll.js, the same as every other chapter.

   Replaces the Phase 3 configurator, which offered five categories
   of options with no artwork behind any of them.
   ============================================================ */

import { $ } from './dom.js';
import { asset } from './media-config.js';

export function buildShowcase() {
  mount('[data-hero-webp]', '[data-hero-img]', 'surronSilhouette');
  mount('[data-poster-webp]', '[data-poster-img]', 'surronShowcase');
}

/* <picture> offers WebP and falls back to the file beside it. The
   poster in particular has specifications printed at small type, so
   it is served at native width rather than downscaled. */
function mount(sourceSel, imgSel, assetName) {
  const source = $(sourceSel);
  const img = $(imgSel);
  const entry = asset(assetName);
  if (!source || !img || !entry) return;

  source.srcset = entry.src;
  img.src = entry.fallback || entry.src;
}
