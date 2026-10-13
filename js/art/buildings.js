'use strict';
// Buildings of Featherbrook: the village houses, the farm and the field station.
// Every generator returns { px, ax, ay, lights, eaves, chimneys }:
//   ax, ay    offset of the footprint's top-left corner inside the image
//   lights    window glows at night: [x, y, radius] in image pixels
//   eaves     nest slots under the eaves: [x, z] with x from the footprint's left edge and
//             z the height above the ground line (the footprint's bottom edge)
//   chimneys  where chimney smoke rises, in image pixels
// Images are a few pixels wider/taller than the footprint for the cast shadow and door steps.

const BSHADOW = '#1a1424';
const bh = (x, y, s) => hash32(x, y, s) / 4294967296;
const ramp = (hex) => ({ o: darken(hex, 0.58), d: darken(hex, 0.26), m: hex, l: lighten(hex, 0.2), h: lighten(hex, 0.42) });
const mix = (a, b, t) => mixHex(a, b, t == null ? 0.5 : t);

// ---------------------------------------------------------------- sign lettering (3x5)
const SIGN_FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'], I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['#..#', '##.#', '#.##', '#..#', '#..#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'], '\'': ['#', '#', '.', '.', '.'],
  '.': ['.', '.', '.', '.', '#'], '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
};
function signW(text) {
  let w = -1;
  for (const ch of text) w += ch === ' ' ? 3 : (SIGN_FONT[ch] ? SIGN_FONT[ch][0].length + 1 : 0);
  return w;
}
function signText(px, text, x, y, col, shadow) {
  for (const ch of text) {
    if (ch === ' ') { x += 3; continue; }
    const g = SIGN_FONT[ch];
    if (!g) continue;
    for (let j = 0; j < 5; j++) for (let i = 0; i < g[j].length; i++) if (g[j][i] === '#') {
      if (shadow) px.set(x + i, y + j + 1, shadow);
      px.set(x + i, y + j, col);
    }
    x += g[0].length + 1;
  }
}

// ---------------------------------------------------------------- shading helpers
function shadeRect(px, x0, y0, w, h, a, col) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (px.op(x, y)) px.blend(x, y, col || BSHADOW, a);
}
// Soft shadow under an overhang: strongest right below it
function eaveShadow(px, x0, x1, y, rows, mask) {
  for (let k = 0; k < rows; k++) for (let x = x0; x <= x1; x++) {
    if (mask && mask.op(x, y + k)) continue;
    if (px.op(x, y + k)) px.blend(x, y + k, BSHADOW, 0.34 * (1 - k / rows));
  }
}
// Shadow cast on the ground to the right of and below the building (sun from the upper left)
function groundShadow(px, W, H, fromY) {
  const src = px.p.slice(), w = px.w;
  const op = (x, y) => x >= 0 && y >= 0 && x < px.w && y < px.h && (src[y * w + x] >>> 24) > 0;
  for (let y = fromY; y < px.h; y++) for (let x = 0; x < px.w; x++) {
    if (op(x, y)) continue;
    let a = 0;
    for (let k = 1; k <= 4; k++) if (op(x - k, y - Math.ceil(k * 0.6)) && y - Math.ceil(k * 0.6) >= fromY - 2) { a = 0.3 - (k - 1) * 0.06; break; }
    if (!a && y >= H && y <= H + 1 && x > 1 && x < W + 2 && op(x, H - 1)) a = y === H ? 0.28 : 0.14;
    if (a) px.blend(x, y, BSHADOW, a);
  }
}

// ---------------------------------------------------------------- walls
function wallPlaster(px, x0, y0, w, h, base, seed) {
  const P = ramp(base), mid = mix(base, P.d, 0.3);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const n = valueNoise(x * 0.16, y * 0.28, seed), r = bh(x, y, seed);
    let c = n < 0.3 ? mid : base;
    if (r < 0.02) c = P.d; else if (r > 0.986) c = P.l;
    px.set(x, y, c);
  }
}
function wallBrick(px, x0, y0, w, h, base, mortar, seed) {
  const P = ramp(base);
  const tones = [P.m, mix(P.m, P.d, 0.45), mix(P.m, P.l, 0.4), P.m, mix(P.m, '#8a6a5a', 0.3)];
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 4), ry = (y - y0) % 4, off = row % 2 ? 4 : 0;
    for (let x = x0; x < x0 + w; x++) {
      const bx = Math.floor((x - x0 + off) / 8), rx = (x - x0 + off) % 8;
      if (ry === 3 || rx === 7) { px.set(x, y, mortar); continue; }
      let c = tones[hash32(bx, row, seed) % tones.length];
      if (ry === 0 && rx < 6) c = mix(c, P.h, 0.35);
      else if (ry === 2) c = mix(c, P.d, 0.3);
      px.set(x, y, c);
    }
  }
}
function wallStone(px, x0, y0, w, h, base, mortar, seed) {
  const P = ramp(base);
  let row = 0;
  for (let y = y0; y < y0 + h; row++) {
    const rh = 4 + (hash32(row, 0, seed) % 3);
    let x = x0 - (hash32(row, 1, seed) % 6), k = 0;
    while (x < x0 + w) {
      const sw = 5 + (hash32(row, k + 2, seed) % 7);
      const v = bh(row, k, seed + 7);
      const c0 = v < 0.25 ? mix(P.m, P.d, 0.5) : v > 0.78 ? mix(P.m, P.l, 0.6) : v > 0.55 ? mix(P.m, '#9a8a6a', 0.18) : P.m;
      for (let yy = y; yy < Math.min(y + rh, y0 + h); yy++) for (let xx = Math.max(x, x0); xx < Math.min(x + sw, x0 + w); xx++) {
        const ex = xx - x, ey = yy - y;
        let c = c0;
        if (ex === sw - 1 || ey === rh - 1 || (ex === 0 && ey === 0) || (ex === sw - 2 && ey === rh - 2)) c = mortar;
        else if (ey === 0 || ex === 0) c = mix(c0, P.h, 0.45);
        else if (ex === sw - 2 || ey === rh - 2) c = mix(c0, P.d, 0.55);
        else if (bh(xx, yy, seed) < 0.06) c = mix(c0, P.d, 0.35);
        px.set(xx, yy, c);
      }
      x += sw; k++;
    }
    y += rh;
  }
}
function wallSiding(px, x0, y0, w, h, base, seed) {
  const P = ramp(base);
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 3), ry = (y - y0) % 3;
    const joint = 9 + (hash32(row, 0, seed) % 20);
    for (let x = x0; x < x0 + w; x++) {
      const v = bh(Math.floor((x - x0 + joint) / 28), row, seed);
      let c = v < 0.3 ? mix(P.m, P.d, 0.25) : v > 0.75 ? mix(P.m, P.l, 0.3) : P.m;
      if (ry === 0) c = mix(c, P.h, 0.4);
      else if (ry === 2) c = P.d;
      if ((x - x0 + joint) % 28 === 0) c = P.d;
      if (valueNoise(x * 0.5, y * 3, seed) > 0.82 && ry === 1) c = mix(c, P.d, 0.4);
      px.set(x, y, c);
    }
  }
}
function wallBoards(px, x0, y0, w, h, base, seed) {
  // board and batten
  const P = ramp(base);
  for (let x = x0; x < x0 + w; x++) {
    const k = (x - x0) % 6;
    for (let y = y0; y < y0 + h; y++) {
      let c = P.m;
      const g = valueNoise(x * 2.1, y * 0.18, seed);
      if (g > 0.7) c = mix(P.m, P.d, 0.35); else if (g < 0.18) c = mix(P.m, P.l, 0.3);
      if (k === 0) c = P.h;
      else if (k === 1) c = P.l;
      else if (k === 2) c = P.d;
      px.set(x, y, c);
    }
  }
}
function wallLogs(px, x0, y0, w, h, base, seed) {
  const P = ramp(base);
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / 5), ry = (y - y0) % 5;
    for (let x = x0; x < x0 + w; x++) {
      let c = ry === 0 ? P.l : ry === 1 ? mix(P.l, P.m) : ry === 4 ? '#3a2a20' : ry === 3 ? P.d : P.m;
      if (ry > 0 && ry < 4 && valueNoise(x * 0.35, row * 7 + ry * 0.3, seed) > 0.72) c = mix(c, P.d, 0.4);
      px.set(x, y, c);
    }
    // log ends at the corners
    if (ry === 2) for (const cx of [x0 + 1, x0 + w - 2]) { px.set(cx, y, P.h); px.set(cx, y - 1, P.l); px.set(cx, y + 1, P.d); }
  }
}
// Exposed timber frame: beams [x0, y0, x1, y1] (straight or diagonal)
function beams(px, list, col) {
  const B = ramp(col);
  for (const [x0, y0, x1, y1, t] of list) {
    if (x0 === x1) { px.rect(x0, y0, t || 3, y1 - y0 + 1, B.m); px.vline(x0, y0, y1, B.l); }
    else if (y0 === y1) { px.rect(x0, y0, x1 - x0 + 1, t || 3, B.m); px.hline(x0, x1, y0, B.l); px.hline(x0, x1, y0 + (t || 3) - 1, B.d); }
    else { px.thick(x0, y0, x1, y1, t || 2.6, B.m); px.line(x0, y0 - 1, x1, y1 - 1, B.l); }
  }
}

