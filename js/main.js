'use strict';
// Entry point.
const G = new Game();

function start(data) {
  G.boot();
  // continue a solo game after a live page update (embedded viewers only)
  if (data && data.slot && Profile.get() && Saves.load(data.slot)) G.startHosting('solo', data.slot, null);
}

window.addEventListener('load', () => {
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') {
    hot.snapshot(() => {
      if (G.isHost && G.link && G.link.world && G.link.world.onSave && !G.link.isNet) { G.link.world.onSave(); return { slot: G.slot }; }
      return {};
    });
  }
  if (hot && typeof hot.ready === 'function') hot.ready(start);
  else start((hot && hot.data) || {});
});
