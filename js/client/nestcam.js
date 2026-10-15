'use strict';
// Nest cam: an animated close-up of a nest for the nest window. The place around it, a nest woven
// from the species' real materials, its eggs, chicks that grow and beg, and the parents coming and
// going. Drawn at half size into its own little canvas and shown at 2x, like the rest of the pixel art.

const CAM_W = 80, CAM_H = 48;

// Colours of each nest material: [main, second]
const NEST_MAT_COL = {
  twig: ['#7a5a3a', '#5a3e26'], stick: ['#6a4a2c', '#4a321c'], grass: ['#c8a86a', '#a08448'],
  moss: ['#6a8a3a', '#4e6e2a'], mud: ['#6e5236', '#8a6a48'], feather: ['#f4f0e6', '#d8d0c0'],
  wool: ['#efebe0', '#d4ccbc'], hair: ['#3a2a1a', '#5a4632'], silk: ['#e8eef0', '#c8d0d8'],
  lichen: ['#a8b498', '#8a9a7a'], leaves: ['#a8643a', '#7a4a2a'], rotwood: ['#8a6a4a', '#6a4e34'],
  bark: ['#7a4a2a', '#5a3420'], thistledown: ['#f4f0e6', '#e0d8e8'], fluff: ['#f8f8f0', '#e8e4d8'],
  herbs: ['#6a9a4a', '#9a7ac8'], reedplume: ['#c8b088', '#a08860'], wood: ['#a8743f', '#7a5230'],
  stone: ['#a49c8e', '#7a746a'], sand: ['#e0c890', '#c8b078'], clay: ['#b87a52', '#985a3a'],
};

// What surrounds the nest, by nest site
const CAM_SCENE = {
  shrub: 'leaf', thorny: 'thorny', tree: 'leaf', willow: 'leaf', pine: 'pine', snag: 'hole',
  box_small: 'box', box_medium: 'box', box_large: 'box', owlbox: 'box', box_open: 'boxopen',
  platform: 'sky', bank: 'tunnel', brushpile: 'brush', barn: 'barn', eaves: 'eaves', reeds: 'reed',
  ground: 'grass', field: 'grass', shingle: 'gravel', clearing: 'clearing', ledge: 'rock',
  bridge: 'bridge', chimney: 'chimney',
};
const CAM_HOLE_R = { box_small: 2.5, box_medium: 3, box_large: 3.5, owlbox: 6 };
// Nest shapes: outer body (cx, cy, rx, ry), the hollow (hy, hrx, hry) and where the front lip starts
const CAM_GEO = {
  cup:      { cx: 40, cy: 35, rx: 20, ry: 8, hy: 31, hrx: 15, hry: 3.5, lip: 32 },
  bed:      { cx: 40, cy: 42, rx: 28, ry: 6, hy: 39, hrx: 16, hry: 2.5, lip: 40 },
  floor:    { cx: 40, cy: 41, rx: 16, ry: 3, hy: 40, hrx: 13, hry: 2, lip: 99 },
  platform: { cx: 40, cy: 38, rx: 19, ry: 4, hy: 36, hrx: 14, hry: 2, lip: 38 },
  heap:     { cx: 40, cy: 41, rx: 31, ry: 9, hy: 35, hrx: 16, hry: 3, lip: 36 },
};

function camScene(S, n, sp) {
  const host = n.host ? S.objs.get(n.host) : null;
  if (host && host.type === 'tree' && host.kind === 'snag') return 'hole';
  if (sp.nest === 'hole' && (sp.site === 'tree' || sp.site === 'snag')) return 'hole';
  if (sp.nest === 'hole' && sp.site === 'eaves') return 'roof'; // swifts slip in under the roof tiles
  return CAM_SCENE[sp.site] || 'leaf';
}
function camStyle(sp) {
  const t = sp.nest, bare = !Object.keys(sp.mats).length;
  if (t === 'box') return bare ? 'floor' : 'bed';
  if (t === 'hole' || t === 'tunnel' || t === 'scrape' || t === 'bare' || t === 'pebbles') return 'floor';
  if (t === 'twigs') return 'platform';
  if (t === 'sticks' || t === 'chimney') return 'heap';
  if (t === 'mudcup' || t === 'muddome') return 'mud';
  if (t === 'dome' || t === 'domelichen') return 'dome';
  return 'cup';
}
const camGeo = (style) => CAM_GEO[style] || CAM_GEO.cup;
// How a species' chicks look and behave in the nest
function camChickType(sp) {
  if (sp.precocial) return 'prec';
  if (sp.body === 'owl') return 'owl';
  if (sp.big || sp.body === 'pigeon' || sp.body === 'cuckoo') return 'fluff';
  return 'gape';
}

// ---------------------------------------------------------------- static layers
// The background with the back of the nest, and the nest's front lip (drawn over eggs and chicks)
function camLayers(sp, scene, style, season, old, siteKey) {
  const key = 'cam:' + sp.id + ':' + scene + ':' + style + ':' + season + ':' + siteKey + (old ? 'o' : '');
  let L = SPR.cache.get(key);
  if (L) return L;
  const back = new Pix(CAM_W, CAM_H), front = new Pix(CAM_W, CAM_H);
  camBackground(back, scene, season, siteKey);
  camNest(back, front, sp, scene, style);
  if (scene === 'reed' || scene === 'grass') camForeground(front, scene, season, style);
  if (old) for (const px of [back, front]) for (let i = 0; i < px.p.length; i++) {
    const c = px.p[i];
    if (!(c >>> 24)) continue;
    const [r, g, b, a] = rgba(c), l = (r + g + b) / 3;
    px.p[i] = ((a << 24) | (Math.round((b + l) / 2 * 0.85) << 16) | (Math.round((g + l) / 2 * 0.85) << 8) | Math.round((r + l) / 2 * 0.85)) >>> 0;
  }
  L = { back: back.canvas(), front: front.canvas() };
  SPR.cache.set(key, L);
  return L;
}

