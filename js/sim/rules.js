'use strict';
// Pure rule queries shared by the authoritative World (host) and the client mirror.
// A "state" S has: tiles, grass, objs (Map), occ (Int32Array), byTile (Map), time, journal, mats, coins.

const tIdx = (x, y) => y * MAP_W + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const dayIdx = (time) => (time.year - 1) * 28 + time.season * 7 + (time.day - 1);
const dateStr = (time) => SEASON_NAMES[time.season] + ' ' + time.day + ', Year ' + time.year;

const BUILDINGS = {
  cottage: { name: 'Your Cottage', w: 5, h: 3, door: [2, 2], site: 'eaves', chimney: true },
  barn:    { name: 'Mabel\'s Barn', w: 6, h: 4, door: [2, 3], site: 'barn' },
  shop:    { name: 'Basil\'s Garden Shop', w: 6, h: 3, door: [2, 2], site: 'eaves' },
  station: { name: 'Field Station', w: 6, h: 3, door: [2, 2], site: 'eaves' },
  farmhouse: { name: 'Mabel\'s Farmhouse', w: 5, h: 3, door: [2, 2], site: 'eaves', chimney: true,
    knock: 'Mabel\'s farmhouse. It smells of fresh bread and woodsmoke — Mabel must be out with the animals.' },
  house1:  { name: 'Rose Cottage', w: 5, h: 3, door: [2, 2], site: 'eaves', chimney: true,
    knock: 'A note on the door: "Gone to the coast to watch the puffins. Back next week! — the Hartleys"' },
  house2:  { name: 'Willow House', w: 5, h: 3, door: [2, 2], site: 'eaves', chimney: true,
    knock: 'Nobody answers. Through the window, a tabby cat is asleep on a pile of bird books.' },
  coop:    { name: 'Chicken Coop', w: 3, h: 2 },
  bench:   { name: 'Workbench', w: 2, h: 1 },
  mailbox: { name: 'Mailbox', w: 1, h: 1 },
  well:    { name: 'Well', w: 1, h: 1 },
  board:   { name: 'Notice Board', w: 1, h: 1 },
};

function footprint(o) {
  if (o.type === 'building') { const b = BUILDINGS[o.kind]; return [b.w, b.h]; }
  if (o.type === 'landmark') { const l = LANDMARKS[o.kind]; return [l.w || 1, l.h || 1]; }
  if (o.type === 'log') return [2, 1];
  return [1, 1];
}

const OCCUPYING = { tree: 1, shrub: 1, plant: 1, rock: 1, log: 1, stump: 1, struct: 1, building: 1, fence: 1, landmark: 1 };
function occupies(o) { return !!OCCUPYING[o.type] || (o.type === 'nest' && !o.host); }

// Solid collision box in px relative to the object's top-left tile, or null.
function solidBox(o) {
  switch (o.type) {
    case 'tree': return o.st >= 1 ? [4, 9, 12, 15] : null;
    case 'shrub': return o.st >= 1 ? [2, 7, 14, 15] : null;
    case 'rock': return o.kind === 'boulder' ? [1, 5, 15, 15] : [2, 7, 14, 15];
    case 'log': return [1, 7, 31, 14];
    case 'stump': return [3, 8, 13, 15];
    case 'fence': return [0, 9, 16, 13];
    case 'building': { const [w, h] = footprint(o); return [0, 2, w * TS, h * TS - 1]; }
    case 'landmark': return LANDMARKS[o.kind].solid;
    case 'struct':
      if (o.kind === 'anvil') return null;
      if (o.kind === 'bank' || o.kind === 'brushpile') return [1, 5, 15, 15];
      if (o.kind === 'birdbath') return [3, 8, 13, 15];
      if (o.kind === 'gardenbench') return [1, 9, 15, 15];
      if (o.kind === 'feeder' || o.kind === 'lamppost') return [6, 11, 10, 15];
      return [6, 11, 10, 15];
    default: return null;
  }
}

function idxAdd(S, o) {
  S.objs.set(o.id, o);
  const [w, h] = footprint(o);
  const occ = occupies(o);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const x = o.x + dx, y = o.y + dy;
    if (!inBounds(x, y)) continue;
    const i = tIdx(x, y);
    let arr = S.byTile.get(i);
    if (!arr) { arr = []; S.byTile.set(i, arr); }
    arr.push(o.id);
    if (occ) S.occ[i] = o.id;
  }
}

