'use strict';
// The authoritative world simulation. It runs in the browser of the solo player or co-op host.
// Clients (including the host's own view) talk to it only through messages, so solo and
// multiplayer behave identically.

const PLANT_ITEM = {
  oak: 'sap_oak', birch: 'sap_birch', willow: 'sap_willow', pine: 'sap_pine', apple: 'sap_apple',
  hawthorn: 'cut_hawthorn', blackthorn: 'cut_blackthorn', bramble: 'cut_bramble', elder: 'cut_elder', hazel: 'cut_hazel',
  wildflower: 'seed_wildflower', thistle: 'seed_thistle', herbs: 'seed_herbs', reed: 'rhizome_reed', cattail: 'rhizome_cattail',
  snag: 'snag',
};

const ANIMAL_PENS = {
  sheep: [4 * TS + 6, 32 * TS + 8, 13 * TS - 6, 37 * TS - 2],
  horse: [17 * TS + 8, 32 * TS + 8, 23 * TS - 8, 36 * TS - 2],
  chicken: [12 * TS + 4, 26 * TS + 6, 19 * TS + 10, 29 * TS + 12],
};

class World {
  constructor() {
    this.out = null;          // { send(pid, msg), broadcast(msg) }
    this.onSave = null;       // called when the world should be saved
    this.pendAll = [];
    this.pendTo = new Map();
    this.players = new Map(); // pid -> player (online)
    this.saved = {};          // token -> persistent player record
    this.pauseSet = new Set();
    this.msAcc = 0;
    this.posTimer = 0;
    this.saveTimer = 0;
    this.bulk = false;
    this.observed = {};
  }

  static create(name, seed) {
    const w = new World();
    w.name = name || 'Featherbrook';
    w.seed = seed >>> 0;
    const m = generateMap(w.seed);
    w._setupMap(m);
    w.tiles = m.tiles;
    w.grass = m.grass;
    w.nextId = 1;
    for (const o of m.objs) { o.id = w.nextId++; idxAdd(w, o); }
    w.time = { min: DAY_START, day: 1, season: SPRING, year: 1 };
    w.weather = 'sun';
    w.coins = 250;
    w.mats = {};
    for (const k of MAT_ORDER) w.mats[k] = 0;
    w.mats.wood = 5;
    w.journal = {};
    for (const sp of SPECIES) w.journal[sp.id] = { h: 0, n: 0, seen: false, first: null };
    w.log = [];
    w.mail = [];
    w.mailSeq = 1;
    w.quest = 0;
    w.tierSent = 0;
    w.adaDay = -1;
    w.allDone = false;
    w.stats = { fledged: 0, built: 0, days: 1 };
    w.dug = {};
    w.featured = [];
    w.visitors = [];
    w.side = {};
    w.found = {};
    w.sendMail(LETTERS.welcome);
    w._makeAnimals();
    w.bulk = true;
    w.startDay();
    w.bulk = false;
    w.pendAll = [];
    return w;
  }

  static fromSave(d) {
    const w = new World();
    w.name = d.name; w.seed = d.seed >>> 0;
    const m = generateMap(w.seed);
    w._setupMap(m);
    w.tiles = b64decode(d.tiles);
    w.grass = b64decode(d.grass);
    w.nextId = d.nextId;
    for (const o of d.objs) idxAdd(w, o);
    w.time = d.time; w.weather = d.weather; w.coins = d.coins; w.mats = d.mats;
    for (const k of MAT_ORDER) if (w.mats[k] == null) w.mats[k] = 0;
    w.journal = d.journal;
    for (const sp of SPECIES) if (!w.journal[sp.id]) w.journal[sp.id] = { h: 0, n: 0, seen: false, first: null };
    w.log = d.log || []; w.mail = d.mail || []; w.mailSeq = d.mailSeq || 1;
    w.quest = d.quest || 0; w.tierSent = d.tierSent || 0; w.adaDay = d.adaDay == null ? -1 : d.adaDay;
    w.allDone = !!d.allDone; w.stats = d.stats || { fledged: 0, built: 0, days: 1 };
    w.dug = d.dug || {};
    w.featured = d.featured || []; w.visitors = d.visitors || [];
    w.side = d.side || {}; w.found = d.found || {};
    w.saved = d.players || {};
    w._addNewBuildings(m);
    w._makeAnimals();
    if (!w.featured.length) { w.bulk = true; w.pickFeatured(); w.bulk = false; w.pendAll = []; }
    return w;
  }

  // Worlds saved before a building existed get it now, if its plot is still free
  _addNewBuildings(m) {
    const land = (t) => !isWaterT(t) && t !== T.CLIFF && t !== T.BRIDGE;
    for (const o of m.objs) {
      if (o.type !== 'building' && o.type !== 'landmark') continue;
      if (Array.from(this.objs.values()).some((q) => q.type === o.type && q.kind === o.kind)) continue;
      const b = o.type === 'building' ? BUILDINGS[o.kind] : { w: LANDMARKS[o.kind].w || 1, h: LANDMARKS[o.kind].h || 1 };
      // the plot may hold untouched wild plants and litter, but nothing players made and no nests
      const clear = new Set();
      let ok = true;
      for (let dy = 0; dy < b.h && ok; dy++) for (let dx = 0; dx < b.w && ok; dx++) {
        const i = tIdx(o.x + dx, o.y + dy);
        if (!land(this.tiles[i]) || this.tiles[i] === T.PATH) { ok = false; break; }
        for (const id of this.byTile.get(i) || []) {
          const q = this.objs.get(id);
          if (!q) continue;
          const wild = q.nat && ['tree', 'shrub', 'plant', 'rock', 'log', 'stump'].includes(q.type) && !nestsOfHost(this, q.id).length;
          if (wild || q.type === 'forage' || q.type === 'web' || q.type === 'puddle') clear.add(q);
          else { ok = false; break; }
        }
      }
      if (!ok) continue;
      for (const q of clear) idxRemove(this, q);
      for (let dy = 0; dy < b.h; dy++) for (let dx = 0; dx < b.w; dx++) {
        const i = tIdx(o.x + dx, o.y + dy);
        this.tiles[i] = T.GRASS; this.grass[i] = 0;
      }
      idxAdd(this, Object.assign({}, o, { id: this.nextId++ }));
      // its garden path, where the new map has one and the old world still has grass
      if (o.type !== 'building' || !b.door) continue;
      const dx = o.x + b.door[0];
      for (let y = o.y + b.h; y < MAP_H; y++) {
        const i = tIdx(dx, y);
        if (m.tiles[i] !== T.PATH || this.tiles[i] === T.PATH || !land(this.tiles[i]) || this.occ[i]) break;
        this.tiles[i] = T.PATH; this.grass[i] = 0;
      }
    }
  }

  _setupMap(m) {
    this.wild = m.wild;
    this.riverside = m.riverside;
    this.objs = new Map();
    this.occ = new Int32Array(MAP_W * MAP_H);
    this.byTile = new Map();
  }

  serialize() {
    for (const p of this.players.values()) this._storePlayer(p);
    return {
      v: GAME_VERSION, name: this.name, seed: this.seed, time: this.time, weather: this.weather,
      coins: this.coins, mats: this.mats, journal: this.journal, log: this.log, mail: this.mail, mailSeq: this.mailSeq,
      quest: this.quest, tierSent: this.tierSent, adaDay: this.adaDay, allDone: this.allDone, stats: this.stats,
      tiles: b64encode(this.tiles), grass: b64encode(this.grass), objs: Array.from(this.objs.values()), nextId: this.nextId,
      dug: this._todayDug(), featured: this.featured, visitors: this.visitors, players: this.saved, savedAt: Date.now(),
      side: this.side, found: this.found,
    };
  }

  _todayDug() {
    const today = dayIdx(this.time), out = {};
    for (const k in this.dug) if (this.dug[k] === today) out[k] = today;
    return out;
  }

  // ---------------------------------------------------------------- events
  ev(...e) { if (!this.bulk) this.pendAll.push(e); }
  evTo(pid, ...e) {
    let q = this.pendTo.get(pid);
    if (!q) { q = []; this.pendTo.set(pid, q); }
    q.push(e);
  }
  flush() {
    if (!this.out) { this.pendAll = []; this.pendTo.clear(); return; }
    const all = this.pendAll;
    this.pendAll = [];
    for (const pid of this.players.keys()) {
      const own = this.pendTo.get(pid);
      if (!all.length && !own) continue;
      this.out.send(pid, { t: 'ev', e: own ? all.concat(own) : all });
    }
    this.pendTo.clear();
  }
  toastAll(text, icon) { this.ev('toast', text, icon || ''); }
  toast(p, text, icon) { this.evTo(p.pid, 'toast', text, icon || ''); }
  fail(p, text) { this.evTo(p.pid, 'toast', text, 'no'); this.evTo(p.pid, 'snd', 'error'); }

