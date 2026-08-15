/* ============================================================
   ГЛУБЖЕ - underwater search

   A dark seabed. The pointer is a torch. Fifteen objects are
   scattered in it: five earrings, five Revo cans, five sets of
   keys. The torch reveals; a click or tap collects.

   The torch is a real mask, not a decoration: the scene is drawn
   into a buffer, then everything outside the cone is erased with
   destination-in compositing. Objects are genuinely absent until
   the light reaches them, so the puzzle cannot be defeated by
   turning up screen brightness.
   ============================================================ */

import {
  createStage, Loop, createPointer, createOverlay, autoPause, rand, loadSprite,
} from './engine.js';
import { sfx } from '../audio.js';
import { announce, prefersReducedMotion } from '../dom.js';
import { asset } from '../media-config.js';

/* Five of each. `baseH` is the drawn height in CSS pixels before
   per-object variation, chosen so a can, keys and earrings read at
   plausible relative sizes rather than all at one size. */
export const KINDS = [
  { id: 'earring', label: 'СЕРЁЖКИ', media: 'earring', count: 5, baseH: 62 },
  { id: 'revo', label: 'REVO', media: 'revo', count: 5, baseH: 96 },
  { id: 'keys', label: 'КЛЮЧИ', media: 'keys', count: 5, baseH: 70 },
];

export const TOTAL = KINDS.reduce((n, k) => n + k.count, 0);

const TORCH_R = 124;      // torch radius, CSS px
const MIN_HIT = 46;       // smallest tappable radius, CSS px
const DISTRACTORS = 7;

