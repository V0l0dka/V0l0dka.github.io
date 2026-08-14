/* ============================================================
   EXTERNAL MEDIA

   Central registry for the small "easter egg" moments dotted
   through the page. Every one of them is declared here and
   nowhere else, so swapping a clip is a one-line edit.

   Three rules this file enforces:

   1. NOTHING IS HOTLINKED. Every `src` is a local path under
      /assets/external/. A remote GIF can vanish, get rate
      limited, change to something else entirely, or leak the
      visitor's IP to a third party.

   2. A MISSING FILE IS NOT AN ERROR. Slots below can point at
      files that do not exist yet. The element removes itself on
      the error event, leaving no gap and no broken-image icon.
      That means you can drop a file in later and it just starts
      appearing.

   3. NOTHING LOADS UNTIL IT IS NEEDED. Video is preload="none"
      and only begins buffering when it scrolls into view; it
      pauses again on the way out. Images are loading="lazy".

   ------------------------------------------------------------
   ON COPYRIGHT

   The brief asked for TMNT imagery and reaction GIFs from GIPHY
   or Tenor. Those are other people's work, and this site is
   public, so re-hosting them here is redistribution rather than
   private use. The slots are wired and waiting; put files in
   only where you hold the rights or the licence allows it.

   What ships now is generated in tools/build-external.sh:
   original noise and glitch loops, no third-party material.
   ------------------------------------------------------------ */

import { el } from './dom.js';

const DIR = '/assets/external';

/* `kind` is 'video' or 'image'. Video is strongly preferred:
   an MP4 of the same clip is routinely 5-10x smaller than the
   GIF, and it is decoded by the GPU instead of frame-by-frame
   on the CPU. Convert GIFs before adding them - the command is
   in assets/external/README.md. */
export const MEDIA = {
  /* archive, after "появляется тяга к СВО" */
  'archive-2022': null,

  /* 2024 - the corrupted archive */
  'void-2024': { kind: 'video', src: `${DIR}/reactions/static.mp4`, label: 'помехи' },

  /* 2025 - ERROR 404 */
  'void-2025': { kind: 'video', src: `${DIR}/reactions/glitch.mp4`, label: 'сбой' },

  /* statistics, under 60+ ТРАВМ */
  'stat-injuries': { kind: 'video', src: `${DIR}/reactions/pulse.mp4`, label: 'пульс' },

  /* game results */
  'game-win': null,
  'game-lose': null,

  /* chapter 08 */
  'tmnt-hero': null,
  'tmnt-armor': null,
};

/* ------------------------------------------------------------
   Build one moment. Returns null when the slot is empty, so the
   caller can simply skip it.
   ------------------------------------------------------------ */
export function createMoment(key, { className = '' } = {}) {
  const entry = MEDIA[key];
  if (!entry || !entry.src) return null;

  const node = entry.kind === 'video'
    ? el('video', {
        src: entry.src,
        muted: true,
        loop: true,
        playsinline: true,
        preload: 'none',
        'aria-hidden': 'true',
      })
    : el('img', {
        src: entry.src,
        alt: entry.label || '',
        loading: 'lazy',
        decoding: 'async',
      });

  const wrap = el('figure', { class: `moment ${className}`.trim(), 'data-moment': key }, node);

  // A slot that points at a file which is not there yet simply
  // disappears rather than leaving a hole in the layout.
  node.addEventListener('error', () => wrap.remove(), { once: true });

  if (entry.kind === 'video') watch(node);

  return wrap;
}

/* Start buffering only on approach; pause on the way out. Without
   this every clip on a 40 000 px page decodes continuously. */
function watch(video) {
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!video.dataset.started) {
        video.load();
        video.dataset.started = '1';
      }
      video.play().catch(() => { /* refused autoplay: first frame stands in */ });
    } else {
      video.pause();
    }
  }, { threshold: 0.2 });

  io.observe(video);
}

/* Convenience: append a moment to a host element if it exists. */
export function mountMoment(host, key, opts) {
  if (!host) return null;
  const node = createMoment(key, opts);
  if (node) host.append(node);
  return node;
}
