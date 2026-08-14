/* ============================================================
   GAME 01 - CATCH THE COAL

   PHASE 1: not implemented. This module exists so the contract is
   fixed now and Phase 2 only fills in the body.

   Every game exports the same shape:
     init(stage, hud) -> { start(), stop(), destroy() }
   so js/main.js treats all three identically and none of them
   needs special-casing.
   ============================================================ */

export function init(stage, hud) {
  let target = 10;
  let caught = 0;

  const paint = () => {
    hud.textContent = `${String(caught).padStart(2, '0')} / ${target}`;
  };

  paint();

  return {
    start() { /* Phase 2: spawn falling coals, follow pointer/touch */ },
    stop() { },
    destroy() { },

    // Exposed so Phase 2 tests can drive the counter directly.
    _score(n) { caught = Math.min(n, target); paint(); },
  };
}
