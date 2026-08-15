/* ============================================================
   03 - THE ARCHIVE

   Builds the year bands from ARCHIVE in assets.js. Layout comes
   from CSS (.year__media[data-count]) so adding a photograph to a
   year changes the composition without touching this file.
   ============================================================ */

import { $, $$, el, picture, loopVideo, applySize, prefersReducedMotion, announce, autoplayInView } from './dom.js';
import { ARCHIVE, REVEAL_2026 } from './assets.js';
import { mountMoment } from './media.js';

export function buildArchive() {
  const root = $('[data-archive]');
  if (!root) return;

  for (const entry of ARCHIVE) {
    root.append(entry.empty ? emptyYear(entry) : filledYear(entry));
  }

  /* The 2019 clip used to rely on its poster frame and was never
     actually played. Now that posters are deferred it needs the same
     treatment as every other clip on the page: fetched early, played
     while on screen, paused when it leaves. */
  autoplayInView($$('.shot__video', root));

  mountReveal();
}

/* ---------- a normal year ---------------------------------- */

function filledYear(entry) {
  const media = el('div', {
    class: 'year__media',
    'data-count': String(entry.media.length),
  });

  for (const src of entry.media) {
    // A year's media list can hold stills and clips side by side -
    // 2019 is a video, everything around it is photographs.
    const isVideo = Boolean(src.mp4);

    const shot = el('figure', { class: 'shot', 'data-reveal-on-scroll': true },
      isVideo
        ? loopVideo(src, { className: 'shot__video' })
        : picture(src, { alt: `Мира, ${entry.year}` }),
    );

    media.append(shot);
  }

  const article = el('article', { class: 'year', 'data-year': entry.year },
    el('h3', { class: 'year__num', text: entry.year }),
    entry.caption
      ? el('p', { class: 'year__caption', text: entry.caption })
      : null,
  );

  // A year may have a reaction pinned to it in media-config. Only
  // 2022 does today; every other year resolves to null and nothing
  // is added. It sits after the caption and before the photographs
  // so it can never land on top of either.
  mountMoment(article, `archive-${entry.year}`, { className: 'moment--aside' });

  article.append(media);
  return article;
}

/* ---------- 2024 and 2025 -----------------------------------
   The absence is the content. There is no photograph to add here
   and none should be invented.
   ------------------------------------------------------------ */

function emptyYear(entry) {
  const year = el('article', { class: 'year year--empty', 'data-year': entry.year },
    el('h3', { class: 'year__num', text: entry.year }),
  );

  const void_ = el('div', { class: 'void' });

  if (entry.year === '2024') {
    void_.append(
      el('p', { class: 'void__line', text: 'НЕТ ДАННЫХ' }),
      el('p', { class: 'void__line', text: 'архив повреждён' }),
    );
    // A band of dead-channel static sits where the photographs
    // would have been, then a small reaction - then the line that
    // actually carries the year, last and alone.
    mountMoment(void_, 'void-2024-signal', { className: 'moment--band' });
    void_.append(el('p', { class: 'void__line', text: 'фотографии отсутствуют' }));
    mountMoment(void_, 'void-2024');
    void_.append(el('p', { class: 'void__line void__line--loud', text: 'мы не общались.' }));
  } else {
    void_.append(
      el('p', { class: 'void__line void__line--loud', text: 'тоже ничего.' }),
      el('p', { class: 'void__line', text: 'по техническим причинам' }),
      el('p', { class: 'void__line', text: 'и вообще давайте не будем об этом.' }),
      searchBlock(),
    );
    mountMoment(void_, 'void-2025-signal', { className: 'moment--band' });
    mountMoment(void_, 'void-2025');
  }

  year.append(void_);
  return year;
}

/* A progress indicator that never progresses. It sits at 0%, then
   fails. */
function searchBlock() {
  const percent = el('span', { class: 'void__percent', text: '0%' });
  const status = el('p', { class: 'void__line', text: '' });

  const retry = el('button', {
    class: 'void__retry',
    type: 'button',
    text: 'ПОПРОБОВАТЬ ЕЩЁ',
  });

  const wrap = el('div', { class: 'void__search' },
    el('span', { text: 'ИЩЕМ МИРУ...' }),
    percent,
    el('div', { class: 'void__bar' }),
    status,
    retry,
  );

  let failed = false;

  const fail = () => {
    failed = true;
    // Кириллическое тире, не длинное - см. правила проекта.
    status.textContent = 'ОШИБКА 404 - Мира не найдена.';
  };

  // Fail once the block has actually been looked at, not on page load.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting || failed) continue;
      setTimeout(fail, prefersReducedMotion() ? 0 : 2200);
      io.disconnect();
    }
  }, { threshold: 0.5 });

  io.observe(wrap);

  retry.addEventListener('click', () => {
    retry.textContent = 'не надо.';
    retry.disabled = true;
    announce('не надо.');
  });

  return wrap;
}

/* ---------- the 2026 comeback ------------------------------- */

function mountReveal() {
  const source = $('[data-reveal-webp]');
  const img = $('[data-reveal-img]');
  if (!source || !img) return;

  source.srcset = REVEAL_2026.webp;
  img.src = REVEAL_2026.jpg;
  applySize(img, REVEAL_2026.jpg);
}