  addObj(o) {
    if (!o.id) o.id = this.nextId++;
    idxAdd(this, o);
    this.ev('oa', o);
    return o;
  }
  removeObj(o) {
    idxRemove(this, o);
    this.ev('or', o.id);
  }
  touch(o, keys) {
    const patch = {};
    for (const k of keys) patch[k] = o[k];
    this.ev('ou', o.id, patch);
  }
  setTile(x, y, t) {
    const i = tIdx(x, y);
    this.tiles[i] = t;
    this.ev('tile', i, t);
  }
  setGrass(i, h) {
    this.grass[i] = h;
    this.ev('gr', i, h);
  }

  // ---------------------------------------------------------------- players
  join(pid, hello) {
    let token = String(hello.token || makeToken()).slice(0, 40);
    // the same browser in two tabs: give the second tab its own identity
    for (let n = 2; Array.from(this.players.values()).some((q) => q.token === token); n++) token = String(hello.token).slice(0, 36) + '~' + n;
    const rec = this.saved[token];
    const n = this.players.size;
    const p = {
      pid, token,
      name: cleanName(hello.name) || (rec && rec.name) || 'Birder',
      look: cleanLook(hello.look || (rec && rec.look)),
      x: rec && rec.x ? rec.x : HOME_SPAWN[0] + (n % 3 - 1) * 14,
      y: rec && rec.y ? rec.y : HOME_SPAWN[1] + Math.floor(n / 3) * 10,
      d: 0, m: 0, a: '',
      inv: rec && rec.inv ? rec.inv : starterInventory(),
      sleep: false,
    };
    if (feetBlocked(this, p.x, p.y)) { p.x = HOME_SPAWN[0]; p.y = HOME_SPAWN[1]; }
    this.players.set(pid, p);
    this._storePlayer(p);
    this.ev('pj', publicPlayer(p));
    this.out && this.out.send(pid, { t: 'welcome', snap: this.snapshotFor(pid) });
    if (this.players.size > 1) {
      this.toastAll(p.name + ' arrived in the valley!', 'heart');
      this.ev('chat', '', p.name + ' joined.', null);
    }
    this._sleepStatus();
    return p;
  }

  leave(pid) {
    const p = this.players.get(pid);
    if (!p) return;
    this._storePlayer(p);
    this.players.delete(pid);
    this.pauseSet.delete(pid);
    this.ev('pq', pid);
    if (this.players.size) { this.ev('chat', '', p.name + ' left.', null); this.toastAll(p.name + ' went home.', ''); }
    this._sleepStatus();
    this._maybeSleep();
  }

  _storePlayer(p) { this.saved[p.token] = { name: p.name, look: p.look, inv: p.inv, x: p.x, y: p.y }; }

  snapshotFor(pid) {
    const p = this.players.get(pid);
    return {
      name: this.name, seed: this.seed, you: pid,
      tiles: b64encode(this.tiles), grass: b64encode(this.grass), objs: Array.from(this.objs.values()),
      time: this.time, weather: this.weather, coins: this.coins, mats: this.mats, journal: this.journal,
      log: this.log, mail: this.mail, quest: this.quest, visitors: this.visitors, featured: this.featured,
      players: Array.from(this.players.values()).map(publicPlayer),
      animals: this.animals.map(publicAnimal), dug: this._todayDug(),
      inv: p ? p.inv : [], stats: this.stats, allDone: this.allDone, side: this.side, found: this.found,
    };
  }

  // ---------------------------------------------------------------- loop
  isPaused() {
    if (this.players.size !== 1) return false;
    for (const pid of this.players.keys()) return this.pauseSet.has(pid);
    return false;
  }

  tick(dt) {
    if (!this.isPaused() && this.players.size > 0) {
      this.msAcc += dt;
      let guard = 0;
      while (this.msAcc >= MS_PER_MIN && guard++ < 50) {
        this.msAcc -= MS_PER_MIN;
        this.time.min++;
        this._onMinute();
      }
    }
    this._updateAnimals(dt);
    this.posTimer += dt;
    if (this.posTimer >= 100) {
      this.posTimer = 0;
      if (this.out && this.players.size) {
        const pl = [];
        for (const p of this.players.values()) pl.push([p.pid, Math.round(p.x), Math.round(p.y), p.d, p.m, p.a, p.sleep ? 1 : 0]);
        this.out.broadcast({ t: 'pl', p: pl, a: this.animals.map(publicAnimal) });
      }
    }
    this.saveTimer += dt;
    if (this.saveTimer > 60000) { this.saveTimer = 0; if (this.onSave) this.onSave(); }
    this.flush();
  }

  _onMinute() {
    const m = this.time.min;
    if (m % 10 === 0) {
      this.ev('time', this.time, this.weather);
      this.checkArrivals();
    }
    if (m === 11 * 60) {
      for (const o of Array.from(this.objs.values())) if (o.type === 'web') this.removeObj(o);
    }
    if (m >= DAY_END) {
      this.toastAll('It\'s 2 am… everyone stumbles home to bed.', 'moon');
      this.newDay();
    }
  }

  // ---------------------------------------------------------------- animals
  _makeAnimals() {
    const a = [];
    let n = 1;
    const mk = (kind, pen) => {
      const [x0, y0, x1, y1] = ANIMAL_PENS[pen];
      a.push({ id: 'a' + (n++), kind, x: x0 + Math.random() * (x1 - x0), y: y0 + Math.random() * (y1 - y0), d: 0, m: 0, tx: 0, ty: 0, w: 500, pen, br: -1 });
    };
    for (let i = 0; i < 4; i++) mk('sheep', 'sheep');
    mk('horse', 'horse');
    for (let i = 0; i < 5; i++) mk('chicken', 'chicken');
    this.animals = a;
  }