function idxRemove(S, o) {
  S.objs.delete(o.id);
  const [w, h] = footprint(o);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
    const x = o.x + dx, y = o.y + dy;
    if (!inBounds(x, y)) continue;
    const i = tIdx(x, y);
    const arr = S.byTile.get(i);
    if (arr) {
      const k = arr.indexOf(o.id);
      if (k >= 0) arr.splice(k, 1);
      if (!arr.length) S.byTile.delete(i);
    }
    if (S.occ[i] === o.id) S.occ[i] = 0;
  }
}

function objAt(S, x, y) {
  if (!inBounds(x, y)) return null;
  const id = S.occ[tIdx(x, y)];
  return id ? S.objs.get(id) || null : null;
}

function objsOnTile(S, x, y) {
  if (!inBounds(x, y)) return [];
  const arr = S.byTile.get(tIdx(x, y));
  if (!arr) return [];
  const out = [];
  for (const id of arr) { const o = S.objs.get(id); if (o) out.push(o); }
  return out;
}

function tileAt(S, x, y) { return inBounds(x, y) ? S.tiles[tIdx(x, y)] : T.CLIFF; }

// ---------- collision ----------
function boxBlocked(S, x0, y0, x1, y1) {
  if (x0 < 2 || y0 < 2 || x1 > MAP_W * TS - 2 || y1 > MAP_H * TS - 2) return true;
  const tx0 = Math.floor(x0 / TS), tx1 = Math.floor((x1 - 0.001) / TS);
  const ty0 = Math.floor(y0 / TS), ty1 = Math.floor((y1 - 0.001) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    if (!inBounds(tx, ty)) return true;
    if (TINFO[S.tiles[tIdx(tx, ty)]].solid) return true;
    const id = S.occ[tIdx(tx, ty)];
    if (!id) continue;
    const o = S.objs.get(id);
    if (!o) continue;
    const b = solidBox(o);
    if (!b) continue;
    const bx0 = o.x * TS + b[0], by0 = o.y * TS + b[1], bx1 = o.x * TS + b[2], by1 = o.y * TS + b[3];
    if (x1 > bx0 && x0 < bx1 && y1 > by0 && y0 < by1) return true;
  }
  return false;
}

const FEET = [5, 4, 5, 1]; // left, up, right, down extents of the feet box
function feetBlocked(S, px, py) { return boxBlocked(S, px - FEET[0], py - FEET[1], px + FEET[2], py + FEET[3]); }

// Move with axis separation and gentle corner sliding. Returns [x, y].
function moveActor(S, x, y, dx, dy) {
  if (dx) {
    if (!feetBlocked(S, x + dx, y)) x += dx;
    else if (!dy) {
      for (const n of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (!feetBlocked(S, x, y + n) && !feetBlocked(S, x + dx, y + n)) { y += sign(n) * Math.min(1, Math.abs(n)); break; }
      }
    }
  }
  if (dy) {
    if (!feetBlocked(S, x, y + dy)) y += dy;
    else if (!dx) {
      for (const n of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (!feetBlocked(S, x + n, y) && !feetBlocked(S, x + n, y + dy)) { x += sign(n) * Math.min(1, Math.abs(n)); break; }
      }
    }
  }
  return [x, y];
}

function speedAt(S, px, py) {
  const t = tileAt(S, Math.floor(px / TS), Math.floor(py / TS));
  return TINFO[t].speed || 1;
}

// ---------- habitat ----------
function isTreeLive(o) { return o.type === 'tree' && o.kind !== 'snag' && o.st >= 1; }

