/* ============================================================
   MEDIA RENDERER

   Turns a placement slot from js/media-config.js into a DOM node.
   This file names no files and no paths - swap a clip in the
   config and nothing here changes.

   Behaviour it guarantees for every decorative clip:

     - nothing downloads until the element is near the viewport
     - playback stops the moment it leaves again
     - it plays a set number of times, then freezes on its last
       frame rather than looping forever in the corner of the eye
     - it enters with a short animation instead of popping in
     - a file that does not exist removes its own element, so a
       missing decoration can never leave a hole or a broken icon
     - under prefers-reduced-motion nothing animates or autoplays
   ============================================================ */

import { el, prefersReducedMotion } from './dom.js';
import { resolve } from './media-config.js';

/* ------------------------------------------------------------
   Build a moment for a slot. Returns null when the slot is empty
   so callers can simply skip it.
   ------------------------------------------------------------ */
export function createMoment(slot, { className = '' } = {}) {
  const entry = resolve(slot);
  if (!entry) return null;

  const node = entry.kind === 'video' ? buildVideo(entry) : buildImage(entry);

  const wrap = el('figure', {
    class: `moment moment--${entry.size} ${className}`.trim(),
    'data-moment': slot,
  }, node);

  // The single most important line in this file: a decoration that
  // fails must vanish, not leave evidence.
  node.addEventListener('error', () => wrap.remove(), { once: true });

  observe(wrap, node, entry);
  return wrap;
}

function buildVideo(entry) {
  return el('video', {
    src: entry.src,
    muted: true,
    playsinline: true,
    preload: 'none',
    // Looping is managed by hand below so it can be stopped after
    // a set number of passes.
    'aria-hidden': 'true',
  });
}

function buildImage(entry) {
  const img = el('img', {
    src: entry.src,
    alt: '',
    loading: 'lazy',
    decoding: 'async',
    'aria-hidden': 'true',
  });

  // WebP with alpha is universal on current browsers, but if it
  // ever fails the PNG beside it takes over rather than the whole
  // element disappearing.
  if (entry.fallback) {
    img.addEventListener('error', function onErr() {
      img.removeEventListener('error', onErr);
      img.src = entry.fallback;
    }, { once: true });
  }
  return img;
}

/* ------------------------------------------------------------
   Load, play and stop by visibility.
   ------------------------------------------------------------ */
function observe(wrap, node, entry) {
  const reduced = prefersReducedMotion();

  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) {
      wrap.classList.add('is-in');
      if (node.tagName === 'VIDEO' && !reduced) play(node, entry);
    } else if (node.tagName === 'VIDEO') {
      node.pause();
    }
  }, { threshold: 0.25 });

  io.observe(wrap);
}

function play(video, entry) {
  if (!video.dataset.started) {
    video.load();
    video.dataset.started = '1';
    video.dataset.plays = '0';

    // Count passes and freeze on the last frame once the budget is
    // spent. `loops: 0` means run forever.
    video.addEventListener('ended', () => {
      const plays = Number(video.dataset.plays) + 1;
      video.dataset.plays = String(plays);

      if (entry.loops === 0 || plays < entry.loops) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        video.classList.add('is-frozen');
      }
    });
  }

  if (video.classList.contains('is-frozen')) return;
  video.play().catch(() => { /* autoplay refused: first frame stands in */ });
}

/* Append a moment to a host element, if the slot has anything. */
export function mountMoment(host, slot, opts) {
  if (!host) return null;
  const node = createMoment(slot, opts);
  if (node) host.append(node);
  return node;
}

/* Replace whatever moment a host already holds. Used by the game
   overlays, which show a different reaction for win and lose. */
export function swapMoment(host, slot, opts) {
  if (!host) return null;
  host.querySelectorAll('[data-moment]').forEach((n) => n.remove());
  return mountMoment(host, slot, opts);
}
