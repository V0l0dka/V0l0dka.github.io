/* ============================================================
   Shared DOM helpers. Imported by every module so none of them
   grow their own copy of the same three functions.
   ============================================================ */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* el('figure', {class: 'shot'}, child, child) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else {
      node.setAttribute(k, v === true ? '' : v);

      /* `muted` is the one attribute that does not do what it looks
         like it does. The content attribute reflects defaultMuted,
         and the spec only copies it into the muted PROPERTY when the
         element is created by the HTML parser. On an element built
         with createElement, setting the attribute afterwards leaves
         .muted === false - so Chrome's autoplay policy rejects
         play() with NotAllowedError and the clip silently never
         starts. Every video on this page is built here, so without
         this line none of them would ever play. */
      if (k === 'muted') node.muted = true;
    }
  }

  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c);
  }
  return node;
}

import { SIZES } from './asset-manifest.js';

/* The generated manifest is keyed by bare filename stem, so recover
   it from whichever path we were handed. */
const stemOf = (path) => path.split('/').pop().replace(/\.[^.]+$/, '');

/* width/height on the element are what let the browser reserve the
   right box before the file arrives. Without them a lazy-loaded
   image occupies nothing, then pops to full height on load and
   shoves the rest of the page down - which also invalidates every
   scroll trigger measured against the old height. */
function sizeAttrs(path) {
  const dims = SIZES[stemOf(path)];
  return dims ? { width: dims[0], height: dims[1] } : {};
}

/* Same thing for the two images that live in index.html rather than
   being built here (the 2026 reveal and the final portrait). */
export function applySize(img, path) {
  const dims = SIZES[stemOf(path)];
  if (!dims) return;
  img.width = dims[0];
  img.height = dims[1];
}

/* A <picture> that offers webp and falls back to jpg.
   Every still on the site goes through here, so the fallback can
   never be forgotten on one image and not another. */
export function picture(src, { alt = '', className = '', eager = false } = {}) {
  return el('picture', {},
    el('source', { srcset: src.webp, type: 'image/webp' }),
    el('img', {
      src: src.jpg,
      alt,
      class: className,
      loading: eager ? 'eager' : 'lazy',
      decoding: 'async',
      ...sizeAttrs(src.jpg),
    }),
  );
}

/* Muted, inline, looping video - the GIF-like background usage.
   preload="none" keeps it off the wire until it is near the screen;
   js/scroll.js starts and stops it by viewport intersection. */
/* ------------------------------------------------------------
   DEFERRED VIDEO

   Every looping clip on the page wants the same two-stage life:
   fetch it while it is still off screen, play it once it arrives,
   pause it when it leaves. The timing differs from plain lazy
   loading because "start downloading" and "start playing" are
   different moments - doing both at the same time is what made the
   reactions feel slow.

   prepareVideo() promotes the deferred poster to a real one and
   begins buffering. It is idempotent on purpose: load() resets the
   element and discards whatever it already has, so calling it twice
   would undo the head start it exists to create.
   ------------------------------------------------------------ */
export function prepareVideo(video) {
  if (!video || video.dataset.prepared) return;
  video.dataset.prepared = '1';

  if (video.dataset.poster) video.poster = video.dataset.poster;
  video.preload = 'auto';
  try { video.load(); } catch { /* nothing to recover from */ }
}

/* Fetch early, play in view, pause out of view. `margin` is how much
   warning the fetch gets - bigger for heavier files. */
export function autoplayInView(videos, { margin = '1200px 0px 1200px 0px' } = {}) {
  const list = [...videos];
  if (!list.length || typeof IntersectionObserver === 'undefined') return;

  const prepareIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      prepareIO.unobserve(e.target);
      prepareVideo(e.target);
    }
  }, { rootMargin: margin });

  const playIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        prepareVideo(v);                 // no-op if already prepared
        if (!prefersReducedMotion()) v.play().catch(() => { /* poster stands in */ });
      } else {
        v.pause();
      }
    }
  }, { threshold: 0.25 });

  for (const v of list) { prepareIO.observe(v); playIO.observe(v); }
}

export function loopVideo(src, { className = '' } = {}) {
  return el('video', {
    class: className,
    src: src.mp4,
    /* The poster is deliberately NOT set here. A `poster` attribute
       is fetched eagerly on first paint no matter what `preload`
       says, and these clips sit tens of thousands of pixels down the
       page - four posters were costing a quarter of the entire
       initial download for panels nobody had scrolled to yet.

       It is carried as data-poster and promoted to a real poster by
       the prepare pass in js/activities.js, which runs while the
       panel is still off screen. The width/height attributes below
       still reserve the box, so deferring it shifts no layout. */
    'data-poster': src.poster,
    muted: true,
    loop: true,
    playsinline: true,
    preload: 'none',
    'aria-hidden': 'true',
    ...sizeAttrs(src.mp4),
  });
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const announce = (msg) => {
  const live = $('[data-live]');
  if (live) live.textContent = msg;
};
