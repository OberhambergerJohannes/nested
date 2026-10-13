'use strict';
// Procedural trees, shrubs and plants with seasonal looks. Each generator returns {px, ax, ay}
// where (ax, ay) is the anchor (centre of the base) inside the image.

const FOLIAGE = {
  oak: [
    { o: '#1e3d1c', d: '#3a7432', m: '#559a3e', l: '#7dbe55', h: '#acdc78' },
    { o: '#1a361a', d: '#2f662d', m: '#468637', l: '#64a646', h: '#8cc65e' },
    { o: '#4a240e', d: '#8a4520', m: '#b4652a', l: '#d8922f', h: '#f2c254' },
  ],
  birch: [
    { o: '#2a4a1c', d: '#5a9a3a', m: '#7cba4a', l: '#a2d466', h: '#cce88a' },
    { o: '#244218', d: '#4c8a34', m: '#68a842', l: '#8cc458', h: '#b4dc74' },
    { o: '#5a4210', d: '#b48a22', m: '#dcb032', l: '#f2d04c', h: '#fbe88a' },
  ],
  willow: [
    { o: '#2c4a18', d: '#6a9a34', m: '#8cb848', l: '#b2d462', h: '#d6ec8c' },
    { o: '#284418', d: '#5a8a30', m: '#78a83e', l: '#9cc456', h: '#c2dc7a' },
    { o: '#4e4818', d: '#a49a30', m: '#c8bc42', l: '#e2d65e', h: '#f2ea8a' },
  ],
  apple: [
    { o: '#1e3d1c', d: '#3e7a36', m: '#5aa044', l: '#80c05a', h: '#acdc7a' },
    { o: '#1a361a', d: '#336a2e', m: '#4c8c3a', l: '#6aaa4c', h: '#94c868' },
    { o: '#3a3410', d: '#7a7a2a', m: '#a09a36', l: '#c8b848', h: '#e6d46a' },
  ],
  pine: [
    { o: '#0e2a1c', d: '#1e4a32', m: '#2c6644', l: '#3e8256', h: '#5aa06a' },
    { o: '#0e2a1c', d: '#1e4a32', m: '#2c6644', l: '#3e8256', h: '#5aa06a' },
    { o: '#0e2a1c', d: '#1e4a32', m: '#2c6644', l: '#3e8256', h: '#5aa06a' },
    { o: '#0e2a1c', d: '#1e4a32', m: '#2c6644', l: '#3e8256', h: '#5aa06a' },
  ],
};
const BARK = {
  oak: { o: '#2a1c12', d: '#4a3424', m: '#6b4c34', l: '#8a6646' },
  birch: { o: '#3a3a3a', d: '#b8b2a6', m: '#e8e4dc', l: '#ffffff', k: '#2a2a2a' },
  willow: { o: '#2a2016', d: '#4a3c2c', m: '#6e5a40', l: '#8a7454' },
  pine: { o: '#2a160c', d: '#4a2c1c', m: '#7a4a2c', l: '#9a6440' },
  apple: { o: '#2a1c12', d: '#4a3424', m: '#6e5038', l: '#8c6a4a' },
  snag: { o: '#2e2a26', d: '#544c44', m: '#7a7066', l: '#9a9086' },
};
const SNOW = { s: '#f6f9fc', d: '#d4dde8' };

