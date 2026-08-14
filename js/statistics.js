/* ============================================================
   05 - STATISTICS

   Museum wall. Each figure counts up once when it arrives, and
   opens its detail in place when clicked - nothing navigates.
   ============================================================ */

import { $, el, prefersReducedMotion, announce } from './dom.js';
import { STATS } from './assets.js';
import { mountMoment } from './media.js';

export function buildStats() {
  const root = $('[data-stats]');
  if (!root) return;

  for (const stat of STATS) {
    root.append(buildStat(stat));
  }
}

function buildStat(stat) {
  const value = el('span', { class: 'stat__value' },
    el('span', { 'data-stat-num': true, text: isNumeric(stat) ? '0' : stat.value }),
    stat.plus ? el('span', { class: 'stat__plus', text: '+' }) : null,
  );

  const detail = el('p', { class: 'stat__detail', text: stat.detail || '' });

  const node = el('button', {
    class: 'stat',
    type: 'button',
    'data-stat': stat.id,
    'aria-expanded': 'false',
  },
    value,
    el('span', { class: 'stat__label', text: stat.label }),
    stat.note ? el('span', { class: 'stat__note', text: stat.note }) : null,
    detail,
  );

  node.addEventListener('click', () => toggle(node, stat));

  if (isNumeric(stat)) countUpWhenSeen(node, stat);
  if (stat.kind === 'infinite') runInfinite(node);

  return node;
}

const isNumeric = (stat) => /^\d+$/.test(stat.value);

function toggle(node, stat) {
  const open = node.classList.toggle('is-open');
  node.setAttribute('aria-expanded', String(open));

  if (open && stat.kind === 'particles') burst(node);
  if (open && stat.detail) announce(stat.detail);

  // The pulse trace appears under ТРАВМ the first time it is
  // opened, and is built only then - not on page load.
  if (open && stat.id === 'injuries' && !node.dataset.moment) {
    node.dataset.moment = '1';
    mountMoment($('.stat__detail', node), 'stat-injuries', { className: 'moment--trace' });
  }
}

/* Count from zero the first time the figure is scrolled to. */
function countUpWhenSeen(node, stat) {
  const target = Number(stat.value);
  const numEl = $('[data-stat-num]', node);

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      io.disconnect();

      if (prefersReducedMotion()) {
        numEl.textContent = String(target);
        return;
      }

      const duration = 1400;
      const start = performance.now();

      const frame = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        numEl.textContent = String(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }, { threshold: 0.5 });

  io.observe(node);
}

/* ∞ - the number of decisions never settles. */
function runInfinite(node) {
  const numEl = $('[data-stat-num]', node);
  if (prefersReducedMotion()) return;

  let shown = false;
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || shown) continue;
      shown = true;

      // Flick between ∞ and a running count, so it reads as a figure
      // that refuses to finish rather than a static glyph.
      let n = 0;
      setInterval(() => {
        n += Math.floor(Math.random() * 7) + 1;
        numEl.textContent = Math.random() < 0.25 ? '∞' : String(n);
      }, 420);
    }
  }, { threshold: 0.5 });

  io.observe(node);
}

/* 200+ EVENTS - a short particle scatter, drawn once on demand. */
function burst(node) {
  if (prefersReducedMotion()) return;
  if ($('canvas', node)) return;

  const canvas = el('canvas', { 'aria-hidden': 'true' });
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none',
  });

  node.style.position = 'relative';
  node.append(canvas);

  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const rect = node.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const parts = Array.from({ length: 200 }, () => ({
    x: rect.width / 2,
    y: rect.height / 2,
    vx: (Math.random() - 0.5) * 9,
    vy: (Math.random() - 0.5) * 9,
    life: 1,
  }));

  let raf;
  const tick = () => {
    ctx.clearRect(0, 0, rect.width, rect.height);
    let alive = false;

    for (const p of parts) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.98; p.vy *= 0.98;
      p.life -= 0.012;
      if (p.life <= 0) continue;
      alive = true;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = '#D7FF00';
      ctx.fillRect(p.x, p.y, 2, 2);
    }

    if (alive) raf = requestAnimationFrame(tick);
    else { cancelAnimationFrame(raf); canvas.remove(); }
  };
  tick();
}
