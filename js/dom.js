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
    else node.setAttribute(k, v === true ? '' : v);
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
export function loopVideo(src, { className = '' } = {}) {
  return el('video', {
    class: className,
    src: src.mp4,
    poster: src.poster,
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
