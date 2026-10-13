'use strict';
// Deterministic generation of Featherbrook Valley (96 x 72 tiles).

// Named zones [x0, y0, x1, y1] (inclusive) used for spawning forage, clues and visiting birds.
const ZONES = {
  garden: [34, 20, 57, 37],
  forest: [2, 1, 70, 14],
  pines: [1, 1, 18, 14],
  farm: [2, 19, 28, 38],
  meadow: [2, 39, 28, 49],
  pond: [11, 50, 37, 67],
  village: [57, 21, 76, 40],
  orchard: [45, 36, 58, 47],
  hills: [73, 1, 93, 21],
  eastmeadow: [84, 24, 93, 63],
  southmeadow: [40, 57, 92, 68],
};

const RIVER_PTS = [[86, -1], [85, 6], [83, 12], [81, 18], [80, 24], [80, 30], [79.5, 36], [77.5, 42], [73, 47],
  [66, 50.5], [58, 51.5], [50, 52.5], [42, 54.5], [36, 57], [32, 58]];
const OUTFLOW_PTS = [[16, 60.5], [9, 62], [-1, 63]];

const HOME_SPAWN = [44 * TS + 8, 29 * TS + 4]; // in front of the cottage door (px)

function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const L = vx * vx + vy * vy;
  let t = L ? (wx * vx + wy * vy) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = ax + vx * t - px, dy = ay + vy * t - py;
  return Math.sqrt(dx * dx + dy * dy);
}
function polyDist(px, py, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

function generateMap(seed) {
  const W = MAP_W, H = MAP_H;
  const tiles = new Uint8Array(W * H).fill(T.GRASS);
  const grass = new Uint8Array(W * H);
  const wild = new Uint8Array(W * H);
  const reserved = new Uint8Array(W * H);
  const occ = new Uint8Array(W * H);
  const objs = [];
  const rnd = mulberry32(seed ^ 0x5eed);
  const I = (x, y) => y * W + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const get = (x, y) => (inb(x, y) ? tiles[I(x, y)] : T.CLIFF);
  const set = (x, y, t) => { if (inb(x, y)) tiles[I(x, y)] = t; };
  const isLand = (t) => t !== T.WATER && t !== T.SHALLOW && t !== T.CLIFF && t !== T.BRIDGE;
  const inRect = (x, y, r) => x >= r[0] && y >= r[1] && x <= r[2] && y <= r[3];

  // ---- 1. forest, hills, borders ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = 13 + 3 * fbm(x * 0.09, 3.3, seed + 11, 3);
    if (x < 73 && y < edge) set(x, y, T.FOREST);
    if (x < 2 && y >= 12) set(x, y, T.FOREST);
    if (y >= H - 2) set(x, y, T.FOREST);
    if (x >= W - 2 && y >= 20) set(x, y, T.FOREST);
    const hillEdge = 19 + 3 * fbm(x * 0.15, 8.1, seed + 23, 2);
    if (x >= 72 + 2 * fbm(5.5, y * 0.2, seed + 5, 2) && y < hillEdge) set(x, y, T.ROCK);
  }
  // hill borders and outcrops
  for (let x = 72; x < W; x++) { set(x, 0, T.CLIFF); }
  for (let y = 0; y < 22; y++) { set(W - 1, y, T.CLIFF); set(W - 2, y, T.CLIFF); }
  for (const [cx, cy, w, h] of [[75, 4, 3, 2], [90, 9, 3, 2], [77, 14, 2, 2], [91, 17, 2, 2]]) {
    for (let y = cy; y < cy + h; y++) for (let x = cx; x < cx + w; x++) set(x, y, T.CLIFF);
  }

  // ---- 2. river ----
  const riverside = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = polyDist(x + 0.5, y + 0.5, RIVER_PTS) + (valueNoise(x * 0.4, y * 0.4, seed + 3) - 0.5) * 0.5;
    if (d < 1.5) set(x, y, T.WATER);
    else if (d < 2.5) set(x, y, T.SHALLOW);
    else if (d < 4.5) riverside.push([x, y]);
    const d2 = polyDist(x + 0.5, y + 0.5, OUTFLOW_PTS);
    if (d2 < 0.9) set(x, y, T.WATER);
    else if (d2 < 1.7 && get(x, y) !== T.WATER) set(x, y, T.SHALLOW);
  }

  // ---- 3. ponds ----
  function pond(cx, cy, rx, ry, deep, marsh, mudFn) {
    for (let y = Math.floor(cy - ry * 1.6); y <= cy + ry * 1.6; y++) for (let x = Math.floor(cx - rx * 1.6); x <= cx + rx * 1.6; x++) {
      if (!inb(x, y)) continue;
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      const small = rx < 3.5;
      const e = Math.sqrt(nx * nx + ny * ny) + (valueNoise(x * 0.5, y * 0.5, seed + 77) - 0.5) * (small ? 0.42 : 0.18);
      const t = get(x, y);
      if (e < deep) set(x, y, T.WATER);
      else if (e < 1.0) { if (t !== T.WATER) set(x, y, T.SHALLOW); }
      else if (mudFn && mudFn(e, x + 0.5 - cx, y + 0.5 - cy) && isLand(t)) set(x, y, T.MUD);
      else if (e < marsh && (t === T.GRASS || t === T.FOREST)) set(x, y, T.MARSH);
    }
  }
  pond(24, 58, 9.5, 6, 0.62, 1.38, (e, dx, dy) => e < 1.22 && dx > 1 && dy < 1 && dx > -dy * 0.3);
  pond(22.5, 25.5, 2.7, 2.0, 0.55, 1.0, (e, dx, dy) => e < 1.4 && dy > 0.3);
  pond(50.5, 33.5, 3.0, 2.2, 0.45, 1.0, (e, dx, dy) => e < 1.32 && dx < -1.8 && Math.abs(dy) < 1.4);
  pond(89.5, 45.5, 3.2, 2.4, 0.55, 1.6, null);

  // ---- 4. sand, gravel, clay along the river ----
  for (const [x, y] of riverside) {
    const t = get(x, y);
    if (!isLand(t)) continue;
    if (dist2(x, y, 75.5, 41.5) < 7 || dist2(x, y, 53, 55.5) < 7 || dist2(x, y, 37.5, 55.5) < 3.5 || dist2(x, y, 84.5, 33.5) < 3) set(x, y, T.SAND);
    else if (dist2(x, y, 83, 21.5) < 5 || dist2(x, y, 77.5, 26) < 2.5) set(x, y, T.GRAVEL);
    else if (dist2(x, y, 69.5, 46.5) < 2.6 || dist2(x, y, 45, 56.5) < 2) set(x, y, T.CLAY);
  }

  // ---- 5. paths & bridges ----
  function path(pts, hw) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (polyDist(x + 0.5, y + 0.5, pts) < (hw || 0.75)) {
        const t = get(x, y);
        if (isLand(t) && t !== T.MUD) set(x, y, T.PATH);
        if (isLand(t)) reserved[I(x, y)] = 1;
      }
    }
  }
  path([[12, 28.5], [20, 29.5], [30, 30.5], [40, 30.5], [50, 30.5], [52, 30.5], [60, 30.5], [70, 30.5], [77, 30.5]], 0.8);
  path([[83, 30.5], [88, 31.5], [89.5, 37], [89.5, 41]], 0.95);
  path([[36, 30.5], [36, 23], [37, 16], [36, 9], [33, 3]], 0.95);
  path([[44.5, 28], [44.5, 30.5]]);
  path([[44.5, 30.5], [45.5, 36], [52, 42], [58.5, 46.5], [58.5, 49]], 0.95);
  path([[58.5, 54], [59.5, 60], [66, 64.5]], 0.95);
  path([[62.5, 30.5], [62.5, 28]]);
  path([[66, 30.5], [68, 33], [69.5, 36.5]]);
  path([[12, 28.5], [9.5, 27], [8.5, 26.5]]);
  path([[30, 30.5], [28.5, 40], [28.5, 48], [29, 51]], 0.95);
  path([[52.5, 27], [52.5, 30.5]]);           // Rose Cottage
  path([[70.5, 26], [70.5, 30.5]]);           // Willow House
  path([[18.5, 21], [18.5, 28.5]]);           // Mabel's farmhouse
  for (let x = 74; x <= 87; x++) for (let y = 30; y <= 31; y++) if (isWaterT(get(x, y))) { set(x, y, T.BRIDGE); reserved[I(x, y)] = 1; }
  for (let y = 46; y <= 57; y++) for (let x = 58; x <= 59; x++) if (isWaterT(get(x, y))) { set(x, y, T.BRIDGE); reserved[I(x, y)] = 1; }

  // ---- 6. grass heights (wild meadows grow long, lawns stay short) ----
  const lawnRects = [[33, 19, 58, 38], [56, 21, 77, 41], [44, 35, 59, 48], [2, 19, 29, 38]];
  const meadowRects = [[2, 39, 28, 49], [84, 23, 93, 64], [40, 57, 92, 68], [62, 38, 76, 46], [18, 50, 40, 68]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = I(x, y), t = tiles[i];
    if (t !== T.GRASS && t !== T.MARSH) continue;
    if (reserved[i]) continue;
    let isWild = t === T.MARSH;
    for (const r of meadowRects) if (inRect(x, y, r)) isWild = true;
    if (!isWild && fbm(x * 0.13, y * 0.13, seed + 41, 3) > 0.64) isWild = true;
    for (const r of lawnRects) if (inRect(x, y, r)) isWild = t === T.MARSH;
    if (isWild) {
      wild[i] = 1;
      const n = valueNoise(x * 0.35, y * 0.35, seed + 9);
      grass[i] = n < 0.18 ? 1 : 2;
    }
  }

  // ---- placement helpers ----
  let nextTmp = 1;
  function free(x, y) { return inb(x, y) && !occ[I(x, y)] && !reserved[I(x, y)]; }
  function put(o, w, h) {
    w = w || 1; h = h || 1;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) occ[I(o.x + dx, o.y + dy)] = 1;
    o.nat = 1;
    objs.push(o);
    return o;
  }
  function reserveRect(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) reserved[I(x, y)] = 1;
  }
  function treeNear(x, y, r) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!inb(x + dx, y + dy)) continue;
      if (occ[I(x + dx, y + dy)] === 2) return true;
    }
    return false;
  }
  function putTree(kind, x, y, st) {
    if (!free(x, y) || treeNear(x, y, 1)) return null;
    const t = get(x, y);
    if (!isLand(t) || t === T.PATH || t === T.MUD || t === T.ROCK && kind !== 'pine') return null;
    const o = put({ type: 'tree', kind, x, y, st: st == null ? 2 : st, g: 0 });
    occ[I(x, y)] = 2;
    return o;
  }
  function nearestFree(x, y, test) {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (free(x + dx, y + dy) && (!test || test(x + dx, y + dy))) return [x + dx, y + dy];
    }
    return null;
  }

  // ---- 7. buildings ----
  function building(kind, x, y) {
    const b = BUILDINGS[kind];
    for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) { set(x + dx, y + dy, T.GRASS); grass[I(x + dx, y + dy)] = 0; wild[I(x + dx, y + dy)] = 0; }
    put({ type: 'building', kind, x, y }, b.w, b.h);
    reserveRect(x - 1, y - 1, x + b.w, y + b.h);
  }
  building('cottage', 42, 25);
  building('house1', 50, 24);
  building('house2', 68, 23);
  building('farmhouse', 16, 18);
  building('barn', 6, 22);
  building('coop', 14, 23);
  building('shop', 60, 25);
  building('station', 67, 33);
  building('bench', 39, 26);
  building('mailbox', 46, 28);
  building('well', 72, 29);
  // keep the spots where villagers stand clear (their routes follow paths)
  for (const k in NPCS) {
    const n = NPCS[k], spots = [];
    if (n.start) spots.push(n.start);
    for (const e of n.sched) spots.push(e[1][e[1].length - 1]);
    for (const [x, y] of spots) reserveRect(Math.floor(x) - 1, Math.floor(y) - 1, Math.floor(x) + 1, Math.floor(y) + 1);
  }
  // landmarks
  for (const k in LANDMARKS) {
    const l = LANDMARKS[k], w = l.w || 1, h = l.h || 1;
    const ok = (x, y) => { for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { const t = get(x + dx, y + dy); if (!free(x + dx, y + dy) || !isLand(t) || t === T.PATH) return false; } return true; };
    let at = null;
    for (let r = 0; r < 6 && !at; r++) for (let dy = -r; dy <= r && !at; dy++) for (let dx = -r; dx <= r && !at; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(l.at[0] + dx, l.at[1] + dy)) at = [l.at[0] + dx, l.at[1] + dy];
    }
    if (!at) continue;
    put({ type: 'landmark', kind: k, x: at[0], y: at[1] }, w, h);
    reserveRect(at[0] - 1, at[1] - 1, at[0] + w, at[1] + h);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) { grass[I(at[0] + dx, at[1] + dy)] = 0; }
  }

  // ---- 8. fences (pens) ----
  function pen(x0, y0, x1, y1, gates) {
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) {
      if (gates.some((g) => g[0] === x && g[1] === y)) continue;
      if (!occ[I(x, y)]) put({ type: 'fence', kind: 'wood', x, y });
    }
    for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) {
      if (gates.some((g) => g[0] === x && g[1] === y)) continue;
      if (!occ[I(x, y)]) put({ type: 'fence', kind: 'wood', x, y });
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { reserved[I(x, y)] = 1; if (tiles[I(x, y)] === T.GRASS) { grass[I(x, y)] = 0; wild[I(x, y)] = 0; } }
  }
  pen(3, 31, 13, 37, [[8, 31], [9, 31]]);
  pen(16, 31, 23, 36, [[19, 31], [20, 31]]);

  // ---- 9. fixed trees & shrubs ----
  const fixedTrees = [
    ['oak', 37, 23], ['apple', 56, 27], ['oak', 58, 37], ['birch', 74, 26], ['birch', 55, 22], ['birch', 30, 35],
    ['oak', 25, 20], ['oak', 4, 20], ['birch', 24, 44], ['oak', 50, 63], ['oak', 80, 65], ['birch', 75, 60], ['birch', 45, 62],
    ['birch', 88, 52], ['oak', 66, 38], ['birch', 35, 39],
    // willows by water
    ['willow', 13, 53], ['willow', 16, 64], ['willow', 31, 52], ['willow', 34, 62], ['willow', 10, 58], ['willow', 27, 65],
    ['willow', 70, 44], ['willow', 62, 48], ['willow', 47, 51], ['willow', 83, 38], ['willow', 84, 26], ['willow', 86, 43],
    ['willow', 93, 47], ['willow', 25, 23], ['willow', 53, 35],
  ];
  for (const [k, x, y] of fixedTrees) { const p = nearestFree(x, y, (a, b) => isLand(get(a, b)) && get(a, b) !== T.PATH); if (p) putTree(k, p[0], p[1]); }
  for (const x of [47, 50, 53, 56]) for (const y of [38, 41, 44]) {
    const jx = x + (hashf(x, y, seed) < 0.5 ? 0 : 1);
    putTree('apple', jx, y);
  }
  // snags (standing dead trees)
  for (const [x, y] of [[26, 9], [52, 6], [61, 12], [11, 11], [33, 12], [66, 4]]) {
    const p = nearestFree(x, y, (a, b) => isLand(get(a, b)) && get(a, b) !== T.PATH);
    if (p) { put({ type: 'tree', kind: 'snag', x: p[0], y: p[1], st: 2 }); occ[I(p[0], p[1])] = 2; }
  }

  function putShrub(kind, x, y) {
    if (!free(x, y)) return null;
    const t = get(x, y);
    if (!(t === T.GRASS || t === T.FOREST || t === T.MARSH)) return null;
    return put({ type: 'shrub', kind, x, y, st: 2, g: 0, fr: 0 });
  }
  for (const [k, x, y] of [['hawthorn', 38, 31], ['elder', 48, 23], ['hazel', 36, 34], ['bramble', 55, 35],
    ['hawthorn', 57, 24], ['elder', 75, 37], ['blackthorn', 64, 36], ['hazel', 26, 33], ['bramble', 19, 51],
    ['bramble', 33, 56], ['elder', 18, 20], ['hawthorn', 52, 28]]) {
    const p = nearestFree(x, y, (a, b) => get(a, b) === T.GRASS || get(a, b) === T.FOREST);
    if (p) putShrub(k, p[0], p[1]);
  }
  // hedgerows
  const hedgeKinds = ['hawthorn', 'blackthorn', 'hawthorn', 'bramble', 'hazel', 'elder', 'blackthorn'];
  for (let x = 18; x <= 68; x++) {
    if (x > 32 && x < 40) continue;
    if (hashf(x, 16, seed) < 0.42) putShrub(hedgeKinds[Math.floor(hashf(x, 17, seed) * hedgeKinds.length)], x, 16 + (hashf(x, 18, seed) < 0.5 ? 0 : 1));
  }
  for (let y = 19; y <= 38; y++) {
    if (y >= 28 && y <= 32) continue;
    if (hashf(32, y, seed) < 0.55) putShrub(hedgeKinds[Math.floor(hashf(33, y, seed) * hedgeKinds.length)], 32, y);
  }
  for (let x = 40; x <= 92; x++) {
    if (x >= 64 && x <= 67) continue;
    if (hashf(x, 68, seed) < 0.5) putShrub(['hawthorn', 'blackthorn', 'bramble'][Math.floor(hashf(x, 69, seed) * 3)], x, 68);
  }

  // ---- 10. forests ----
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = get(x, y);
    if (t !== T.FOREST) continue;
    const clearing = fbm(x * 0.11, y * 0.11, seed + 61, 3) > 0.63;
    const border = x < 2 || y >= H - 2 || x >= W - 2;
    const dens = border ? 0.75 : clearing ? 0.04 : 0.36;
    if (rnd() > dens) continue;
    let kind;
    if (x < 19 && y < 15) kind = rnd() < 0.85 ? 'pine' : 'birch';
    else { const r = rnd(); kind = r < 0.5 ? 'oak' : r < 0.84 ? 'birch' : 'pine'; }
    putTree(kind, x, y);
  }
  // forest understory shrubs
  for (let i = 0; i < 40; i++) {
    const x = 3 + Math.floor(rnd() * 66), y = 2 + Math.floor(rnd() * 12);
    if (get(x, y) === T.FOREST) putShrub(['hazel', 'elder', 'bramble', 'hazel'][Math.floor(rnd() * 4)], x, y);
  }

  // ---- 11. rocks, logs, stumps ----
  let placed = 0;
  for (let tries = 0; tries < 400 && placed < 14; tries++) {
    const x = 73 + Math.floor(rnd() * 20), y = 1 + Math.floor(rnd() * 19);
    if (get(x, y) === T.ROCK && free(x, y)) { put({ type: 'rock', kind: 'boulder', x, y, li: 2 }); placed++; }
  }
  for (const [x, y] of [[20, 45], [86, 57], [70, 64], [12, 42]]) { const p = nearestFree(x, y); if (p) put({ type: 'rock', kind: 'boulder', x: p[0], y: p[1], li: 2 }); }
  placed = 0;
  for (let tries = 0; tries < 600 && placed < 12; tries++) {
    const x = 3 + Math.floor(rnd() * 66), y = 2 + Math.floor(rnd() * 12);
    if (get(x, y) === T.FOREST && free(x, y)) { put({ type: 'rock', kind: 'mossy', x, y, moss: 2 }); placed++; }
  }
  placed = 0;
  for (let tries = 0; tries < 800 && placed < 10; tries++) {
    const x = 3 + Math.floor(rnd() * 65), y = 2 + Math.floor(rnd() * 12);
    if (get(x, y) === T.FOREST && get(x + 1, y) === T.FOREST && free(x, y) && free(x + 1, y)) {
      put({ type: 'log', kind: 'oak', x, y, moss: 2, rv: -1 }, 2, 1); placed++;
    }
  }
  placed = 0;
  for (let tries = 0; tries < 600 && placed < 8; tries++) {
    const x = 3 + Math.floor(rnd() * 66), y = 2 + Math.floor(rnd() * 13);
    if (get(x, y) === T.FOREST && free(x, y)) { put({ type: 'stump', kind: 'oak', x, y, moss: 1 }); placed++; }
  }

  // ---- 12. plants ----
  function scatterPlant(kind, n, rect, test) {
    let c = 0;
    for (let tries = 0; tries < 600 && c < n; tries++) {
      const x = rect[0] + Math.floor(rnd() * (rect[2] - rect[0] + 1)), y = rect[1] + Math.floor(rnd() * (rect[3] - rect[1] + 1));
      if (!free(x, y) || !test(get(x, y))) continue;
      put({ type: 'plant', kind, x, y, st: 2, g: 0, hv: -1 });
      c++;
    }
  }
  const wet = (t) => t === T.SHALLOW || t === T.MARSH;
  const dry = (t) => t === T.GRASS;
  scatterPlant('reed', 7, [14, 51, 34, 65], wet);
  scatterPlant('cattail', 5, [14, 51, 34, 65], wet);
  scatterPlant('reed', 2, [19, 23, 26, 28], wet);
  scatterPlant('reed', 3, [85, 42, 94, 49], wet);
  scatterPlant('cattail', 2, [85, 42, 94, 49], wet);
  scatterPlant('reed', 5, [40, 48, 78, 56], (t) => t === T.SHALLOW);
  scatterPlant('thistle', 4, [44, 58, 90, 67], dry);
  scatterPlant('thistle', 2, [3, 40, 27, 48], dry);
  scatterPlant('wildflower', 8, [42, 58, 90, 67], dry);
  scatterPlant('wildflower', 4, [85, 24, 93, 62], dry);
  scatterPlant('wildflower', 4, [3, 40, 27, 48], dry);
  scatterPlant('wildflower', 3, [35, 32, 56, 37], dry);

  return { tiles, grass, wild, objs, riverside };
}