  _updateAnimals(dt) {
    for (const a of this.animals) {
      if (a.w > 0) { a.w -= dt; a.m = 0; continue; }
      const [x0, y0, x1, y1] = ANIMAL_PENS[a.pen];
      if (!a.tx) { a.tx = x0 + Math.random() * (x1 - x0); a.ty = y0 + Math.random() * (y1 - y0); }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      const spd = a.kind === 'horse' ? 22 : a.kind === 'chicken' ? 20 : 12;
      if (d < 2 || Math.random() < 0.0005 * dt) {
        a.tx = 0; a.m = 0;
        a.w = (a.kind === 'chicken' ? 600 : 1500) + Math.random() * 4000;
        continue;
      }
      const step = Math.min(d, spd * dt / 1000);
      const nx = a.x + dx / d * step, ny = a.y + dy / d * step;
      const [mx, my] = moveActor(this, a.x, a.y, nx - a.x, ny - a.y);
      if (Math.abs(mx - a.x) + Math.abs(my - a.y) < step * 0.3) { a.tx = 0; a.w = 800; }
      a.x = clamp(mx, x0 - 8, x1 + 8); a.y = clamp(my, y0 - 8, y1 + 8);
      a.d = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0);
      a.m = 1;
    }
  }

  // ---------------------------------------------------------------- inventory & pouch
  gainMat(p, k, n, src) {
    if (!n) return;
    const before = this.mats[k] || 0;
    this.mats[k] = Math.min(MAT_MAX, before + n);
    this.ev('mats', { [k]: this.mats[k] });
    if (p && src) this.ev('gain', p.pid, src[0], src[1], [['m', k, n]]);
    this.questCheck();
  }
  hasMats(req) { for (const k in req) if ((this.mats[k] || 0) < req[k]) return false; return true; }
  takeMats(req) {
    const ch = {};
    for (const k in req) { this.mats[k] -= req[k]; ch[k] = this.mats[k]; }
    this.ev('mats', ch);
  }
  gainItem(p, k, n, src) {
    let left = n;
    for (const s of p.inv) if (s && s.k === k && s.n < STACK_MAX && left > 0) { const add = Math.min(left, STACK_MAX - s.n); s.n += add; left -= add; }
    for (let i = 0; i < p.inv.length && left > 0; i++) if (!p.inv[i]) { const add = Math.min(left, STACK_MAX); p.inv[i] = { k, n: add }; left -= add; }
    this.evTo(p.pid, 'inv', p.inv);
    const got = n - left;
    if (got && src) this.ev('gain', p.pid, src[0], src[1], [['i', k, got]]);
    if (left > 0) this.fail(p, 'Your bag is full!');
    return got;
  }
  hasRoom(p, k) { return p.inv.some((s) => !s || (s.k === k && s.n < STACK_MAX)); }
  takeSlot(p, slot, n) {
    const s = p.inv[slot];
    if (!s) return false;
    s.n -= n;
    if (s.n <= 0) p.inv[slot] = null;
    this.evTo(p.pid, 'inv', p.inv);
    return true;
  }

  // ---------------------------------------------------------------- messages
  handle(pid, msg) {
    const p = this.players.get(pid);
    if (!p || !msg || typeof msg !== 'object') return;
    try {
      if (msg.t === 'pos') this.onPos(p, msg);
      else if (msg.t === 'act') this.onAct(p, msg);
    } catch (err) {
      console.error('World.handle error', err, msg);
    }
    this.flush();
  }

  onPos(p, m) {
    const x = +m.x, y = +m.y;
    if (!isFinite(x) || !isFinite(y)) return;
    if (p.sleep) return;
    if (dist2(x, y, p.x, p.y) > 160 * 160) { this.evTo(p.pid, 'tp', p.x, p.y); return; }
    p.x = clamp(x, 4, MAP_W * TS - 4);
    p.y = clamp(y, 4, MAP_H * TS - 4);
    p.d = (m.d | 0) & 3;
    p.m = m.m ? 1 : 0;
    p.a = typeof m.a === 'string' ? m.a.slice(0, 8) : '';
  }

  reachObj(p, o, extra) {
    const [w, h] = footprint(o);
    const x0 = o.x * TS, y0 = o.y * TS, x1 = x0 + w * TS, y1 = y0 + h * TS;
    const cx = clamp(p.x, x0, x1), cy = clamp(p.y, y0, y1);
    const r = 44 + (extra || 0);
    return dist2(p.x, p.y, cx, cy) <= r * r;
  }
  reachTile(p, x, y) { return dist2(p.x, p.y, x * TS + 8, y * TS + 8) <= 48 * 48; }

  onAct(p, m) {
    switch (m.a) {
      case 'use': return this.actUse(p, m);
      case 'tile': return this.actTile(p, m);
      case 'place': return this.actPlace(p, m);
      case 'nest': return this.actNest(p, m);
      case 'line': return this.actLine(p, m);
      case 'nclear': return this.actNestClear(p, m);
      case 'pickup': return this.actPickup(p, m);
      case 'craft': return this.actCraft(p, m);
      case 'buy': return this.actBuy(p, m);
      case 'sell': return this.actSell(p, m);
      case 'obs': return this.actObserve(p, m);
      case 'talk': return this.actTalk(p, m);
      case 'opt': return this.actOpt(p, m);
      case 'mail': return this.actMail(p, m);
      case 'swap': return this.actSwap(p, m);
      case 'trash': return this.actTrash(p, m);
      case 'sleep': return this.actSleep(p, m);
      case 'chat': return this.actChat(p, m);
      case 'look': return this.actLook(p, m);
      case 'pause': if (m.v) this.pauseSet.add(p.pid); else this.pauseSet.delete(p.pid); return;
      case 'brush': return this.actBrush(p, m);
    }
  }

  actUse(p, m) {
    const o = this.objs.get(m.id | 0);
    if (!o || !this.reachObj(p, o)) return;
    const q = quickOp(this, o);
    if (!q || q.op !== m.op) return;
    const today = dayIdx(this.time);
    const src = [o.x * TS + 8, o.y * TS + 8];
    switch (q.op) {
      case 'shake': {
        if (o.type === 'tree') {
          if (o.kind === 'apple' && o.fr > 0) { this.gainItem(p, 'apple', o.fr, src); o.fr = 0; }
          if (o.sh !== today) {
            o.sh = today;
            this.gainMat(p, 'twig', o.st >= 2 ? 1 + (Math.random() < 0.5 ? 1 : 0) + (o.kind === 'oak' ? 1 : 0) : 1, src);
            if (o.kind === 'willow' && this.time.season === SPRING && o.st >= 2) this.gainMat(p, 'fluff', 2, src);
            if (Math.random() < 0.12) { this.gainMat(p, 'feather', 1, src); this.toast(p, 'A feather drifted down from the branches!', 'feather'); }
          }
          this.touch(o, ['fr', 'sh']);
        } else {
          o.sh = today;
          this.gainMat(p, 'twig', 1, src);
          this.touch(o, ['sh']);
        }
        this.ev('fx', 'shake', o.id, 0, 0);
        break;
      }
      case 'pick': {
        const f = FLORA[o.kind].fruit;
        const got = this.gainItem(p, f.item, o.fr, src);
        o.fr -= got;
        this.touch(o, ['fr']);
        this.ev('fx', 'shake', o.id, 0, 0);
        break;
      }
      case 'harvest': {
        const h = harvestInfo(this, o);
        o.hv = today;
        this.gainMat(p, h.mat, h.n, src);
        this.touch(o, ['hv']);
        this.ev('fx', 'rustle', o.id, 0, 0);
        break;
      }
      case 'moss': o.moss--; this.gainMat(p, 'moss', 1, src); this.touch(o, ['moss']); this.ev('fx', 'scrape', o.id, 0, 0); break;
      case 'look': {
        const l = LANDMARKS[o.kind];
        const first = !this.found[o.kind];
        if (first) {
          this.found[o.kind] = today;
          this.coins += LANDMARK_REWARD; this.ev('coins', this.coins);
          this.ev('found', this.found);
          this.toastAll((p.name ? p.name + ' discovered ' : 'Discovered ') + 'the ' + l.name + '! (+' + LANDMARK_REWARD + ' coins)', 'star');
        }
        this.evTo(p.pid, 'lore', o.kind, first);
        break;
      }
      case 'bark': o.bk = today; this.gainMat(p, 'bark', 2, src); this.touch(o, ['bk']); this.ev('fx', 'scrape', o.id, 0, 0); break;
      case 'lichen': o.li--; this.gainMat(p, 'lichen', 1, src); this.touch(o, ['li']); this.ev('fx', 'scrape', o.id, 0, 0); break;
      case 'rot': o.rv = today; this.gainMat(p, 'rotwood', 1, src); this.touch(o, ['rv']); this.ev('fx', 'crumble', o.id, 0, 0); break;
      case 'collect': {
        if (o.type === 'web') { this.removeObj(o); this.gainMat(p, 'silk', 1, src); this.ev('fx', 'silk', 0, src[0], src[1]); break; }
        if (o.type === 'qitem') {
          this.removeObj(o);
          const q = QUESTS_BY_ID[o.q], st = this.side[o.q];
          this.ev('fx', 'pickup', 0, src[0], src[1]);
          if (!q || !st || st.st !== 'on') break;
          st.n = (st.n || 0) + 1;
          this.ev('side', this.side);
          this.toastAll(q.n > 1 ? 'Found ' + QITEMS[q.item].name + ' (' + Math.min(st.n, q.n) + '/' + q.n + ')' + (st.n >= q.n ? ' — back to ' + NPCS[q.npc].name + '!' : '')
            : 'Found ' + QITEMS[q.item].name + '! Take it back to ' + NPCS[q.npc].name + '.', 'star');
          break;
        }
        if (o.type === 'puddle') {
          o.q--;
          this.gainMat(p, 'mud', 1, src);
          if (o.q <= 0) this.removeObj(o); else this.touch(o, ['q']);
          this.ev('fx', 'mud', 0, src[0], src[1]);
          break;
        }
        this.removeObj(o);
        switch (o.kind) {
          case 'twig': this.gainMat(p, 'twig', o.q || 1, src); break;
          case 'stick': this.gainMat(p, 'stick', 1, src); break;
          case 'leaves': this.gainMat(p, 'leaves', 2, src); break;
          case 'feather': this.gainMat(p, 'feather', 1, src); break;
          case 'stone': this.gainMat(p, 'stone', 1, src); break;
          case 'driftwood': this.gainMat(p, 'wood', 2, src); break;
          case 'mushroom': this.gainItem(p, 'mushroom', 1, src); break;
          case 'garlic': this.gainItem(p, 'garlic', 1, src); break;
          case 'note': this.giveHint(o.sp, 'note', p); break;
        }
        this.ev('fx', 'pickup', 0, src[0], src[1]);
        break;
      }
    }
  }

  actBrush(p, m) {
    const a = this.animals.find((x) => x.id === m.id);
    if (!a || dist2(p.x, p.y, a.x, a.y) > 40 * 40) return;
    const today = dayIdx(this.time);
    if (a.br === today) { this.toast(p, a.kind === 'chicken' ? 'The hen has had enough fuss for today.' : 'Already brushed today — come back tomorrow!', ''); return; }
    a.br = today;
    const src = [a.x, a.y - 8];
    if (a.kind === 'sheep') { this.gainMat(p, 'wool', 1, src); this.ev('fx', 'hearts', 0, a.x, a.y - 14); }
    else if (a.kind === 'horse') { this.gainMat(p, 'hair', 1, src); this.ev('fx', 'hearts', 0, a.x, a.y - 22); }
    else { this.gainMat(p, 'feather', 1, src); this.ev('fx', 'hearts', 0, a.x, a.y - 8); this.toast(p, 'The hen fluffs up and drops a feather. Cluck!', 'feather'); }
    this.ev('snd', 'brush', a.x, a.y);
  }

  actTile(p, m) {
    const x = m.x | 0, y = m.y | 0;
    if (!inBounds(x, y) || !this.reachTile(p, x, y)) return;
    const q = tileOp(this, x, y);
    if (!q || q.op !== m.op) return;
    const i = tIdx(x, y), today = dayIdx(this.time);
    const src = [x * TS + 8, y * TS + 8];
    switch (q.op) {
      case 'cut': this.setGrass(i, 0); this.gainMat(p, 'grass', 1, src); this.ev('fx', 'grass', 0, src[0], src[1]); break;
      case 'mud': this.dug[i] = today; this.ev('dug', i, today); this.gainMat(p, 'mud', 1, src); this.ev('fx', 'mud', 0, src[0], src[1]); break;
      case 'sand': this.dug[i] = today; this.ev('dug', i, today); this.gainMat(p, 'sand', 1, src); this.ev('fx', 'dig', 0, src[0], src[1]); break;
      case 'clay': this.dug[i] = today; this.ev('dug', i, today); this.gainMat(p, 'clay', 1, src); this.ev('fx', 'dig', 0, src[0], src[1]); break;
      case 'gravel': this.dug[i] = today; this.ev('dug', i, today); this.gainMat(p, 'stone', 1, src); this.ev('fx', 'dig', 0, src[0], src[1]); break;
    }
  }

  actPlace(p, m) {
    const slot = m.slot | 0, x = m.x | 0, y = m.y | 0;
    const s = p.inv[slot];
    if (!s || !this.reachTile(p, x, y)) return;
    const chk = canPlace(this, s.k, x, y, Array.from(this.players.values()));
    if (!chk.ok) { if (chk.reason) this.fail(p, chk.reason); return; }
    const it = ITEMS[s.k];
    const today = dayIdx(this.time);
    if (it.cat === 'struct') {
      if (it.struct === 'pondpatch') {
        const i = tIdx(x, y);
        this.setTile(x, y, T.SHALLOW);
        this.setGrass(i, 0);
        this.ev('fx', 'splash', 0, x * TS + 8, y * TS + 8);
        this.toast(p, 'A new pond tile! Plant reeds and cattails in it.', 'water');
      } else if (it.struct === 'snag') {
        this.addObj({ type: 'tree', kind: 'snag', x, y, st: 2, pl: 1, by: p.name });
        this.ev('fx', 'place', 0, x * TS + 8, y * TS + 12);
      } else {
        this.addObj({ type: 'struct', kind: it.struct, x, y, pl: 1, by: p.name });
        this.ev('fx', 'place', 0, x * TS + 8, y * TS + 12);
      }
    } else {
      const f = FLORA[it.plant];
      const o = { type: f.type, kind: it.plant, x, y, st: 0, g: 0, pl: 1, by: p.name, d: today };
      if (f.type === 'shrub') o.fr = 0;
      if (f.type === 'plant') o.hv = -1;
      if (this.grass[tIdx(x, y)]) this.setGrass(tIdx(x, y), 0);
      this.addObj(o);
      this.ev('fx', 'plant', 0, x * TS + 8, y * TS + 12);
      for (const q of QUESTS) {
        const st = this.side[q.id];
        if (q.kind === 'plant' && q.plant === it.plant && st && st.st === 'on' && (st.n || 0) < q.n) {
          st.n = (st.n || 0) + 1; this.ev('side', this.side);
          this.toast(p, q.title + ': ' + st.n + '/' + q.n + (st.n >= q.n ? ' — tell ' + NPCS[q.npc].name + '!' : ''), 'star');
        }
      }
    }
    this.takeSlot(p, slot, 1);
  }

  actNest(p, m) {
    const sp = SPECIES_BY_ID[m.sp];
    if (!sp || sp.site === 'parasite') return;
    if (!knownSpecies(this, sp.id)) return this.fail(p, 'You haven\'t learned this nest yet — find more clues!');
    let host = null, cx, cy, slot = 0;
    if (m.host) {
      host = this.objs.get(m.host | 0);
      if (!host || !this.reachObj(p, host, 8)) return;
      if (!sitesOf(this, host).includes(sp.site)) return this.fail(p, 'This spot doesn\'t suit a ' + sp.name + '.');
      const existing = nestsOfHost(this, host.id);
      if (existing.length >= hostSlots(host)) return this.fail(p, 'There\'s no room for another nest here.');
      const used = existing.map((n) => n.slot);
      while (used.includes(slot)) slot++;
      [cx, cy] = hostCenter(host);
    } else {
      cx = m.x | 0; cy = m.y | 0;
      if (!inBounds(cx, cy) || !this.reachTile(p, cx, cy)) return;
      if (!sitesOf(this, { tile: [cx, cy] }).includes(sp.site)) return this.fail(p, 'This spot doesn\'t suit a ' + sp.name + '.');
    }
    if (!this.hasMats(sp.mats)) return this.fail(p, 'Not enough nest materials.');
    this.takeMats(sp.mats);
    const n = {
      type: 'nest', kind: sp.id, x: host ? host.x : cx, y: host ? host.y : cy, host: host ? host.id : 0, slot,
      st: sp.id === 'wren' ? 'cock' : 'built', t: 0, eggs: 0, ch: 0, cl: 0, arr: 0, by: p.name, d: dayIdx(this.time),
    };
    if (!host && (this.tiles[tIdx(cx, cy)] === T.GRASS || this.tiles[tIdx(cx, cy)] === T.MARSH)) this.setGrass(tIdx(cx, cy), 2);
    this.addObj(n);
    this.stats.built++;
    this.toastAll(p.name + ' built a ' + sp.name + (sp.id === 'wren' ? ' cock nest!' : ' nest!'), 'nest');
    this.ev('fx', 'build', n.id, cx * TS + 8, cy * TS + 8);
    if (sp.id === 'wren') this.toast(p, 'Wren males build several cock nests. Build another one nearby!', 'nest');
    this.questCheck();
    this.checkArrivals();
  }

  actLine(p, m) {
    const n = this.objs.get(m.id | 0);
    if (!n || n.type !== 'nest' || n.st !== 'lining') return;
    const sp = SPECIES_BY_ID[n.kind];
    if (!sp.lining) return;
    if (!this.hasMats(sp.lining)) return this.fail(p, 'Not enough feathers for the lining.');
    this.takeMats(sp.lining);
    n.st = 'pair';
    n.cl = randInt(Math.random, sp.clutch[0], sp.clutch[1]);
    this.touch(n, ['st', 'cl']);
    this.toastAll('The Wren nest is lined with feathers — the pair has moved in!', 'heart');
    this.ev('fx', 'hearts', n.id, 0, 0);
  }

  actNestClear(p, m) {
    const n = this.objs.get(m.id | 0);
    if (!n || n.type !== 'nest') return;
    const host = n.host ? this.objs.get(n.host) : null;
    if (host ? !this.reachObj(p, host, 8) : !this.reachTile(p, n.x, n.y)) return;
    const sp = SPECIES_BY_ID[n.kind];
    if (n.st === 'old') {
      this.removeObj(n);
      this.toastAll('Old nest cleaned out. This gets rid of fleas and mites before the next brood.', 'nest');
      if (Math.random() < 0.5) this.gainMat(p, 'feather', 1, [n.x * TS + 8, n.y * TS + 8]);
    } else if (n.st === 'built' || n.st === 'cock' || n.st === 'lining') {
      this.removeObj(n);
      const refund = {};
      for (const k in sp.mats) refund[k] = Math.floor(sp.mats[k] / 2);
      for (const k in refund) if (refund[k]) this.gainMat(p, k, refund[k]);
      this.toast(p, 'Nest removed. Some materials were saved.', 'nest');
    } else {
      this.fail(p, 'Never disturb an active nest!');
    }
  }

  actPickup(p, m) {
    const o = this.objs.get(m.id | 0);
    if (!o || !o.pl || !this.reachObj(p, o)) return;
    const nests = nestsOfHost(this, o.id);
    if (nests.some((n) => n.st !== 'old' && n.st !== 'built')) return this.fail(p, 'Birds are using it — leave it be!');
    let key = null;
    if (o.type === 'struct') key = o.kind;
    else key = PLANT_ITEM[o.kind];
    if (!key || !ITEMS[key]) return;
    if (!this.hasRoom(p, key)) return this.fail(p, 'Your bag is full!');
    for (const n of nests) this.removeObj(n);
    this.removeObj(o);
    this.gainItem(p, key, 1, [o.x * TS + 8, o.y * TS + 8]);
  }

  actCraft(p, m) {
    const r = RECIPES.find((x) => x.id === m.r);
    if (!r) return;
    if (!this.hasMats(r.mats)) return this.fail(p, 'Not enough materials.');
    if (!this.hasRoom(p, r.id)) return this.fail(p, 'Your bag is full!');
    this.takeMats(r.mats);
    this.gainItem(p, r.id, 1);
    this.evTo(p.pid, 'snd', 'craft');
    this.toast(p, 'Crafted: ' + ITEMS[r.id].name + '! Face an empty spot and press E to place it.', 'hammer');
    if (TUTORIAL[this.quest] && TUTORIAL[this.quest].id === 'craft') this._advanceQuest();
  }

  clockMin() { return this.time.min + this.msAcc / MS_PER_MIN; }
  _nearNpc(p, id) {
    if (!NPCS[id]) return false;
    const n = npcPos(id, this.clockMin());
    return !n.away && dist2(p.x, p.y, n.x * TS, n.y * TS) <= 80 * 80;
  }

  actBuy(p, m) {
    const k = String(m.k), n = clamp(m.n | 0, 1, 20);
    if (!SHOP_STOCK.includes(k) || !this._nearNpc(p, 'basil')) return;
    if (k === 'mat:wood') {
      const cost = WOOD_PRICE * n;
      if (this.coins < cost) return this.fail(p, 'Not enough coins.');
      this.coins -= cost; this.ev('coins', this.coins);
      this.gainMat(p, 'wood', n);
      this.evTo(p.pid, 'snd', 'coin');
      return;
    }
    const it = ITEMS[k];
    const cost = it.price * n;
    if (this.coins < cost) return this.fail(p, 'Not enough coins.');
    if (!this.hasRoom(p, k)) return this.fail(p, 'Your bag is full!');
    this.coins -= cost; this.ev('coins', this.coins);
    const got = this.gainItem(p, k, n);
    if (got < n) { this.coins += it.price * (n - got); this.ev('coins', this.coins); }
    this.evTo(p.pid, 'snd', 'coin');
  }

  actSell(p, m) {
    const slot = m.slot | 0;
    const s = p.inv[slot];
    if (!s || !this._nearNpc(p, 'basil')) return;
    const n = clamp(m.n | 0, 1, s.n);
    const price = itemSellPrice(s.k) * n;
    this.takeSlot(p, slot, n);
    this.coins += price; this.ev('coins', this.coins);
    this.evTo(p.pid, 'snd', 'coin');
  }

  actObserve(p, m) {
    const sp = SPECIES_BY_ID[m.sp];
    if (!sp || !this.visitors.some((v) => v.sp === sp.id)) return;
    const j = this.journal[sp.id];
    if (!j.seen) { j.seen = true; this.ev('jr', sp.id, j); }
    for (const q of QUESTS) {
      const st = this.side[q.id];
      if (q.kind !== 'observe' || !st || st.st !== 'on' || (q.night && !sp.night)) continue;
      st.seen = st.seen || [];
      if (!st.seen.includes(sp.id) && st.seen.length < q.n) {
        st.seen.push(sp.id); this.ev('side', this.side);
        this.toast(p, q.title + ': ' + st.seen.length + '/' + q.n + ' species' + (st.seen.length >= q.n ? ' — tell ' + NPCS[q.npc].name + '!' : ''), 'star');
      }
    }
    if (this.featured.includes(sp.id) && j.h < 3 && !this.observed[sp.id]) {
      this.observed[sp.id] = 1;
      this.giveHint(sp.id, 'obs', p);
    } else if (j.h > 0) {
      this.evTo(p.pid, 'fact', sp.id, sp.facts[Math.floor(Math.random() * sp.facts.length)]);
    } else {
      this.toast(p, 'It flew off before you got a good look. Try again tomorrow!', '');
    }
  }

  giveHint(spId, src, p) {
    const j = this.journal[spId];
    if (!j || j.h >= 3) {
      if (p) this.evTo(p.pid, 'fact', spId, SPECIES_BY_ID[spId].facts[Math.floor(Math.random() * 4)]);
      return false;
    }
    const i = j.h;
    j.h++;
    if (src === 'obs') j.seen = true;
    this.log.push({ sp: spId, i, d: dateStr(this.time), src, by: p ? p.name : '' });
    this.ev('jr', spId, j);
    this.ev('clue', spId, i, src, p ? p.pid : '', p ? p.name : '');
    if (j.h === 3) this.toastAll('Nest blueprint learned: ' + SPECIES_BY_ID[spId].name + '!', 'star');
    this.questCheck();
    return true;
  }

  dlg(p, npc, lines, opts) { this.evTo(p.pid, 'dlg', { npc, lines, opts }); }

  actTalk(p, m) {
    const id = String(m.npc);
    if (!NPCS[id] || !this._nearNpc(p, id)) return;
    const step = TUTORIAL[this.quest] ? TUTORIAL[this.quest].id : '';
    const nq = npcQuest(this, id);
    const questOpt = nq ? [{ id: 'q', label: nq.state === 'offer' ? 'Need a hand?' : 'About ' + nq.q.title + '…' }] : [];
    if (id === 'ada') {
      if (step === 'mail' || step === 'ada') {
        for (let k = 0; k < 3; k++) this.giveHint('blackbird', 'ada', null);
        this.quest = TUTORIAL.findIndex((s) => s.id === 'gather');
        this.ev('quest', this.quest);
        this._advanceQuest(true);
        return this.dlg(p, 'ada', [
          'Ah, you must be my new neighbour! Welcome to Featherbrook.',
          'Let\'s start with a familiar friend: the Eurasian Blackbird. I\'ve written its nest blueprint into your journal.',
          'Blackbirds build a cup of twigs and dry grass, plastered inside with mud. Shake trees for twigs, cut long grass in the meadows, and scoop mud from the muddy shore of your garden pond.',
          'Then find a shrub next to your lawn and press F (or right-click) on it to build the nest. The birds will do the rest!',
          'Press TAB any time to open your journal.',
        ], [{ id: 'bye', label: 'Thanks, Ada!' }]);
      }
      const tips = {
        gather: 'Twigs from shaking trees, dry grass from long grass, and mud from the muddy pond shore by your cottage.',
        build: 'Find a shrub next to your lawn and press F to build the Blackbird nest.',
        arrive: 'Now we wait. Blackbirds move in quickly when a spot is right.',
        sleep: 'A pair moved in? Wonderful! Get some rest — birds lay their eggs in the early morning.',
        craft: 'Nest boxes next! Robins like an open-fronted box; Great Tits a box with a 28 mm hole. Your workbench is beside the cottage, and you have some wood.',
        clues: 'Watch the birds you don\'t know yet: get close, stand still and press E to observe them. Field Notes with clues are scattered around too.',
      };
      const n = nestedCount(this);
      const line = tips[step] || (n >= SPECIES.length ? 'Listen to that chorus! You did it, neighbour.' :
        pick(['Hello, neighbour! The valley sounds livelier every day.', 'Good to see you! Any new birds?', 'Ah, there you are. I was just updating the survey.']));
      return this.dlg(p, 'ada', [line], questOpt.concat([
        { id: 'lead', label: 'Any leads?' }, { id: 'fact', label: 'Bird fact' },
        { id: 'progress', label: 'How are we doing?' }, { id: 'bye', label: 'Bye' }]));
    }
    if (id === 'basil') return this.dlg(p, 'basil', [pick(NPC_LINES.basil)], questOpt.concat([{ id: 'shop', label: 'Let\'s shop!' }, { id: 'bye', label: 'Bye' }]));
    if (nq) return this._questDialog(p, id, nq);
    return this.dlg(p, id, [pick(NPC_LINES[id])], [{ id: 'bye', label: 'Bye' }]);
  }

  _questDialog(p, npc, nq) {
    const q = nq.q;
    if (nq.state === 'offer') return this.dlg(p, npc, q.ask, [{ id: 'qa', label: 'I\'ll help!' }, { id: 'bye', label: 'Not now' }]);
    if (nq.state === 'active') {
      const prog = q.n > 1 ? ' (' + questProgress(this, q) + '/' + q.n + ')' : '';
      return this.dlg(p, npc, ['Any luck? ' + q.hint + prog], [{ id: 'bye', label: 'I\'m on it!' }]);
    }
    const give = q.kind === 'bring' ? 'Hand over ' + q.n + ' ' + MATS[q.mat].name.toLowerCase() : q.kind === 'find' ? 'Here you go!' : 'All done!';
    return this.dlg(p, npc, [q.kind === 'find' ? 'Oh! Did you find it?' : 'How did it go?'], [{ id: 'qc', label: give }, { id: 'bye', label: 'Later' }]);
  }

  acceptQuest(p, q) {
    if (this.side[q.id]) return;
    this.side[q.id] = { st: 'on', n: 0, seen: [], d: dayIdx(this.time) };
    if (q.kind === 'find') this._spawnQuestItems(q);
    this.ev('side', this.side);
    this.toastAll('New quest: ' + q.title + ' (' + NPCS[q.npc].name + ')', 'star');
    this.ev('snd', 'clue');
  }

  _spawnQuestItems(q) {
    const left = q.n - (this.side[q.id].n || 0);
    for (let k = 0; k < left; k++) {
      const test = q.shore ? (x, y, t) => t !== T.PATH && nearWater(this, x, y, 1) : (x, y, t) => t !== T.PATH;
      const xy = this._randIn(q.area, test, 400) || this._randIn(q.area, null, 400);
      if (xy) this.addObj({ type: 'qitem', kind: q.item, q: q.id, x: xy[0], y: xy[1] });
    }
  }

  completeQuest(p, q) {
    const st = this.side[q.id];
    if (!st || st.st !== 'on' || !questReady(this, q)) return;
    if (q.kind === 'bring') { if (!this.hasMats({ [q.mat]: q.n })) return; this.takeMats({ [q.mat]: q.n }); }
    st.st = 'done';
    this.ev('side', this.side);
    const r = q.reward || {}, src = [p.x, p.y - 20];
    const got = [];
    if (r.coins) { this.coins += r.coins; this.ev('coins', this.coins); got.push(r.coins + ' coins'); }
    for (const k in r.items || {}) { this.gainItem(p, k, r.items[k], src); got.push(r.items[k] + '× ' + ITEMS[k].name); }
    for (const k in r.mats || {}) { this.gainMat(p, k, r.mats[k], src); got.push(r.mats[k] + ' ' + MATS[k].name.toLowerCase()); }
    this.dlg(p, q.npc, q.thanks.concat(got.length ? ['(You received ' + got.join(', ') + '.)'] : []), [{ id: 'bye', label: 'You\'re welcome!' }]);
    if (r.clue) {
      const ut = unlockedTier(this);
      const cands = SPECIES.filter((s) => s.tier <= ut && this.journal[s.id].h < 3 && s.site !== 'parasite' && (r.clue !== 'night' || s.night));
      const sp = cands.length ? cands.sort((a, b) => this.journal[b.id].h - this.journal[a.id].h)[0] : null;
      if (sp) this.giveHint(sp.id, 'quest', p);
    }
    this.toastAll('Quest complete: ' + q.title + '!', 'star');
    this.ev('snd', 'fanfare');
  }

  actOpt(p, m) {
    const id = String(m.npc), o = String(m.o);
    if (!NPCS[id] || !this._nearNpc(p, id)) return;
    const nq = npcQuest(this, id);
    if (o === 'q') return nq ? this._questDialog(p, id, nq) : undefined;
    if (o === 'qa') return nq && nq.state === 'offer' ? this.acceptQuest(p, nq.q) : undefined;
    if (o === 'qc') return nq && nq.state === 'ready' ? this.completeQuest(p, nq.q) : undefined;
    if (id !== 'ada') return;
    const back = [{ id: 'lead', label: 'Any leads?' }, { id: 'fact', label: 'Another fact!' }, { id: 'bye', label: 'Bye' }];
    if (o === 'fact') return this.dlg(p, 'ada', [pick(BIRD_FACTS)], back);
    if (o === 'progress') {
      const n = nestedCount(this);
      const known = SPECIES.filter((s) => this.journal[s.id].h >= 3 && this.journal[s.id].n === 0 && s.site !== 'parasite').length;
      return this.dlg(p, 'ada', [n + ' of ' + SPECIES.length + ' species have nested in the valley. ' +
        (known ? 'You know how to build nests for ' + known + ' more — check the journal for what they need!' : 'Find more clues to learn new nests!')], back);
    }
    if (o === 'lead') {
      const today = dayIdx(this.time);
      if (this.adaDay === today) return this.dlg(p, 'ada', ['That\'s all I know today. Watch birds closely and look for Field Notes — they turn up near each bird\'s favourite habitat.'], back);
      const cand = this.featured.find((s) => this.journal[s].h < 3);
      if (!cand) return this.dlg(p, 'ada', ['No new leads right now. Help more species nest and new birds will come to the valley!'], back);
      this.adaDay = today;
      const sp = SPECIES_BY_ID[cand];
      const i = this.journal[cand].h;
      this.giveHint(cand, 'ada', p);
      return this.dlg(p, 'ada', ['I\'ve been hearing about a bird around ' + ZONES_LABEL[sp.zone] + '…', '"' + sp.hints[i] + '"'], back);
    }
  }

  actMail(p, m) {
    const l = this.mail.find((x) => x.id === (m.id | 0));
    if (!l || l.read) return;
    l.read = true;
    this.ev('mailr', l.id);
    if (TUTORIAL[this.quest] && TUTORIAL[this.quest].id === 'mail') this._advanceQuest();
  }

  actSwap(p, m) {
    const i = m.i | 0, j = m.j | 0;
    if (i < 0 || j < 0 || i >= BAG_SIZE || j >= BAG_SIZE || i === j) return;
    const a = p.inv[i], b = p.inv[j];
    if (a && b && a.k === b.k) {
      const mv = Math.min(a.n, STACK_MAX - b.n);
      b.n += mv; a.n -= mv;
      if (a.n <= 0) p.inv[i] = null;
    } else { p.inv[i] = b; p.inv[j] = a; }
    this.evTo(p.pid, 'inv', p.inv);
  }

  actTrash(p, m) {
    const i = m.i | 0;
    if (!p.inv[i]) return;
    p.inv[i] = null;
    this.evTo(p.pid, 'inv', p.inv);
  }

  actSleep(p, m) {
    if (m.v) {
      const c = Array.from(this.objs.values()).find((o) => o.type === 'building' && o.kind === 'cottage');
      if (!c || !this.reachObj(p, c, 16)) return;
      p.sleep = true;
    } else p.sleep = false;
    this.ev('pp', p.pid, { sleep: p.sleep });
    this._sleepStatus();
    this._maybeSleep();
  }

  _sleepStatus() {
    let n = 0;
    for (const q of this.players.values()) if (q.sleep) n++;
    this.ev('slp', n, this.players.size);
  }

  _maybeSleep() {
    if (!this.players.size) return;
    for (const q of this.players.values()) if (!q.sleep) return;
    this.newDay();
  }

  actChat(p, m) {
    const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120);
    if (!text) return;
    this.ev('chat', p.name, text, p.look);
  }

  actLook(p, m) {
    if (m.name) p.name = cleanName(m.name) || p.name;
    if (m.look) p.look = cleanLook(m.look);
    this.ev('pp', p.pid, { name: p.name, look: p.look });
  }

  // ---------------------------------------------------------------- mail & quests
  sendMail(letter) {
    const l = { id: this.mailSeq++, from: letter.from, title: letter.title, body: letter.body, read: false, d: dateStr(this.time) };
    this.mail.push(l);
    if (this.mail.length > 60) this.mail.shift();
    this.ev('mail', l);
  }

  questCheck() { this._advanceQuest(true); }

  _advanceQuest(checkOnly) {
    let changed = false;
    for (let guard = 0; guard < 10; guard++) {
      const s = TUTORIAL[this.quest];
      if (!s) break;
      let done = false;
      if (!checkOnly) { done = true; checkOnly = true; }
      else if (s.id === 'gather') done = this.mats.twig >= 2 && this.mats.grass >= 3 && this.mats.mud >= 2 || this._hasNest('blackbird');
      else if (s.id === 'build') done = this._hasNest('blackbird');
      else if (s.id === 'arrive') done = this._hasNest('blackbird', true);
      else if (s.id === 'clues') done = SPECIES.some((sp) => sp.id !== 'blackbird' && this.journal[sp.id].h >= 3);
      if (!done) break;
      this.quest++;
      changed = true;
      if (s.id === 'build') this.toastAll('Now wait for the birds — they\'re checking it out.', 'heart');
    }
    if (changed) {
      this.ev('quest', this.quest);
      if (this.quest >= TUTORIAL.length) this.toastAll('Tutorial complete! Follow your leads in the journal (TAB).', 'star');
    }
  }

  _hasNest(sp, occupied) {
    for (const o of this.objs.values()) {
      if (o.type !== 'nest' || o.kind !== sp) continue;
      if (!occupied || (o.st !== 'built' && o.st !== 'cock')) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- nesting
  checkArrivals() {
    const m = this.time.min;
    for (const n of Array.from(this.objs.values())) {
      if (n.type !== 'nest') continue;
      const sp = SPECIES_BY_ID[n.kind];
      if (n.st === 'built') {
        if (!n.arr) {
          const [cx, cy] = nestCenter(this, n);
          if (!evalNest(this, sp, cx, cy, n.id).ok) continue;
          if (!sp.night && m >= 20 * 60) continue;
          const tutorial = TUTORIAL[this.quest] && TUTORIAL[this.quest].id === 'arrive' && sp.id === 'blackbird';
          n.arr = m + (tutorial ? 10 : randInt(Math.random, 20, 80));
          this.touch(n, ['arr']);
        } else if (m >= n.arr) {
          const [cx, cy] = nestCenter(this, n);
          if (!evalNest(this, sp, cx, cy, n.id).ok) { n.arr = 0; this.touch(n, ['arr']); continue; }
          this._arrive(n, sp);
        }
      }
    }
    this._checkWren();
  }

  _arrive(n, sp) {
    n.st = 'pair'; n.arr = 0;
    n.cl = randInt(Math.random, sp.clutch[0], sp.clutch[1]);
    this.touch(n, ['st', 'arr', 'cl']);
    this.toastAll('A pair of ' + sp.name + 's moved into the nest!', 'heart');
    this.ev('fx', 'hearts', n.id, 0, 0);
    this.ev('snd', 'arrive', 0, 0);
    this.questCheck();
  }

  _checkWren() {
    const cocks = [];
    for (const o of this.objs.values()) if (o.type === 'nest' && o.kind === 'wren' && o.st === 'cock') cocks.push(o);
    if (cocks.length < 2) return;
    const sp = SPECIES_BY_ID.wren;
    for (const a of cocks) for (const b of cocks) {
      if (a === b) continue;
      const ca = nestCenter(this, a), cb = nestCenter(this, b);
      if (dist2(ca[0], ca[1], cb[0], cb[1]) > 100) continue;
      if (!evalNest(this, sp, ca[0], ca[1], a.id).ok) continue;
      const chosen = Math.random() < 0.5 ? a : b;
      chosen.st = 'lining';
      this.touch(chosen, ['st']);
      this.toastAll('A female Wren inspected the cock nests and chose one! Line it with 2 feathers.', 'heart');
      this.ev('fx', 'hearts', chosen.id, 0, 0);
      return;
    }
  }

  _progressNests(sum) {
    const season = this.time.season;
    for (const n of Array.from(this.objs.values())) {
      if (n.type !== 'nest') continue;
      const sp = SPECIES_BY_ID[n.kind];
      switch (n.st) {
        case 'built': {
          const [cx, cy] = nestCenter(this, n);
          if (evalNest(this, sp, cx, cy, n.id).ok) {
            n.st = 'pair'; n.arr = 0; n.cl = randInt(Math.random, sp.clutch[0], sp.clutch[1]);
            sum.push(['heart', 'A pair of ' + sp.name + 's moved into a nest at dawn.']);
          }
          break;
        }
        case 'pair':
          n.st = 'eggs'; n.t = 0; n.eggs = Math.max(1, Math.ceil(n.cl / 2));
          sum.push(['egg', sp.name + 's laid their first eggs.']);
          break;
        case 'eggs':
          n.t++;
          if (n.t >= sp.incub) {
            n.st = 'chicks'; n.t = 0;
            if (n.cu) {
              n.ch = 1; n.eggs = 0;
              sum.push(['egg', 'The cuckoo chick hatched first and pushed the warblers\' eggs out of the nest. Its foster parents are raising it as their own.']);
            } else {
              n.ch = n.cl || n.eggs; n.eggs = 0;
              sum.push(['chick', n.ch + ' ' + sp.name + ' chicks hatched!']);
            }
          } else if (n.t === 1) {
            n.eggs = n.cl || n.eggs;
            sum.push(['egg', 'A ' + sp.name + ' clutch is complete: ' + plural(n.eggs, 'egg') + '.']);
          }
          break;
        case 'chicks':
          n.t++;
          if (n.t >= sp.nestling) { n.st = 'fledged'; n.t = 0; this._fledge(n, sum); }
          break;
        case 'fledged':
          n.st = 'old'; n.t = 0; n.ch = 0; n.cu = 0;
          break;
        case 'old':
          n.t++;
          if (sp.reuse && n.t >= 2 && sp.breed.includes(season)) { n.st = 'built'; n.t = 0; n.arr = 0; sum.push(['nest', sp.name + 's are refurbishing their old nest.']); }
          break;
      }
    }
    // cuckoo
    const cu = this.journal.cuckoo, rw = this.journal.reedwarbler;
    if (cu.h >= 3 && rw.n > 0 && SPECIES_BY_ID.cuckoo.breed.includes(season)) {
      const c = [];
      for (const o of this.objs.values()) if (o.type === 'nest' && o.kind === 'reedwarbler' && o.st === 'eggs' && o.t <= 1 && !o.cu) c.push(o);
      if (c.length && Math.random() < 0.85) {
        const n = pick(c);
        n.cu = 1;
        sum.push(['star', 'A Common Cuckoo secretly laid an egg in a Reed Warbler nest!']);
      }
    }
  }

  _fledge(n, sum) {
    const id = n.cu ? 'cuckoo' : n.kind;
    const sp = SPECIES_BY_ID[id];
    const j = this.journal[id];
    j.n++;
    this.stats.fledged++;
    if (j.n === 1) {
      j.first = dateStr(this.time);
      if (j.h < 3) j.h = 3;
      const grant = 100 + 40 * sp.tier;
      this.coins += grant;
      sum.newSpecies.push(id);
      sum.push(['star', 'NEW SPECIES NESTED: ' + sp.name + '! (+' + grant + ' coins grant)']);
      this.sendMail(nestedLetter(sp, grant));
      if (nestedCount(this) >= SPECIES.length && !this.allDone) { this.allDone = true; this.sendMail(LETTERS.allDone); }
    } else {
      this.coins += 25;
      sum.push(['chick', 'Another brood of ' + sp.name + 's fledged. (+25 coins)']);
    }
  }

  _checkTier() {
    const t = unlockedTier(this);
    while (this.tierSent < t) {
      this.tierSent++;
      const l = LETTERS['tier' + this.tierSent];
      if (l) this.sendMail(l);
    }
  }

  // ---------------------------------------------------------------- days
  rollWeather() {
    const di = dayIdx(this.time);
    if (di === 0) return 'sun';
    const r = hashf(di, 77, this.seed);
    const s = this.time.season;
    const wet = [0.3, 0.2, 0.35, 0.3][s];
    if (r < wet) return s === WINTER ? 'snow' : 'rain';
    if (r < wet + 0.2) return 'cloud';
    return 'sun';
  }

  newDay() {
    const sum = [];
    sum.newSpecies = [];
    const prevWeather = this.weather;
    this.bulk = true;
    const t = this.time;
    t.day++;
    let seasonChanged = false;
    if (t.day > DAYS_PER_SEASON) { t.day = 1; t.season = (t.season + 1) % 4; if (t.season === SPRING) t.year++; seasonChanged = true; }
    t.min = DAY_START;
    this.msAcc = 0;
    this.stats.days++;
    this.weather = this.rollWeather();
    const season = t.season;

    // growth
    let grew = 0;
    for (const o of this.objs.values()) {
      const f = FLORA[o.kind];
      if (!f || !(o.type === 'tree' || o.type === 'shrub' || o.type === 'plant')) continue;
      if (f.grow && o.st < 2 && (season !== WINTER || f.conifer)) {
        o.g = (o.g || 0) + 1 + (prevWeather === 'rain' ? 1 : 0);
        if (o.g >= f.grow[o.st]) { o.st++; o.g = 0; if (o.pl) grew++; }
      }
      if (f.fruit) {
        if (f.fruit.seasons.includes(season) && o.st >= 2) { if (!o.fr && Math.random() < 0.6) o.fr = 1 + (Math.random() < 0.5 ? 1 : 0); }
        else o.fr = 0;
      }
    }
    if (grew) sum.push(['leaf', grew + (grew === 1 ? ' plant you planted has grown.' : ' plants you planted have grown.')]);
    // grass regrowth
    const gp = season === WINTER ? 0.15 : 0.55;
    for (let i = 0; i < this.grass.length; i++) {
      if (!this.wild[i] || this.grass[i] >= 2) continue;
      const tt = this.tiles[i];
      if (tt !== T.GRASS && tt !== T.MARSH) continue;
      if (Math.random() < gp) this.grass[i]++;
    }
    // moss, lichen
    for (const o of this.objs.values()) {
      if (o.type === 'rock' && o.kind === 'mossy' && o.moss < 2) o.moss = Math.min(2, o.moss + (prevWeather === 'rain' ? 2 : 1));
      if (o.type === 'rock' && o.kind === 'boulder' && o.li < 2 && Math.random() < 0.5) o.li++;
      if ((o.type === 'log' && o.moss < 2) || (o.type === 'stump' && o.moss < 1)) if (Math.random() < (prevWeather === 'rain' ? 0.9 : 0.5)) o.moss++;
    }
    // nests
    this._progressNests(sum);
    if (seasonChanged) this.sendMail(LETTERS[SEASONS[season]]);
    this._checkTier();
    this.startDay();
    // wake everyone at home
    let k = 0;
    for (const p of this.players.values()) {
      p.sleep = false;
      p.x = HOME_SPAWN[0] + (k % 3 - 1) * 14; p.y = HOME_SPAWN[1] + Math.floor(k / 3) * 10; p.d = 0;
      k++;
    }
    if (TUTORIAL[this.quest] && TUTORIAL[this.quest].id === 'sleep') this.quest++;
    this.bulk = false;
    this.pendAll = [];
    this.pendTo.clear();
    if (this.onSave) this.onSave();
    const summary = { date: dateStr(this.time), weather: this.weather, lines: sum.slice(0, 14), newSpecies: sum.newSpecies, season: season };
    for (const p of this.players.values()) {
      this.out && this.out.send(p.pid, { t: 'welcome', snap: this.snapshotFor(p.pid), day: summary });
    }
  }

  startDay() {
    const today = dayIdx(this.time);
    for (const o of Array.from(this.objs.values())) {
      if (o.type === 'web') this.removeObj(o);
      else if (o.type === 'puddle' && today - o.d >= 2) this.removeObj(o);
      else if (o.type === 'forage' && (o.kind === 'note' || today - (o.d || 0) > 4)) this.removeObj(o);
    }
    for (const k in this.dug) if (this.dug[k] !== today) delete this.dug[k];
    this.observed = {};
    this._spawnForage(today);
    this.pickFeatured();
  }

  _freeLand(x, y) {
    if (!inBounds(x, y) || x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return false;
    const i = tIdx(x, y), t = this.tiles[i];
    if (this.occ[i] || !TINFO[t].land) return false;
    const arr = this.byTile.get(i);
    return !arr || arr.length === 0;
  }

  _randIn(rect, test, tries) {
    for (let k = 0; k < (tries || 60); k++) {
      const x = rect[0] + Math.floor(Math.random() * (rect[2] - rect[0] + 1));
      const y = rect[1] + Math.floor(Math.random() * (rect[3] - rect[1] + 1));
      if (this._freeLand(x, y) && (!test || test(x, y, this.tiles[tIdx(x, y)]))) return [x, y];
    }
    return null;
  }

  _spawnAt(kind, xy, extra) {
    if (!xy) return;
    const o = Object.assign({ type: 'forage', kind, x: xy[0], y: xy[1], d: dayIdx(this.time) }, extra || {});
    this.addObj(o);
  }

  _spawnForage(today) {
    const season = this.time.season;
    const counts = {};
    let webs = 0;
    const trees = [], shrubsFences = [];
    for (const o of this.objs.values()) {
      if (o.type === 'forage') counts[o.kind] = (counts[o.kind] || 0) + 1;
      if (o.type === 'tree' && o.st >= 2 && o.kind !== 'snag') trees.push(o);
      if ((o.type === 'shrub' && o.st >= 1) || o.type === 'fence') shrubsFences.push(o);
      if (o.type === 'web') webs++;
    }
    const adj = (o) => {
      for (let k = 0; k < 8; k++) {
        const x = o.x + randInt(Math.random, -1, 1), y = o.y + randInt(Math.random, -1, 1);
        if (this._freeLand(x, y) && this.tiles[tIdx(x, y)] !== T.PATH) return [x, y];
      }
      return null;
    };
    const need = (kind, max, per) => Math.max(0, Math.min(per, max - (counts[kind] || 0)));
    // twigs under any tree
    for (let k = need('twig', 26, 10); k > 0; k--) this._spawnAt('twig', adj(pick(trees)), { q: Math.random() < 0.3 ? 2 : 1 });
    const forestTrees = trees.filter((o) => o.y < 16 && o.kind === 'oak');
    for (let k = need('stick', 16, 6); k > 0; k--) this._spawnAt('stick', adj(pick(forestTrees.length ? forestTrees : trees)));
    const forestRect = ZONES.forest;
    const isForest = (x, y, t) => t === T.FOREST;
    const leafMax = season === AUTUMN ? 30 : season === WINTER ? 6 : 14;
    for (let k = need('leaves', leafMax, season === AUTUMN ? 14 : 6); k > 0; k--) this._spawnAt('leaves', this._randIn(forestRect, isForest));
    for (let k = need('feather', 14, 7); k > 0; k--) {
      const r = Math.random();
      const rect = r < 0.55 ? [12, 25, 20, 30] : r < 0.8 ? [14, 50, 34, 66] : forestRect;
      this._spawnAt('feather', this._randIn(rect, (x, y, t) => t !== T.PATH));
    }
    for (let k = need('stone', 14, 6); k > 0; k--) this._spawnAt('stone', this._randIn(ZONES.hills, (x, y, t) => t === T.ROCK || t === T.GRAVEL));
    for (let k = need('driftwood', 5, 3); k > 0; k--) {
      const shore = this.riverside.filter(([x, y]) => this._freeLand(x, y) && nearWater(this, x, y, 1));
      if (shore.length) this._spawnAt('driftwood', pick(shore));
    }
    if (season === SPRING || season === AUTUMN) {
      for (let k = need('mushroom', 8, this.weather === 'rain' ? 5 : 3); k > 0; k--) this._spawnAt('mushroom', this._randIn(forestRect, isForest));
    }
    if (season === SPRING) for (let k = need('garlic', 6, 3); k > 0; k--) this._spawnAt('garlic', this._randIn(forestRect, isForest));
    // spider webs (morning dew) — most in autumn, none in winter
    const webN = season === WINTER ? 0 : season === AUTUMN ? 12 : 7;
    for (let k = webs; k < webN && shrubsFences.length; k++) {
      const o = pick(shrubsFences);
      if (objsOnTile(this, o.x, o.y).some((q) => q.type === 'web')) continue;
      this.addObj({ type: 'web', kind: 'orb', x: o.x, y: o.y, d: today });
    }
    // puddles after rain
    if (this.weather === 'rain') {
      for (let k = 0; k < 12; k++) {
        const rect = pick([ZONES.garden, ZONES.farm, ZONES.village, ZONES.garden, ZONES.orchard]);
        const xy = this._randIn(rect, (x, y, t) => (t === T.PATH || t === T.GRASS));
        if (xy) this.addObj({ type: 'puddle', kind: 'mud', x: xy[0], y: xy[1], q: 3, d: today });
      }
    }
  }

  pickFeatured() {
    const ut = unlockedTier(this);
    const season = this.time.season;
    const cands = SPECIES.filter((s) => s.tier <= ut && this.journal[s.id].n === 0 && this.journal[s.id].h < 3 && s.id !== 'blackbird');
    cands.sort((a, b) => (a.tier - b.tier) || (this.journal[b.id].h - this.journal[a.id].h) || (Math.random() - 0.5));
    const feat = cands.slice(0, 2);
    const rest = cands.slice(2);
    if (rest.length) feat.push(pick(rest));
    this.featured = feat.map((s) => s.id);
    const vis = [];
    for (const s of feat) if (s.present.includes(season)) vis.push({ sp: s.id, role: 'lead' });
    for (const s of SPECIES) {
      const j = this.journal[s.id];
      if (vis.some((v) => v.sp === s.id) || !s.present.includes(season)) continue;
      if (j.n > 0) vis.push({ sp: s.id, role: 'res' });
      else if (j.h >= 3) vis.push({ sp: s.id, role: 'known' });
    }
    this.visitors = vis;
    // field notes in each featured species' habitat
    for (const s of feat) {
      if (this.journal[s.id].h >= 3) continue;
      let xy = null;
      if (s.zone === 'river') {
        const sh = this.riverside.filter(([x, y]) => this._freeLand(x, y));
        if (sh.length) xy = pick(sh);
      } else xy = this._randIn(ZONES[s.zone], (x, y, t) => t !== T.PATH, 120);
      if (xy) this.addObj({ type: 'forage', kind: 'note', sp: s.id, x: xy[0], y: xy[1], d: dayIdx(this.time) });
    }
    this.ev('vis', this.visitors, this.featured);
  }
}

// ---------------------------------------------------------------- helpers
function starterInventory() {
  const inv = new Array(BAG_SIZE).fill(null);
  inv[0] = { k: 'seed_wildflower', n: 5 };
  inv[1] = { k: 'cut_hawthorn', n: 1 };
  return inv;
}

function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14);
}

function publicPlayer(p) { return { pid: p.pid, name: p.name, look: p.look, x: Math.round(p.x), y: Math.round(p.y), d: p.d, sleep: p.sleep }; }
function publicAnimal(a) { return [a.id, a.kind, Math.round(a.x), Math.round(a.y), a.d, a.m]; }
