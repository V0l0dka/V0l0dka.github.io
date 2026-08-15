/* ============================================================
   MISSION 02 - DON'T CRASH

   Side-scrolling endurance run. The bike moves by itself, you
   only jump. Survive ~40 seconds.

   Deliberately not a physics simulation: one gravity constant,
   one jump impulse, axis-aligned box collision. The polish is in
   the camera shake, the dust and the parallax, not in the maths.
   ============================================================ */

import { createStage, Loop, createOverlay, autoPause, rand, loadSprite } from './engine.js';
import { sfx } from '../audio.js';
import { announce, prefersReducedMotion } from '../dom.js';
import { asset } from '../media-config.js';

const SURVIVE = 40;          // seconds to win
const GRAVITY = 2100;        // px/s²
const JUMP_V = -760;         // px/s, upward
const START_SPEED = 300;     // px/s
const MAX_SPEED = 690;

export function init(stageEl, hud) {
  const stage = createStage(stageEl);
  const overlay = createOverlay(stageEl, { startLabel: 'НАЧАТЬ' });

  // The real Light Bee X, cut out. The vector bike below stays as
  // the fallback: the game must be playable from the first frame,
  // before any image has arrived.
  const bike = loadSprite(asset('surronSilhouette'), stageEl);

  const state = {
    playing: false,
    t: 0,
    speed: START_SPEED,
    bikeY: 0,
    vy: 0,
    grounded: true,
    rot: 0,
    obstacles: [],
    dust: [],
    hills: [],
    nextGap: 0,
    shake: 0,
    crashed: false,
  };

  const paint = () => {
    hud.textContent = `${String(Math.round(state.speed / 4)).padStart(3, '0')} КМ/Ч`;
  };

  const groundY = () => stage.size.h * 0.78;
  const bikeX = () => Math.max(70, stage.size.w * 0.22);
  const BIKE_W = 62;
  const BIKE_H = 34;

  /* ---------- lifecycle ---------- */

  function reset() {
    state.t = 0;
    state.speed = START_SPEED;
    state.bikeY = 0;
    state.vy = 0;
    state.grounded = true;
    state.rot = 0;
    state.obstacles = [];
    state.dust = [];
    state.shake = 0;
    state.crashed = false;
    state.buffered = 0;
    state.nextGap = 1.1;
    // Parallax ridge line, regenerated per run.
    state.hills = Array.from({ length: 26 }, (_, i) => ({
      x: i * 90,
      h: rand(18, 62),
    }));
    paint();
  }

  function start() {
    reset();
    state.playing = true;
    overlay.hide();
    loop.start();
    announce('Поехали. Пробел или тап - прыжок.');
  }

  function finish(won) {
    state.playing = false;
    state.crashed = !won;
    won ? sfx.win() : sfx.crash();
    if (!won) state.shake = 1;

    overlay.show({
      verdict: won ? 'ну нормально' : 'зато красиво',
      tone: won ? 'win' : 'lose',
      label: 'ЕЩЁ РАЗ',
      hint: won ? '' : `${state.t.toFixed(1)} с из ${SURVIVE}`,
      moment: won ? 'surron-win' : 'surron-lose',
    });

    announce(won ? 'ну нормально' : 'зато красиво');
    document.dispatchEvent(new CustomEvent('game:end', {
      detail: { game: 'surron', won },
    }));
  }

  /* A press while already airborne is remembered briefly and fires
     the moment the wheels touch down. Without this buffer, pressing
     a few frames too early does nothing at all, which reads as the
     controls having ignored you - the single most common complaint
     about jump games. 140 ms is short enough that it never feels
     like the bike jumped on its own. */
  const JUMP_BUFFER = 0.14;

  function jump() {
    if (!state.playing) return;
    if (!state.grounded) { state.buffered = JUMP_BUFFER; return; }
    state.vy = JUMP_V;
    state.grounded = false;
    state.buffered = 0;
    sfx.jump();
  }

  /* ---------- simulation ---------- */

  function update(dt) {
    const { w } = stage.size;

    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2);

    if (!state.playing) {
      // Idle: keep the scenery drifting so the stage looks alive.
      for (const hill of state.hills) {
        hill.x -= 40 * dt;
        if (hill.x < -90) hill.x += 26 * 90;
      }
      return;
    }

    state.t += dt;
    state.speed = Math.min(MAX_SPEED, START_SPEED + state.t * 9.5);
    paint();

    if (state.t >= SURVIVE) return finish(true);

    // vertical
    state.vy += GRAVITY * dt;
    state.bikeY += state.vy * dt;

    if (state.bikeY >= 0) {
      state.bikeY = 0;
      if (!state.grounded) {
        state.grounded = true;
        spawnDust(10);
      }
      state.vy = 0;
    }

    // Spend a buffered press the instant the bike is back on the ground.
    if (state.buffered > 0) {
      state.buffered -= dt;
      if (state.grounded) jump();
    }

    // Nose-up in the air, level on the ground.
    const targetRot = state.grounded ? 0 : Math.max(-0.34, Math.min(0.34, state.vy / 2600));
    state.rot += (targetRot - state.rot) * Math.min(1, dt * 9);

    // scenery
    for (const hill of state.hills) {
      hill.x -= state.speed * 0.28 * dt;
      if (hill.x < -90) hill.x += 26 * 90;
    }

    // obstacles
    state.nextGap -= dt;
    if (state.nextGap <= 0) {
      const tall = Math.random() < 0.3;
      state.obstacles.push({
        x: w + 40,
        w: tall ? 16 : rand(20, 34),
        h: tall ? rand(46, 62) : rand(20, 34),
      });
      // The floor on this gap is a fairness rule, not a feel tweak.
      //
      // A jump lasts 2*JUMP_V/GRAVITY = ~0.72 s and cannot be
      // cancelled. If obstacles can arrive closer together than
      // that, the second one is already on top of you at the moment
      // you land, with no input that could have avoided it - the
      // run ends on a coin toss rather than a mistake.
      //
      // 0.95 s leaves roughly a quarter second on the ground between
      // clearing one and committing to the next.
      const airtime = (2 * Math.abs(JUMP_V)) / GRAVITY;
      state.nextGap = Math.max(airtime + 0.23, rand(220, 380) / state.speed * 2.6);
    }

    const bx = bikeX();
    const by = groundY() + state.bikeY - BIKE_H;

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const o = state.obstacles[i];
      o.x -= state.speed * dt;

      // Axis-aligned box overlap, with the box pulled in slightly so
      // a near miss reads as a near miss rather than a cheap hit.
      const pad = 6;
      const hit =
        bx + BIKE_W - pad > o.x &&
        bx + pad < o.x + o.w &&
        by + BIKE_H - pad > groundY() - o.h;

      if (hit) return finish(false);
      if (o.x + o.w < -40) state.obstacles.splice(i, 1);
    }

    if (state.grounded && Math.random() < dt * 14) spawnDust(1);

    for (let i = state.dust.length - 1; i >= 0; i--) {
      const d = state.dust[i];
      d.x -= (state.speed * 0.75 + d.drift) * dt;
      d.y += d.vy * dt;
      d.life -= dt * 1.5;
      if (d.life <= 0 || d.x < -20) state.dust.splice(i, 1);
    }
  }

  function spawnDust(n) {
    if (prefersReducedMotion()) return;
    const bx = bikeX();
    for (let i = 0; i < n; i++) {
      state.dust.push({
        x: bx + rand(-6, 18),
        y: groundY() - rand(0, 5),
        vy: rand(-26, -6),
        drift: rand(-30, 40),
        life: rand(0.35, 0.8),
        r: rand(1, 2.6),
      });
    }
  }

  /* ---------- drawing ---------- */

  function drawBike(ctx, x, y) {
    ctx.save();
    ctx.translate(x + BIKE_W / 2, y + BIKE_H / 2);
    ctx.rotate(state.rot);
    ctx.translate(-BIKE_W / 2, -BIKE_H / 2);

    if (bike.ready) {
      // Drawn from the photograph's own aspect ratio and anchored to
      // the bottom of the collision box, so the wheels sit on the
      // ground line no matter how tall the cut-out happens to be.
      const w = BIKE_W * 1.42;
      const h = w * (bike.img.height / bike.img.width);
      const ox = (BIKE_W - w) / 2;
      const oy = BIKE_H - h;

      /* The real Light Bee X is black, and so is this game. Dropped
         in untreated it disappeared completely - you could not see
         the thing you were steering. So it gets a ground light
         behind it and its brightness lifted. The photograph is
         still the photograph; it is just lit. */
      const gx = ox + w / 2;
      const gy = BIKE_H;
      const glow = ctx.createRadialGradient(gx, gy, 2, gx, gy, w * 0.72);
      glow.addColorStop(0, 'rgba(215,255,0,.34)');
      glow.addColorStop(1, 'rgba(215,255,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(ox - w * 0.3, oy, w * 1.6, h + 14);

      ctx.save();
      ctx.filter = state.crashed
        ? 'brightness(1.5) contrast(1.15) saturate(1.4)'
        : 'brightness(1.9) contrast(1.12)';
      ctx.drawImage(bike.img, ox, oy, w, h);
      ctx.restore();

      // Crash tints the bike without needing a second image.
      if (state.crashed) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,90,31,.5)';
        ctx.fillRect(ox, oy, w, h);
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    const wheelR = 11;

    ctx.strokeStyle = state.crashed ? '#FF5A1F' : '#F4F2ED';
    ctx.fillStyle = '#0d0d0d';
    ctx.lineWidth = 2;

    // wheels
    for (const wx of [wheelR + 1, BIKE_W - wheelR - 1]) {
      ctx.beginPath();
      ctx.arc(wx, BIKE_H - wheelR, wheelR, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }

    // frame - the Light Bee silhouette, reduced to its two triangles
    ctx.strokeStyle = '#D7FF00';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(wheelR + 1, BIKE_H - wheelR);
    ctx.lineTo(BIKE_W * 0.42, BIKE_H * 0.34);
    ctx.lineTo(BIKE_W - wheelR - 1, BIKE_H - wheelR);
    ctx.moveTo(BIKE_W * 0.42, BIKE_H * 0.34);
    ctx.lineTo(BIKE_W * 0.72, BIKE_H * 0.28);
    ctx.stroke();

    // seat + bars
    ctx.fillStyle = '#F4F2ED';
    ctx.fillRect(BIKE_W * 0.3, BIKE_H * 0.26, 20, 4);
    ctx.fillRect(BIKE_W * 0.74, BIKE_H * 0.12, 3, 12);

    ctx.restore();
  }

  function draw() {
    const { ctx } = stage;
    const { w, h } = stage.size;
    const gy = groundY();

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    if (state.shake > 0) {
      const s = state.shake * 7;
      ctx.translate(rand(-s, s), rand(-s, s));
    }

    // parallax ridge
    ctx.fillStyle = '#101010';
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (const hill of state.hills) {
      ctx.lineTo(hill.x, gy - hill.h);
      ctx.lineTo(hill.x + 45, gy - hill.h * 0.55);
    }
    ctx.lineTo(w, gy);
    ctx.closePath();
    ctx.fill();

    // ground
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy + 0.5);
    ctx.lineTo(w, gy + 0.5);
    ctx.stroke();

    // speed streaks
    if (state.playing && !prefersReducedMotion()) {
      ctx.strokeStyle = 'rgba(244,242,237,.07)';
      for (let i = 0; i < 5; i++) {
        const y = gy - 10 - i * 22 - (state.t * 40) % 22;
        ctx.beginPath();
        ctx.moveTo(w - ((state.t * state.speed * 1.4 + i * 160) % (w + 200)), y);
        ctx.lineTo(w - ((state.t * state.speed * 1.4 + i * 160) % (w + 200)) + 46, y);
        ctx.stroke();
      }
    }

    // obstacles
    for (const o of state.obstacles) {
      ctx.fillStyle = '#1c1c1c';
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(o.x, gy - o.h, o.w, o.h);
      ctx.strokeRect(o.x + .5, gy - o.h + .5, o.w - 1, o.h - 1);
    }

    // dust
    for (const d of state.dust) {
      ctx.globalAlpha = Math.max(0, d.life) * 0.5;
      ctx.fillStyle = '#8a8a80';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    drawBike(ctx, bikeX(), gy + state.bikeY - BIKE_H);

    // survival bar
    if (state.playing) {
      const pct = Math.min(1, state.t / SURVIVE);
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(16, h - 18, w - 32, 2);
      ctx.fillStyle = '#D7FF00';
      ctx.fillRect(16, h - 18, (w - 32) * pct, 2);
    }

    ctx.restore();
  }

  const loop = new Loop((dt) => { update(dt); draw(); });

  /* ---------- input ----------
     SPACE scrolls the page by default. It is only swallowed while
     a run is actually in progress, so the key still works normally
     everywhere else on the page. */

  const onKey = (e) => {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (!state.playing) return;
    e.preventDefault();
    jump();
  };

  const onPointerDown = (e) => {
    if (!state.playing) return;
    if (e.cancelable) e.preventDefault();
    jump();
  };

  document.addEventListener('keydown', onKey);
  stageEl.addEventListener('mousedown', onPointerDown);
  stageEl.addEventListener('touchstart', onPointerDown, { passive: false });

  overlay.button.addEventListener('click', () => { sfx.click(); start(); });
  overlay.show({ verdict: '', label: 'НАЧАТЬ', hint: 'пробел или тап - прыжок' });

  reset();
  stage.resize();
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
      document.removeEventListener('keydown', onKey);
      stageEl.removeEventListener('mousedown', onPointerDown);
      stageEl.removeEventListener('touchstart', onPointerDown);
      stage.destroy();
    },
  };
}
