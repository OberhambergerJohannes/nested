'use strict';
// Buildings, structures, natural props, forage items and nests. Generators return {px, ax, ay}:
// for 1x1 objects the anchor is the bottom-centre of the tile; for buildings it is the top-left of
// the footprint (ax, ay = pixel offset of the footprint's top-left corner inside the image).

const WOOD = { o: '#2e1c10', d: '#5a3a22', m: '#8a5a34', l: '#a8743f', h: '#c89458' };
const STONE = { o: '#2c2a30', d: '#5a5862', m: '#7e7c86', l: '#a4a2aa', h: '#c8c6cc' };

// ---------------------------------------------------------------- structures
function genStruct(kind, season) {
  const px = new Pix(kind === 'platform' ? 34 : kind === 'owlbox' ? 24 : kind === 'brushpile' ? 26 : 18, kind === 'platform' ? 62 : kind === 'owlbox' ? 46 : 34);
  const cx = Math.floor(px.w / 2), base = px.h - 2;
  const pole = (x, top) => { px.rect(x - 1, top, 3, base - top + 1, WOOD.m); px.vline(x - 1, top, base, WOOD.l); px.vline(x + 1, top, base, WOOD.d); px.rect(x - 2, base - 1, 5, 2, '#5a4a3a'); };
  switch (kind) {
    case 'box_small': case 'box_medium': case 'box_large': case 'box_open': {
      pole(cx, 16);
      px.rect(cx - 5, 5, 11, 13, '#b07a42');
      px.vline(cx - 5, 5, 17, '#c8945a'); px.vline(cx + 5, 5, 17, '#8a5a30');
      px.hline(cx - 5, cx + 5, 17, '#7a4e2a');
      px.poly([[cx - 7, 6], [cx + 7, 6], [cx + 6, 2], [cx - 6, 2]], '#5a3e26');
      px.hline(cx - 6, cx + 6, 2, '#7a5a3a');
      if (kind === 'box_open') { px.rect(cx - 4, 7, 9, 5, '#2a1a10'); px.hline(cx - 4, cx + 4, 12, '#8a5a30'); }
      else if (kind === 'box_small') { px.ellipse(cx, 10, 1.4, 1.4, '#1a120c'); }
      else if (kind === 'box_medium') { px.ellipse(cx, 10, 2, 2, '#1a120c'); }
      else { px.ellipse(cx, 10, 2.8, 2.8, '#6e5236'); px.ellipse(cx, 10, 2.2, 2.2, '#1a120c'); }
      px.set(cx + 3, 15, '#5a3e26');
      if (season === WINTER) px.hline(cx - 6, cx + 6, 1, '#f4f8fb');
      break;
    }
    case 'owlbox': {
      pole(cx, 24);
      px.rect(cx - 9, 6, 19, 19, '#9a6a3a');
      px.vline(cx - 9, 6, 24, '#b8844e'); px.vline(cx + 9, 6, 24, '#74482a');
      px.poly([[cx - 11, 7], [cx + 11, 7], [cx + 9, 1], [cx - 9, 1]], '#5a3e26');
      px.rect(cx - 5, 10, 10, 8, '#1a120c');
      px.rect(cx - 7, 19, 14, 2, '#74482a');
      if (season === WINTER) px.hline(cx - 9, cx + 9, 1, '#f4f8fb');
      break;
    }
    case 'platform': {
      pole(cx, 14);
      // cartwheel seen at an angle
      px.ellipse(cx, 11, 15, 6, '#5a3a22');
      px.ellipse(cx, 11, 13, 4.5, '#a8743f');
      px.ellipse(cx, 11, 11, 3.2, '#7a5a3a');
      for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; px.line(cx, 11, cx + Math.cos(t) * 12, 11 + Math.sin(t) * 4, '#c89458'); }
      px.ellipse(cx, 11, 2, 1.2, '#5a3a22');
      px.line(cx - 8, 18, cx, 24, WOOD.d); px.line(cx + 8, 18, cx, 24, WOOD.d);
      if (season === WINTER) px.hline(cx - 12, cx + 12, 6, '#f4f8fb');
      break;
    }
    case 'bank': {
      // steep earthen wall
      px.rect(1, 12, 16, base - 11, '#a8764a');
      for (let y = 12; y <= base; y++) for (let x = 1; x < 17; x++) {
        const n = valueNoise(x * 0.6, y * 0.3, 55);
        px.set(x, y, y % 5 === 0 ? '#8a5e38' : n > 0.6 ? '#c8945e' : n < 0.3 ? '#94643c' : '#b07c4c');
      }
      px.rect(0, 9, 18, 4, season === WINTER ? '#f4f8fb' : '#5aa048');
      for (let x = 0; x < 18; x += 2) px.set(x, 8, season === WINTER ? '#dfe7f0' : '#7cbc58');
      px.vline(4, 13, 16, '#5a3a22'); px.vline(13, 13, 15, '#5a3a22');
      break;
    }
    case 'brushpile': {
      const rnd = artRng('brush');
      for (let i = 0; i < 16; i++) {
        const y = base - rnd() * 12, x0 = 1 + rnd() * 10, x1 = x0 + 8 + rnd() * 12;
        px.thick(x0, y, x1, y - 2 + rnd() * 4, rnd() < 0.4 ? 2 : 1, i % 3 ? '#7a5a3a' : '#5a3e26');
      }
      const lc = season === AUTUMN ? ['#c8662a', '#e09a3a'] : season === WINTER ? ['#f4f8fb', '#dfe7f0'] : ['#8a6a3a', '#a8844a'];
      sprinkle(px, 18, lc, rnd);
      break;
    }
    case 'anvil': {
      px.ellipse(cx, base - 3, 7, 3.5, STONE.m);
      px.ellipse(cx - 1, base - 4, 5, 2, STONE.l);
      px.set(cx - 3, base - 5, STONE.h);
      // broken snail shells
      for (const [x, y] of [[cx - 7, base], [cx + 6, base - 1], [cx + 3, base + 1], [cx - 4, base + 1]]) {
        px.set(x, y, '#e8c87a'); px.set(x + 1, y, '#8a5a2a'); px.set(x, y - 1, '#c8a05a');
      }
      break;
    }
    case 'birdbath': {
      px.rect(cx - 2, base - 10, 5, 10, STONE.m); px.vline(cx - 2, base - 10, base, STONE.l);
      px.rect(cx - 4, base - 1, 9, 2, STONE.d);
      px.ellipse(cx, base - 12, 7, 3, STONE.l);
      px.ellipse(cx, base - 12.5, 5.5, 2, season === WINTER ? '#d4ecf6' : '#5eb6d6');
      px.set(cx - 2, base - 13, '#ffffff');
      break;
    }
  }
  px.outline('#22180f');
  return { px, ax: cx, ay: base };
}

