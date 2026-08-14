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

import { createStage, Loop, createPointer, createOverlay, autoPause, rand } from './engine.js';
import { sfx } from '../audio.js';
import { announce, prefersReducedMotion } from '../dom.js';

export const ITEMS = [
  { id: 'earring', label: 'серьёжка' },
  { id: 'revo', label: 'Revo' },
  { id: 'keys', label: 'ключи' },
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
      verdict: 'ALL ITEMS RECOVERED',
      tone: 'win',
      label: 'ЕЩЁ РАЗ',
      hint: '',
    });

    announce('ALL ITEMS RECOVERED');
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
        announce(`FOUND: ${item.label}`);
        if (state.found.size === ITEMS.length) finishAll();
        return;
      }
    }
  }

  /* ---------- drawing ---------- */

  function drawItem(ctx, item, lit, foundAlready) {
    const y = item.y + Math.sin(state.t * 1.3 + item.bob) * 3;
    ctx.save();
    ctx.translate(item.x, y);

    const stroke = foundAlready ? '#D7FF00' : (lit ? '#cfe6f5' : '#7d97a8');
    ctx.strokeStyle = stroke;
    ctx.fillStyle = foundAlready ? 'rgba(215,255,0,.16)' : 'rgba(180,215,235,.10)';
    ctx.lineWidth = 2;

    if (item.id === 'earring') {
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 11, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (item.id === 'revo') {
      // dive light / torch body
      ctx.beginPath(); ctx.roundRect(-16, -7, 32, 14, 3); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(16, -5); ctx.lineTo(23, 0); ctx.lineTo(16, 5); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else {
      // keys on a ring
      ctx.beginPath(); ctx.arc(-7, 0, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(17, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(12, 6); ctx.moveTo(16, 0); ctx.lineTo(16, 5); ctx.stroke();
    }

    if (foundAlready) {
      ctx.fillStyle = '#D7FF00';
      ctx.font = '600 9px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('FOUND', 0, -18);
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
      const lit = Math.hypot(item.x - state.torch.x, item.y - state.torch.y) < TORCH_R;
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
  overlay.show({ verdict: '', label: 'ПОГРУЖЕНИЕ', hint: 'ведите фонарём — найдите 3 предмета' });

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
