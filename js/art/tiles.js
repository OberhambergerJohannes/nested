'use strict';
// Seamless, seasonal pixel-art terrain. Every pixel is shaded from world-space noise, so large
// areas (meadows, ponds, paths) never show a repeating tile pattern. Borders between terrain
// types are blended with organic "fringe" masks, and water depth is computed from the distance
// to the shore for smooth shallow-to-deep colour bands.

// Colour ramps (dark -> light) per terrain and season [spring, summer, autumn, winter]
const TRAMP = {
  grass: [
    ['#2b6532', '#38793a', '#488d42', '#5aa14a', '#72b758', '#92cd6c'],
    ['#275a30', '#336b34', '#427f3c', '#539345', '#69aa52', '#86c163'],
    ['#55642c', '#697834', '#7f8b3d', '#969e49', '#adb057', '#c4c069'],
    ['#a5b5c8', '#b9c8d9', '#ccd9e6', '#dfe8f1', '#ecf2f8', '#fafcff'],
  ],
  forest: [
    ['#244f2c', '#2f6232', '#3b7438', '#4a8640', '#5c984a', '#73ab58'],
    ['#214a2a', '#2b5a2f', '#376b35', '#447c3c', '#548e45', '#69a052'],
    ['#4a4e26', '#5a5f2c', '#6c7034', '#7f803c', '#939146', '#a8a152'],
    ['#9eadc0', '#b2c1d2', '#c6d3e1', '#d9e3ee', '#e8eff6', '#f7fafd'],
  ],
  path: [
    ['#86613d', '#9f7649', '#b68b56', '#c99f66', '#dab47a', '#e9c993'],
    ['#8a643e', '#a3794b', '#ba8e58', '#cda268', '#dcb77c', '#ebcc96'],
    ['#7f5c3a', '#987046', '#ae8452', '#c19762', '#d2ab75', '#e1c08e'],
    ['#9d9a9a', '#b3b1b2', '#c9c8ca', '#dcdcde', '#ececee', '#f8f8fa'],
  ],
  soil: [
    ['#3e2a1e', '#523727', '#664530', '#7a553b', '#8e6648', '#a27858'],
    ['#3e2a1e', '#523727', '#664530', '#7a553b', '#8e6648', '#a27858'],
    ['#3a281c', '#4e3425', '#61422e', '#745139', '#886245', '#9c7355'],
    ['#a9adb8', '#bcc0ca', '#cfd2db', '#e0e2ea', '#eeeff4', '#fafbfd'],
  ],
  sand: [
    ['#b08e58', '#c4a268', '#d5b47a', '#e3c48c', '#eed3a0', '#f7e3b9'],
    ['#b4915a', '#c8a56a', '#d9b77c', '#e7c78e', '#f1d6a2', '#f9e6bc'],
    ['#a88754', '#bc9a64', '#cdab75', '#dbbb87', '#e7ca9b', '#f1d9b2'],
    ['#b8b4ac', '#cac6bf', '#dad7d1', '#e8e6e2', '#f2f1ee', '#fbfbfa'],
  ],
  gravel: [
    ['#4c4740', '#625c53', '#7a7368', '#928a7e', '#aca497', '#c6beb2'],
    ['#4c4740', '#625c53', '#7a7368', '#928a7e', '#aca497', '#c6beb2'],
    ['#4a453e', '#5f5950', '#776f64', '#8f877a', '#a8a093', '#c2baad'],
    ['#8e9198', '#a7aab1', '#bfc2c8', '#d5d8dd', '#e8eaee', '#f8f9fb'],
  ],
  mud: [
    ['#2e2116', '#3d2c1e', '#4d3826', '#5e4530', '#71553c', '#86684c'],
    ['#30231a', '#402f22', '#503b2a', '#614834', '#745840', '#896b50'],
    ['#2c2016', '#3b2b1e', '#4b3626', '#5b4330', '#6e523c', '#82644c'],
    ['#58504a', '#6c645d', '#807870', '#968e86', '#ada59d', '#c6c0ba'],
  ],
  rock: [
    ['#4a4e56', '#5e626b', '#737882', '#898e98', '#a0a5ae', '#b9bdc5'],
    ['#4a4e56', '#5e626b', '#737882', '#898e98', '#a0a5ae', '#b9bdc5'],
    ['#4b4d52', '#5f6268', '#74777e', '#8a8d94', '#a1a4aa', '#b9bcc1'],
    ['#8f99a8', '#a6b0bd', '#bec7d2', '#d4dbe4', '#e7ecf2', '#f7f9fc'],
  ],
  cliff: [
    ['#34313a', '#45414c', '#57535f', '#6b6773', '#807c88', '#97939e'],
    ['#34313a', '#45414c', '#57535f', '#6b6773', '#807c88', '#97939e'],
    ['#35323a', '#46424c', '#58545f', '#6c6873', '#817d88', '#98949f'],
    ['#4a4856', '#5e5c6a', '#74727f', '#9a99a8', '#cfd6e0', '#f2f6fa'],
  ],
  marsh: [
    ['#25563f', '#2f6847', '#3b7a50', '#4a8c5a', '#5e9f68', '#79b37c'],
    ['#235241', '#2d6348', '#387452', '#46865c', '#589868', '#71ab7a'],
    ['#4b5a38', '#5b6a3f', '#6c7b47', '#7e8c51', '#919d5d', '#a6ae6b'],
    ['#9fb0bd', '#b4c4cf', '#c8d6df', '#dbe5ec', '#eaf0f5', '#f8fbfd'],
  ],
  clay: [
    ['#6e3a26', '#84472e', '#9a5638', '#ae6644', '#c07853', '#d08c66'],
    ['#6e3a26', '#84472e', '#9a5638', '#ae6644', '#c07853', '#d08c66'],
    ['#683826', '#7d452e', '#925338', '#a56244', '#b77352', '#c78763'],
    ['#9c8a86', '#b09e9a', '#c4b4b0', '#d7cac7', '#e8dfdd', '#f6f1f0'],
  ],
  // water ramp: index 0 = edge foam ... 7 = deepest
  water: [
    ['#c8eef4', '#8fd6e6', '#68c1db', '#4ea9cf', '#3f93c2', '#357fb3', '#2d6da2', '#265d90'],
    ['#c4ecf2', '#8ad3e4', '#62bdd8', '#48a4cc', '#3a8ebf', '#3079b0', '#29679e', '#23578b'],
    ['#c2e6ec', '#8cc8d8', '#68b0c8', '#4f98bb', '#4183ad', '#37709c', '#2f608a', '#285178'],
    ['#e8f6fb', '#bfe2ef', '#97cbe0', '#76b2d0', '#5e9cc0', '#4c88ae', '#40769a', '#376685'],
  ],
  bridge: [
    ['#4a2e18', '#664024', '#82552f', '#9c6a3c', '#b4804c', '#c99960'],
    ['#4a2e18', '#664024', '#82552f', '#9c6a3c', '#b4804c', '#c99960'],
    ['#472c17', '#623e22', '#7d522e', '#97673a', '#ae7d4a', '#c3955d'],
    ['#4a2e18', '#664024', '#82552f', '#9c6a3c', '#d9e2ea', '#f6f9fc'],
  ],
};