// One leafy clump: a bumpy ball lit from the upper left, with dithered light-to-shadow
// transitions and small leaf highlights so foliage reads as leaves, not as a smooth ball.
function drawClump(px, x, y, r, pal, flat) {
  const seed = Math.floor(x * 7.3 + y * 13.1 + r * 3);
  const bumps = 4 + (seed % 3);
  for (let yy = Math.floor(y - r * 1.2 - 1); yy <= Math.ceil(y + r * 1.2 + 1); yy++) for (let xx = Math.floor(x - r * 1.2 - 1); xx <= Math.ceil(x + r * 1.2 + 1); xx++) {
    const dx = (xx + 0.5 - x) / r, dy = (yy + 0.5 - y) / (r * (flat || 1));
    const d2 = dx * dx + dy * dy;
    const ang = Math.atan2(dy, dx);
    const edge = 1 + (r > 2.5 ? 0.13 * Math.sin(ang * bumps + seed) + 0.06 * Math.sin(ang * (bumps * 2 + 1) + seed * 0.7) : 0);
    if (d2 > edge * edge) continue;
    const n = hashf(xx, yy, seed & 1023);
    const lit = -(dx * 0.65 + dy * 0.8) + (n - 0.5) * 0.26;
    let col = pal.m;
    if (lit > 0.42) col = pal.l;
    if (lit > 0.82 && d2 > 0.12) col = pal.h;
    if (lit < -0.3) col = pal.d;
    if (lit < -0.78 && d2 > 0.45) col = pal.o;
    px.set(xx, yy, col);
  }
  // leaf highlights: small two-pixel strokes on the sunny side
  if (r >= 2.5) {
    const k = Math.round(r * 0.9);
    for (let i = 0; i < k; i++) {
      const a = -2.2 + hashf(seed, i, 7) * 1.9, d = 0.25 + hashf(i, seed, 9) * 0.55;
      const lx = Math.round(x + Math.cos(a) * r * d), ly = Math.round(y + Math.sin(a) * r * d * (flat || 1));
      if (!px.op(lx, ly) || !px.op(lx + 1, ly)) continue;
      px.set(lx, ly, pal.h); px.set(lx + 1, ly, pal.l);
      if (px.op(lx, ly + 1)) px.set(lx, ly + 1, pal.m);
    }
    // a few shadowed leaf edges on the far side
    for (let i = 0; i < Math.round(r * 0.6); i++) {
      const a = 0.6 + hashf(seed, i, 11) * 1.6, d = 0.35 + hashf(i, seed, 13) * 0.45;
      const lx = Math.round(x + Math.cos(a) * r * d), ly = Math.round(y + Math.sin(a) * r * d * (flat || 1));
      if (px.op(lx, ly) && px.op(lx + 1, ly)) { px.set(lx, ly, pal.d); px.set(lx + 1, ly, pal.d); }
    }
  }
}

function canopy(px, cx, cy, rx, ry, pal, rnd, n, r0, r1) {
  px.ellipse(cx, cy + 1, rx * 0.92, ry * 0.92, pal.d);
  const clumps = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
    const r = r0 + rnd() * r1;
    clumps.push({ x: cx + Math.cos(a) * (rx - r * 0.7) * d, y: cy + Math.sin(a) * (ry - r * 0.7) * d, r });
  }
  clumps.push({ x: cx - rx * 0.25, y: cy - ry * 0.35, r: r0 + r1 * 0.8 });
  clumps.sort((a, b) => a.y - b.y);
  for (const c of clumps) drawClump(px, c.x, c.y, c.r, pal);
  return clumps;
}

function trunk(px, cx, y0, y1, w, bark, roots) {
  for (let y = y1; y <= y0; y++) {
    const t = (y - y1) / Math.max(1, y0 - y1);
    const ww = Math.round(w - 1 + t * 1.2);
    const x0 = Math.round(cx - ww / 2);
    for (let x = 0; x < ww; x++) {
      let c = bark.m;
      if (x === 0) c = bark.l;
      else if (x >= ww - 2) c = bark.d;
      // furrowed bark: broken vertical grooves
      else if (!bark.k && (x % 2 === 1) && hashf(x0 + x, Math.floor(y / 3), 77) < 0.55) c = bark.d;
      px.set(x0 + x, y, c);
    }
    if (bark.k && (y * 7 + Math.floor(cx)) % 5 === 0) px.set(x0 + 1 + (y % 2), y, bark.k);
    if (bark.k && (y * 3 + Math.floor(cx)) % 11 === 0) { px.set(x0 + 1, y, bark.k); px.set(x0 + 2, y, bark.k); }
  }
  // shade under the canopy
  for (let y = y1; y < y1 + 3; y++) for (let x = Math.round(cx - w); x <= cx + w; x++) if (px.op(x, y)) px.set(x, y, y === y1 ? bark.o : bark.d);
  if (roots) {
    const x0 = Math.round(cx - w / 2);
    px.set(x0 - 1, y0, bark.d); px.set(x0 - 2, y0, bark.d); px.set(x0 + w, y0, bark.d); px.set(x0 + w + 1, y0, bark.d);
    px.set(x0 - 1, y0 - 1, bark.m); px.set(x0 + w, y0 - 1, bark.d);
  }
}