// ---------------------------------------------------------------- roofs
// Roof surface materials: colour at (x, row-from-top ry)
const ROOF_MATS = {
  tile(x, ry, P, seed) { // clay pantiles
    const row = Math.floor(ry / 4), k = ry % 4, off = (row % 2) * 3;
    const t = Math.floor((x + off) / 5), tx = (x + off) % 5;
    const v = bh(t, row, seed);
    let c = v < 0.2 ? mix(P.m, P.d, 0.35) : v > 0.85 ? mix(P.m, P.l, 0.45) : P.m;
    if (k === 3) return P.d;
    if (tx === 0) return mix(c, P.d, 0.6);
    if (tx === 1) c = mix(c, P.h, 0.35);
    else if (tx === 4) c = mix(c, P.d, 0.25);
    if (k === 0) c = mix(c, P.h, 0.25);
    return c;
  },
  slate(x, ry, P, seed) {
    const row = Math.floor(ry / 4), k = ry % 4, off = (row % 2) * 4;
    const t = Math.floor((x + off) / 7), tx = (x + off) % 7;
    const v = bh(t, row, seed);
    let c = v < 0.25 ? mix(P.m, P.d, 0.4) : v > 0.8 ? mix(P.m, P.l, 0.5) : v > 0.6 ? mix(P.m, '#6a7a8a', 0.2) : P.m;
    if (k === 3) return P.o;
    if (tx === 6) return P.d;
    if (k === 0) c = mix(c, P.l, 0.45);
    return c;
  },
  shingle(x, ry, P, seed) { // wooden shakes
    const row = Math.floor(ry / 4), k = ry % 4;
    let start = -(hash32(row, 0, seed) % 5), i = 0, w = 0;
    for (; ; i++) { w = 3 + (hash32(row, i + 1, seed) % 4); if (start + w > x - Math.floor(x / 64) * 64) break; start += w; }
    const v = bh(row, i, seed + 3);
    let c = v < 0.3 ? mix(P.m, P.d, 0.4) : v > 0.8 ? mix(P.m, P.l, 0.5) : P.m;
    if (k === 3) return P.d;
    if ((x - Math.floor(x / 64) * 64) === start + w - 1) return mix(c, P.d, 0.7);
    if (k === 0) c = mix(c, P.h, 0.3);
    return c;
  },
  thatch(x, ry, P, seed) {
    // long straw strands (very elongated noise), broad weathering, faint layer lines
    const s = valueNoise(x * 1.25, ry * 0.055, seed), s2 = fbm(x * 0.12, ry * 0.09, seed + 3, 2);
    let c = s > 0.68 ? P.l : s < 0.26 ? mix(P.m, P.d, 0.5) : P.m;
    if (s2 > 0.62) c = mix(c, P.h, 0.22); else if (s2 < 0.36) c = mix(c, P.d, 0.28);
    if ((ry + Math.round(Math.sin(x * 0.21 + seed) * 2)) % 13 === 0) c = mix(c, P.d, 0.35);
    if (ry < 5) c = mix(c, P.d, 0.3 - ry * 0.05);
    return c;
  },
  metal(x, ry, P, seed) { // corrugated sheets
    const k = x % 4;
    let c = k === 0 ? P.h : k === 1 ? P.l : k === 2 ? P.m : P.d;
    if (ry % 22 === 21) c = P.d;
    const rust = valueNoise(x * 0.12, ry * 0.2, seed);
    if (rust > 0.74) c = mix(c, '#8a5a3a', (rust - 0.74) * 2.2);
    return c;
  },
};

// A roof plane seen from the front: trapezoid from the ridge (y0) to the eave (y1).
// hipL/hipR: how far the ends slope in at the ridge (0 = gable ends).
function roofPlane(px, o) {
  const { x0, x1, y0, y1, mat, base, seed } = o;
  const hipL = o.hipL == null ? (o.hip || 0) : o.hipL, hipR = o.hipR == null ? (o.hip || 0) : o.hipR;
  const P = ramp(base);
  const mask = new Pix(px.w, px.h);
  mask.poly([[x0, y1], [x1 + 1, y1], [x1 + 1 - hipR, y0], [x0 + hipL, y0]], '#fff');
  const f = ROOF_MATS[mat];
  for (let y = Math.max(0, y0); y < Math.min(px.h, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(px.w - 1, x1); x++) {
    if (!mask.op(x, y)) continue;
    let c = f(x, y - y0, P, seed);
    // gentle light: brighter toward the left, a touch darker near the eave
    const t = (x - x0) / (x1 - x0);
    if (t > 0.7) c = mix(c, P.d, (t - 0.7) * 0.5);
    px.set(x, y, c);
  }
  // hip edges
  if (hipL > 0) { px.line(x0, y1 - 1, x0 + hipL, y0, P.d); px.line(x0 + 1, y1 - 1, x0 + hipL + 1, y0, P.h); }
  if (hipR > 0) { px.line(x1, y1 - 1, x1 - hipR, y0, P.o); px.line(x1 - 1, y1 - 1, x1 - hipR - 1, y0, P.d); }
  else { px.vline(x1, y0, y1 - 1, P.d); }
  if (!hipL) { px.vline(x0, y0, y1 - 1, P.h); }
  // ridge
  const rx0 = x0 + hipL, rx1 = x1 - hipR;
  if (mat === 'thatch') {
    // block-cut ridge with pointed scallops and hazel spars
    for (let x = rx0 - 2; x <= rx1 + 2; x++) {
      const tooth = 2 + Math.abs(((x - rx0) % 8) - 4) * 0.75;
      for (let y = y0 - 2; y < y0 + 3 + tooth; y++) {
        if (!mask.op(x, Math.max(y, y0)) && y >= y0) continue;
        let c = valueNoise(x * 0.9, y * 0.1, seed + 5) > 0.55 ? lighten(P.l, 0.08) : P.l;
        if (y === y0 - 2) c = P.h;
        if (y >= y0 + 2 + tooth) c = P.d;
        px.set(x, y, c);
      }
      if ((x - rx0) % 6 === 0) { px.set(x, y0 + 1, P.d); px.set(x + 1, y0 + 2, P.d); }
      if ((x - rx0) % 6 === 3) { px.set(x, y0 + 2, P.d); px.set(x + 1, y0 + 1, P.d); }
    }
    px.hline(rx0, rx1, y0 - 3, P.o);
  } else {
    px.hline(rx0, rx1, y0 - 1, P.o);
    px.hline(rx0, rx1, y0, P.l);
    px.hline(rx0, rx1, y0 + 1, P.d);
    for (let x = rx0; x <= rx1; x += 5) px.set(x, y0, P.m);
  }
  // eave edge
  if (mat === 'thatch') {
    for (let x = x0; x <= x1; x++) {
      if (!mask.op(x, y1 - 1)) continue;
      const r = bh(x, 1, seed);
      px.set(x, y1 - 3, mix(P.m, P.l, 0.5));
      px.set(x, y1 - 2, r < 0.3 ? P.d : P.l);
      px.set(x, y1 - 1, r < 0.5 ? mix(P.d, P.m) : P.m);
      px.set(x, y1, P.o);
    }
  } else {
    px.hline(x0, x1, y1 - 1, P.d);
    px.hline(x0, x1, y1, o.fascia || P.o);
    if (o.fascia) px.hline(x0, x1, y1 + 1, darken(o.fascia, 0.35));
  }
  return mask;
}

function outlineY(outline, x) {
  for (let i = 0; i + 1 < outline.length; i++) {
    const [ax, ay] = outline[i], [bx, by] = outline[i + 1];
    if (x >= ax && x <= bx) return ay + (by - ay) * (x - ax) / Math.max(1, bx - ax);
  }
  return null;
}

// Front-gable roof seen at an angle: the roof surface recedes `depth` pixels above the
// gable outline. outline: points from the left eave over the apex to the right eave.
function gableRoof(px, outline, depth, mat, base, seed, trim) {
  const P = ramp(base);
  const yAt = (x) => outlineY(outline, x);
  const slopeAt = (x) => {
    for (let i = 0; i + 1 < outline.length; i++) {
      const [ax, ay] = outline[i], [bx, by] = outline[i + 1];
      if (x >= ax && x <= bx) return (by - ay) / Math.max(1, bx - ax);
    }
    return 0;
  };
  const x0 = outline[0][0], x1 = outline[outline.length - 1][0];
  const f = ROOF_MATS[mat];
  for (let x = x0; x <= x1; x++) {
    const yb = Math.round(yAt(x)), s = slopeAt(x);
    for (let y = yb - depth; y <= yb; y++) {
      // courses run along the depth (vertical lines), so sample the material sideways
      let c = f(yb - y + 200, x - x0, P, seed);
      if (s > 0.05) c = mix(c, P.d, 0.42); // right-hand slopes face away from the sun
      else if (s > -1.2 && s < -0.05) c = mix(c, P.h, 0.12); // shallow upper slopes catch light
      px.set(x, y, c);
    }
    // back edge of the roof (the far eave) and the front barge
    px.set(x, yb - depth, P.o);
    px.set(x, yb - depth + 1, s > 0.05 ? P.d : P.l);
  }
  // ridge line receding from the apex
  let ax = x0, ay = 1e9;
  for (const [x, y] of outline) if (y < ay) { ay = y; ax = x; }
  for (let y = ay - depth; y <= ay; y++) { px.set(ax, y, P.h); px.set(ax + 1, y, P.d); }
  // barge boards along the front edge
  for (let x = x0; x <= x1; x++) {
    const yb = Math.round(yAt(x));
    px.set(x, yb + 1, trim || P.l);
    px.set(x, yb + 2, trim ? darken(trim, 0.25) : P.m);
    px.set(x, yb + 3, P.o);
  }
  return yAt;
}

function snowOnRoof(px, mask, y0, y1, seed) {
  for (let y = y0 - 3; y < y1 - 1; y++) for (let x = 0; x < px.w; x++) {
    if (!(mask ? mask.op(x, Math.max(y, y0)) : px.op(x, y)) || !px.op(x, y)) continue;
    const n = valueNoise(x * 0.18, y * 0.3, seed);
    if (n < 0.16 && y > y0 + 6) continue;
    const ry = y - y0;
    let c = '#f4f8fc';
    if (ry % 4 === 3) c = '#d6e0ec';
    else if (n < 0.24) c = '#e2eaf3';
    px.set(x, y, c);
  }
}
function icicles(px, x0, x1, y, seed) {
  for (let x = x0 + 1; x < x1; x++) {
    const r = hash32(x, y, seed) % 9;
    if (r > 2) continue;
    const len = 1 + r;
    for (let k = 0; k < len; k++) px.set(x, y + k, k === len - 1 ? '#c6dcef' : '#eef6fc');
  }
}

// ---------------------------------------------------------------- windows, doors, details
// o: { trim, lit, bars ('cross'|'v'|'h'|'grid'|'none'), shutter, box (season), curtain }
function bWindow(px, x, y, w, h, o) {
  const trim = o.trim || '#f2ead8', T = ramp(trim), lit = o.lit;
  if (o.shutter) {
    const S = ramp(o.shutter), sw = o.sw || Math.max(3, Math.floor(w / 3));
    for (const sx of [x - 1 - sw, x + w + 1]) {
      px.rect(sx, y - 1, sw, h + 2, S.m);
      for (let j = y; j < y + h; j += 2) px.hline(sx + 1, sx + sw - 2, j, S.d);
      px.vline(sx, y - 1, y + h, S.l); px.vline(sx + sw - 1, y - 1, y + h, S.d);
      px.hline(sx, sx + sw - 1, y - 1, S.l); px.hline(sx, sx + sw - 1, y + h, S.d);
    }
  }
  px.rect(x - 1, y - 1, w + 2, h + 2, T.d);
  px.rect(x, y, w, h, trim);
  const gx = x + 1, gy = y + 1, gw = w - 2, gh = h - 2;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    let c;
    if (lit) c = j === 0 ? '#e8a84a' : j < gh / 2 ? '#ffd77a' : '#ffcc62';
    else {
      c = j === 0 ? '#28394c' : j < gh / 2 ? '#3a5470' : '#33495f';
      const d = i + j, g = Math.floor(gw * 0.45);
      if (d === g || d === g + 1) c = '#88b0c8';
      else if (d === g + 3) c = '#5f86a2';
    }
    px.set(gx + i, gy + j, c);
  }
  if (o.curtain && gw >= 6) {
    const Cc = ramp(o.curtain);
    for (let j = 0; j < gh; j++) {
      const wv = j < gh * 0.6 ? 2 : 1;
      for (let i = 0; i < wv; i++) { px.set(gx + i, gy + j, lit ? mix(Cc.l, '#ffd77a', 0.4) : (j % 2 ? Cc.m : Cc.l)); px.set(gx + gw - 1 - i, gy + j, lit ? mix(Cc.m, '#ffd77a', 0.3) : (j % 2 ? Cc.d : Cc.m)); }
    }
    px.hline(gx, gx + gw - 1, gy, lit ? Cc.l : Cc.m);
  }
  const bars = o.bars || 'cross';
  const mx = gx + Math.floor((gw - 1) / 2), my = gy + Math.floor((gh - 1) / 2);
  if (bars === 'cross' || bars === 'v' || bars === 'grid') px.vline(mx, gy, gy + gh - 1, trim);
  if (bars === 'cross' || bars === 'h' || bars === 'grid') px.hline(gx, gx + gw - 1, my, trim);
  if (bars === 'grid') { px.vline(gx + Math.floor(gw / 4), gy, gy + gh - 1, trim); px.vline(gx + Math.floor(gw * 3 / 4), gy, gy + gh - 1, trim); }
  // sill
  px.hline(x - 2, x + w + 1, y + h + 1, T.h);
  px.hline(x - 2, x + w + 1, y + h + 2, T.d);
  if (o.box != null) flowerBox(px, x - 1, y + h + 3, w + 2, o.box, o.boxCols);
}

