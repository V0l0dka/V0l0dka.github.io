/* ============================================================
   GAME 03 - GO DEEPER

   PHASE 1: not implemented. Same contract as the other two.

   Phase 2: the pointer becomes a torch - a radial mask over a
   dark scene - and three objects have to be found:
     серьёжка, Revo, ключи.
   On touch the finger carries the light instead of the cursor.
   ============================================================ */

export const ITEMS = [
  { id: 'earring', label: 'серьёжка' },
  { id: 'revo', label: 'Revo' },
  { id: 'keys', label: 'ключи' },
];

export function init(stage, hud) {
  const found = new Set();

  const paint = () => {
    hud.textContent = `${found.size} / ${ITEMS.length}`;
  };

  paint();

  return {
    start() { /* Phase 2: torch mask, hit testing, highlight on find */ },
    stop() { },
    destroy() { },

    _find(id) { found.add(id); paint(); },
  };
}