function countHab(S, kind, cx, cy, r) {
  let n = 0;
  const seen = new Set();
  const r2 = r * r + 0.5;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r2) continue;
    const x = cx + dx, y = cy + dy;
    if (!inBounds(x, y)) continue;
    const i = tIdx(x, y), t = S.tiles[i];
    switch (kind) {
      case 'lawn': if (t === T.GRASS && S.grass[i] === 0 && !S.occ[i]) n++; continue;
      case 'longgrass': if ((t === T.GRASS || t === T.MARSH) && S.grass[i] === 2) n++; continue;
      case 'water': case 'waterbody': if (t === T.WATER || t === T.SHALLOW) n++; break;
      case 'mud': if (t === T.MUD) n++; break;
      case 'cover': if ((t === T.GRASS || t === T.MARSH) && S.grass[i] === 2) n++; break;
      case 'rock': if (t === T.ROCK || t === T.CLIFF) n++; continue;
    }
    const arr = S.byTile.get(i);
    if (!arr) continue;
    for (const id of arr) {
      if (seen.has(id)) continue;
      seen.add(id);
      const o = S.objs.get(id);
      if (!o) continue;
      switch (kind) {
        case 'trees': case 'open': if (isTreeLive(o)) n++; break;
        case 'pines': if (o.type === 'tree' && o.kind === 'pine' && o.st >= 1) n++; break;
        case 'oaks': if (o.type === 'tree' && o.kind === 'oak' && o.st >= 1) n++; break;
        case 'shrubs': if (o.type === 'shrub' && o.st >= 1) n++; break;
        case 'reeds': if (o.type === 'plant' && (o.kind === 'reed' || o.kind === 'cattail') && o.st >= 1) n++; break;
        case 'cover': if (o.type === 'plant' && (o.kind === 'reed' || o.kind === 'cattail') && o.st >= 1) n++; break;
        case 'thistles': if (o.type === 'plant' && o.kind === 'thistle' && o.st >= 1) n++; break;
        case 'flowers': if (o.type === 'plant' && FLORA[o.kind].flower && o.st >= 1) n++; break;
        case 'deadwood':
          if (o.type === 'log' || o.type === 'stump' || (o.type === 'tree' && o.kind === 'snag') ||
              (o.type === 'struct' && o.kind === 'brushpile')) n++;
          break;
        case 'anvil': if (o.type === 'struct' && o.kind === 'anvil') n++; break;
        case 'water': if (o.type === 'struct' && o.kind === 'birdbath' && r <= 6) n++; break;
        case 'mud': if (o.type === 'puddle') n++; break;
      }
    }
  }
  return n;
}

function nearWater(S, x, y, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (isWaterT(tileAt(S, x + dx, y + dy))) return true;
  }
  return false;
}

// Tile used as the habitat centre / nest anchor for a host object
function hostCenter(o) {
  if (o.type === 'building') { const b = BUILDINGS[o.kind]; return [o.x + Math.floor(b.w / 2), o.y + b.h - 1]; }
  return [o.x, o.y];
}

// Which nest-site types a host offers (object, or {tile:[x,y]} for ground)
function sitesOf(S, h) {
  const out = [];
  if (!h) return out;
  if (h.tile) {
    const [x, y] = h.tile, i = tIdx(x, y), t = S.tiles[i];
    if (S.occ[i]) return out;
    if ((t === T.GRASS || t === T.MARSH) && S.grass[i] === 2 && nearWater(S, x, y, 3)) out.push('ground');
    if (t === T.GRASS && S.grass[i] === 2 && countHab(S, 'open', x, y, 3) === 0) out.push('field');
    if ((t === T.GRAVEL || t === T.SAND) && nearWater(S, x, y, 2)) out.push('shingle');
    if ((t === T.FOREST || t === T.GRASS) && countHab(S, 'trees', x, y, 3) >= 4 && countHab(S, 'open', x, y, 1) === 0) out.push('clearing');
    if (t === T.ROCK && (tileAt(S, x, y - 1) === T.CLIFF || tileAt(S, x - 1, y) === T.CLIFF || tileAt(S, x + 1, y) === T.CLIFF)) out.push('ledge');
    if (t !== T.PATH && t !== T.BRIDGE && t !== T.WATER && DIR_VEC.some(([dx, dy]) => tileAt(S, x + dx, y + dy) === T.BRIDGE)) out.push('bridge');
    return out;
  }
  const o = h;
  if (o.type === 'tree') {
    if (o.kind === 'snag') out.push('snag');
    else if (o.st >= 2) {
      if (o.kind === 'pine') out.push('pine');
      else {
        out.push('tree');
        if (o.kind === 'willow' && nearWater(S, o.x, o.y, 2)) out.push('willow');
      }
    }
  } else if (o.type === 'shrub' && o.st >= 2) {
    out.push('shrub');
    if (FLORA[o.kind].thorny) out.push('thorny');
  } else if (o.type === 'plant' && o.kind === 'reed' && o.st >= 2) {
    if (countHab(S, 'reeds', o.x, o.y, 2) >= 6) out.push('reeds');
  } else if (o.type === 'struct' && STRUCTS[o.kind] && STRUCTS[o.kind].site) {
    out.push(STRUCTS[o.kind].site);
  } else if (o.type === 'building') {
    const b = BUILDINGS[o.kind];
    if (b && b.site) out.push(b.site);
    if (b && b.chimney) out.push('chimney');
  }
  return out;
}