function flowerBox(px, x, y, w, season, cols) {
  px.rect(x, y, w, 3, '#6a4a2e');
  px.hline(x, x + w - 1, y, '#8a6440');
  px.hline(x, x + w - 1, y + 2, '#4a3220');
  if (season === WINTER) {
    for (let i = 0; i < w; i += 2) px.set(x + i, y - 1, '#4a6a4a');
    px.hline(x, x + w - 1, y - 1, '#f4f8fb');
    return;
  }
  const fl = season === AUTUMN ? ['#d8782a', '#b84a2a', '#e8b040'] : cols || ['#e8485a', '#f4a0b8', '#f6e04a', '#ffffff'];
  for (let i = 0; i < w; i++) {
    const r = hash32(x + i, y, 77);
    px.set(x + i, y - 1, r & 1 ? '#3e7a34' : '#4f9a40');
    if ((r >>> 3) % 3 !== 0) px.set(x + i, y - 2, r & 4 ? '#5aa048' : '#3e7a34');
    if ((r >>> 5) % 3 === 0) { const c = fl[(r >>> 8) % fl.length]; px.set(x + i, y - 2, c); if (r & 64) px.set(x + i, y - 3, c); }
  }
}

// o: { trim, lit, style ('panel'|'plank'|'glass'), step, fan }
function bDoor(px, x, y, w, h, col, o) {
  const D = ramp(col), trim = o.trim || '#f2ead8', T = ramp(trim);
  px.rect(x - 2, y - 2, w + 4, h + 2, T.d);
  px.rect(x - 1, y - 1, w + 2, h + 1, trim);
  px.vline(x - 1, y - 1, y + h - 1, T.h);
  px.rect(x, y, w, h, D.m);
  const style = o.style || 'panel';
  if (style === 'plank') {
    for (let i = x + 2; i < x + w - 1; i += 3) px.vline(i, y, y + h - 1, D.d);
    for (const yy of [y + 3, y + h - 5]) { px.hline(x, x + w - 1, yy, D.l); px.hline(x, x + w - 1, yy + 1, D.d); }
    px.line(x + 1, y + h - 5, x + w - 2, y + 5, D.d);
  } else {
    const glassH = style === 'glass' ? Math.floor(h * 0.42) : 0;
    if (glassH) {
      px.rect(x + 2, y + 2, w - 4, glassH, o.lit ? '#ffd77a' : '#3a5470');
      if (!o.lit) { px.set(x + 3, y + 3, '#88b0c8'); px.set(x + 4, y + 3, '#88b0c8'); px.set(x + 3, y + 4, '#88b0c8'); }
      px.vline(x + Math.floor(w / 2), y + 2, y + 1 + glassH, D.m);
    }
    const py0 = y + 2 + glassH + (glassH ? 1 : 0), ph = Math.floor((y + h - 2 - py0 - 1) / (glassH ? 1 : 2));
    const pw = Math.floor((w - 3) / 2);
    const panels = glassH ? [[x + 1, py0], [x + 2 + pw, py0]] : [[x + 1, py0], [x + 2 + pw, py0], [x + 1, py0 + ph + 1], [x + 2 + pw, py0 + ph + 1]];
    for (const [qx, qy] of panels) {
      px.hline(qx, qx + pw - 1, qy, D.d); px.vline(qx, qy, qy + ph - 1, D.d);
      px.hline(qx, qx + pw - 1, qy + ph - 1, D.l); px.vline(qx + pw - 1, qy, qy + ph - 1, D.l);
    }
  }
  px.hline(x, x + w - 1, y, D.o);
  px.vline(x + w - 1, y, y + h - 1, D.d);
  const ky = y + Math.floor(h * 0.55);
  px.set(x + w - 3, ky, '#f6dc6a'); px.set(x + w - 3, ky + 1, '#a07a1a');
  if (o.fan) { // fanlight above
    px.rect(x, y - 5, w, 3, o.lit ? '#ffd77a' : '#3a5470');
    for (let i = 1; i < w; i += 3) px.vline(x + i, y - 5, y - 3, trim);
    px.hline(x - 1, x + w, y - 6, T.d);
  }
  if (o.step) {
    const S = ramp(o.step);
    px.rect(x - 3, y + h, w + 6, 2, S.m);
    px.hline(x - 3, x + w + 2, y + h, S.l);
    px.set(x - 3, y + h + 1, S.d); px.set(x + w + 2, y + h + 1, S.d);
  }
}