export function init(stageEl, hud) {
  const stage = createStage(stageEl);
  const overlay = createOverlay(stageEl, { startLabel: 'ПОГРУЖЕНИЕ' });
  const pointer = createPointer(stageEl, () => state.playing);

  // Scene buffer, masked by the torch before being shown.
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');

  // Per-object tint buffer. Drawing an object then compositing a
  // blue wash with source-atop keeps the wash inside the cut-out's
  // alpha, so it never spills into a rectangle around the shape.
  const tint = document.createElement('canvas');
  const tctx = tint.getContext('2d');

  const sprites = Object.fromEntries(
    KINDS.map((k) => [k.id, loadSprite(asset(k.media), stageEl)]),
  );

  const catEls = Object.fromEntries(
    KINDS.map((k) => [k.id, stageEl.querySelector(`[data-hud-cat="${k.id}"]`)]),
  );

  const state = {
    playing: false,
    items: [],
    debris: [],
    bubbles: [],
    t: 0,
    flash: 0,
    nudge: null,        // {x, y, life} - feedback for a wrong tap
    torch: { x: 0, y: 0 },
    done: false,
  };

  const foundCount = (id) => state.items.filter((i) => i.kind === id && i.found).length;
  const totalFound = () => state.items.filter((i) => i.found).length;

  function paint() {
    for (const k of KINDS) {
      if (catEls[k.id]) catEls[k.id].textContent = `${foundCount(k.id)} / ${k.count}`;
    }
    hud.textContent = `${totalFound()} / ${TOTAL}`;
  }

  /* ============================================================
     PLACEMENT

     Randomised every run, under rules that keep the scene fair:
     inside a margin, clear of the HUD, and never crowding another
     collectible. Without the spacing rule two objects land on top
     of each other and one becomes uncollectable.
     ============================================================ */

  function place() {
    const { w, h } = stage.size;

    const margin = Math.max(46, Math.min(w, h) * 0.09);
    // The HUD occupies the top-left. Nothing may spawn beneath it.
    const hudBox = { w: Math.min(w * 0.55, 240), h: 140 };
    const inHud = (x, y) => x < hudBox.w && y < hudBox.h;

    const placed = [];
    const MIN_GAP = Math.min(120, Math.max(74, Math.min(w, h) * 0.13));

    const spot = (minGap) => {
      // Bounded retry, then relax the spacing rather than loop for
      // ever on a small screen where the rule cannot be satisfied.
      for (let tries = 0; tries < 220; tries++) {
        const x = rand(margin, w - margin);
        const y = rand(margin, h - margin);
        if (inHud(x, y)) continue;
        if (placed.every((p) => Math.hypot(p.x - x, p.y - y) >= minGap)) {
          placed.push({ x, y });
          return { x, y };
        }
      }
      if (minGap > 40) return spot(minGap * 0.75);
      const fallback = { x: rand(margin, w - margin), y: rand(margin, h - margin) };
      placed.push(fallback);
      return fallback;
    };

    const items = [];
    for (const kind of KINDS) {
      for (let n = 0; n < kind.count; n++) {
        const { x, y } = spot(MIN_GAP);

        /* Variation, so five of the same object never read as five
           copies of one sprite. `depth` drives how dim and how soft
           an object is: far ones are genuinely harder to notice.
           The scale floor keeps even the smallest one findable. */
        items.push({
          kind: kind.id,
          label: kind.label,
          baseH: kind.baseH,
          x, y,
          scale: rand(0.62, 1.18),
          depth: rand(0, 1),
          tiltBase: rand(-0.55, 0.55),
          bob: rand(0, Math.PI * 2),
          bobAmp: rand(1.5, 4),
          found: false,
          pop: 0,
        });
      }
    }

    state.items = items;

    /* Environmental debris. Procedural shapes only - deliberately
       NOT the real Revo/keys/earring art, which would turn the
       search into a coin toss instead of a search. */
    state.debris = Array.from({ length: DISTRACTORS }, () => {
      const { x, y } = spot(MIN_GAP * 0.62);
      return {
        x, y,
        r: rand(13, 30),
        kind: Math.floor(rand(0, 3)),   // 0 stone, 1 shell, 2 bottle
        tilt: rand(-0.8, 0.8),
        depth: rand(0.3, 1),
      };
    });
  }

  function seedBubbles() {
    const { w, h } = stage.size;
    state.bubbles = Array.from({ length: prefersReducedMotion() ? 0 : 34 }, () => ({
      x: rand(0, w), y: rand(0, h),
      r: rand(1.2, 4.4), vy: rand(12, 40),
      drift: rand(-8, 8), a: rand(0.15, 0.5),
    }));
  }

  /* ---------- lifecycle ---------- */

  function reset() {
    state.done = false;
    state.t = 0;
    state.flash = 0;
    state.nudge = null;
    place();
    seedBubbles();
    paint();
  }

  function start() {
    reset();
    state.playing = true;
    overlay.hide();
    loop.start();
    announce(`Найдите ${TOTAL} предметов. Наведите фонарь и нажмите.`);
  }

  function finishAll() {
    state.playing = false;
    state.done = true;
    sfx.win();

    overlay.show({
      verdict: 'ВСЁ НАЙДЕНО',
      tone: 'win',
      buttons: [
        {
          label: 'ВСПЛЫТЬ ↑',
          onClick: () => document.dispatchEvent(
            new CustomEvent('game:leave', { detail: { game: 'diving' } })),
        },
        { label: 'ЕЩЁ РАЗ', ghost: true, resumesPlay: true, onClick: start },
      ],
    });

    announce('Всё найдено');
    // js/main.js listens and lifts the stage back into the editorial
    // palette; the games know nothing about the page.
    document.dispatchEvent(new CustomEvent('game:end', {
      detail: { game: 'diving', won: true },
    }));
  }

  /* ---------- geometry helpers ---------- */

  const drawnSize = (item) => {
    const sprite = sprites[item.kind];
    const h = item.baseH * item.scale;
    const ratio = sprite && sprite.ready ? sprite.img.width / sprite.img.height : 1;
    return { w: h * ratio, h };
  };

  const litness = (item) => {
    if (state.done) return 1;
    const d = Math.hypot(item.x - state.torch.x, item.y - state.torch.y);
    return Math.max(0, Math.min(1, 1 - d / TORCH_R));
  };

  /* ---------- collecting ---------- */

  function tap(x, y) {
    if (!state.playing) return;

    // Nearest first, so overlapping objects resolve predictably.
    const hit = state.items
      .filter((i) => !i.found)
      .map((i) => ({ i, d: Math.hypot(i.x - x, i.y - y) }))
      .filter(({ i, d }) => {
        const { w, h } = drawnSize(i);
        // The visual may be small; the hitbox never drops below a
        // comfortable thumb target.
        return d <= Math.max(MIN_HIT, Math.max(w, h) * 0.6);
      })
      .sort((a, b) => a.d - b.d)[0];

    if (hit) {
      // Only collectable once the torch is actually on it, otherwise
      // the game could be beaten by tapping blindly across the grid.
      if (litness(hit.i) < 0.18) { nudge(x, y); return; }

      hit.i.found = true;
      hit.i.pop = 1;
      state.flash = 1;
      sfx.found();
      paint();
      announce(`Найдено: ${hit.i.label}`);
      if (totalFound() === TOTAL) finishAll();
      return;
    }

    // Debris, or empty water. Never punished, just acknowledged.
    nudge(x, y);
  }

  function nudge(x, y) {
    state.nudge = { x, y, life: 1 };
    sfx.bubble();
  }

  /* ---------- simulation ---------- */

  function update(dt) {
    const { w, h } = stage.size;
    state.t += dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
    if (state.nudge) {
      state.nudge.life -= dt * 1.8;
      if (state.nudge.life <= 0) state.nudge = null;
    }

    // Torch eases toward the pointer; idles in a slow drift so the
    // scene is not a dead black rectangle before play starts.
    const tx = pointer.pos.active ? pointer.pos.x : w * (0.5 + Math.sin(state.t * 0.4) * 0.22);
    const ty = pointer.pos.active ? pointer.pos.y : h * (0.5 + Math.cos(state.t * 0.31) * 0.16);
    state.torch.x += (tx - state.torch.x) * Math.min(1, dt * 10);
    state.torch.y += (ty - state.torch.y) * Math.min(1, dt * 10);

    for (const b of state.bubbles) {
      b.y -= b.vy * dt;
      b.x += Math.sin(state.t + b.y * 0.02) * b.drift * dt;
      if (b.y < -8) { b.y = h + rand(0, 40); b.x = rand(0, w); }
    }

    for (const item of state.items) {
      if (item.pop > 0) item.pop = Math.max(0, item.pop - dt * 2);
    }
  }

  /* ---------- drawing ---------- */

  function drawDebris(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.tilt);
    ctx.globalAlpha = 0.22 + (1 - d.depth) * 0.3;
    ctx.fillStyle = '#0b2233';
    ctx.strokeStyle = '#12384d';
    ctx.lineWidth = 1.5;

    if (d.kind === 0) {
      ctx.beginPath();
      ctx.ellipse(0, 0, d.r, d.r * 0.68, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (d.kind === 1) {
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.8, Math.PI, 0);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(i * d.r * 0.3, -d.r * 0.75);
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.roundRect(-d.r * 0.32, -d.r * 0.5, d.r * 0.64, d.r * 1.1, 3);
      ctx.fill(); ctx.stroke();
      ctx.fillRect(-d.r * 0.12, -d.r * 0.85, d.r * 0.24, d.r * 0.4);
    }
    ctx.restore();
  }

  /* ---------- cached object layers ----------------------------
     Every object used to be re-tinted and re-blurred from scratch on
     every frame: one canvas reallocation plus two `ctx.filter` blur
     passes each, times twenty-two objects, sixty times a second.
     Canvas filters are rasterised on the CPU, so that was by far the
     most expensive thing on the page - the diving stage rendered
     roughly sixteen times slower per frame than the coal stage.

     Both layers are now drawn once into their own small canvas and
     reused. The shadow never changes at all. The body changes only
     when the beam crosses into a new light step, so the blur runs a
     handful of times per object for a whole dive instead of
     thousands. Opacity is still applied live at draw time, so the
     fade in and out of the torch stays perfectly smooth.

     PAD leaves room for the blur to bleed past the sprite instead of
     being clipped at the edge of the buffer. ---------------------- */
  const PAD = 12;
  const LIT_STEPS = 10;

  const layerCanvas = (w, h) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((w + PAD * 2) * dpr));
    c.height = Math.max(1, Math.ceil((h + PAD * 2) * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, g };
  };

  /* The sprite only settles on its final size once the image has
     loaded, so a cache built before that has to be thrown away. */
  const invalidate = (item, w) => {
    if (item.cacheW === w) return false;
    item.cacheW = w;
    item.shadowCv = null;
    item.bodyCv = null;
    item.bodyKey = '';
    return true;
  };

  function shadowLayer(item, w, h) {
    if (item.shadowCv) return item.shadowCv;
    const { c, g } = layerCanvas(w, h);
    g.filter = 'blur(4px)';
    g.fillStyle = '#02080f';
    g.beginPath();
    g.ellipse(PAD + w / 2, PAD + h / 2 + h * 0.42, w * 0.42, h * 0.10, 0, 0, Math.PI * 2);
    g.fill();
    item.shadowCv = c;
    return c;
  }

  function bodyLayer(item, w, h, lit) {
    // Quantise the light, then render with the quantised value so the
    // cached pixels always match the key they are stored under.
    const step = Math.round(lit * LIT_STEPS);
    const key = `${step}|${item.found ? 1 : 0}`;
    if (item.bodyCv && item.bodyKey === key) return item.bodyCv;

    const q = step / LIT_STEPS;
    const sprite = sprites[item.kind];

    if (!item.bodyCv) {
      const made = layerCanvas(w, h);
      item.bodyCv = made.c;
      item.bodyCtx = made.g;
    }
    const g = item.bodyCtx;
    g.clearRect(0, 0, w + PAD * 2, h + PAD * 2);

    // Wash the sprite in the shared tint buffer first. This buffer is
    // resized here rather than per frame, which is the point.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const tw = Math.max(1, Math.ceil(w * dpr));
    const th = Math.max(1, Math.ceil(h * dpr));
    if (tint.width !== tw || tint.height !== th) { tint.width = tw; tint.height = th; }
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(sprite.img, 0, 0, w, h);

    // Deeper objects sit further into the water colour, so five of
    // the same sprite do not all read at the same distance.
    tctx.globalCompositeOperation = 'source-atop';
    const wash = 0.42 + item.depth * 0.22 - q * 0.44;
    tctx.fillStyle = `rgba(40, 110, 160, ${Math.max(0, wash).toFixed(3)})`;
    tctx.fillRect(0, 0, w, h);

    if (item.found) {
      tctx.fillStyle = 'rgba(215, 255, 0, .30)';
      tctx.fillRect(0, 0, w, h);
    }
    tctx.globalCompositeOperation = 'source-over';

    const blur = (1 - q) * (0.8 + item.depth * 1.1);
    g.filter = `blur(${blur.toFixed(2)}px) brightness(${(0.8 + q * 0.8).toFixed(2)})`;
    g.drawImage(tint, PAD, PAD, w, h);
    g.filter = 'none';

    item.bodyKey = key;
    return item.bodyCv;
  }

  function drawItem(ctx, item) {
    const sprite = sprites[item.kind];
    const lit = litness(item);
    const { w, h } = drawnSize(item);
    const y = item.y + Math.sin(state.t * 1.3 + item.bob) * item.bobAmp;

    if (!sprite || !sprite.ready) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = '#7d97a8';
      ctx.lineWidth = 1;
      ctx.strokeRect(item.x - w / 2, y - h / 2, w, h);
      ctx.restore();
      return;
    }

    invalidate(item, w);
    const shadow = shadowLayer(item, w, h);
    const body = bodyLayer(item, w, h, lit);

    ctx.save();
    ctx.translate(item.x, y);
    ctx.rotate(item.tiltBase);
    if (item.pop > 0) ctx.scale(1 + item.pop * 0.16, 1 + item.pop * 0.16);

    // Shadow grounds it on the seabed. Opacity still tracks the beam
    // continuously - only the pixels are cached, not the fade.
    ctx.globalAlpha = (0.26 + lit * 0.24) * (1 - item.depth * 0.35);
    ctx.drawImage(shadow, -w / 2 - PAD, -h / 2 - PAD, w + PAD * 2, h + PAD * 2);

    // Out of focus in the dark, sharp and lifted under the beam.
    ctx.globalAlpha = (0.66 + lit * 0.34) * (1 - item.depth * 0.18);
    ctx.drawImage(body, -w / 2 - PAD, -h / 2 - PAD, w + PAD * 2, h + PAD * 2);
    ctx.globalAlpha = 1;

    if (item.found) {
      ctx.rotate(-item.tiltBase);
      ctx.fillStyle = '#D7FF00';
      ctx.font = '600 10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('НАЙДЕНО', 0, -h / 2 - 8);
    }

    ctx.restore();
  }

  function draw() {
    const { ctx, canvas } = stage;
    const { w, h } = stage.size;
    if (!w || !h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (buffer.width !== canvas.width || buffer.height !== canvas.height) {
      buffer.width = canvas.width;
      buffer.height = canvas.height;
    }
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, w, h);

    /* --- 1. the scene, fully lit, into the buffer --- */

    const water = bctx.createLinearGradient(0, 0, 0, h);
    water.addColorStop(0, '#0d3355');
    water.addColorStop(1, '#03101f');
    bctx.fillStyle = water;
    bctx.fillRect(0, 0, w, h);

    if (!prefersReducedMotion()) {
      bctx.save();
      bctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 5; i++) {
        const x = (w / 5) * i + Math.sin(state.t * 0.25 + i) * 26;
        const g = bctx.createLinearGradient(x, 0, x + 60, h);
        g.addColorStop(0, 'rgba(120,190,235,.085)');
        g.addColorStop(1, 'rgba(120,190,235,0)');
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.moveTo(x - 26, 0); bctx.lineTo(x + 26, 0);
        bctx.lineTo(x + 96, h); bctx.lineTo(x + 16, h);
        bctx.closePath(); bctx.fill();
      }
      bctx.restore();
    }

    bctx.fillStyle = '#04121f';
    bctx.beginPath();
    bctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) {
      bctx.lineTo(x, h - 26 - Math.sin(x * 0.012 + state.t * 0.15) * 9);
    }
    bctx.lineTo(w, h);
    bctx.closePath();
    bctx.fill();

    for (const d of state.debris) drawDebris(bctx, d);
    // Found objects last, so their acid marker is never hidden.
    for (const item of state.items) if (!item.found) drawItem(bctx, item);
    for (const item of state.items) if (item.found) drawItem(bctx, item);

    for (const b of state.bubbles) {
      bctx.globalAlpha = b.a;
      bctx.strokeStyle = '#bfe4ff';
      bctx.lineWidth = 1;
      bctx.beginPath(); bctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); bctx.stroke();
    }
    bctx.globalAlpha = 1;

    /* --- 2. punch the torch cone out of the buffer --- */

    bctx.globalCompositeOperation = 'destination-in';
    const r = TORCH_R * (state.done ? 6 : 1);
    const torch = bctx.createRadialGradient(
      state.torch.x, state.torch.y, 6, state.torch.x, state.torch.y, r);
    torch.addColorStop(0, 'rgba(0,0,0,1)');
    torch.addColorStop(0.62, 'rgba(0,0,0,.92)');
    torch.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = torch;
    bctx.fillRect(0, 0, w, h);
    bctx.globalCompositeOperation = 'source-over';

    /* --- 3. deep water, then the masked scene on top --- */

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#030c16';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(buffer, 0, 0, w, h);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(
      state.torch.x, state.torch.y, 2, state.torch.x, state.torch.y, TORCH_R * 0.8);
    halo.addColorStop(0, `rgba(190,230,255,${0.16 + state.flash * 0.25})`);
    halo.addColorStop(1, 'rgba(190,230,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // A wrong tap gets a small ring, not a penalty.
    if (state.nudge) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, state.nudge.life) * 0.5;
      ctx.strokeStyle = '#bfe4ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(state.nudge.x, state.nudge.y, (1 - state.nudge.life) * 26 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  const loop = new Loop((dt) => { update(dt); draw(); });

  /* ---------- input ----------
     Click and tap collect. touchend rather than touchstart, so a
     scroll gesture that happens to begin on the canvas is not
     mistaken for a collection attempt. */

  const localOf = (clientX, clientY) => {
    const r = stageEl.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  };

  const onClick = (e) => {
    if (!state.playing) return;
    const p = localOf(e.clientX, e.clientY);
    tap(p.x, p.y);
  };

  const onTouchEnd = (e) => {
    if (!state.playing) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const p = localOf(t.clientX, t.clientY);
    tap(p.x, p.y);
  };

  stageEl.addEventListener('click', onClick);
  stageEl.addEventListener('touchend', onTouchEnd);

  overlay.show({
    verdict: '',
    hint: `ведите фонарём, найдите ${TOTAL} предметов`,
    buttons: [{ label: 'ПОГРУЖЕНИЕ', resumesPlay: true, onClick: () => { sfx.click(); start(); } }],
  });

  reset();
  stage.resize();
  state.torch.x = stage.size.w / 2;
  state.torch.y = stage.size.h / 2;
  draw();

  const stopWatching = autoPause(stageEl, {
    onHide: () => loop.stop(),
    onShow: () => { if (!loop.running) loop.start(); },
  });

  loop.start();

  return {
    start,
    stop: () => loop.stop(),
    destroy() {
      loop.stop();
      stopWatching();
      pointer.destroy();
      stageEl.removeEventListener('click', onClick);
      stageEl.removeEventListener('touchend', onTouchEnd);
      stage.destroy();
    },
  };
}