// The same ramps as packed uint32 colours (fast path for the per-pixel shader)
const RAMP32 = {};
for (const k in TRAMP) RAMP32[k] = TRAMP[k].map((r) => Uint32Array.from(r.map((c) => C(c))));
const K = (c) => C(c);
const CC = {
  white: K('#ffffff'), shell: K('#fff6ec'), algae: K('#9ec9a8'), moss: K('#6a8a4a'),
  snowA: K('#e8eef4'), snowB: K('#f6f9fc'), snowC: K('#eef3f8'), rutA: K('#8a7a64'), rutB: K('#a89478'),
  bladeF: K('#6f7d62'), bladeG: K('#7f9469'), wetA: K('#7cc4cc'), wetB: K('#5aa6b0'),
  litA: [K('#b8622a'), K('#d8923a'), K('#8a4a24'), K('#c8a040')], litS: [K('#6e5634'), K('#5a4628'), K('#7e6a3e')],
};

const TKEY = [];
TKEY[T.GRASS] = 'grass'; TKEY[T.FOREST] = 'forest'; TKEY[T.PATH] = 'path'; TKEY[T.SOIL] = 'soil';
TKEY[T.SAND] = 'sand'; TKEY[T.GRAVEL] = 'gravel'; TKEY[T.MUD] = 'mud'; TKEY[T.SHALLOW] = 'water';
TKEY[T.WATER] = 'water'; TKEY[T.ROCK] = 'rock'; TKEY[T.CLIFF] = 'cliff'; TKEY[T.MARSH] = 'marsh';
TKEY[T.BRIDGE] = 'bridge'; TKEY[T.CLAY] = 'clay';

const FLOWER_COLS = [
  ['#ffffff', '#f6e04a', '#f4b8cc', '#b8a4f0', '#ffffff'],
  ['#ffffff', '#f6e04a', '#e8584a', '#8a9cf0', '#f6a8d0'],
  ['#e8a03a', '#c8662a', '#d8c45a'],
  [],
];

CC.flowers = FLOWER_COLS.map((a) => a.map((c) => K(c)));