function chimney(px, x, y, w, h, base, mortar, seed, stone) {
  if (stone) wallStone(px, x, y + 2, w, h - 2, base, mortar, seed);
  else wallBrick(px, x, y + 2, w, h - 2, base, mortar, seed);
  const P = ramp(base);
  shadeRect(px, x + w - 2, y + 2, 2, h - 2, 0.3);
  px.rect(x - 1, y, w + 2, 3, P.d);
  px.hline(x - 1, x + w, y, P.l);
  px.rect(x + 2, y - 2, w - 4, 2, '#9a5236');
  px.hline(x + 2, x + w - 3, y - 2, '#c07048');
  px.set(x + Math.floor(w / 2), y - 2, '#2a1a14');
}

function lantern(px, x, y, lit) {
  px.hline(x - 2, x, y, '#2a2a30'); px.set(x, y + 1, '#2a2a30');
  px.rect(x - 1, y + 2, 3, 1, '#2a2a30');
  px.rect(x - 1, y + 3, 3, 3, lit ? '#ffe08a' : '#b8ccd4');
  px.set(x, y + 4, lit ? '#fff6c8' : '#e8f0f4');
  px.vline(x - 1, y + 3, y + 5, '#3a3a40'); px.vline(x + 1, y + 3, y + 5, '#3a3a40');
  px.hline(x - 1, x + 1, y + 6, '#2a2a30');
}

// Climbing plants up a wall: ivy, roses or wisteria
function climber(px, x0, x1, yTop, yBot, kind, season, seed) {
  const leafD = season === AUTUMN ? (kind === 'ivy' ? '#3e5a2e' : '#8a4a2a') : season === WINTER ? (kind === 'ivy' ? '#3e5a3e' : '#6a5a4a') : '#2f6a32';
  const leafM = season === AUTUMN ? (kind === 'ivy' ? '#56763a' : '#b8662e') : season === WINTER ? (kind === 'ivy' ? '#56765a' : null) : '#4a8a3e';
  const leafL = season === AUTUMN ? '#d89a3a' : season === WINTER ? null : '#6aaa4e';
  const bloom = kind === 'rose' ? ['#e04a5a', '#f08aa0', '#ffffff'] : kind === 'wisteria' ? ['#a88ae0', '#c8b0f0', '#8a6ac8'] : null;
  const flowering = bloom && (season === SPRING ? kind === 'wisteria' : season === SUMMER);
  // stems
  for (let k = 0; k < 3; k++) {
    let x = x0 + Math.floor((x1 - x0) * (k + 0.5) / 3);
    for (let y = yBot; y > yTop + (k === 1 ? 0 : 4); y--) {
      if (bh(x, y, seed + k) < 0.3) x += bh(y, x, seed) < 0.5 ? -1 : 1;
      x = clamp(x, x0, x1);
      px.set(x, y, season === WINTER ? '#5a4a3a' : '#4a3a24');
    }
  }
  if (!leafM) return;
  for (let y = yTop; y <= yBot; y++) for (let x = x0 - 1; x <= x1 + 1; x++) {
    const dens = 0.55 - 0.35 * ((yBot - y) / (yBot - yTop)) - (x < x0 || x > x1 ? 0.25 : 0);
    const n = valueNoise(x * 0.5, y * 0.5, seed);
    if (n > 1 - dens) {
      let c = n > 1 - dens * 0.35 && leafL ? leafL : n > 1 - dens * 0.7 ? leafM : leafD;
      if (flowering && bh(x, y, seed + 9) < 0.16) c = bloom[hash32(x, y, seed) % bloom.length];
      px.set(x, y, c);
    }
  }
}

function bush(px, cx, by, r, season, seed, berries) {
  const pal = season === AUTUMN ? ['#5a5a2a', '#7a7a34', '#a0943e'] : season === WINTER ? ['#3e5a4a', '#52705a', '#f4f8fb'] : ['#2f6a32', '#438a3c', '#64aa4e'];
  for (let y = by - r * 2; y <= by; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) {
    const dx = (x - cx) / (r + 0.5), dy = (y - (by - r)) / (r + 0.5);
    const n = valueNoise(x * 0.7, y * 0.7, seed) * 0.35;
    if (dx * dx + dy * dy > 1 + n - 0.15) continue;
    const lightness = -dx * 0.5 - dy * 0.8 + valueNoise(x * 0.9, y * 0.9, seed + 1) * 0.6;
    px.set(x, y, lightness > 0.55 ? pal[2] : lightness > -0.1 ? pal[1] : pal[0]);
  }
  if (berries && season !== WINTER) for (let i = 0; i < 4; i++) px.set(cx - r + 1 + (hash32(i, cx, seed) % (r * 2 - 1)), by - 1 - (hash32(cx, i, seed) % (r * 2 - 1)), season === SPRING ? '#ffffff' : '#e04a5a');
}

function flowerPot(px, x, by, season, seed, big) {
  const w = big ? 6 : 4;
  px.rect(x, by - 3, w, 4, '#b8603a');
  px.hline(x - 1, x + w, by - 4, '#d07a4a');
  px.hline(x, x + w - 1, by, '#8a4428');
  if (season === WINTER) { px.hline(x, x + w - 1, by - 5, '#f4f8fb'); return; }
  const fl = season === AUTUMN ? '#e8a030' : ['#e8485a', '#f6e04a', '#b88ae8', '#ffffff'][seed % 4];
  for (let i = -1; i <= w; i++) {
    const hgt = 2 + (hash32(i, seed, 5) % (big ? 5 : 3));
    for (let k = 1; k <= hgt; k++) px.set(x + i, by - 4 - k, k === hgt && hash32(i, k, seed) % 2 ? fl : (k % 2 ? '#3e7a34' : '#5aa048'));
  }
}

function finish(px, outlineCol) {
  px.outline(outlineCol || '#22161a');
  return px;
}

// ---------------------------------------------------------------- dispatcher
function genBuilding(kind, season, lit) {
  switch (kind) {
    case 'cottage': return genCottage(season, lit);
    case 'barn': return genBarn(season, lit);
    case 'shop': return genShop(season, lit);
    case 'station': return genStation(season, lit);
    case 'coop': return genCoop(season);
    case 'farmhouse': return genFarmhouse(season, lit);
    case 'house1': return genRoseCottage(season, lit);
    case 'house2': return genWillowHouse(season, lit);
    case 'bench': return genBench(season);
    case 'mailbox': return genMailbox(false);
    case 'well': return genWell(season);
  }
}

// ---------------------------------------------------------------- your cottage (5x3)
function genCottage(season, lit) {
  const W = 80, above = 42, H = 48 + above;
  const px = new Pix(W + 4, H + 3);
  const wallTop = 56, eave = 63;
  // walls: whitewashed plaster over a stone plinth, oak posts at the corners
  wallPlaster(px, 4, wallTop, W - 8, H - wallTop, '#f0e6cf', 11);
  wallStone(px, 4, H - 5, W - 8, 5, '#9a948a', '#5a5650', 12);
  beams(px, [[4, wallTop, 4, H - 6, 3], [W - 7, wallTop, W - 7, H - 6, 3], [4, H - 8, W - 5, H - 8, 2]], '#5e4030');
  // windows with shutters and flower boxes, a lintel over each
  for (const wx of [13, 54]) {
    bWindow(px, wx, 70, 13, 10, { lit, shutter: '#4f7f62', sw: 4, box: season, curtain: '#e8d6b8', trim: '#f4ecdc' });
    beams(px, [[wx - 6, 67, wx + 18, 67, 2]], '#5e4030');
  }
  // door with a little round window, stone step, lantern
  bDoor(px, 35, 68, 10, 22, '#3f7d86', { lit, style: 'plank', step: '#a8a296', trim: '#5e4030' });
  px.disc(40, 73, 2.2, lit ? '#ffd77a' : '#3a5470'); px.set(39, 72, lit ? '#fff1b8' : '#88b0c8');
  lantern(px, 49, 69, lit);
  // climbing rose on the left corner
  climber(px, 5, 10, 60, H - 6, 'rose', season, 13);
  // thatched roof with a block-cut ridge and an eyebrow window
  const mask = roofPlane(px, { x0: 1, x1: W - 2, y0: 14, y1: eave, hip: 10, mat: 'thatch', base: '#c69a52', seed: 14 });
  eaveShadow(px, 4, W - 5, eave + 1, 4, null);
  bWindow(px, 35, 37, 10, 7, { lit, bars: 'v', trim: '#f4ecdc' });
  const Th = ramp('#c69a52');
  for (let x = 30; x <= 50; x++) {
    const d = (x - 40) / 10.5, yy = Math.round(35 - Math.sqrt(Math.max(0, 1 - d * d)) * 5);
    px.set(x, yy, Th.h); px.set(x, yy + 1, Th.l); px.set(x, yy + 2, Th.d);
    if (Math.abs(d) > 0.55) px.set(x, yy + 3, Th.d);
  }
  // stone chimney on the right
  chimney(px, 58, 2, 9, 26, '#a49c90', '#5e5850', 15, true);
  if (season === WINTER) { snowOnRoof(px, mask, 14, eave - 1, 16); px.hline(57, 67, 1, '#f4f8fb'); icicles(px, 2, W - 3, eave + 1, 17); }
  finish(px, '#24181a');
  groundShadow(px, W, H, eave + 2);
  return { px, ax: 0, ay: above, lights: [[19, 75, 24], [60, 75, 24], [40, 41, 16], [40, 74, 12]], eaves: [[9, 18], [30, 18], [71, 18]], chimneys: [[62, 0]] };
}

