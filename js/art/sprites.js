'use strict';
// Sprite registry: generates art on demand and caches canvases.
// A sprite is { img: HTMLCanvasElement, ax, ay, w, h } where (ax, ay) is the anchor.

const SPR = {
  cache: new Map(),
  font: null,
  tiles: null,

  init() {
    this.font = new PixelFont();
    this.tiles = new TileArt();
  },

  _get(key, make) {
    let s = this.cache.get(key);
    if (!s) {
      const r = make();
      s = { img: r.px.canvas(), ax: r.ax, ay: r.ay, w: r.px.w, h: r.px.h, px: r.px };
      if (r.lights) s.lights = r.lights;
      if (r.eaves) s.eaves = r.eaves;
      if (r.chimneys) s.chimneys = r.chimneys;
      this.cache.set(key, s);
    }
    return s;
  },

  tree(kind, st, season, fruit) { return this._get('t:' + kind + st + season + (fruit ? 1 : 0), () => genTree(kind, st, season, fruit)); },
  shrub(kind, st, season, fruit) { return this._get('s:' + kind + st + season + (fruit ? 1 : 0), () => genShrub(kind, st, season, fruit)); },
  plant(kind, st, season, v) { return this._get('p:' + kind + st + season + ':' + (kind === 'herbs' ? v % 3 : 0), () => genPlant(kind, st, season, v)); },
  building(kind, season, lit) { return this._get('b:' + kind + season + (lit ? 1 : 0), () => genBuilding(kind, season, lit)); },
  mailbox(flag) { return this._get('mb:' + (flag ? 1 : 0), () => genMailbox(flag)); },
  struct(kind, season) { return this._get('st:' + kind + season, () => genStruct(kind, season)); },
  festDecor(kind, season) { return this._get('fd:' + kind + season, () => genFestDecor(kind, season)); },
  rock(kind, level, season) { return this._get('r:' + kind + level + season, () => genRock(kind, level, season)); },
  log(moss, season) { return this._get('lg:' + moss + season, () => genLog(moss, season)); },
  stump(moss, season) { return this._get('sp:' + moss + season, () => genStump(moss, season)); },
  forage(kind, season) { return this._get('f:' + kind + season, () => genForage(kind, season)); },
  web() { return this._get('web', genWeb); },
  landmark(kind, season) { return this._get('lm:' + kind + season, () => genLandmark(kind, season)); },
  qitem(kind) { return this._get('qi:' + kind, () => genQItem(kind)); },
  puddle() { return this._get('puddle', genPuddle); },
  nest(type) { return this._get('n:' + type, () => genNest(type)); },
  egg(spId) { const sp = SPECIES_BY_ID[spId]; return this._get('egg:' + spId, () => { const px = buildEgg(sp.egg, sp.big); return { px, ax: px.w >> 1, ay: px.h - 1 }; }); },
  chick(kind) { return this._get('ch:' + kind, () => { const px = buildChick(kind); return { px, ax: px.w >> 1, ay: px.h - 1 }; }); },
  icon(kind, key) { return this._get('i:' + kind + ':' + key, () => ({ px: genIcon(kind, key), ax: 8, ay: 8 })); },
  matIcon(k) { return this.icon('mat', k); },
  itemIcon(k) { return this.icon('item', k); },
  ui(k) { return this.icon('ui', k); },

  fence(season) {
    const key = 'fence' + season;
    let s = this.cache.get(key);
    if (!s) {
      const f = genFenceParts(season);
      s = { post: f.post.canvas(), railH: f.railH.canvas(), railV: f.railV.canvas() };
      this.cache.set(key, s);
    }
    return s;
  },

  bird(spId) {
    const key = 'bird:' + spId;
    let s = this.cache.get(key);
    if (!s) {
      const b = buildBirdSprites(SPECIES_BY_ID[spId]);
      s = { w: b.w, h: b.h, ax: b.ax, ay: b.ay, fw: b.fw, fh: b.fh, px: b };
      for (const k of ['perch', 'peck', 'fly1', 'fly2', 'hop']) { s[k] = b[k].canvas(); s[k + '_L'] = b[k + '_L'].canvas(); }
      this.cache.set(key, s);
    }
    return s;
  },

  // Dark silhouette of a bird (for species not yet discovered)
  birdSil(spId) {
    const key = 'bsil:' + spId;
    let c = this.cache.get(key);
    if (!c) {
      const q = this.bird(spId).px.perch.clone();
      const v = C('#4a4458');
      for (let i = 0; i < q.p.length; i++) if (q.p[i] >>> 24) q.p[i] = v;
      c = q.canvas();
      this.cache.set(key, c);
    }
    return c;
  },

  // Characters: opts from NPC_LOOKS or playerLookOpts(look); opts may be a function (called on a miss)
  person(id, opts, dir, frame) {
    const key = 'pp:' + id + ':' + dir + ':' + frame;
    let s = this.cache.get(key);
    if (!s) {
      const px = genPerson(typeof opts === 'function' ? opts() : opts, dir, frame);
      s = { img: px.canvas(), ax: 8, ay: PERSON_H - 1, w: px.w, h: px.h };
      this.cache.set(key, s);
    }
    return s;
  },
  // A player's sprite from their look (indices)
  player(look, dir, frame, binoc) {
    const l = cleanLook(look);
    return this.person('pl' + lookKey(l) + (binoc ? 'b' : ''), () => Object.assign(playerLookOpts(l), { binoc }), dir, frame);
  },

  animal(kind, frame, left, brown) {
    const key = 'an:' + kind + frame + (left ? 'L' : 'R') + (brown ? 'b' : '');
    let s = this.cache.get(key);
    if (!s) {
      let px = kind === 'sheep' ? genSheep(frame) : kind === 'horse' ? genHorse(frame) : genChicken(frame, brown);
      if (left) px = px.flipped();
      s = { img: px.canvas(), ax: px.w >> 1, ay: px.h - 2, w: px.w, h: px.h };
      this.cache.set(key, s);
    }
    return s;
  },

  portrait(npc) {
    return this._get('portrait:' + npc, () => ({ px: genPortrait(NPC_LOOKS[npc]), ax: 16, ay: 16 }));
  },
  playerPortrait(look) {
    const l = cleanLook(look);
    return this._get('pportrait:' + lookKey(l), () => ({ px: genPortrait(playerLookOpts(l)), ax: 16, ay: 16 }));
  },

  tufts(season) {
    const key = 'tufts' + season;
    let s = this.cache.get(key);
    if (!s) {
      const t = buildGrassTufts(season);
      s = { mid: t.mid.map((p) => p.canvas()), long: t.long.map((p) => p.canvas()) };
      this.cache.set(key, s);
    }
    return s;
  },

  // UI panels, cached by style & size
  panel(style, w, h) {
    w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
    const key = 'panel:' + style + w + 'x' + h;
    let s = this.cache.get(key);
    if (!s) { s = genPanel(style, w, h).canvas(); this.cache.set(key, s); }
    return s;
  },
};

