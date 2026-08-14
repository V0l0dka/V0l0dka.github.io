/* ============================================================
   SCROLL - all GSAP/ScrollTrigger wiring in one place.

   Chapter modules build DOM and handle clicks. Nothing outside
   this file knows GSAP exists, so the animation library can be
   swapped or dropped without touching chapter logic.

   Under prefers-reduced-motion this module registers nothing at
   all: the page becomes an ordinary scroll, fully readable.
   ============================================================ */

import { $, $$, prefersReducedMotion } from './dom.js';

/* Reusable helpers, so the same three-line fade is not written
   fifteen times with slightly different numbers. */
const fadeUp = (targets, opts = {}) => ({
  opacity: 0,
  y: 40,
  duration: 0.9,
  ease: 'power3.out',
  ...opts,
});

export function initScroll() {
  const { gsap } = window;

  // GSAP is vendored locally, but if the file is ever missing the
  // page must still work rather than throw on the first line.
  if (!gsap || !window.ScrollTrigger) {
    console.warn('GSAP missing - continuing without scroll animation.');
    showEverything();
    return;
  }

  gsap.registerPlugin(window.ScrollTrigger);

  if (prefersReducedMotion()) {
    showEverything();
    scrollProgress();
    return;
  }

  revealOnScroll(gsap);
  archiveParallax(gsap);
  reveal2026(gsap);
  outroLines(gsap);
  activityMotion(gsap);
  statsEntrance(gsap);
  scrollProgress();

  // Late-loading images change the page height; without this the
  // triggers stay pinned to stale positions.
  window.addEventListener('load', () => window.ScrollTrigger.refresh());
}

/* Anything not animated is simply visible. */
function showEverything() {
  $$('[data-reveal-on-scroll]').forEach((node) => {
    node.style.opacity = '1';
    node.style.transform = 'none';
  });
}

/* ---------- generic reveal --------------------------------- */

function revealOnScroll(gsap) {
  for (const node of $$('[data-reveal-on-scroll]')) {
    gsap.from(node, {
      ...fadeUp(node),
      scrollTrigger: { trigger: node, start: 'top 88%', once: true },
    });
  }
}

/* ---------- 03 archive -------------------------------------
   Photographs drift at slightly different speeds so a year band
   never moves as one flat block.
   ------------------------------------------------------------ */

function archiveParallax(gsap) {
  for (const year of $$('.year')) {
    const shots = $$('.shot', year);

    shots.forEach((shot, i) => {
      // Alternating depth: some lag behind the scroll, some lead.
      const depth = i % 2 === 0 ? -60 : 40;

      gsap.to(shot, {
        y: depth,
        ease: 'none',
        scrollTrigger: {
          trigger: year,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    });

    const num = $('.year__num', year);
    if (!num) continue;

    gsap.to(num, {
      xPercent: year.dataset.year % 2 === 0 ? -6 : 6,
      ease: 'none',
      scrollTrigger: { trigger: year, start: 'top bottom', end: 'bottom top', scrub: 1 },
    });
  }
}

/* ---------- the 2026 comeback -------------------------------
   Pinned. The picture comes up out of black slowly - it is the
   payoff for two empty years, so it must not be quick.
   ------------------------------------------------------------ */

function reveal2026(gsap) {
  const section = $('[data-reveal-2026]');
  if (!section) return;

  const figure = $('.reveal__figure', section);
  const word = $('[data-reveal-word]', section);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: '+=120%',
      scrub: 1,
      pin: true,
      // Pinning without this leaves a jump on phones where the
      // address bar resizes the viewport mid-scroll.
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  tl.fromTo(figure,
    { opacity: 0, scale: 1.15, filter: 'brightness(0.2)' },
    { opacity: 1, scale: 1, filter: 'brightness(1)', duration: 1.6, ease: 'power2.out' })
    .from(word, { opacity: 0, y: 20, duration: 0.6 }, '-=0.3');
}

/* ---------- archive outro ----------------------------------- */

function outroLines(gsap) {
  const lines = $$('[data-outro-line]');
  if (!lines.length) return;

  gsap.from(lines, {
    opacity: 0,
    y: 30,
    stagger: 0.35,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: { trigger: '[data-outro]', start: 'top 70%', once: true },
  });
}

/* ---------- 04 activities -----------------------------------
   The picture moves slower than the page, the label faster. That
   difference is what makes a flat photo feel like a camera move.
   ------------------------------------------------------------ */

function activityMotion(gsap) {
  for (const panel of $$('.activity')) {
    const media = $('.activity__media', panel);
    const label = $('.activity__label', panel);

    gsap.fromTo(media,
      { yPercent: -12, scale: 1.12 },
      {
        yPercent: 12,
        scale: 1,
        ease: 'none',
        scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true },
      });

    gsap.fromTo(label,
      { yPercent: 40 },
      {
        yPercent: -40,
        ease: 'none',
        scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: true },
      });
  }
}

/* ---------- 05 statistics ----------------------------------- */

function statsEntrance(gsap) {
  for (const stat of $$('.stat')) {
    gsap.from(stat, {
      opacity: 0,
      y: 60,
      duration: 1,
      ease: 'power3.out',
      scrollTrigger: { trigger: stat, start: 'top 80%', once: true },
    });
  }
}

/* ---------- progress bar ------------------------------------
   Plain scroll maths, no GSAP needed, so it also runs under
   reduced motion.
   ------------------------------------------------------------ */

function scrollProgress() {
  const fill = $('[data-scroll-fill]');
  if (!fill) return;

  let ticking = false;

  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    fill.style.width = `${pct}%`;
    ticking = false;
  };

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  update();
}