// ---------------------------------------------------------------- Basil's Garden Shop (6x3)
function genShop(season, lit) {
  const W = 96, above = 44, H = 48 + above;
  const px = new Pix(W + 4, H + 3);
  const wallTop = 48, eave = 52;
  // brick building with a painted timber shopfront
  wallBrick(px, 4, wallTop, W - 8, H - wallTop, '#a85a42', '#dccbb0', 21);
  wallStone(px, 4, H - 4, W - 8, 4, '#8a8478', '#55504a', 22);
  const G = ramp('#3d6b4e');
  px.rect(5, 63, W - 10, H - 67, G.m);
  px.hline(5, W - 6, 63, G.l);
  for (const x of [5, 32, 51, W - 8]) { px.rect(x, 63, 3, H - 67, G.m); px.vline(x, 63, H - 5, G.l); px.vline(x + 2, 63, H - 5, G.d); }
  // display windows with potted plants on shelves
  const shelf = (x, w) => {
    bWindow(px, x, 70, w, 13, { lit, bars: 'v', trim: '#efe6cf' });
    for (let i = 2; i < w - 3; i += 4) {
      const c = season === WINTER ? '#5a7a5a' : ['#4f9a40', '#3e7a34', '#6aaa4e'][(i >> 2) % 3];
      px.rect(x + i, 76, 3, 3, c); px.set(x + i + 1, 75, c);
      px.rect(x + i, 79, 3, 2, '#b8603a'); px.hline(x + i, x + i + 2, 79, '#d07a4a');
      if ((i >> 2) % 2) px.set(x + i + 1, 74, ['#e8485a', '#f6e04a', '#ffffff'][(i >> 3) % 3]);
    }
    px.hline(x + 1, x + w - 2, 81, '#7a5434');
  };
  shelf(10, 20); shelf(56, 33);
  for (const [x, w] of [[10, 20], [56, 33]]) { px.rect(x, 87, w, 2, G.d); px.hline(x, x + w - 1, 87, G.l); }
  bDoor(px, 37, 70, 11, 22, '#2f5a3c', { lit, style: 'glass', step: '#a8a296', trim: '#efe6cf' });
  // awning: cream and green stripes with a scalloped edge
  for (let x = 6; x < W - 6; x++) {
    if (x > 33 && x < 51) continue;
    const st = Math.floor((x - 6) / 5) % 2 ? '#f4efe2' : '#3e8a4a';
    for (let y = 63; y < 68; y++) px.set(x, y, y === 63 ? lighten(st, 0.2) : y === 67 ? darken(st, 0.12) : st);
    if ((x - 6) % 5 !== 4) px.set(x, 68, darken(st, 0.12));
    px.blend(x, 69, BSHADOW, 0.3); px.blend(x, 70, BSHADOW, 0.15);
  }
  // slate roof
  const mask = roofPlane(px, { x0: 1, x1: W - 2, y0: 12, y1: eave, hip: 12, mat: 'slate', base: '#5d6678', seed: 23 });
  eaveShadow(px, 4, W - 5, eave + 1, 3, null);
  // central gable with a round window
  const gable = new Pix(px.w, px.h);
  gable.poly([[22, eave + 1], [75, eave + 1], [48, 17]], '#fff');
  const sid = new Pix(px.w, px.h);
  wallSiding(sid, 16, 14, 64, 42, '#ebe2ca', 24);
  for (let i = 0; i < px.p.length; i++) if (gable.p[i]) px.p[i] = sid.p[i];
  for (let y = 18; y <= eave; y++) for (let x = 20; x <= 76; x++) {
    if (!gable.op(x, y)) continue;
    const d = Math.min(x - (48 - (y - 17) * 26 / 35), (48 + (y - 17) * 27 / 35) - x);
    if (d < 4) px.blend(x, y, BSHADOW, 0.3 * (1 - d / 4));
  }
  const R = ramp('#4c5466');
  px.thick(19, eave, 48, 15, 3, R.m); px.thick(48, 15, 78, eave, 3, R.d);
  px.line(18, eave - 2, 48, 13, R.h); px.line(48, 13, 79, eave - 2, R.l);
  px.line(21, eave + 1, 48, 18, '#f6efdf'); px.line(48, 18, 76, eave + 1, '#d8ccb0');
  px.disc(48, 32, 5, '#efe6cf'); px.disc(48, 32, 4, '#c8bea8'); px.disc(48, 32, 3, lit ? '#ffd77a' : '#3a5470');
  if (!lit) { px.set(47, 31, '#88b0c8'); px.set(46, 32, '#88b0c8'); }
  px.vline(48, 29, 35, '#efe6cf'); px.hline(45, 51, 32, '#efe6cf');
  // carved sprout on the gable
  px.vline(48, 40, 46, '#3e7a34'); px.rect(45, 41, 3, 2, '#5aa048'); px.rect(49, 42, 3, 2, '#5aa048'); px.set(44, 41, '#3e7a34'); px.set(52, 42, '#3e7a34');
  // fascia sign below the eave
  const text = 'GARDEN SHOP', tw = signW(text);
  const sx = 48 - Math.floor((tw + 6) / 2);
  px.rect(sx, eave + 2, tw + 6, 9, '#2c4f37'); px.frame(sx, eave + 2, tw + 6, 9, '#6a4a2e');
  px.hline(sx + 1, sx + tw + 4, eave + 3, '#3d6b4e');
  signText(px, text, sx + 3, eave + 4, '#f6e7b8', '#1c3324');
  // plants for sale out front
  const crate = (x, by) => {
    px.rect(x, by - 5, 12, 6, '#8a5a34'); px.hline(x, x + 11, by - 5, '#b07a48'); px.hline(x, x + 11, by - 2, '#6a4428');
    for (let i = 0; i < 4; i++) {
      const c = season === WINTER ? '#7a8a6a' : ['#4f9a40', '#3e7a34', '#6aaa4e', '#4f9a40'][i];
      px.rect(x + 1 + i * 3, by - 9, 2, 4, c);
      if (season === SPRING || season === SUMMER) px.set(x + 1 + i * 3, by - 10, ['#e8485a', '#f6e04a', '#b88ae8', '#ffffff'][i]);
    }
  };
  crate(4, H - 1); crate(W - 16, H - 1);
  flowerPot(px, 29, H - 1, season, 1, true); flowerPot(px, 52, H - 1, season, 2, false);
  // chalkboard by the door
  px.rect(18, H - 12, 9, 10, '#2a3a32'); px.frame(18, H - 12, 9, 10, '#8a5a34');
  px.hline(20, 24, H - 9, '#e8e8d8'); px.hline(20, 23, H - 7, '#e8e8d8'); px.set(22, H - 5, '#e8485a');
  px.line(18, H - 2, 17, H, '#6a4428'); px.line(26, H - 2, 27, H, '#6a4428');
  // hanging baskets
  for (const hx of [9, W - 10]) {
    px.vline(hx, 58, 60, '#3a3a3a');
    px.rect(hx - 2, 61, 5, 2, '#6a4a2e');
    if (season !== WINTER) { px.set(hx - 2, 60, '#4f9a40'); px.set(hx + 2, 60, '#4f9a40'); px.set(hx - 1, 60, '#e8485a'); px.set(hx + 1, 59, '#f4a0b8'); px.set(hx - 2, 63, '#3e7a34'); px.set(hx + 2, 64, '#3e7a34'); }
  }
  if (season === WINTER) { snowOnRoof(px, mask, 12, eave - 1, 25); icicles(px, 2, W - 3, eave + 1, 26); }
  finish(px, '#20161c');
  groundShadow(px, W, H, eave + 2);
  return { px, ax: 0, ay: above, lights: [[20, 76, 26], [72, 76, 32], [42, 76, 12], [48, 32, 10]], eaves: [[9, 32], [17, 32], [86, 32]], chimneys: [] };
}