function bareBranches(px, x, y, ang, len, w, depth, rnd, col, tips) {
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  if (w >= 2) px.thick(x, y, x2, y2, w, col); else px.line(x, y, x2, y2, col);
  if (depth <= 0) { if (tips) tips.push([x2, y2]); return; }
  const n = 2 + (rnd() < 0.35 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = ang + (i - (n - 1) / 2) * 0.55 + (rnd() - 0.5) * 0.4;
    bareBranches(px, x2, y2, a, len * (0.62 + rnd() * 0.15), Math.max(1, w * 0.62), depth - 1, rnd, col, tips);
  }
}

function addSnowOnTop(px, chance, seed) {
  const src = px.p.slice();
  for (let y = 1; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    if (!(src[y * px.w + x] >>> 24)) continue;
    if (src[(y - 1) * px.w + x] >>> 24) continue;
    if (hashf(x, y, seed) < chance) { px.set(x, y, SNOW.s); px.set(x, y - 1, SNOW.s); }
  }
}

function sprinkle(px, n, cols, rnd, test) {
  for (let i = 0; i < n * 6 && n > 0; i++) {
    const x = Math.floor(rnd() * px.w), y = Math.floor(rnd() * px.h);
    if (!px.op(x, y) || (test && !test(x, y))) continue;
    px.set(x, y, cols[Math.floor(rnd() * cols.length)]);
    n--;
  }
}

// ---------------------------------------------------------------- trees
function genTree(kind, stage, season, fruit) {
  const rnd = artRng('tree' + kind + stage + season);
  const bark = BARK[kind] || BARK.oak;
  if (kind === 'snag') return genSnag();
  if (stage === 0) return genSapling(kind, season);
  const bare = season === WINTER && kind !== 'pine';
  if (kind === 'pine') return genPine(stage, season);
  const young = stage === 1;
  const dims = {
    oak: [42, 54, 17, 15, 20], birch: [34, 56, 12, 16, 22], willow: [46, 50, 19, 13, 22], apple: [38, 46, 15, 12, 18],
  }[kind];
  let [W, H, rx, ry, trunkH] = dims;
  if (young) { W = 26; H = 34; rx = 9; ry = 8; trunkH = 12; }
  const px = new Pix(W, H);
  const cx = W / 2, base = H - 2;
  const cy = base - trunkH - ry + 3;
  const tw = young ? 3 : kind === 'birch' ? 4 : kind === 'willow' ? 7 : 6;
  if (bare) {
    const fork = base - Math.round(trunkH * (young ? 0.8 : 0.75));
    trunk(px, cx, base, fork, tw, bark, !young);
    const tips = [];
    const col = kind === 'birch' ? bark.d : bark.m;
    const spread = kind === 'birch' ? 0.35 : 0.6;
    for (const a of young ? [-0.4, 0.4] : [-spread, 0, spread]) {
      bareBranches(px, cx + a * 3, fork + 1, -Math.PI / 2 + a, young ? 6 : ry * 0.75, young ? 1 : Math.max(2, tw * 0.5), young ? 1 : 3, rnd, col, tips);
    }
    if (kind === 'willow') for (const [x, y] of tips) px.line(x, y, x + (rnd() - 0.5) * 2, y + 6 + rnd() * 8, '#8a7a3a');
    px.outline(bark.o);
    addSnowOnTop(px, 0.55, 3);
    return { px, ax: Math.floor(cx), ay: base };
  }
  const pal = FOLIAGE[kind][season];
  trunk(px, cx, base, cy, tw, bark, !young);
  if (kind === 'willow' && !young) {
    // drooping curtain
    canopy(px, cx, cy - 2, rx, ry * 0.85, pal, rnd, 10, 4, 3);
    for (let x = Math.floor(cx - rx + 2); x <= cx + rx - 2; x++) {
      if (rnd() < 0.35) continue;
      const top = cy + Math.sqrt(Math.max(0, 1 - ((x + 0.5 - cx) / rx) ** 2)) * ry * 0.5;
      const len = 6 + rnd() * 12;
      px.line(x, top, x, Math.min(base - 4, top + len), rnd() < 0.5 ? pal.m : pal.l);
      if (rnd() < 0.5) px.set(x, Math.min(base - 4, top + len), pal.h);
    }
  } else {
    canopy(px, cx, cy, rx, ry, pal, rnd, young ? 5 : kind === 'birch' ? 11 : 13, young ? 3 : 4, young ? 2 : 3.5);
  }
  if (kind === 'birch' && !young) {
    // a few dangling twigs + catkins in spring
    if (season === SPRING) sprinkle(px, 10, ['#d8c84a', '#b8a83a'], rnd);
  }
  if (kind === 'apple' && season === SPRING) sprinkle(px, young ? 8 : 26, ['#fbe4ec', '#f4b8cc', '#ffffff'], rnd, (x, y) => y < base - trunkH);
  if (kind === 'oak' && season === SUMMER && !young) sprinkle(px, 6, [pal.h], rnd);
  if (fruit && kind === 'apple') {
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = 0.3 + rnd() * 0.55;
      const x = Math.round(cx + Math.cos(a) * rx * d), y = Math.round(cy + Math.sin(a) * ry * d + 2);
      px.rect(x, y, 2, 2, '#d8342a'); px.set(x, y, '#f07050');
    }
  }
  px.outline(pal.o);
  return { px, ax: Math.floor(cx), ay: base };
}

