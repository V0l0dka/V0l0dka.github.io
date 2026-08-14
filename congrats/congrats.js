/* ============================================================
   Birthday deck - all behaviour for /congrats/.

   No libraries, no build step. This file runs as-is in the
   browser. It reads the slides out of the HTML, so adding or
   removing a <section class="slide"> needs no change here.
   ============================================================ */

(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const deck    = $('[data-deck]');
  const slides  = $$('.slide', deck);
  const dotList = $('[data-dots]');
  const live    = $('[data-live]');
  const fill    = $('[data-progress-fill]');

  /* ==========================================================
     1. Slide navigation
     ========================================================== */

  let index = 0;

  // One dot per slide, built from the HTML so it can never fall
  // out of sync with the actual number of slides.
  slides.forEach((slide, i) => {
    const li  = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', `Slide ${i + 1}`);
    btn.addEventListener('click', () => go(i));
    li.append(btn);
    dotList.append(li);
  });

  const dots = $$('button', dotList);

  function go(next, { announce = true, updateHash = true } = {}) {
    const target = Math.max(0, Math.min(slides.length - 1, next));
    if (target === index && slides[target].classList.contains('is-active')) return;

    const forward = target >= index;
    index = target;

    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      // Slides off-screen must not be reachable by Tab or by a
      // screen reader. `inert` handles both in one attribute.
      slide.inert = !active;
      // Incoming slide enters from the side you are travelling towards.
      slide.style.setProperty('--from', active ? '0%' : (forward ? '4%' : '-4%'));
    });

    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)));

    $('[data-action="prev"]').disabled = index === 0;
    $('[data-action="next"]').disabled = index === slides.length - 1;

    fill.style.width = `${((index + 1) / slides.length) * 100}%`;

    if (announce) live.textContent = `Slide ${index + 1} of ${slides.length}`;

    if (updateHash) history.replaceState(null, '', `#s${index + 1}`);
    pauseVideosOutsideCurrentSlide();
  }

  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  document.addEventListener('keydown', (e) => {
    if (lightbox.open) return;                       // lightbox owns the keyboard
    if (e.target.matches('input, textarea')) return;

    // Space is how you activate a focused button. Only treat it as
    // "next slide" when focus is not sitting on something clickable.
    const onControl = Boolean(e.target.closest('button, a'));

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':  next(); break;
      case 'ArrowLeft':
      case 'PageUp':    prev(); break;
      case ' ':         if (onControl) return; e.preventDefault(); next(); break;
      case 'Home':      go(0); break;
      case 'End':       go(slides.length - 1); break;
      default: return;
    }
  });

  // Swipe. Only counts as a swipe if it is mostly horizontal and
  // long enough, so vertical scrolling inside a slide still works.
  let touchX = 0, touchY = 0;

  deck.addEventListener('touchstart', (e) => {
    touchX = e.changedTouches[0].clientX;
    touchY = e.changedTouches[0].clientY;
  }, { passive: true });

  deck.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy)) return;
    dx < 0 ? next() : prev();
  }, { passive: true });

  /* ==========================================================
     2. Video
     ========================================================== */

  function pauseVideosOutsideCurrentSlide() {
    $$('[data-slide-video]').forEach((video) => {
      if (!video.closest('.slide').classList.contains('is-active')) {
        video.pause();
      }
    });
  }

  $$('[data-slide-video]').forEach((video) => {
    const frame    = video.closest('[data-frame]');
    const playIcon = $('[data-video-icon]', frame);
    const muteIcon = $('[data-mute-icon]', frame);
    const bar      = $('[data-video-progress]', frame);

    const sync = () => { playIcon.textContent = video.paused ? '▶' : '❚❚'; };

    $('[data-action="video-toggle"]', frame).addEventListener('click', () => {
      video.paused ? video.play() : video.pause();
    });

    $('[data-action="video-mute"]', frame).addEventListener('click', () => {
      video.muted = !video.muted;
      muteIcon.textContent = video.muted ? '🔇' : '🔊';
    });

    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    video.addEventListener('timeupdate', () => {
      if (!video.duration) return;
      bar.style.width = `${(video.currentTime / video.duration) * 100}%`;
    });

    // Clicking the picture itself is the obvious thing to try.
    video.addEventListener('click', () => { video.paused ? video.play() : video.pause(); });
  });

  /* ==========================================================
     3. Missing media -> visible placeholder

     If a file has not been added yet the browser fires `error`.
     We mark the frame so CSS can show the expected filename
     instead of a broken-image icon.
     ========================================================== */

  const markMissing = (el) => el.closest('[data-frame]')?.classList.add('is-missing');

  // `error` does not bubble, so listen in the capture phase.
  document.addEventListener('error', (e) => {
    if (e.target.matches('img, video, source')) markMissing(e.target);
  }, true);

  // Images can finish failing before this script runs.
  $$('[data-frame] img').forEach((img) => {
    if (img.complete && img.naturalWidth === 0) markMissing(img);
  });

  /* ==========================================================
     4. Lightbox (enlarge a gallery photo)
     ========================================================== */

  const lightbox    = $('[data-lightbox]');
  const lightboxImg = $('[data-lightbox-img]');

  const closeLightbox = () => lightbox.close();

  $('[data-action="lightbox-close"]').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    // Click on the backdrop, i.e. outside the image, closes it.
    if (e.target === lightbox) closeLightbox();
  });

  /* ==========================================================
     5. Confetti
     ========================================================== */

  const canvas = $('[data-confetti-canvas]');
  const ctx    = canvas.getContext('2d');
  const COLORS = ['#ffc857', '#ff6b9d', '#a06bff', '#5ee7c0', '#ffffff'];

  let pieces = [];
  let raf    = null;

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = Math.floor(innerWidth  * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  sizeCanvas();
  addEventListener('resize', sizeCanvas);

  function burst(count = 110) {
    if (reduceMotion) return;                       // OS asked for no animation

    for (let i = 0; i < count; i++) {
      pieces.push({
        x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.5,
        y: innerHeight * 0.62,
        vx: (Math.random() - 0.5) * 13,
        vy: -12 - Math.random() * 12,
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 9,
        spin: (Math.random() - 0.5) * 0.35,
        angle: Math.random() * Math.PI * 2,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 1,
      });
    }
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    pieces = pieces.filter((p) => {
      p.vy    += 0.42;                 // gravity
      p.vx    *= 0.995;                // air drag
      p.x     += p.vx;
      p.y     += p.vy;
      p.angle += p.spin;
      if (p.y > innerHeight * 0.72) p.life -= 0.016;   // fade near the bottom

      if (p.life <= 0 || p.y > innerHeight + 60) return false;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      return true;
    });

    // Stop the loop entirely when nothing is left, so the page
    // is not burning battery in the background.
    if (pieces.length) {
      raf = requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      raf = null;
    }
  }

  /* ==========================================================
     6. Cake
     ========================================================== */

  const cakeStatus = $('[data-cake-status]');
  const relightBtn = $('[data-action="relight"]');
  const candles    = $$('[data-candle]');

  function checkCandles() {
    const lit = candles.filter((c) => c.classList.contains('is-lit')).length;

    if (lit === 0) {
      cakeStatus.textContent = 'All out. Make the wish.';
      relightBtn.hidden = false;
      burst(160);
    } else {
      cakeStatus.textContent = lit === candles.length
        ? 'Tap each candle.'
        : `${lit} to go.`;
      relightBtn.hidden = true;
    }
  }

  /* ==========================================================
     7. Music and fullscreen
     ========================================================== */

  const audio     = $('[data-music-el]');
  const musicBtn  = $('[data-action="music"]');
  const musicIcon = $('[data-music-icon]');

  function toggleMusic() {
    if (audio.paused) {
      // Browsers block autoplay, so this only ever runs from a
      // real click - which is exactly what they allow.
      audio.play().then(() => {
        musicBtn.setAttribute('aria-pressed', 'true');
        musicIcon.textContent = '♫';
      }).catch(() => {
        musicIcon.textContent = '✕';
        musicBtn.title = 'No music file at /congrats/media/music.mp3';
      });
    } else {
      audio.pause();
      musicBtn.setAttribute('aria-pressed', 'false');
      musicIcon.textContent = '♪';
    }
  }

  const fsBtn  = $('[data-action="fullscreen"]');
  const fsIcon = $('[data-fullscreen-icon]');

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }

  document.addEventListener('fullscreenchange', () => {
    const on = Boolean(document.fullscreenElement);
    fsBtn.setAttribute('aria-pressed', String(on));
    fsIcon.textContent = on ? '⤡' : '⛶';
  });

  /* ==========================================================
     8. One click handler for every [data-action] button
     ========================================================== */

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action], [data-candle]');
    if (!el) return;

    if (el.matches('[data-candle]')) {
      el.classList.remove('is-lit');
      checkCandles();
      return;
    }

    switch (el.dataset.action) {
      case 'next': next(); break;
      case 'prev': prev(); break;

      case 'confetti': burst(); break;

      case 'flip':
        el.classList.toggle('is-open');
        el.setAttribute('aria-expanded', String(el.classList.contains('is-open')));
        break;

      case 'lightbox': {
        const img = $('img', el);
        if (!img || el.classList.contains('is-missing')) return;
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt;
        lightbox.showModal();
        break;
      }

      case 'relight':
        candles.forEach((c) => c.classList.add('is-lit'));
        checkCandles();
        break;

      case 'restart':
        candles.forEach((c) => c.classList.add('is-lit'));
        checkCandles();
        $$('.card.is-open').forEach((c) => {
          c.classList.remove('is-open');
          c.setAttribute('aria-expanded', 'false');
        });
        go(0);
        break;

      case 'music':      toggleMusic();      break;
      case 'fullscreen': toggleFullscreen(); break;
    }
  });

  /* ==========================================================
     9. Start
     ========================================================== */

  // #s3 in the URL opens slide 3, so a single slide is linkable.
  // No hash is written on load - the URL only grows a #sN once you move.
  const fromHash = Number(location.hash.replace('#s', ''));
  const start = Number.isInteger(fromHash) && fromHash > 0 ? fromHash - 1 : 0;
  go(start, { announce: false, updateHash: false });
})();
