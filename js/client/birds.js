'use strict';
// Living birds: visitors (clue birds), residents and nesting parents. Purely cosmetic and
// simulated on each client; only "observe" is sent to the host.

const BIRD_PREFS = {
  blackbird: { ground: 6, shrub: 3, tree: 2, bath: 3 },
  robin: { ground: 5, shrub: 3, post: 2, feeder: 2, bath: 2 },
  greattit: { tree: 7, shrub: 3, feeder: 8, bath: 1 },
  bluetit: { tree: 7, shrub: 3, feeder: 6, bath: 1 },
  songthrush: { ground: 6, tree: 3, bath: 2 },
  woodpigeon: { tree: 6, ground: 4, bath: 1 },
  wren: { shrub: 5, ground: 4, post: 1 },
  swallow: { air: 7, post: 2, roof: 1 },
  martin: { air: 7, roof: 3 },
  mallard: { water: 8, ground: 2 },
  goldfinch: { thistle: 5, tree: 4, shrub: 1, feeder: 4 },
  longtailed: { shrub: 5, tree: 5 },
  woodpecker: { trunk: 9, tree: 1 },
  reedwarbler: { reed: 9, shrub: 1 },
  crossbill: { pine: 10 },
  kingfisher: { waterperch: 10 },
  barnowl: { air: 6, post: 4 },
  penduline: { willow: 6, reed: 4 },
  cuckoo: { tree: 6, post: 4 },
  stork: { ground: 7, roof: 3 },
  nuthatch: { trunk: 7, tree: 3, feeder: 3 },
  skylark: { ground: 6, air: 4 },
  plover: { shore: 10, ground: 1 },
  swift: { air: 10 },
  tawny: { tree: 8, post: 2 },
  heron: { shore: 8, tree: 2 },
  shrike: { shrub: 6, post: 4 },
  beeeater: { air: 5, tree: 3, post: 2 },
  flycatcher: { tree: 9, post: 1 },
  nightingale: { shrub: 9, ground: 1 },
  dipper: { shore: 10 },
  sandmartin: { air: 8, shore: 2 },
  jackdaw: { roof: 5, ground: 4, tree: 1 },
  nightjar: { ground: 6, tree: 4 },
  longeared: { pine: 8, tree: 2 },
  corncrake: { ground: 10 },
  eagleowl: { ground: 7, tree: 3 },
  goldcrest: { pine: 10 },
  treecreeper: { trunk: 10 },
  bullfinch: { shrub: 7, tree: 3, feeder: 3 },
  yellowhammer: { shrub: 5, post: 3, ground: 2, feeder: 2 },
  kestrel: { air: 7, post: 3 },
  lapwing: { ground: 7, shore: 3 },
  waterrail: { reed: 8, shore: 2 },
  scopsowl: { tree: 9, post: 1 },
  hoopoe: { ground: 7, tree: 3 },
  oriole: { tree: 10 },
  waxwing: { shrub: 6, tree: 4 },
  osprey: { air: 6, waterperch: 2, tree: 2 },
  bluethroat: { reed: 5, shore: 3, shrub: 2 },
  hawfinch: { tree: 9, ground: 1, feeder: 2 },
  chaffinch: { tree: 6, ground: 3, feeder: 4, shrub: 1 },
  blackcap: { shrub: 7, tree: 3 },
  wagtail: { ground: 6, roof: 2, shore: 2, post: 1 },
  greenwoodpecker: { ground: 6, trunk: 4 },
  jay: { tree: 7, ground: 3 },
  redstart: { tree: 6, post: 3, ground: 1 },
  grebe: { water: 10 },
  tern: { air: 6, shore: 3, waterperch: 1 },
  stonecurlew: { shore: 6, ground: 4 },
  marshharrier: { air: 8, reed: 2 },
  redkite: { air: 8, tree: 2 },
  crane: { ground: 7, shore: 3 },
  wallcreeper: { ground: 6, post: 1 },
  crow: { ground: 7, tree: 2, post: 1 },
  gull: { air: 5, water: 3, shore: 2 },
  woodcock: { air: 6, ground: 4 },
  littleowl: { roof: 5, post: 5 },
  sparrow: { ground: 6, roof: 2, shrub: 2, post: 1, feeder: 14, bath: 3 },
  starling: { ground: 8, tree: 1, post: 1, feeder: 3, bath: 3 },
  magpie: { ground: 5, tree: 4, roof: 1 },
};