function genPine(stage, season) {
  const young = stage === 1;
  const W = young ? 20 : 34, H = young ? 30 : 58;
  const px = new Pix(W, H);
  const cx = W / 2, base = H - 2;
  const pal = FOLIAGE.pine[0], bark = BARK.pine;
  trunk(px, cx, base, base - (young ? 6 : 10), young ? 2 : 4, bark, !young);
  const tiers = young ? 3 : 4;
  const top = young ? 3 : 3;
  const tierH = young ? 8 : 12;
  for (let i = 0; i < tiers; i++) {
    const y0 = top + i * (tierH - 3) * (young ? 0.95 : 1);
    const y1 = y0 + tierH;
    const hw = (young ? 3 : 5) + i * (young ? 2 : 3.2);
    for (let y = Math.floor(y0); y <= y1; y++) {
      const t = (y - y0) / tierH;
      const w = hw * (0.25 + 0.75 * t);
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        const rel = (x + 0.5 - cx) / Math.max(1, w);
        let c = pal.m;
        if (rel < -0.45) c = pal.l;
        if (rel > 0.4) c = pal.d;
        if (y >= y1 - 1 && Math.abs(rel) > 0.2 && (x + y) % 3 === 0) c = pal.d;
        px.set(x, y, c);
      }
      if (y === Math.floor(y1)) for (let x = Math.floor(cx - hw); x <= cx + hw; x += 2) px.set(x, y + 1, pal.d);
    }
  }
  px.outline(pal.o);
  if (season === WINTER) addSnowOnTop(px, 0.75, 7);
  return { px, ax: Math.floor(cx), ay: base };
}

function genSnag() {
  const px = new Pix(24, 48);
  const bark = BARK.snag;
  const cx = 12, base = 46;
  trunk(px, cx, base, 8, 7, bark, true);
  // jagged broken top
  for (const [x, y] of [[9, 7], [10, 5], [11, 6], [12, 4], [13, 7], [14, 6], [15, 8]]) px.vline(x, y, 9, bark.m);
  px.thick(cx + 3, 20, cx + 9, 15, 2, bark.m);
  px.thick(cx - 3, 28, cx - 8, 24, 2, bark.d);
  px.line(cx + 9, 15, cx + 10, 13, bark.m);
  // peeling bark & fungus
  px.vline(cx - 2, 14, 22, bark.l);
  px.vline(cx + 1, 30, 38, bark.l);
  px.rect(cx + 3, 33, 3, 1, '#d8b060'); px.rect(cx + 3, 34, 2, 1, '#b08840');
  px.rect(cx + 3, 26, 2, 1, '#d8b060');
  px.outline(bark.o);
  return { px, ax: cx, ay: base };
}

