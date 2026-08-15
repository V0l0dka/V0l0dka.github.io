/* ============================================================
   MISSION 03 - GO DEEPER

   A dark underwater scene. The pointer is a torch. Three objects
   are hidden in it and have to be found.

   The torch is a real mask, not a decoration: the scene is drawn,
   then everything outside the cone is painted back over with near
   black using destination-in compositing. Objects are genuinely
   invisible until the light reaches them, so it cannot be cheated
   by turning up screen brightness.
   ============================================================ */

import { createStage, Loop, createPointer, createOverlay, autoPause, rand, loadSprite } from './engine.js';
import { sfx } from '../audio.js';
import { announce, prefersReducedMotion } from '../dom.js';
import { asset } from '../media-config.js';

/* The three real objects. `sprite` is the cut-out photograph;
   `h` is its drawn height in CSS pixels, chosen per object so a
   can, a pair of keys and a pair of earrings read at plausible
   relative sizes underwater rather than all at one size. */
export const ITEMS = [
  { id: 'earring', label: 'серьёжка', media: 'earring', h: 76 },
  { id: 'revo', label: 'Revo', media: 'revo', h: 124 },
  { id: 'keys', label: 'ключи', media: 'keys', h: 86 },
];

const TORCH_R = 116;      // torch radius, CSS px
const FIND_R = 46;        // how close the centre must get