// Height of a nest above ground and x offset, per tree kind
const NEST_OFF_TREE = { oak: [5, 24], birch: [3, 27], willow: [-6, 13], apple: [4, 18], pine: [3, 22], snag: [0, 26] };

// World position of a nest: x, ground y, height z
function nestAnchor(S, n) {
  const h = n.host ? S.objs.get(n.host) : null;
  if (!h) return { x: n.x * TS + 8, y: n.y * TS + 12, z: 0, sortY: n.y * TS + 12, ground: true };
  const bx = h.x * TS + 8, by = h.y * TS + 15;
  switch (h.type) {
    case 'tree': {
      const off = NEST_OFF_TREE[h.kind] || [4, 22];
      return { x: bx + off[0], y: by, z: off[1], sortY: by + 1, hole: h.kind === 'snag' };
    }
    case 'shrub': return { x: bx + 1, y: by, z: 7, sortY: by + 1 };
    case 'plant': return { x: bx, y: by, z: 9, sortY: by + 1 };
    case 'struct':
      if (h.kind === 'platform') return { x: bx, y: by, z: 46, sortY: by + 1 };
      if (h.kind === 'bank') return { x: bx + ((n.slot || 0) - 1) * 5, y: by, z: 6 + ((n.slot || 0) % 2) * 3, sortY: by + 1, hole: true };
      if (h.kind === 'brushpile') return { x: bx + 1, y: by, z: 6, sortY: by + 1 };
      return { x: bx, y: by, z: h.kind === 'owlbox' ? 30 : 22, sortY: by + 1, box: true };
    case 'building': {
      const b = BUILDINGS[h.kind], spr = SPR.building(h.kind, 0, false);
      const gy = (h.y + b.h) * TS;
      if (SPECIES_BY_ID[n.kind] && SPECIES_BY_ID[n.kind].site === 'chimney' && spr.chimneys && spr.chimneys.length) {
        const [cx, cy] = spr.chimneys[0];
        return { x: h.x * TS - spr.ax + cx, y: gy, z: gy - (h.y * TS - spr.ay + cy) - 3, sortY: gy + 1, eave: true };
      }
      const sl = (spr.eaves || [])[n.slot || 0] || [16, 20];
      return { x: h.x * TS + sl[0], y: gy, z: sl[1], sortY: gy + 1, eave: true };
    }
  }
  return { x: bx, y: by, z: 10, sortY: by + 1 };
}

const ACTIVE_NEST = { pair: 1, eggs: 1, chicks: 1, fledged: 1, lining: 1, cock: 1 };

class BirdAgent {
  constructor(sp, role) {
    this.sp = sp; this.role = role;
    this.x = 0; this.y = 0; this.z = 0; this.sortY = 0;
    this.state = 'idle';
    this.face = Math.random() < 0.5 ? 1 : -1;
    this.timer = 2000 + Math.random() * 4000;
    this.anim = 0; this.frame = 'perch';
    this.songT = 3000 + Math.random() * 12000;
    this.hidden = false;
    this.flight = null;
    this.perch = null;
    this.id = BirdAgent.seq++;
  }
}
BirdAgent.seq = 1;

class Birds {
  constructor(game) {
    this.game = game;
    this.agents = [];
    this.cands = new Map();
    this.candT = 0;
  }

  get S() { return this.game.state; }

  isNight() { const m = this.S.clock(); return m >= 20 * 60 + 30 || m < 5 * 60 + 40; }
  isDusk() { const m = this.S.clock(); return m >= 19 * 60; }

  reset() { this.agents = []; this.cands.clear(); this.rebuildVisitors(); this.syncNests(); }

  // ---------------------------------------------------------------- perch candidates
  zoneRect(zone) {
    if (zone === 'river') return [40, 0, 92, 58];
    return ZONES[zone] || ZONES.garden;
  }