// Could this host ever be a site (used to show the "Nest site" option even before maturity)
function isPotentialHost(o) {
  if (!o) return false;
  if (o.type === 'tree' || o.type === 'shrub') return true;
  if (o.type === 'plant' && o.kind === 'reed') return true;
  if (o.type === 'struct' && STRUCTS[o.kind] && STRUCTS[o.kind].site) return true;
  if (o.type === 'building' && BUILDINGS[o.kind] && BUILDINGS[o.kind].site) return true;
  return false;
}

function hostSlots(o) { return o && (o.type === 'building' || (o.type === 'struct' && o.kind === 'bank')) ? 3 : 1; }

function nestsOfHost(S, hostId) {
  const out = [];
  for (const o of S.objs.values()) if (o.type === 'nest' && o.host === hostId) out.push(o);
  return out;
}

function groundNestAt(S, x, y) {
  const o = objAt(S, x, y);
  return o && o.type === 'nest' ? o : null;
}

// Evaluate whether a species would settle at a host. Returns {ok, checks:[{label, ok, have, need, why}]}
function evalNest(S, sp, cx, cy, ignoreId) {
  const checks = [];
  const inSeason = sp.breed.includes(S.time.season);
  checks.push({ label: 'Nesting season: ' + sp.breed.map((s) => SEASON_NAMES[s]).join(', '), ok: inSeason, why: inSeason ? 'Now is the time!' : 'Wait for the right season' });
  for (const h of sp.hab) {
    const have = countHab(S, h.k, cx, cy, h.r);
    let ok, label;
    if (h.k === 'open') { ok = have <= h.n; label = h.n === 0 ? 'No trees within ' + h.r + ' tiles' : 'At most ' + h.n + ' trees within ' + h.r; }
    else if (h.k === 'water' || h.k === 'anvil' || h.k === 'mud') { ok = have >= h.n; label = (h.k === 'anvil' ? 'Anvil stone' : h.k === 'mud' ? 'Mud source' : 'Water') + (h.r <= 1 ? ' right next to it' : ' within ' + h.r + ' tiles'); }
    else { ok = have >= h.n; label = h.n + '+ ' + HAB_KINDS[h.k].unit + ' within ' + h.r; }
    checks.push({ label, ok, have, need: h.n, why: h.why, k: h.k });
  }
  if (sp.terr > 0) {
    let rival = 0;
    for (const o of S.objs.values()) {
      if (o.type !== 'nest' || o.kind !== sp.id || o.id === ignoreId || o.st === 'old') continue;
      const c = nestCenter(S, o);
      if (dist2(c[0], c[1], cx, cy) <= sp.terr * sp.terr) rival++;
    }
    checks.push({ label: 'No rival ' + sp.name + ' within ' + sp.terr + ' tiles', ok: rival === 0, why: 'They defend a territory' });
  }
  return { ok: checks.every((c) => c.ok), checks };
}

function nestCenter(S, n) {
  if (n.host) { const h = S.objs.get(n.host); if (h) return hostCenter(h); }
  return [n.x, n.y];
}

function speciesForSite(site) { return SPECIES.filter((s) => s.site === site); }

function knownSpecies(S, id) { const j = S.journal[id]; return j && j.h >= 3; }

function isPlantable(item, t, S, x, y) {
  const it = ITEMS[item];
  if (!it) return false;
  if (it.wet) return t === T.SHALLOW || t === T.MARSH || t === T.MUD;
  if (it.plant === 'willow') return t === T.GRASS || t === T.FOREST || t === T.SOIL || t === T.MARSH;
  return t === T.GRASS || t === T.FOREST || t === T.SOIL || (t === T.MARSH && it.cat !== 'seed');
}