// Legacy palette view used by a few props (cliff tops etc.): {b, d, l, a}
const TPAL = {};
for (const k in TRAMP) {
  TPAL[k] = TRAMP[k].map((r) => ({ b: r[3], d: r[1], l: r[5], a: [r[0], r[4]] }));
}

const hf = (x, y, s) => hash32(x, y, s) / 4294967296;

// Low-frequency noise fields used by the terrain shader. They are expensive (multi-octave),
// so a chunk precomputes them on a 4-pixel grid and interpolates.
const FIELD = {
  grid: null, gx0: 0, gy0: 0, gw: 0,
  rawBig: (x, y) => fbm(x * 0.016, y * 0.016, 101, 3),
  rawFlower: (x, y) => valueNoise(x * 0.02, y * 0.02, 55),
  rawWater: (x, y) => fbm(x * 0.035, y * 0.035, 901, 2),
  rawMid: (x, y) => valueNoise(x * 0.085, y * 0.085, 102),
  rawPath: (x, y) => fbm(x * 0.055, y * 0.055, 201, 2),
  prepare(wx0, wy0, w, h) {
    const gw = Math.ceil(w / 4) + 2, gh = Math.ceil(h / 4) + 2, n = gw * gh;
    const g = { big: new Float32Array(n), flower: new Float32Array(n), water: new Float32Array(n), mid: new Float32Array(n), path: new Float32Array(n), x0: wx0, y0: wy0, gw, gh };
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = wx0 + i * 4, y = wy0 + j * 4, k = j * gw + i;
      g.big[k] = this.rawBig(x, y); g.flower[k] = this.rawFlower(x, y); g.water[k] = this.rawWater(x, y);
      g.mid[k] = this.rawMid(x, y); g.path[k] = this.rawPath(x, y);
    }
    return g;
  },
  use(g) { this.grid = g; if (g) { this.gx0 = g.x0; this.gy0 = g.y0; this.gw = g.gw; this.gh = g.gh; } },
  release() { this.grid = null; },
  _s(arr, raw, x, y) {
    const g = this.grid;
    if (!g) return raw(x, y);
    const fx = (x - this.gx0) / 4, fy = (y - this.gy0) / 4;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= this.gw - 1 || j >= this.gh - 1) return raw(x, y);
    const tx = fx - i, ty = fy - j, k = j * this.gw + i;
    const a = arr[k], b = arr[k + 1], c = arr[k + this.gw], d = arr[k + this.gw + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  },
  big(x, y) { return this._s(this.grid && this.grid.big, this.rawBig, x, y); },
  flower(x, y) { return this._s(this.grid && this.grid.flower, this.rawFlower, x, y); },
  water(x, y) { return this._s(this.grid && this.grid.water, this.rawWater, x, y); },
  mid(x, y) { return this._s(this.grid && this.grid.mid, this.rawMid, x, y); },
  path(x, y) { return this._s(this.grid && this.grid.path, this.rawPath, x, y); },
};

// A grass blade rooted at (rx, ry): root, middle, optional leaning tip. Returns
// 0 = no blade, 1 = root, 2 = middle, 3 = tip.
function bladeAt(wx, wy, dens, seed) {
  let h = hash32(wx, wy, seed);
  if (h / 4294967296 < dens) return 1;
  h = hash32(wx, wy + 1, seed);
  if (h / 4294967296 < dens) return ((h >>> 3) & 3) === 0 ? 3 : 2;
  for (let lean = -1; lean <= 1; lean++) {
    h = hash32(wx - lean, wy + 2, seed);
    if (h / 4294967296 < dens && ((h >>> 3) & 3) !== 0 && (((h >>> 6) % 3) - 1) === lean) return 3;
  }
  return 0;
}

// Cellular (Voronoi) noise: [distance to nearest point, to second nearest, id of nearest]
function cellular(wx, wy, size, seed) {
  const gx = Math.floor(wx / size), gy = Math.floor(wy / size);
  let d1 = 1e9, d2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j, h = hash32(cx, cy, seed);
    const fx = cx * size + (h & 255) / 255 * size, fy = cy * size + ((h >>> 8) & 255) / 255 * size;
    const d = (wx - fx) * (wx - fx) + (wy - fy) * (wy - fy);
    if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
  }
  return [Math.sqrt(d1), Math.sqrt(d2), id];
}

