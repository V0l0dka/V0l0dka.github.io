/* ============================================================
   MISSION 01 - CATCH THE COAL

   A hookah stands in the middle of the stage. Coals fall. You move
   the tongs along the bottom and catch them.

   10 caught wins. 3 missed loses. Coals get faster as you go.

   The hookah is the real supplied photograph, cut out so it stands
   on the game's own black. Everything around it - coals, sparks,
   smoke - stays procedural, which keeps the scene in the site's
   flat editorial language and means the only asset to load is one
   20 KB WebP.
   ============================================================ */

import { createStage, Loop, createPointer, createOverlay, autoPause, rand, loadSprite } from './engine.js';
import { sfx } from '../audio.js';
import { announce, prefersReducedMotion } from '../dom.js';
import { asset } from '../media-config.js';

const TARGET = 10;
const MAX_MISS = 3;

export function init(stageEl, hud) {
  const stage = createStage(stageEl);
  const overlay = createOverlay(stageEl, { startLabel: 'НАЧАТЬ' });
  const pointer = createPointer(stageEl, () => state.playing);

  // The real hookah photograph, cut out with a transparent
  // background so it stands on the game's own backdrop. Drawing
  // starts before it arrives and simply skips it until ready.
  const hookah = loadSprite(asset('hookah'), stageEl);

  const state = {
    playing: false,
    caught: 0,
    missed: 0,
    coals: [],
    sparks: [],
    smoke: [],
    spawn: 0,
    tongsX: 0,
    glow: 0,
    t: 0,
  };

  const paint = () => {
    hud.textContent = `${String(state.caught).padStart(2, '0')} / ${TARGET}`;
    hud.classList.toggle('is-danger', state.missed >= MAX_MISS - 1);
  };

  /* ---------- geometry ---------- */

  const layout = () => {
    const { w, h } = stage.size;
    // The hookah is drawn from its own aspect ratio so it is never
    // stretched, and sized off the stage height so it stays in
    // proportion on a phone as well as a desktop.
    const hookahH = h * 0.62;
    const ratio = hookah.ready ? hookah.img.width / hookah.img.height : 525 / 752;
    const hookahW = hookahH * ratio;

    return {
      floorY: h * 0.88,
      hookahX: w / 2,
      hookahW,
      hookahH,
      hookahTopY: h * 0.88 - hookahH,     // where the coal bowl sits
      tongsW: Math.max(64, w * 0.12),
      tongsH: 10,
    };
  };

  /* ---------- lifecycle ---------- */

  function reset() {
    state.caught = 0;
    state.missed = 0;
    state.coals = [];
    state.sparks = [];
    state.smoke = [];
    state.spawn = 0;
    state.glow = 0;
    paint();
  }

  function start() {
    reset();
    state.playing = true;
    overlay.hide();
    loop.start();
    announce('Игра началась. Ловите угли.');
  }

  function finish(won) {
    state.playing = false;
    won ? sfx.win() : sfx.lose();

    overlay.show({
      verdict: won ? 'ПРОФЕССИОНАЛ' : 'УГОЛЬ ПОБЕДИЛ',
      tone: won ? 'win' : 'lose',
      label: 'ЕЩЁ РАЗ',
      hint: won ? '' : `поймано ${state.caught} из ${TARGET}`,
      moment: won ? 'coal-win' : 'coal-lose',
    });

    announce(won ? 'Профессионал' : 'Уголь победил');
    document.dispatchEvent(new CustomEvent('game:end', {
      detail: { game: 'coal', won },
    }));
  }

  /* ---------- simulation ---------- */

  function spawnCoal() {
    const { w } = stage.size;
    // Speed climbs with score, so the last coals are genuinely
    // harder than the first without ever becoming unreadable.
    const difficulty = state.caught / TARGET;
    const margin = w * 0.12;

    state.coals.push({
      x: rand(margin, w - margin),
      y: -20,
      r: rand(9, 13),
      vy: rand(120, 165) * (1 + difficulty * 0.85),
      spin: rand(-2, 2),
      angle: 0,
    });
  }

  function update(dt) {
    const { w, h } = stage.size;
    const L = layout();

    state.t += dt;
    updateSmoke(dt, L);

    // Tongs follow the pointer, easing rather than snapping.
    const targetX = pointer.pos.active ? pointer.pos.x : w / 2;
    state.tongsX += (targetX - state.tongsX) * Math.min(1, dt * 14);
    state.tongsX = Math.max(L.tongsW / 2, Math.min(w - L.tongsW / 2, state.tongsX));

    if (!state.playing) return;

    state.spawn -= dt;
    if (state.spawn <= 0) {
      spawnCoal();
      state.spawn = Math.max(0.42, 1.15 - (state.caught / TARGET) * 0.6);
    }

    state.glow = Math.max(0, state.glow - dt * 3);

    for (let i = state.coals.length - 1; i >= 0; i--) {
      const c = state.coals[i];
      c.y += c.vy * dt;
      c.angle += c.spin * dt;

      const atTongs = c.y + c.r >= L.floorY - L.tongsH && c.y - c.r <= L.floorY + L.tongsH;
      const overTongs = Math.abs(c.x - state.tongsX) <= L.tongsW / 2 + c.r * 0.6;

      if (atTongs && overTongs) {
        state.coals.splice(i, 1);
        state.caught += 1;
        state.glow = 1;
        burst(c.x, c.y);
        sfx.catch();
        paint();
        if (state.caught >= TARGET) return finish(true);
        continue;
      }

      if (c.y - c.r > h) {
        state.coals.splice(i, 1);
        state.missed += 1;
        sfx.miss();
        paint();
        if (state.missed >= MAX_MISS) return finish(false);
      }
    }

    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const s = state.sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
      s.life -= dt * 1.7;
      if (s.life <= 0) state.sparks.splice(i, 1);
    }
  }

  function burst(x, y) {
    if (prefersReducedMotion()) return;
    for (let i = 0; i < 14; i++) {
      state.sparks.push({
        x, y,
        vx: rand(-130, 130),
        vy: rand(-160, 20),
        life: rand(0.4, 0.9),
      });
    }
  }

  /* ---------- drawing ---------- */

  /* The real photograph, drawn from its own aspect ratio. Until it
     loads, a single stem line stands in so the stage is never an
     empty rectangle - no placeholder box, no layout jump. */
  function drawHookah(ctx, L) {
    const x = L.hookahX;

    if (hookah.ready) {
      ctx.save();
      // Sunk slightly into the site's black so a bright product
      // render does not sit on the page like a sticker.
      ctx.globalAlpha = 0.96;
      ctx.drawImage(hookah.img, x - L.hookahW / 2, L.hookahTopY, L.hookahW, L.hookahH);
      ctx.restore();
    } else {
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, L.hookahTopY + 20);
      ctx.lineTo(x, L.floorY - 10);
      ctx.stroke();
    }

    // The bowl warms up briefly on every catch.
    if (state.glow > 0) {
      const bowlY = L.hookahTopY + L.hookahH * 0.08;
      const g = ctx.createRadialGradient(x, bowlY, 2, x, bowlY, 90);
      g.addColorStop(0, `rgba(255,90,31,${0.55 * state.glow})`);
      g.addColorStop(1, 'rgba(255,90,31,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 90, bowlY - 90, 180, 180);
    }
  }

  /* Smoke is procedural: soft circles that rise, spread and fade.
     Cheap, and it reacts to play - the bowl puffs harder for a
     moment after every catch. */
  function updateSmoke(dt, L) {
    if (prefersReducedMotion()) return;

    const rate = 5 + state.glow * 34;
    if (Math.random() < dt * rate) {
      state.smoke.push({
        x: L.hookahX + rand(-6, 6),
        y: L.hookahTopY + L.hookahH * 0.06,
        r: rand(5, 11),
        vy: rand(-26, -13),
        drift: rand(-11, 11),
        life: 1,
      });
    }

    for (let i = state.smoke.length - 1; i >= 0; i--) {
      const s = state.smoke[i];
      s.y += s.vy * dt;
      s.x += s.drift * dt;
      s.r += 15 * dt;             // spreads as it rises
      s.life -= dt * 0.42;
      if (s.life <= 0) state.smoke.splice(i, 1);
    }
  }

  function drawSmoke(ctx) {
    for (const s of state.smoke) {
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      g.addColorStop(0, `rgba(220,220,220,${0.1 * s.life})`);
      g.addColorStop(1, 'rgba(220,220,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function draw() {
    const { ctx } = stage;
    const { w, h } = stage.size;
    const L = layout();

    ctx.clearRect(0, 0, w, h);

    // floor line
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, L.floorY + 10);
    ctx.lineTo(w, L.floorY + 10);
    ctx.stroke();

    drawHookah(ctx, L);
    drawSmoke(ctx);

    // coals
    for (const c of state.coals) {
      const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, c.r * 2.4);
      g.addColorStop(0, 'rgba(255,120,40,.55)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r * 2.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = '#FF5A1F';
      ctx.fillRect(-c.r * 0.72, -c.r * 0.72, c.r * 1.44, c.r * 1.44);
      ctx.fillStyle = 'rgba(255,220,180,.85)';
      ctx.fillRect(-c.r * 0.28, -c.r * 0.28, c.r * 0.56, c.r * 0.56);
      ctx.restore();
    }

    // sparks
    for (const s of state.sparks) {
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = '#FF8A3D';
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    // tongs
    ctx.fillStyle = '#D7FF00';
    ctx.fillRect(state.tongsX - L.tongsW / 2, L.floorY, L.tongsW, L.tongsH);
    ctx.fillRect(state.tongsX - L.tongsW / 2, L.floorY - 8, 3, 8);
    ctx.fillRect(state.tongsX + L.tongsW / 2 - 3, L.floorY - 8, 3, 8);

    // remaining lives
    for (let i = 0; i < MAX_MISS; i++) {
      ctx.fillStyle = i < MAX_MISS - state.missed ? '#D7FF00' : '#2a2a2a';
      ctx.fillRect(w - 20 - i * 12, 16, 6, 6);
    }
  }

  const loop = new Loop((dt) => { update(dt); draw(); });

  /* ---------- wiring ---------- */

  overlay.button.addEventListener('click', () => { sfx.click(); start(); });
  overlay.show({ verdict: '', label: 'НАЧАТЬ', hint: 'поймайте 10 углей' });

  // Draw one idle frame so the stage is never an empty box.
  stage.resize();
  draw();

  const stopWatching = autoPause(stageEl, {
    onHide: () => loop.stop(),
    onShow: () => { if (!loop.running) loop.start(); },
  });

  loop.start();
  paint();

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