// Can the item in hand be placed on tile (x,y)? Returns {ok, reason}
function canPlace(S, item, x, y, players) {
  const it = ITEMS[item];
  if (!it || !(it.cat === 'seed' || it.cat === 'tree' || it.cat === 'shrub' || it.cat === 'struct')) return { ok: false };
  if (!inBounds(x, y) || x < 1 || y < 1 || x >= MAP_W - 1 || y >= MAP_H - 1) return { ok: false, reason: 'Out of bounds' };
  const i = tIdx(x, y), t = S.tiles[i];
  if (S.occ[i]) return { ok: false, reason: 'Something is already here' };
  if (objsOnTile(S, x, y).some((o) => o.type === 'nest' || o.type === 'puddle')) return { ok: false, reason: 'Something is already here' };
  if (it.cat === 'struct') {
    if (it.struct === 'pondpatch') {
      if (!(t === T.GRASS || t === T.SOIL || t === T.FOREST || t === T.MARSH || t === T.MUD)) return { ok: false, reason: 'Dig ponds on grass or soil' };
      return { ok: true };
    }
    if (!(t === T.GRASS || t === T.FOREST || t === T.SOIL || t === T.SAND || t === T.GRAVEL || t === T.MARSH || t === T.ROCK || t === T.CLAY || t === T.MUD))
      return { ok: false, reason: 'Can\'t build here' };

  } else if (!isPlantable(item, t, S, x, y)) {
    return { ok: false, reason: it.wet ? 'Needs shallow water, marsh or mud' : 'Can\'t plant here' };
  }
  // don't trap players
  if (players) {
    for (const p of players) {
      if (p.sleep) continue;
      const px = Math.floor(p.x / TS), py = Math.floor(p.y / TS);
      if (px === x && py === y) return { ok: false, reason: 'Someone is standing here' };
    }
  }
  return { ok: true };
}

function placeLabel(item) {
  const it = ITEMS[item];
  if (!it) return '';
  if (it.cat === 'struct') return it.struct === 'pondpatch' ? 'Dig a pond' : 'Place ' + it.name;
  return 'Plant ' + it.name;
}

function harvestInfo(S, o) {
  if (o.type !== 'plant' || o.st < 2) return null;
  const h = FLORA[o.kind].harvest;
  if (!h || !h.seasons.includes(S.time.season)) return null;
  if (o.hv === dayIdx(S.time)) return null;
  return h;
}

const HARVEST_LABEL = { thistledown: 'Pick thistle down', herbs: 'Pick fragrant herbs', reedplume: 'Cut reed plumes', fluff: 'Pluck cattail fluff' };
const FORAGE_NAMES = { twig: 'twigs', stick: 'a stick', leaves: 'dead leaves', feather: 'a feather', stone: 'a stone',
  driftwood: 'driftwood', mushroom: 'a chanterelle', garlic: 'wild garlic', note: 'the Field Note' };

// Quick action (E) for an object. Returns {op, label} or null.
function quickOp(S, o, pid) {
  const today = dayIdx(S.time);
  switch (o.type) {
    case 'tree':
      if (o.kind === 'snag' || o.st < 1) return null;
      if (o.fr > 0 && o.kind === 'apple') return { op: 'shake', label: 'Shake for apples' };
      if (o.kind === 'pine' && o.st >= 2 && o.bk !== today) return { op: 'bark', label: 'Peel bark flakes' };
      if (o.sh === today) return null;
      if (o.kind === 'willow' && S.time.season === SPRING && o.st >= 2) return { op: 'shake', label: 'Shake (willow fluff)' };
      return { op: 'shake', label: 'Shake tree' };
    case 'shrub':
      if (o.fr > 0) return { op: 'pick', label: 'Pick ' + ITEMS[FLORA[o.kind].fruit.item].name.toLowerCase() };
      if (o.st >= 1 && o.sh !== today) return { op: 'shake', label: 'Snap twigs' };
      return null;
    case 'plant': {
      const h = harvestInfo(S, o);
      return h ? { op: 'harvest', label: HARVEST_LABEL[h.mat] } : null;
    }
    case 'rock':
      if (o.kind === 'mossy' && o.moss > 0) return { op: 'moss', label: 'Scrape moss' };
      if (o.kind === 'boulder' && o.li > 0) return { op: 'lichen', label: 'Scrape lichen' };
      return null;
    case 'log':
      if (o.rv !== today) return { op: 'rot', label: 'Crumble rotten wood' };
      if (o.moss > 0) return { op: 'moss', label: 'Scrape moss' };
      return null;
    case 'stump': return o.moss > 0 ? { op: 'moss', label: 'Scrape moss' } : null;
    case 'forage': return { op: 'collect', label: 'Pick up ' + (FORAGE_NAMES[o.kind] || o.kind) };
    case 'web': return { op: 'collect', label: 'Gather spider silk' };
    case 'puddle': return { op: 'collect', label: 'Scoop mud' };
    case 'qitem': return { op: 'collect', label: 'Pick up ' + QITEMS[o.kind].name };
    case 'landmark': return { op: 'look', label: 'Look at the ' + LANDMARKS[o.kind].name };
    default: return null;
  }
}

