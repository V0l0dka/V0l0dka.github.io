/* ============================================================
   CATCH THE COAL

   A hookah stands in the middle of the stage. Coals fall. You move
   the tongs along the bottom and catch them.

   30 caught reaches the pause screen, and from there the reader can
   either carry on with the page or switch to endless mode. 3 missed
   loses. Coals get faster as you go, and from the second band cold
   stones fall among them: catching one costs 3 points, letting it
   land costs nothing.

   The hookah is the real supplied photograph, cut out so it stands
   on the game's own black. Everything around it - coals, sparks,
   smoke - stays procedural, which keeps the scene in the site's
   flat editorial language and means the only asset to load is one
   20 KB WebP.
   ============================================================ */

import { createStage, Loop, createPointer, createOverlay, autoPause, rand, loadSprite, nearViewport, mountBackground } from './engine.js';
import { sfx } from '../audio.js';
import { announce, prefersReducedMotion } from '../dom.js';
import { asset } from '../media-config.js';

const TARGET = 30;
const MAX_MISS = 3;
const BAD_PENALTY = 3;
const RECORD_KEY = 'mira.coal.record';

/* ------------------------------------------------------------
   DIFFICULTY

   One row per band of the run. `speed` multiplies the fall rate,
   `gap` is the seconds between spawns, `active` is how many objects
   may be in the air at once, `spread` widens the horizontal range
   they can appear across, and `bad` is the chance that any given
   spawn is a cold stone rather than a coal.

   Fifty was simply long. Thirty is the same arc compressed, and the
   interest that used to come from endurance now comes from having
   to decide what NOT to catch. The first ten stay deliberately
   comfortable and completely free of stones: the game has to teach
   what a coal looks like before it starts punishing you for
   grabbing the wrong thing.
   ------------------------------------------------------------ */
const BANDS = [
  { upTo: 10, speed: 1.00, gap: 1.15, active: 1, spread: 0.76, bad: 0.00 },
  { upTo: 20, speed: 1.22, gap: 0.95, active: 2, spread: 0.84, bad: 0.14 },
  { upTo: 25, speed: 1.45, gap: 0.78, active: 2, spread: 0.94, bad: 0.24 },
  { upTo: 30, speed: 1.68, gap: 0.66, active: 3, spread: 1.00, bad: 0.34 },
];

/* Past thirty the ramp keeps going, but gently and with floors, so
   endless mode stays physically playable rather than turning into a
   wall of falling rock. */
function difficulty(caught) {
  const band = BANDS.find((b) => caught < b.upTo);
  if (band) return band;

  const over = caught - TARGET;
  return {
    speed: Math.min(2.5, 1.68 + over * 0.011),
    gap: Math.max(0.42, 0.66 - over * 0.005),
    active: over > 30 ? 4 : 3,
    spread: 1,
    bad: Math.min(0.44, 0.34 + over * 0.002),
  };
}

/* ------------------------------------------------------------
   THE RECORD

   localStorage is wrapped because it throws rather than returning
   null in a few real situations - Safari private browsing, and any
   browser with site data blocked. A high score is not worth a
   broken game, so both directions fail silently.
   ------------------------------------------------------------ */