function genSapling(kind, season) {
  const px = new Pix(16, 20);
  const pal = kind === 'pine' ? FOLIAGE.pine[0] : (season === WINTER ? null : FOLIAGE[kind] ? FOLIAGE[kind][season] : FOLIAGE.oak[season]);
  const bark = BARK[kind] || BARK.oak;
  px.ellipse(8, 18, 5, 1.6, '#6b4a32');
  px.vline(8, 7, 17, bark.m);
  px.vline(9, 9, 17, bark.d);
  // support stake
  px.vline(5, 9, 17, '#c8a070');
  px.set(6, 11, '#a8804a');
  if (kind === 'pine') {
    px.poly([[8, 3], [3, 12], [13, 12]], pal.m);
    px.line(8, 3, 3, 12, pal.l);
  } else if (pal) {
    drawClump(px, 6, 7, 2.5, pal); drawClump(px, 10.5, 6, 2.8, pal); drawClump(px, 8.5, 3.5, 2.2, pal);
  } else {
    px.set(7, 6, bark.m); px.set(10, 6, bark.m); px.set(8, 5, '#8a7a5a');
  }
  px.outline('#1d2a1a');
  if (season === WINTER) addSnowOnTop(px, 0.5, 11);
  return { px, ax: 8, ay: 18 };
}

// ---------------------------------------------------------------- shrubs
const SHRUB_PAL = {
  hawthorn: [
    { o: '#1a3418', d: '#2f5e2a', m: '#457e36', l: '#62a04a', h: '#88c466' },
    { o: '#18301a', d: '#2a5428', m: '#3e7032', l: '#568e42', h: '#78ae5a' },
    { o: '#3a2414', d: '#6a4a24', m: '#8a6a2e', l: '#a88a3a', h: '#c8aa52' },
  ],
  blackthorn: [
    { o: '#14261a', d: '#24442a', m: '#335e36', l: '#4a7a46', h: '#6a9a5c' },
    { o: '#14261a', d: '#24442a', m: '#335e36', l: '#4a7a46', h: '#6a9a5c' },
    { o: '#2a2018', d: '#4a3a24', m: '#6a5230', l: '#8a6c3c', h: '#a88c50' },
  ],
  bramble: [
    { o: '#1c3418', d: '#345e2a', m: '#4a7c38', l: '#64984a', h: '#86b464' },
    { o: '#1c3418', d: '#305626', m: '#447234', l: '#5c8e46', h: '#7aaa5c' },
    { o: '#2e1822', d: '#5a2e34', m: '#7a3e3a', l: '#9a5640', h: '#b8784e' },
  ],
  elder: [
    { o: '#1e3a1a', d: '#3c7032', m: '#548e40', l: '#70aa52', h: '#94c86e' },
    { o: '#1e3a1a', d: '#36662e', m: '#4c823c', l: '#669e4e', h: '#88bc66' },
    { o: '#3a3216', d: '#6e6428', m: '#908434', l: '#b0a444', h: '#ccc060' },
  ],
  hazel: [
    { o: '#1e3a1a', d: '#3a6e30', m: '#528c3e', l: '#6eaa50', h: '#92c66a' },
    { o: '#1e3a1a', d: '#346428', m: '#4a8036', l: '#649c48', h: '#86b862' },
    { o: '#4a3812', d: '#8a7022', m: '#b0922c', l: '#d0b23c', h: '#e8cc5a' },
  ],
};