  candidates(zone) {
    let c = this.cands.get(zone);
    if (c) return c;
    const S = this.S;
    const r = this.zoneRect(zone);
    c = { ground: [], shrub: [], tree: [], post: [], roof: [], water: [], thistle: [], trunk: [], reed: [], pine: [], waterperch: [], willow: [], air: [], shore: [], feeder: [], bath: [] };
    const inZ = (x, y) => x >= r[0] - 1 && y >= r[1] - 1 && x <= r[2] + 1 && y <= r[3] + 1;
    const river = zone === 'river';
    for (const o of S.objs.values()) {
      if (!inZ(o.x, o.y)) continue;
      if (river && !nearWater(S, o.x, o.y, 3)) continue;
      const bx = o.x * TS + 8, by = o.y * TS + 15;
      const nearW = nearWater(S, o.x, o.y, 2);
      if (o.type === 'tree' && o.st >= 1) {
        const mature = o.st >= 2;
        const zz = mature ? (o.kind === 'oak' ? 30 : o.kind === 'pine' ? 30 : 24) : 14;
        const p = { kind: 'tree', x: bx, y: by, z: zz, sortY: by + 1, spread: mature ? 10 : 5, zs: mature ? 12 : 4 };
        if (o.kind !== 'snag') c.tree.push(p);
        if (o.kind === 'pine') c.pine.push(p);
        if (o.kind === 'willow') c.willow.push(p);
        c.trunk.push({ kind: 'trunk', x: bx, y: by, z: 8, sortY: by + 1, spread: 0, zs: 8, cling: true });
        if (nearW) c.waterperch.push(p);
      } else if (o.type === 'shrub' && o.st >= 1) {
        const p = { kind: 'shrub', x: bx, y: by, z: o.st >= 2 ? 14 : 8, sortY: by + 1, spread: 5, zs: 3 };
        c.shrub.push(p);
        if (nearW) c.waterperch.push(p);
      } else if (o.type === 'plant' && o.st >= 1) {
        if (o.kind === 'thistle') c.thistle.push({ kind: 'thistle', x: bx, y: by, z: 15, sortY: by + 1, spread: 2, zs: 1 });
        if (o.kind === 'reed' || o.kind === 'cattail') { const p = { kind: 'reed', x: bx, y: by, z: 13, sortY: by + 1, spread: 3, zs: 4 }; c.reed.push(p); c.waterperch.push(p); }
      } else if (o.type === 'struct' && o.kind === 'birdbath') {
        c.bath.push({ kind: 'bath', x: bx, y: by, z: 13, sortY: by + 1, spread: 4, zs: 0 });
      } else if (o.type === 'fence' || (o.type === 'struct' && o.kind !== 'anvil')) {
        const z = o.type === 'fence' ? 11 : o.kind === 'platform' ? 50 : o.kind === 'owlbox' ? 40 : o.kind.startsWith('box') ? 28
          : o.kind === 'feeder' ? 21 : o.kind === 'lamppost' ? 36 : o.kind === 'gardenbench' ? 15 : 10;
        const p = { kind: 'post', x: bx, y: by, z, sortY: by + 1, spread: o.kind === 'feeder' ? 4 : 1, zs: 0 };
        c.post.push(p);
        if (o.kind === 'feeder') c.feeder.push(Object.assign({}, p, { kind: 'feeder' }));
        if (nearW) c.waterperch.push(p);
      } else if (o.type === 'building' && o.kind !== 'bench' && o.kind !== 'mailbox' && o.kind !== 'well') {
        const b = BUILDINGS[o.kind];
        const roofZ = { cottage: 70, barn: 92, shop: 72, station: 70, coop: 40, farmhouse: 74, house1: 70, house2: 78 }[o.kind] || 40;
        for (let i = 1; i < b.w; i++) c.roof.push({ kind: 'roof', x: o.x * TS + i * TS, y: (o.y + b.h) * TS, z: roofZ, sortY: (o.y + b.h) * TS + 1, spread: 2, zs: 0 });
      }
    }
    // ground & water tiles (sampled)
    for (let k = 0; k < 400; k++) {
      const x = r[0] + Math.floor(Math.random() * (r[2] - r[0] + 1)), y = r[1] + Math.floor(Math.random() * (r[3] - r[1] + 1));
      if (!inBounds(x, y)) continue;
      const t = S.tiles[tIdx(x, y)];
      if (river && !nearWater(S, x, y, 2)) continue;
      const shore = (t === T.SHALLOW || ((t === T.SAND || t === T.GRAVEL || t === T.MUD) && nearWater(S, x, y, 1))) && !S.occ[tIdx(x, y)];
      if (shore && c.shore.length < 30) c.shore.push({ kind: 'ground', x: x * TS + 4 + Math.random() * 8, y: y * TS + 6 + Math.random() * 8, z: 0, sortY: y * TS + 10, spread: 3, zs: 0 });
      if (t === T.WATER || t === T.SHALLOW) { if (c.water.length < 30) c.water.push({ kind: 'water', x: x * TS + 8, y: y * TS + 10, z: 0, sortY: y * TS + 10, spread: 4, zs: 0 }); }
      else if (TINFO[t].land && !S.occ[tIdx(x, y)] && c.ground.length < 40) c.ground.push({ kind: 'ground', x: x * TS + 4 + Math.random() * 8, y: y * TS + 6 + Math.random() * 8, z: 0, sortY: y * TS + 10, spread: 3, zs: 0 });
    }
    const cx = (r[0] + r[2]) / 2 * TS, cy = (r[1] + r[3]) / 2 * TS;
    c.air.push({ kind: 'air', x: cx, y: cy, z: 40, sortY: cy, rx: Math.min(90, (r[2] - r[0]) * 5), ry: Math.min(60, (r[3] - r[1]) * 4) });
    this.cands.set(zone, c);
    return c;
  }