// ---------------------------------------------------------------- natural props
function genRock(kind, level, season) {
  if (kind === 'boulder') {
    const px = new Pix(22, 18);
    px.poly([[2, 14], [3, 8], [6, 4], [11, 2], [16, 3.5], [19.5, 8], [20.5, 13], [17.5, 16.5], [5, 16.5]], STONE.m);
    // lit top facet and shaded right face
    px.poly([[4, 8.5], [7, 4.5], [11, 3], [15, 4.5], [13.5, 8.5], [8, 9.5]], STONE.l);
    px.poly([[13.5, 8.5], [15.5, 4.5], [19, 8], [20, 13], [17, 15.5], [14.5, 12]], STONE.d);
    px.line(7, 4, 11, 2, STONE.h); px.line(11, 2, 15, 3, STONE.h); px.set(5, 6, STONE.h);
    px.line(8, 10, 9, 14, STONE.d); px.set(10, 12, STONE.d);
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
      if (!px.op(x, y)) continue;
      const r = hashf(x, y, 31);
      if (r < 0.07) px.set(x, y, STONE.d); else if (r > 0.95) px.set(x, y, STONE.l);
    }
    for (let x = 4; x < 19; x++) px.set(x, 16 - Math.round(Math.abs(x - 11) * 0.12), STONE.o);
    if (level > 0) {
      const rnd = artRng('lichen' + level);
      for (let i = 0; i < level * 4; i++) {
        const x = 4 + Math.floor(rnd() * 12), y = 3 + Math.floor(rnd() * 8);
        const c = rnd() < 0.55 ? '#e0a830' : '#b8c87a';
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 1], [1, 1]]) if (rnd() < 0.75 && px.op(x + dx, y + dy)) px.set(x + dx, y + dy, (dx + dy) % 2 ? darken(c, 0.15) : c);
      }
    }
    if (season === WINTER) { px.poly([[5, 7], [7, 3.5], [11, 2], [16, 3.5], [14, 6], [9, 7.5]], '#f4f8fb'); px.hline(8, 12, 7, '#dbe5ef'); }
    px.outline(STONE.o);
    return { px, ax: 11, ay: 16 };
  }
  const px = new Pix(16, 14);
  px.ellipse(8, 8, 7, 5.5, STONE.m);
  px.ellipse(7, 6.5, 4.5, 3, STONE.l);
  px.ellipse(10, 10, 4, 2.4, STONE.d);
  px.set(5, 5, STONE.h);
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (px.op(x, y) && hashf(x, y, 33) < 0.08) px.set(x, y, STONE.d);
  if (level > 0) {
    const mc = season === WINTER ? ['#5a7a4a', '#6a8a5a', '#8aa87a'] : ['#3e7a2a', '#5aa03a', '#8ccc4a'];
    const n = level === 2 ? 3.5 : 2.2;
    for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) {
      const dx = (x + 0.5 - 7) / 6.2, dy = (y + 0.5 - 4.6) / n;
      const e = 1 + 0.18 * Math.sin(Math.atan2(dy, dx) * 6);
      if (dx * dx + dy * dy > e * e) continue;
      const lit = -(dx * 0.6 + dy * 0.8) + (hashf(x, y, 35) - 0.5) * 0.5;
      px.set(x, y, lit > 0.35 ? mc[2] : lit > -0.3 ? mc[1] : mc[0]);
    }
    if (level === 2 && season !== WINTER) { px.set(4, 2, '#c8e070'); px.set(9, 2, '#c8e070'); px.vline(11, 1, 2, '#8a6a3a'); px.set(11, 0, '#d8b850'); }
  }
  if (season === WINTER) px.ellipse(8, 3, 4, 1.4, '#f4f8fb');
  px.outline(STONE.o);
  return { px, ax: 8, ay: 12 };
}

