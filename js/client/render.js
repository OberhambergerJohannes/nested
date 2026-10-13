'use strict';
// World renderer: terrain chunks, y-sorted sprites, birds, effects, weather and lighting.

const CHUNK = 16;

class Renderer {
  constructor(game) {
    this.game = game;
    this.chunks = new Map();
    this.jobs = new Map();
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

  invalidateAll() { this.chunks.clear(); this.jobs.clear(); SPR.tiles.depth = null; }

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
      if (!best) return;
      const key = best[0] + ',' + best[1];
      let job = this.jobs.get(key);
      if (!job) { job = SPR.tiles.chunkJob(S.tiles, best[0], best[1], CHUNK, season); this.jobs.set(key, job); }
      while (performance.now() - t0 < (budget || 5)) {
        const r = job.next();
        if (r.done) { this.chunks.set(key, r.value.canvas()); this.jobs.delete(key); break; }
      }
    }
  }

  _chunk(S, cx, cy, season) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (!c) {
      let job = this.jobs.get(key);
      if (!job) job = SPR.tiles.chunkJob(S.tiles, cx, cy, CHUNK, season);
      let r;
      while (!(r = job.next()).done) { /* finish now */ }
      this.jobs.delete(key);
      c = r.value.canvas();
      this.chunks.set(key, c);
    }
    return c;
  }

  _processDirty(S) {
    if (S.allDirty || S.time.season !== this.season) {
      this.chunks.clear();
      this.jobs.clear();
      SPR.tiles.depth = null;
      this.season = S.time.season;
      S.allDirty = false;
      S.dirtyTiles.clear();
      return;
    }
    if (!S.dirtyTiles.size) return;
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
      const key = Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
      this.jobs.delete(key);
      const c = this.chunks.get(key);
      if (!c) continue;
      const px = SPR.tiles.renderTile(S.tiles, x, y, this.season);
      c.getContext('2d').drawImage(px.canvas(), (x % CHUNK) * TS, (y % CHUNK) * TS);
    }
  }

  // ---------------------------------------------------------------- main draw
  draw(g, view, cam, now) {
    const game = this.game, S = game.state;
    const season = S.time.season;
    this._processDirty(S);
    this._chimneys = [];
    const cx0 = Math.floor(cam.x), cy0 = Math.floor(cam.y);
    g.fillStyle = '#2a4a2a';
    g.fillRect(0, 0, view.w, view.h);
    // terrain
    const ch0x = Math.floor(cx0 / (CHUNK * TS)), ch1x = Math.floor((cx0 + view.w) / (CHUNK * TS));
    const ch0y = Math.floor(cy0 / (CHUNK * TS)), ch1y = Math.floor((cy0 + view.h) / (CHUNK * TS));
    for (let cy = ch0y; cy <= ch1y; cy++) for (let cx = ch0x; cx <= ch1x; cx++) {
      if (cx < 0 || cy < 0 || cx * CHUNK >= MAP_W || cy * CHUNK >= MAP_H) continue;
      g.drawImage(this._chunk(S, cx, cy, season), cx * CHUNK * TS - cx0, cy * CHUNK * TS - cy0);
    }
    const tx0 = Math.max(0, Math.floor(cx0 / TS) - 1), tx1 = Math.min(MAP_W - 1, Math.floor((cx0 + view.w) / TS) + 1);
    const ty0 = Math.max(0, Math.floor(cy0 / TS) - 1), ty1 = Math.min(MAP_H - 1, Math.floor((cy0 + view.h) / TS) + 6);
    // moving water: drifting wave highlights and sun glints
    const sunny = S.weather === 'sun' && S.clock() < 19 * 60;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const t = S.tiles[tIdx(tx, ty)];
      if (t !== T.WATER && t !== T.SHALLOW) continue;
      for (let k = 0; k < 2; k++) {
        const hh = hash32(tx, ty, 11 + k);
        if (hh % 5 === 0) continue;
        const period = 2400 + (hh % 1900);
        const ph = ((now + (hh >>> 4) % period) % period) / period;
        const a = Math.sin(ph * Math.PI);
        if (a < 0.15) continue;
        const len = 2 + ((hh >>> 16) % 3) + (t === T.WATER ? 1 : 0);
        const x = tx * TS + ((hh >>> 8) % 11) + Math.round(Math.sin(ph * 6.283) * 2) - cx0;
        const y = ty * TS + 2 + ((hh >>> 12) % 12) - cy0;
        g.fillStyle = season === WINTER ? 'rgba(255,255,255,' + (a * 0.6).toFixed(2) + ')' : 'rgba(214,244,255,' + (a * 0.55).toFixed(2) + ')';
        g.fillRect(x, y, len, 1);
        if (len > 3) { g.fillStyle = 'rgba(40,80,120,' + (a * 0.25).toFixed(2) + ')'; g.fillRect(x + 1, y + 1, len - 2, 1); }
      }
      if (sunny) {
        const hs = hash32(tx, ty, 29);
        const ph = ((now / 180) + (hs % 97)) % 24;
        if (ph < 2) {
          const sx = tx * TS + 2 + (hs >>> 8) % 12 - cx0, sy = ty * TS + 2 + (hs >>> 16) % 12 - cy0;
          g.fillStyle = '#ffffff';
          g.fillRect(sx, sy, 1, 1);
          if (ph < 1) { g.fillRect(sx - 1, sy, 3, 1); g.fillRect(sx, sy - 1, 1, 3); }
        }
      }
    }
    // ground layer: puddles, medium grass, forage, dug spots
    const tufts = SPR.tufts(season);
    const stamp = ++this.stamp;
    const sorted = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const i = tIdx(tx, ty);
      const gh = S.grass[i];
      if (gh === 1 && !S.occ[i]) g.drawImage(tufts.mid[(tx * 3 + ty) % 3], tx * TS - cx0, ty * TS + 6 - cy0);
      else if (gh === 2 && !S.occ[i]) {
        const hh = hash32(tx, ty, 61);
        const fr = ((Math.floor((now + (hh & 1023)) / 900) + tx + ty) % 2) * 3 + (hh >>> 10) % 3;
        const jx = ((hh >>> 4) % 7) - 3, jy = ((hh >>> 7) % 5) - 2;
        sorted.push({ y: ty * TS + 15 + jy, img: tufts.long[fr % 6], x: tx * TS - 1 + jx, yy: ty * TS - 4 + jy });
      }
      const arr = S.byTile.get(i);
      if (!arr) continue;
      for (const id of arr) {
        const o = S.objs.get(id);
        if (!o || o._st === stamp) continue;
        o._st = stamp;
        this._collect(o, sorted, season, g, cx0, cy0, now);
      }
    }
    // objects whose sprites reach into view from above/left (big buildings & trees)
    for (let ty = ty1 + 1; ty <= Math.min(MAP_H - 1, ty1 + 4); ty++) for (let tx = Math.max(0, tx0 - 6); tx <= tx1; tx++) {
      const arr = S.byTile.get(tIdx(tx, ty));
      if (!arr) continue;
      for (const id of arr) { const o = S.objs.get(id); if (o && o._st !== stamp) { o._st = stamp; this._collect(o, sorted, season, g, cx0, cy0, now); } }
    }
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = Math.max(0, tx0 - 6); tx < tx0; tx++) {
      const arr = S.byTile.get(tIdx(tx, ty));
      if (!arr) continue;
      for (const id of arr) { const o = S.objs.get(id); if (o && o._st !== stamp && (o.type === 'building' || o.type === 'log' || o.type === 'landmark')) { o._st = stamp; this._collect(o, sorted, season, g, cx0, cy0, now); } }
    }
    // people
    for (const p of S.players.values()) {
      if (p.sleep) continue;
      const frame = p.a === 'act' || p.a === 'obs' ? 3 : p.m ? (Math.floor(p.walkT / 140) % 4 === 1 ? 1 : Math.floor(p.walkT / 140) % 4 === 3 ? 2 : 0) : 0;
      const spr = SPR.player(p.look, p.d === 1 ? 1 : p.d, frame, p.a === 'obs');
      sorted.push({ y: p.y, spr, x: Math.round(p.x) - spr.ax, yy: Math.round(p.y) - spr.ay, shadow: [p.x, p.y, 6] });
    }
    const clock = S.clock();
    for (const k in NPCS) {
      const n = npcPos(k, clock);
      if (n.away) continue;
      const nx = n.x * TS, ny = n.y * TS;
      const step = Math.floor((now + k.length * 97) / 150) % 4;
      const frame = n.moving ? (step === 1 ? 1 : step === 3 ? 2 : 0) : 0;
      const spr = SPR.person(k, NPC_LOOKS[k], n.moving ? n.dir : game.npcFace(k, n), frame);
      sorted.push({ y: ny, spr, x: Math.round(nx) - spr.ax, yy: Math.round(ny) - spr.ay, shadow: [nx, ny, NPCS[k].kid ? 5 : 6] });
    }
    for (const a of S.animals.values()) {
      const left = a.d === 1 || (a.d !== 2 && a.lastLeft);
      if (a.d === 1) a.lastLeft = true; else if (a.d === 2) a.lastLeft = false;
      const fr = a.kind === 'chicken' ? (a.m ? Math.floor(now / 160) % 2 : (Math.floor((now + a.t) / 900) % 3 === 0 ? 2 : 0)) : (a.m ? Math.floor(now / 220) % 2 : 0);
      const spr = SPR.animal(a.kind, fr, left, a.brown);
      sorted.push({ y: a.y, spr, x: Math.round(a.x) - spr.ax, yy: Math.round(a.y) - spr.ay, shadow: [a.x, a.y, a.kind === 'horse' ? 12 : a.kind === 'sheep' ? 8 : 4] });
    }
    // birds
    const flying = [];
    for (const a of game.birds.agents) {
      if (a.hidden) continue;
      const v = game.birds.sprite(a);
      const s = v.s;
      if (v.fly) {
        if (a.x < cx0 - 40 || a.x > cx0 + view.w + 40 || a.y < cy0 - 60 || a.y > cy0 + view.h + 60) continue;
        flying.push({ a, img: v.img, s });
        continue;
      }
      if (a.state === 'sit') continue; // drawn with the nest
      const ax = s.ax, ay = s.ay;
      const swim = a.state === 'swim';
      sorted.push({ y: a.sortY + (a.z > 0 ? 0.5 : 0), img: v.img, x: Math.round(a.x) - (a.face < 0 ? s.w - 1 - ax : ax), yy: Math.round(a.y - a.z) - ay + (swim ? 3 : 0), shadow: a.z <= 1 && !swim ? [a.x, a.y, 3] : null, clipBottom: swim ? 3 : 0, bird: a });
    }
    // shadows first
    g.fillStyle = 'rgba(20,30,20,0.22)';
    for (const d of sorted) if (d.shadow) this._shadow(g, d.shadow[0] - cx0, d.shadow[1] - cy0, d.shadow[2]);
    for (const f of flying) this._shadow(g, f.a.x - cx0, f.a.y - cy0, 3);
    sorted.sort((a, b) => a.y - b.y);
    const me = game.me;
    for (const d of sorted) {
      if (d.fn) { d.fn(g, cx0, cy0); continue; }
      const img = d.spr ? d.spr.img : d.img;
      let alpha = 1;
      if (d.fade && me && me.y < d.y - 4 && me.y > d.y - d.fade[1] && Math.abs(me.x - d.fade[0]) < d.fade[2]) alpha = 0.5;
      if (alpha < 1) g.globalAlpha = alpha;
      if (d.clipBottom) g.drawImage(img, 0, 0, img.width, img.height - d.clipBottom, d.x - cx0, d.yy - cy0, img.width, img.height - d.clipBottom);
      else g.drawImage(img, d.x - cx0, d.yy - cy0);
      if (alpha < 1) g.globalAlpha = 1;
    }
    for (const f of flying) {
      const s = f.s, a = f.a;
      g.drawImage(f.img, Math.round(a.x - s.fw / 2 - cx0), Math.round(a.y - a.z - s.fh / 2 - cy0));
    }
    // effects
    this._ambientFx(S, now, cx0, cy0, view);
    game.fx.draw(g, cx0, cy0);
    // quest markers ("!" over where to go next)
    for (const [mx, my, mk] of game.questMarkers()) {
      const bob = Math.round(Math.sin(now / 220) * 2);
      const x = Math.round(mx - cx0), y = Math.round(my - cy0) + bob;
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
    this._lighting(g, S, view, cx0, cy0, now, tx0, tx1, ty0, ty1);
    // names
    for (const p of S.players.values()) {
      if (p.sleep || (p.pid === S.me && S.players.size < 2)) continue;
      const w = SPR.font.measure(p.name);
      SPR.font.drawOutline(g, p.name, Math.round(p.x - w / 2 - cx0), Math.round(p.y - 36 - cy0), p.pid === S.me ? '#fff4b0' : '#ffffff', '#1d1a2b');
    }
  }

  _shadow(g, x, y, r) {
    x = Math.round(x); y = Math.round(y);
    g.fillRect(x - r, y - 1, r * 2, 2);
    g.fillRect(x - r + 1, y - 2, r * 2 - 2, 4);
  }

  _collect(o, sorted, season, g, cx0, cy0, now) {
    const S = this.game.state;
    const bx = o.x * TS + 8, by = o.y * TS + 15;
    switch (o.type) {
      case 'tree': {
        const spr = SPR.tree(o.kind, o.st, season, o.kind === 'apple' && o.fr > 0);
        const shake = this.game.shakeT.get(o.id) || 0;
        const off = shake > 0 ? Math.round(Math.sin(now / 30) * 1.5) : 0;
        sorted.push({ y: by, spr, x: bx - spr.ax + off, yy: by - spr.ay, shadow: o.st >= 2 ? [bx, by - 1, 9] : [bx, by - 1, 4], fade: o.st >= 2 ? [bx, spr.h - 14, spr.w / 2] : null });
        break;
      }
      case 'shrub': {
        const fr = o.fr > 0;
        const spr = SPR.shrub(o.kind, o.st, season, fr);
        const shake = this.game.shakeT.get(o.id) || 0;
        const off = shake > 0 ? Math.round(Math.sin(now / 30)) : 0;
        sorted.push({ y: by, spr, x: bx - spr.ax + off, yy: by - spr.ay + 1, shadow: [bx, by - 1, o.st >= 2 ? 9 : 5] });
        break;
      }
      case 'plant': {
        const spr = SPR.plant(o.kind, o.st, season, o.id);
        const wet = isWaterT(S.tiles[tIdx(o.x, o.y)]);
        sorted.push({ y: by, spr, x: bx - spr.ax, yy: by - spr.ay - 1 + (wet ? 2 : 0), clipBottom: wet ? 2 : 0 });
        break;
      }
      case 'rock': {
        const spr = SPR.rock(o.kind, o.kind === 'boulder' ? o.li : o.moss, season);
        sorted.push({ y: by, spr, x: bx - spr.ax, yy: by - spr.ay });
        break;
      }
      case 'log': { const spr = SPR.log(o.moss, season); sorted.push({ y: o.y * TS + 13, spr, x: o.x * TS - 1, yy: o.y * TS }); break; }
      case 'stump': { const spr = SPR.stump(o.moss, season); sorted.push({ y: by, spr, x: bx - spr.ax, yy: by - spr.ay }); break; }
      case 'struct': {
        const spr = SPR.struct(o.kind, season);
        sorted.push({ y: by, spr, x: bx - spr.ax, yy: by - spr.ay + 1, shadow: [bx, by - 1, o.kind === 'platform' ? 10 : 5] });
        break;
      }
      case 'building': {
        const lit = this.game.nightLevel > 0.35;
        let spr;
        if (o.kind === 'mailbox') spr = SPR.mailbox(this.game.state.mail.some((m) => !m.read));
        else spr = SPR.building(o.kind, season, lit);
        const b = BUILDINGS[o.kind];
        sorted.push({ y: (o.y + b.h) * TS - 1, spr, x: o.x * TS - spr.ax, yy: o.y * TS - spr.ay });
        if (spr.chimneys) for (const [cx, cy] of spr.chimneys) this._chimneys.push([o.x * TS - spr.ax + cx, o.y * TS - spr.ay + cy]);
        break;
      }
      case 'fence': {
        const fp = SPR.fence(season);
        const R = objAt(S, o.x + 1, o.y), D = objAt(S, o.x, o.y + 1);
        const x = o.x * TS, y = o.y * TS - 4;
        sorted.push({ y: by - 4, fn: (gg, ox, oy) => {
          if (D && D.type === 'fence') gg.drawImage(fp.railV, x - ox, y + 8 - oy);
          if (R && R.type === 'fence') gg.drawImage(fp.railH, x + 8 - ox, y - oy);
          gg.drawImage(fp.post, x - ox, y - oy);
        } });
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
        const [fw, fh] = footprint(o);
        sorted.push({ y: (o.y + fh) * TS - 2, spr, x: o.x * TS - spr.ax, yy: o.y * TS - spr.ay });
        break;
      }
      case 'web': {
        const spr = SPR.web();
        sorted.push({ y: by + 0.6, spr, x: bx - spr.ax, yy: by - spr.ay - 4 });
        break;
      }
      case 'puddle': { const spr = SPR.puddle(); g.drawImage(spr.img, bx - spr.ax - cx0, by - spr.ay - 2 - cy0); break; }
      case 'nest': this._collectNest(o, sorted, now); break;
    }
  }

  _collectNest(n, sorted, now) {
    const S = this.game.state;
    const sp = SPECIES_BY_ID[n.kind];
    const anc = nestAnchor(S, n);
    if (anc.box) {
      // occupied boxes: a head peeks out now and then
      if (n.st === 'eggs' || n.st === 'chicks' || n.st === 'pair') {
        if ((now / 1000 + n.id) % 9 < 1.4) {
          const bs = SPR.bird(n.kind);
          sorted.push({ y: anc.sortY + 0.7, fn: (g, ox, oy) => {
            const img = bs.perch;
            const hx = anc.x - bs.ax - ox, hy = anc.y - anc.z - oy - 10;
            g.drawImage(img, 6, 0, bs.w - 6, 11, hx + 6, hy, bs.w - 6, 11);
          } });
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
    sorted.push({ y: anc.sortY + 0.6, fn: (g, ox, oy) => {
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
    } });
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

  _lighting(g, S, view, cx0, cy0, now, tx0, tx1, ty0, ty1) {
    const game = this.game;
    let m = S.clock();
    // ambient colour by time of day
    const stops = [
      [300, [70, 80, 140]], [360, [190, 175, 205]], [410, [255, 238, 222]], [460, [255, 255, 255]],
      [1050, [255, 255, 255]], [1110, [255, 228, 196]], [1170, [220, 160, 170]], [1230, [120, 115, 180]],
      [1290, [72, 82, 140]], [1600, [64, 74, 130]],
    ];
    let col = stops[stops.length - 1][1];
    if (m < stops[0][0]) col = stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [m0, c0] = stops[i], [m1, c1] = stops[i + 1];
      if (m >= m0 && m < m1) { const k = (m - m0) / (m1 - m0); col = [0, 1, 2].map((j) => Math.round(lerp(c0[j], c1[j], k))); break; }
    }
    if (S.weather === 'rain' || S.weather === 'cloud' || S.weather === 'snow') {
      const k = S.weather === 'cloud' ? 0.9 : 0.82;
      col = [col[0] * k, col[1] * k, col[2] * (k + 0.06)].map((v) => Math.round(Math.min(255, v)));
    }
    const dark = 1 - (col[0] + col[1] + col[2]) / 765;
    game.nightLevel = dark;
    if (dark < 0.02) return;
    const lc = this.lightCv;
    if (lc.width !== view.w || lc.height !== view.h) { lc.width = view.w; lc.height = view.h; }
    const lg = this.lightG;
    lg.globalCompositeOperation = 'source-over';
    lg.fillStyle = 'rgb(' + col.join(',') + ')';
    lg.fillRect(0, 0, view.w, view.h);
    if (dark > 0.25) {
      lg.globalCompositeOperation = 'lighter';
      const a = clamp((dark - 0.25) * 1.6, 0, 1);
      lg.globalAlpha = a;
      // building windows
      for (const o of S.objs.values()) {
        if (o.type !== 'building' || o.kind === 'mailbox') continue;
        const spr = SPR.building(o.kind, S.time.season, true);
        if (!spr.lights) continue;
        for (const [lx, ly, r] of spr.lights) {
          const x = o.x * TS - spr.ax + lx - cx0, y = o.y * TS - spr.ay + ly - cy0;
          if (x < -60 || y < -60 || x > view.w + 60 || y > view.h + 60) continue;
          lg.drawImage(this.glow, x - r, y - r, r * 2, r * 2);
        }
      }
      // lanterns carried by players and villagers
      for (const k in NPCS) {
        if (NPC_LOOKS[k].prop !== 'lantern') continue;
        const n = npcPos(k, S.clock());
        if (!n.away) lg.drawImage(this.glow, n.x * TS - 30 - cx0, n.y * TS - 36 - cy0, 60, 60);
      }
      for (const p of S.players.values()) {
        if (p.sleep) continue;
        lg.drawImage(this.glow, p.x - 34 - cx0, p.y - 46 - cy0, 68, 68);
      }
      // fireflies on summer nights
      if (S.time.season === SUMMER && S.weather !== 'rain') {
        if (!this.fireflies.length) for (let i = 0; i < 40; i++) {
          const z = pick([ZONES.pond, ZONES.meadow, ZONES.garden, ZONES.eastmeadow]);
          this.fireflies.push({ x: (z[0] + Math.random() * (z[2] - z[0])) * TS, y: (z[1] + Math.random() * (z[3] - z[1])) * TS, p: Math.random() * 10 });
        }
        for (const f of this.fireflies) {
          const x = f.x + Math.sin(now / 1300 + f.p) * 14 - cx0, y = f.y + Math.cos(now / 1700 + f.p * 2) * 10 - cy0;
          const on = Math.sin(now / 400 + f.p * 3) > 0.2;
          if (!on || x < 0 || y < 0 || x > view.w || y > view.h) continue;
          lg.drawImage(this.glow, x - 6, y - 6, 12, 12);
          f.sx = x; f.sy = y; f.on = true;
        }
      }
      lg.globalAlpha = 1;
    }
    g.globalCompositeOperation = 'multiply';
    g.drawImage(lc, 0, 0);
    g.globalCompositeOperation = 'source-over';
    // firefly dots on top
    if (dark > 0.3 && S.time.season === SUMMER) {
      g.fillStyle = '#f6ff9a';
      for (const f of this.fireflies) if (f.on) { g.fillRect(Math.round(f.sx), Math.round(f.sy), 1, 1); f.on = false; }
    }
  }
}