export function init(stageEl, hud) {
  const stage = createStage(stageEl);
  const overlay = createOverlay(stageEl, { startLabel: 'ПОГРУЖЕНИЕ' });
  const pointer = createPointer(stageEl, () => state.playing);

  // Scene is drawn here first, then masked onto the visible canvas.
  const buffer = document.createElement('canvas');
  const bctx = buffer.getContext('2d');

  // Second buffer, used to tint each object so it belongs to the
  // water. Drawing an object then compositing a blue wash over it
  // with source-atop keeps the wash inside the cut-out's alpha,
  // so it never spills into a rectangle around the shape.
  const tint = document.createElement('canvas');
  const tctx = tint.getContext('2d');

  const sprites = Object.fromEntries(
    ITEMS.map((item) => [item.id, loadSprite(asset(item.media), stageEl)]),
  );

  const state = {
    playing: false,
    found: new Set(),
    items: [],
    bubbles: [],
    t: 0,
    flash: 0,
    torch: { x: 0, y: 0 },
    done: false,
  };

  const paint = () => {
    hud.textContent = `${state.found.size} / ${ITEMS.length}`;
  };

  /* ---------- placement ---------- */

  function place() {
    const { w, h } = stage.size;
    // Spread across thirds so two never land on top of each other,
    // and keep clear of the edges where the torch cannot reach.
    state.items = ITEMS.map((item, i) => ({
      ...item,
      x: w * (0.2 + i * 0.3) + rand(-w * 0.06, w * 0.06),
      y: h * rand(0.32, 0.76),
      bob: rand(0, Math.PI * 2),
      tilt: rand(-0.5, 0.5),
    }));
  }

  function seedBubbles() {
    const { w, h } = stage.size;
    state.bubbles = Array.from({ length: prefersReducedMotion() ? 0 : 34 }, () => ({
      x: rand(0, w),
      y: rand(0, h),
      r: rand(1.2, 4.4),
      vy: rand(12, 40),
      drift: rand(-8, 8),
      a: rand(0.15, 0.5),
    }));
  }

  /* ---------- lifecycle ---------- */

  function reset() {
    state.found.clear();
    state.done = false;
    state.t = 0;
    state.flash = 0;
    place();
    seedBubbles();
    paint();
  }

  function start() {
    reset();
    state.playing = true;
    overlay.hide();
    loop.start();
    announce('Найдите три предмета фонариком.');
  }

  function finishAll() {
    state.playing = false;
    state.done = true;
    sfx.win();

    overlay.show({
      verdict: 'ВСЁ НАЙДЕНО',
      tone: 'win',
      label: 'ЕЩЁ РАЗ',
      hint: '',
    });

    announce('Всё найдено');
    // The chapter reacts to this: js/scroll.js lifts the section
    // back into the editorial style.
    document.dispatchEvent(new CustomEvent('game:end', {
      detail: { game: 'diving', won: true },
    }));
  }

  /* ---------- simulation ---------- */

  function update(dt) {
    const { w, h } = stage.size;
    state.t += dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);

    // Torch eases toward the pointer; idles in a slow drift so the
    // scene is not a dead black rectangle before you start.
    const tx = pointer.pos.active ? pointer.pos.x : w * (0.5 + Math.sin(state.t * 0.4) * 0.22);
    const ty = pointer.pos.active ? pointer.pos.y : h * (0.5 + Math.cos(state.t * 0.31) * 0.16);
    state.torch.x += (tx - state.torch.x) * Math.min(1, dt * 10);
    state.torch.y += (ty - state.torch.y) * Math.min(1, dt * 10);

    for (const b of state.bubbles) {
      b.y -= b.vy * dt;
      b.x += Math.sin(state.t + b.y * 0.02) * b.drift * dt;
      if (b.y < -8) { b.y = h + rand(0, 40); b.x = rand(0, w); }
    }

    if (!state.playing) return;

    for (const item of state.items) {
      if (state.found.has(item.id)) continue;
      const d = Math.hypot(item.x - state.torch.x, item.y - state.torch.y);
      if (d < FIND_R) {
        state.found.add(item.id);
        state.flash = 1;
        sfx.found();
        paint();
        announce(`Найдено: ${item.label}`);
        if (state.found.size === ITEMS.length) finishAll();
        return;
      }
    }
  }

  /* ---------- drawing ---------- */

  /* Draw one real object into the water.

     `lit` is how close the torch is, 0..1. It drives brightness and
     blue tint together: out of the beam an object is dim and almost
     the colour of the water, which is what makes it hard to spot;
     under the beam it warms up and becomes identifiable. That is
     the whole game, so it is a gradient rather than a switch. */
  function drawItem(ctx, item, lit, foundAlready) {
    const sprite = sprites[item.id];
    const y = item.y + Math.sin(state.t * 1.3 + item.bob) * 3;

    if (!sprite || !sprite.ready) {
      // Until the photograph arrives, a faint marker holds its place
      // so nothing pops or shifts when it loads.
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#7d97a8';
      ctx.lineWidth = 1;
      ctx.strokeRect(item.x - 14, y - 14, 28, 28);
      ctx.restore();
      return;
    }

    const img = sprite.img;
    const h = item.h;
    const w = h * (img.width / img.height);

    // Size the tint buffer to this object and paint it there first.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    tint.width = Math.max(1, Math.ceil(w * dpr));
    tint.height = Math.max(1, Math.ceil(h * dpr));
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);
    tctx.drawImage(img, 0, 0, w, h);

    /* Blue wash, kept inside the cut-out by source-atop.

       These numbers are the difference between a puzzle and a
       blank screen. The first pass was far too heavy: even under
       the beam the objects stayed the colour of the water and
       could not be identified. Out of the beam they should be
       shapes you might miss; under it they should be obviously a
       can, keys, earrings. */
    tctx.globalCompositeOperation = 'source-atop';
    tctx.fillStyle = `rgba(40, 110, 160, ${0.52 - lit * 0.44})`;
    tctx.fillRect(0, 0, w, h);

    // Acid confirmation once recovered.
    if (foundAlready) {
      tctx.fillStyle = 'rgba(215, 255, 0, .30)';
      tctx.fillRect(0, 0, w, h);
    }
    tctx.globalCompositeOperation = 'source-over';

    ctx.save();
    ctx.translate(item.x, y);

    // Objects sit slightly turned, as things do on a seabed.
    ctx.rotate(item.tilt);

    // A soft shadow under the object grounds it in the scene.
    ctx.globalAlpha = 0.3 + lit * 0.25;
    ctx.filter = 'blur(4px)';
    ctx.fillStyle = '#02080f';
    ctx.beginPath();
    ctx.ellipse(0, h * 0.42, w * 0.42, h * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.filter = 'none';

    // Slightly out of focus in the dark, sharp and lifted under the
    // beam - the object "comes into the light" rather than switching
    // on. brightness does the identifying work; blur does the hiding.
    ctx.globalAlpha = 0.72 + lit * 0.28;
    const blur = (1 - lit) * 1.1;
    ctx.filter = `blur(${blur.toFixed(2)}px) brightness(${(0.85 + lit * 0.75).toFixed(2)})`;
    ctx.drawImage(tint, -w / 2, -h / 2, w, h);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    if (foundAlready) {
      ctx.rotate(-item.tilt);
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

    // light rays from the surface
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

    // seabed
    bctx.fillStyle = '#04121f';
    bctx.beginPath();
    bctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) {
      bctx.lineTo(x, h - 26 - Math.sin(x * 0.012 + state.t * 0.15) * 9);
    }
    bctx.lineTo(w, h);
    bctx.closePath();
    bctx.fill();

    for (const item of state.items) {
      // 0 at the edge of the beam, 1 directly under it. Once the
      // round is over the whole scene is lit, so everything is
      // drawn sharp - the last look at the objects should not be
      // through the same murk that made them hard to find.
      const d = Math.hypot(item.x - state.torch.x, item.y - state.torch.y);
      const lit = state.done ? 1 : Math.max(0, Math.min(1, 1 - d / TORCH_R));
      drawItem(bctx, item, lit, state.found.has(item.id));
    }

    for (const b of state.bubbles) {
      bctx.globalAlpha = b.a;
      bctx.strokeStyle = '#bfe4ff';
      bctx.lineWidth = 1;
      bctx.beginPath(); bctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); bctx.stroke();
    }
    bctx.globalAlpha = 1;

    /* --- 2. punch the torch cone out of the buffer ---
       destination-in keeps only the pixels under the gradient, so
       everything outside the cone is genuinely erased rather than
       covered by a dark overlay that a screenshot could defeat. */

    bctx.globalCompositeOperation = 'destination-in';
    const r = TORCH_R * (state.done ? 6 : 1);
    const torch = bctx.createRadialGradient(
      state.torch.x, state.torch.y, 6,
      state.torch.x, state.torch.y, r,
    );
    torch.addColorStop(0, 'rgba(0,0,0,1)');
    torch.addColorStop(0.62, 'rgba(0,0,0,.92)');
    torch.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = torch;
    bctx.fillRect(0, 0, w, h);
    bctx.globalCompositeOperation = 'source-over';

    /* --- 3. deep water floor, then the masked scene on top --- */

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#030c16';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(buffer, 0, 0, w, h);

    // warm halo around the lamp itself
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createRadialGradient(
      state.torch.x, state.torch.y, 2, state.torch.x, state.torch.y, TORCH_R * 0.8);
    halo.addColorStop(0, `rgba(190,230,255,${0.16 + state.flash * 0.25})`);
    halo.addColorStop(1, 'rgba(190,230,255,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // found markers
    let i = 0;
    for (const item of ITEMS) {
      const got = state.found.has(item.id);
      ctx.fillStyle = got ? '#D7FF00' : '#1d3446';
      ctx.fillRect(16 + i * 12, 16, 6, 6);
      i += 1;
    }
  }

  const loop = new Loop((dt) => { update(dt); draw(); });

  overlay.button.addEventListener('click', () => { sfx.click(); start(); });
  overlay.show({ verdict: '', label: 'ПОГРУЖЕНИЕ', hint: 'ведите фонарём, найдите 3 предмета' });

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
      stage.destroy();
    },
  };
}