function genLog(moss, season) {
  const px = new Pix(34, 16);
  const B = { d: '#4a3424', m: '#6b4c34', l: '#8a6646', h: '#a8805a' };
  for (let y = 5; y <= 12; y++) for (let x = 2; x <= 29; x++) {
    let c = y === 5 ? B.h : y <= 7 ? B.l : y >= 11 ? B.d : B.m;
    // furrowed bark
    if (y > 5 && y < 12 && hashf(Math.floor(x / 3), y, 41) < 0.35 && (x + y) % 3 === 0) c = B.d;
    if (y === 9 && hashf(x, 3, 43) < 0.5) c = B.d;
    px.set(x, y, c);
  }
  // end grain with growth rings
  px.ellipse(30, 9, 3.2, 4.6, '#c8a070');
  px.ellipse(30, 9, 2.2, 3.3, '#b08a58'); px.ellipse(30, 9, 1.4, 2.2, '#c8a070'); px.set(30, 9, '#8a6a3a'); px.set(30, 10, '#8a6a3a');
  px.line(29, 6, 31, 12, '#8a6a3a');
  // broken branch stub and the far end
  px.rect(12, 3, 3, 3, B.l); px.set(12, 3, B.h); px.set(14, 4, B.d);
  px.line(2, 6, 1, 12, B.d);
  if (moss > 0) {
    const mc = season === WINTER ? ['#5a7a4a', '#7a9a6a', '#9ab88a'] : ['#3e7a2a', '#5aa03a', '#8ccc4a'];
    for (let x = 4; x < 4 + moss * 9; x++) {
      const t = hashf(x, 7, 45);
      px.set(x, 5, mc[1]); px.set(x, 4, t < 0.6 ? mc[2] : mc[1]);
      if (t < 0.4) px.set(x, 3, mc[1]);
      if (t > 0.7) px.set(x, 6, mc[0]);
    }
  }
  // little mushrooms
  px.rect(10, 13, 1, 2, '#e8dcc0'); px.rect(9, 12, 3, 1, '#c84a2a'); px.set(10, 12, '#e86a4a');
  px.rect(19, 13, 1, 2, '#e8dcc0'); px.rect(18, 12, 2, 1, '#d8a050');
  if (season === WINTER) { px.hline(4, 28, 4, '#f4f8fb'); px.hline(6, 26, 3, '#f4f8fb'); }
  px.outline('#22160e');
  return { px, ax: 0, ay: 0 };
}