function genShrub(kind, stage, season, fruit) {
  const rnd = artRng('shrub' + kind + stage + season);
  const sm = stage < 2;
  const W = sm ? 16 : 26, H = sm ? 16 : 24;
  const px = new Pix(W, H);
  const cx = W / 2, base = H - 2;
  const rx = sm ? (stage === 0 ? 4 : 6) : 11, ry = sm ? (stage === 0 ? 3.5 : 5) : 8.5;
  const cy = base - ry + 1;
  if (season === WINTER) {
    const col = kind === 'blackthorn' ? '#2e2620' : kind === 'bramble' ? '#5a3040' : '#5a4636';
    const tips = [];
    for (let i = -2; i <= 2; i++) bareBranches(px, cx + i * 1.5, base, -Math.PI / 2 + i * 0.32, sm ? 4 : 7, 1, sm ? 1 : 2, rnd, col, tips);
    if (kind === 'hazel' && !sm) for (const [x, y] of tips.slice(0, 7)) { px.vline(Math.round(x), Math.round(y), Math.round(y) + 2, '#d8c84a'); }
    if (kind === 'hawthorn' && !sm) for (const [x, y] of tips.slice(0, 5)) px.set(x, y, '#c02a2a');
    px.outline('#1d1a20');
    addSnowOnTop(px, 0.6, 13);
    return { px, ax: Math.floor(cx), ay: base };
  }
  const pal = SHRUB_PAL[kind][season];
  if (kind === 'bramble' && !sm) {
    // sprawling arching canes
    for (let i = 0; i < 6; i++) {
      const sx = cx + (rnd() - 0.5) * 6, ex = cx + (rnd() - 0.5) * 22, top = base - 8 - rnd() * 8;
      let lx = sx, ly = base;
      for (let t = 1; t <= 10; t++) {
        const x = sx + (ex - sx) * t / 10, y = base - Math.sin(Math.PI * t / 10) * (base - top) + (t > 5 ? (t - 5) * 0.6 : 0);
        px.line(lx, ly, x, y, '#6a3a4a'); lx = x; ly = y;
      }
    }
    canopy(px, cx, cy + 1, rx, ry - 1, pal, rnd, 10, 2.5, 2);
  } else {
    canopy(px, cx, cy, rx, ry, pal, rnd, sm ? 4 : 9, sm ? 2 : 3, sm ? 1.5 : 2.5);
  }
  const top = (x, y) => y < base - 2;
  if (!sm) {
    if (kind === 'hawthorn' && season === SPRING) sprinkle(px, 26, ['#ffffff', '#f4f0e6', '#fbe4ec'], rnd, top);
    if (kind === 'hawthorn' && season === AUTUMN) sprinkle(px, 14, ['#c02a2a', '#e04030'], rnd, top);
    if (kind === 'blackthorn' && season === SPRING) sprinkle(px, 30, ['#ffffff', '#f4f2ee'], rnd, top);
    if (kind === 'elder' && (season === SPRING || season === SUMMER) && !fruit) {
      for (let i = 0; i < 5; i++) { const x = cx - 7 + rnd() * 14, y = cy - 5 + rnd() * 6; px.rect(x, y, 3, 1, '#f6f0d0'); px.rect(x + 0.5, y - 1, 2, 1, '#fffbe6'); }
    }
    if (kind === 'bramble' && season === SUMMER && !fruit) sprinkle(px, 7, ['#f4d0e0', '#ffffff'], rnd, top);
    if (kind === 'hazel' && season === SPRING) for (let i = 0; i < 6; i++) { const x = Math.round(cx - 8 + rnd() * 16), y = Math.round(cy - 3 + rnd() * 6); px.vline(x, y, y + 2, '#d8c84a'); }
    if (fruit) {
      const fc = { blackthorn: ['#3a3a6a', '#5a5a9a'], bramble: ['#2a1a2a', '#4a2a4a'], elder: ['#1e1a24', '#3a2a40'], hazel: ['#9a6a2a', '#c08a3a'] }[kind];
      if (fc) for (let i = 0; i < 10; i++) {
        const x = Math.round(cx - rx * 0.7 + rnd() * rx * 1.4), y = Math.round(cy - ry * 0.5 + rnd() * ry);
        if (px.op(x, y)) { px.set(x, y, fc[0]); px.set(x + 1, y, fc[1]); }
      }
    }
  }
  // thorns
  if (FLORA[kind].thorny && !sm) px.outline(pal.o);
  else px.outline(pal.o);
  if (FLORA[kind].thorny && !sm) {
    const src = px.p.slice();
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * (H - 4));
      if (!(src[y * W + x] >>> 24)) continue;
      if (y > 0 && !(src[(y - 1) * W + x] >>> 24)) px.set(x, y - 1, pal.o);
    }
  }
  return { px, ax: Math.floor(cx), ay: base };
}