function readRecord() {
  try {
    const n = Number(localStorage.getItem(RECORD_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch { return 0; }
}

function writeRecord(n) {
  try { localStorage.setItem(RECORD_KEY, String(n)); } catch { /* not important */ }
}

export function init(stageEl, hud) {
  const stage = createStage(stageEl);
  stageEl.classList.add('game__stage--coal');
  mountBackground(stageEl, asset('bgCoal'));
  const overlay = createOverlay(stageEl, { startLabel: 'НАЧАТЬ' });
  const pointer = createPointer(stageEl, () => state.playing);

  // The real hookah photograph, cut out with a transparent
  // background so it stands on the game's own backdrop. Drawing
  // starts before it arrives and simply skips it until ready.
  const hookah = loadSprite(asset('hookah'), stageEl);

  const state = {
    playing: false,
    endless: false,       // set once ЕЩЁ is chosen at thirty
    record: readRecord(), // best endless run, survives a refresh
    caught: 0,
    missed: 0,
    coals: [],
    sparks: [],
    smoke: [],
    penalties: [],        // floating "−3" marks
    spawn: 0,
    tongsX: 0,
    glow: 0,
    sting: 0,             // red flash after catching a stone
    t: 0,
  };

  /* The HUD carries the record only in endless mode, where it is the
     only thing left to play for. In an ordinary run the target is
     the story and a second number just competes with it. */
  const recordEl = stageEl.querySelector('[data-coal-record]');

  const paint = () => {
    hud.textContent = state.endless
      ? String(state.caught)
      : `${String(state.caught).padStart(2, '0')} / ${TARGET}`;
    hud.classList.toggle('is-danger', state.missed >= MAX_MISS - 1);

    if (recordEl) {
      const show = state.endless && state.record > 0;
      recordEl.hidden = !show;
      if (show) recordEl.querySelector('[data-coal-record-value]').textContent = String(state.record);
    }
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
    state.penalties = [];
    state.spawn = 0;
    state.glow = 0;
    state.sting = 0;
    paint();
  }

  function start({ endless = false } = {}) {
    // Set the mode BEFORE reset(), because reset() repaints the HUD
    // and the HUD reads state.endless to decide whether to print the
    // "/ 30" denominator. The other order flashes "00 / 30" on the
    // first frame of a run that has no target.
    state.endless = endless;
    reset();
    state.playing = true;
    overlay.hide();
    loop.start();
    announce(endless ? 'Бесконечный режим.' : 'Ловите угли.');
  }

  /* Thirty reached. Play stops but the run is not over: the reader
     chooses whether to move on or keep going. This is a pause, not
     a result screen, so there is no reaction clip on it. */
  function reachTarget() {
    state.playing = false;
    sfx.win();

    overlay.show({
      verdict: '30.',
      tone: 'win',
      hint: 'ДОСТАТОЧНО. КАЛЬЯН УЖЕ МОЖНО ТОПИТЬ УГЛЁМ.',
      buttons: [
        { label: 'ПРОДОЛЖИТЬ →', onClick: () => leave(true) },
        { label: 'ЕЩЁ', ghost: true, resumesPlay: true, onClick: goEndless },
      ],
    });

    announce('Тридцать. Достаточно. Продолжить или ещё?');
  }

  function goEndless() {
    overlay.show({
      verdict: 'ЛАДНО.',
      hint: 'САМА ПОПРОСИЛА.',
      buttons: [{ label: 'ПОЕХАЛИ', resumesPlay: true, onClick: () => start({ endless: true }) }],
    });
  }

  /* Only endless runs set the record. An ordinary run stops at
     thirty by design, so counting it would peg the record at thirty
     forever and make the number meaningless. */
  function bankRecord() {
    if (!state.endless) return;
    if (state.caught <= state.record) return;
    state.record = state.caught;
    writeRecord(state.record);
    paint();     // so the new best is on screen, not only in storage
  }

  /* Lost. In endless mode the record is what matters; in the
     ordinary run it is progress towards thirty. */
  function lose() {
    state.playing = false;
    bankRecord();
    sfx.lose();

    overlay.show({
      verdict: 'УГОЛЬ ПОБЕДИЛ.',
      tone: 'lose',
      // Once there is a record it is the more interesting number, so
      // it wins. Before that, progress towards thirty is all there is
      // to report, and "РЕКОРД: 0" would say nothing.
      hint: state.record > 0
        ? `РЕКОРД: ${state.record}`
        : `поймано ${state.caught} из ${TARGET}`,
      moment: 'coal-lose',
      buttons: [
        { label: 'ЕЩЁ РАЗ', resumesPlay: true, onClick: () => start({ endless: state.endless }) },
        { label: 'ХВАТИТ С МЕНЯ →', ghost: true, onClick: () => leave(false) },
      ],
    });

    announce(`Уголь победил. Рекорд ${state.record}`);
  }

  /* Leave the game and let the page carry on with the story. The
     stage stops capturing input, so scrolling behaves normally
     again from this point. */
  function leave(won) {
    state.playing = false;
    bankRecord();
    loop.stop();

    overlay.show({
      verdict: '',
      hint: state.record ? `РЕКОРД: ${state.record}` : '',
      buttons: [{ label: 'СЫГРАТЬ ЕЩЁ', resumesPlay: true, onClick: () => start() }],
      moment: won ? 'coal-win' : null,
    });

    document.dispatchEvent(new CustomEvent('game:end', {
      detail: { game: 'coal', won, caught: state.caught, record: state.record },
    }));

    // `game:end` is the reporting event - other chapters listen to it
    // to react to a result. `game:leave` is the navigation event, and
    // it is what moves the reader to the next game. Both exits from
    // this screen (ПРОДОЛЖИТЬ and ХВАТИТ С МЕНЯ) mean "carry on with
    // the story", so both must fire it.
    document.dispatchEvent(new CustomEvent('game:leave', { detail: { game: 'coal' } }));
  }

  /* ---------- simulation ---------- */

  function spawnCoal() {
    const { w } = stage.size;
    const d = difficulty(state.caught);

    // Later bands use more of the stage width, so the tongs have to
    // travel further rather than only faster.
    const margin = w * (0.5 - 0.38 * d.spread);
    const bad = Math.random() < d.bad;

    state.coals.push({
      bad,
      x: rand(margin, w - margin),
      y: -20,
      // Stones read as heavier: bigger, blunter, and they fall a
      // little slower, which gives the eye time to reject them.
      r: bad ? rand(12, 16) : rand(9, 13),
      vy: rand(120, 165) * d.speed * (bad ? 0.88 : 1),
      spin: rand(-2, 2),
      angle: 0,
      // A fixed lumpy silhouette per stone, so they are not all the
      // same shape and none of them read as a circle.
      lumps: bad ? Array.from({ length: 7 }, () => rand(0.78, 1.22)) : null,
    });
  }

  /* A stone costs points, never the run. The brief was explicit that
     this must not feel like a trap: three points is enough to make
     you look before you move, and not enough to make you stop. */
  function grabStone(c) {
    state.caught = Math.max(0, state.caught - BAD_PENALTY);
    state.sting = 1;
    state.penalties.push({ x: c.x, y: c.y, life: 1 });
    sfx.miss();
    paint();
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

    // Spawn on a timer, but never exceed the band's allowance of
    // coals in the air. That cap is what makes "occasionally two"
    // mean occasionally two, rather than however many the timer
    // happens to have produced.
    const d = difficulty(state.caught);
    state.spawn -= dt;
    if (state.spawn <= 0 && state.coals.length < d.active) {
      spawnCoal();
      state.spawn = d.gap;
    }

    state.glow = Math.max(0, state.glow - dt * 3);
    state.sting = Math.max(0, state.sting - dt * 2.2);

    for (let i = state.penalties.length - 1; i >= 0; i--) {
      state.penalties[i].life -= dt * 1.1;
      if (state.penalties[i].life <= 0) state.penalties.splice(i, 1);
    }

    for (let i = state.coals.length - 1; i >= 0; i--) {
      const c = state.coals[i];
      c.y += c.vy * dt;
      c.angle += c.spin * dt;

      const atTongs = c.y + c.r >= L.floorY - L.tongsH && c.y - c.r <= L.floorY + L.tongsH;
      const overTongs = Math.abs(c.x - state.tongsX) <= L.tongsW / 2 + c.r * 0.6;

      if (atTongs && overTongs) {
        state.coals.splice(i, 1);

        if (c.bad) { grabStone(c); continue; }

        state.caught += 1;
        state.glow = 1;
        burst(c.x, c.y);
        sfx.catch();
        paint();
        // Thirty is a pause in the ordinary run and means nothing at
        // all once endless mode is on.
        if (!state.endless && state.caught >= TARGET) return reachTarget();
        continue;
      }

      if (c.y - c.r > h) {
        state.coals.splice(i, 1);
        // Letting a stone fall is the correct play, so it costs
        // nothing. Only dropped coal counts against you.
        if (c.bad) continue;

        state.missed += 1;
        sfx.miss();
        paint();
        if (state.missed >= MAX_MISS) return lose();
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

  /* A cold stone: irregular, grey-blue, matte, and deliberately
     lit from nowhere. Drawn as a lumpy polygon rather than a square
     so its silhouette alone already says "not a coal". */
  function drawStone(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle * 0.35);

    ctx.beginPath();
    const n = c.lumps.length;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = c.r * c.lumps[i];
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();

    ctx.fillStyle = '#5a6672';
    ctx.fill();

    // A single dull highlight on the upper left reads as stone
    // rather than as a hole in the background.
    ctx.fillStyle = 'rgba(160,175,190,.45)';
    ctx.beginPath();
    ctx.ellipse(-c.r * 0.22, -c.r * 0.3, c.r * 0.34, c.r * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#38424d';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
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

    /* Falling objects. The two kinds are built to be told apart at a
       glance and at arm's length on a phone: a coal is a small hot
       square that GLOWS, a stone is a bigger, cold, irregular lump
       with no light coming off it at all. Shape, size, colour and
       glow all disagree, so no single one of them has to carry it. */
    for (const c of state.coals) {
      if (c.bad) { drawStone(ctx, c); continue; }

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

    // "−3" rising from where the stone was grabbed.
    for (const p of state.penalties) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = '#FF4D4D';
      ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('−3', p.x, p.y - (1 - p.life) * 42);
      ctx.restore();
    }

    // A short red wash across the stage, so the mistake registers
    // even if the reader was looking at the tongs and not the sky.
    if (state.sting > 0) {
      ctx.fillStyle = `rgba(255,60,60,${(state.sting * 0.16).toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
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

  const loop = new Loop((dt) => { update(dt); draw(); },
    { shouldRun: () => nearViewport(stageEl) });

  /* ---------- wiring ---------- */

  overlay.show({
    verdict: '',
    hint: `поймайте ${TARGET} углей`,
    buttons: [{ label: 'НАЧАТЬ', resumesPlay: true, onClick: () => { sfx.click(); start(); } }],
  });

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
