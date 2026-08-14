/* ============================================================
   GAME 02 - DON'T CRASH

   PHASE 1: not implemented. Same contract as the other two.
   Phase 2: side-scroller, obstacle avoidance, simple AABB
   collision. Explicitly not a physics simulator.
   ============================================================ */

export function init(stage, hud) {
  let speed = 0;

  const paint = () => {
    hud.textContent = `${String(Math.round(speed)).padStart(3, '0')} KM/H`;
  };

  paint();

  return {
    start() { /* Phase 2: run loop, spawn obstacles, read input */ },
    stop() { },
    destroy() { },

    _speed(v) { speed = v; paint(); },
  };
}