  pickPerch(sp, zone, near) {
    const prefs = BIRD_PREFS[sp] || { tree: 1 };
    const c = this.candidates(zone);
    let total = 0;
    for (const k in prefs) if (c[k] && c[k].length) total += prefs[k];
    let kind = null;
    if (total > 0) {
      let r = Math.random() * total;
      for (const k in prefs) { if (!c[k] || !c[k].length) continue; r -= prefs[k]; if (r <= 0) { kind = k; break; } }
    }
    if (!kind) kind = c.tree.length ? 'tree' : c.shrub.length ? 'shrub' : 'ground';
    let list = c[kind];
    if (!list || !list.length) list = c.ground.length ? c.ground : c.tree;
    if (!list.length) return null;
    let base = pick(list);
    if (near) {
      // prefer something close to a point
      let best = null, bd = 1e9;
      for (let i = 0; i < 8; i++) { const q = pick(list); const d = dist2(q.x, q.y, near.x, near.y); if (d < bd) { bd = d; best = q; } }
      base = best || base;
    }
    return this._jitter(base);
  }

  _jitter(b) {
    const p = Object.assign({}, b);
    if (b.kind !== 'air') {
      p.x = b.x + (Math.random() - 0.5) * 2 * (b.spread || 0);
      p.z = b.z + Math.random() * (b.zs || 0);
    }
    return p;
  }

