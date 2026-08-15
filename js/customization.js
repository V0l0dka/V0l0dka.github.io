/* ============================================================
   07 - SUR-RON

   Phase 1 shipped five categories (wheels, light, seat, stickers,
   armour) with no artwork behind any of them - every option was a
   label that changed nothing.

   There are no per-part layer assets and there never will be, so
   the honest version is smaller: three controls that each make a
   real, visible change to a real photograph.

     РАКУРС      switches between the five actual Sur-Ron stills
     ФАРА        renders a headlight glow
     ПОДСВЕТКА   renders acid underglow

   Two fake options are worse than one real one. If proper layer
   art ever exists, add it here and nowhere else.
   ============================================================ */

import { $, el } from './dom.js';
import { asset } from './media-config.js';

/* The five supplied stills, plus the cut-out silhouette which is
   the only one with a transparent background. */
const VIEWS = ['surronSilhouette', 'surron1', 'surron2', 'surron3', 'surron4', 'surron5'];

const CATEGORIES = [
  {
    id: 'view',
    label: 'РАКУРС',
    options: VIEWS.map((name, i) => ({
      id: name,
      label: i === 0 ? 'СИЛУЭТ' : String(i).padStart(2, '0'),
    })),
  },
  {
    id: 'light',
    label: 'ФАРА',
    options: [
      { id: 'off', label: 'ВЫКЛ' },
      { id: 'warm', label: 'ТЁПЛАЯ' },
      { id: 'acid', label: 'КИСЛОТНАЯ' },
    ],
  },
  {
    id: 'glow',
    label: 'ПОДСВЕТКА',
    options: [
      { id: 'off', label: 'НЕТ' },
      { id: 'acid', label: 'КИСЛОТА' },
    ],
  },
];

const state = { view: VIEWS[0], light: 'off', glow: 'off' };

export function buildCustomization() {
  const ui = $('[data-config-ui]');
  const stage = $('[data-config-stage]');
  if (!ui || !stage) return;

  // Replace the Phase 1 text placeholder with the real bike.
  stage.innerHTML = '';

  const img = el('img', {
    class: 'config__bike',
    alt: 'Sur-Ron Light Bee X',
    decoding: 'async',
    loading: 'lazy',
  });

  const beam = el('div', { class: 'config__beam', 'aria-hidden': 'true' });
  const under = el('div', { class: 'config__under', 'aria-hidden': 'true' });
  const caption = el('p', { class: 'config__caption' });

  stage.append(under, img, beam, caption);

  for (const cat of CATEGORIES) {
    const options = el('div', { class: 'config__options' });

    for (const opt of cat.options) {
      const btn = el('button', {
        class: 'config__opt',
        type: 'button',
        'aria-pressed': String(state[cat.id] === opt.id),
        'data-cat': cat.id,
        'data-opt': opt.id,
        text: opt.label,
      });
      btn.addEventListener('click', () => {
        state[cat.id] = opt.id;
        for (const sibling of options.children) {
          sibling.setAttribute('aria-pressed', String(sibling.dataset.opt === opt.id));
        }
        render(img, beam, under, caption);
      });
      options.append(btn);
    }

    ui.append(
      el('div', { class: 'config__group' },
        el('span', { class: 'config__name', text: cat.label }),
        options,
      ),
    );
  }

  render(img, beam, under, caption);
}

function render(img, beam, under, caption) {
  const entry = asset(state.view);
  if (entry) {
    img.src = entry.src;
    // WebP is universal now, but fall back rather than show nothing.
    img.onerror = () => { if (entry.fallback) { img.onerror = null; img.src = entry.fallback; } };
  }

  beam.dataset.mode = state.light;
  under.dataset.mode = state.glow;

  // The model name is a product name and stays in English.
  caption.textContent = 'SUR-RON LIGHT BEE X - ЧЁРНЫЙ';
}