function camBackground(px, scene, season, siteKey) {
  const W = CAM_W, H = CAM_H, rnd = artRng('cambg' + scene + season + siteKey);
  const R = (a, b) => a + rnd() * (b - a);
  const leafPal = [['#3e6a34', '#5a8e3e', '#76a84a', '#9cc860'], ['#2f5a2a', '#467e34', '#5e9440', '#80b24c'],
    ['#5a4426', '#a8643a', '#c8823a', '#e8b04a'], ['#4a4a56', '#6a6a76', '#8a8a96', '#dce2ec']][season];
  const vignette = (k) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2), d = dx * dx * 0.8 + dy * dy * 0.6;
      if (d > 0.55) px.blend(x, y, '#100c08', Math.min(0.55, (d - 0.55) * k));
    }
  };
  // the background a little out of focus: pulled toward one colour
  const soften = (c, a) => { for (let i = 0; i < px.p.length; i++) px.blend(i % W, Math.floor(i / W), c, a); };
  const sky = (y0, y1, c0, c1) => { for (let y = y0; y < y1; y++) px.hline(0, W - 1, y, mixHex(c0, c1, (y - y0) / Math.max(1, y1 - y0))); };
  const planks = (base, seam, grain) => {
    px.rect(0, 0, W, H, base);
    for (let x = 0; x < W; x += 13) px.vline(x, 0, H - 1, seam);
    for (let i = 0; i < 40; i++) { const x = Math.floor(R(0, W)), y = Math.floor(R(0, H)); px.vline(x, y, y + Math.floor(R(2, 7)), grain); }
  };
  const lightHole = (hx, hy, r) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dy = y - hy; if (dy <= 0) continue;
      const spread = r + dy * 0.45;
      if (Math.abs(x - hx - dy * 0.15) < spread) px.blend(x, y, '#fff0c0', 0.10 * (1 - dy / H));
    }
    px.disc(hx, hy, r + 1, '#2a1a0e');
    px.disc(hx, hy, r, '#f4ecc8');
    px.disc(hx - r * 0.3, hy - r * 0.3, r * 0.5, '#ffffff');
  };
  switch (scene) {
    case 'leaf': case 'thorny': case 'brush': case 'pine': {
      const pal = scene === 'pine' ? (season === 3 ? ['#24402e', '#36583e', '#4a6e4c', '#e8eef4'] : ['#24402e', '#36583e', '#4a6e4c', '#6a8e5a']) : leafPal;
      px.rect(0, 0, W, H, pal[0]);
      for (let i = 0; i < 12; i++) px.ellipse(R(0, W), R(0, H * 0.6), R(1, 3), R(1, 2.5), season === 3 ? '#c8d4e4' : '#bcdcd8');
      if (scene === 'brush') for (let i = 0; i < 22; i++) { const x = R(-10, W), y = R(0, H); px.line(x, y, x + R(10, 26), y + R(-8, 8), i % 2 ? '#6a5038' : '#8a6e50'); }
      for (let i = 0; i < (scene === 'brush' ? 25 : 80); i++) {
        const x = R(0, W), y = R(0, H), c = pal[1 + (i % 3)];
        if (scene === 'pine') { const a = R(0, Math.PI); for (let k = -3; k <= 3; k++) px.line(x, y, x + Math.cos(a + k * 0.35) * 4, y + Math.sin(a + k * 0.35) * 4, c); }
        else px.ellipse(x, y, R(1.5, 3.5), R(1.2, 2.4), c);
      }
      const bark = scene === 'pine' ? '#4a3420' : '#5a3e26';
      px.thick(-2, 47, 28, 40, 3, bark); px.thick(82, 46, 52, 40, 3, bark); px.thick(12, 44, 2, 30, 2, bark); px.thick(66, 43, 78, 32, 2, bark);
      if (scene === 'thorny') for (let i = 0; i < 16; i++) { const x = R(2, W - 2), y = R(2, H - 4); px.set(x, y, '#5a3e26'); px.set(x + 1, y - 1, '#5a3e26'); }
      if (scene === 'thorny' && season === 0) for (let i = 0; i < 14; i++) { const x = R(2, W - 2), y = R(2, H * 0.7); px.disc(x, y, 1.2, '#f8f4ea'); px.set(x, y, '#e8b0c0'); }
      if (scene === 'pine') for (let i = 0; i < 3; i++) { const x = R(6, W - 6), y = R(4, 20); px.ellipse(x, y, 1.5, 2.5, '#8a6a4a'); px.set(x, y - 1, '#a8845a'); }
      if (season === 3) for (let i = 0; i < 20; i++) px.ellipse(R(0, W), R(0, H), R(1, 2.5), 1, '#f4f8fc');
      soften(pal[0], 0.35);
      vignette(1.2);
      break;
    }
    case 'box': {
      planks('#6e5032', '#4a3420', '#7a5a3a');
      for (let y = 0; y < 6; y++) px.hline(0, W - 1, y, darken('#6e5032', 0.45 - y * 0.05));
      lightHole(40, 13, CAM_HOLE_R[siteKey] || 3);
      vignette(2.2);
      break;
    }
    case 'boxopen': {
      sky(0, 22, '#9ac8e0', '#cfe8d8');
      for (let i = 0; i < 40; i++) px.ellipse(R(0, W), R(6, 22), R(2, 4), R(1.5, 3), leafPal[1 + (i % 3)]);
      planks('#6e5032', '#4a3420', '#7a5a3a');
      sky(0, 20, '#9ac8e0', '#cfe8d8');
      for (let i = 0; i < 40; i++) px.ellipse(R(0, W), R(6, 20), R(2, 4), R(1.5, 3), leafPal[1 + (i % 3)]);
      px.rect(0, 20, W, 4, '#8a6640'); px.hline(0, W - 1, 20, '#a8845a'); px.hline(0, W - 1, 23, '#4a3420');
      vignette(1.6);
      break;
    }
    case 'roof': {
      // the dark roof space: rafters, the undersides of tiles, daylight through the gap at the eaves
      px.rect(0, 0, W, H, '#3a2a1e');
      for (let y = 2; y < 30; y += 5) px.hline(0, W - 1, y, '#4a3626');
      for (let x = 6; x < W; x += 18) { px.line(x, 0, x + 14, 30, '#5a4030'); px.line(x + 1, 0, x + 15, 30, '#2a1e14'); }
      px.rect(0, 40, W, H - 40, '#4a3828'); px.hline(0, W - 1, 40, '#6a5038');
      px.rect(66, 30, 14, 6, '#f4ecc8'); px.hline(66, W - 1, 29, '#b4503a');
      for (let y = 30; y < H; y++) for (let x = 40; x < 66; x++) if (x > 66 - (y - 30) * 1.6) px.blend(x, y, '#fff0c0', 0.08);
      vignette(2);
      break;
    }
    case 'hole': {
      px.rect(0, 0, W, H, '#5a3e26');
      for (let i = 0; i < 70; i++) { const x = Math.floor(R(0, W)), y = Math.floor(R(0, H)); px.vline(x, y, y + Math.floor(R(3, 10)), i % 2 ? '#6e5032' : '#4a3220'); }
      lightHole(24, 10, 4);
      vignette(2.4);
      break;
    }
    case 'tunnel': {
      px.rect(0, 0, W, H, '#8a6a48');
      for (let i = 0; i < 90; i++) px.set(R(0, W), R(0, H), i % 3 ? '#6e5236' : '#a8845a');
      for (let i = 0; i < 6; i++) px.ellipse(R(0, W), R(0, H), R(1, 2), R(0.8, 1.5), '#a49c8e');
      for (let i = 0; i < 4; i++) { let x = R(0, W), y = 0; for (let k = 0; k < 8; k++) { px.set(x, y, '#5a3e26'); x += R(-1, 1.4); y += 1; } }
      px.ellipse(76, 26, 7, 8, '#3a2a1a'); px.ellipse(78, 26, 3, 4, '#e8d8a8');
      vignette(2.2);
      break;
    }
    case 'sky': {
      sky(0, H, '#7ab8e0', '#d8ecf0');
      for (let i = 0; i < 4; i++) { const x = R(0, W), y = R(3, 22); for (const [dx, dy, r] of [[0, 0, 3], [4, -1, 4], [8, 0, 3]]) px.ellipse(x + dx, y + dy, r * 1.4, r * 0.8, '#ffffff'); }
      px.rect(0, 44, W, 4, '#7ab05a'); px.hline(0, W - 1, 44, '#5a9a4a');
      for (let x = 0; x < W; x += 9) px.ellipse(x + R(0, 4), 44, R(2, 4), 2, '#4a7a3a');
      px.rect(37, 42, 6, 6, '#6a4a2c');
      break;
    }
    case 'barn': {
      planks('#4a3424', '#2e2016', '#5a4030');
      for (let x = 13; x < W; x += 26) px.vline(x, 0, H - 1, C('#e8c890', 0.35));
      px.rect(0, 22, W, 5, '#6e4e30'); px.hline(0, W - 1, 22, '#8a6a46'); px.hline(0, W - 1, 26, '#3a2818');
      vignette(1.5);
      break;
    }
    case 'eaves': {
      px.rect(0, 0, W, H, '#e8dccb');
      for (let i = 0; i < 60; i++) px.set(R(0, W), R(10, H), '#d8cab4');
      px.rect(0, 0, W, 6, '#b4503a'); for (let x = 0; x < W; x += 6) px.vline(x, 0, 5, '#8a3a2a');
      px.rect(0, 6, W, 4, '#5a3e26'); px.hline(0, W - 1, 6, '#7a5a3a');
      for (let y = 10; y < 22; y++) px.hline(0, W - 1, y, C('#3a2a1a', 0.30 - (y - 10) * 0.025));
      break;
    }
    case 'bridge': {
      for (let y = 0; y < H; y += 7) for (let x = -((y / 7) % 2) * 6; x < W; x += 12) { px.rect(x, y, 11, 6, (x + y) % 3 ? '#9a9ea6' : '#8a8e96'); px.hline(x, x + 10, y, '#b0b4bc'); }
      for (let i = 0; i < 12; i++) px.ellipse(R(0, W), R(0, H), R(1, 3), R(1, 2), '#6a8a4a');
      px.rect(0, 41, W, 7, '#3383b8'); for (let i = 0; i < 8; i++) px.hline(R(0, W - 8), R(0, W), 42 + Math.floor(R(0, 5)), '#6fc0e0');
      vignette(1);
      break;
    }
    case 'chimney': {
      sky(0, H, '#8ec8e8', '#d8ecf0');
      for (const x0 of [4, 58]) {
        for (let y = 8; y < H; y += 4) for (let x = x0 + ((y / 4) % 2) * 3; x < x0 + 18; x += 6) { px.rect(x, y, 5, 3, '#b4503a'); px.set(x, y, '#c86a4a'); }
        px.rect(x0 - 1, 5, 20, 3, '#8a8e96'); px.hline(x0 - 1, x0 + 18, 5, '#b0b4bc');
      }
      px.rect(22, 30, 36, H - 30, '#3a2a22');
      break;
    }
    case 'reed': {
      sky(0, 34, '#bcdce8', '#e0ecd8');
      px.rect(0, 40, W, 8, '#4a8ab0'); for (let i = 0; i < 6; i++) px.hline(R(0, W - 6), R(0, W), 42 + Math.floor(R(0, 5)), '#8ac8e0');
      for (let i = 0; i < 34; i++) {
        const x = Math.floor(R(0, W)), top = Math.floor(R(0, 18)), c = ['#8aa84a', '#a8b860', '#6a8a3a'][i % 3];
        px.vline(x, top, 40, c);
        if (i % 4 === 0) px.ellipse(x, top - 1, 1.2, 3, '#8a6a4a');
        else if (i % 4 === 1) px.line(x, top + 8, x + 4, top + 4, c);
      }
      break;
    }
    case 'grass': {
      sky(0, 8, '#bcdce8', '#e0ecd8');
      px.rect(0, 8, W, H - 8, '#3e6a24');
      const gc = season === 2 ? ['#a8a04a', '#8a8a3a', '#c8b860'] : season === 3 ? ['#9a9a7a', '#7a7a62', '#b8b89a'] : ['#5a9a3a', '#7ab84a', '#4a7a2a'];
      for (let i = 0; i < 140; i++) { const x = R(0, W), y = R(6, H); px.line(x, y, x + R(-2, 2), y - R(4, 10), gc[i % 3]); }
      if (siteKey === 'field' && season < 2) for (let i = 0; i < 10; i++) px.disc(R(2, W - 2), R(8, 26), 1, i % 2 ? '#e8485a' : '#5a7ae0');
      px.rect(0, 44, W, 4, '#5a4630');
      soften('#3e6a24', 0.25);
      break;
    }
    case 'gravel': {
      px.rect(0, 0, W, 12, '#4ea6cc'); for (let i = 0; i < 8; i++) px.hline(R(0, W - 6), R(0, W), Math.floor(R(1, 10)), '#8ad0e8');
      px.rect(0, 12, W, H - 12, '#d8c8a0'); px.hline(0, W - 1, 12, '#f0e4c4');
      for (let i = 0; i < 70; i++) px.ellipse(R(0, W), R(13, H), R(0.8, 2.2), R(0.6, 1.5), ['#a49c8e', '#8a8478', '#c8bca4', '#7a6a58'][i % 4]);
      break;
    }
    case 'clearing': {
      px.rect(0, 0, W, H, '#6a4e34');
      for (let i = 0; i < 120; i++) px.ellipse(R(0, W), R(0, H), R(1, 2.5), R(0.7, 1.4), ['#a8643a', '#c8823a', '#8a6a3a', '#5a4026'][i % 4]);
      for (let i = 0; i < 10; i++) { const x = R(0, W), y = R(0, H); px.line(x, y, x + R(-8, 8), y + R(-3, 3), '#4a3420'); }
      for (const x0 of [3, 74]) for (let k = 0; k < 6; k++) px.line(x0, 46, x0 + (k - 3) * 3, 26 + k * 2, '#4a8a3a');
      soften('#6a4e34', 0.3);
      vignette(1);
      break;
    }
    case 'rock': {
      px.rect(0, 0, W, H, '#8a8a92');
      for (let i = 0; i < 14; i++) { const x = R(0, W), y = R(0, 36); px.poly([[x, y], [x + R(6, 14), y + R(-2, 2)], [x + R(4, 10), y + R(5, 9)]], i % 2 ? '#a0a0a8' : '#7a7a84'); }
      for (let i = 0; i < 8; i++) { let x = R(0, W), y = R(0, 30); for (let k = 0; k < 9; k++) { px.set(x, y, '#5a5a64'); x += R(-1, 1); y += 1; } }
      for (let i = 0; i < 16; i++) px.disc(R(0, W), R(0, 36), R(0.6, 1.6), i % 3 ? '#c8c890' : '#e8a830');
      px.rect(0, 38, W, H - 38, '#7a746a'); for (let i = 0; i < 40; i++) px.set(R(0, W), R(38, H), i % 2 ? '#9a9488' : '#5a564e');
      px.hline(0, W - 1, 38, '#a49c8e');
      break;
    }
  }
}

