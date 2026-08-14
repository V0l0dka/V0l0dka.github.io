/* ============================================================
   07 - SUR-RON CONFIGURATOR

   Phase 1 builds the real interface and the real state machine.
   What is missing is only the artwork: each variant will map to a
   transparent PNG layer stacked over the bike.

   Adding the art later means filling in `layer` below and nothing
   else - the selection, ordering and UI already work.
   ============================================================ */

import { $, el } from './dom.js';

/* Layer order is bottom to top. `layer: null` means "no artwork
   mapped yet" - the option still selects, it just draws nothing. */
const CATEGORIES = [
  {
    id: 'wheels',
    label: 'WHEELS',
    options: [
      { id: 'stock', label: 'STOCK', layer: null },
      { id: 'knobby', label: 'KNOBBY', layer: null },
      { id: 'street', label: 'STREET', layer: null },
    ],
  },
  {
    id: 'light',
    label: 'LIGHT',
    options: [
      { id: 'none', label: 'NONE', layer: null },
      { id: 'round', label: 'ROUND', layer: null },
      { id: 'bar', label: 'LED BAR', layer: null },
    ],
  },
  {
    id: 'seat',
    label: 'SEAT',
    options: [
      { id: 'stock', label: 'STOCK', layer: null },
      { id: 'long', label: 'LONG', layer: null },
    ],
  },
  {
    id: 'stickers',
    label: 'STICKERS',
    options: [
      { id: 'clean', label: 'CLEAN', layer: null },
      { id: 'acid', label: 'ACID', layer: null },
      { id: 'tmnt', label: 'TMNT', layer: null },
    ],
  },
  {
    id: 'armor',
    label: 'ARMOR',
    options: [
      { id: 'none', label: 'NONE', layer: null },
      { id: 'panzer', label: 'PANZER', layer: null },
    ],
  },
];

/* Current selection, one option id per category. */
const state = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.options[0].id]));

export function buildCustomization() {
  const ui = $('[data-config-ui]');
  const stage = $('[data-config-stage]');
  if (!ui || !stage) return;

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

      btn.addEventListener('click', () => select(cat, opt, options, stage));
      options.append(btn);
    }

    ui.append(
      el('div', { class: 'config__group' },
        el('span', { class: 'config__name', text: cat.label }),
        options,
      ),
    );
  }

  render(stage);
}

function select(cat, opt, group, stage) {
  state[cat.id] = opt.id;

  for (const btn of group.children) {
    btn.setAttribute('aria-pressed', String(btn.dataset.opt === opt.id));
  }

  render(stage);
}

/* Draws the current configuration. Once `layer` paths exist this
   swaps to stacking <img class="config__layer"> elements; until
   then it reports the build as text so the state is visible. */
function render(stage) {
  const placeholder = $('.config__placeholder', stage);
  if (!placeholder) return;

  const summary = CATEGORIES
    .map((c) => `${c.label}: ${state[c.id].toUpperCase()}`)
    .join('   ·   ');

  placeholder.textContent = `SUR-RON LIGHT BEE X — BLACK\n${summary}`;
  placeholder.style.whiteSpace = 'pre-line';
}