// ---------------------------------------------------------------- UI panels
const UI_COL = {
  ink: '#3a2614', inkSoft: '#6e5232', paper: '#f6ecd2', paperD: '#e8d8b0', wood: '#8a5a34',
  gold: '#f6c83a', red: '#c8483a', green: '#4a8a3a', blue: '#3a6ab0', muted: '#9a8464', white: '#ffffff',
};

function genPanel(style, w, h) {
  const px = new Pix(w, h);
  const cut = (c) => { px.set(0, 0, 0); px.set(w - 1, 0, 0); px.set(0, h - 1, 0); px.set(w - 1, h - 1, 0); if (c) { px.set(1, 0, 0); px.set(0, 1, 0); px.set(w - 2, 0, 0); px.set(w - 1, 1, 0); px.set(0, h - 2, 0); px.set(1, h - 1, 0); px.set(w - 1, h - 2, 0); px.set(w - 2, h - 1, 0); } };
  switch (style) {
    case 'paper': case 'note': {
      px.rect(0, 0, w, h, '#3a2614');
      px.rect(1, 1, w - 2, h - 2, style === 'note' ? '#c8b48a' : '#a8743f');
      px.rect(2, 2, w - 4, h - 4, '#3a2614');
      px.rect(3, 3, w - 6, h - 6, style === 'note' ? '#fbf4e2' : '#f6ecd2');
      px.hline(3, w - 4, 3, '#fffaee'); px.vline(3, 3, h - 4, '#fffaee');
      px.hline(3, w - 4, h - 4, '#e2d0a8'); px.vline(w - 4, 3, h - 4, '#e2d0a8');
      for (let i = 0; i < (w * h) / 60; i++) { const x = 4 + Math.floor(hashf(i, w, h) * (w - 8)), y = 4 + Math.floor(hashf(h, i, w) * (h - 8)); px.set(x, y, '#efe2c2'); }
      cut(true);
      if (style === 'note') { px.disc(w / 2, 4, 2.5, '#c83a2a'); px.set(Math.floor(w / 2) - 1, 3, '#f08070'); }
      break;
    }
    case 'wood': {
      px.rect(0, 0, w, h, '#2a1a0e');
      px.rect(1, 1, w - 2, h - 2, '#8a5a34');
      for (let y = 6; y < h - 2; y += 6) px.hline(2, w - 3, y, '#7a4e2c');
      px.hline(1, w - 2, 1, '#c89458'); px.vline(1, 1, h - 2, '#a8743f');
      px.hline(1, w - 2, h - 2, '#5a3a22'); px.vline(w - 2, 1, h - 2, '#5a3a22');
      cut(true);
      break;
    }
    case 'dark': {
      px.rect(0, 0, w, h, C('#14121c', 0.92));
      px.frame(0, 0, w, h, '#4a4458');
      px.hline(1, w - 2, 1, C('#6a6480', 0.6));
      cut(false);
      break;
    }
    case 'slot': case 'slotsel': case 'slothot': {
      px.rect(0, 0, w, h, style === 'slotsel' ? '#f6c83a' : style === 'slothot' ? '#fff0a0' : '#8a6a3a');
      px.rect(1, 1, w - 2, h - 2, '#e2d0a8');
      px.hline(1, w - 2, 1, '#b89a6a'); px.vline(1, 1, h - 2, '#b89a6a');
      px.hline(2, w - 2, h - 2, '#fff4d8'); px.vline(w - 2, 2, h - 2, '#fff4d8');
      if (style === 'slotsel') { px.frame(1, 1, w - 2, h - 2, '#fff0a0'); }
      cut(false);
      break;
    }
    case 'btn': case 'btnh': case 'btnd': case 'btnp': {
      const f = style === 'btnh' ? '#f2d690' : style === 'btnd' ? '#c8bca4' : style === 'btnp' ? '#c8a060' : '#e2c27a';
      px.rect(0, 0, w, h, '#3a2614');
      px.rect(1, 1, w - 2, h - 2, f);
      px.hline(1, w - 2, 1, lighten(f, 0.35)); px.vline(1, 1, h - 2, lighten(f, 0.2));
      px.hline(1, w - 2, h - 2, darken(f, 0.25)); px.vline(w - 2, 1, h - 2, darken(f, 0.15));
      cut(false);
      break;
    }
    case 'tab': case 'tabsel': {
      px.rect(0, 0, w, h, '#3a2614');
      px.rect(1, 1, w - 2, h - 1, style === 'tabsel' ? '#f6ecd2' : '#c8a870');
      px.hline(1, w - 2, 1, style === 'tabsel' ? '#fffaee' : '#dcc08a');
      px.set(0, 0, 0); px.set(w - 1, 0, 0);
      break;
    }
    case 'bar': {
      px.rect(0, 0, w, h, '#3a2614');
      px.rect(1, 1, w - 2, h - 2, '#5a4a3a');
      break;
    }
  }
  return px;
}
