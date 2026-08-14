/* ============================================================
   backdrop.js - shared by both variants.

   Three jobs:
     1. film grain over the whole page
     2. a small parallax push on the backdrop that follows the cursor
     3. say so, visibly, when the media file is not there yet

   No libraries. Loaded by both index.html and still.html.
   ============================================================ */

(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = matchMedia('(pointer: coarse)').matches;

  const backdrop = $('[data-backdrop]');

  /* ==========================================================
     1. missing media
     ========================================================== */

  const markMissing = () => backdrop?.classList.add('is-missing');

  // `error` does not bubble, so it has to be caught in the capture phase.
  // <source> elements inside <video> fire it too.
  document.addEventListener('error', (e) => {
    if (e.target.matches('img, video, source')) markMissing();
  }, true);

  // An image can finish failing before this script even runs.
  const img = backdrop?.querySelector('img');
  if (img?.complete && img.naturalWidth === 0) markMissing();

  /* ==========================================================
     2. video
     ========================================================== */

  const video = backdrop?.querySelector('video');

  if (video) {
    if (reduceMotion) {
      // Honour the OS setting: hold on the poster frame instead of looping.
      video.removeAttribute('autoplay');
      video.pause();
    } else {
      // Autoplay is only permitted while muted. Setting it in JS as well as
      // in the markup covers browsers that clear the attribute on restore.
      video.muted = true;
      video.play().catch(() => {
        // Some mobile browsers refuse until the first interaction. Retry once.
        addEventListener('pointerdown', () => video.play().catch(() => {}), { once: true });
      });
    }

    // A video that has no playable source never fires `error` on the element
    // in every browser, so check the network state once metadata should have
    // arrived.
    setTimeout(() => {
      if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) markMissing();
    }, 2500);
  }

  /* ==========================================================
     3. parallax
     ========================================================== */

  const layer = $('[data-parallax]');

  if (layer && !reduceMotion && !coarsePointer) {
    const MAX = 16;             // pixels of travel at the edge of the screen
    let targetX = 0, targetY = 0, x = 0, y = 0, raf = null;

    addEventListener('pointermove', (e) => {
      targetX = ((e.clientX / innerWidth) - 0.5) * -2 * MAX;
      targetY = ((e.clientY / innerHeight) - 0.5) * -2 * MAX;
      if (raf === null) raf = requestAnimationFrame(follow);
    }, { passive: true });

    function follow() {
      // Ease toward the pointer rather than snapping to it. The lag is what
      // makes it feel like depth instead of like a jitter.
      x += (targetX - x) * 0.06;
      y += (targetY - y) * 0.06;
      layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;

      if (Math.abs(targetX - x) < 0.05 && Math.abs(targetY - y) < 0.05) {
        raf = null;             // settled - stop burning frames
        return;
      }
      raf = requestAnimationFrame(follow);
    }

    // The CSS transition is for the settle-back; during an active follow it
    // would fight the per-frame updates.
    layer.style.transition = 'none';
  }

  /* ==========================================================
     4. film grain
     ========================================================== */

  const canvas = $('[data-grain]');

  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext('2d');

    // Four pre-rendered noise tiles, cycled. Generating noise every frame is
    // pure waste - the eye cannot tell four patterns from infinite ones.
    const TILE = 128;
    const tiles = Array.from({ length: 4 }, () => {
      const t = document.createElement('canvas');
      t.width = t.height = TILE;
      const tctx = t.getContext('2d');
      const image = tctx.createImageData(TILE, TILE);
      for (let i = 0; i < image.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
      tctx.putImageData(image, 0, 0);
      return t;
    });

    function size() {
      // Half resolution. Scaled up by CSS with pixelated rendering, which
      // gives chunkier, more filmic grain and costs a quarter of the pixels.
      canvas.width = Math.ceil(innerWidth / 2);
      canvas.height = Math.ceil(innerHeight / 2);
      ctx.imageSmoothingEnabled = false;
    }

    size();
    addEventListener('resize', size);

    // Real film grain runs at the frame rate of the film, not the screen.
    // 12 per second looks right and costs a fifth of running every frame.
    let last = 0, index = 0;

    (function paint(now) {
      requestAnimationFrame(paint);
      if (now - last < 1000 / 12) return;
      last = now;

      index = (index + 1) % tiles.length;
      const pattern = ctx.createPattern(tiles[index], 'repeat');
      ctx.setTransform(1, 0, 0, 1, (Math.random() * TILE) | 0, (Math.random() * TILE) | 0);
      ctx.fillStyle = pattern;
      ctx.fillRect(-TILE, -TILE, canvas.width + TILE * 2, canvas.height + TILE * 2);
    })(0);
  }
})();
