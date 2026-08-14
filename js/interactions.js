/* ============================================================
   INTERACTIONS - chapters 01, 02, 08, 09 and the audio toggle.

   Everything here is discrete, event-driven behaviour. Anything
   driven by scroll position lives in js/scroll.js instead.
   ============================================================ */

import { $, $$, prefersReducedMotion, announce } from './dom.js';
import { mountMoment } from './media.js';
import { sfx } from './audio.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================================================
   01 - INTRO
   Fake load, then a deliberate failure, then the greeting.
   ============================================================ */

export async function initIntro() {
  const load = $('[data-intro-load]');
  const greet = $('[data-intro-greet]');
  const errorEl = $('[data-load-error]');
  const meters = $$('[data-meter]');

  const reduced = prefersReducedMotion();

  // With reduced motion the whole sequence still happens, just fast:
  // the joke is in the numbers, not in watching them tick.
  const speed = reduced ? 0.12 : 1;

  await wait(600 * speed);

  for (const meter of meters) {
    await runMeter(meter, speed);
  }

  await wait(500 * speed);
  errorEl.hidden = false;
  announce('ERROR: TOO MUCH');

  await wait(1400 * speed);
  load.hidden = true;
  greet.hidden = false;
  announce('С днём рождения, Мира');

  await wait(2200 * speed);

  // Hand the page back to the user.
  document.body.classList.remove('is-locked');
  document.dispatchEvent(new CustomEvent('intro:done'));
}

/* Count a meter up to its target. The bar is capped by the track's
   own overflow, so the 146% number runs past the end of its bar
   rather than the bar growing to fit - which is the point. */
function runMeter(meter, speed) {
  return new Promise((resolve) => {
    const target = Number(meter.dataset.target);
    const valEl = $('[data-meter-val]', meter);
    const fill = $('.meter__fill', meter);

    const duration = 700 * speed;
    const start = performance.now();

    function frame(now) {
      const t = Math.min((now - start) / duration, 1);
      // Ease out so it decelerates into its final number.
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(target * eased);

      valEl.textContent = `${value}%`;
      fill.style.width = `${Math.min(value, 100)}%`;

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

/* ============================================================
   02 - THE QUESTION
   НЕТ runs away, then gives up and admits the truth.
   ============================================================ */

const TAUNTS = [
  '',
  'серьёзно?',
  'серьёзно?',
  'у тебя нет выбора.',
  'у тебя нет выбора.',
  'ДА, Я ТИРАН.',
];

export function initQuestion() {
  const yes = $('[data-answer-yes]');
  const no = $('[data-answer-no]');
  const taunt = $('[data-taunt]');
  if (!yes || !no) return;

  let dodges = 0;
  const MAX_DODGES = 5;

  function dodge() {
    if (dodges >= MAX_DODGES) return;
    dodges += 1;

    taunt.textContent = TAUNTS[Math.min(dodges, TAUNTS.length - 1)];

    if (dodges >= MAX_DODGES) {
      // It stops running and disappears. Only ДА is left.
      no.classList.add('is-gone');
      no.disabled = true;
      no.setAttribute('aria-hidden', 'true');
      announce('Остался только один вариант: ДА');
      return;
    }

    jump();
  }

  /* Move to a random spot that is fully inside the viewport, with a
     margin so it can never end up half off-screen or under a phone's
     bottom bar. */
  function jump() {
    const pad = 16;
    const w = no.offsetWidth;
    const h = no.offsetHeight;

    const maxX = Math.max(pad, window.innerWidth - w - pad);
    const maxY = Math.max(pad, window.innerHeight - h - pad * 5);

    const x = pad + Math.random() * (maxX - pad);
    const y = pad + Math.random() * (maxY - pad);

    no.classList.add('is-loose');
    no.style.left = `${x}px`;
    no.style.top = `${y}px`;
  }

  // Desktop: flee when the pointer gets close, before it can be hit.
  no.addEventListener('mouseenter', dodge);

  document.addEventListener('mousemove', (e) => {
    if (dodges >= MAX_DODGES || !no.classList.contains('is-loose')) return;
    const r = no.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 120) dodge();
  });

  // Touch: there is no hover, so the tap itself is the trigger. The
  // button moves instead of activating, and never actually fires.
  no.addEventListener('touchstart', (e) => { e.preventDefault(); dodge(); }, { passive: false });

  // Keyboard users can reach it. Honouring the click would be a dead
  // end, so it dodges too - and after MAX_DODGES it is disabled, so
  // focus moves on naturally.
  no.addEventListener('click', (e) => { e.preventDefault(); dodge(); });

  yes.addEventListener('click', () => {
    document.getElementById('archive')?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  });

  // A resize can leave it parked outside the new viewport.
  window.addEventListener('resize', () => {
    if (no.classList.contains('is-loose') && dodges < MAX_DODGES) jump();
  });
}

/* ============================================================
   08 - GIFT
   ============================================================ */

export function initGift() {
  const panel = $('[data-gift-panel]');
  const equip = $('[data-gift-equip]');
  const armorClass = $('[data-gift-class]');
  const stats = $('[data-gift-stats]');
  const word = $('[data-gift-word]');
  const slot = $('[data-gift-slot]');
  if (!equip) return;

  // The armour class card is revealed on approach, before the
  // button is touched, so the sequence has a beat of its own.
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    mountMoment(slot, 'tmnt-hero', { className: 'moment--hero' });
    setTimeout(() => {
      armorClass.hidden = false;
      panel?.classList.add('is-armed');
    }, prefersReducedMotion() ? 0 : 500);
  }, { threshold: 0.4 });

  io.observe(panel || equip);

  equip.addEventListener('click', async () => {
    equip.disabled = true;
    sfx.equip();
    panel?.classList.add('is-equipped');
    mountMoment(slot, 'tmnt-armor', { className: 'moment--hero' });

    const beat = prefersReducedMotion() ? 40 : 520;

    await wait(beat);
    stats.hidden = false;
    announce('+100 ARMOR, +50 STYLE, +бесконечный CHAOS');

    await wait(beat * 1.6);
    word.hidden = false;
    announce('Подарок');
  });
}

/* ============================================================
   09 - FUTURE
   Lines light one after another as the chapter arrives.
   ============================================================ */

export function initFuture() {
  const items = $$('[data-future] .future__item');
  if (!items.length) return;

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      items.forEach((item, i) => {
        setTimeout(() => item.classList.add('is-lit'), prefersReducedMotion() ? 0 : i * 260);
      });
      io.disconnect();
    }
  }, { threshold: 0.4 });

  io.observe(items[0].parentElement);
}

/* ============================================================
   AUDIO
   Off by default. Nothing autoplays. The site is fully
   understandable with sound never switched on.
   ============================================================ */

export function initAudio() {
  const btn = $('[data-audio-toggle]');
  const icon = $('[data-audio-icon]');
  if (!btn) return;

  let on = false;

  btn.addEventListener('click', () => {
    on = !on;
    btn.setAttribute('aria-pressed', String(on));
    icon.textContent = on ? '♫' : '♪';
    document.dispatchEvent(new CustomEvent('audio:toggle', { detail: { on } }));
    announce(on ? 'Звук включён' : 'Звук выключен');
  });
}