  // ---------------------------------------------------------------- spawning
  rebuildVisitors() {
    this.cands.clear();
    this.agents = this.agents.filter((a) => a.role === 'parent' || a.role === 'family' || a.role === 'duckling');
    const S = this.S;
    const season = S.time.season;
    // common birds: small flocks of sparrows, starlings and magpies
    for (const sp of AMBIENT) {
      for (const zone of sp.zones) {
        const n = Math.max(1, Math.round(sp.flock * (0.6 + Math.random() * 0.6)));
        const base = this.pickPerch(sp.id, zone);
        if (!base) continue;
        for (let i = 0; i < n; i++) {
          const a = new BirdAgent(sp.id, 'ambient');
          a.zone = zone; a.ambient = true;
          const p = Object.assign({}, base);
          if (p.kind === 'ground') { p.x += (Math.random() - 0.5) * 30; p.y += (Math.random() - 0.5) * 20; p.sortY = p.y; }
          else p.x += (Math.random() - 0.5) * 10;
          if (!this._placeAt(a, p)) continue;
          a.flockId = sp.id + zone;
          this.agents.push(a);
        }
      }
    }
    for (const v of S.visitors || []) {
      const sp = SPECIES_BY_ID[v.sp];
      if (!sp || !sp.present.includes(season)) continue;
      const n = v.role === 'res' ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = new BirdAgent(v.sp, v.role === 'lead' ? 'lead' : v.role);
        a.zone = sp.zone;
        if (!this._placeAt(a, this.pickPerch(v.sp, sp.zone))) continue;
        this.agents.push(a);
      }
    }
  }

  _placeAt(a, p) {
    if (!p) return false;
    a.perch = p;
    a.x = p.x; a.y = p.y; a.z = p.z; a.sortY = p.sortY;
    a.state = p.kind === 'air' ? 'circle' : p.kind === 'water' ? 'swim' : 'idle';
    if (a.state === 'circle') { a.ang = Math.random() * Math.PI * 2; a.cx = p.x; a.cy = p.y; a.rx = p.rx; a.ry = p.ry; a.circleT = 8000 + Math.random() * 12000; }
    return true;
  }

  syncNests() {
    const S = this.S;
    const active = new Map();
    for (const o of S.objs.values()) if (o.type === 'nest' && ACTIVE_NEST[o.st]) active.set(o.id, o);
    // drop agents of nests that ended
    this.agents = this.agents.filter((a) => !a.nest || active.has(a.nest));
    for (const n of active.values()) {
      const mine = this.agents.filter((a) => a.nest === n.id);
      const want = this._wantAgents(n);
      const sig = n.st + ':' + (n.ch || 0) + ':' + (n.cu || 0);
      if (mine.length === want.length && mine.every((a) => a.nestSig === sig)) continue;
      // respawn the nest's agents for the new stage
      this.agents = this.agents.filter((a) => a.nest !== n.id);
      const anc = nestAnchor(S, n);
      want.forEach((w, i) => {
        const a = new BirdAgent(w.sp, w.role);
        a.nest = n.id; a.nestSig = sig; a.job = w.job; a.zone = SPECIES_BY_ID[n.kind].zone;
        a.anchor = anc;
        if (w.job === 'sit') { a.state = 'sit'; a.x = anc.x; a.y = anc.y; a.z = anc.z; a.sortY = anc.sortY; a.hidden = !!(anc.box || anc.hole); }
        else if (w.job === 'duckling') {
          const water = this._nearestWater(anc.x, anc.y);
          a.state = 'swim'; a.x = water.x + (i + 1) * 6; a.y = water.y + 2; a.z = 0; a.sortY = a.y; a.follow = true;
        } else {
          const p = this._nearPerch(n, anc, i);
          a.x = p.x; a.y = p.y; a.z = p.z; a.sortY = p.sortY; a.perch = p; a.state = p.kind === 'water' ? 'swim' : 'idle';
          a.timer = 1500 + Math.random() * 5000;
        }
        this.agents.push(a);
      });
    }
    // link ducklings to their mother
    for (const a of this.agents) if (a.job === 'duckling') a.mother = this.agents.find((b) => b.nest === a.nest && b.job === 'mother');
  }

  _wantAgents(n) {
    const sp = n.kind;
    const out = [];
    switch (n.st) {
      case 'cock': out.push({ sp, role: 'parent', job: 'sing' }); break;
      case 'lining': out.push({ sp, role: 'parent', job: 'court' }, { sp, role: 'parent', job: 'court' }); break;
      case 'pair': out.push({ sp, role: 'parent', job: 'court' }, { sp, role: 'parent', job: 'court' }); break;
      case 'eggs': out.push({ sp, role: 'parent', job: 'sit' }, { sp, role: 'parent', job: 'guard' }); break;
      case 'chicks':
        if (sp === 'mallard') {
          out.push({ sp, role: 'parent', job: 'mother' });
          for (let i = 0; i < Math.min(6, n.ch || 4); i++) out.push({ sp, role: 'duckling', job: 'duckling' });
        } else { out.push({ sp, role: 'parent', job: 'feed' }, { sp, role: 'parent', job: 'feed' }); }
        break;
      case 'fledged': {
        const kid = n.cu ? 'cuckoo' : sp;
        out.push({ sp, role: 'family', job: 'family' }, { sp, role: 'family', job: 'family' });
        for (let i = 0; i < Math.min(3, n.cu ? 1 : (n.ch || 3)); i++) out.push({ sp: kid, role: 'family', job: 'family' });
        break;
      }
    }
    return out;
  }

  _nearPerch(n, anc, i) {
    const sp = SPECIES_BY_ID[n.kind];
    const p = this.pickPerch(n.kind, sp.zone, anc);
    if (p && dist2(p.x, p.y, anc.x, anc.y) < 140 * 140) return p;
    // fall back to perching right next to the nest
    return { kind: 'post', x: anc.x + (i ? 8 : -8), y: anc.y, z: anc.z + 2, sortY: anc.sortY, spread: 0, zs: 0 };
  }

  _nearestWater(x, y) {
    const S = this.S;
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (isWaterT(tileAt(S, tx + dx, ty + dy))) return { x: (tx + dx) * TS + 8, y: (ty + dy) * TS + 8 };
    }
    return { x, y };
  }

  // ---------------------------------------------------------------- behaviour
  flyTo(a, p, speed) {
    if (!p) return;
    const d = Math.hypot(p.x - a.x, p.y - a.y) + Math.abs(p.z - a.z) * 0.5;
    a.flight = { x0: a.x, y0: a.y, z0: a.z, p, t: 0, dur: Math.max(400, d / (speed || 70) * 1000), arc: Math.min(30, 8 + d * 0.12) };
    a.state = 'fly';
    a.hidden = false;
    a.face = p.x >= a.x ? 1 : -1;
  }

  update(dt) {
    const S = this.S;
    if (!S || !S.time) return;
    const night = this.isNight();
    const me = this.game.me;
    const m = S.clock();
    const chorus = m < 9 * 60 ? 2.5 : m > 18 * 60 ? 1.4 : 0.6;
    this.candT += dt;
    if (this.candT > 30000) { this.candT = 0; this.cands.clear(); }
    for (const a of this.agents) {
      const sp = SPECIES_BY_ID[a.sp];
      const nocturnal = !!sp.night;
      const asleep = nocturnal ? !this.isDusk() && !night : night;
      a.anim += dt;
      // ---- night: diurnal visitors roost (hidden); owls only come out at dusk
      if (!a.nest) {
        if (asleep && a.state !== 'fly') { a.hidden = true; continue; }
        if (!asleep && a.hidden && a.state !== 'sit') a.hidden = false;
      }
      // ---- flee from people moving close by
      if (a.state === 'idle' || a.state === 'swim') {
        for (const p of S.players.values()) {
          if (p.sleep) continue;
          const r = p.m ? (p.pid === S.me && this.game.perk('quiet') ? 15 : 26) : 12;
          const close = dist2(p.x, p.y, a.x, a.y) < r * r;
          if (close && !a.observed && a.job !== 'sit') {
            const np = a.nest ? this._nearPerch(S.objs.get(a.nest) || { kind: a.sp }, a.anchor, 0) : this.pickPerch(a.sp, a.zone);
            this.flyTo(a, np, 95);
            Audio2.sfx('rustle', a.x, a.y);
            // the rest of the flock follows
            if (a.flockId && np) for (const b of this.agents) {
              if (b === a || b.flockId !== a.flockId || b.state === 'fly' || b.observed) continue;
              if (dist2(b.x, b.y, a.x, a.y) > 60 * 60) continue;
              const q = Object.assign({}, np, { x: np.x + (Math.random() - 0.5) * 24, y: np.y + (np.kind === 'ground' ? (Math.random() - 0.5) * 16 : 0) });
              q.sortY = np.kind === 'ground' ? q.y : np.sortY;
              this.flyTo(b, q, 90 + Math.random() * 20);
            }
            break;
          }
        }
      }
      // ---- songs
      if (!asleep && (a.state === 'idle' || a.state === 'circle' || a.state === 'swim' || a.job === 'sing')) {
        a.songT -= dt * (a.job === 'sing' || a.job === 'court' ? 2 : chorus) * (S.weather === 'rain' ? 0.4 : 1);
        if (a.songT <= 0) {
          a.songT = 9000 + Math.random() * 16000;
          if (me && dist2(me.x, me.y, a.x, a.y) < 280 * 280) {
            Audio2.song(a.sp, a.x, a.y - a.z);
            this.game.fx.burst('note', a.x + a.face * 4, a.y - a.z - 10, 1);
          }
        }
      }
      switch (a.state) {
        case 'fly': {
          const f = a.flight;
          f.t += dt;
          const k = clamp(f.t / f.dur, 0, 1);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          a.x = lerp(f.x0, f.p.x, e); a.y = lerp(f.y0, f.p.y, e);
          a.z = lerp(f.z0, f.p.z, e) + Math.sin(k * Math.PI) * f.arc;
          a.sortY = a.y;
          if (k >= 1) {
            a.perch = f.p; a.flight = null;
            a.sortY = f.p.sortY;
            a.state = f.p.kind === 'water' ? 'swim' : f.p.kind === 'air' ? 'circle' : 'idle';
            if (a.state === 'circle') { a.ang = Math.random() * 6.3; a.cx = f.p.x; a.cy = f.p.y; a.rx = f.p.rx; a.ry = f.p.ry; a.circleT = 8000 + Math.random() * 10000; }
            a.timer = 3000 + Math.random() * 8000;
            if (a.onLand) { const fn = a.onLand; a.onLand = null; fn(); }
          }
          break;
        }
        case 'circle': {
          const spd = a.sp === 'barnowl' ? 0.35 : 0.9;
          a.ang += dt / 1000 * spd;
          a.x = a.cx + Math.cos(a.ang) * a.rx; a.y = a.cy + Math.sin(a.ang) * a.ry;
          a.z = 34 + Math.sin(a.ang * 3) * 8;
          a.face = -Math.sin(a.ang) >= 0 ? 1 : -1;
          a.sortY = a.y;
          a.circleT -= dt;
          if (a.circleT <= 0) {
            const p = this.pickPerch(a.sp, a.zone);
            if (p && p.kind !== 'air') this.flyTo(a, p, 110); else a.circleT = 6000;
          }
          break;
        }
        case 'swim': {
          if (a.follow && a.mother) {
            const idx = this.agents.filter((b) => b.mother === a.mother).indexOf(a);
            const tx = a.mother.x - a.mother.face * (8 + idx * 6), ty = a.mother.y + 1;
            a.x = lerp(a.x, tx, 0.04); a.y = lerp(a.y, ty, 0.04); a.face = a.mother.face; a.sortY = a.y;
            break;
          }
          a.timer -= dt;
          if (!a.swimTo || a.timer < 0) {
            const S2 = this.S;
            const nx = a.x + (Math.random() - 0.5) * 40, ny = a.y + (Math.random() - 0.5) * 30;
            if (isWaterT(tileAt(S2, Math.floor(nx / TS), Math.floor(ny / TS)))) a.swimTo = { x: nx, y: ny };
            a.timer = 2000 + Math.random() * 4000;
          }
          if (a.swimTo) {
            const dx = a.swimTo.x - a.x, dy = a.swimTo.y - a.y, d = Math.hypot(dx, dy);
            if (d > 1) { a.x += dx / d * 0.012 * dt; a.y += dy / d * 0.012 * dt; a.face = dx >= 0 ? 1 : -1; }
            a.sortY = a.y;
          }
          a.frame = (a.anim % 4000) < 600 ? 'peck' : 'perch';
          break;
        }
        case 'sit': {
          a.timer -= dt;
          break;
        }
        case 'idle': {
          a.timer -= dt;
          const ground = a.perch && a.perch.kind === 'ground';
          // idle animation: pecking on the ground, occasional turn
          if (ground) a.frame = (a.anim % 1800) < 350 ? 'peck' : 'perch';
          else a.frame = (a.anim % 5000) < 200 ? 'peck' : 'perch';
          if (a.perch && a.perch.cling) a.frame = (a.anim % 900) < 120 ? 'peck' : 'perch';
          if (Math.random() < dt / 6000) a.face = -a.face;
          if (a.perch && a.perch.kind === 'bath' && Math.random() < dt / 2200) { a.frame = 'peck'; this.game.fx.burst('splash', a.x, a.y - a.z, 3); }
          if (a.perch && a.perch.kind === 'feeder') a.frame = (a.anim % 1200) < 300 ? 'peck' : 'perch';
          if (ground && Math.random() < dt / 2500) {
            // hop
            const nx = a.x + a.face * (3 + Math.random() * 6);
            const t2 = tileAt(S, Math.floor(nx / TS), Math.floor(a.y / TS));
            if (TINFO[t2].land) { a.x = nx; a.hopT = 160; }
          }
          if (a.hopT > 0) a.hopT -= dt;
          if (a.timer <= 0 && !a.observed) this._nextMove(a);
          break;
        }
      }
    }
  }

  _nextMove(a) {
    const S = this.S;
    if (a.ambient) {
      // ground flocks shuffle around a little; sometimes the whole flock moves on
      if (a.perch && a.perch.kind === 'ground' && Math.random() < 0.7) {
        const p = Object.assign({}, a.perch, { x: a.x + (Math.random() - 0.5) * 30, y: a.y + (Math.random() - 0.5) * 20 });
        if (TINFO[tileAt(S, Math.floor(p.x / TS), Math.floor(p.y / TS))].land) { p.sortY = p.y; this.flyTo(a, p, 50); return; }
      }
      a.timer = 4000 + Math.random() * 6000;
      return;
    }
    if (!a.nest) { this.flyTo(a, this.pickPerch(a.sp, a.zone), 70); return; }
    const n = S.objs.get(a.nest);
    if (!n) return;
    const anc = a.anchor = nestAnchor(S, n);
    switch (a.job) {
      case 'feed': {
        if (a.atNest) {
          a.atNest = false;
          const p = this._nearPerch(n, anc, 0);
          p.kind = p.kind === 'water' ? 'ground' : p.kind;
          this.flyTo(a, p, 90);
        } else {
          this.flyTo(a, { kind: 'nest', x: anc.x + (Math.random() < 0.5 ? -3 : 3), y: anc.y, z: anc.z + 2, sortY: anc.sortY + 0.5 }, 90);
          a.onLand = () => {
            a.atNest = true; a.timer = 1200 + Math.random() * 1500;
            if (anc.box || anc.hole) a.hidden = true;
            Audio2.sfx('chirps', anc.x, anc.y - anc.z);
            this.game.beg(n.id);
          };
          return;
        }
        a.timer = 2500 + Math.random() * 4000;
        break;
      }
      case 'guard': case 'court': case 'sing': case 'family': {
        const p = Math.random() < 0.5 ? this._nearPerch(n, anc, Math.random() < 0.5 ? 0 : 1) : this.pickPerch(a.sp, a.zone, anc);
        if (p) this.flyTo(a, p, 75);
        if (a.job === 'court' && Math.random() < 0.5) this.game.fx.burst('heart', anc.x, anc.y - anc.z - 6, 1);
        break;
      }
      case 'mother': {
        const w = this._nearestWater(anc.x, anc.y);
        a.state = 'swim'; a.swimTo = { x: w.x + (Math.random() - 0.5) * 30, y: w.y + (Math.random() - 0.5) * 20 };
        break;
      }
      default: this.flyTo(a, this.pickPerch(a.sp, a.zone, anc), 70);
    }
  }

  // Visible birds a player could observe near (x, y)
  observable(x, y, r) {
    let best = null, bd = r * r;
    for (const a of this.agents) {
      if (a.hidden || a.state === 'fly') continue;
      if (a.role === 'duckling') continue;
      const d = dist2(a.x, a.y - a.z * 0.5, x, y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  sprite(a) {
    const s = SPR.bird(a.sp);
    let f = a.state === 'fly' || a.state === 'circle' ? ((a.anim % 260) < 130 ? 'fly1' : 'fly2') : a.frame || 'perch';
    if (a.sp === 'barnowl' && (a.state === 'fly' || a.state === 'circle')) f = (a.anim % 700) < 350 ? 'fly1' : 'fly2';
    if (a.hopT > 0) f = 'hop';
    return { s, img: a.face < 0 ? s[f + '_L'] : s[f], fly: f.startsWith('fly') };
  }
}