// ---------------------------------------------------------------- per-pixel shading
function shadeGround(type, wx, wy, season, depthAt) {
  const R = RAMP32[TKEY[type]][season];
  switch (type) {
    case T.GRASS: case T.FOREST: case T.MARSH: {
      const big = FIELD.big(wx, wy);
      const mid = FIELD.mid(wx, wy);
      const v = big * 0.55 + mid * 0.45;
      let i = v < 0.3 ? 1 : v < 0.52 ? 2 : v < 0.72 ? 3 : 4;
      if (season === WINTER) {
        // snow drifts, with a few grass blades poking through
        const s = fbm(wx * 0.03, wy * 0.03, 177, 2);
        i = s < 0.35 ? 2 : s < 0.5 ? 3 : s < 0.66 ? 4 : 5;
        if (bladeAt(wx, wy, type === T.FOREST ? 0.012 : 0.02, 909)) return type === T.FOREST ? CC.bladeF : CC.bladeG;
        if (hf(wx, wy, 31) < 0.006) return CC.white;
        return R[i];
      }
      const dens = type === T.FOREST ? 0.05 : type === T.MARSH ? 0.11 : 0.085;
      const b = bladeAt(wx, wy, dens, 303 + type);
      if (b === 1) i = Math.max(0, i - 2);
      else if (b === 2) i = Math.max(0, i - 1);
      else if (b === 3) i = Math.min(5, i + 1);
      if (type === T.FOREST) {
        const lh = hf(wx, wy, 41);
        const litter = season === AUTUMN ? 0.09 : 0.035;
        if (lh < litter) return season === AUTUMN ? CC.litA[Math.floor(lh * 1000) % 4] : CC.litS[Math.floor(lh * 1000) % 3];
      }
      if (type === T.MARSH) {
        const wet = valueNoise(wx * 0.12, wy * 0.12, 47);
        if (wet > 0.74) return wet > 0.82 ? CC.wetA : CC.wetB;
      }
      if (type === T.GRASS && season < WINTER) {
        const fz = FIELD.flower(wx, wy);
        const fh = hf(wx, wy, 57);
        const fp = fz > 0.62 ? 0.012 : 0.003;
        if (fh < fp) { const cols = CC.flowers[season]; return cols[Math.floor(fh * 1e5) % cols.length]; }
      }
      return R[i];
    }
    case T.PATH: case T.SOIL: {
      const n = type === T.PATH ? FIELD.path(wx, wy) : fbm(wx * 0.055, wy * 0.055, 201 + type, 2);
      const m = valueNoise(wx * 0.32, wy * 0.32, 202);
      let i = n < 0.4 ? 2 : n < 0.58 ? 3 : 4;
      if (m > 0.8) i = Math.max(1, i - 1);
      if (season === WINTER && type === T.PATH) {
        // trodden snow with muddy ruts showing through
        const rut = valueNoise(wx * 0.2, wy * 0.05, 207);
        if (rut > 0.72) return (hash32(wx, wy, 3) & 1) ? CC.rutB : CC.rutA;
      }
      const cx = Math.floor(wx / 5), cy = Math.floor(wy / 5), h = hash32(cx, cy, 203 + type);
      if ((h & 7) < 2) {
        const px = cx * 5 + ((h >>> 3) % 4), py = cy * 5 + ((h >>> 6) % 4);
        if (wx === px && wy === py) return R[5];
        if (wx === px + 1 && wy === py && (h & 32)) return R[4];
        if (wx === px && wy === py + 1) return R[1];
        if (wx === px + 1 && wy === py + 1 && (h & 32)) return R[1];
      }
      if (type === T.SOIL && hf(wx, wy, 211) < 0.05) return R[0];
      return R[i];
    }
    case T.SAND: {
      const n = fbm(wx * 0.045, wy * 0.045, 301, 2);
      const rip = Math.sin(wy * 0.72 + wx * 0.16 + n * 7);
      let i = rip > 0.78 ? 2 : rip < -0.86 ? 5 : n > 0.6 ? 4 : 3;
      const h = hf(wx, wy, 303);
      if (h < 0.018) i = 1;
      if (h > 0.9985) return season === WINTER ? CC.white : CC.shell;
      return R[i];
    }
    case T.GRAVEL: {
      const [d1, d2, id] = cellular(wx, wy, 3.6, 401);
      if (d2 - d1 < 0.7) return R[0];
      const tone = 1 + (id % 4);
      return R[d1 < 1.1 && (id & 16) ? Math.min(5, tone + 1) : tone];
    }
    case T.MUD: {
      const n = fbm(wx * 0.06, wy * 0.06, 501, 2);
      let i = n < 0.42 ? 2 : n < 0.58 ? 3 : 4;
      const glint = valueNoise(wx * 0.16, wy * 0.42, 503);
      if (glint > 0.78) i = 5;
      if (hf(wx, wy, 505) < 0.03) i = 1;
      return R[i];
    }
    case T.CLAY: {
      const n = fbm(wx * 0.05, wy * 0.05, 601, 2);
      const band = Math.sin(wy * 0.9 + n * 4);
      let i = band > 0.6 ? 2 : band < -0.6 ? 4 : 3;
      if (hf(wx, wy, 603) < 0.025) i = 1;
      if (hf(wx, wy, 604) < 0.01) i = 5;
      return R[i];
    }
    case T.ROCK: {
      const [d1, d2, id] = cellular(wx, wy, 13, 701);
      if (d2 - d1 < 1.0) return R[0];
      if (d2 - d1 < 1.9) return R[1];
      let i = 2 + (id % 3);
      if (d1 < 3 && (id & 8)) i = Math.min(5, i + 1);
      if (season === SPRING || season === SUMMER) { if (hf(wx, wy, 703) < 0.012) return CC.moss; }
      if (season === WINTER && valueNoise(wx * 0.05, wy * 0.05, 705) > 0.55) return (hash32(wx, wy, 9) & 1) ? CC.snowB : CC.snowA;
      return R[i];
    }
    case T.CLIFF: {
      const [d1, d2, id] = cellular(wx, wy * 1.6, 11, 801);
      if (d2 - d1 < 1.1) return R[0];
      return R[2 + (id % 3)];
    }
    case T.SHALLOW: case T.WATER: {
      const d = depthAt(wx, wy) + (FIELD.water(wx, wy) - 0.5) * 0.55;
      const i0 = clamp(Math.floor(d * 1.9 + 1), 1, 7);
      let i = i0;
      // a hint of sandy bottom in the shallows
      if (i0 <= 2 && hf(wx, wy, 903) < 0.012) return season === WINTER ? R[0] : CC.algae;
      // still-water highlights
      const hl = Math.sin(wx * 0.45 + Math.sin(wy * 0.25) * 2 + wy * 0.05);
      if (hl > 0.985 && (wy % 3) === 0) i = Math.max(1, i - 2);
      return R[i];
    }
    case T.BRIDGE: return R[3];
  }
  return K('#ff00ff');
}