// ---------------------------------------------------------------- Field Station (6x3)
function genStation(season, lit) {
  const W = 96, above = 46, H = 48 + above;
  const px = new Pix(W + 4, H + 3);
  const wallTop = 54, eave = 58;
  wallSiding(px, 4, wallTop, W - 8, H - wallTop, '#9a6a44', 31);
  wallStone(px, 4, H - 4, W - 8, 4, '#8a8478', '#55504a', 32);
  // white corner boards
  for (const x of [4, W - 7]) { px.rect(x, wallTop, 3, H - wallTop - 4, '#ece4d2'); px.vline(x + 2, wallTop, H - 5, '#c8bea8'); }
  // windows and door
  bWindow(px, 10, 70, 18, 12, { lit, bars: 'grid', trim: '#ece4d2', curtain: '#c8d8b0' });
  bWindow(px, 56, 70, 18, 12, { lit, bars: 'grid', trim: '#ece4d2' });
  bDoor(px, 36, 70, 11, 24, '#3d5f7a', { lit, style: 'glass', step: '#a8a296', trim: '#ece4d2' });
  lantern(px, 51, 71, lit);
  // notice board with posters
  px.rect(79, 69, 11, 12, '#6a4428'); px.rect(80, 70, 9, 10, '#c8a070');
  px.rect(81, 71, 4, 5, '#f4f0e0'); px.rect(86, 71, 2, 3, '#e8d070'); px.rect(85, 76, 3, 3, '#f4f0e0'); px.set(82, 72, '#3a7ad8'); px.set(83, 73, '#3a7ad8');
  px.vline(80, 81, H - 1, '#5a3a22'); px.vline(88, 81, H - 1, '#5a3a22');
  // spotting scope on a tripod
  px.line(23, H - 1, 26, H - 10, '#3a3a40'); px.line(29, H - 1, 26, H - 10, '#3a3a40'); px.line(26, H - 1, 26, H - 10, '#4a4a50');
  px.thick(22, H - 13, 30, H - 11, 3, '#5a6a5a'); px.set(30, H - 11, '#a8d0e0'); px.set(21, H - 13, '#2a2a30');
  // green metal roof
  const mask = roofPlane(px, { x0: 1, x1: W - 2, y0: 16, y1: eave, hipL: 0, hipR: 0, mat: 'shingle', base: '#557457', seed: 33 });
  // skylight and a stovepipe
  bWindow(px, 26, 30, 14, 9, { lit, bars: 'v', trim: '#ece4d2' });
  shadeRect(px, 25, 40, 16, 1, 0.3);
  px.rect(14, 12, 4, 16, '#5a5e66'); px.vline(14, 12, 27, '#8a8e96'); px.vline(17, 12, 27, '#3a3e46');
  px.rect(12, 9, 8, 3, '#3a3e46'); px.hline(12, 19, 9, '#6a6e76');
  for (let y = 15; y < 28; y += 4) px.hline(14, 17, y, '#44484e');
  eaveShadow(px, 4, W - 5, eave + 1, 3, null);
  // sign under the eave
  const text = 'FIELD STATION', tw = signW(text);
  const sx = 48 - Math.floor(tw / 2) - 3;
  px.rect(sx, eave + 2, tw + 6, 9, '#5a3a22'); px.frame(sx, eave + 2, tw + 6, 9, '#3a2416'); px.hline(sx + 1, sx + tw + 4, eave + 3, '#7a5434');
  signText(px, text, sx + 3, eave + 4, '#f4ead0', '#2a1a10');
  // lookout cupola on the ridge with a bird weathervane
  const cx = 66;
  wallBoards(px, cx, 6, 16, 12, '#ece4d2', 34);
  bWindow(px, cx + 3, 9, 10, 6, { lit, bars: 'v', trim: '#ece4d2' });
  px.poly([[cx - 2, 7], [cx + 18, 7], [cx + 8, -1]], '#3f6a52');
  px.line(cx - 2, 6, cx + 8, -2, '#6a9a7a'); px.line(cx + 8, -2, cx + 18, 6, '#2f5a42');
  px.hline(cx - 2, cx + 17, 7, '#2a4a36');
  shadeRect(px, cx + 13, 8, 3, 10, 0.25);
  if (season === WINTER) { snowOnRoof(px, mask, 16, eave - 1, 35); px.hline(cx - 1, cx + 16, 6, '#f4f8fb'); px.hline(12, 19, 8, '#f4f8fb'); icicles(px, 2, W - 3, eave + 1, 36); }
  finish(px, '#1e1a1e');
  groundShadow(px, W, H, eave + 2);
  return { px, ax: 0, ay: above, lights: [[19, 76, 26], [65, 76, 26], [41, 78, 12], [74, 12, 12], [33, 34, 14]], eaves: [[9, 28], [80, 28], [89, 28]], chimneys: [[16, 7]] };
}

// ---------------------------------------------------------------- Mabel's barn (6x4)
function genBarn(season, lit) {
  const W = 96, above = 50, H = 64 + above;
  const px = new Pix(W + 4, H + 3);
  const red = '#a83c30';
  // gambrel gable outline (top edge of the front barge) and the receding roof
  const outline = [[0, 72], [13, 46], [48, 26], [82, 46], [95, 72]];
  const wall = new Pix(px.w, px.h);
  for (let x = 4; x <= 91; x++) { const yb = Math.round(outlineY(outline, x)); for (let y = yb + 2; y < H; y++) wall.set(x, y, '#fff'); }
  wallBoards(px, 4, 28, 88, H - 28, red, 41);
  for (let i = 0; i < px.p.length; i++) if (!wall.p[i]) px.p[i] = 0;
  wallStone(px, 4, H - 5, 88, 5, '#8a8478', '#55504a', 42);
  const trim = '#efe8da';
  gableRoof(px, outline, 22, 'shingle', '#5e5658', 43, trim);
  // white trim at the corners
  for (const x of [4, 89]) { px.rect(x, 74, 3, H - 79, trim); px.vline(x + 2, 74, H - 6, '#c8c0b0'); }
  // big open doors with X-braced leaves swung back
  const dx = 32, dw = 32, dy = 76;
  px.rect(dx, dy, dw, H - dy, '#241812');
  for (let y = dy; y < H; y++) for (let x = dx; x < dx + dw; x++) if (y < dy + 3) px.set(x, y, '#3a2a20');
  for (let i = 0; i < 4; i++) px.hline(dx + 2, dx + dw - 3, dy + 6 + i * 7, '#30221a');
  px.rect(dx + 3, H - 9, 11, 9, '#d8b860'); px.hline(dx + 3, dx + 13, H - 9, '#ecd488'); px.hline(dx + 3, dx + 13, H - 5, '#b89a48');
  px.rect(dx + 18, H - 6, 9, 6, '#c8a850'); px.hline(dx + 18, dx + 26, H - 6, '#e0c478');
  for (let i = 0; i < 9; i++) px.set(dx + 2 + (hash32(i, 1, 44) % 28), H - 1 - (hash32(i, 2, 44) % 2), '#d8b860');
  for (const [x0, w] of [[dx - 13, 12], [dx + dw + 1, 12]]) {
    px.rect(x0, dy, w, H - dy - 1, red);
    for (let x = x0; x < x0 + w; x += 3) px.vline(x, dy, H - 2, darken(red, 0.25));
    px.frame(x0, dy, w, H - dy - 1, trim);
    px.line(x0 + 1, dy + 1, x0 + w - 2, H - 3, trim); px.line(x0 + w - 2, dy + 1, x0 + 1, H - 3, trim);
  }
  px.frame(dx - 1, dy - 2, dw + 2, H - dy + 2, trim);
  px.hline(dx - 2, dx + dw + 1, dy - 3, '#c8c0b0');
  // hayloft door with hay and a pulley beam
  px.rect(40, 50, 16, 16, '#241812');
  px.rect(42, 59, 12, 7, '#d8b860'); px.hline(42, 53, 59, '#ecd488');
  for (let i = 0; i < 5; i++) px.set(43 + i * 2, 58 - (i % 2), '#d8b860');
  px.frame(39, 49, 18, 18, trim); px.line(39, 49, 56, 66, trim);
  px.rect(46, 44, 4, 3, '#5a3a22'); px.vline(48, 47, 52, '#3a3a3a');
  // owl window high in the gable: barn owls have nested in barns for centuries
  px.disc(48, 38, 3.5, trim); px.disc(48, 38, 2.4, '#140c0a');
  // windows
  bWindow(px, 10, 82, 9, 9, { lit, bars: 'cross', trim });
  bWindow(px, 77, 82, 9, 9, { lit, bars: 'cross', trim });
  // rooster weathervane on the ridge
  const vane = ['..##....', '.###.#..', '..######', '...####.', '....#...'];
  for (let j = 0; j < vane.length; j++) for (let i = 0; i < vane[j].length; i++) if (vane[j][i] === '#') px.set(44 + i, j, '#2a2a30');
  px.set(46, 0, '#c8302a');
  px.vline(48, 5, 9, '#2a2a30'); px.hline(45, 51, 7, '#2a2a30');
  if (season === WINTER) {
    for (let y = 0; y < 72; y++) for (let x = 0; x < W; x++) {
      if (!px.op(x, y) || wall.op(x, y)) continue;
      const c = px.get(x, y);
      if (c === C(trim) || c === C('#2a2a30')) continue;
      if (valueNoise(x * 0.2, y * 0.3, 45) > 0.2) px.set(x, y, (x + y) % 7 === 0 ? '#dfe8f1' : '#f4f8fc');
    }
    icicles(px, 5, 90, 75, 46);
  }
  finish(px, '#22140f');
  groundShadow(px, W, H, 60);
  return { px, ax: 0, ay: above, lights: [[14, 86, 18], [81, 86, 18], [48, 96, 28]], eaves: [[38, 34], [48, 36], [58, 34]], chimneys: [] };
}