// Grass blades or reed stems in front of the nest
function camForeground(px, scene, season, style) {
  const rnd = artRng('camfg' + scene + style);
  const gc = scene === 'reed' ? ['#8aa84a', '#6a8a3a'] : season === 2 ? ['#a8a04a', '#8a8a3a'] : ['#5a9a3a', '#4a7a2a'];
  if (scene === 'reed') for (const x of [8, 19, 63, 71]) px.vline(x, 4 + Math.floor(rnd() * 10), CAM_H - 1, gc[x % 2]);
  else for (let i = 0; i < 18; i++) { const x = rnd() * CAM_W, y = CAM_H - rnd() * 3; if (x > 26 && x < 54) continue; px.line(x, y, x + rnd() * 4 - 2, y - 6 - rnd() * 8, gc[i % 2]); }
}

// The nest itself: back (outside wall and hollow) into `back`, front lip into `front`
function camNest(back, front, sp, scene, style) {
  const rnd = artRng('camnest' + sp.id);
  const R = (a, b) => a + rnd() * (b - a);
  const geo = camGeo(style);
  const keys = Object.keys(sp.mats), lin = sp.lining ? Object.keys(sp.lining) : [];
  const col = (k, i) => (NEST_MAT_COL[k] || NEST_MAT_COL.grass)[i || 0];
  const outer = keys.length ? keys : ['grass'];
  const lining = lin.length ? lin[lin.length - 1] : outer[outer.length - 1];
  // ---- bare floors: a scrape, wood chips, pellets, pebbles or a tunnel chamber
  if (style === 'floor') {
    const { cx, hy, hrx, hry } = geo;
    back.ellipse(cx, hy, hrx + 3, hry + 1.5, C('#2a1a0e', 0.25));
    back.ellipse(cx, hy, hrx, hry, C('#2a1a0e', 0.35));
    const debris = sp.body === 'owl' ? 'pellet' : sp.nest === 'hole' ? 'chip' : (sp.nest === 'pebbles' || scene === 'gravel') ? 'pebble' : scene === 'grass' ? 'grass' : scene === 'clearing' ? null : 'stone';
    for (let i = 0; i < 26 && debris; i++) {
      const a = R(0, Math.PI * 2), d = R(0.75, 1.25), x = cx + Math.cos(a) * (hrx + 1) * d, y = hy + Math.sin(a) * (hry + 1) * d;
      if (debris === 'pellet') { back.ellipse(x, y, 2, 1.2, '#7a746a'); back.set(x, y, '#a49c8e'); }
      else if (debris === 'chip') back.rect(x, y, 2, 1, i % 2 ? '#c8a878' : '#a8845a');
      else if (debris === 'pebble') { back.ellipse(x, y, 1.6, 1.1, ['#a49c8e', '#c8bca4', '#7a6a58'][i % 3]); back.set(x - 0.5, y - 0.5, '#e8e0d0'); }
      else if (debris === 'grass') back.line(x, y, x + R(-3, 3), y - R(1, 2), i % 2 ? '#c8a86a' : '#a08448');
      else back.set(x, y, '#8a8478');
    }
    for (const k of keys) for (let i = 0; i < 3; i++) back.line(cx + R(-hrx, hrx), hy + R(-1, 1), cx + R(-hrx, hrx), hy + R(-1, 1), col(k));
    return;
  }
  // ---- everything else is woven: an outer wall, a hollow lined with the softest material
  const { cx, cy, rx, ry, hy, hrx, hry, lip } = geo;
  const body = new Pix(CAM_W, CAM_H);
  const big = style === 'heap' || style === 'platform';
  const mud = style === 'mud';
  if (style === 'platform') {
    for (let i = 0; i < 40; i++) { const y = cy + R(-ry, ry), x0 = cx + R(-rx, -rx * 0.2), x1 = cx + R(rx * 0.2, rx); body.line(x0, y + R(-1.5, 1.5), x1, y + R(-1.5, 1.5), col(outer[i % outer.length], i % 2)); }
  } else {
    body.ellipse(cx, cy, rx, ry, mud ? NEST_MAT_COL.mud[0] : col(outer[0]));
    const strokes = big ? 90 : 120;
    for (let i = 0; i < strokes; i++) {
      const a = R(0, Math.PI * 2), d = Math.sqrt(rnd()), x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
      if (mud) { body.disc(x, y, R(0.8, 1.6), i % 2 ? NEST_MAT_COL.mud[1] : darken(NEST_MAT_COL.mud[0], 0.15)); continue; }
      const k = outer[i % outer.length], len = big ? R(5, 11) : R(3, 7), ang = R(-0.5, 0.5);
      const c = col(k, i % 2);
      for (let s = 0; s <= len; s++) { const px = x + Math.cos(ang) * (s - len / 2), py = y + Math.sin(ang) * (s - len / 2) + Math.sin(s * 0.7) * 0.4; if (body.op(px, py)) body.set(px, py, c); }
    }
    // shading: darker underneath, a light rim on top
    for (let y = 0; y < CAM_H; y++) for (let x = 0; x < CAM_W; x++) {
      if (!body.op(x, y)) continue;
      if (y > cy + ry * 0.35) body.blend(x, y, '#1a120a', 0.22 + (y - cy) / ry * 0.15);
      else if (!body.op(x, y - 1)) body.blend(x, y, '#fff4d8', 0.35);
    }
    if (big) for (let i = 0; i < 12; i++) { const a = R(Math.PI * 0.95, Math.PI * 2.05), x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry; body.line(x, y, x + Math.cos(a) * R(3, 7), y + Math.sin(a) * R(2, 4), col(outer[i % outer.length], 1)); }
  }
  // dome nests (and house martins) have a roof: show it cut open, like a doll's house
  if (style === 'dome' || (mud && sp.nest === 'muddome')) {
    const roof = new Pix(CAM_W, CAM_H), rc = mud ? NEST_MAT_COL.mud : null;
    roof.ellipse(cx, hy - 1, hrx + 5, 15, rc ? rc[0] : col(outer[0]));
    for (let i = 0; i < 60; i++) { const x = cx + R(-hrx - 5, hrx + 5), y = hy - 1 - R(0, 15); if (roof.op(x, y)) roof.set(x, y, rc ? rc[1] : col(outer[i % outer.length], 1)); }
    const inner = darken(col(lining), 0.55);
    roof.ellipse(cx, hy, hrx + 1, 12, inner);
    for (let y = Math.floor(hy - 12); y <= hy; y++) for (let x = cx - hrx - 1; x <= cx + hrx + 1; x++) if (roof.get(x, y) === C(inner)) {
      roof.blend(x, y, '#100a06', clamp((hy - y) / 12, 0, 1) * 0.5);
      if ((x * 7 + y * 3) % 11 === 0) roof.blend(x, y, col(lining, 1), 0.35);
    }
    for (let i = (hy + 1) * CAM_W; i < roof.p.length; i++) roof.p[i] = 0; // only the part above the hollow
    back.blit(roof, 0, 0);
  }
  back.blit(body, 0, 0);
  // the hollow, shadowed, with lining
  if (style !== 'platform') {
    back.ellipse(cx, hy, hrx, hry, darken(col(lining), 0.35));
    for (let i = 0; i < 26; i++) { const a = R(0, Math.PI * 2), d = Math.sqrt(rnd()), x = cx + Math.cos(a) * hrx * d, y = hy + Math.sin(a) * hry * d; back.set(x, y, darken(col(lining, i % 2), 0.15)); }
    back.ellipse(cx, hy + 0.6, hrx * 0.85, hry * 0.6, darken(col(lining), 0.5));
    for (let x = cx - hrx; x <= cx + hrx; x++) { const t = (x - cx) / hrx, y = Math.round(hy - hry * Math.sqrt(Math.max(0, 1 - t * t))); back.set(x, y, lighten(col(lining), 0.15)); }
  }
  // the front lip: the wall in front of the hollow
  for (let y = lip; y < CAM_H; y++) for (let x = 0; x < CAM_W; x++) {
    const i = y * CAM_W + x;
    if (body.p[i] >>> 24) front.p[i] = body.p[i];
  }
  if (style !== 'platform') for (let x = 0; x < CAM_W; x++) { const i = lip * CAM_W + x; if (front.p[i] >>> 24) front.p[i] = C(lighten(toHex(front.p[i]), 0.25)); }
  else for (let i = 0; i < 6; i++) { const y = cy + R(0, ry); front.line(cx + R(-rx, -4), y, cx + R(4, rx), y + R(-1, 1), col(outer[i % outer.length], 1)); }
}