// Fringe masks: which pixels of a tile get covered by a higher-priority neighbour.
// dirs: 0 N, 1 E, 2 S, 3 W, 4 NE, 5 SE, 6 SW, 7 NW, inner corners 8..11 (NE, SE, SW, NW)
const FRINGE = [];
(function buildFringes() {
  for (let d = 0; d < 8; d++) {
    FRINGE[d] = [];
    for (let v = 0; v < 4; v++) {
      const m = new Uint8Array(TS * TS);
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        let inside = false;
        const nz = (t) => valueNoise(t * 0.55 + v * 7.3, d * 3.1, 4242);
        if (d < 4) {
          const along = d === 0 || d === 2 ? x : y;
          const depth = 2.2 + nz(along) * 2.6;
          const dist = d === 0 ? y : d === 2 ? TS - 1 - y : d === 1 ? TS - 1 - x : x;
          inside = dist < depth;
        } else {
          const cx = d === 4 || d === 5 ? TS : 0, cy = d === 4 || d === 7 ? 0 : TS;
          const r = 3.6 + nz(x + y) * 1.8;
          inside = (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 < r * r;
        }
        if (inside) m[y * TS + x] = 1;
      }
      FRINGE[d].push(m);
    }
  }
  for (let c = 0; c < 4; c++) {
    FRINGE[8 + c] = [];
    const cx = c === 0 || c === 1 ? TS : 0, cy = c === 0 || c === 3 ? 0 : TS;
    for (let v = 0; v < 4; v++) {
      const m = new Uint8Array(TS * TS);
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const r = 9.5 + valueNoise((x + y) * 0.5 + v * 5.1, c * 2.7, 977) * 2.5;
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 < r * r) m[y * TS + x] = 1;
      }
      FRINGE[8 + c].push(m);
    }
  }
})();

const NEIGH8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

// Distance (in tiles) from every water tile to the nearest land tile (chamfer distance transform)
function computeWaterDepth(tiles) {
  const W = MAP_W, H = MAP_H, D = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) D[i] = isWaterT(tiles[i]) || tiles[i] === T.BRIDGE ? 99 : 0;
  const pass = (x, y, dx, dy, cost) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
    const i = y * W + x, j = ny * W + nx;
    if (D[j] + cost < D[i]) D[i] = D[j] + cost;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { pass(x, y, -1, 0, 1); pass(x, y, 0, -1, 1); pass(x, y, -1, -1, 1.414); pass(x, y, 1, -1, 1.414); }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { pass(x, y, 1, 0, 1); pass(x, y, 0, 1, 1); pass(x, y, 1, 1, 1.414); pass(x, y, -1, 1, 1.414); }
  for (let i = 0; i < W * H; i++) if (D[i] > 6) D[i] = 6;
  return D;
}

class TileArt {
  constructor() { this.sets = []; this.depth = null; }