function tileOp(S, x, y) {
  if (!inBounds(x, y)) return null;
  const i = tIdx(x, y), t = S.tiles[i];
  if (S.occ[i]) return null;
  if ((t === T.GRASS || t === T.MARSH) && S.grass[i] === 2) return { op: 'cut', label: 'Cut long grass' };
  const dug = S.dug && S.dug[i] === dayIdx(S.time);
  if (t === T.MUD) return dug ? null : { op: 'mud', label: 'Scoop mud' };
  if (t === T.SAND) return dug ? null : { op: 'sand', label: 'Dig sand' };
  if (t === T.CLAY) return dug ? null : { op: 'clay', label: 'Dig clay' };
  if (t === T.GRAVEL) return dug ? null : { op: 'gravel', label: 'Pick up stones' };
  return null;
}

// ---------- villagers & side quests ----------
const dirTo = (dx, dy) => (Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : (dy < 0 ? 3 : 0));

// Where a villager is at a given minute of the day: {x, y (tiles), dir, moving, away}
function npcPos(id, min) {
  const n = NPCS[id];
  let x, y, dir, away;
  if (n.start) { [x, y, dir] = n.start; away = false; } else { [x, y] = n.home; dir = 0; away = true; }
  for (const [t, pts, edir, flag] of n.sched || []) {
    if (min < t) break;
    let budget = (min - t) * NPC_SPEED, cx = x, cy = y;
    for (const [px, py] of pts) {
      const len = Math.hypot(px - cx, py - cy);
      if (budget < len) {
        const f = budget / len;
        return { x: cx + (px - cx) * f, y: cy + (py - cy) * f, dir: dirTo(px - cx, py - cy), moving: true, away: false };
      }
      budget -= len; cx = px; cy = py;
    }
    x = cx; y = cy; dir = edir; away = flag === 'away';
  }
  return { x, y, dir, moving: false, away };
}

// Side quests: state is S.side[id] = {st: 'on'|'done', n, seen}
function questGateOpen(S) { return S.quest >= TUTORIAL.findIndex((t) => t.id === 'arrive'); }
function questProgress(S, q) {
  const st = S.side && S.side[q.id];
  if (!st) return 0;
  if (q.kind === 'bring') return Math.min(q.n, S.mats[q.mat] || 0);
  if (q.kind === 'visit') return Math.min(q.n, Object.keys(S.found || {}).length);
  if (q.kind === 'observe') return Math.min(q.n, (st.seen || []).length);
  return Math.min(q.n, st.n || 0);
}
function questReady(S, q) { return questProgress(S, q) >= q.n; }
// The quest a villager has for you right now: {q, state: 'offer'|'active'|'ready'} or null
function npcQuest(S, npc) {
  if (!questGateOpen(S)) return null;
  for (const q of QUESTS) {
    if (q.npc !== npc) continue;
    const st = S.side && S.side[q.id];
    if (st && st.st === 'done') continue;
    if (st && st.st === 'on') return { q, state: questReady(S, q) ? 'ready' : 'active' };
    if (q.after && !(S.side[q.after] && S.side[q.after].st === 'done')) return null;
    return { q, state: 'offer' };
  }
  return null;
}

function speciesName(S, id) {
  const j = S.journal[id];
  return j && j.h > 0 ? SPECIES_BY_ID[id].name : 'unknown bird';
}

function nestedCount(S) {
  let n = 0;
  for (const sp of SPECIES) if (S.journal[sp.id] && S.journal[sp.id].n > 0) n++;
  return n;
}

function unlockedTier(S) {
  const n = nestedCount(S);
  let t = 0;
  for (let i = 0; i < TIER_UNLOCK.length; i++) if (n >= TIER_UNLOCK[i]) t = i;
  return t;
}

const NEST_STAGE_LABEL = {
  cock: 'Cock nest — waiting for a female to choose',
  lining: 'Chosen! Needs a feather lining',
  built: 'Waiting for a pair to move in',
  pair: 'A pair has moved in',
  eggs: 'Incubating eggs',
  chicks: 'Feeding chicks',
  fledged: 'Fledged!',
  old: 'Old nest',
};