// Nestling pixel templates (see NestCam.chick)
const CHICK_T = {
  gape:     ['.D.D.', '.HHH.', 'HHEHK', 'BHHHB', 'BBBBB', 'BBBBB'],
  gapeBeg:  ['Y...Y', 'YOOOY', '.YOY.', '.HEH.', '.HHH.', 'BBHBB', 'BBBBB', 'BBBBB'],
  owl:      ['.HHH.', 'HEHEH', 'HHKHH', 'BHHHB', 'BBBBB'],
  owlBeg:   ['.HHH.', 'HEHEH', 'HHKHH', 'HHKHH', 'BHHHB', 'BBBBB', 'BBBBB'],
  fluff:    ['.HHH..', 'HHEHKK', 'HHHH..', 'BBBBB.', 'BBBBB.'],
  fluffBeg: ['..KK..', '.HKKH.', 'HHEHH.', '.HHH..', 'BBHBB.', 'BBBBB.', 'BBBBB.'],
};

// ---------------------------------------------------------------- the animated cam
class NestCam {
  constructor(id) {
    this.id = id;
    this.t = 0;
    this.cv = document.createElement('canvas');
    this.cv.width = CAM_W; this.cv.height = CAM_H;
    this.g = this.cv.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.cyc = -1;
  }

