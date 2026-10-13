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
    this.allDirty = true;
    this.clockMs = 0;
  }

  loadSnap(s) {
    this.name = s.name; this.seed = s.seed; this.me = s.you;
    this.tiles = b64decode(s.tiles);
    this.grass = b64decode(s.grass);
    this.objs = new Map();
    this.occ = new Int32Array(MAP_W * MAP_H);
    this.byTile = new Map();
    for (const o of s.objs) idxAdd(this, o);
    this.time = s.time; this.weather = s.weather; this.coins = s.coins; this.mats = s.mats;
    this.journal = s.journal; this.log = s.log || []; this.mail = s.mail || []; this.quest = s.quest;
    this.visitors = s.visitors || []; this.featured = s.featured || [];
    this.dug = s.dug || {};
    this.inv = s.inv || [];
    this.side = s.side || {};
    this.found = s.found || {};
    this.stats = s.stats || {};
    this.allDone = !!s.allDone;
    const old = this.players;
    this.players = new Map();
    for (const p of s.players) {
      const prev = old.get(p.pid);
      this.players.set(p.pid, Object.assign({ tx: p.x, ty: p.y, m: 0, a: '', walkT: 0 }, prev || {}, p, { tx: p.x, ty: p.y }));
    }
    this.animals = new Map();
    for (const a of s.animals || []) this._animal(a);
    this.sleepN = 0; this.sleepTotal = this.players.size;
    this.allDirty = true;
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

  markTile(i) { this.dirtyTiles.add(i); }

  // Returns a list of "notes" the game layer reacts to (sounds, popups, ...)
  apply(evs, game) {
    for (const e of evs) {
      switch (e[0]) {
        case 'oa': {
          const o = e[1];
          const old = this.objs.get(o.id);
          if (old) idxRemove(this, old);
          idxAdd(this, o);
          game.onObjAdded(o);
          break;
        }
        case 'ou': {
          const o = this.objs.get(e[1]);
          if (!o) break;
          const prevSt = o.st;
          Object.assign(o, e[2]);
          game.onObjUpdated(o, e[2], prevSt);
          break;
        }
        case 'or': {
          const o = this.objs.get(e[1]);
          if (o) { idxRemove(this, o); game.onObjRemoved(o); }
          break;
        }
        case 'tile': this.tiles[e[1]] = e[2]; this.markTile(e[1]); break;
        case 'gr': this.grass[e[1]] = e[2]; break;
        case 'dug': this.dug[e[1]] = e[2]; break;
        case 'time': {
          const prevSeason = this.time.season;
          this.time = e[1]; this.weather = e[2]; this.clockMs = 0;
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
        case 'found': this.found = e[1]; this.mapDirty = true; break;
        case 'lore': game.onLore(e[1], e[2]); break;
      }
    }
  }

  // Interpolated game clock (minutes) between authoritative updates
  clock() { return this.time.min + this.clockMs / MS_PER_MIN; }
}