  // 16x16 sample tiles per terrain type (for the art sheet export)
  set(season) {
    if (this.sets[season]) return this.sets[season];
    const base = [];
    const fakeDepth = (t) => () => (t === T.WATER ? 3 : 1);
    for (let t = 0; t < TINFO.length; t++) {
      base[t] = [];
      for (let v = 0; v < 4; v++) {
        const px = new Pix(TS, TS);
        for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) px.p[y * TS + x] = shadeGround(t, x + v * 37, y + v * 23, season, fakeDepth(t));
        base[t].push(px);
      }
    }
    this.sets[season] = { base };
    return this.sets[season];
  }

  depthAt(wx, wy) {
    const D = this.depth;
    const fx = wx / TS - 0.5, fy = wy / TS - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const g = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) ? 0 : D[y * MAP_W + x];
    const a = g(x0, y0), b = g(x0 + 1, y0), c = g(x0, y0 + 1), d = g(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  // Render a chunk of tiles into a Pix (all at once).
  renderChunk(tiles, cx, cy, size, season) {
    const job = this.chunkJob(tiles, cx, cy, size, season);
    let r;
    while (!(r = job.next()).done) { /* keep going */ }
    return r.value;
  }

  // A resumable chunk render: each next() renders one row of tiles.
  *chunkJob(tiles, cx, cy, size, season) {
    if (!this.depth) this.depth = computeWaterDepth(tiles);
    const W = size * TS;
    const out = new Pix(W, W);
    const grid = FIELD.prepare(cx * W, cy * W, W, W);
    const mat = new Int8Array(TS * TS);
    for (let ty = 0; ty < size; ty++) {
      FIELD.use(grid);
      if (!this.depth) this.depth = computeWaterDepth(tiles);
      for (let tx = 0; tx < size; tx++) {
        const mx = cx * size + tx, my = cy * size + ty;
        if (mx >= MAP_W || my >= MAP_H) continue;
        this._tile(out, tx * TS, ty * TS, tiles, mx, my, season, mat);
      }
      FIELD.release();
      if (ty < size - 1) yield;
    }
    return out;
  }

  // One tile on its own (used to patch a chunk after a tile changes)
  renderTile(tiles, mx, my, season) {
    if (!this.depth) this.depth = computeWaterDepth(tiles);
    const out = new Pix(TS, TS);
    FIELD.use(FIELD.prepare(mx * TS, my * TS, TS, TS));
    this._tile(out, 0, 0, tiles, mx, my, season, new Int8Array(TS * TS));
    FIELD.release();
    return out;
  }

  _tile(out, ox, oy, tiles, mx, my, season, mat) {
    const W = out.w;
    const tAt = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) ? -1 : tiles[y * MAP_W + x];
    const depthAt = this._depthFn || (this._depthFn = (x, y) => this.depthAt(x, y));
    const t = tAt(mx, my);
    const h = hash32(mx, my, 99);
    if (t === T.BRIDGE) { this._bridge(out, ox, oy, tAt, mx, my, season); return; }
    // which terrain each pixel shows (base or a neighbour's fringe)
    mat.fill(t);
    let edgeTypes = null;
    if (t !== T.CLIFF) {
      const pri = TINFO[t].pri;
      const over = new Map();
      for (let d = 0; d < 8; d++) {
        const [dx, dy] = NEIGH8[d];
        const n = tAt(mx + dx, my + dy);
        if (n < 0 || n === t || n === T.BRIDGE || n === T.CLIFF) continue;
        if (TINFO[n].pri <= pri) continue;
        if (isWaterT(t) && isWaterT(n)) continue; // shallow -> deep is shaded by depth, no border
        if (d >= 4) { if (tAt(mx + dx, my) === n || tAt(mx, my + dy) === n) continue; }
        let arr = over.get(n);
        if (!arr) { arr = []; over.set(n, arr); }
        arr.push(d);
      }
      for (const [, arr] of over) for (let c = 0; c < 4; c++) if (arr.includes(c) && arr.includes((c + 1) % 4)) arr.push(8 + c);
      const types = Array.from(over.keys()).sort((a, b) => TINFO[a].pri - TINFO[b].pri);
      for (const n of types) {
        for (const d of over.get(n)) {
          const fm = FRINGE[d][(h >>> (3 + d)) & 3];
          for (let i = 0; i < 256; i++) if (fm[i]) mat[i] = n;
        }
      }
      edgeTypes = types.length ? types : null;
    }
    // shade pixels
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const i = y * TS + x, m = mat[i];
      const wx = mx * TS + x, wy = my * TS + y;
      let c = shadeGround(m, wx, wy, season, depthAt);
      if (edgeTypes && m !== t) {
        // outline where a fringe meets the base terrain (banks along water get a darker lip)
        const edge = (x > 0 && mat[i - 1] === t) || (x < TS - 1 && mat[i + 1] === t) || (y > 0 && mat[i - TS] === t) || (y < TS - 1 && mat[i + TS] === t);
        if (edge) c = RAMP32[TKEY[m]][season][isWaterT(t) ? 1 : 2];
      } else if (edgeTypes) {
        const adj = (x > 0 && mat[i - 1] !== t) || (x < TS - 1 && mat[i + 1] !== t) || (y > 0 && mat[i - TS] !== t) || (y < TS - 1 && mat[i + TS] !== t);
        if (adj) {
          if (isWaterT(t)) c = RAMP32.water[season][0];
          else c = RAMP32[TKEY[t]][season][1];
        } else if (isWaterT(t)) {
          // second foam ring, broken up
          const adj2 = (x > 1 && mat[i - 2] !== t) || (x < TS - 2 && mat[i + 2] !== t) || (y > 1 && mat[i - 2 * TS] !== t) || (y < TS - 2 && mat[i + 2 * TS] !== t);
          if (adj2 && (hash32(wx, wy, 13) & 3) !== 0) c = RAMP32.water[season][1];
        }
      }
      out.p[(oy + y) * W + ox + x] = c;
    }
    // cliffs: lit plateau tops and shaded faces
    if (t === T.CLIFF) this._cliff(out, ox, oy, tAt, mx, my, season, W);
    else if (tAt(mx, my - 1) === T.CLIFF) {
      for (let x = 0; x < TS; x++) for (let k = 0; k < 3; k++) {
        const i = (oy + k) * W + ox + x;
        out.p[i] = C(darken(toHex(out.p[i]), 0.35 - k * 0.1));
      }
    }
  }

  _cliff(out, ox, oy, tAt, mx, my, season, W) {
    const R = TRAMP.cliff[season];
    const below = tAt(mx, my + 1), above = tAt(mx, my - 1), L = tAt(mx - 1, my), Rr = tAt(mx + 1, my);
    const set = (x, y, c) => { out.p[(oy + y) * W + ox + x] = C(c); };
    if (below === T.CLIFF || below < 0) {
      // plateau: rock top, lit from above-left
      const rp = TRAMP.rock[season];
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const wx = mx * TS + x, wy = my * TS + y;
        const [d1, d2, id] = cellular(wx, wy, 9, 811);
        let c = d2 - d1 < 0.9 ? rp[1] : rp[3 + (id % 2)];
        if (season === WINTER && valueNoise(wx * 0.06, wy * 0.06, 9) > 0.4) c = '#eef3f8';
        set(x, y, c);
      }
      if (L !== T.CLIFF && L >= 0) for (let y = 0; y < TS; y++) { set(0, y, R[0]); set(1, y, R[5]); }
      if (Rr !== T.CLIFF && Rr >= 0) for (let y = 0; y < TS; y++) { set(TS - 1, y, R[0]); set(TS - 2, y, R[2]); }
      if (above !== T.CLIFF && above >= 0) for (let x = 0; x < TS; x++) { set(x, 0, R[0]); set(x, 1, R[5]); }
    } else {
      // face: vertical strata with a bright lip on top and dark foot
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const wx = mx * TS + x;
        const strata = Math.sin(wx * 0.9 + y * 0.15) + valueNoise(wx * 0.3, y * 0.5, 821) * 1.4;
        let c = strata > 1.1 ? R[4] : strata > 0.4 ? R[3] : strata > -0.3 ? R[2] : R[1];
        if (y > TS - 4) c = R[Math.max(0, 1 - (y - (TS - 4)) / 2 | 0)];
        set(x, y, c);
      }
      if (above !== T.CLIFF && above >= 0) {
        for (let x = 0; x < TS; x++) { set(x, 0, R[0]); set(x, 1, season === WINTER ? '#f4f8fb' : R[5]); set(x, 2, R[4]); }
        if (above === T.GRASS || above === T.FOREST) {
          const g = TRAMP[TKEY[above]][season];
          for (let x = 0; x < TS; x++) if (hash32(mx * 16 + x, my, 5) & 1) { set(x, 0, g[3]); if (hash32(mx * 16 + x, my, 6) & 1) set(x, 1, g[2]); }
        }
      }
      if (L !== T.CLIFF && L >= 0) for (let y = 0; y < TS; y++) set(0, y, R[0]);
      if (Rr !== T.CLIFF && Rr >= 0) for (let y = 0; y < TS; y++) set(TS - 1, y, R[0]);
      for (let x = 0; x < TS; x++) set(x, TS - 1, R[0]);
    }
  }

  _bridge(out, ox, oy, tAt, mx, my, season) {
    const R = TRAMP.bridge[season], W = out.w;
    const set = (x, y, c) => { out.p[(oy + y) * W + ox + x] = C(c); };
    // water above/below means people cross east-west, so planks run north-south
    const walkEW = isWaterT(tAt(mx, my - 1)) || isWaterT(tAt(mx, my + 1));
    for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
      const a = walkEW ? x : y, b = walkEW ? y : x;
      const plank = Math.floor(a / 4), k = a % 4;
      const wx = mx * TS + x, wy = my * TS + y;
      const grain = valueNoise((walkEW ? wy : wx) * 0.4, plank * 3.7 + (walkEW ? mx : my) * 11, 1201);
      let c = k === 3 ? R[0] : k === 0 ? R[4] : grain > 0.62 ? R[4] : grain < 0.3 ? R[2] : R[3];
      if (k === 1 && (b === 2 || b === 13)) c = R[1];
      if (season === WINTER && k !== 3 && hf(wx, wy, 1203) < 0.25) c = '#eef3f8';
      set(x, y, c);
    }
    // rails along water-facing sides
    const railTop = isWaterT(tAt(mx, my - 1)), railBot = isWaterT(tAt(mx, my + 1));
    const railL = isWaterT(tAt(mx - 1, my)), railR = isWaterT(tAt(mx + 1, my));
    if (walkEW) {
      if (railTop) { for (let x = 0; x < TS; x++) { set(x, 0, R[0]); set(x, 1, R[5]); set(x, 2, R[2]); } set(3, 3, R[0]); set(11, 3, R[0]); }
      if (railBot) { for (let x = 0; x < TS; x++) { set(x, TS - 3, R[5]); set(x, TS - 2, R[2]); set(x, TS - 1, R[0]); } }
    } else {
      if (railL) for (let y = 0; y < TS; y++) { set(0, y, R[0]); set(1, y, R[5]); set(2, y, R[2]); }
      if (railR) for (let y = 0; y < TS; y++) { set(TS - 3, y, R[5]); set(TS - 2, y, R[2]); set(TS - 1, y, R[0]); }
    }
  }
}