// ---------------------------------------------------------------- chicken coop (3x2)
function genCoop(season) {
  const W = 48, above = 24, H = 32 + above;
  const px = new Pix(W + 4, H + 3);
  const outline = [[2, 34], [24, 18], [45, 34]];
  const wall = new Pix(px.w, px.h);
  for (let x = 5; x <= 42; x++) { const yb = Math.round(outlineY(outline, x)); for (let y = yb + 2; y < H - 3; y++) wall.set(x, y, '#fff'); }
  wallBoards(px, 5, 18, 38, H - 21, '#efe6d2', 51);
  for (let i = 0; i < px.p.length; i++) if (!wall.p[i]) px.p[i] = 0;
  gableRoof(px, outline, 12, 'metal', '#b2483a', 52, '#f4efe2');
  // stilts and the open space beneath
  for (const x of [6, 41]) px.rect(x, H - 4, 2, 4, '#6a4428');
  px.hline(5, 42, H - 4, '#8a7a5a');
  // pop hole with a ramp
  px.rect(20, H - 15, 8, 10, '#2a1a12'); px.frame(19, H - 16, 10, 12, '#a87444');
  for (let i = 0; i < 6; i++) { px.set(28 + i * 2, H - 5 + Math.floor(i / 2), '#8a5a34'); px.set(29 + i * 2, H - 5 + Math.floor(i / 2), '#a87444'); }
  px.line(28, H - 6, 40, H - 1, '#6a4428');
  // nest box hatch on the side and a little window
  px.rect(33, H - 20, 8, 7, '#c8b890'); px.frame(33, H - 20, 8, 7, '#8a5a34'); px.hline(32, 41, H - 21, '#a8483a'); px.set(37, H - 17, '#4a3a2a');
  bWindow(px, 9, H - 20, 7, 6, { bars: 'cross', trim: '#a87444' });
  // a few feathers on the ground
  for (const [x, y] of [[12, H + 1], [31, H + 2], [45, H]]) { px.set(x, y, '#ffffff'); px.set(x + 1, y, '#e8e0d0'); }
  if (season === WINTER) {
    for (let y = 0; y < 36; y++) for (let x = 0; x < W; x++) if (px.op(x, y) && !wall.op(x, y) && valueNoise(x * 0.3, y * 0.3, 53) > 0.2) px.set(x, y, '#f4f8fc');
  }
  finish(px, '#22161a');
  groundShadow(px, W, H, 30);
  return { px, ax: 0, ay: above, lights: [], eaves: [], chimneys: [] };
}

// ---------------------------------------------------------------- Mabel's farmhouse (5x3)
function genFarmhouse(season, lit) {
  const W = 80, above = 44, H = 48 + above;
  const px = new Pix(W + 4, H + 3);
  const wallTop = 54, eave = 58;
  wallStone(px, 4, wallTop, W - 8, H - wallTop, '#b3a690', '#6e6658', 61);
  // quoins
  for (const x of [4, W - 9]) for (let y = wallTop; y < H - 2; y += 6) { px.rect(x, y, (y / 6) % 2 ? 5 : 4, 5, '#cfc6b2'); px.hline(x, x + 3, y + 5, '#6e6658'); }
  // porch over the door
  const doorX = 35;
  bDoor(px, doorX, 70, 10, 22, '#a8443a', { lit, style: 'panel', step: '#a8a296', trim: '#f2ead8', fan: true });
  for (const x of [doorX - 5, doorX + 13]) { px.rect(x, 66, 2, H - 66, '#efe8d8'); px.vline(x + 1, 66, H - 1, '#c8c0b0'); }
  px.poly([[doorX - 8, 66], [doorX + 18, 66], [doorX + 14, 60], [doorX - 4, 60]], '#5a6272');
  px.hline(doorX - 8, doorX + 17, 66, '#3a404c'); px.hline(doorX - 4, doorX + 13, 60, '#7a8496');
  for (let x = doorX - 6; x < doorX + 16; x += 3) px.vline(x, 61, 65, '#4a5262');
  // windows: sash windows with white frames
  for (const wx of [12, 56]) bWindow(px, wx, 68, 12, 13, { lit, bars: 'grid', trim: '#f2ead8', curtain: '#d8c8e8', box: season, boxCols: ['#f4f4f4', '#f6e04a', '#e8485a'] });
  // ivy on the right corner, a bench and milk churns
  climber(px, W - 12, W - 6, 58, H - 2, 'ivy', season, 62);
  px.rect(22, H - 7, 10, 2, '#8a5a34'); px.hline(22, 31, H - 7, '#b07a48'); px.vline(23, H - 5, H - 1, '#6a4428'); px.vline(30, H - 5, H - 1, '#6a4428');
  for (const cx of [51, 55]) { px.rect(cx, H - 8, 4, 8, '#b8c0c8'); px.hline(cx, cx + 3, H - 8, '#e0e6ea'); px.rect(cx + 1, H - 10, 2, 2, '#8a929a'); px.vline(cx + 3, H - 7, H - 1, '#8a929a'); }
  // slate roof with dormers and two brick chimneys
  const mask = roofPlane(px, { x0: 1, x1: W - 2, y0: 12, y1: eave, hipL: 0, hipR: 0, mat: 'slate', base: '#545d6c', seed: 63 });
  eaveShadow(px, 4, W - 5, eave + 1, 3, null);
  for (const dx of [16, 54]) {
    px.rect(dx - 1, 30, 12, 14, '#efe8d8');
    bWindow(px, dx + 1, 33, 8, 8, { lit, bars: 'cross', trim: '#f2ead8' });
    px.poly([[dx - 3, 31], [dx + 13, 31], [dx + 5, 23]], '#4a5262');
    px.line(dx - 3, 30, dx + 5, 22, '#7a8496'); px.line(dx + 5, 22, dx + 13, 30, '#3a404c');
    shadeRect(px, dx - 1, 31, 12, 1, 0.3);
  }
  chimney(px, 4, 2, 8, 18, '#a85a42', '#dccbb0', 64, false);
  chimney(px, W - 12, 2, 8, 18, '#a85a42', '#dccbb0', 65, false);
  if (season === WINTER) { snowOnRoof(px, mask, 12, eave - 1, 66); icicles(px, 2, W - 3, eave + 1, 67); }
  finish(px, '#22181a');
  groundShadow(px, W, H, eave + 2);
  return { px, ax: 0, ay: above, lights: [[18, 74, 24], [62, 74, 24], [21, 37, 14], [59, 37, 14], [40, 64, 10]], eaves: [[8, 26], [60, 26], [72, 26]], chimneys: [[8, 0], [W - 8, 0]] };
}

// ---------------------------------------------------------------- Rose Cottage (5x3)
function genRoseCottage(season, lit) {
  const W = 80, above = 40, H = 48 + above;
  const px = new Pix(W + 4, H + 3);
  const wallTop = 54, eave = 58;
  wallPlaster(px, 4, wallTop, W - 8, H - wallTop, '#efd3c4', 71);
  wallBrick(px, 4, H - 5, W - 8, 5, '#9a5040', '#d8c8b0', 72);
  for (const wx of [11, 57]) bWindow(px, wx, 66, 12, 13, { lit, bars: 'cross', trim: '#f8f2e8', curtain: '#f4c0c8', box: season, boxCols: ['#e8485a', '#f4a0b8', '#ffffff'] });
  bDoor(px, 35, 68, 10, 20, '#3f5f9a', { lit, style: 'panel', step: '#a8a296', trim: '#f8f2e8' });
  // rose arch over the door
  const arch = ramp('#5a7a3a');
  for (let a = 0; a <= 20; a++) {
    const t = a / 20 * Math.PI, x = Math.round(40 - Math.cos(t) * 9), y = Math.round(70 - Math.sin(t) * 9);
    px.set(x, y, arch.d); px.set(x, y - 1, arch.m);
  }
  for (const x of [31, 49]) for (let y = 70; y < H; y++) px.set(x, y, arch.d);
  climber(px, 29, 33, 60, H - 1, 'rose', season, 73);
  climber(px, 47, 51, 60, H - 1, 'rose', season, 74);
  for (let a = 0; a <= 24; a++) {
    if (season === WINTER) break;
    const t = a / 24 * Math.PI, x = Math.round(40 - Math.cos(t) * 9), y = Math.round(69 - Math.sin(t) * 9);
    const r = hash32(a, 3, 75);
    px.set(x, y - 1, r % 3 ? '#4a8a3e' : '#2f6a32');
    if (season === SUMMER && r % 4 === 0) px.set(x + (r & 1), y - 2, r & 8 ? '#e04a5a' : '#f08aa0');
  }
  bush(px, 8, H - 1, 4, season, 76, true); bush(px, 71, H - 1, 4, season, 77, false);
  // terracotta hipped roof with a brick chimney
  const mask = roofPlane(px, { x0: 1, x1: W - 2, y0: 12, y1: eave, hip: 14, mat: 'tile', base: '#b8603e', seed: 78 });
  eaveShadow(px, 4, W - 5, eave + 1, 3, null);
  chimney(px, 22, 4, 8, 18, '#9a5040', '#d8c8b0', 79, false);
  // a little dovecote-style vent in the roof
  px.rect(52, 28, 8, 6, '#f8f2e8'); px.disc(56, 31, 1.5, '#2a1a14'); px.poly([[51, 29], [61, 29], [56, 24]], '#9a4a30');
  if (season === WINTER) { snowOnRoof(px, mask, 12, eave - 1, 80); icicles(px, 2, W - 3, eave + 1, 81); }
  finish(px, '#24161a');
  groundShadow(px, W, H, eave + 2);
  return { px, ax: 0, ay: above, lights: [[17, 72, 24], [63, 72, 24], [40, 74, 10]], eaves: [[8, 22], [26, 22], [72, 22]], chimneys: [[26, 2]] };
}