function genStump(moss, season) {
  const px = new Pix(16, 16);
  const B = { d: '#4a3424', m: '#6b4c34', l: '#8a6646' };
  for (let y = 6; y <= 13; y++) for (let x = 3; x <= 12; x++) {
    let c = x === 3 ? B.l : x >= 11 ? B.d : B.m;
    if (x > 3 && x < 11 && x % 2 === 0 && hashf(x, Math.floor(y / 2), 51) < 0.6) c = B.d;
    px.set(x, y, c);
  }
  // roots
  px.set(2, 13, B.d); px.set(1, 13, B.d); px.set(2, 12, B.m); px.set(13, 13, B.d); px.set(14, 13, B.d); px.set(13, 12, B.d);
  // cut top with growth rings and a crack
  px.ellipse(8, 6, 5, 2.5, '#c8a070'); px.ellipse(8, 6, 3.6, 1.7, '#b08a58'); px.ellipse(8, 6, 2.2, 1, '#c8a070'); px.set(8, 6, '#8a6a3a');
  px.line(8, 5, 11, 7, '#8a6a3a');
  if (moss > 0) {
    const mc = season === WINTER ? ['#5a7a4a', '#7a9a6a'] : ['#3e7a2a', '#5aa03a', '#8ccc4a'];
    px.rect(3, 9, 3, 4, mc[1]); px.set(4, 8, mc[1]); px.set(3, 12, mc[0]); px.set(5, 10, mc[0]);
    if (mc[2]) { px.set(3, 9, mc[2]); px.set(4, 8, mc[2]); }
  }
  if (season === WINTER) px.ellipse(8, 5, 5, 1.6, '#f4f8fb');
  px.outline('#22160e');
  return { px, ax: 8, ay: 14 };
}

function genFenceParts(season) {
  const post = new Pix(16, 20);
  post.rect(6, 5, 4, 14, WOOD.m);
  for (let y = 5; y < 19; y++) { post.set(6, y, WOOD.l); post.set(9, y, WOOD.d); if (hashf(7, y, 61) < 0.3) post.set(7, y, WOOD.d); if (hashf(8, y, 62) < 0.25) post.set(8, y, WOOD.l); }
  post.rect(6, 3, 4, 2, WOOD.l); post.set(7, 2, WOOD.h); post.set(8, 2, WOOD.l); post.hline(6, 9, 3, WOOD.h);
  post.set(7, 9, '#3a3a40'); post.set(7, 14, '#3a3a40');
  post.rect(5, 18, 6, 1, '#5a4a3a');
  if (season === WINTER) { post.hline(7, 8, 1, '#f4f8fb'); post.hline(6, 9, 2, '#f4f8fb'); }
  post.outline(WOOD.o);
  const railH = new Pix(16, 20);
  for (const y of [8, 13]) {
    railH.rect(0, y, 16, 2, WOOD.l); railH.hline(0, 15, y + 1, WOOD.d);
    for (let x = 0; x < 16; x++) if (hashf(x, y, 63) < 0.2) railH.set(x, y, WOOD.m);
    if (season === WINTER) railH.hline(0, 15, y - 1, '#f4f8fb');
  }
  const railV = new Pix(16, 20);
  railV.rect(7, 0, 2, 20, WOOD.l); railV.vline(8, 0, 19, WOOD.d);
  for (let y = 0; y < 20; y++) if (hashf(7, y, 64) < 0.2) railV.set(7, y, WOOD.m);
  return { post, railH, railV };
}

