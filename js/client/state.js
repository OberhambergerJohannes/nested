'use strict';
// Client-side mirror of the world. Built from a snapshot and kept current by host events.
// It has the same shape as the World (tiles, grass, objs, occ, byTile, time, ...) so the
// shared rule functions work on both.

class ClientState {
  constructor() {
    this.objs = new Map();
    this.occ = new Int32Array(MAP_W * MAP_H);
    this.byTile = new Map();
    this.players = new Map();
    this.animals = new Map();
    this.dirtyTiles = new Set();
    this.grassDirty = new Set();  // tiles whose grass tufts must be redrawn
    this.allDirty = true;
    this.clockMs = 0;
    this.objVer = 0;              // bumps whenever an object is added or removed
    this.nestVer = 0;             // bumps whenever a nest changes
  }

  loadSnap(s) {
    // remember the old terrain, so a new morning only repaints what actually changed
    const prev = this.tiles ? { tiles: this.tiles, grass: this.grass, occ: this.occ, season: this.time && this.time.season, key: this.seed + '|' + this.name, shadow: this._shadowSig() } : null;
    this.name = s.name; this.seed = s.seed; this.me = s.you; this.mpm = s.mpm || MS_PER_MIN;
    this.tiles = b64decode(s.tiles);
    this.grass = b64decode(s.grass);
    this.objs = new Map();
    this.occ = new Int32Array(MAP_W * MAP_H);
    this.byTile = new Map();
    for (const o of s.objs) idxAdd(this, o);
    this.objVer++;
    this.time = s.time; this.weather = s.weather; this.coins = s.coins; this.mats = s.mats;
    this.journal = s.journal; this.log = s.log || []; this.mail = s.mail || []; this.quest = s.quest;
    this.visitors = s.visitors || []; this.featured = s.featured || [];
    this.dug = s.dug || {};
    this.inv = s.inv || [];
    this.side = s.side || {};
    this.found = s.found || {};
    this.prog = s.prog || { xp: 0, lvl: 1, fr: {}, hev: {}, gift: {}, lvlUps: [] };
    this.badges = s.badges || {};
    this.board = s.board || [];
    this.rareLog = s.rareLog || {};
    this.stats = s.stats || {};
    this.allDone = !!s.allDone;
    this.fest = s.fest || null;
    this.festLog = s.festLog || {};
    npcFestival(this.time);
    const old = this.players;
    this.players = new Map();
    for (const p of s.players) {
      const prev = old.get(p.pid);
      this.players.set(p.pid, Object.assign({ tx: p.x, ty: p.y, m: 0, a: '', walkT: 0 }, prev || {}, p, { tx: p.x, ty: p.y }));
    }
    this.animals = new Map();
    for (const a of s.animals || []) this._animal(a);
    this.sleepN = 0; this.sleepTotal = this.players.size;
    const same = prev && !this.allDirty && prev.key === this.seed + '|' + this.name && prev.season === this.time.season && prev.tiles.length === this.tiles.length;
    if (same) {
      const shadow = this._shadowSig();
      for (let i = 0; i < this.tiles.length; i++) {
        if (prev.tiles[i] !== this.tiles[i]) this.markTile(i);
        else if (prev.grass[i] !== this.grass[i] || !prev.occ[i] !== !this.occ[i]) this.markDecal(i);
        if (prev.shadow[i] !== shadow[i]) { this.markDecal(i); if (i % MAP_W) this.markDecal(i - 1); if ((i + 1) % MAP_W) this.markDecal(i + 1); }
      }
    } else this.allDirty = true;
    this.clockMs = 0;
  }

  _animal(a) {
    const [id, kind, x, y, d, m] = a;
    let an = this.animals.get(id);
    if (!an) { an = { id, kind, x, y, tx: x, ty: y, d, m, t: Math.random() * 1000, brown: hashf(id.length, id.charCodeAt(1), 3) < 0.4 }; this.animals.set(id, an); }
    an.tx = x; an.ty = y; an.d = d; an.m = m;
  }

  get meP() { return this.players.get(this.me); }

  onPositions(msg) {
    for (const [pid, x, y, d, m, a, sl] of msg.p) {
      const p = this.players.get(pid);
      if (!p) continue;
      p.sleep = !!sl;
      if (pid === this.me) continue;
      p.tx = x; p.ty = y; p.d = d; p.m = m; p.a = a;
    }
    if (msg.a) for (const a of msg.a) this._animal(a);
  }

  markTile(i) { this.dirtyTiles.add(i); this.markDecal(i); }
  markDecal(i) { this.grassDirty.add(i); }
  // tiles whose ground look depends on this object (its footprint, plus the tiles its shadow reaches)
  _markObj(o) {
    const [w, h] = footprint(o);
    for (let dy = 0; dy < h; dy++) for (let dx = -1; dx <= w; dx++) if (inBounds(o.x + dx, o.y + dy)) this.markDecal(tIdx(o.x + dx, o.y + dy));
  }
  _shadowSig() {
    const sig = new Uint8Array(MAP_W * MAP_H);
    for (const o of this.objs.values()) { const r = staticShadow(o); if (r && inBounds(o.x, o.y)) sig[tIdx(o.x, o.y)] = r; }
    return sig;
  }
  // Nests that aren't old yet (cached until objects or nests change)
  activeNests() {
    const key = this.objVer + ':' + this.nestVer;
    if (this._anKey !== key) {
      this._an = []; this._anKinds = new Set();
      for (const o of this.objs.values()) if (o.type === 'nest' && o.st !== 'old') { this._an.push(o); this._anKinds.add(o.kind); }
      this._anKey = key;
    }
    return this._an;
  }
  hasActiveNest(kind) { this.activeNests(); return this._anKinds.has(kind); }
  // First object of a type & kind (cached until objects change)
  first(type, kind) {
    if (this._fiVer !== this.objVer) { this._fi = new Map(); this._fiVer = this.objVer; }
    const k = type + ':' + kind;
    let o = this._fi.get(k);
    if (o === undefined) {
      o = null;
      for (const q of this.objs.values()) if (q.type === type && q.kind === kind) { o = q; break; }
      this._fi.set(k, o);
    }
    return o;
  }

