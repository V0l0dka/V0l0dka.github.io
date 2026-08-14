/* ============================================================
   SHARED GAME ENGINE

   The three games have different rules but identical plumbing:
   a canvas sized to its stage, a frame loop, pointer input that
   works with both mouse and touch, and the discipline to stop
   running when nobody is looking at them.

   Nothing game-specific belongs in this file.
   ============================================================ */

import { prefersReducedMotion } from '../dom.js';

/* ------------------------------------------------------------
   Canvas sized in CSS pixels, backed at device resolution.

   Drawing code works in CSS pixels and never thinks about DPR;
   the context is pre-scaled. `size` is mutated in place on
   resize so a game can read stage.size.w at any time.
   ------------------------------------------------------------ */
export function createStage(stageEl) {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stageEl.append(canvas);

  const ctx = canvas.getContext('2d');
  const size = { w: 0, h: 0 };

  function resize() {
    const rect = stageEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    size.w = rect.width;
    size.h = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(stageEl);

  return { canvas, ctx, size, resize, destroy: () => { ro.disconnect(); canvas.remove(); } };
}

/* ------------------------------------------------------------
   Frame loop.

   dt is delta time in SECONDS, clamped. Without the clamp, a tab
   left in the background for a minute resumes with dt=60 and every
   moving object teleports through its collision checks.
   ------------------------------------------------------------ */
export class Loop {
  constructor(step) {
    this.step = step;
    this.raf = null;
    this.last = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      const dt = Math.min((now - this.last) / 1000, 1 / 20);
      this.last = now;
      this.step(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }
}

/* ------------------------------------------------------------
   Pointer input.

   Mouse and touch land in the same {x, y} in CSS pixels relative
   to the stage.

   touchmove is only swallowed while the game is actually running.
   Outside of that the page must scroll normally even with a finger
   on the canvas - a game that eats scrolling in the middle of a
   long editorial page is a trap, not a feature.
   ------------------------------------------------------------ */
export function createPointer(stageEl, isActive) {
  const pos = { x: 0, y: 0, active: false };

  const toLocal = (clientX, clientY) => {
    const r = stageEl.getBoundingClientRect();
    pos.x = clientX - r.left;
    pos.y = clientY - r.top;
    pos.active = true;
  };

  const onMouse = (e) => toLocal(e.clientX, e.clientY);

  const onTouch = (e) => {
    const t = e.touches[0] || e.changedTouches[0];
    if (!t) return;
    toLocal(t.clientX, t.clientY);
    // Only block the page scroll while play is in progress.
    if (isActive() && e.cancelable) e.preventDefault();
  };

  stageEl.addEventListener('mousemove', onMouse);
  stageEl.addEventListener('mouseleave', () => { pos.active = false; });
  stageEl.addEventListener('touchstart', onTouch, { passive: false });
  stageEl.addEventListener('touchmove', onTouch, { passive: false });

  return {
    pos,
    destroy() {
      stageEl.removeEventListener('mousemove', onMouse);
      stageEl.removeEventListener('touchstart', onTouch);
      stageEl.removeEventListener('touchmove', onTouch);
    },
  };
}

/* ------------------------------------------------------------
   Auto-pause.

   Stops the loop when the stage scrolls away or the tab is hidden.
   Three canvases animating forever down a 40 000 px page is the
   fastest way to make a phone hot.
   ------------------------------------------------------------ */
export function autoPause(stageEl, { onHide, onShow }) {
  const io = new IntersectionObserver(([entry]) => {
    entry.isIntersecting ? onShow?.() : onHide?.();
  }, { threshold: 0.15 });

  io.observe(stageEl);

  const onVis = () => { if (document.hidden) onHide?.(); };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
  };
}

/* ------------------------------------------------------------
   Shared chrome: the overlay that holds start/result/restart.

   Every game gets the same furniture so they read as one system
   rather than three separately-invented UIs.
   ------------------------------------------------------------ */
export function createOverlay(stageEl, { startLabel = 'НАЧАТЬ' } = {}) {
  const title = document.createElement('p');
  title.className = 'game__verdict';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn--acid game__btn';
  button.textContent = startLabel;

  const hint = document.createElement('p');
  hint.className = 'game__hint';

  const wrap = document.createElement('div');
  wrap.className = 'game__overlay';
  wrap.append(title, button, hint);
  stageEl.append(wrap);

  /* Pressing start always brings the whole stage into view first.
     The button can be clicked while the stage is only half on
     screen, which would begin a run with the playfield cut off -
     and the catcher lives at the very bottom of it.

     The target is computed rather than delegated to
     scrollIntoView({block:'center'}), which lands inconsistently
     on this page: it competes with the CSS smooth-scroll and with
     ScrollTrigger's pinned section further up. Plain arithmetic
     cannot be argued with. Registered here so it runs before the
     game's own start handler. */
  button.addEventListener('click', () => {
    const r = stageEl.getBoundingClientRect();
    const room = Math.max(12, (window.innerHeight - r.height) / 2);
    window.scrollTo({
      top: Math.max(0, window.scrollY + r.top - room),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  });

  /* The overlay being hidden IS the definition of "a run is in
     progress", so it owns the stage's playing class too. That
     keeps the cursor and touch-action rules from drifting out of
     sync with the actual game state. */
  return {
    node: wrap,
    button,
    show({ verdict = '', label = startLabel, tone = '', hint: hintText = '' } = {}) {
      title.textContent = verdict;
      title.className = `game__verdict${tone ? ` game__verdict--${tone}` : ''}`;
      button.textContent = label;
      hint.textContent = hintText;
      wrap.hidden = false;
      stageEl.classList.remove('is-playing');
    },
    hide() {
      wrap.hidden = true;
      stageEl.classList.add('is-playing');
    },
  };
}

export const reduced = prefersReducedMotion;

/* Random helper used by all three. */
export const rand = (min, max) => min + Math.random() * (max - min);