// Grass tufts drawn over the terrain: medium (1) and long (2). Seasonal colours.
function buildGrassTufts(season) {
  const R = TRAMP.grass[season === WINTER ? AUTUMN : season];
  const pal = season === WINTER ? { d: '#8a9478', m: '#a6ae92', l: '#c8ccb8', f: '#ffffff', s: '#f6f9fc' }
    : { d: R[1], m: R[2], l: R[4], f: season === SUMMER ? '#f4e8b0' : season === AUTUMN ? '#d8b860' : '#f6f2dc', s: null };
  const out = { mid: [], long: [] };
  for (let v = 0; v < 3; v++) {
    const rnd = artRng('tuft' + season + v);
    const mid = new Pix(16, 10);
    for (let i = 0; i < 6; i++) {
      const x = 2 + Math.floor(rnd() * 12), hgt = 3 + Math.floor(rnd() * 3), lean = rnd() < 0.5 ? -1 : 1;
      mid.line(x, 9, x + lean, 9 - hgt, i % 2 ? pal.m : pal.d);
      mid.set(x + lean, 9 - hgt, pal.l);
    }
    out.mid.push(mid);
    for (const frame of [0, 1]) {
      const lg = new Pix(18, 20);
      const r2 = artRng('long' + season + v);
      // back layer (darker) then front layer (lighter)
      for (let layer = 0; layer < 2; layer++) {
        for (let i = 0; i < 8; i++) {
          const x = 1 + Math.floor(r2() * 16), hgt = (layer ? 6 : 8) + Math.floor(r2() * 6);
          const lean = (r2() < 0.5 ? -1 : 1) * (1 + Math.floor(r2() * 2)) + (frame ? 1 : 0);
          const base = 19 - Math.floor(r2() * 5);
          const top = base - hgt;
          for (let y = base; y >= top; y--) {
            const k = (base - y) / hgt;
            const xx = Math.round(x + lean * k * k);
            lg.set(xx, y, k > 0.75 ? pal.l : k > 0.35 ? pal.m : pal.d);
          }
          if (layer && i % 3 === 0) lg.set(Math.round(x + lean), top, pal.f);
          if (pal.s && i % 2 === 0) lg.set(Math.round(x + lean), top, pal.s);
        }
      }
      if (season === SUMMER || season === AUTUMN) for (let i = 0; i < 3; i++) { const x = 3 + Math.floor(r2() * 12); lg.set(x + frame, 7 + Math.floor(r2() * 4), pal.f); lg.set(x + frame, 8 + Math.floor(r2() * 4), pal.f); }
      shadeOutline(lg, '#1d2a1a', 0.35);
      out.long.push(lg);
    }
  }
  return out;
}