// ---------------------------------------------------------------- forage
function genForage(kind, season) {
  const px = new Pix(16, 14);
  switch (kind) {
    case 'twig': px.line(3, 10, 12, 6, '#7a5a3a'); px.line(8, 8, 10, 4, '#7a5a3a'); px.line(5, 9, 4, 6, '#8a6a46'); px.set(10, 4, '#5aa048'); break;
    case 'stick': px.thick(1, 10, 14, 6, 2, '#6b4c34'); px.line(9, 7, 12, 3, '#6b4c34'); px.line(2, 9, 13, 5, '#8a6646'); break;
    case 'leaves': {
      const cols = season === AUTUMN ? ['#c8662a', '#e09a3a', '#a4482a', '#d8b040'] : season === SUMMER ? ['#8a6a3a', '#a8844a', '#6a8a3a'] : ['#8a6a3a', '#a8844a', '#7a5a2a'];
      const rnd = artRng('leaves' + season);
      px.ellipse(8, 10, 6.5, 3, cols[0]);
      for (let i = 0; i < 18; i++) { const x = 2 + Math.floor(rnd() * 12), y = 7 + Math.floor(rnd() * 6); if (px.op(x, y)) px.set(x, y, cols[i % cols.length]); }
      for (let i = 0; i < 3; i++) px.set(3 + i * 4, 7, cols[(i + 1) % cols.length]);
      break;
    }
    case 'feather': px.line(5, 12, 11, 3, '#f4f2ee'); px.line(6, 12, 12, 4, '#d8d6d0'); px.line(4, 11, 10, 3, '#ffffff'); px.line(5, 13, 6, 11, '#8a8a8a'); px.set(11, 3, '#c8c6c0'); break;
    case 'stone': px.ellipse(8, 10, 4, 2.6, STONE.m); px.ellipse(7, 9, 2.5, 1.5, STONE.l); break;
    case 'driftwood': px.thick(2, 10, 14, 8, 3, '#c8bca8'); px.line(3, 9, 13, 7, '#e8e0d0'); px.set(14, 7, '#a89c88'); px.line(10, 8, 12, 5, '#c8bca8'); break;
    case 'mushroom': px.rect(7, 8, 2, 4, '#f2e2b0'); px.ellipse(8, 7.5, 4, 2.5, '#f2b02a'); px.ellipse(7, 7, 2, 1, '#f8d060'); px.rect(11, 10, 1, 2, '#f2e2b0'); px.ellipse(11.5, 9.5, 1.8, 1.2, '#f2b02a'); break;
    case 'garlic': for (const [a, b] of [[4, 4], [8, 2], [12, 5]]) px.thick(8, 12, a, b, 2, '#4a9a3a'); px.set(8, 2, '#ffffff'); px.set(7, 1, '#ffffff'); px.set(9, 1, '#ffffff'); px.set(4, 4, '#3a8a2a'); break;
    case 'note': px.rect(3, 4, 10, 8, '#f6eed8'); px.hline(4, 11, 6, '#b0a080'); px.hline(4, 9, 8, '#b0a080'); px.poly([[9, 4], [13, 4], [13, 8]], '#e2d6b8'); px.ellipse(5, 10, 1.6, 1.6, '#c83a2a'); break;
  }
  px.outline('#2a2018');
  return { px, ax: 8, ay: 12 };
}

function genWeb() {
  const px = new Pix(16, 16);
  const c = '#ffffff';
  for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; px.line(8, 8, 8 + Math.cos(t) * 7, 8 + Math.sin(t) * 7, c); }
  for (const r of [2.5, 4.5, 6.5]) for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; px.set(8 + Math.cos(t) * r, 8 + Math.sin(t) * r, c); }
  const out = new Pix(16, 16);
  for (let i = 0; i < px.p.length; i++) if (px.p[i]) out.p[i] = C('#ffffff', 0.55);
  for (const [x, y] of [[4, 5], [11, 9], [8, 2], [5, 12]]) out.set(x, y, '#e8f8ff');
  return { px: out, ax: 8, ay: 14 };
}