  // a bird sprite with its feet at (x, y); frame: perch | peck | hop | fly
  bird(spId, x, y, frame, face) {
    const s = SPR.bird(spId), g = this.g;
    if (frame === 'fly') {
      const f = Math.floor(this.t / 120) % 2 ? 'fly1' : 'fly2';
      g.drawImage(face < 0 ? s[f + '_L'] : s[f], Math.round(x - s.fw / 2), Math.round(y - s.fh / 2 - 4));
      return;
    }
    const img = face < 0 ? s[frame + '_L'] : s[frame];
    g.drawImage(img, Math.round(x - (face < 0 ? s.w - 1 - s.ax : s.ax)), Math.round(y - s.ay));
  }
  dot(x, y, r, c) {
    const g = this.g;
    g.fillStyle = c;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) {
      const hw = Math.sqrt(Math.max(0, r * r - dy * dy));
      if (hw < 0.5) continue;
      g.fillRect(Math.round(x - hw), Math.round(y + dy), Math.round(hw * 2), 1);
    }
  }
  px(x, y, c, w, h) { this.g.fillStyle = c; this.g.fillRect(Math.round(x), Math.round(y), w || 1, h || 1); }

  // A nestling, from a little pixel template: head (and gape, when begging) above the rim, its body
  // hidden by the front lip. H head, B body, E eye, Y yellow gape flange, O open mouth, K beak.
  chick(type, sp, x, base, grow, beg, wob, sc) {
    sc = sc || 1;
    let headC, bodyC, eyeC = '#2a2420';
    if (type === 'owl') { headC = '#f2eee6'; bodyC = '#ddd3c4'; }
    else if (type === 'fluff') {
      const down = sp.body === 'pigeon' ? ['#e8d890', '#c8b870'] : sp.id === 'heron' ? ['#b8b8c0', '#9a9aa4'] : ['#f2eee6', '#d8d0c4'];
      headC = down[0]; bodyC = down[1];
    }
    else {
      const feather = (sp.col && (sp.col.k || sp.col.c)) || '#7a6a50', k = clamp((grow - 0.3) / 0.7, 0, 1);
      headC = grow < 0.3 ? '#e8b0a0' : mixHex('#a09a90', feather, k);
      bodyC = grow < 0.3 ? '#d89c8c' : mixHex('#8a847a', (sp.col && sp.col.y) || feather, k);
      if (grow < 0.3) eyeC = '#8a5a6a'; // eyes still closed
    }
    const T = type === 'gape' ? (beg ? CHICK_T.gapeBeg : CHICK_T.gape) : type === 'owl' ? (beg ? CHICK_T.owlBeg : CHICK_T.owl) : (beg ? CHICK_T.fluffBeg : CHICK_T.fluff);
    const pal = { H: headC, B: bodyC, E: eyeC, Y: '#f6d23a', O: '#f06a2a', K: type === 'owl' ? '#a49c8e' : type === 'fluff' ? '#5a5a5a' : '#e8c040', D: '#c8c0b4' };
    const w = T[0].length, top = Math.round(base - (T.length - 1) * sc - (beg ? Math.max(0, Math.round(wob)) : 0));
    const left = Math.round(x - (w * sc - 1) / 2);
    for (let j = 0; j < T.length; j++) for (let i = 0; i < w; i++) {
      const c = T[j][i];
      if (c === '.' || (c === 'D' && grow > 0.6)) continue;
      this.px(left + i * sc, top + j * sc, pal[c], sc, sc);
    }
    // a stretched neck under a begging head
    if (beg && wob > 0) this.px(Math.round(x) - sc, top + T.length * sc, bodyC, 3 * sc, Math.round(wob));
  }

  // A downy chick that runs about (plovers, ducklings, moorhens…)
  runner(sp, x, y, face, peck) {
    const dark = ['moorhen', 'waterrail', 'corncrake'].includes(sp.id), grey = sp.id === 'swan', duck = sp.body === 'duck' && !dark;
    const c1 = dark ? '#2a2420' : grey ? '#a8a4a0' : duck ? '#e6cf5a' : '#b89a6a', c2 = dark ? '#4a4038' : grey ? '#c8c4c0' : duck ? '#6e5a2a' : '#5a4630';
    const sz = sp.big ? 1.5 : 1;
    this.px(x - 1, y - 1, '#5a4630', 1, 2); this.px(x + 1, y - 1, '#5a4630', 1, 2);
    this.dot(x, y - 3 * sz, 2.6 * sz, c1);
    this.px(x - 2 * sz, y - 4 * sz, c2, 2, 1); this.px(x + 0.5 * sz, y - 2 * sz, c2);
    const hx = x + face * 2 * sz, hy = y - (peck ? 3 : 6) * sz;
    this.dot(hx, hy, 1.7 * sz, c1);
    this.px(hx + face * 1.5 * sz, hy, dark && sp.id === 'moorhen' ? '#e8485a' : '#3a3028', Math.ceil(sz), 1);
    this.px(hx, hy - 1, '#ffffff');
  }

  heart(x, y) {
    const rows = ['.#.#.', '#####', '.###.', '..#..'];
    rows.forEach((r, j) => { for (let i = 0; i < 5; i++) if (r[i] === '#') this.px(x + i - 2, y + j, '#e8485a'); });
  }
  note(x, y) { SPR.font.drawOutline(this.g, '♪', x, y, '#fff4d8', '#3a2614'); }

  draw(ui, x, y, dt) {
    const S = G.state, n = S.objs.get(this.id);
    if (!n) return;
    this.t += dt;
    const sp = SPECIES_BY_ID[n.kind], t = this.t, g = this.g;
    const scene = camScene(S, n, sp), style = camStyle(sp), geo = camGeo(style);
    const host = n.host ? S.objs.get(n.host) : null;
    const L = camLayers(sp, scene, style, S.time.season, n.st === 'old', host && host.type === 'struct' ? host.kind : sp.site);
    g.clearRect(0, 0, CAM_W, CAM_H);
    g.drawImage(L.back, 0, 0);
    const { cx, hy, hrx, hry, lip } = geo;
    const floor = style === 'floor';
    const rimY = floor ? hy + 1 : Math.round(hy - hry + 1);
    const sitY = floor ? hy + 3 : lip + (style === 'bed' ? 1 : 3);
    // birds come in through the hole of a box, a cavity or a tunnel, otherwise from the side
    const cav = scene === 'box' ? [40, 13] : scene === 'hole' ? [24, 10] : scene === 'tunnel' ? [74, 26] : scene === 'roof' ? [76, 32] : null;
    const [ex, ey] = cav || [CAM_W + 14, 6];
    const ease = (k) => k * k * (3 - 2 * k), lerp = (a, b, k) => a + (b - a) * k;
    const rimX = cx + hrx + 3;
    const cu = n.cu && (n.st === 'chicks' || n.st === 'fledged');
    const parentId = sp.id; // in a cuckoo's nest, the foster parents
    const ctype = cu ? 'gape' : camChickType(sp);
    const after = []; // drawn over the front lip
    const visit = (P, arrive, stay, leave, sit) => {
      // a parent's round trip in a P ms cycle: away, flying in, at the nest, flying off
      const ph = t % P;
      if (ph >= arrive && ph < stay) { const k = ease((ph - arrive) / (stay - arrive)); return { x: lerp(ex, sit ? cx : rimX, k), y: lerp(ey, sit ? sitY : rimY, k), f: 'fly', face: -1, ph }; }
      if (ph >= stay && ph < leave) return { x: sit ? cx : rimX, y: sit ? sitY : rimY, f: 'perch', face: -1, ph, at: true };
      if (ph >= leave && ph < leave + 700) { const k = ease((ph - leave) / 700); return { x: lerp(sit ? cx : rimX, ex, k), y: lerp(sit ? sitY : rimY, ey, k), f: 'fly', face: 1, ph }; }
      return { ph, away: true };
    };
    const eggsRow = (count, eggSp, extra) => {
      const e = SPR.egg(eggSp), ew = e.w - 2;
      const rows = count > 4 ? 2 : 1, back = Math.ceil(count / rows), frontN = count - back;
      const put = (k, num, by, dx) => { const span = (num - 1) * (ew + 1); g.drawImage(e.img, Math.round(cx - span / 2 + k * (ew + 1) - e.w / 2 + dx), Math.round(by - e.h + 1 + ((k * 7 + num) % 3 === 0 ? 1 : 0))); };
      const by0 = floor ? hy + 1 : (rows > 1 ? lip : lip + 1);
      for (let k = 0; k < back; k++) put(k, back, by0 - (rows > 1 ? 2 : 0), 0);
      for (let k = 0; k < frontN; k++) put(k, frontN, by0 + 1, ew / 2);
      if (extra) { const ce = SPR.egg('cuckoo'); g.drawImage(ce.img, Math.round(cx + (back * (ew + 1)) / 2 + 1), Math.round(by0 - ce.h)); }
    };
    switch (n.st) {
      case 'eggs': {
        const v = visit(11000, 4200, 5000, 10000, true);
        if (!(v.at)) eggsRow(Math.max(1, n.eggs || 1), sp.id, n.cu);
        if (v.at) this.bird(parentId, cx, sitY + Math.round(Math.sin(t / 700)), (t % 3000) < 400 ? 'peck' : 'perch', Math.floor(t / 11000) % 2 ? 1 : -1);
        else if (!v.away) after.push(() => this.bird(parentId, v.x, v.y, v.f, v.face));
        break;
      }
      case 'chicks': {
        if (ctype === 'prec') {
          // precocial chicks run about near the nest; a parent keeps watch
          const k = Math.min(5, n.ch || 3);
          after.push(() => {
            this.bird(parentId, 18, CAM_H - 3, (t % 4000) < 600 ? 'peck' : 'perch', 1);
            for (let i = 0; i < k; i++) {
              const sx = Math.sin(t / 900 + i * 2.1), vx = Math.cos(t / 900 + i * 2.1);
              this.runner(sp, 44 + i * 6 + sx * 7, CAM_H - 2 - (i % 2) * 2, vx >= 0 ? 1 : -1, ((t / 300 + i) % 7) < 1);
            }
          });
          break;
        }
        const v = visit(7000, 2600, 3300, 5000, false);
        const beg = v.ph >= 2300 && v.ph < 5200;
        const cyc = Math.floor(t / 7000);
        if (v.at && cyc !== this.cyc) { this.cyc = cyc; Audio2.sfx(ctype === 'owl' ? 'hiss' : ctype === 'fluff' ? 'peep' : 'cheep'); }
        const grow = clamp((n.t + 1) / (sp.nestling + 1), 0.1, 1);
        const cbase = floor ? hy + 1 : lip + 2;
        // the cuckoo chick soon dwarfs its foster parents
        if (cu) this.chick('gape', { col: { k: '#7a5a40', y: '#a8846a' } }, cx - 1, cbase, Math.max(0.5, grow), beg, 1 + Math.sin(t / 80), 2);
        else {
          // up to five in a row; a bigger brood gets a second row behind
          const all = Math.min(9, n.ch || 1), rows = all > 5 ? 2 : 1, per = Math.ceil(all / rows);
          const gap = sp.big ? 12 : 6;
          for (let r = rows - 1; r >= 0; r--) {
            const k = r === 0 ? per : all - per;
            for (let i = 0; i < k; i++) {
              const xx = cx - (k - 1) * gap / 2 + i * gap + (r ? gap / 2 : 0), bb = cbase - r * 3;
              const wob = beg ? 1.5 + Math.sin(t / 70 + i * 1.9 + r) * 1.5 : 0;
              const lazy = !beg && ((t / 900 + i * 3.7 + r * 5) % 9) < 1; // now and then one peeps on its own
              this.chick(ctype, sp, xx, bb - (beg || lazy ? 0 : 1), grow, beg || lazy, lazy ? 0 : wob, sp.big ? 2 : 1);
            }
          }
        }
        if (!v.away) after.push(() => this.bird(parentId, v.x, v.y, v.at ? (Math.floor(v.ph / 260) % 2 ? 'peck' : 'perch') : v.f, v.face));
        break;
      }
      case 'pair': case 'lining': {
        after.push(() => {
          if (n.st === 'pair') {
            this.bird(sp.id, cx - hrx - 3, rimY + Math.round(Math.sin(t / 400)), (t % 2600) < 300 ? 'peck' : 'perch', 1);
            this.bird(sp.id, rimX, rimY + Math.round(Math.sin(t / 400 + 2)), (t % 3100) < 300 ? 'peck' : 'perch', -1);
            const hp = (t % 2400) / 2400;
            if (hp < 0.8) this.heart(cx, Math.round(rimY - 22 - hp * 8));
          }
        });
        if (n.st === 'lining') this.bird(sp.id, cx, sitY, 'perch', -1);
        break;
      }
      case 'cock':
        after.push(() => {
          this.bird(sp.id, rimX, rimY, 'perch', -1);
          for (let i = 0; i < 2; i++) { const p = ((t + i * 900) % 1800) / 1800; this.note(rimX - 4 + Math.round(p * 8), Math.round(rimY - 20 - p * 10)); }
        });
        break;
      case 'fledged':
        after.push(() => {
          this.bird(cu ? 'cuckoo' : sp.id, cx - hrx - 3, rimY, 'perch', 1);
          this.bird(sp.id, rimX, rimY, (t % 2600) < 400 ? 'peck' : 'perch', -1);
        });
        for (let i = 0; i < 3; i++) this.px(cx - 6 + i * 6, hy - 1 + (i % 2), '#f4f0e6', 2, 1);
        break;
      case 'built': {
        // nobody home yet: a curious bird drops by to look now and then once the spot is right
        if (this.okT == null || t - this.okT > 1000) { const c = nestCenter(S, n); this.ok = evalNest(S, sp, c[0], c[1], n.id).ok; this.okT = t; }
        if (this.ok && sp.breed.includes(S.time.season)) {
          const v = visit(9000, 5000, 5700, 7600, false);
          if (!v.away) after.push(() => this.bird(sp.id, v.x, v.y, v.at ? ((v.ph % 1200) < 300 ? 'peck' : 'perch') : v.f, v.face));
        }
        break;
      }
    }
    g.drawImage(L.front, 0, 0);
    for (const f of after) f();
    // night: the infra-red camera
    const clock = S.clock(), night = clock >= 21 * 60 || clock < 5 * 60;
    if (night) { g.fillStyle = 'rgba(40,60,50,0.45)'; g.globalCompositeOperation = 'saturation'; g.fillRect(0, 0, CAM_W, CAM_H); g.globalCompositeOperation = 'source-over'; g.fillRect(0, 0, CAM_W, CAM_H); }
    ui.g.drawImage(this.cv, x, y, CAM_W * 2, CAM_H * 2);
    // a little "live" sign, blinking
    if (Math.floor(t / 600) % 2) ui.rect(x + 4, y + 4, 3, 3, '#e8485a');
    ui.text(night ? 'IR CAM' : 'LIVE', x + 10, y + 2, '#ffffff', { outline: '#2a1a0e' });
  }
}
