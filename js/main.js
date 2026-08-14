/* ============================================================
   MAIN - the only entry point.

   Builds each chapter from the asset map, then hands scroll
   animation to js/scroll.js. This file wires modules together
   and holds no chapter logic of its own.
   ============================================================ */

import { $, applySize } from './dom.js';
import { FINAL_PHOTO, PRELOAD } from './assets.js';

import { initIntro, initQuestion, initGift, initFuture, initAudio } from './interactions.js';
import { initAudioEngine } from './audio.js';
import { buildArchive } from './archive.js';
import { buildActivities } from './activities.js';
import { buildStats } from './statistics.js';
import { buildCustomization } from './customization.js';
import { initScroll } from './scroll.js';

import { init as initCoal } from './games/coal-game.js';
import { init as initSurron } from './games/surron-game.js';
import { init as initDiving } from './games/diving-game.js';

/* ---------- build the page --------------------------------- */

function build() {
  buildArchive();
  buildActivities();
  buildStats();
  buildCustomization();
  mountFinalPhoto();
  mountGames();

  initAudioEngine();   // must precede initAudio: it listens for the toggle
  initQuestion();
  initGift();
  initFuture();
  initAudio();

  initScroll();

  // The intro runs last so the rest of the page is already built
  // and measured behind it before the lock lifts.
  initIntro();
}

/* ---------- chapter 10 ------------------------------------- */

function mountFinalPhoto() {
  const source = $('[data-final-webp]');
  const img = $('[data-final-img]');
  if (!source || !img) return;

  source.srcset = FINAL_PHOTO.webp;
  img.src = FINAL_PHOTO.jpg;
  applySize(img, FINAL_PHOTO.jpg);
}

/* ---------- chapter 06 -------------------------------------
   All three games share one contract, so they mount in a loop
   rather than three near-identical blocks.
   ------------------------------------------------------------ */

const GAMES = [
  { id: 'coal', init: initCoal },
  { id: 'surron', init: initSurron },
  { id: 'diving', init: initDiving },
];

function mountGames() {
  for (const game of GAMES) {
    const stage = $(`[data-game-stage="${game.id}"]`);
    const hud = $(`[data-hud="${game.id}"]`);
    if (!stage || !hud) continue;

    try {
      game.init(stage, hud);
    } catch (err) {
      // One broken game must not take the rest of the page with it.
      console.error(`game "${game.id}" failed to mount`, err);
    }
  }

  // Recovering all three items lifts the diving stage out of the
  // deep blue and back into the editorial palette. The games know
  // nothing about the page; they announce, the page reacts.
  document.addEventListener('game:end', (e) => {
    const { game, won } = e.detail || {};
    if (game === 'diving' && won) {
      document.getElementById('game-diving')?.classList.add('is-surfaced');
    }
  });
}

/* ---------- preload ----------------------------------------
   Only the handful of images the opening actually needs. Everything
   else is lazy-loaded as it is scrolled to.
   ------------------------------------------------------------ */

function preload() {
  for (const href of PRELOAD) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.append(link);
  }
}

/* ---------- boot ------------------------------------------- */

preload();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', build, { once: true });
} else {
  build();
}