function genPuddle() {
  const px = new Pix(18, 12);
  px.ellipse(9, 6, 8, 4.5, '#5e4630');
  px.ellipse(9, 6, 6.5, 3.2, '#6a7a8a');
  px.ellipse(8, 5, 4, 1.6, '#8a9aaa');
  px.set(6, 5, '#c8d8e8'); px.set(7, 5, '#c8d8e8');
  return { px, ax: 9, ay: 9 };
}

// ---------------------------------------------------------------- nests
function genNest(type) {
  let px;
  const twig = '#7a5a3a', twigD = '#5a3e26', grass = '#c8a86a', grassD = '#a08448', mud = '#6e5236', mudL = '#8a6a48';
  switch (type) {
    case 'cup': case 'cupmud': case 'cupfine': case 'conifer': {
      px = new Pix(14, 8);
      const base = type === 'cupfine' ? '#8a9a7a' : type === 'conifer' ? '#6a5a3a' : grass;
      const dark = type === 'cupfine' ? '#6a7a5a' : type === 'conifer' ? '#4a3a24' : grassD;
      px.ellipse(7, 4, 6.5, 3.5, base);
      px.ellipse(7, 3, 5, 1.6, type === 'cupmud' ? mud : dark);
      for (let x = 1; x < 13; x += 2) px.set(x, 5 + (x % 4 === 1 ? 1 : 0), dark);
      if (type === 'cupfine') { px.set(3, 4, '#d8dcc8'); px.set(10, 5, '#d8dcc8'); px.set(6, 6, '#f4f0e6'); }
      if (type !== 'cupfine') { px.line(0, 3, 3, 5, twig); px.line(13, 4, 10, 6, twig); }
      break;
    }
    case 'twigs': {
      px = new Pix(16, 6);
      for (let i = 0; i < 6; i++) px.line(1 + i, 2 + (i % 2), 9 + i, 4 - (i % 2), i % 2 ? twig : twigD);
      break;
    }
    case 'dome': case 'domelichen': {
      px = new Pix(14, 14);
      const c1 = type === 'dome' ? '#7a8a4a' : '#8a9a8a', c2 = type === 'dome' ? '#8a6a3a' : '#c8ccbc';
      px.ellipse(7, 7, 6, type === 'dome' ? 6 : 6.5, c1);
      const rnd = artRng('dome' + type);
      for (let i = 0; i < 20; i++) { const x = 1 + Math.floor(rnd() * 12), y = 1 + Math.floor(rnd() * 12); if (px.op(x, y)) px.set(x, y, i % 2 ? c2 : darken(c1, 0.2)); }
      px.ellipse(type === 'dome' ? 7 : 7, type === 'dome' ? 7 : 4, 2, 2, '#1e160e');
      break;
    }
    case 'mudcup': {
      px = new Pix(12, 7);
      px.ellipse(6, 2, 5.5, 4.5, mud);
      px.rect(0, 0, 12, 2, 0);
      for (let y = 2; y < 7; y++) for (let x = 0; x < 12; x++) if (px.op(x, y) && (x + y) % 2 === 0) px.set(x, y, mudL);
      px.hline(1, 10, 1, '#d8d0c0');
      break;
    }
    case 'muddome': {
      px = new Pix(12, 10);
      px.ellipse(6, 3, 5.5, 6.5, mud);
      px.rect(0, 0, 12, 1, 0);
      for (let y = 1; y < 10; y++) for (let x = 0; x < 12; x++) if (px.op(x, y) && (x * 3 + y) % 4 === 0) px.set(x, y, mudL);
      px.ellipse(7, 3, 1.5, 1.2, '#1e160e');
      break;
    }
    case 'reedcup': {
      px = new Pix(10, 12);
      px.ellipse(5, 6, 4, 4.5, grass);
      px.ellipse(5, 3, 3, 1.2, grassD);
      for (const x of [2, 5, 8]) px.vline(x, 0, 11, '#8a9a4a');
      px.set(4, 8, '#e8e0d0'); px.set(6, 5, '#e8e0d0');
      break;
    }
    case 'pouch': {
      px = new Pix(12, 20);
      px.line(6, 0, 6, 4, twig);
      px.ellipse(6, 11, 5, 7, '#e2d6b8');
      px.ellipse(5, 9, 3, 4, '#f2eadb');
      for (let i = 0; i < 6; i++) px.set(3 + (i * 3) % 7, 7 + i * 2, '#c8b894');
      px.rect(9, 6, 3, 2, '#d0c2a0'); px.set(11, 7, '#1e160e');
      break;
    }
    case 'scrape': {
      px = new Pix(16, 8);
      px.ellipse(8, 4, 7.5, 3.5, '#8a7a4a');
      px.ellipse(8, 4, 5.5, 2.2, '#6a5a34');
      for (const [x, y] of [[3, 3], [12, 3], [5, 5], [11, 5], [8, 2]]) px.set(x, y, '#f4f2ee');
      break;
    }
    case 'sticks': {
      px = new Pix(36, 14);
      px.ellipse(18, 7, 17, 6, '#6b4c34');
      px.ellipse(18, 5, 13, 3, '#8a7a4a');
      const rnd = artRng('sticks');
      for (let i = 0; i < 22; i++) { const x0 = rnd() * 30, y0 = 4 + rnd() * 8; px.line(x0, y0, x0 + 6 + rnd() * 8, y0 + (rnd() - 0.5) * 4, i % 2 ? '#7a5a3a' : '#4a3424'); }
      px.ellipse(18, 4.5, 9, 1.8, '#a89a6a');
      break;
    }
    case 'pebbles': {
      px = new Pix(14, 7);
      px.ellipse(7, 3.5, 6.5, 3, '#9a8a6a');
      px.ellipse(7, 3.5, 4.5, 1.8, '#7a6a4e');
      for (const [x, y, c] of [[2, 3, '#c8c0b0'], [4, 5, '#a8a090'], [11, 2, '#d8d0c0'], [12, 4, '#b8b0a0'], [7, 6, '#c8c0b0'], [5, 1, '#b0a898'], [9, 1, '#c0b8a8'], [9, 5, '#d0c8b8']]) px.set(x, y, c);
      break;
    }
    case 'groundcup': {
      px = new Pix(14, 8);
      px.ellipse(7, 4.5, 6.5, 3.2, '#b89a5a');
      px.ellipse(7, 4, 4.5, 1.6, '#7a6436');
      for (let x = 1; x < 13; x += 2) px.set(x, 6, '#9a7e48');
      for (const [x, h] of [[0, 3], [2, 2], [11, 3], [13, 2], [6, 1]]) px.vline(x, 3 - h, 3, '#6a9a4a');
      break;
    }
    case 'bare': {
      px = new Pix(12, 6);
      for (const [x, y, c] of [[1, 3, '#8a6a3a'], [3, 4, '#a8844a'], [8, 4, '#7a5a34'], [10, 2, '#a8844a'], [5, 1, '#8a6a3a'], [6, 5, '#6a4e2c']]) { px.set(x, y, c); px.set(x + 1, y, c); }
      break;
    }
    case 'chimney': {
      px = new Pix(10, 6);
      for (let i = 0; i < 5; i++) px.line(1 + i * 2, 5, 2 + i * 2 + (i % 2 ? 1 : -1), 0 + (i % 2), i % 2 ? '#7a5a3a' : '#5a3e26');
      break;
    }
    case 'hole': {
      px = new Pix(8, 10);
      px.ellipse(4, 4, 3, 3.5, '#1e160e');
      px.set(2, 8, '#e8d8b0'); px.set(5, 9, '#e8d8b0'); px.set(4, 7, '#d8c8a0');
      break;
    }
    case 'tunnel': {
      px = new Pix(8, 6);
      px.ellipse(4, 3, 3, 2.5, '#1a120c');
      px.set(2, 5, '#e8e0d0');
      break;
    }
    default: px = new Pix(4, 4);
  }
  if (type !== 'hole' && type !== 'tunnel' && type !== 'bare') px.outline('#2a1c10');
  return { px, ax: Math.floor(px.w / 2), ay: px.h - 1 };
}