// ---------------------------------------------------------------- small plants
function genPlant(kind, stage, season, v) {
  const rnd = artRng('plant' + kind + stage + season + ':' + v);
  const px = new Pix(16, 24);
  const base = 22, cx = 8;
  const green = ['#4a8a3a', '#5aa048', '#78bc5a'];
  const dry = ['#8a7448', '#a89060', '#c8b080'];
  const g = season === WINTER ? dry : season === AUTUMN ? ['#7a8a3a', '#9a9a48', '#b8aa5a'] : green;
  if (stage === 0) {
    px.line(8, base, 7, base - 3, g[0]); px.line(8, base, 10, base - 2, g[1]); px.set(7, base - 4, g[2]);
    if (kind === 'reed' || kind === 'cattail') px.line(9, base, 9, base - 5, g[1]);
    px.outline('#1d2a1a');
    return { px, ax: cx, ay: base };
  }
  const k = stage === 1 ? 0.6 : 1;
  switch (kind) {
    case 'wildflower': {
      const cols = [['#e8402e', '#f06a50'], ['#4a6ae0', '#7a96f4'], ['#ffffff', '#f4e46a'], ['#f2d040', '#fff09a'], ['#c070d8', '#e0a0f0']];
      for (let i = 0; i < 7; i++) {
        const x = 3 + rnd() * 10, h = (6 + rnd() * 9) * k;
        px.line(x, base, x + (rnd() - 0.5) * 2, base - h, g[i % 2]);
        if (stage === 2 && (season === SPRING || season === SUMMER)) {
          const c = cols[Math.floor(rnd() * cols.length)];
          const fx = Math.round(x), fy = Math.round(base - h);
          px.set(fx, fy, c[0]); px.set(fx - 1, fy, c[0]); px.set(fx + 1, fy, c[0]); px.set(fx, fy - 1, c[0]); px.set(fx, fy + 1, c[0]); px.set(fx, fy, c[1]);
        } else if (season === AUTUMN) px.set(Math.round(x), Math.round(base - h), '#6a4a2a');
      }
      for (let i = 0; i < 4; i++) { const x = 3 + rnd() * 10; px.line(x, base, x + 2, base - 3, g[2]); }
      break;
    }
    case 'thistle': {
      // spiny rosette
      for (const [dx, dy] of [[-5, -2], [5, -2], [-3, -4], [3, -4], [-6, 0], [6, 0]]) px.line(cx, base, cx + dx, base + dy, '#6a9a6a');
      for (const [dx, dy] of [[-5, -3], [5, -3], [-6, -1], [6, -1]]) px.set(cx + dx, base + dy, '#a8c8a0');
      if (season !== SPRING || stage === 2) {
        const tall = (season === SPRING ? 8 : 15) * k;
        px.line(cx, base, cx, base - tall, '#5a8a5a');
        px.line(cx, base - tall * 0.6, cx + 4, base - tall * 0.8, '#5a8a5a');
        if (stage === 2 && season !== SPRING) {
          const heads = [[cx, base - tall], [cx + 4, base - tall * 0.8]];
          for (const [hx, hy] of heads) {
            const x = Math.round(hx), y = Math.round(hy);
            if (season === SUMMER) {
              px.rect(x - 1, y, 3, 2, '#5a8a5a'); px.rect(x - 1, y - 2, 3, 2, '#b048c8'); px.set(x, y - 3, '#d070e0'); px.set(x - 1, y - 3, '#9a38b0'); px.set(x + 1, y - 3, '#9a38b0');
            } else if (season === AUTUMN) {
              px.rect(x - 1, y, 3, 2, '#8a8a5a'); px.ellipse(x + 0.5, y - 2, 2.6, 2.2, '#f4f0e6'); px.set(x, y - 3, '#ffffff');
            } else { px.rect(x - 1, y - 1, 3, 3, '#8a7448'); }
          }
        }
      }
      break;
    }
    case 'herbs': {
      const sub = v % 3;
      if (sub === 0) { // lavender
        for (let i = 0; i < 8; i++) { const x = 3 + rnd() * 10, h = (7 + rnd() * 6) * k; px.line(x, base, x + (rnd() - 0.5) * 3, base - h, i % 2 ? '#8aa088' : '#a8bca4'); if (stage === 2 && season === SUMMER) px.vline(Math.round(x + (rnd() - 0.5)), Math.round(base - h - 2), Math.round(base - h), '#8a5ad0'); else if (stage === 2 && season !== WINTER) px.set(Math.round(x), Math.round(base - h), '#a88ad8'); }
      } else if (sub === 1) { // mint
        for (let i = 0; i < 7; i++) { const x = 3 + rnd() * 10, h = (4 + rnd() * 6) * k; px.line(x, base, x, base - h, '#3a8a3a'); px.rect(Math.round(x) - 1, Math.round(base - h), 3, 2, season === WINTER ? '#8a7448' : '#5ac05a'); px.set(Math.round(x), Math.round(base - h), '#8ae07a'); }
      } else { // yarrow
        for (let i = 0; i < 6; i++) { const x = 3 + rnd() * 10, h = (7 + rnd() * 7) * k; px.line(x, base, x, base - h, '#5a8a4a'); if (stage === 2 && season !== WINTER) { px.rect(Math.round(x) - 1, Math.round(base - h) - 1, 4, 2, '#f4f0e6'); px.set(Math.round(x), Math.round(base - h) - 1, '#ffffff'); } }
        for (let i = 0; i < 5; i++) { const x = 3 + rnd() * 10; px.line(x, base, x + 2, base - 4, '#7aaa5a'); }
      }
      break;
    }
    case 'reed': {
      const stemC = season === WINTER ? '#c8b07a' : season === AUTUMN ? '#a8a058' : '#5a9a48';
      for (let i = 0; i < 7; i++) {
        const x = 2 + rnd() * 12, h = (13 + rnd() * 8) * k;
        px.line(x, base, x + (rnd() - 0.5) * 2, base - h, i % 2 ? stemC : darken(stemC, 0.2));
        // leaves
        px.line(x, base - h * 0.5, x + (rnd() < 0.5 ? -3 : 3), base - h * 0.4, stemC);
        if (stage === 2 && season !== SPRING) {
          const tx = Math.round(x), ty = Math.round(base - h);
          const pc = season === SUMMER ? ['#7a4a5a', '#9a6a72'] : season === AUTUMN ? ['#b89a7a', '#d8c4a4'] : ['#e8dcc4', '#f4ecdc'];
          px.rect(tx - 1, ty - 3, 2, 4, pc[0]); px.set(tx, ty - 4, pc[1]); px.set(tx + 1, ty - 2, pc[1]);
        }
      }
      break;
    }
    case 'cattail': {
      const leafC = season === WINTER ? '#b8a070' : season === AUTUMN ? '#9a9a48' : '#4a8a3a';
      for (let i = 0; i < 6; i++) { const x = 3 + rnd() * 10, h = (10 + rnd() * 8) * k; px.line(x, base, x + (rnd() - 0.5) * 4, base - h, i % 2 ? leafC : lighten(leafC, 0.2)); }
      if (stage === 2 && season !== SPRING) {
        for (const x of [6, 10]) {
          const top = base - 18 * k - (x === 10 ? 2 : 0);
          px.vline(x, top - 3, base, '#5a7a3a');
          if (season === SUMMER) { px.rect(x - 1, top, 3, 5, '#6a3e22'); px.vline(x - 1, top, top + 4, '#8a5432'); }
          else { px.rect(x - 1, top, 3, 5, '#7a5a3a'); px.ellipse(x + 0.5, top + 1, 3, 2.5, '#f4f0e6'); px.set(x + 2, top - 1, '#ffffff'); }
        }
      }
      break;
    }
  }
  px.outline('#1d2a1a');
  if (season === WINTER) addSnowOnTop(px, 0.35, 17);
  return { px, ax: cx, ay: base };
}
