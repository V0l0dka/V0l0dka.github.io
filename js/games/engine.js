/* ============================================================
   SHARED GAME ENGINE

   The three games have different rules but identical plumbing:
   a canvas sized to its stage, a frame loop, pointer input that
   works with both mouse and touch, and the discipline to stop
   running when nobody is looking at them.

   Nothing game-specific belongs in this file.
   ============================================================ */

import { prefersReducedMotion } from '../dom.js';
import { swapMoment } from '../media.js';

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
  /* `shouldRun` is an optional safety net, checked a few times a
     second rather than every frame.

     autoPause() below stops the loop the moment its observer says
     the stage has left the screen, and that is still the fast path.
     But IntersectionObserver only reports CHANGES, and when an
     element enters and leaves inside a single delivery the two
     events cancel out and nothing is reported at all. Scrolling
     briskly past three games in a row does exactly that, and the
     result was a 60 fps canvas loop still running - measured - with
     the game thirty thousand pixels off screen.

     Making the loop confirm for itself turns "should have been
     stopped" into "cannot stay running", and costs one
     getBoundingClientRect every half second. */
  constructor(step, { shouldRun = null } = {}) {
    this.step = step;
    this.shouldRun = shouldRun;
    this.raf = null;
    this.last = 0;
    this.frames = 0;
    this.running = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.frames = 0;

    const tick = (now) => {
      if (!this.running) return;

      if (this.shouldRun && ++this.frames % 30 === 0 && !this.shouldRun()) {
        this.stop();
        return;
      }

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

/* Is this element on screen, or close enough that it is about to be?
   The margin keeps a game running through small scroll adjustments
   instead of stopping and starting at the edge. */
export function nearViewport(el, margin = 200) {
  const r = el.getBoundingClientRect();
  return r.bottom > -margin && r.top < window.innerHeight + margin;
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

  // Reaction clip for the result. Empty on the start screen.
  const reaction = document.createElement('div');
  reaction.className = 'game__reaction';

  // Buttons are rebuilt on every show(), because a screen may need
  // one (НАЧАТЬ), or two (ПРОДОЛЖИТЬ / ЕЩЁ at fifty coals).
  const actions = document.createElement('div');
  actions.className = 'game__actions';

  const hint = document.createElement('p');
  hint.className = 'game__hint';

  const wrap = document.createElement('div');
  wrap.className = 'game__overlay';
  wrap.append(title, reaction, actions, hint);
  stageEl.append(wrap);

  /* Pressing a button that starts play always brings the whole stage
     into view first. It can be clicked while the stage is only half
     on screen, which would begin a run with the playfield cut off -
     and the catcher lives at the very bottom of it.

     The target is computed rather than delegated to
     scrollIntoView({block:'center'}), which lands inconsistently on
     this page: it competes with the CSS smooth-scroll and with
     ScrollTrigger's pinned section further up. Plain arithmetic
     cannot be argued with. */
  function centreStage() {
    const r = stageEl.getBoundingClientRect();
    const room = Math.max(12, (window.innerHeight - r.height) / 2);
    window.scrollTo({
      top: Math.max(0, window.scrollY + r.top - room),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }

  /* The overlay being hidden IS the definition of "a run is in
     progress", so it owns the stage's playing class too. That
     keeps the cursor and touch-action rules from drifting out of
     sync with the actual game state. */
  return {
    node: wrap,

    /* `moment` names a placement slot in js/media-config.js. It is
       swapped rather than appended, so the losing reaction never
       stacks under the winning one on a replay.

       `buttons` is [{ label, onClick, ghost, resumesPlay }]. A button
       with resumesPlay centres the stage before its handler runs. */
    show({
      verdict = '', tone = '', hint: hintText = '', moment = null,
      buttons = [{ label: startLabel, resumesPlay: true }],
    } = {}) {
      title.textContent = verdict;
      title.className = `game__verdict${tone ? ` game__verdict--${tone}` : ''}`;
      hint.textContent = hintText;
      swapMoment(reaction, moment);

      actions.replaceChildren();
      for (const spec of buttons) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `btn ${spec.ghost ? 'btn--ghost' : 'btn--acid'} game__btn`;
        b.textContent = spec.label;
        b.addEventListener('click', () => {
          if (spec.resumesPlay) centreStage();
          spec.onClick?.();
        });
        actions.append(b);
      }

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

/* ------------------------------------------------------------
   Load a cut-out for drawing into canvas.

   Takes an entry from js/media-config.js and tries its WebP,
   falling back to the PNG beside it. Returns an object whose
   `.ready` flips to true when the bitmap is usable, so a draw
   loop can start immediately and simply skip the image until it
   arrives - no waiting, and no crash if it never does.
   ------------------------------------------------------------ */
export function loadSprite(entry, nearEl = null) {
  const sprite = { img: null, ready: false };
  if (!entry || !entry.src) return sprite;

  const begin = () => {
    const img = new Image();
    img.decoding = 'async';

    img.addEventListener('load', () => {
      sprite.img = img;
      sprite.ready = true;
    });

    img.addEventListener('error', function onErr() {
      img.removeEventListener('error', onErr);
      if (entry.fallback && img.src !== entry.fallback) {
        img.src = entry.fallback;    // WebP refused - try the PNG
      }
    });

    img.src = entry.src;
  };

  /* The games sit ~28 000 px down the page, so their artwork has no
     business being on the critical path. Given a stage element, the
     fetch waits until the reader is within 800 px of it - far enough
     ahead that it is always decoded before anyone can press start,
     but off the initial load entirely. */
  if (!nearEl || typeof IntersectionObserver === 'undefined') {
    begin();
    return sprite;
  }

  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    begin();
  }, { rootMargin: '800px' });

  io.observe(nearEl);
  return sprite;
}