  // Returns a list of "notes" the game layer reacts to (sounds, popups, ...)
  apply(evs, game) {
    this.evVer = (this.evVer || 0) + 1; // anything the HUD shows may have changed
    for (const e of evs) {
      switch (e[0]) {
        case 'oa': {
          const o = e[1];
          const old = this.objs.get(o.id);
          if (old) { idxRemove(this, old); this._markObj(old); }
          idxAdd(this, o);
          this._markObj(o);
          this.objVer++;
          game.onObjAdded(o);
          break;
        }
        case 'ou': {
          const o = this.objs.get(e[1]);
          if (!o) break;
          const prevSt = o.st;
          Object.assign(o, e[2]);
          if (o.type === 'nest') this.nestVer++;
          if (e[2].st !== undefined && e[2].st !== prevSt && staticShadow(o)) this._markObj(o); // grown: bigger shadow
          game.onObjUpdated(o, e[2], prevSt);
          break;
        }
        case 'or': {
          const o = this.objs.get(e[1]);
          if (o) { idxRemove(this, o); this._markObj(o); this.objVer++; game.onObjRemoved(o); }
          break;
        }
        case 'tile': this.tiles[e[1]] = e[2]; this.markTile(e[1]); break;
        case 'gr': this.grass[e[1]] = e[2]; this.markDecal(e[1]); break;
        case 'dug': this.dug[e[1]] = e[2]; break;
        case 'time': {
          const prevSeason = this.time.season;
          this.time = e[1]; this.weather = e[2]; this.clockMs = 0;
          npcFestival(this.time);
          if (prevSeason !== this.time.season) this.allDirty = true;
          break;
        }
        case 'coins': game.onCoins(e[1] - this.coins); this.coins = e[1]; break;
        case 'mats': Object.assign(this.mats, e[1]); break;
        case 'inv': this.inv = e[1]; game.onInv(); break;
        case 'jr': this.journal[e[1]] = e[2]; break;
        case 'clue':
          this.log.push({ sp: e[1], i: e[2], d: dateStr(this.time), src: e[3], by: e[5] });
          game.onClue(e[1], e[2], e[3], e[4], e[5]);
          break;
        case 'toast': game.toast(e[1], e[2]); break;
        case 'fx': game.onFx(e[1], e[2], e[3], e[4]); break;
        case 'snd': if (e[2] || e[3]) Audio2.sfx(e[1], e[2], e[3]); else Audio2.sfx(e[1]); break;
        case 'gain': game.onGain(e[1], e[2], e[3], e[4]); break;
        case 'pj': {
          const p = e[1];
          const prev = this.players.get(p.pid);
          this.players.set(p.pid, Object.assign(prev || { m: 0, a: '', walkT: 0 }, p, { tx: p.x, ty: p.y }));
          break;
        }
        case 'pq': this.players.delete(e[1]); break;
        case 'pp': { const p = this.players.get(e[1]); if (p) Object.assign(p, e[2]); break; }
        case 'chat': game.onChat(e[1], e[2]); break;
        case 'slp': this.sleepN = e[1]; this.sleepTotal = e[2]; break;
        case 'dlg': game.onDialogue(e[1]); break;
        case 'fact': game.onFact(e[1], e[2]); break;
        case 'mail': this.mail.push(e[1]); if (this.mail.length > 60) this.mail.shift(); game.onMail(e[1]); break;
        case 'mailr': { const l = this.mail.find((m) => m.id === e[1]); if (l) l.read = true; break; }
        case 'quest': this.quest = e[1]; break;
        case 'vis': this.visitors = e[1]; this.featured = e[2]; game.onVisitors(); break;
        case 'tp': game.onTeleport(e[1], e[2]); break;
        case 'side': this.side = e[1]; break;
        case 'prog': this.prog = e[1]; break;
        case 'mpm': this.clockMs = this.clockMs * e[1] / (this.mpm || MS_PER_MIN); this.mpm = e[1]; break;
        case 'xp': game.onXP(e[1], e[2]); break;
        case 'lvl': game.onLevel(e[1], e[2]); break;
        case 'badges': this.badges = e[1]; break;
        case 'board': this.board = e[1]; break;
        case 'stats': this.stats = e[1]; break;
        case 'rare': this.rareLog = e[1]; break;
        case 'found': this.found = e[1]; this.mapDirty = true; break;
        case 'lore': game.onLore(e[1], e[2]); break;
        case 'fest': this.fest = e[1]; break;
        case 'festlog': this.festLog = e[1]; break;
      }
    }
  }

  // Interpolated game clock (minutes) between authoritative updates
  clock() { return this.time.min + this.clockMs / (this.mpm || MS_PER_MIN); }
}