// ---------------------------------------------------------------- Willow House (5x3)
function genWillowHouse(season, lit) {
  const W = 80, above = 50, H = 48 + above;
  const px = new Pix(W + 4, H + 3);
  const wallTop = 48, eave = 52;
  // half-timbered: ochre plaster between dark oak beams, brick ground floor
  wallPlaster(px, 4, wallTop, W - 8, 22, '#ecd9a4', 91);
  wallBrick(px, 4, wallTop + 22, W - 8, H - wallTop - 22, '#a65a44', '#d8c8b0', 92);
  const oak = '#4a3428';
  beams(px, [[4, wallTop, 4, wallTop + 21, 3], [W - 7, wallTop, W - 7, wallTop + 21, 3], [26, wallTop, 26, wallTop + 21, 3], [52, wallTop, 52, wallTop + 21, 3],
    [4, wallTop + 20, W - 5, wallTop + 20, 3], [7, wallTop + 19, 25, wallTop + 3, 2], [29, wallTop + 3, 51, wallTop + 19, 2], [55, wallTop + 19, W - 8, wallTop + 3, 2]], oak);
  // jettied upper floor casts a shadow on the brick below
  shadeRect(px, 4, wallTop + 23, W - 8, 2, 0.3);
  bWindow(px, 12, wallTop + 6, 10, 9, { lit, bars: 'grid', trim: '#efe6cf' });
  bWindow(px, 34, wallTop + 6, 12, 9, { lit, bars: 'grid', trim: '#efe6cf', curtain: '#a8c8a0' });
  bWindow(px, 58, wallTop + 6, 10, 9, { lit, bars: 'grid', trim: '#efe6cf' });
  bWindow(px, 10, 79, 14, 9, { lit, bars: 'grid', trim: '#efe6cf', box: season });
  bWindow(px, 56, 79, 14, 9, { lit, bars: 'grid', trim: '#efe6cf', box: season, boxCols: ['#b88ae8', '#ffffff', '#f6e04a'] });
  bDoor(px, 35, 77, 10, 21, '#4a7a4a', { lit, style: 'plank', step: '#a8a296', trim: oak });
  lantern(px, 49, 78, lit);
  flowerPot(px, 27, H - 1, season, 3, true);
  // slate roof with a cross gable on the right
  const mask = roofPlane(px, { x0: 1, x1: W - 2, y0: 14, y1: eave, hipL: 0, hipR: 0, mat: 'slate', base: '#525a6a', seed: 93 });
  eaveShadow(px, 4, W - 5, eave + 1, 3, null);
  const gx = 46;
  const gable = new Pix(px.w, px.h);
  gable.poly([[gx, eave], [gx + 30, eave], [gx + 15, 22]], '#fff');
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (gable.op(x, y)) px.set(x, y, '#ecd9a4');
  const g2 = new Pix(px.w, px.h); wallPlaster(g2, gx, 22, 31, eave - 22, '#ecd9a4', 94);
  for (let y = 0; y < px.h; y++) for (let x = 0; x < px.w; x++) if (gable.op(x, y)) px.p[y * px.w + x] = g2.p[y * g2.w + x];
  beams(px, [[gx + 14, 26, gx + 14, eave - 1, 3], [gx + 4, eave - 3, gx + 26, eave - 3, 2], [gx + 6, eave - 4, gx + 14, 32, 2], [gx + 17, 32, gx + 25, eave - 4, 2]], oak);
  bWindow(px, gx + 10, 37, 10, 7, { lit, bars: 'v', trim: '#efe6cf' });
  const R = ramp('#525a6a');
  px.thick(gx - 2, eave - 1, gx + 15, 20, 3, R.m); px.thick(gx + 15, 20, gx + 32, eave - 1, 3, R.d);
  px.line(gx - 3, eave - 3, gx + 15, 18, R.h); px.line(gx + 15, 18, gx + 33, eave - 3, R.l);
  chimney(px, 12, 2, 9, 20, '#a65a44', '#d8c8b0', 95, false);
  if (season === WINTER) { snowOnRoof(px, mask, 14, eave - 1, 96); icicles(px, 2, W - 3, eave + 1, 97); }
  finish(px, '#20161a');
  groundShadow(px, W, H, eave + 2);
  return { px, ax: 0, ay: above, lights: [[17, 59, 16], [40, 59, 18], [63, 59, 16], [17, 83, 20], [63, 83, 20], [61, 40, 12]], eaves: [[9, 38], [30, 38], [72, 38]], chimneys: [[16, 0]] };
}

// ---------------------------------------------------------------- small structures
function genBench(season) {
  const px = new Pix(36, 30);
  const P = ramp('#a8743f');
  // trestles and top
  for (const x of [4, 27]) { px.rect(x, 18, 3, 11, P.d); px.vline(x, 18, 28, P.m); }
  px.rect(3, 23, 28, 2, P.d); px.hline(3, 30, 23, P.m);
  px.rect(1, 12, 32, 6, P.m);
  for (let x = 1; x < 33; x += 8) px.vline(x, 12, 17, P.d);
  px.hline(1, 32, 12, P.h); px.hline(1, 32, 17, P.o);
  px.rect(1, 18, 32, 1, P.d);
  // vice, saw, hammer, a half-built nest box and planks
  px.rect(27, 8, 6, 4, '#6a6e76'); px.rect(28, 6, 4, 2, '#9a9ea6'); px.hline(26, 33, 9, '#4a4e56');
  px.rect(4, 9, 11, 3, '#c8ccd4'); px.hline(4, 14, 11, '#8a8e96'); for (let x = 5; x < 15; x += 2) px.set(x, 11, '#6a6e76'); px.rect(14, 8, 3, 4, P.l);
  px.rect(19, 5, 6, 7, '#b07a42'); px.vline(19, 5, 11, '#c8945a'); px.hline(18, 25, 5, '#5a3e26'); px.disc(22, 8, 1.2, '#2a1a10');
  px.rect(8, 13, 14, 2, '#d8b070');
  px.rect(30, 19, 4, 9, '#c89a62'); px.vline(31, 19, 27, '#a87a48');
  if (season === WINTER) px.hline(1, 32, 11, '#f4f8fb');
  px.outline('#2a1a14');
  return { px, ax: 1, ay: 14 };
}

function genMailbox(flag) {
  const px = new Pix(16, 30);
  px.rect(7, 13, 3, 16, '#8a5a34'); px.vline(7, 13, 28, '#a8743f'); px.vline(9, 13, 28, '#6a4428');
  px.rect(3, 6, 11, 8, '#3a6ab0'); px.ellipse(8.5, 6, 5.5, 2.5, '#5a8ad0');
  px.hline(4, 12, 5, '#7aa6e0'); px.rect(3, 12, 11, 2, '#2a4a80');
  px.rect(4, 8, 2, 4, '#2a4a80'); px.set(5, 9, '#c8d8ec');
  if (flag) { px.vline(14, 2, 10, '#4a4a4a'); px.rect(14, 2, 3, 3, '#e83a2a'); px.set(14, 2, '#ff6a5a'); }
  else px.hline(14, 16, 10, '#4a4a4a');
  px.rect(5, 28, 7, 2, '#7a6a5a');
  px.outline('#14202e');
  return { px, ax: 0, ay: 14 };
}

function genWell(season) {
  const px = new Pix(20, 32);
  const S = ramp('#8e8a84');
  px.ellipse(10, 26, 9, 4.5, S.d);
  wallStone(px, 1, 19, 18, 8, '#8e8a84', '#55504a', 101);
  px.ellipse(10, 19, 8.5, 3.2, S.l); px.ellipse(10, 19, 6.5, 2.2, '#1e3a5a'); px.set(8, 19, '#4a7a9a');
  px.rect(2, 6, 2, 13, '#7a5434'); px.rect(16, 6, 2, 13, '#7a5434'); px.vline(2, 6, 18, '#a8743f'); px.vline(16, 6, 18, '#a8743f');
  px.poly([[0, 8], [20, 8], [15, 1], [5, 1]], '#9a4a30');
  for (let x = 1; x < 19; x += 3) px.vline(x, 2 + Math.max(0, 3 - x) , 7, '#7a3424');
  px.hline(5, 14, 1, '#c86a4a'); px.hline(0, 19, 8, '#6a2a1a');
  px.hline(4, 15, 11, '#5a3a22'); px.disc(10, 11, 1.4, '#8a5a34');
  px.vline(10, 12, 15, '#6a6a6a'); px.rect(8, 15, 4, 3, '#7a5434'); px.hline(8, 11, 15, '#a8743f');
  if (season === WINTER) { px.hline(5, 14, 0, '#f4f8fb'); px.hline(4, 15, 1, '#f4f8fb'); px.hline(1, 18, 18, '#f4f8fb'); }
  px.outline('#2a1a14');
  return { px, ax: 2, ay: 16 };
}
