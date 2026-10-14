'use strict';
// World renderer: terrain chunks, y-sorted sprites, birds, effects, weather and lighting.

const CHUNK = 16;
const byY = (a, b) => a.y - b.y;

class Renderer {
  constructor(game) {
    this.game = game;
    this.chunks = new Map();
    this.jobs = new Map();
    this.stale = new Map();    // last season's chunks: shown for a moment while the new ones are painted
    this.quick = new Map();    // rough stand-ins for chunks that aren't painted yet
    this.worldKey = '';
    this.budget = 0; this.syncBuild = false;
    this.season = -1;
    this.lightCv = document.createElement('canvas');
    this.lightG = this.lightCv.getContext('2d');
    this.glow = this._makeGlow();
    this.stamp = 0;
    this.rain = [];
    this.fireflies = [];
    this.smokeT = 0;
    this.smokeI = 0;
    this._chimneys = [];
    this.leafT = 0;
    this.pool = []; this.np = 0; this.list = []; this.flying = [];  // reused draw lists
    this.shadows = {};
    this.strips = new Map();   // 'chunkX,row' -> long-grass strip
    this.tileVer = 0;          // bumps whenever terrain changes (water layer redraw)
    this.ls = null; this.lsKey = '';
    this.lights = [];
  }

  _makeGlow() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,236,180,1)');
    gr.addColorStop(0.45, 'rgba(255,210,140,0.55)');
    gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return cv;
  }

  invalidateAll() {
    // a different valley: nothing old may show; the same valley: old chunks stand in while repainting
    const key = this.game.state ? this.game.state.seed + '|' + this.game.state.name : '';
    if (key !== this.worldKey) { this.stale.clear(); this.worldKey = key; }
    else for (const [k, c] of this.chunks) this.stale.set(k, c);
    this.chunks.clear(); this.jobs.clear(); this.quick.clear(); this.strips.clear(); this.tileVer++; SPR.tiles.depth = null;
  }

  // Build terrain chunks near the camera in the background, a few milliseconds per frame,
  // so walking into new areas never stalls.
  prewarm(S, cam, view, budget) {
    if (!S || !S.tiles) return;
    const season = S.time.season;
    if (season !== this.season) return;
    const t0 = performance.now();
    const ccx = Math.floor((cam.x + view.w / 2) / (CHUNK * TS)), ccy = Math.floor((cam.y + view.h / 2) / (CHUNK * TS));
    const nx = Math.ceil(MAP_W / CHUNK), ny = Math.ceil(MAP_H / CHUNK);
    while (performance.now() - t0 < (budget || 5)) {
      let best = null, bd = 1e9;
      for (let cy = 0; cy < ny; cy++) for (let cx = 0; cx < nx; cx++) {
        if (this.chunks.has(cx + ',' + cy)) continue;
        const d = (cx - ccx) ** 2 + (cy - ccy) ** 2;
        if (d < bd) { bd = d; best = [cx, cy]; }
      }
      if (!best) { this.stale.clear(); return; }
      const key = best[0] + ',' + best[1];
      let job = this.jobs.get(key);
      if (!job) { job = SPR.tiles.chunkJob(S.tiles, best[0], best[1], CHUNK, season); this.jobs.set(key, job); }
      while (performance.now() - t0 < (budget || 5)) {
        const r = job.next();
        if (r.done) { this.chunks.set(key, this._finish(S, best[0], best[1], r.value, season)); this.jobs.delete(key); this.stale.delete(key); this.quick.delete(key); break; }
      }
    }
  }

  // A visible chunk. Missing ones are painted within a small time budget per frame (all at once only
  // when nothing at all is on screen yet); until they're done, last season's chunk or a rough
  // stand-in is shown, so walking or a new season never freezes the game.
  _chunk(S, cx, cy, season) {
    const key = cx + ',' + cy;
    const c = this.chunks.get(key);
    if (c) return c;
    if (this.syncBuild || this.budget > 0) {
      const t0 = performance.now();
      let job = this.jobs.get(key);
      if (!job) { job = SPR.tiles.chunkJob(S.tiles, cx, cy, CHUNK, season); this.jobs.set(key, job); }
      let r;
      while (!(r = job.next()).done) if (!this.syncBuild && performance.now() - t0 > this.budget) break;
      this.budget -= performance.now() - t0;
      if (r.done) {
        this.jobs.delete(key);
        const cv = this._finish(S, cx, cy, r.value, season);
        this.chunks.set(key, cv); this.stale.delete(key); this.quick.delete(key);
        return cv;
      }
    }
    const old = this.stale.get(key);
    if (old) return old;
    let q = this.quick.get(key);
    if (!q) { q = SPR.tiles.quickChunk(S.tiles, cx, cy, CHUNK, season); this.quick.set(key, q); }
    return q;
  }

  // A freshly painted chunk, with the short grass tufts (which never move) painted straight onto it
  _finish(S, cx, cy, pix, season) {
    const cv = pix.canvas();
    const tufts = SPR.tufts(season), cg = cv.getContext('2d');
    for (let ly = 0; ly < CHUNK; ly++) for (let lx = 0; lx < CHUNK; lx++) {
      const tx = cx * CHUNK + lx, ty = cy * CHUNK + ly;
      if (tx >= MAP_W || ty >= MAP_H) continue;
      const i = ty * MAP_W + tx;
      if (S.grass[i] === 1 && !S.occ[i]) cg.drawImage(tufts.mid[(tx * 3 + ty) % 3], lx * TS, ly * TS + 6);
    }
    return cv;
  }
  // Repaint one tile of a finished chunk (terrain, then its tuft)
  _patch(S, i) {
    const x = i % MAP_W, y = Math.floor(i / MAP_W);
    const c = this.chunks.get(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
    if (!c) return;
    const g = c.getContext('2d');
    g.drawImage(SPR.tiles.renderTile(S.tiles, x, y, this.season).canvas(), (x % CHUNK) * TS, (y % CHUNK) * TS);
    if (S.grass[i] === 1 && !S.occ[i]) g.drawImage(SPR.tufts(this.season).mid[(x * 3 + y) % 3], (x % CHUNK) * TS, (y % CHUNK) * TS + 6);
  }

  _processDirty(S) {
    if (S.allDirty || S.time.season !== this.season) {
      this.invalidateAll();
      this.season = S.time.season;
      S.allDirty = false;
      S.dirtyTiles.clear();
      S.grassDirty.clear();
      return;
    }
    if (S.grassDirty.size) {
      for (const i of S.grassDirty) {
        if (!S.dirtyTiles.has(i)) this._patch(S, i);
        const st = this.strips.get(Math.floor((i % MAP_W) / CHUNK) + ',' + Math.floor(i / MAP_W));
        if (st) st.mask = -1;
      }
      S.grassDirty.clear();
    }
    if (!S.dirtyTiles.size) return;
    this.tileVer++;
    // Patch only the tiles that look different: the changed tiles, their neighbours (fringes)
    // and any water whose depth shading moved. Unfinished chunk jobs simply restart.
    const oldDepth = SPR.tiles.depth;
    const depth = SPR.tiles.depth = computeWaterDepth(S.tiles);
    const redo = new Set();
    const around = (i) => {
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < MAP_W && ny < MAP_H) redo.add(ny * MAP_W + nx);
      }
    };
    for (const i of S.dirtyTiles) around(i);
    if (oldDepth) for (let i = 0; i < depth.length; i++) if (depth[i] !== oldDepth[i]) around(i);
    S.dirtyTiles.clear();
    for (const i of redo) {
      const x = i % MAP_W, y = Math.floor(i / MAP_W);
      this.jobs.delete(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
      this._patch(S, i);
    }
  }

  // ---------------------------------------------------------------- per-frame helpers
  // Hash values per tile never change (the map size is fixed), so they're computed once.
  _tileHash() {
    if (this.th) return this.th;
    const n = MAP_W * MAP_H;
    const w0 = new Uint32Array(n), w1 = new Uint32Array(n), gl = new Uint32Array(n), gr = new Uint32Array(n);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      w0[i] = hash32(x, y, 11); w1[i] = hash32(x, y, 12); gl[i] = hash32(x, y, 29); gr[i] = hash32(x, y, 61);
    }
    return (this.th = { w0, w1, gl, gr });
  }

  // The draw list is a pool of plain records reused every frame, so drawing makes no garbage.
  _e(y, img, x, yy) {
    let e = this.pool[this.np];
    if (!e) e = this.pool[this.np] = { y: 0, img: null, x: 0, yy: 0, sh: 0, sx: 0, sy: 0, fade: 0, fx: 0, fh: 0, fw: 0, clip: 0, fn: null, fence: null, fr: 0, fd: 0 };
    this.np++;
    e.y = y; e.img = img; e.x = x; e.yy = yy;
    e.sh = 0; e.fade = 0; e.clip = 0; e.fn = null; e.fence = null;
    this.list.push(e);
    return e;
  }

  // A soft oval shadow, pre-drawn once per radius
  _shadowImg(r) {
    let c = this.shadows[r];
    if (!c) {
      c = document.createElement('canvas');
      c.width = r * 2; c.height = 4;
      const sg = c.getContext('2d');
      sg.fillStyle = 'rgba(20,30,20,0.22)';
      sg.fillRect(0, 1, r * 2, 2);
      sg.fillRect(1, 0, r * 2 - 2, 4);
      this.shadows[r] = c;
    }
    return c;
  }
  _shadow(g, x, y, r) { g.drawImage(this._shadowImg(r), Math.round(x) - r, Math.round(y) - 2); }

  // Moving water highlights and sun glints live on their own layer, redrawn about 20 times a
  // second (they drift slowly) and simply moved along with the camera in between.
  _water(g, S, view, cx0, cy0, now, season) {
    const M = 32, W = view.w + 2 * M, H = view.h + 2 * M;
    let L = this.wl;
    if (!L || L.cv.width !== W || L.cv.height !== H) {
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      L = this.wl = { cv, g: cv.getContext('2d'), ox: 0, oy: 0, t: -1e9, any: false, key: '' };
    }
    const sunny = S.weather === 'sun' || S.weather === 'cloud';
    const key = season + (sunny ? 's' : 'n') + this.tileVer;
    const outside = cx0 < L.ox || cy0 < L.oy || cx0 + view.w > L.ox + W || cy0 + view.h > L.oy + H;
    if (outside || now - L.t >= 48 || now < L.t || key !== L.key) {
      L.t = now; L.key = key; L.ox = cx0 - M; L.oy = cy0 - M; L.any = false;
      const lg = L.g, h = this._tileHash();
      lg.clearRect(0, 0, W, H);
      const tx0 = Math.max(0, Math.floor(L.ox / TS)), tx1 = Math.min(MAP_W - 1, Math.floor((L.ox + W) / TS));
      const ty0 = Math.max(0, Math.floor(L.oy / TS)), ty1 = Math.min(MAP_H - 1, Math.floor((L.oy + H) / TS));
      const hi = season === WINTER ? '#ffffff' : '#d6f4ff', hiA = season === WINTER ? 0.6 : 0.55;
      for (let pass = 0; pass < 2; pass++) {
        lg.fillStyle = pass ? '#285078' : hi;
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
          const i = ty * MAP_W + tx, t = S.tiles[i];
          if (t !== T.WATER && t !== T.SHALLOW) continue;
          L.any = true;
          for (let k = 0; k < 2; k++) {
            const hh = k ? h.w1[i] : h.w0[i];
            if (hh % 5 === 0) continue;
            const period = 2400 + (hh % 1900);
            const ph = ((now + (hh >>> 4) % period) % period) / period;
            const a = Math.sin(ph * Math.PI);
            if (a < 0.15) continue;
            const len = 2 + ((hh >>> 16) % 3) + (t === T.WATER ? 1 : 0);
            if (pass && len <= 3) continue;
            const x = tx * TS + ((hh >>> 8) % 11) + Math.round(Math.sin(ph * 6.283) * 2) - L.ox;
            const y = ty * TS + 2 + ((hh >>> 12) % 12) - L.oy;
            lg.globalAlpha = pass ? a * 0.25 : a * hiA;
            if (pass) lg.fillRect(x + 1, y + 1, len - 2, 1); else lg.fillRect(x, y, len, 1);
          }
        }
      }
      lg.globalAlpha = 1;
      if (sunny && L.any) {
        lg.fillStyle = '#ffffff';
        for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
          const i = ty * MAP_W + tx, t = S.tiles[i];
          if (t !== T.WATER && t !== T.SHALLOW) continue;
          const hs = h.gl[i];
          const ph = ((now / 180) + (hs % 97)) % 24;
          if (ph >= 2) continue;
          const sx = tx * TS + 2 + (hs >>> 8) % 12 - L.ox, sy = ty * TS + 2 + (hs >>> 16) % 12 - L.oy;
          lg.fillRect(sx, sy, 1, 1);
          if (ph < 1) { lg.fillRect(sx - 1, sy, 3, 1); lg.fillRect(sx, sy - 1, 1, 3); }
        }
      }
    }
    if (L.any) g.drawImage(L.cv, L.ox - cx0, L.oy - cy0);
  }

  // Long grass is drawn in strips: one image per tile row of a chunk, depth-sorted as a whole and
  // redrawn only when a gust (or the player) changes which tufts in it are bent.
  _grassStrip(S, cx, ty, season, now, meTx, meTy) {
    const key = cx + ',' + ty;
    const h = this._tileHash().gr;
    let mask = 0, any = false;
    const x0 = cx * CHUNK, x1 = Math.min(MAP_W, x0 + CHUNK);
    for (let tx = x0; tx < x1; tx++) {
      const i = ty * MAP_W + tx;
      if (S.grass[i] !== 2 || S.occ[i]) continue;
      any = true;
      if ((tx === meTx && ty === meTy) || this._gust(tx, ty, h[i], now)) mask |= 1 << (tx - x0);
    }
    if (!any) return null;
    let st = this.strips.get(key);
    if (st && st.mask === mask) return st;
    if (!st) {
      const cv = document.createElement('canvas');
      cv.width = CHUNK * TS + 24; cv.height = 26;
      st = { cv, g: cv.getContext('2d'), mask: -1 };
      if (this.strips.size > 400) this.strips.clear();
      this.strips.set(key, st);
    }
    st.mask = mask;
    const sg = st.g, tufts = SPR.tufts(season);
    sg.clearRect(0, 0, st.cv.width, st.cv.height);
    for (let tx = x0; tx < x1; tx++) {
      const i = ty * MAP_W + tx;
      if (S.grass[i] !== 2 || S.occ[i]) continue;
      const hh = h[i];
      const jx = ((hh >>> 4) % 7) - 3, jy = ((hh >>> 7) % 5) - 2;
      sg.drawImage(tufts.long[((hh >>> 10) % 3) * 2 + ((mask >> (tx - x0)) & 1)], (tx - x0) * TS - 1 + jx + 4, jy + 2);
    }
    return st;
  }

  // Long grass sways only when a slow gust of wind rolls across the meadow (and where you walk).
  _gust(tx, ty, hh, now) {
    const ph = (now / 7000 - tx * 0.035 - ty * 0.013 - ((hh >>> 12) & 7) * 0.004) % 1;
    return (ph < 0 ? ph + 1 : ph) < 0.08;
  }

  // ---------------------------------------------------------------- main draw
  draw(g, view, cam, now) {
    const game = this.game, S = game.state;
    const season = S.time.season;
    this._processDirty(S);
    this._chimneys.length = 0;
    this.np = 0;
    const list = this.list;
    list.length = 0;
    const cx0 = Math.floor(cam.x), cy0 = Math.floor(cam.y);
    this.budget = 5;
    this.syncBuild = !this.chunks.size && !this.stale.size;
    g.fillStyle = '#2a4a2a';
    g.fillRect(0, 0, view.w, view.h);
    // terrain
    const ch0x = Math.floor(cx0 / (CHUNK * TS)), ch1x = Math.floor((cx0 + view.w) / (CHUNK * TS));
    const ch0y = Math.floor(cy0 / (CHUNK * TS)), ch1y = Math.floor((cy0 + view.h) / (CHUNK * TS));
    for (let cy = ch0y; cy <= ch1y; cy++) for (let cx = ch0x; cx <= ch1x; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= MAP_W || cy * CHUNK >= MAP_H) continue;
      g.drawImage(this._chunk(S, cx, cy, season), cx * CHUNK * TS - cx0, cy * CHUNK * TS - cy0);
    }
    if (this.syncBuild) SPR.tiles.quickSet(season); // ready for later stand-ins (the loading frame is slow anyway)
    // moving water
    this._water(g, S, view, cx0, cy0, now, season);
    const tx0 = Math.max(0, Math.floor(cx0 / TS) - 1), tx1 = Math.min(MAP_W - 1, Math.floor((cx0 + view.w) / TS) + 1);
    const ty0 = Math.max(0, Math.floor(cy0 / TS) - 1), ty1 = Math.min(MAP_H - 1, Math.floor((cy0 + view.h) / TS) + 6);
    // ground layer (puddles, forage) and everything that gets depth-sorted
    const me = game.me;
    const meTx = me && me.m ? Math.floor(me.x / TS) : -9, meTy = me && me.m ? Math.floor(me.y / TS) : -9;
    const tyG = Math.min(MAP_H - 1, Math.floor((cy0 + view.h) / TS) + 1);
    for (let ty = ty0; ty <= tyG; ty++) for (let cx = Math.max(0, ch0x); cx <= ch1x && cx * CHUNK < MAP_W; cx++) {
      const st = this._grassStrip(S, cx, ty, season, now, meTx, meTy);
      if (st) this._e(ty * TS + 15, st.cv, cx * CHUNK * TS - 4, ty * TS - 6);
    }
    const stamp = ++this.stamp;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = ty * MAP_W + tx;
      const arr = S.byTile.get(i);
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const o = S.objs.get(arr[k]);
        if (!o || o._st === stamp) continue;
        o._st = stamp;
        this._collect(o, season, g, cx0, cy0, now);
      }
    }
    // objects whose sprites reach into view from above/left (big buildings & trees)
    for (let ty = ty1 + 1; ty <= Math.min(MAP_H - 1, ty1 + 4); ty++) for (let tx = Math.max(0, tx0 - 6); tx <= tx1; tx++) {
      const arr = S.byTile.get(tIdx(tx, ty));
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) { const o = S.objs.get(arr[k]); if (o && o._st !== stamp) { o._st = stamp; this._collect(o, season, g, cx0, cy0, now); } }
    }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = Math.max(0, tx0 - 6); tx < tx0; tx++) {
      const arr = S.byTile.get(tIdx(tx, ty));
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) { const o = S.objs.get(arr[k]); if (o && o._st !== stamp && (o.type === 'building' || o.type === 'log' || o.type === 'landmark')) { o._st = stamp; this._collect(o, season, g, cx0, cy0, now); } }
    }
    // people
    for (const p of S.players.values()) {
      if (p.sleep) continue;
      const frame = p.a === 'act' || p.a === 'obs' ? 3 : p.m ? (Math.floor(p.walkT / 140) % 4 === 1 ? 1 : Math.floor(p.walkT / 140) % 4 === 3 ? 2 : 0) : 0;
      const spr = SPR.player(p.look, p.d === 1 ? 1 : p.d, frame, p.a === 'obs');
      const e = this._e(p.y, spr.img, Math.round(p.x) - spr.ax, Math.round(p.y) - spr.ay);
      e.sh = 6; e.sx = p.x; e.sy = p.y;
    }
    const clock = S.clock();
    for (const k in NPCS) {
      const n = npcPos(k, clock);
      if (n.away) continue;
      const nx = n.x * TS, ny = n.y * TS;
      if (nx < cx0 - 40 || nx > cx0 + view.w + 40 || ny < cy0 - 20 || ny > cy0 + view.h + 50) continue;
      const step = Math.floor((now + k.length * 97) / 150) % 4;
      const frame = n.moving ? (step === 1 ? 1 : step === 3 ? 2 : 0) : 0;
      const spr = SPR.person(k, NPC_LOOKS[k], n.moving ? n.dir : game.npcFace(k, n), frame);
      const e = this._e(ny, spr.img, Math.round(nx) - spr.ax, Math.round(ny) - spr.ay);
      e.sh = NPCS[k].kid ? 5 : 6; e.sx = nx; e.sy = ny;
    }
    for (const a of S.animals.values()) {
      const left = a.d === 1 || (a.d !== 2 && a.lastLeft);
      if (a.d === 1) a.lastLeft = true; else if (a.d === 2) a.lastLeft = false;
      if (a.x < cx0 - 40 || a.x > cx0 + view.w + 40 || a.y < cy0 - 20 || a.y > cy0 + view.h + 40) continue;
      const fr = a.kind === 'chicken' ? (a.m ? Math.floor(now / 160) % 2 : (Math.floor((now + a.t) / 900) % 3 === 0 ? 2 : 0)) : (a.m ? Math.floor(now / 220) % 2 : 0);
      const spr = SPR.animal(a.kind, fr, left, a.brown);
      const e = this._e(a.y, spr.img, Math.round(a.x) - spr.ax, Math.round(a.y) - spr.ay);
      e.sh = a.kind === 'horse' ? 12 : a.kind === 'sheep' ? 8 : 4; e.sx = a.x; e.sy = a.y;
    }
    // birds
    const flying = this.flying;
    flying.length = 0;
    for (const a of game.birds.agents) {
      if (a.hidden) continue;
      if (a.x < cx0 - 40 || a.x > cx0 + view.w + 40 || a.y < cy0 - 20 || a.y > cy0 + view.h + 80) continue;
      const v = game.birds.sprite(a);
      const s = v.s;
      if (v.fly) { flying.push(a, v.img, s); continue; }
      if (a.state === 'sit') continue; // drawn with the nest
      const swim = a.state === 'swim';
      const e = this._e(a.sortY + (a.z > 0 ? 0.5 : 0), v.img, Math.round(a.x) - (a.face < 0 ? s.w - 1 - s.ax : s.ax), Math.round(a.y - a.z) - s.ay + (swim ? 3 : 0));
      if (a.z <= 1 && !swim) { e.sh = 3; e.sx = a.x; e.sy = a.y; }
      if (swim) e.clip = 3;
    }
    // shadows first
    for (let k = 0; k < list.length; k++) { const d = list[k]; if (d.sh) this._shadow(g, d.sx - cx0, d.sy - cy0, d.sh); }
    for (let k = 0; k < flying.length; k += 3) this._shadow(g, flying[k].x - cx0, flying[k].y - cy0, 3);
    list.sort(byY);
    for (let k = 0; k < list.length; k++) {
      const d = list[k];
      if (d.fn) { d.fn(g, cx0, cy0); continue; }
      if (d.fence) {
        const fp = d.fence, x = d.x - cx0, y = d.yy - cy0;
        if (d.fd) g.drawImage(fp.railV, x, y + 8);
        if (d.fr) g.drawImage(fp.railH, x + 8, y);
        g.drawImage(fp.post, x, y);
        continue;
      }
      const img = d.img;
      const faded = d.fade && me && me.y < d.y - 4 && me.y > d.y - d.fh && Math.abs(me.x - d.fx) < d.fw;
      if (faded) g.globalAlpha = 0.5;
      if (d.clip) g.drawImage(img, 0, 0, img.width, img.height - d.clip, d.x - cx0, d.yy - cy0, img.width, img.height - d.clip);
      else g.drawImage(img, d.x - cx0, d.yy - cy0);
      if (faded) g.globalAlpha = 1;
    }
    for (let k = 0; k < flying.length; k += 3) {
      const a = flying[k], img = flying[k + 1], s = flying[k + 2];
      g.drawImage(img, Math.round(a.x - s.fw / 2 - cx0), Math.round(a.y - a.z - s.fh / 2 - cy0));
    }
    // effects
    this._ambientFx(S, now, cx0, cy0, view);
    game.fx.draw(g, cx0, cy0);
    // quest markers ("!" over where to go next)
    for (const [mx, my, mk] of game.questMarkers()) {
      const bob = Math.round(Math.sin(now / 220) * 2);
      const x = Math.round(mx - cx0), y = Math.round(my - cy0) + bob;
      if (x < -10 || x > view.w + 10 || y < -10 || y > view.h + 20) continue;
      const ready = mk === '?';
      g.fillStyle = '#3a2614'; g.fillRect(x - 4, y - 12, 9, 12);
      g.fillStyle = ready ? '#7ad06a' : '#f6c83a'; g.fillRect(x - 3, y - 11, 7, 10);
      g.fillStyle = '#3a2614';
      if (ready) { g.fillRect(x - 2, y - 10, 4, 1); g.fillRect(x + 1, y - 9, 1, 2); g.fillRect(x, y - 7, 1, 2); g.fillRect(x, y - 4, 1, 2); }
      else { g.fillRect(x, y - 10, 1, 5); g.fillRect(x, y - 4, 1, 2); }
      g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y + 1, 1, 1);
    }
    // target highlight
    if (game.target && game.target.box) this._bracket(g, game.target.box, cx0, cy0, now);
    if (game.placeGhost) this._ghost(g, game.placeGhost, cx0, cy0, now);
    // weather & light
    this._weather(g, S, view, now);
    this._lighting(g, S, view, cx0, cy0, now);
    // names
    for (const p of S.players.values()) {
      if (p.sleep || (p.pid === S.me && S.players.size < 2)) continue;
      const w = SPR.font.measure(p.name);
      SPR.font.drawOutline(g, p.name, Math.round(p.x - w / 2 - cx0), Math.round(p.y - 36 - cy0), p.pid === S.me ? '#fff4b0' : '#ffffff', '#1d1a2b');
    }
  }

  _collect(o, season, g, cx0, cy0, now) {
    const S = this.game.state;
    const bx = o.x * TS + 8, by = o.y * TS + 15;
    switch (o.type) {
      case 'tree': {
        const spr = SPR.tree(o.kind, o.st, season, o.kind === 'apple' && o.fr > 0);
        const shake = this.game.shakeT.get(o.id) || 0;
        const off = shake > 0 ? Math.round(Math.sin(now / 30) * 1.5) : 0;
        const e = this._e(by, spr.img, bx - spr.ax + off, by - spr.ay);
        e.sh = o.st >= 2 ? 9 : 4; e.sx = bx; e.sy = by - 1;
        if (o.st >= 2) { e.fade = 1; e.fx = bx; e.fh = spr.h - 14; e.fw = spr.w / 2; }
        break;
      }
      case 'shrub': {
        const spr = SPR.shrub(o.kind, o.st, season, o.fr > 0);
        const shake = this.game.shakeT.get(o.id) || 0;
        const off = shake > 0 ? Math.round(Math.sin(now / 30)) : 0;
        const e = this._e(by, spr.img, bx - spr.ax + off, by - spr.ay + 1);
        e.sh = o.st >= 2 ? 9 : 5; e.sx = bx; e.sy = by - 1;
        break;
      }
      case 'plant': {
        const spr = SPR.plant(o.kind, o.st, season, o.id);
        const wet = isWaterT(S.tiles[tIdx(o.x, o.y)]);
        const e = this._e(by, spr.img, bx - spr.ax, by - spr.ay - 1 + (wet ? 2 : 0));
        if (wet) e.clip = 2;
        break;
      }
      case 'rock': {
        const spr = SPR.rock(o.kind, o.kind === 'boulder' ? o.li : o.moss, season);
        this._e(by, spr.img, bx - spr.ax, by - spr.ay);
        break;
      }
      case 'log': { const spr = SPR.log(o.moss, season); this._e(o.y * TS + 13, spr.img, o.x * TS - 1, o.y * TS); break; }
      case 'stump': { const spr = SPR.stump(o.moss, season); this._e(by, spr.img, bx - spr.ax, by - spr.ay); break; }
      case 'struct': {
        const spr = SPR.struct(o.kind, season);
        const e = this._e(by, spr.img, bx - spr.ax, by - spr.ay + 1);
        e.sh = o.kind === 'platform' ? 10 : 5; e.sx = bx; e.sy = by - 1;
        break;
      }
      case 'building': {
        const lit = this.game.nightLevel > 0.3;
        let spr;
        if (o.kind === 'mailbox') spr = SPR.mailbox(this.game.state.mail.some((m) => !m.read));
        else spr = SPR.building(o.kind, season, lit);
        const b = BUILDINGS[o.kind];
        this._e((o.y + b.h) * TS - 1, spr.img, o.x * TS - spr.ax, o.y * TS - spr.ay);
        if (spr.chimneys) for (const [cx, cy] of spr.chimneys) this._chimneys.push([o.x * TS - spr.ax + cx, o.y * TS - spr.ay + cy]);
        break;
      }
      case 'fence': {
        const R = objAt(S, o.x + 1, o.y), D = objAt(S, o.x, o.y + 1);
        const e = this._e(by - 4, null, o.x * TS, o.y * TS - 4);
        e.fence = SPR.fence(season);
        e.fr = R && R.type === 'fence' ? 1 : 0;
        e.fd = D && D.type === 'fence' ? 1 : 0;
        break;
      }
      case 'forage': {
        const spr = SPR.forage(o.kind, season);
        const bob = o.kind === 'note' ? Math.round(Math.sin(now / 300 + o.id) * 1.5) - 2 : 0;
        g.drawImage(spr.img, bx - spr.ax - cx0, by - spr.ay - 2 + bob - cy0);
        if (o.kind === 'note' && (now / 250 + o.id) % 6 < 1) { g.fillStyle = '#fff4b0'; g.fillRect(bx + 4 - cx0, by - 14 + bob - cy0, 1, 3); g.fillRect(bx + 3 - cx0, by - 13 + bob - cy0, 3, 1); }
        break;
      }
      case 'qitem': {
        const spr = SPR.qitem(o.kind);
        const bob = Math.round(Math.sin(now / 300 + o.id) * 1);
        g.drawImage(spr.img, bx - spr.ax - cx0, by - spr.ay - 1 + bob - cy0);
        if ((now / 230 + o.id) % 5 < 1) { g.fillStyle = '#fff4b0'; g.fillRect(bx + 3 - cx0, by - 13 + bob - cy0, 1, 3); g.fillRect(bx + 2 - cx0, by - 12 + bob - cy0, 3, 1); }
        break;
      }
      case 'landmark': {
        const spr = SPR.landmark(o.kind, season);
        const fh = footprint(o)[1];
        this._e((o.y + fh) * TS - 2, spr.img, o.x * TS - spr.ax, o.y * TS - spr.ay);
        break;
      }
      case 'web': {
        const spr = SPR.web();
        this._e(by + 0.6, spr.img, bx - spr.ax, by - spr.ay - 4);
        break;
      }
      case 'puddle': { const spr = SPR.puddle(); g.drawImage(spr.img, bx - spr.ax - cx0, by - spr.ay - 2 - cy0); break; }
      case 'nest': this._collectNest(o, now); break;
    }
  }

  _collectNest(n, now) {
    const S = this.game.state;
    const sp = SPECIES_BY_ID[n.kind];
    const anc = nestAnchor(S, n);
    if (anc.box) {
      // occupied boxes: a head peeks out now and then
      if (n.st === 'eggs' || n.st === 'chicks' || n.st === 'pair') {
        if ((now / 1000 + n.id) % 9 < 1.4) {
          const bs = SPR.bird(n.kind);
          this._e(anc.sortY + 0.7, null, 0, 0).fn = (g, ox, oy) => {
            const img = bs.perch;
            const hx = anc.x - bs.ax - ox, hy = anc.y - anc.z - oy - 10;
            g.drawImage(img, 6, 0, bs.w - 6, 11, hx + 6, hy, bs.w - 6, 11);
          };
        }
      }
      return;
    }
    const hostO = n.host ? S.objs.get(n.host) : null;
    const type = anc.hole ? (hostO && hostO.kind === 'bank' ? 'tunnel' : 'hole') : sp.nest;
    if (type === 'box') return;
    const spr = SPR.nest(type);
    const sitter = this.game.birds.agents.find((a) => a.nest === n.id && a.state === 'sit' && !a.hidden);
    const beg = (this.game.begT.get(n.id) || 0) > 0;
    this._e(anc.sortY + 0.6, null, 0, 0).fn = (g, ox, oy) => {
      const x = Math.round(anc.x) - ox, y = Math.round(anc.y - anc.z) - oy;
      if (n.st === 'old') g.globalAlpha = 0.75;
      if (sitter) {
        const bs = SPR.bird(sitter.sp);
        const img = sitter.face < 0 ? bs.perch_L : bs.perch;
        g.drawImage(img, x - (sitter.face < 0 ? bs.w - 1 - bs.ax : bs.ax), y - bs.ay + 3);
      }
      if (n.st === 'chicks' && !anc.hole && !sp.precocial && type !== 'hole' && type !== 'tunnel') {
        const ck = SPR.chick(sp.big ? 'big' : sp.body === 'owl' ? 'owl' : 'small');
        const k = Math.min(3, n.ch || 1);
        for (let i = 0; i < k; i++) {
          const bob = beg ? Math.round(Math.abs(Math.sin(now / 90 + i * 1.7)) * 2) : Math.round(Math.sin(now / 600 + i) * 0.6);
          g.drawImage(ck.img, x - Math.floor(k * ck.w / 2) + i * (ck.w - 2) + 1, y - spr.h - ck.h + 5 - bob);
        }
      }
      g.drawImage(spr.img, x - spr.ax, y - spr.ay);
      g.globalAlpha = 1;
      // tuck the nest into the foliage: redraw the host's leaves over its lower half
      if (hostO && (hostO.type === 'shrub' || hostO.type === 'tree') && !anc.hole) {
        const hs = hostO.type === 'shrub' ? SPR.shrub(hostO.kind, hostO.st, S.time.season, hostO.fr > 0) : SPR.tree(hostO.kind, hostO.st, S.time.season, hostO.kind === 'apple' && hostO.fr > 0);
        const hx = hostO.x * TS + 8 - hs.ax - ox, hy = hostO.y * TS + 15 - hs.ay + (hostO.type === 'shrub' ? 1 : 0) - oy;
        const top = y - Math.floor(spr.h * 0.35), bottom = y + 1;
        const left = x - spr.ax - 2, right = x - spr.ax + spr.w + 2;
        const sx0 = clamp(left - hx, 0, hs.w), sx1 = clamp(right - hx, 0, hs.w);
        const sy0 = clamp(top - hy, 0, hs.h), sy1 = clamp(bottom - hy, 0, hs.h);
        if (sx1 > sx0 && sy1 > sy0) g.drawImage(hs.img, sx0, sy0, sx1 - sx0, sy1 - sy0, hx + sx0, hy + sy0, sx1 - sx0, sy1 - sy0);
      }
    };
  }

  _bracket(g, b, cx0, cy0, now) {
    const o = (Math.floor(now / 250) % 2);
    const x0 = Math.round(b[0] - cx0) - o, y0 = Math.round(b[1] - cy0) - o, x1 = Math.round(b[2] - cx0) + o, y1 = Math.round(b[3] - cy0) + o;
    g.fillStyle = '#fff4b0';
    for (const [x, y, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      g.fillRect(sx > 0 ? x : x - 3, y, 4, 1);
      g.fillRect(x, sy > 0 ? y : y - 3, 1, 4);
    }
  }

  _ghost(g, gh, cx0, cy0, now) {
    const x = gh.x * TS - cx0, y = gh.y * TS - cy0;
    g.globalAlpha = 0.45 + Math.sin(now / 200) * 0.15;
    g.fillStyle = gh.ok ? '#8aff8a' : '#ff6a6a';
    g.fillRect(x, y, TS, TS);
    g.globalAlpha = 1;
    g.fillStyle = gh.ok ? '#f4fff0' : '#ffe0e0';
    g.fillRect(x, y, TS, 1); g.fillRect(x, y + TS - 1, TS, 1); g.fillRect(x, y, 1, TS); g.fillRect(x + TS - 1, y, 1, TS);
  }

  _ambientFx(S, now, cx0, cy0, view) {
    const game = this.game;
    // chimney smoke
    this.smokeT -= game.dt;
    if (this._chimneys.length && this.smokeT <= 0) {
      this.smokeT = 450 / this._chimneys.length;
      const c = this._chimneys[this.smokeI++ % this._chimneys.length];
      game.fx.burst('smoke', c[0], c[1], 1);
    }
    // falling leaves in autumn
    if (S.time.season === AUTUMN) {
      this.leafT -= game.dt;
      if (this.leafT <= 0) {
        this.leafT = 260;
        const x = cx0 + Math.random() * view.w, y = cy0 + Math.random() * view.h * 0.6;
        const o = objAt(S, Math.floor(x / TS), Math.floor((y + 30) / TS));
        if (o && o.type === 'tree' && o.st >= 2 && o.kind !== 'pine') game.fx.burst('leaf', x, y, 1, AUTUMN);
      }
    }
    // a rare visitor twinkles now and then, so it's worth a closer look
    this.rareT = (this.rareT || 0) - game.dt;
    if (this.rareT <= 0) {
      this.rareT = 700;
      for (const a of game.birds.agents) {
        if (a.role !== 'rare' || (S.rareLog && S.rareLog[a.sp])) continue;
        if (a.x < cx0 - 20 || a.x > cx0 + view.w + 20 || a.y < cy0 - 20 || a.y > cy0 + view.h + 40) continue;
        game.fx.burst('sparkle', a.x + (Math.random() - 0.5) * 10, a.y - a.z - 8, 2);
      }
    }
  }

  _weather(g, S, view, now) {
    const w = S.weather;
    const dt = this.game.dt / 1000;
    if (w === 'rain' || w === 'snow') {
      const n = w === 'rain' ? 110 : 80;
      while (this.rain.length < n) this.rain.push({ x: Math.random() * view.w, y: Math.random() * view.h, s: 0.6 + Math.random() * 0.6 });
      g.fillStyle = w === 'rain' ? 'rgba(180,210,240,0.55)' : 'rgba(255,255,255,0.9)';
      for (const r of this.rain) {
        if (w === 'rain') { r.x -= 60 * dt * r.s; r.y += 260 * dt * r.s; g.fillRect(Math.round(r.x), Math.round(r.y), 1, 4); }
        else { r.x += Math.sin(now / 900 + r.s * 9) * 12 * dt; r.y += 22 * dt * r.s; g.fillRect(Math.round(r.x), Math.round(r.y), r.s > 0.9 ? 2 : 1, r.s > 0.9 ? 2 : 1); }
        if (r.y > view.h) { r.y = -4; r.x = Math.random() * (view.w + 60); }
        if (r.x < -4) r.x = view.w + 2;
        if (r.x > view.w + 4) r.x = -2;
      }
      if (w === 'rain' && Math.random() < 0.6) {
        g.fillStyle = 'rgba(210,230,250,0.6)';
        const x = Math.random() * view.w, y = Math.random() * view.h;
        g.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
      }
    } else this.rain.length = 0;
  }

  // Lit windows and lamp posts in world space (x, y, radius), rebuilt only when objects change
  _lightSources(S) {
    const key = S.objVer + ':' + S.time.season;
    if (this.lsKey === key && this.ls) return this.ls;
    const out = [];
    for (const o of S.objs.values()) {
      if (o.type === 'building' && o.kind !== 'mailbox') {
        const spr = SPR.building(o.kind, S.time.season, true);
        if (spr.lights) for (const [lx, ly, r] of spr.lights) out.push(o.x * TS - spr.ax + lx, o.y * TS - spr.ay + ly, r * 1.2);
      } else if (o.type === 'struct' && o.kind === 'lamppost') out.push(o.x * TS + 8, o.y * TS - 18, 38);
    }
    this.lsKey = key;
    return (this.ls = out);
  }

  // Time-of-day grading. Nights are moonlit and stay easy to read: a soft blue-lavender tint
  // (never darker than about 70%), a little less colour, and warm light around windows and lanterns.
  _lighting(g, S, view, cx0, cy0, now) {
    const game = this.game;
    const m = S.clock();
    const stops = [
      [300, [150, 162, 214]], [360, [212, 196, 222]], [410, [255, 238, 222]], [460, [255, 255, 255]],
      [1050, [255, 255, 255]], [1110, [255, 230, 200]], [1170, [248, 190, 172]], [1230, [198, 178, 222]],
      [1290, [158, 168, 218]], [1600, [150, 162, 214]],
    ];
    let col = stops[stops.length - 1][1];
    if (m < stops[0][0]) col = stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [m0, c0] = stops[i], [m1, c1] = stops[i + 1];
      if (m >= m0 && m < m1) { const k = (m - m0) / (m1 - m0); col = [0, 1, 2].map((j) => Math.round(lerp(c0[j], c1[j], k))); break; }
    }
    if (S.weather === 'rain' || S.weather === 'cloud' || S.weather === 'snow') {
      const k = S.weather === 'cloud' ? 0.92 : 0.86;
      col = [col[0] * k, col[1] * k, col[2] * (k + 0.06)].map((v) => Math.round(Math.min(255, v)));
    }
    // how far into the night it is: lit windows, glows and creatures of the night follow this
    const nightF = m >= 1290 || m < 300 ? 1 : m < 360 ? 1 - (m - 300) / 60 : m < 1170 ? 0 : (m - 1170) / 120;
    game.nightLevel = nightF;
    const dim = 1 - (col[0] + col[1] + col[2]) / 765;
    if (dim < 0.02 && nightF <= 0) return;
    const W = view.w, H = view.h;
    // moonlight carries little colour
    if (nightF > 0) {
      g.globalCompositeOperation = 'saturation';
      g.globalAlpha = 0.3 * nightF;
      g.fillStyle = '#808080';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    // the light map is soft, so it's painted at half resolution and smoothly scaled up
    const lc = this.lightCv, LW = Math.ceil(W / 2), LH = Math.ceil(H / 2);
    if (lc.width !== LW || lc.height !== LH) { lc.width = LW; lc.height = LH; }
    const lg = this.lightG;
    lg.setTransform(0.5, 0, 0, 0.5, 0, 0);
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = 'rgb(' + col.join(',') + ')';
    lg.fillRect(0, 0, W, H);
    // light sources: windows, lanterns, lamp posts and people (x, y, radius triples in screen space)
    const lights = this.lights;
    lights.length = 0;
    const add = (x, y, r) => { if (x > -r && y > -r && x < W + r && y < H + r) lights.push(x, y, r); };
    if (nightF > 0.15) {
      const fixed = this._lightSources(S);
      for (let k = 0; k < fixed.length; k += 3) add(fixed[k] - cx0, fixed[k + 1] - cy0, fixed[k + 2]);
      for (const k in NPCS) {
        if (NPC_LOOKS[k].prop !== 'lantern') continue;
        const n = npcPos(k, m);
        if (!n.away) add(n.x * TS - cx0, n.y * TS - 12 - cy0, 30);
      }
      for (const p of S.players.values()) if (!p.sleep) add(p.x - cx0, p.y - 12 - cy0, 32);
    }
    if (lights.length) {
      lg.globalCompositeOperation = 'lighter';
      lg.globalAlpha = 0.75 * nightF;
      for (let k = 0; k < lights.length; k += 3) { const r = lights[k + 2]; lg.drawImage(this.glow, lights[k] - r, lights[k + 1] - r, r * 2, r * 2); }
      lg.globalAlpha = 1;
    }
    // fireflies on summer nights
    const flies = S.time.season === SUMMER && S.weather !== 'rain' && nightF > 0.4;
    if (flies) {
      if (!this.fireflies.length) for (let i = 0; i < 40; i++) {
        const z = pick([ZONES.pond, ZONES.meadow, ZONES.garden, ZONES.eastmeadow]);
        this.fireflies.push({ x: (z[0] + Math.random() * (z[2] - z[0])) * TS, y: (z[1] + Math.random() * (z[3] - z[1])) * TS, p: Math.random() * 10 });
      }
      lg.globalCompositeOperation = 'lighter';
      for (const f of this.fireflies) {
        const x = f.x + Math.sin(now / 1300 + f.p) * 14 - cx0, y = f.y + Math.cos(now / 1700 + f.p * 2) * 10 - cy0;
        const on = Math.sin(now / 400 + f.p * 3) > 0.2;
        if (!on || x < 0 || y < 0 || x > W || y > H) continue;
        lg.drawImage(this.glow, x - 6, y - 6, 12, 12);
        f.sx = x; f.sy = y; f.on = true;
      }
    }
    // Multiply the scene by the light map. Most of the screen is a single flat colour, which is cheap
    // to apply; the light map image itself is only used inside the screen cells that hold a light.
    g.globalCompositeOperation = 'multiply';
    const CS = 32, ncx = Math.ceil(W / CS), ncy = Math.ceil(H / CS);
    let lit = this.litCells;
    if (!lit || lit.length < ncx * ncy) lit = this.litCells = new Uint8Array(ncx * ncy);
    lit.fill(0, 0, ncx * ncy);
    let anyLit = false;
    const mark = (x0, y0, x1, y1) => {
      const a0 = Math.max(0, Math.floor(x0 / CS)), a1 = Math.min(ncx - 1, Math.floor(x1 / CS));
      const b0 = Math.max(0, Math.floor(y0 / CS)), b1 = Math.min(ncy - 1, Math.floor(y1 / CS));
      for (let cy = b0; cy <= b1; cy++) for (let cx = a0; cx <= a1; cx++) lit[cy * ncx + cx] = 1;
      if (a0 <= a1 && b0 <= b1) anyLit = true;
    };
    for (let k = 0; k < lights.length; k += 3) { const r = lights[k + 2] + 2; mark(lights[k] - r, lights[k + 1] - r, lights[k] + r, lights[k + 1] + r); }
    if (flies) for (const f of this.fireflies) if (f.on) mark(f.sx - 8, f.sy - 8, f.sx + 8, f.sy + 8);
    g.fillStyle = 'rgb(' + col.join(',') + ')';
    if (anyLit) g.save(), g.beginPath();
    for (let cy = 0; cy < ncy; cy++) {
      for (let cx = 0; cx < ncx;) {
        const on = lit[cy * ncx + cx];
        let ex = cx + 1;
        while (ex < ncx && lit[cy * ncx + ex] === on) ex++;
        const x = cx * CS, y = cy * CS, w = Math.min(W, ex * CS) - x, h = Math.min(H, (cy + 1) * CS) - y;
        if (on) g.rect(x, y, w, h); else g.fillRect(x, y, w, h);
        cx = ex;
      }
    }
    if (anyLit) {
      g.clip();
      g.imageSmoothingEnabled = true;
      g.drawImage(lc, 0, 0, LW * 2, LH * 2);
      g.imageSmoothingEnabled = false;
      g.restore();
      g.globalCompositeOperation = 'multiply';
    }
    // a warm spill of light on top
    if (lights.length) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (S.time.season === WINTER ? 0.07 : 0.12) * nightF;
      for (let k = 0; k < lights.length; k += 3) { const r = lights[k + 2]; g.drawImage(this.glow, lights[k] - r, lights[k + 1] - r, r * 2, r * 2); }
      g.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'source-over';
    if (flies) {
      g.fillStyle = '#f6ff9a';
      for (const f of this.fireflies) if (f.on) { g.fillRect(Math.round(f.sx), Math.round(f.sy), 1, 1); f.on = false; }
    }
  }
}
