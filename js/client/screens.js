'use strict';
// Modal screens. Each has draw(ui, dt). `pause: true` pauses time in solo play.

function centered(view, w, h) {
  w = Math.min(w, view.w - 6); h = Math.min(h, view.h - 6);
  return [Math.floor((view.w - w) / 2), Math.floor((view.h - h) / 2), w, h];
}
// Badge progress as the client sees it (mirrors World.statValue)
function statValueClient(S, k) {
  if (k === 'species') return nestedCount(S);
  if (k === 'landmarks') return Object.keys(S.found || {}).length;
  if (k === 'nightSpecies') return ((S.stats && S.stats.nightList) || []).length;
  if (k === 'bestFriends') { const fr = (S.prog && S.prog.fr) || {}; return Object.values(fr).some((v) => v >= HEART * MAX_HEARTS) ? 1 : 0; }
  return (S.stats && S.stats[k]) || 0;
}
function wantClose(extra) { return Input.hit('cancel') || (extra && Input.hit(extra)); }

function birdThumb(ui, spId, x, y, box, sil) {
  const s = SPR.bird(spId);
  const img = sil ? SPR.birdSil(spId) : s.perch;
  const big = s.w > box || s.h > box;
  const k = big ? 0.5 : 1;
  const w = Math.round(s.w * k), h = Math.round(s.h * k);
  ui.g.drawImage(img, Math.round(x + (box - w) / 2), Math.round(y + (box - h) / 2), w, h);
}

function matsRow(ui, mats, x, y, maxW) {
  let cx = x;
  const S = G.state;
  for (const k in mats) {
    const need = mats[k], have = S.mats[k] || 0;
    const t = have + '/' + need;
    const w = 16 + ui.font.measure(t) + 4;
    if (cx + w > x + maxW) { cx = x; y += 17; }
    ui.icon(SPR.matIcon(k), cx, y);
    ui.text(t, cx + 16, y + 4, have >= need ? '#3a7a2a' : '#b8382a');
    const st = ui.widget('mat:' + k + ':' + x + ':' + y, cx, y, w, 16, {});
    if (st.over || st.focused) ui.tip = MATS[k].name + ' — ' + MATS[k].where;
    cx += w;
  }
  return y + 17;
}

// ===================================================================== title
class TitleScreen {
  constructor() { this.t = 0; this.birds = []; this.full = true; }
  draw(ui, dt) {
    const v = ui.view, g = ui.g;
    this.t += dt;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, v.h);
    sky.addColorStop(0, '#8ec8e8'); sky.addColorStop(0.6, '#cfe8e0'); sky.addColorStop(1, '#f2e6c0');
    g.fillStyle = sky; g.fillRect(0, 0, v.w, v.h);
    // clouds
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 5; i++) {
      const cx = ((this.t / 60 * (0.4 + i * 0.1) + i * 140) % (v.w + 120)) - 60, cy = 18 + i * 14;
      for (const [dx, dy, r] of [[0, 0, 8], [10, -3, 10], [20, 0, 8], [10, 3, 8]]) { g.beginPath(); g.arc(Math.round(cx + dx), Math.round(cy + dy), r, 0, 7); g.fill(); }
    }
    // hills
    const hill = (base, amp, freq, col, off) => {
      g.fillStyle = col;
      for (let x = 0; x < v.w; x += 2) { const h = base + Math.sin((x + off) * freq) * amp + Math.sin((x + off) * freq * 2.3) * amp * 0.4; g.fillRect(x, Math.round(v.h - h), 2, Math.ceil(h)); }
    };
    hill(v.h * 0.45, 10, 0.012, '#9ac48a', 0);
    hill(v.h * 0.33, 8, 0.018, '#6aa65a', 80);
    hill(v.h * 0.2, 6, 0.025, '#4a8a42', 200);
    // trees on the front hill
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * (v.w / 9) + (i % 2) * 14;
      const spr = SPR.tree(i % 3 === 0 ? 'pine' : i % 3 === 1 ? 'oak' : 'birch', 2, SPRING, false);
      g.drawImage(spr.img, Math.round(x - spr.ax / 2), Math.round(v.h - v.h * 0.2 - spr.h / 2 + 6), spr.w / 2, spr.h / 2);
    }
    // birds flying across
    if (this.birds.length < 6 && Math.random() < dt / 900) {
      const sp = pick(['swallow', 'goldfinch', 'bluetit', 'robin', 'kingfisher', 'martin', 'blackbird', 'woodpigeon']);
      this.birds.push({ sp, x: -20, y: 30 + Math.random() * v.h * 0.4, v: 30 + Math.random() * 30, ph: Math.random() * 6 });
    }
    for (const b of this.birds) {
      b.x += b.v * dt / 1000;
      const s = SPR.bird(b.sp);
      const img = Math.floor(this.t / 140 + b.ph) % 2 ? s.fly1 : s.fly2;
      g.drawImage(img, Math.round(b.x), Math.round(b.y + Math.sin(this.t / 400 + b.ph) * 4));
    }
    this.birds = this.birds.filter((b) => b.x < v.w + 30);
    // logo
    const ly = Math.max(14, v.h * 0.12);
    ui.text('NESTED', v.w / 2 + 2, ly + 2, '#2a3a1a', { align: 'center', scale: 4 });
    ui.text('NESTED', v.w / 2, ly, '#fff4d8', { align: 'center', scale: 4, outline: '#3a2614' });
    ui.text('A cozy bird-haven life sim', v.w / 2, ly + 40, '#3a2614', { align: 'center' });
    // menu
    const bw = 132, bh = 16;
    let y = ly + 58;
    const bx = Math.floor(v.w / 2 - bw / 2);
    if (ui.button('t:solo', 'Play Solo', bx, y, bw, bh, { icon: SPR.ui('home') })) G.openModal(new SlotScreen('solo'));
    y += bh + 4;
    const coop = G.server;
    if (ui.button('t:host', 'Host Co-op', bx, y, bw, bh, { icon: SPR.ui('people'), disabled: !coop, tip: coop ? 'Start your valley and let friends join over the network.' : 'Co-op needs the little server: run  python3 server.py  and open the address it prints.' })) G.openModal(new SlotScreen('host'));
    y += bh + 4;
    if (ui.button('t:join', 'Join Co-op', bx, y, bw, bh, { icon: SPR.ui('chat'), disabled: !coop, tip: coop ? 'Join a friend\'s valley.' : 'Co-op needs the little server: run  python3 server.py  and open the address it prints.' })) G.openModal(new JoinScreen());
    y += bh + 4;
    if (ui.button('t:help', 'How to Play', bx, y, bw / 2 - 2, bh)) G.openModal(new HelpScreen());
    if (ui.button('t:set', 'Settings', bx + bw / 2 + 2, y, bw / 2 - 2, bh)) G.openModal(new SettingsScreen());
    ui.text('v' + GAME_VERSION + ' · all art & sound made in code', v.w - 3, v.h - 10, '#3a2614', { align: 'right' });
  }
}

// ===================================================================== save slots
const Saves = {
  key(i) { return 'nested.save.' + i; },
  load(i) { try { const s = localStorage.getItem(this.key(i)); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  save(i, data) {
    try { localStorage.setItem(this.key(i), JSON.stringify(data)); return true; }
    catch (e) { console.warn('save failed', e); return false; }
  },
  remove(i) { try { localStorage.removeItem(this.key(i)); } catch (e) { /* ignore */ } },
  meta(i) {
    const d = this.load(i);
    if (!d) return null;
    let n = 0;
    for (const k in d.journal) if (d.journal[k].n > 0) n++;
    return { name: d.name, date: SEASON_NAMES[d.time.season] + ' ' + d.time.day + ', Year ' + d.time.year, species: n };
  },
};

const Profile = {
  get() {
    try { const p = JSON.parse(localStorage.getItem('nested.profile') || 'null'); if (p) return p; } catch (e) { /* ignore */ }
    return null;
  },
  set(p) { try { localStorage.setItem('nested.profile', JSON.stringify(p)); } catch (e) { /* ignore */ } },
  token() {
    let t = null;
    try { t = localStorage.getItem('nested.token'); } catch (e) { /* ignore */ }
    if (!t) { t = makeToken(); try { localStorage.setItem('nested.token', t); } catch (e) { /* ignore */ } }
    return t;
  },
};

class SlotScreen {
  constructor(mode) { this.mode = mode; this.metas = [1, 2, 3].map((i) => Saves.meta(i)); this.defaultFocus = this.metas[0] ? 'sl:play0' : 'sl:new0'; }
  draw(ui) {
    const [x, y, w, h] = centered(ui.view, 260, 170);
    ui.panel('paper', x, y, w, h);
    ui.text(this.mode === 'host' ? 'Host a valley' : 'Choose a valley', x + w / 2, y + 8, UI_COL.ink, { align: 'center' });
    if (ui.closeX('sl:x', x + w - 15, y + 5) || wantClose()) { G.closeModal(); return; }
    for (let i = 0; i < 3; i++) {
      const m = this.metas[i];
      const by = y + 24 + i * 46;
      ui.panel('note', x + 8, by, w - 16, 42);
      if (m) {
        ui.text(m.name, x + 16, by + 6, UI_COL.ink);
        ui.text(m.date, x + 16, by + 17, UI_COL.inkSoft);
        ui.icon(SPR.ui('star'), x + 14, by + 25);
        ui.text(m.species + '/' + SPECIES.length + ' species nested', x + 31, by + 29, UI_COL.inkSoft);
        if (ui.button('sl:play' + i, 'Play', x + w - 92, by + 7, 70, 14)) { G.startHosting(this.mode, i + 1, null); return; }
        if (ui.button('sl:del' + i, 'Delete', x + w - 92, by + 23, 70, 13)) {
          G.openModal(new ConfirmScreen('Delete "' + m.name + '" forever?', () => { Saves.remove(i + 1); this.metas[i] = null; }));
        }
      } else {
        ui.text('Empty slot', x + 16, by + 10, UI_COL.muted);
        if (ui.button('sl:new' + i, 'New valley', x + w - 92, by + 14, 70, 14)) { G.openModal(new CreateScreen({ newWorld: true, slot: i + 1, mode: this.mode })); return; }
      }
    }
  }
}

// ===================================================================== character creation
const LOOK_TABS = ['Body', 'Hair', 'Clothes', 'Extras'];

// The look editor shared by character creation and the wardrobe: tabs of option steppers.
function lookEditor(ui, st, x, y, w) {
  const t = ui.tabs('lk:tab', LOOK_TABS, x, y, st.tab, Math.floor((w - 3) / 4));
  if (!ui.editing) st.tab = t;
  const lk = st.look;
  let cy = y + 20;
  const lx = x + 2, fx = x + 62, fw = w - 64;
  const sw = (col) => (sx, sy, swd) => { ui.rect(sx + swd / 2 - 12, sy + 2, 24, 10, '#3a2614'); ui.rect(sx + swd / 2 - 11, sy + 3, 22, 8, col); };
  const row = (label) => { ui.text(label, lx, cy + 3, UI_COL.inkSoft); const yy = cy; cy += 18; return yy; };
  const opt = (label, key, list) => { const yy = row(label); lk[key] = ui.stepper('lk:' + key, LOOK_LABELS[list[lk[key]]] || '', fx, yy, fw, lk[key], list.length); };
  const colour = (label, key, cols, order) => {
    const yy = row(label);
    const pos = Math.max(0, order ? order.indexOf(lk[key]) : lk[key]);
    const n = ui.stepper('lk:' + key, '', fx, yy, fw, pos, cols.length, sw(cols[lk[key]]));
    lk[key] = order ? order[n] : n;
  };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  if (st.tab === 0) {
    colour('Skin', 'skin', SKIN_COLORS, SKIN_ORDER);
    colour('Eyes', 'eyes', EYE_COLORS, range(EYE_COLORS.length));
    opt('Face', 'face', FACE_EXTRAS);
  } else if (st.tab === 1) {
    opt('Style', 'style', HAIR_STYLES);
    colour('Colour', 'hair', HAIR_COLORS, HAIR_ORDER);
  } else if (st.tab === 2) {
    opt('Top', 'top', TOP_STYLES);
    colour('Colour', 'shirt', SHIRT_COLORS, SHIRT_ORDER);
    opt('Bottoms', 'bottom', BOTTOM_STYLES);
    colour('Colour', 'pants', PANTS_COLORS, range(PANTS_COLORS.length));
    colour('Shoes', 'shoes', SHOE_COLORS, range(SHOE_COLORS.length));
  } else {
    opt('Hat', 'hat', HAT_STYLES);
    colour('Hat/scarf', 'hatc', SHIRT_COLORS, SHIRT_ORDER);
    opt('Glasses', 'eyewear', EYEWEAR);
    opt('Extra', 'acc', ACCESSORIES);
  }
}

function randomLook() {
  const r = (n) => Math.floor(Math.random() * n);
  const maybe = (p, n) => (Math.random() < p ? 1 + r(n - 1) : 0);
  return cleanLook({
    v: 2, skin: r(SKIN_COLORS.length), hair: r(HAIR_COLORS.length), style: r(HAIR_STYLES.length), eyes: r(EYE_COLORS.length),
    top: r(TOP_STYLES.length), shirt: r(SHIRT_COLORS.length), bottom: r(BOTTOM_STYLES.length), pants: r(PANTS_COLORS.length),
    shoes: r(SHOE_COLORS.length), hat: maybe(0.45, HAT_STYLES.length), hatc: r(SHIRT_COLORS.length),
    eyewear: maybe(0.25, EYEWEAR.length), acc: maybe(0.5, ACCESSORIES.length), face: maybe(0.45, FACE_EXTRAS.length),
  });
}

// A turning, walking preview of a look
function lookPreview(ui, look, x, y, t, scale) {
  const dir = [0, 2, 3, 1][Math.floor(t / 1600) % 4];
  const fr = [0, 1, 0, 2][Math.floor(t / 160) % 4];
  const spr = SPR.player(look, dir, fr, false);
  const k = scale || 3;
  ui.rect(x + 8 * k - 9, y + spr.h * k - 3, 18, 3, 'rgba(30,20,10,0.25)');
  ui.g.drawImage(spr.img, x, y, spr.w * k, spr.h * k);
}

class CreateScreen {
  constructor(o) {
    this.o = o;
    const p = Profile.get() || { name: '', look: {} };
    this.name = p.name || '';
    this.st = { look: cleanLook(p.look), tab: 0 };
    if (!p.name) this.st.look = Object.assign(cleanLook({}), { skin: 1, hair: 1 });
    this.valley = 'Featherbrook';
    this.t = 0;
    this.defaultFocus = this.name ? 'cr:go' : 'cr:name';
  }
  draw(ui, dt) {
    this.t += dt;
    const [x, y, w, h] = centered(ui.view, 330, this.o.newWorld ? 222 : 202);
    ui.panel('paper', x, y, w, h);
    ui.text(this.o.newWorld ? 'A new valley' : 'Your birder', x + w / 2, y + 8, UI_COL.ink, { align: 'center' });
    if (ui.closeX('cr:x', x + w - 15, y + 5) || (wantClose() && !ui.editing)) { ui.stopEditing(); G.closeModal(); return; }
    let cy = y + 24;
    const lx = x + 12, fx = x + 82, fw = 132;
    ui.text('Your name', lx, cy + 3, UI_COL.inkSoft);
    this.name = ui.textField('cr:name', this.name, fx, cy, fw, 14, { placeholder: 'type a name' });
    cy += 20;
    if (this.o.newWorld) {
      ui.text('Valley name', lx, cy + 3, UI_COL.inkSoft);
      this.valley = ui.textField('cr:valley', this.valley, fx, cy, fw, 18);
      cy += 20;
    }
    lookEditor(ui, this.st, lx - 2, cy, 222);
    // preview
    const px = x + w - 82, py = y + 22;
    ui.panel('note', px, py, 70, 104);
    lookPreview(ui, this.st.look, px + 11, py + 10, this.t, 3);
    if (ui.button('cr:rnd', 'Surprise me', px, py + 108, 70, 15)) { this.st.look = randomLook(); Audio2.sfx('pop'); }
    const ok = this.name.trim().length > 0 && (!this.o.newWorld || this.valley.trim().length > 0);
    if (ui.button('cr:go', this.o.newWorld ? 'Create valley' : 'Let\'s go!', x + w / 2 - 60, y + h - 22, 120, 16, { disabled: !ok, tip: ok ? '' : 'Please enter a name.' })) {
      ui.stopEditing();
      const prof = { name: this.name.trim().slice(0, 14), look: Object.assign({}, this.st.look) };
      Profile.set(prof);
      G.closeModal();
      if (this.o.join) G.joinRoom(this.o.join);
      else G.startHosting(this.o.mode, this.o.slot, this.o.newWorld ? this.valley.trim().slice(0, 18) : null);
    }
  }
}

// In-game wardrobe: change your look (and name) at any time
class LookScreen {
  constructor() {
    const me = G.state && G.state.meP;
    const prof = Profile.get() || { name: '', look: {} };
    this.name = (me && me.name) || prof.name || '';
    this.st = { look: cleanLook((me && me.look) || prof.look), tab: 0 };
    this.t = 0;
    this.pause = true;
    this.defaultFocus = 'lk:save';
  }
  draw(ui, dt) {
    this.t += dt;
    const [x, y, w, h] = centered(ui.view, 330, 196);
    ui.panel('paper', x, y, w, h);
    ui.text('Wardrobe', x + w / 2, y + 8, UI_COL.ink, { align: 'center' });
    if (ui.closeX('lk:x', x + w - 15, y + 5) || (wantClose() && !ui.editing)) { ui.stopEditing(); G.closeModal(); return; }
    let cy = y + 24;
    const lx = x + 12;
    ui.text('Your name', lx, cy + 3, UI_COL.inkSoft);
    this.name = ui.textField('lk:name', this.name, x + 82, cy, 132, 14, { placeholder: 'type a name' });
    cy += 20;
    lookEditor(ui, this.st, lx - 2, cy, 222);
    const px = x + w - 82, py = y + 22;
    ui.panel('note', px, py, 70, 104);
    lookPreview(ui, this.st.look, px + 11, py + 10, this.t, 3);
    if (ui.button('lk:rnd', 'Surprise me', px, py + 108, 70, 15)) { this.st.look = randomLook(); Audio2.sfx('pop'); }
    const ok = this.name.trim().length > 0;
    if (ui.button('lk:save', 'Looking good!', x + w / 2 - 60, y + h - 22, 120, 16, { disabled: !ok })) {
      ui.stopEditing();
      const prof = Object.assign({}, Profile.get() || {}, { name: this.name.trim().slice(0, 14), look: Object.assign({}, this.st.look) });
      Profile.set(prof);
      G.send({ t: 'act', a: 'look', name: prof.name, look: prof.look });
      Audio2.sfx('craft');
      G.closeModal();
    }
  }
}

// ===================================================================== join
class JoinScreen {
  constructor() { this.rooms = null; this.t = 99999; this.code = ''; }
  draw(ui, dt) {
    this.t += dt;
    if (this.t > 3000) { this.t = 0; G.fetchRooms().then((r) => { this.rooms = r; }).catch(() => { this.rooms = []; }); }
    const [x, y, w, h] = centered(ui.view, 280, 190);
    ui.panel('paper', x, y, w, h);
    ui.text('Join a friend\'s valley', x + w / 2, y + 8, UI_COL.ink, { align: 'center' });
    if (ui.closeX('jn:x', x + w - 15, y + 5) || (wantClose() && !ui.editing)) { ui.stopEditing(); G.closeModal(); return; }
    let cy = y + 24;
    if (!this.rooms) ui.text('Looking for valleys…', x + 12, cy, UI_COL.inkSoft);
    else if (!this.rooms.length) ui.wrap('No valleys are open on this server yet. Ask your friend to choose "Host Co-op".', x + 12, cy, w - 24, UI_COL.inkSoft);
    else for (const r of this.rooms.slice(0, 5)) {
      const label = r.valley + ' — ' + r.host + ' (' + (r.players + 1) + ')';
      if (ui.button('jn:' + r.code, label, x + 12, cy, w - 24, 16, { icon: SPR.ui('home') })) { this._join(r.code); return; }
      cy += 19;
    }
    const by = y + h - 40;
    ui.text('Room code', x + 12, by + 3, UI_COL.inkSoft);
    this.code = ui.textField('jn:code', this.code.toUpperCase(), x + 72, by, 60, 4, { placeholder: 'ABCD' }).toUpperCase();
    if (ui.button('jn:go', 'Join', x + 140, by, 50, 14, { disabled: this.code.length !== 4 })) { this._join(this.code); return; }
    ui.text('Players on your network can open this page and join.', x + 12, y + h - 18, UI_COL.muted);
  }
  _join(code) {
    ui_stop();
    G.closeModal();
    const prof = Profile.get();
    G.openModal(new CreateScreen({ join: code }));
    if (prof) { /* prefilled */ }
  }
}
function ui_stop() { if (G.ui) G.ui.stopEditing(); }

// ===================================================================== confirm
class ConfirmScreen {
  constructor(msg, onYes, yes, no, focusYes) { this.msg = msg; this.onYes = onYes; this.yes = yes || 'Yes'; this.no = no || 'No'; this.pause = true; this.defaultFocus = focusYes ? 'cf:y' : 'cf:n'; }
  draw(ui) {
    const [x, y, w, h] = centered(ui.view, 220, 34 + ui.wrapHeight(this.msg, 196) + 22);
    ui.panel('paper', x, y, w, h);
    ui.wrap(this.msg, x + 12, y + 10, w - 24, UI_COL.ink);
    const by = y + h - 24;
    if (ui.button('cf:y', this.yes, x + w / 2 - 74, by, 70, 15)) { G.closeModal(); this.onYes(); return; }
    if (ui.button('cf:n', this.no, x + w / 2 + 4, by, 70, 15) || wantClose()) G.closeModal();
  }
}

// ===================================================================== help
const HELP_PAGES = [
  ['Controls', [
    'Move: WASD / arrow keys (or left stick, or drag on the left of a touch screen)',
    'E or Space: interact — gather, talk, pick up, plant, place, observe birds',
    'F (or right-click): nest site / details of the thing in front of you',
    '1–8, mouse wheel, Q/R: choose a hotbar item. Hold a seed or box and press E to plant/place it.',
    'Tab: journal · I: bag · M: map · T: chat (co-op) · Esc: menu',
    'Gamepad: A interact · X nest site · Y journal · B back · LB/RB hotbar · Start menu',
  ]],
  ['How to play', [
    '1. Find clues. Visiting birds and Field Notes (sparkling papers) reveal who a bird is, where it nests and what its nest is made of.',
    '2. Gather materials. Shake trees for twigs, cut long grass, scoop mud, scrape moss and lichen, brush sheep, collect dewy spider silk in the morning…',
    '3. Create habitat. Plant trees, shrubs, thistles, herbs and reeds; craft nest boxes, platforms and banks; dig ponds.',
    '4. Build the nest at the right site (press F there). If the habitat is right and it\'s the breeding season, a pair moves in.',
    '5. Watch eggs hatch and chicks fledge — then the species is nested! Nest all ' + SPECIES.length + ' species.',
  ]],
  ['Tips', [
    'Sleep in your cottage to end the day. Eggs, chicks and plants grow overnight.',
    'Each species has a season: most nest in spring & summer, some even in autumn or winter.',
    'Check a nest site with F before building: it shows exactly which habitat needs are met.',
    'Mud is easier to find after rain. Spider webs only sparkle until 11:00.',
    'Sell mushrooms, berries and nuts to Basil for coins. Fledged species earn conservation grants.',
    'Co-op: everyone shares the valley, the coins and the nest-material pouch.',
  ]],
];

class HelpScreen {
  constructor() { this.page = 0; this.pause = true; }
  draw(ui) {
    const [x, y, w, h] = centered(ui.view, 340, 228);
    ui.panel('paper', x, y + 10, w, h - 10);
    this.page = ui.tabs('hp', HELP_PAGES.map((p) => p[0]), x + 6, y, this.page);
    if (ui.closeX('hp:x', x + w - 14, y + 13) || wantClose()) { G.closeModal(); return; }
    let cy = y + 26;
    for (const line of HELP_PAGES[this.page][1]) {
      cy += ui.wrap(line, x + 12, cy, w - 24, UI_COL.ink) + 4;
    }
  }
}

// ===================================================================== settings
class SettingsScreen {
  constructor() { this.pause = true; }
  draw(ui) {
    const [x, y, w, h] = centered(ui.view, 230, 130);
    ui.panel('paper', x, y, w, h);
    ui.text('Settings', x + w / 2, y + 8, UI_COL.ink, { align: 'center' });
    if (ui.closeX('st:x', x + w - 15, y + 5) || wantClose()) { Audio2.savePrefs(); G.closeModal(); return; }
    let cy = y + 26;
    const row = (label, key) => {
      ui.text(label, x + 14, cy + 3, UI_COL.inkSoft);
      const v = Math.round(Audio2.vol[key] * 10);
      const nv = ui.stepper('st:' + key, '', x + 100, cy, 110, v, 11, (sx, sy, sw) => {
        ui.bar(sx + 2, sy + 4, sw - 4, 6, v / 10, '#4a8a3a');
      });
      if (nv !== v) {
        // stepper wraps around; clamp instead
        const want = (nv === 0 && v === 10) ? 10 : (nv === 10 && v === 0) ? 0 : nv;
        Audio2.vol[key] = want / 10; Audio2.applyVolumes();
        if (key === 'sfx') Audio2.sfx('pop');
      }
      cy += 20;
    };
    row('Music', 'music');
    row('Sounds', 'sfx');
    ui.text('Touch controls', x + 14, cy + 3, UI_COL.inkSoft);
    if (ui.button('st:touch', G.touchPref === 'on' ? 'Always' : G.touchPref === 'off' ? 'Hidden' : 'Auto', x + 100, cy, 110, 14)) {
      G.touchPref = G.touchPref === 'auto' ? 'on' : G.touchPref === 'on' ? 'off' : 'auto';
      try { localStorage.setItem('nested.touch', G.touchPref); } catch (e) { /* ignore */ }
    }
    cy += 20;
    if (ui.button('st:fs', 'Toggle fullscreen', x + 14, cy, w - 28, 14)) {
      try {
        const pr = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
        if (pr && pr.catch) pr.catch(() => G.toast('Fullscreen is not available here.', 'no'));
      } catch (e) { G.toast('Fullscreen is not available here.', 'no'); }
    }
  }
}

// ===================================================================== pause menu
class PauseScreen {
  constructor() { this.pause = true; }
  draw(ui) {
    const [x, y, w, h] = centered(ui.view, 170, G.roomCode ? 191 : 169);
    ui.panel('paper', x, y, w, h);
    ui.text('Paused', x + w / 2, y + 8, UI_COL.ink, { align: 'center' });
    if (G.state && G.state.players.size > 1) ui.text('(time keeps running in co-op)', x + w / 2, y + 18, UI_COL.muted, { align: 'center' });
    let cy = y + 30;
    const b = (id, label) => { const r = ui.button(id, label, x + 20, cy, w - 40, 15); cy += 19; return r; };
    if (b('ps:res', 'Resume') || wantClose()) { G.closeModal(); return; }
    if (b('ps:jr', 'Journal')) { G.closeModal(); G.openModal(new JournalScreen()); return; }
    if (b('ps:look', 'Wardrobe')) { G.closeModal(); G.openModal(new LookScreen()); return; }
    if (b('ps:help', 'How to play')) { G.openModal(new HelpScreen()); return; }
    if (b('ps:set', 'Settings')) { G.openModal(new SettingsScreen()); return; }
    if (b('ps:quit', G.isHost ? 'Save & quit to title' : 'Leave valley')) { G.quitToTitle(); return; }
    if (G.roomCode) {
      ui.text('Room code: ' + G.roomCode, x + w / 2, cy + 2, '#3a6ab0', { align: 'center' });
      ui.text('Friends: open ' + location.host, x + w / 2, cy + 12, UI_COL.muted, { align: 'center' });
    }
  }
}

// ===================================================================== journal
class JournalScreen {
  constructor(tab, sp) {
    this.tab = tab || 0;
    this.sel = sp || null;
    this.sub = -1;
    this.pause = true;
    this.matSel = null;
    this.clueScroll = 0;
    Audio2.sfx('page');
  }
  draw(ui, dt) {
    const S = G.state;
    const [x, y, w, h] = centered(ui.view, 460, 264);
    ui.panel('paper', x, y + 12, w, h - 12);
    this.tab = ui.tabs('jt', ['Birds', 'Clues', 'Materials', 'Quests', 'Progress', 'Valley'], x + 6, y, this.tab);
    if (ui.closeX('jt:x', x + w - 15, y + 16) || wantClose('journal')) { G.closeModal(); return; }
    const bx = x + 8, by = y + 20, bw = w - 16, bh = h - 28;
    if (this.tab === 0) this.drawBirds(ui, bx, by, bw, bh);
    else if (this.tab === 1) this.drawClues(ui, bx, by, bw, bh);
    else if (this.tab === 2) this.drawMats(ui, bx, by, bw, bh);
    else if (this.tab === 3) this.drawQuests(ui, bx, by, bw, bh);
    else if (this.tab === 4) this.drawProgress(ui, bx, by, bw, bh);
    else this.drawValley(ui, bx, by, bw, bh);
  }

  drawBirds(ui, x, y, w, h) {
    const S = G.state;
    // as many columns as needed to fit every bird; smaller cells once there are lots of them
    let cell = 24, rowsFit = Math.max(1, Math.floor((h - 24) / (cell + 1)));
    let cols = Math.max(4, Math.ceil(SPECIES.length / rowsFit));
    if (cols > 7) { cell = 20; rowsFit = Math.max(1, Math.floor((h - 24) / (cell + 1))); cols = Math.max(4, Math.ceil(SPECIES.length / rowsFit)); }
    if (!this.sel) this.sel = SPECIES[0].id;
    SPECIES_BY_TIER.forEach((sp, i) => {
      const cx = x + (i % cols) * (cell + 1), cy = y + Math.floor(i / cols) * (cell + 1);
      const j = S.journal[sp.id];
      const st = ui.widget('jb:' + sp.id, cx, cy, cell, cell);
      const sel = this.sel === sp.id;
      ui.panel(sel ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', cx, cy, cell, cell);
      birdThumb(ui, sp.id, cx + 1, cy + 1, cell - 2, j.h === 0);
      if (j.n > 0) ui.icon(SPR.ui('star'), cx + cell - 12, cy - 3, 0.75);
      else if (j.h >= 3) ui.icon(SPR.ui('nest'), cx + cell - 12, cy - 3, 0.75);
      else if (j.h > 0) ui.text(j.h + '/3', cx + 2, cy + cell - 9, '#ffffff', { outline: '#3a2614' });
      if (st.focused) ui.focusRing(cx, cy, cell, cell);
      if (st.clicked || (st.focused && this.sel !== sp.id)) { if (this.sel !== sp.id) { this.sel = sp.id; this.sub = -1; Audio2.sfx('tick'); } }
    });
    const n = nestedCount(S), rows = Math.ceil(SPECIES.length / cols);
    ui.text(n + '/' + SPECIES.length + ' nested', x, y + rows * (cell + 1) + 4, UI_COL.inkSoft);
    ui.bar(x, y + rows * (cell + 1) + 14, cols * (cell + 1) - 1, 6, n / SPECIES.length, '#e8b830');
    // detail
    const dx = x + cols * (cell + 1) + 8, dw = w - (dx - x);
    this.drawDetail(ui, SPECIES_BY_ID[this.sel], dx, y, dw, h);
  }

  drawDetail(ui, sp, x, y, w, h) {
    const S = G.state;
    const j = S.journal[sp.id];
    ui.panel('note', x, y, w, h);
    const ix = x + 8, iy = y + 8;
    if (j.h === 0) {
      ui.panel('slot', ix, iy, 36, 36);
      birdThumb(ui, sp.id, ix + 2, iy + 2, 32, true);
      ui.text('??? Unknown bird', ix + 44, iy + 4, UI_COL.ink);
      const ut = unlockedTier(S);
      if (sp.tier > ut) {
        const need = TIER_UNLOCK[sp.tier] - nestedCount(S);
        ui.wrap('Not seen in the valley yet. Help ' + need + ' more species nest and new birds will arrive.', ix + 44, iy + 16, w - 60, UI_COL.inkSoft);
      } else {
        ui.wrap('Rumoured around ' + ZONES_LABEL[sp.zone] + '. Observe visiting birds (stand still near them and press ' + Input.keyLabel('act') + ') and look for sparkling Field Notes.', ix + 44, iy + 16, w - 60, UI_COL.inkSoft);
      }
      return;
    }
    const s = SPR.bird(sp.id);
    ui.panel('slot', ix, iy, 36, 36);
    const big = s.w > 34 || s.h > 34;
    if (big) birdThumb(ui, sp.id, ix + 2, iy + 2, 32, false);
    else ui.g.drawImage(s.perch, Math.round(ix + 18 - s.w / 2), Math.round(iy + 18 - s.h / 2));
    ui.text(sp.name, ix + 44, iy, UI_COL.ink);
    ui.text(sp.latin, ix + 44, iy + 10, UI_COL.muted);
    const status = j.n > 0 ? 'Nested! (' + j.first + ')' + (j.n > 1 ? ' · ' + j.n + ' broods' : '') : j.h >= 3 ? 'Blueprint known — build its nest!' : 'Clues: ' + j.h + '/3';
    ui.text(status, ix + 44, iy + 21, j.n > 0 ? '#3a7a2a' : j.h >= 3 ? '#3a6ab0' : UI_COL.inkSoft);
    if (sp.id !== 'cuckoo') ui.text('Nests in: ' + sp.breed.map((b) => SEASON_NAMES[b]).join(', '), ix + 44, iy + 31, UI_COL.inkSoft);
    // eggs
    const egg = SPR.egg(sp.id);
    ui.g.drawImage(egg.img, x + w - 26, iy, egg.w * 2, egg.h * 2);
    // sub tabs
    const subs = ['Nest', 'Clues', 'Facts'];
    if (this.sub < 0) this.sub = j.h >= 2 ? 0 : 1;
    this.sub = ui.tabs('js', subs, x + 6, iy + 42, this.sub, 44);
    const cy0 = iy + 58, cx = x + 8, cw = w - 16;
    ui.rect(x + 4, cy0 - 3, w - 8, 1, '#c8b48a');
    let cy = cy0;
    if (this.sub === 0) {
      if (j.h < 2) { ui.wrap('Find more clues to learn where this bird nests.', cx, cy, cw, UI_COL.inkSoft); return; }
      ui.text('Site:', cx, cy, UI_COL.inkSoft);
      ui.text(SITES[sp.site].label, cx + 26, cy, UI_COL.ink);
      cy += 10;
      cy += ui.wrap(SITES[sp.site].detail, cx + 26, cy, cw - 26, UI_COL.muted);
      cy += 3;
      if (j.h < 3) { ui.wrap('One more clue reveals the nest materials.', cx, cy, cw, UI_COL.inkSoft); return; }
      if (sp.site === 'parasite') {
        cy += ui.wrap('Needs: a Reed Warbler nest with fresh eggs, after Reed Warblers have raised a brood in the valley.', cx, cy, cw, UI_COL.ink);
        return;
      }
      ui.text('Materials:', cx, cy, UI_COL.inkSoft);
      cy += 9;
      if (Object.keys(sp.mats).length) cy = matsRow(ui, sp.mats, cx, cy, cw);
      else { ui.text('None — it needs no nest material!', cx, cy + 2, '#3a7a2a'); cy += 12; }
      if (sp.lining) { ui.text('+ lining:', cx, cy + 4, UI_COL.inkSoft); cy = matsRow(ui, sp.lining, cx + 44, cy, cw - 44); }
      ui.text('Habitat:', cx, cy + 1, UI_COL.inkSoft);
      cy += 11;
      for (const hb of sp.hab) {
        const lbl = hb.k === 'open' ? (hb.n === 0 ? 'Open: no trees within ' + hb.r : 'Open: max ' + hb.n + ' trees within ' + hb.r) : (hb.k === 'water' || hb.k === 'anvil' || hb.k === 'mud') ? (hb.k === 'anvil' ? 'Anvil stone' : hb.k === 'mud' ? 'Mud' : 'Water') + (hb.r <= 1 ? ' right next to it' : ' within ' + hb.r + ' tiles') : hb.n + '+ ' + HAB_KINDS[hb.k].unit + ' within ' + hb.r;
        ui.text('• ' + lbl, cx, cy, UI_COL.ink);
        cy += 9;
        ui.text('  ' + hb.why, cx, cy, UI_COL.muted);
        cy += 10;
      }
      if (sp.terr) { ui.text('• Territorial: no other ' + sp.name.split(' ').pop() + ' nest within ' + sp.terr, cx, cy, UI_COL.ink); cy += 10; }
    } else if (this.sub === 1) {
      for (let i = 0; i < 3; i++) {
        const known = i < j.h;
        ui.text('Clue ' + (i + 1), cx, cy, known ? '#3a6ab0' : UI_COL.muted);
        cy += 9;
        cy += ui.wrap(known ? sp.hints[i] : '???', cx, cy, cw, known ? UI_COL.ink : UI_COL.muted) + 4;
      }
    } else {
      const nFacts = j.n > 0 ? 4 : j.h >= 3 ? 2 : 1;
      ui.text('Real life: ' + sp.real.clutch + ' · incubation ' + sp.real.incub + ' · fledging ' + sp.real.fledge, cx, cy, UI_COL.inkSoft);
      cy += 12;
      for (let i = 0; i < nFacts; i++) cy += ui.wrap('• ' + sp.facts[i], cx, cy, cw, UI_COL.ink) + 3;
      if (nFacts < 4) ui.wrap(j.n > 0 ? '' : 'Raise a brood of ' + sp.name + 's to learn more!', cx, cy + 2, cw, UI_COL.muted);
    }
    if (j.n === 0 && j.h > 0) {
      const tracked = G.tracked === sp.id;
      if (ui.button('jd:track', tracked ? 'Tracking' : 'Track', x + w - 52, y + h - 18, 46, 14, { selected: tracked, tip: 'Show this bird\'s needs on screen while you play.' })) G.tracked = tracked ? null : sp.id;
    }
  }

  drawClues(ui, x, y, w, h) {
    const S = G.state;
    const log = S.log.slice().reverse();
    if (!log.length) { ui.wrap('No clues yet. Visiting birds and Field Notes (sparkling papers) hold clues about birds that might nest in the valley.', x + 6, y + 6, w - 12, UI_COL.inkSoft); return; }
    const per = Math.max(1, Math.floor((h - 18) / 30));
    const pages = Math.ceil(log.length / per);
    this.clueScroll = clamp(this.clueScroll, 0, pages - 1);
    let cy = y + 2;
    for (const e of log.slice(this.clueScroll * per, this.clueScroll * per + per)) {
      const sp = SPECIES_BY_ID[e.sp];
      ui.panel('note', x, cy, w, 28);
      birdThumb(ui, e.sp, x + 3, cy + 3, 22, false);
      const src = e.src === 'obs' ? 'observed' : e.src === 'note' ? 'Field Note' : e.src === 'quest' ? 'tip from a villager' : 'from Ada';
      ui.text(sp.name + ' · clue ' + (e.i + 1) + '/3 · ' + src + (e.by ? ' by ' + e.by : '') + ' · ' + e.d, x + 28, cy + 3, '#3a6ab0');
      ui.wrap(sp.hints[e.i], x + 28, cy + 12, w - 34, UI_COL.ink, LINE_H, 2);
      cy += 30;
    }
    if (pages > 1) {
      if (ui.button('jc:prev', '<', x + w / 2 - 40, y + h - 14, 16, 13, { disabled: this.clueScroll === 0 })) this.clueScroll--;
      ui.text((this.clueScroll + 1) + '/' + pages, x + w / 2, y + h - 11, UI_COL.inkSoft, { align: 'center' });
      if (ui.button('jc:next', '>', x + w / 2 + 24, y + h - 14, 16, 13, { disabled: this.clueScroll >= pages - 1 })) this.clueScroll++;
    }
  }

  drawMats(ui, x, y, w, h) {
    const S = G.state;
    ui.text('Shared nest-material pouch (everyone in the valley uses it)', x + 2, y, UI_COL.inkSoft);
    const colW = Math.floor((w - 4) / 2);
    MAT_ORDER.forEach((k, i) => {
      const cx = x + (i % 2) * colW, cy = y + 12 + Math.floor(i / 2) * 18;
      const st = ui.widget('jm:' + k, cx, cy, colW - 4, 17);
      if (st.over || st.focused || this.matSel === k) ui.rect(cx, cy, colW - 4, 17, '#efe0bc');
      ui.icon(SPR.matIcon(k), cx + 1, cy);
      ui.text(MATS[k].name, cx + 20, cy + 4, UI_COL.ink);
      ui.text(String(S.mats[k] || 0), cx + colW - 10, cy + 4, (S.mats[k] || 0) > 0 ? '#3a7a2a' : UI_COL.muted, { align: 'right' });
      if (st.over || st.focused || st.clicked) this.matSel = k;
    });
    const k = this.matSel || MAT_ORDER[0];
    const iy = y + 12 + 10 * 18 + 2;
    ui.rect(x, iy - 2, w, 1, '#c8b48a');
    ui.text(MATS[k].name + ': ' + MATS[k].where, x + 2, iy + 1, '#3a6ab0');
    ui.wrap(MATS[k].info, x + 2, iy + 11, w - 4, UI_COL.ink, LINE_H, 2);
  }

  drawQuests(ui, x, y, w, h) {
    const S = G.state;
    const colW = Math.floor(w * 0.58);
    ui.text('Requests from villagers', x + 4, y + 2, UI_COL.ink);
    let cy = y + 15;
    const active = QUESTS.filter((q) => S.side[q.id] && S.side[q.id].st === 'on');
    const done = QUESTS.filter((q) => S.side[q.id] && S.side[q.id].st === 'done');
    if (!active.length) cy += ui.wrap(questGateOpen(S) ? 'No open requests. Villagers with a yellow "!" above their head need a hand — talk to them!' : 'Build your first nest, then the villagers will start asking for your help.', x + 6, cy, colW - 10, UI_COL.muted) + 4;
    const per = Math.max(1, Math.floor((h - 34) / 52)), pages = Math.max(1, Math.ceil(active.length / per));
    this.qPage = clamp(this.qPage || 0, 0, pages - 1);
    if (pages > 1) {
      if (ui.button('jq:pp', '<', x + colW - 64, y, 14, 11, { disabled: this.qPage === 0 })) this.qPage--;
      ui.text((this.qPage + 1) + '/' + pages, x + colW - 41, y + 2, UI_COL.muted, { align: 'center' });
      if (ui.button('jq:np', '>', x + colW - 26, y, 14, 11, { disabled: this.qPage >= pages - 1 })) this.qPage++;
    }
    for (const q of active.slice(this.qPage * per, this.qPage * per + per)) {
      const ready = questReady(S, q);
      ui.panel('note', x + 2, cy - 2, colW - 6, 48);
      ui.text(q.title, x + 8, cy + 2, ready ? '#3a7a2a' : UI_COL.ink);
      ui.text(NPCS[q.npc].name + (q.kind === 'deliver' ? ' → ' + NPCS[q.to].name : ''), x + colW - 10, cy + 2, UI_COL.muted, { align: 'right' });
      ui.wrap(q.hint, x + 8, cy + 13, colW - 20, UI_COL.inkSoft, LINE_H, 2);
      const p = questProgress(S, q);
      if (q.n > 1) { ui.bar(x + 8, cy + 35, 70, 5, p / q.n, ready ? '#5ac05a' : '#e8b830'); ui.text(p + '/' + q.n, x + 82, cy + 33, UI_COL.inkSoft); }
      if (ready) ui.text('Ready! Go back to ' + NPCS[q.npc].name, x + (q.n > 1 ? 104 : 8), cy + 33, '#3a7a2a');
      cy += 52;
    }
    ui.text('Completed: ' + done.length + ' of ' + QUESTS.length + ' requests', x + 6, y + h - 12, UI_COL.muted);
    // landmarks
    const lx = x + colW + 6, lw = w - colW - 8;
    const found = Object.keys(S.found || {});
    ui.text('Landmarks ' + found.length + '/' + Object.keys(LANDMARKS).length, lx, y + 2, UI_COL.ink);
    let ly = y + 15;
    for (const k in LANDMARKS) {
      const f = S.found && S.found[k] != null;
      if (f) ui.icon(SPR.ui('star'), lx, ly - 4, 0.75); else ui.text('?', lx + 4, ly, UI_COL.muted);
      ui.text(f ? LANDMARKS[k].name : '???', lx + 15, ly, f ? UI_COL.ink : UI_COL.muted);
      ly += 13;
    }
    ui.wrap('Explore the whole valley — each landmark you find earns ' + LANDMARK_REWARD + ' coins.', lx, ly + 4, lw, UI_COL.muted);
  }

  drawProgress(ui, x, y, w, h) {
    const S = G.state, me = S.prog || { xp: 0, lvl: 1, fr: {} };
    // rank
    const need = xpForLevel(me.lvl), top = me.lvl >= MAX_LEVEL;
    ui.text('★ Rank ' + me.lvl + ': ' + RANKS[me.lvl - 1], x + 4, y + 2, UI_COL.ink);
    ui.bar(x + 4, y + 13, 170, 7, top ? 1 : me.xp / need, '#7ac05a');
    ui.text(top ? 'Top rank!' : me.xp + ' / ' + need + ' XP', x + 180, y + 12, UI_COL.inkSoft);
    const next = !top && LEVEL_REWARDS[me.lvl + 1];
    if (next) {
      const bits = [];
      if (next.coins) bits.push(next.coins + ' coins');
      for (const k in next.items || {}) bits.push(ITEMS[k].name);
      if (next.recipe) bits.push('recipe: ' + ITEMS[next.recipe].name);
      if (next.perk) bits.push(next.perk === 'binoculars' ? 'better binoculars' : 'quiet steps');
      ui.text('Next rank: ' + bits.join(', '), x + 4, y + 23, UI_COL.muted);
    }
    // badges
    const colW = Math.floor((w - 8) / 2);
    ui.text('Badges ' + Object.keys(S.badges || {}).length + '/' + BADGES.length, x + 4, y + 36, UI_COL.ink);
    let i = 0;
    for (const b of BADGES) {
      const bx = x + 4 + (i % 2) * colW, by = y + 47 + Math.floor(i / 2) * 15;
      const got = S.badges && S.badges[b.id] != null;
      const goal = badgeGoal(b), have = Math.min(goal, statValueClient(S, b.s));
      ui.icon(SPR.ui(got ? 'star' : 'lock'), bx, by - 3, 0.75);
      ui.text(b.name, bx + 14, by, got ? UI_COL.ink : UI_COL.inkSoft);
      if (!got) { ui.bar(bx + 104, by + 1, 40, 5, have / goal, '#e8b830'); ui.text(have + '/' + goal, bx + 148, by - 1, UI_COL.muted); }
      else ui.text('earned!', bx + 104, by, '#3a7a2a');
      const st = ui.widget('bd:' + b.id, bx, by - 2, colW - 4, 12);
      if (st.over || st.focused) ui.tip = b.desc;
      i++;
      if (by > y + h - 60) break;
    }
    // friends
    const fy = y + 47 + Math.ceil(Math.min(i, BADGES.length) / 2) * 15 + 4;
    ui.text('Friends', x + 4, fy, UI_COL.ink);
    let k = 0;
    for (const npc in NPCS) {
      const fx = x + 4 + (k % 3) * Math.floor((w - 8) / 3), fyy = fy + 11 + Math.floor(k / 3) * 11;
      const pts = (me.fr && me.fr[npc]) || 0, hearts = Math.min(MAX_HEARTS, Math.floor(pts / HEART));
      ui.text(NPCS[npc].name, fx, fyy, UI_COL.inkSoft);
      for (let hh = 0; hh < MAX_HEARTS; hh++) ui.text(hh < hearts ? '♥' : '♡', fx + 62 + hh * 7, fyy, hh < hearts ? '#d8485a' : '#b8a888');
      k++;
    }
  }

  drawValley(ui, x, y, w, h) {
    const S = G.state;
    const n = nestedCount(S);
    ui.text(S.name + ' Valley', x + 4, y + 2, UI_COL.ink, { scale: 2 });
    ui.text(dateStr(S.time), x + 4, y + 22, UI_COL.inkSoft);
    ui.text('Species nested: ' + n + '/' + SPECIES.length, x + 4, y + 36, UI_COL.ink);
    ui.bar(x + 4, y + 46, 180, 8, n / SPECIES.length, '#e8b830');
    const ut = unlockedTier(S);
    const next = TIER_UNLOCK[ut + 1];
    ui.text(next != null ? 'New birds arrive when ' + next + ' species have nested.' : 'Every bird of the valley has been reported!', x + 4, y + 58, UI_COL.inkSoft);
    const st = S.stats || {};
    ui.text('Broods fledged: ' + (st.fledged || 0) + '   Nests built: ' + (st.built || 0) + '   Days: ' + (st.days || 1), x + 4, y + 70, UI_COL.inkSoft);
    // rare visitors: a little collection of its own
    const rx = x + w - 150, seen = S.rareLog || {};
    const ry = y + 16;
    ui.panel('note', rx - 6, ry, 152, 22 + RARE.length * 10);
    ui.text('Rare visitors ' + Object.keys(seen).length + '/' + RARE.length, rx, ry + 6, UI_COL.ink);
    RARE.forEach((r, k) => {
      const got = seen[r.id];
      ui.text(got ? '★ ' + r.name : '? ??? (' + r.present.map((q) => SEASON_NAMES[q]).join('/') + ')', rx, ry + 18 + k * 10, got ? '#a8761a' : UI_COL.muted);
    });
    ui.text('Active nests', x + 4, y + 86, UI_COL.ink);
    let cy = y + 97;
    const nests = S.activeNests();
    if (!nests.length) ui.text('None yet — build one at a nest site (press ' + Input.keyLabel('alt') + ').', x + 8, cy, UI_COL.muted);
    let i = 0;
    for (const nn of nests) {
      if (cy > y + h - 12) { ui.text('…and ' + (nests.length - i) + ' more', x + 8, cy, UI_COL.muted); break; }
      const sp = SPECIES_BY_ID[nn.kind];
      ui.text('• ' + sp.name + ': ' + NEST_STAGE_LABEL[nn.st] + (nn.st === 'eggs' ? ' (' + nn.eggs + ')' : nn.st === 'chicks' ? ' (' + nn.ch + ')' : ''), x + 8, cy, UI_COL.ink);
      cy += 10; i++;
    }
  }
}

// ===================================================================== bag
class BagScreen {
  constructor() { this.pause = true; this.sel = -1; this.hover = G.selSlot; }
  draw(ui) {
    const S = G.state;
    const [x, y, w, h] = centered(ui.view, 8 * 22 + 24, 128);
    ui.panel('paper', x, y, w, h);
    ui.text('Your bag', x + 10, y + 8, UI_COL.ink);
    ui.icon(SPR.ui('coin'), x + w - 70, y + 4);
    ui.text(String(S.coins), x + w - 52, y + 8, UI_COL.ink);
    if (ui.closeX('bg:x', x + w - 15, y + 5) || wantClose('bag')) { G.closeModal(); return; }
    for (let i = 0; i < BAG_SIZE; i++) {
      const sx = x + 12 + (i % 8) * 22, sy = y + 22 + Math.floor(i / 8) * 22 + (i >= 8 ? 4 : 0);
      const it = S.inv[i];
      if (ui.slot('bg:' + i, sx, sy, it ? SPR.itemIcon(it.k) : null, it ? it.n : '', { selected: this.sel === i || (this.sel < 0 && i === G.selSlot), tip: it ? ITEMS[it.k].name : '' })) {
        if (this.sel < 0) { if (it) this.sel = i; else G.selSlot = i < 8 ? i : G.selSlot; }
        else { if (this.sel !== i) G.send({ t: 'act', a: 'swap', i: this.sel, j: i }); this.sel = -1; }
        Audio2.sfx('tick');
      }
      if (ui.focus === 'bg:' + i || (Input.mouse.x >= sx && Input.mouse.x < sx + 20 && Input.mouse.y >= sy && Input.mouse.y < sy + 20)) this.hover = i;
    }
    ui.text('top row = hotbar (1–8)', x + 70, y + 8, UI_COL.muted);
    const it = S.inv[this.sel >= 0 ? this.sel : this.hover];
    if (it) {
      const def = ITEMS[it.k];
      ui.text(def.name, x + 12, y + 92, UI_COL.ink);
      ui.wrap(def.desc, x + 12, y + 102, w - 80, UI_COL.inkSoft, LINE_H, 2);
    } else ui.text(this.sel >= 0 ? 'Choose where to move it.' : 'Select an item, then a slot to move it.', x + 12, y + 92, UI_COL.muted);
    if (this.sel >= 0 && S.inv[this.sel]) {
      if (ui.button('bg:drop', 'Discard', x + w - 60, y + h - 20, 50, 14)) {
        const i = this.sel;
        G.openModal(new ConfirmScreen('Throw away ' + ITEMS[S.inv[i].k].name + '?', () => { G.send({ t: 'act', a: 'trash', i }); }));
        this.sel = -1;
      }
    }
  }
}

// ===================================================================== shop
class ShopScreen {
  constructor() { this.pause = true; this.tab = 0; this.sel = 0; }
  draw(ui) {
    const S = G.state;
    const [x, y, w, h] = centered(ui.view, 360, 236);
    ui.panel('paper', x, y + 12, w, h - 12);
    this.tab = ui.tabs('sh', ['Buy', 'Sell'], x + 6, y, this.tab);
    ui.icon(SPR.ui('coin'), x + w - 86, y + 16);
    ui.text(String(S.coins), x + w - 68, y + 20, UI_COL.ink);
    if (ui.closeX('sh:x', x + w - 15, y + 16) || wantClose()) { G.closeModal(); return; }
    const lx = x + 8, ly = y + 32, colW = 108;
    if (this.tab === 0) {
      SHOP_STOCK.forEach((k, i) => {
        const cx = lx + (i % 2) * (colW + 2), cy = ly + Math.floor(i / 2) * 22;
        const wood = k === 'mat:wood';
        const name = wood ? 'Wood (pouch)' : ITEMS[k].name, price = wood ? WOOD_PRICE : ITEMS[k].price;
        const st = ui.widget('shb:' + i, cx, cy, colW, 20);
        ui.panel(this.sel === i ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', cx, cy, colW, 20);
        ui.icon(wood ? SPR.matIcon('wood') : SPR.itemIcon(k), cx + 2, cy + 2);
        ui.text(name.length > 15 ? name.slice(0, 14) + '…' : name, cx + 20, cy + 3, UI_COL.ink);
        ui.text(price + 'c', cx + 20, cy + 11, S.coins >= price ? '#8a6a1a' : '#b8382a');
        if (st.focused) ui.focusRing(cx, cy, colW, 20);
        if (st.clicked || st.focused) { if (this.sel !== i && st.clicked) Audio2.sfx('tick'); this.sel = i; }
      });
      const k = SHOP_STOCK[this.sel];
      const wood = k === 'mat:wood';
      const dx = lx + 2 * (colW + 2) + 4, dw = x + w - 8 - dx;
      ui.panel('note', dx, ly, dw, h - 44);
      ui.icon(wood ? SPR.matIcon('wood') : SPR.itemIcon(k), dx + 6, ly + 6, 2);
      const name = wood ? 'Wood' : ITEMS[k].name, price = wood ? WOOD_PRICE : ITEMS[k].price;
      ui.wrap(name, dx + 42, ly + 8, dw - 48, UI_COL.ink);
      ui.text(price + ' coins', dx + 42, ly + 28, '#8a6a1a');
      ui.wrap(wood ? 'For crafting nest boxes, platforms and more. Goes straight into the shared pouch.' : ITEMS[k].desc, dx + 6, ly + 44, dw - 12, UI_COL.inkSoft);
      const by = ly + h - 66;
      if (ui.button('sh:b1', 'Buy 1', dx + 6, by, (dw - 16) / 2, 15, { disabled: S.coins < price })) { if (!wood) G.autoSelect = k; G.send({ t: 'act', a: 'buy', k, n: 1 }); }
      if (ui.button('sh:b5', 'Buy 5', dx + 10 + (dw - 16) / 2, by, (dw - 16) / 2, 15, { disabled: S.coins < price * 5 })) { if (!wood) G.autoSelect = k; G.send({ t: 'act', a: 'buy', k, n: 5 }); }
    } else {
      const items = [];
      S.inv.forEach((s, i) => { if (s) items.push(i); });
      if (!items.length) ui.text('Your bag is empty.', lx, ly + 4, UI_COL.muted);
      items.slice(0, 20).forEach((slot, n) => {
        const s = S.inv[slot];
        const cx = lx + (n % 2) * (colW + 2), cy = ly + Math.floor(n / 2) * 22;
        const st = ui.widget('shs:' + slot, cx, cy, colW, 20);
        ui.panel(this.sel === slot ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', cx, cy, colW, 20);
        ui.icon(SPR.itemIcon(s.k), cx + 2, cy + 2);
        ui.text(ITEMS[s.k].name.slice(0, 15), cx + 20, cy + 3, UI_COL.ink);
        ui.text('x' + s.n + '  ' + itemSellPrice(s.k) + 'c', cx + 20, cy + 11, '#8a6a1a');
        if (st.focused) ui.focusRing(cx, cy, colW, 20);
        if (st.clicked || st.focused) this.sel = slot;
      });
      const s = S.inv[this.sel];
      const dx = lx + 2 * (colW + 2) + 4, dw = x + w - 8 - dx;
      ui.panel('note', dx, ly, dw, h - 44);
      if (s) {
        ui.icon(SPR.itemIcon(s.k), dx + 6, ly + 6, 2);
        ui.wrap(ITEMS[s.k].name, dx + 42, ly + 8, dw - 48, UI_COL.ink);
        ui.text(itemSellPrice(s.k) + ' coins each', dx + 42, ly + 28, '#8a6a1a');
        ui.wrap(ITEMS[s.k].desc, dx + 6, ly + 44, dw - 12, UI_COL.inkSoft);
        const by = ly + h - 66;
        if (ui.button('sh:s1', 'Sell 1', dx + 6, by, (dw - 16) / 2, 15)) G.send({ t: 'act', a: 'sell', slot: this.sel, n: 1 });
        if (ui.button('sh:sa', 'Sell all', dx + 10 + (dw - 16) / 2, by, (dw - 16) / 2, 15)) G.send({ t: 'act', a: 'sell', slot: this.sel, n: s.n });
      } else ui.wrap('Select something to sell. Basil pays well for mushrooms, berries and nuts.', dx + 6, ly + 8, dw - 12, UI_COL.inkSoft);
    }
  }
}

// ===================================================================== crafting
class CraftScreen {
  constructor() { this.pause = true; this.sel = 0; }
  draw(ui) {
    const S = G.state;
    const [x, y, w, h] = centered(ui.view, 360, 222);
    ui.panel('paper', x, y, w, h);
    ui.text('Workbench', x + 10, y + 8, UI_COL.ink);
    if (ui.closeX('cf:x', x + w - 15, y + 5) || wantClose()) { G.closeModal(); return; }
    const lx = x + 8, ly = y + 22, colW = 108;
    RECIPES.forEach((r, i) => {
      const cx = lx + (i % 2) * (colW + 2), cy = ly + Math.floor(i / 2) * 22;
      const locked = r.lvl && (S.prog.lvl || 1) < r.lvl;
      const can = !locked && Object.keys(r.mats).every((k) => (S.mats[k] || 0) >= r.mats[k]);
      const st = ui.widget('cfr:' + i, cx, cy, colW, 20);
      ui.panel(this.sel === i ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', cx, cy, colW, 20);
      ui.icon(SPR.itemIcon(r.id), cx + 2, cy + 2);
      const nm = ITEMS[r.id].name;
      ui.text(nm.length > 15 ? nm.slice(0, 14) + '…' : nm, cx + 20, cy + 3, UI_COL.ink);
      ui.text(locked ? 'birder rank ' + r.lvl : can ? 'ready' : 'need materials', cx + 20, cy + 11, locked ? '#a8761a' : can ? '#3a7a2a' : UI_COL.muted);
      if (st.focused) ui.focusRing(cx, cy, colW, 20);
      if (st.clicked || st.focused) this.sel = i;
    });
    const r = RECIPES[this.sel];
    const dx = lx + 2 * (colW + 2) + 4, dw = x + w - 8 - dx;
    ui.panel('note', dx, ly, dw, h - 30);
    ui.icon(SPR.itemIcon(r.id), dx + 6, ly + 6, 2);
    ui.wrap(ITEMS[r.id].name, dx + 42, ly + 8, dw - 48, UI_COL.ink);
    let cy = ly + 42;
    cy = matsRow(ui, r.mats, dx + 6, cy, dw - 12) + 2;
    cy += ui.wrap(ITEMS[r.id].desc, dx + 6, cy, dw - 12, UI_COL.inkSoft) + 4;
    // which known birds use it
    const site = STRUCTS[r.id] && STRUCTS[r.id].site;
    if (site) {
      const users = SPECIES.filter((s) => s.site === site && S.journal[s.id].h >= 2);
      if (users.length) cy += ui.wrap('Used by: ' + users.map((s) => s.name).join(', '), dx + 6, cy, dw - 12, '#3a6ab0');
    }
    const locked = r.lvl && (S.prog.lvl || 1) < r.lvl;
    if (locked) cy += ui.wrap('Unlocks at birder rank ' + r.lvl + ' (' + RANKS[r.lvl - 1] + ').', dx + 6, cy, dw - 12, '#a8761a');
    const can = !locked && Object.keys(r.mats).every((k) => (S.mats[k] || 0) >= r.mats[k]);
    if (ui.button('cf:go', 'Craft', dx + 6, ly + h - 50, dw - 12, 15, { disabled: !can, icon: SPR.ui('hammer') })) { G.autoSelect = r.id; G.send({ t: 'act', a: 'craft', r: r.id }); }
  }
}

// ===================================================================== nest site
class SiteScreen {
  constructor(host) { this.host = host; this.pause = true; this.sel = 0; }
  hostObj() { return this.host.tile ? null : G.state.objs.get(this.host.id); }
  draw(ui) {
    const S = G.state;
    const h0 = this.hostObj();
    if (!this.host.tile && !h0) { G.closeModal(); return; }
    const target = this.host.tile ? { tile: this.host.tile } : h0;
    const [x, y, w, h] = centered(ui.view, 380, 232);
    ui.panel('paper', x, y, w, h);
    if (ui.closeX('si:x', x + w - 15, y + 5) || wantClose()) { G.closeModal(); return; }
    const title = this.host.tile ? 'Long grass by the water' : hostName(h0);
    ui.text(title, x + 10, y + 8, UI_COL.ink);
    const sites = sitesOf(S, target);
    let cy = y + 20;
    // existing nests on this host
    const nests = h0 ? nestsOfHost(S, h0.id) : [];
    if (nests.length) {
      for (const n of nests) {
        const sp = SPECIES_BY_ID[n.kind];
        if (ui.button('si:n' + n.id, sp.name + ': ' + NEST_STAGE_LABEL[n.st], x + 10, cy, w - 20, 14, { icon: SPR.ui('nest') })) { G.closeModal(); G.openModal(new NestScreen(n.id)); return; }
        cy += 17;
      }
    }
    const full = h0 && nests.length >= hostSlots(h0);
    // candidate species
    const cands = SPECIES.filter((s) => sites.includes(s.site) && S.journal[s.id].h >= 2 && s.site !== 'parasite');
    const unknownCount = SPECIES.filter((s) => sites.includes(s.site) && S.journal[s.id].h < 2).length;
    if (!sites.length) {
      cy += ui.wrap(siteHint(h0, target), x + 10, cy + 2, w - 20, UI_COL.inkSoft) + 6;
    } else if (full) {
      ui.text('There\'s no room for another nest here.', x + 10, cy + 2, UI_COL.inkSoft);
      cy += 14;
    } else if (!cands.length) {
      cy += ui.wrap('Site type: ' + sites.map((s) => SITES[s].label).join(', ') + '. ' +
        (unknownCount ? 'You don\'t know any bird that nests here yet — ' + unknownCount + (unknownCount === 1 ? ' species uses' : ' species use') + ' this kind of site. Find their clues!' : 'No bird in the valley nests in this kind of site.'), x + 10, cy + 2, w - 20, UI_COL.inkSoft) + 6;
    } else {
      // species list (left) and detail (right)
      this.sel = clamp(this.sel, 0, cands.length - 1);
      const lw = 104;
      cands.forEach((sp, i) => {
        const st = ui.widget('si:sp' + sp.id, x + 8, cy + i * 26, lw, 24);
        ui.panel(this.sel === i ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', x + 8, cy + i * 26, lw, 24);
        birdThumb(ui, sp.id, x + 10, cy + i * 26 + 2, 20, false);
        ui.text(sp.name.length > 14 ? sp.name.split(' ').pop() : sp.name, x + 32, cy + i * 26 + 8, UI_COL.ink);
        if (st.focused) ui.focusRing(x + 8, cy + i * 26, lw, 24);
        if (st.clicked || st.focused) this.sel = i;
      });
      const sp = cands[this.sel];
      const dx = x + lw + 14, dw = w - lw - 22;
      let dy = cy;
      ui.panel('note', dx, dy, dw, y + h - 8 - dy);
      dy += 6;
      ui.text(sp.name, dx + 6, dy, UI_COL.ink);
      dy += 11;
      const known = S.journal[sp.id].h >= 3;
      if (!known) {
        ui.wrap('You know it nests here, but not what its nest is made of. Find its third clue!', dx + 6, dy, dw - 12, UI_COL.inkSoft);
      } else {
        if (Object.keys(sp.mats).length) dy = matsRow(ui, sp.mats, dx + 6, dy, dw - 12);
        else { ui.text('No materials needed!', dx + 6, dy + 2, '#3a7a2a'); dy += 13; }
        const c = this.host.tile ? this.host.tile : hostCenter(h0);
        const ev = evalNest(S, sp, c[0], c[1], 0);
        for (const ch of ev.checks) {
          ui.icon(SPR.ui(ch.ok ? 'check' : 'cross'), dx + 4, dy - 3, 0.75);
          const lbl = ch.label + (ch.have != null && ch.k !== 'open' ? ' (' + ch.have + ')' : ch.have != null ? ' (' + ch.have + ')' : '');
          ui.text(lbl, dx + 18, dy, ch.ok ? '#3a7a2a' : '#b8382a');
          dy += 9;
          if (ch.why && !ch.ok) { ui.text(ch.why, dx + 18, dy, UI_COL.muted); dy += 9; }
          dy += 1;
        }
        const enough = Object.keys(sp.mats).every((k) => (S.mats[k] || 0) >= sp.mats[k]);
        const label = sp.id === 'wren' ? 'Build cock nest' : Object.keys(sp.mats).length ? 'Build nest' : 'Prepare site';
        const by = y + h - 28;
        if (!ev.ok) ui.wrap('Birds won\'t settle until everything is ✓ — but you can build now.', dx + 6, by - 20, dw - 12, UI_COL.muted, LINE_H, 2);
        if (ui.button('si:build', label, dx + 6, by, dw - 12, 15, { disabled: !enough, icon: SPR.ui('nest'), tip: enough ? '' : 'Not enough materials in the pouch.' })) {
          const msg = { t: 'act', a: 'nest', sp: sp.id };
          if (this.host.tile) { msg.x = this.host.tile[0]; msg.y = this.host.tile[1]; } else msg.host = h0.id;
          G.send(msg);
          G.closeModal();
          return;
        }
      }
    }
    // remove player-placed things
    if (h0 && h0.pl && !nests.some((n) => n.st !== 'old' && n.st !== 'built')) {
      const lbl = h0.type === 'struct' ? 'Pick up' : 'Dig up';
      if (ui.button('si:pick', lbl, x + 10, y + h - 22, 60, 14)) { G.send({ t: 'act', a: 'pickup', id: h0.id }); G.closeModal(); }
    }
  }
}

function hostName(o) {
  if (!o) return '';
  if (o.type === 'tree' || o.type === 'shrub' || o.type === 'plant') {
    const f = FLORA[o.kind];
    return f.name + (o.st < 2 && o.type !== 'plant' ? (o.st === 0 ? ' (sapling)' : ' (young)') : '');
  }
  if (o.type === 'struct') return STRUCTS[o.kind].name;
  if (o.type === 'building') return BUILDINGS[o.kind].name;
  return o.kind;
}

function siteHint(o, target) {
  if (!o) return 'Ground-nesting birds are fussy: long grass by water, long grass far from trees, or bare gravel at the water\'s edge.';
  if ((o.type === 'tree' || o.type === 'shrub') && o.st < 2) return 'It\'s still growing. Birds only nest in fully grown trees and shrubs — sleep a few nights and come back.';
  if (o.type === 'plant' && o.kind === 'reed') return o.st < 2 ? 'These reeds are still growing.' : 'A single clump isn\'t enough — plant more reeds or cattails close together (6 within 2 tiles) for a dense reed bed.';
  if (o.type === 'tree' && o.kind === 'willow') return 'A good tree.';
  return 'This isn\'t a nest site.';
}

// ===================================================================== nest info
class NestScreen {
  constructor(id) { this.id = id; this.pause = true; this.fact = Math.floor(Math.random() * 4); }
  draw(ui) {
    const S = G.state;
    const n = S.objs.get(this.id);
    if (!n) { G.closeModal(); return; }
    const sp = SPECIES_BY_ID[n.kind];
    const [x, y, w, h] = centered(ui.view, 330, 200);
    ui.panel('paper', x, y, w, h);
    if (ui.closeX('ns:x', x + w - 15, y + 5) || wantClose()) { G.closeModal(); return; }
    ui.panel('slot', x + 10, y + 10, 36, 36);
    birdThumb(ui, n.cu && (n.st === 'chicks' || n.st === 'fledged') ? 'cuckoo' : sp.id, x + 12, y + 12, 32, false);
    ui.text(sp.name + ' nest', x + 54, y + 10, UI_COL.ink);
    ui.text(NEST_STAGE_LABEL[n.st], x + 54, y + 21, '#3a6ab0');
    ui.text('Built by ' + (n.by || '?'), x + 54, y + 32, UI_COL.muted);
    let cy = y + 52;
    if (n.st === 'eggs') {
      const egg = SPR.egg(sp.id);
      for (let i = 0; i < n.eggs; i++) ui.g.drawImage(egg.img, x + 12 + i * 14, cy, egg.w * 2, egg.h * 2);
      if (n.cu) { const ce = SPR.egg('cuckoo'); ui.g.drawImage(ce.img, x + 12 + n.eggs * 14, cy - 2, ce.w * 2 + 2, ce.h * 2 + 2); }
      cy += 22;
      const left = Math.max(1, sp.incub - n.t);
      ui.text((n.t === 0 ? 'Still laying — one egg a day. ' : '') + 'Hatching in about ' + plural(left, 'day') + '.', x + 12, cy, UI_COL.ink);
      cy += 12;
    } else if (n.st === 'chicks') {
      const ck = SPR.chick(sp.big ? 'big' : sp.body === 'owl' ? 'owl' : sp.id === 'mallard' ? 'duck' : 'small');
      for (let i = 0; i < n.ch; i++) ui.g.drawImage(ck.img, x + 12 + i * 16, cy, ck.w * 2, ck.h * 2);
      cy += 22;
      const left = Math.max(1, sp.nestling - n.t);
      ui.text((sp.id === 'mallard' ? 'The ducklings follow their mother on the water. ' : sp.id === 'plover' ? 'The fluffy chicks run about the gravel, feeding themselves. ' : 'The parents bring food all day. ') + 'Fledging in about ' + plural(left, 'day') + '.', x + 12, cy, UI_COL.ink);
      cy += 12;
    } else if (n.st === 'pair') {
      cy += ui.wrap('A pair has moved in. The first eggs are usually laid early in the morning — sleep and check back!', x + 12, cy, w - 24, UI_COL.ink) + 4;
    } else if (n.st === 'cock') {
      cy += ui.wrap('A male wren built this "cock nest" to impress a female. Build a second one within 10 tiles — she\'ll inspect both and choose one.', x + 12, cy, w - 24, UI_COL.ink) + 4;
    } else if (n.st === 'lining') {
      cy += ui.wrap('The female chose this nest! She lines it with soft feathers before laying.', x + 12, cy, w - 24, UI_COL.ink) + 4;
      cy = matsRow(ui, sp.lining, x + 12, cy, w - 24);
      if (ui.button('ns:line', 'Add the lining', x + 12, cy + 2, 110, 15, { disabled: !Object.keys(sp.lining).every((k) => (S.mats[k] || 0) >= sp.lining[k]) })) G.send({ t: 'act', a: 'line', id: n.id });
      cy += 20;
    } else if (n.st === 'built') {
      const c = nestCenter(S, n);
      const ev = evalNest(S, sp, c[0], c[1], n.id);
      ui.text(ev.ok ? 'Everything is ready — a pair should arrive soon!' : 'Not quite right yet:', x + 12, cy, ev.ok ? '#3a7a2a' : '#b8382a');
      cy += 11;
      for (const ch of ev.checks) {
        ui.icon(SPR.ui(ch.ok ? 'check' : 'cross'), x + 10, cy - 3, 0.75);
        ui.text(ch.label + (ch.have != null ? ' (' + ch.have + ')' : ''), x + 24, cy, ch.ok ? '#3a7a2a' : '#b8382a');
        cy += 9;
        if (!ch.ok && ch.why) { ui.text(ch.why, x + 24, cy, UI_COL.muted); cy += 9; }
        cy += 1;
      }
    } else if (n.st === 'fledged') {
      cy += ui.wrap('The young have left the nest! The family stays nearby today.', x + 12, cy, w - 24, UI_COL.ink) + 4;
    } else if (n.st === 'old') {
      cy += ui.wrap(sp.reuse ? 'An old nest. ' + sp.name + 's often reuse their nests — a pair may return in the breeding season.' : 'An old, empty nest. Clean it out so birds can build afresh (it also removes fleas and mites).', x + 12, cy, w - 24, UI_COL.ink) + 4;
    }
    // fact
    const j = S.journal[sp.id];
    if (j.h > 0 && cy < y + h - 50) {
      ui.rect(x + 10, cy + 2, w - 20, 1, '#c8b48a');
      ui.wrap('Did you know? ' + sp.facts[this.fact % (j.n > 0 ? 4 : 2)], x + 12, cy + 6, w - 24, UI_COL.inkSoft, LINE_H, 3);
    }
    const by = y + h - 22;
    if (n.st === 'old') { if (ui.button('ns:clean', 'Clean out', x + 12, by, 80, 14)) { G.send({ t: 'act', a: 'nclear', id: n.id }); G.closeModal(); } }
    else if (n.st === 'built' || n.st === 'cock' || n.st === 'lining') {
      if (ui.button('ns:rm', 'Remove nest', x + 12, by, 80, 14)) G.openModal(new ConfirmScreen('Remove this nest? Half of the materials will be returned.', () => { G.send({ t: 'act', a: 'nclear', id: n.id }); G.closeModal(); }));
    }
    if (ui.button('ns:jr', 'Journal', x + w - 72, by, 60, 14)) { G.closeModal(); G.openModal(new JournalScreen(0, sp.id)); }
  }
}

// ===================================================================== dialogue
class DialogueScreen {
  constructor(d) { this.set(d); this.pause = true; }
  set(d) { this.d = d; this.line = 0; this.chars = 0; this.focused = false; Audio2.sfx('open'); }
  draw(ui, dt) {
    const v = ui.view;
    const w = Math.min(v.w - 10, 420), h = 74;
    const x = Math.floor((v.w - w) / 2), y = v.h - h - 6;
    ui.panel('paper', x, y, w, h);
    ui.panel('slot', x + 14, y + 6, 36, 36);
    ui.icon(SPR.portrait(this.d.npc), x + 16, y + 8);
    const npc = NPCS[this.d.npc];
    ui.text(npc.name, x + 32, y + 46, UI_COL.ink, { align: 'center' });
    ui.text(npc.role, x + 32, y + 56, UI_COL.muted, { align: 'center' });
    const fr = (G.state.prog && G.state.prog.fr && G.state.prog.fr[this.d.npc]) || 0, hearts = Math.min(MAX_HEARTS, Math.floor(fr / HEART));
    for (let hh = 0; hh < MAX_HEARTS; hh++) ui.text(hh < hearts ? '♥' : '♡', x + 16 + hh * 7, y + 64, hh < hearts ? '#d8485a' : '#c8b898');
    const text = this.d.lines[this.line] || '';
    this.chars = Math.min(text.length, this.chars + dt * 0.06);
    const shown = text.slice(0, Math.floor(this.chars));
    if (Math.floor(this.chars) % 3 === 0 && this.chars < text.length) Audio2.sfx('tick');
    ui.wrap(shown, x + 70, y + 8, w - 78, UI_COL.ink, LINE_H, 5);
    const done = this.chars >= text.length;
    const last = this.line >= this.d.lines.length - 1;
    const adv = Input.hit('act') || Input.hit('enter') || (Input.mouse.clicked && Input.mouse.y > y);
    if (!done) { if (adv) { this.chars = text.length; Input.mouse.clicked = false; } return; }
    if (!last) {
      const kl = Input.keyLabel('ok');
      if (Input.touchMode) ui.text('▼', x + w - 14, y + h - 12, UI_COL.inkSoft);
      else { ui.text('▼', x + w - 18 - ui.keyHintW(kl), y + h - 13, UI_COL.inkSoft); ui.keyHint(kl, x + w - 10 - ui.keyHintW(kl), y + h - 15); }
      if (adv) { this.line++; this.chars = 0; Input.mouse.clicked = false; Audio2.sfx('page'); }
      return;
    }
    // options: the way out is focused, so Space (or A) leaves the conversation
    const opts = this.d.opts || [{ id: 'bye', label: 'Bye' }];
    const exitId = (opts.find((o) => o.id === 'bye') || opts[opts.length - 1]).id;
    if (!this.focused) { ui.wantFocus = 'dl:' + exitId; this.focused = true; }
    const key = Input.keyLabel('ok');
    let bx = x + 70;
    const by = y + h - 19;
    for (const o of opts) {
      const bw = ui.font.measure(o.label) + 14, kw = o.id === exitId && !Input.touchMode ? ui.keyHintW(key) + 3 : 0;
      if (bx + bw + kw > x + w - 4) break;
      if (ui.button('dl:' + o.id, o.label, bx, by, bw, 14, { key: o.id === exitId ? key : null })) { this.choose(o.id); return; }
      bx += bw + kw + 4;
    }
    if (wantClose()) this.choose('bye');
  }
  choose(id) {
    if (id === 'bye') { G.closeModal(); return; }
    if (id === 'shop') { G.closeModal(); G.openModal(new ShopScreen()); return; }
    G.send({ t: 'act', a: 'opt', npc: this.d.npc, o: id });
  }
}

// ===================================================================== rank up
class LevelUpScreen {
  constructor(lvl, got) { this.lvl = lvl; this.got = got || []; this.pause = true; this.t = 0; this.defaultFocus = 'lu:ok'; Audio2.sfx('fanfare'); this.burst = false; }
  draw(ui, dt) {
    this.t += dt;
    if (!this.burst && G.me) { this.burst = true; G.fx.burst('confetti', G.me.x, G.me.y - 30, 24); }
    const v = ui.view;
    ui.rect(0, 0, v.w, v.h, 'rgba(20,18,32,0.4)');
    const lines = this.got.length ? this.got : ['Keep watching and helping the birds!'];
    const hgt = 66 + lines.reduce((a, l) => a + ui.wrapHeight('• ' + l, 220), 0);
    const [x, y, w, h] = centered(v, 250, hgt);
    ui.panel('note', x, y, w, h);
    const sc = this.t < 250 ? 1 : 1;
    ui.text('★ New birder rank! ★', x + w / 2, y + 8, '#c8961a', { align: 'center', scale: sc });
    ui.text('Rank ' + this.lvl + ': ' + RANKS[this.lvl - 1], x + w / 2, y + 20, UI_COL.ink, { align: 'center' });
    let cy = y + 34;
    for (const l of lines) cy += ui.wrap('• ' + l, x + 15, cy, 220, UI_COL.inkSoft);
    if (ui.button('lu:ok', 'Wonderful!', x + w / 2 - 40, y + h - 21, 80, 15, { key: Input.keyLabel('ok') }) || (this.t > 400 && wantClose())) G.closeModal();
  }
}

// ===================================================================== notice board
class BoardScreen {
  constructor() { this.pause = true; this.defaultFocus = 'nb:x'; Audio2.sfx('page'); }
  draw(ui) {
    const S = G.state;
    const [x, y, w, h] = centered(ui.view, 300, 150);
    ui.panel('wood', x, y, w, h);
    ui.text('Notice Board', x + w / 2, y + 6, '#fff4d8', { align: 'center' });
    if (ui.closeX('nb:x', x + w - 15, y + 5) || wantClose()) { G.closeModal(); return; }
    const tasks = S.board || [];
    if (!tasks.length) ui.wrap('No notices today. Check back tomorrow morning!', x + 12, y + 30, w - 24, '#fff4d8');
    tasks.forEach((t, i) => {
      const cy = y + 22 + i * 58;
      ui.panel('note', x + 8, cy, w - 16, 52);
      ui.icon(SPR.portrait(t.npc), x + 12, cy + 4, 0.7);
      ui.text(NPCS[t.npc].name + ': "' + t.text + '"', x + 40, cy + 6, UI_COL.ink);
      ui.icon(SPR.matIcon(t.mat), x + 40, cy + 16);
      const have = S.mats[t.mat] || 0;
      ui.text(t.n + ' ' + MATS[t.mat].name + ' (you have ' + have + ')', x + 58, cy + 20, have >= t.n ? '#3a7a2a' : UI_COL.inkSoft);
      ui.text('Reward: ' + (15 + t.n * 6) + ' coins · friendship', x + 40, cy + 32, UI_COL.muted);
      if (t.done) ui.text('Done by ' + t.done + ' ✓', x + w - 20, cy + 32, '#3a7a2a', { align: 'right' });
      else if (ui.button('nb:' + i, 'Hand in', x + w - 74, cy + 30, 58, 14, { disabled: have < t.n })) G.send({ t: 'act', a: 'board', i });
    });
    ui.text('New notices every morning. They\'re optional — help when you like!', x + w / 2, y + h - 12, '#e8d8b8', { align: 'center' });
  }
}

// ===================================================================== landmarks
class LoreScreen {
  constructor(kind, first) { this.kind = kind; this.first = first; this.pause = true; this.t = 0; this.defaultFocus = 'lo:ok'; Audio2.sfx(first ? 'clue' : 'page'); }
  draw(ui, dt) {
    this.t += dt;
    const l = LANDMARKS[this.kind];
    const [x, y, w, h] = centered(ui.view, 280, 60 + ui.wrapHeight(l.lore, 250) + (this.first ? 12 : 0));
    ui.panel('note', x, y, w, h);
    if (this.first) ui.text('★ Landmark discovered! ★', x + w / 2, y + 8, '#c8961a', { align: 'center' });
    ui.text(l.name, x + w / 2, y + (this.first ? 20 : 10), UI_COL.ink, { align: 'center' });
    const ty = y + (this.first ? 34 : 24);
    ui.wrap(l.lore, x + 15, ty, w - 30, UI_COL.inkSoft);
    if (this.first) ui.text('+' + LANDMARK_REWARD + ' coins', x + w / 2, y + h - 34, '#a8761a', { align: 'center' });
    if (ui.button('lo:ok', 'Lovely!', x + w / 2 - 35, y + h - 21, 70, 15, { key: Input.keyLabel('ok') }) || (this.t > 300 && wantClose())) G.closeModal();
  }
}

// ===================================================================== mail
class MailScreen {
  constructor() { this.pause = true; this.sel = null; this.page = 0; }
  draw(ui) {
    const S = G.state;
    const [x, y, w, h] = centered(ui.view, 400, 236);
    ui.panel('paper', x, y, w, h);
    ui.text('Letters', x + 10, y + 8, UI_COL.ink);
    if (ui.closeX('ml:x', x + w - 15, y + 5) || wantClose()) { G.closeModal(); return; }
    const letters = S.mail.slice().reverse();
    if (this.sel == null && letters.length) this.open(letters.find((l) => !l.read) || letters[0]);
    const lw = 116;
    letters.slice(0, 12).forEach((l, i) => {
      const cy = y + 22 + i * 17;
      const st = ui.widget('ml:' + l.id, x + 8, cy, lw, 16);
      ui.panel(this.sel === l.id ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', x + 8, cy, lw, 16);
      ui.icon(SPR.ui('letter'), x + 9, cy);
      ui.text(l.title.length > 17 ? l.title.slice(0, 16) + '…' : l.title, x + 26, cy + 4, l.read ? UI_COL.inkSoft : UI_COL.ink);
      if (!l.read) ui.rect(x + lw + 2, cy + 6, 3, 3, '#c8483a');
      if (st.focused) ui.focusRing(x + 8, cy, lw, 16);
      if (st.clicked || st.focused) this.open(l);
    });
    const l = S.mail.find((m) => m.id === this.sel);
    const dx = x + lw + 14, dw = w - lw - 22;
    ui.panel('note', dx, y + 22, dw, h - 30);
    if (!l) return;
    ui.text(l.title, dx + 8, y + 30, UI_COL.ink);
    ui.text('From ' + l.from + ' · ' + l.d, dx + 8, y + 40, UI_COL.muted);
    const lines = ui.font.wrap(l.body, dw - 16);
    const per = Math.floor((h - 64) / LINE_H);
    const pages = Math.ceil(lines.length / per);
    this.page = clamp(this.page, 0, pages - 1);
    lines.slice(this.page * per, this.page * per + per).forEach((s, i) => ui.text(s, dx + 8, y + 54 + i * LINE_H, UI_COL.ink));
    if (pages > 1) {
      if (ui.button('ml:pp', '<', dx + dw - 58, y + h - 22, 16, 12, { disabled: this.page === 0 })) this.page--;
      ui.text((this.page + 1) + '/' + pages, dx + dw - 30, y + h - 20, UI_COL.inkSoft, { align: 'center' });
      if (ui.button('ml:np', '>', dx + dw - 20, y + h - 22, 16, 12, { disabled: this.page >= pages - 1 })) this.page++;
    }
  }
  open(l) {
    if (this.sel === l.id) return;
    this.sel = l.id; this.page = 0;
    Audio2.sfx('page');
    if (!l.read) G.send({ t: 'act', a: 'mail', id: l.id });
  }
}

// ===================================================================== clue card
class ClueScreen {
  constructor(sp, i, src) { this.sp = sp; this.i = i; this.src = src; this.pause = true; this.t = 0; this.defaultFocus = 'cl:ok'; Audio2.sfx('clue'); }
  draw(ui, dt) {
    this.t += dt;
    const S = G.state;
    const sp = SPECIES_BY_ID[this.sp];
    const [x, y, w, h] = centered(ui.view, 300, 150);
    ui.panel('note', x, y, w, h);
    ui.text(this.src === 'obs' ? 'You observed a bird!' : this.src === 'quest' ? 'A tip from a friend!' : 'You found a Field Note!', x + w / 2, y + 10, '#3a6ab0', { align: 'center' });
    ui.panel('slot', x + 10, y + 24, 36, 36);
    birdThumb(ui, sp.id, x + 12, y + 26, 32, false);
    ui.text(sp.name, x + 54, y + 26, UI_COL.ink);
    ui.text('Clue ' + (this.i + 1) + ' of 3', x + 54, y + 37, UI_COL.inkSoft);
    for (let k = 0; k < 3; k++) ui.rect(x + 54 + k * 14, y + 48, 12, 4, k <= this.i ? '#4a8a3a' : '#d8c8a0');
    ui.wrap(sp.hints[this.i], x + 12, y + 66, w - 24, UI_COL.ink, LINE_H, 5);
    if (this.i >= 2) {
      const sc = 1 + Math.max(0, 0.3 - this.t / 1000);
      ui.text('★ Nest blueprint learned! ★', x + w / 2, y + h - 36, '#c8961a', { align: 'center', scale: sc > 1.1 ? 1 : 1 });
    }
    if (ui.button('cl:jr', 'Journal', x + w / 2 - 74, y + h - 22, 70, 15)) { G.closeModal(); G.openModal(new JournalScreen(0, sp.id)); return; }
    if (ui.button('cl:ok', 'OK', x + w / 2 + 4, y + h - 22, 70, 15) || wantClose()) G.closeModal();
  }
}

// ===================================================================== morning summary
class DayScreen {
  constructor(sum) {
    this.sum = sum; this.pause = true; this.t = 0; this.defaultFocus = 'dy:ok';
    if (sum.newSpecies && sum.newSpecies.length) Audio2.sfx('fanfare'); else Audio2.sfx('arrive');
  }
  draw(ui, dt) {
    this.t += dt;
    const v = ui.view;
    ui.rect(0, 0, v.w, v.h, 'rgba(20,18,32,0.55)');
    const [x, y, w, h] = centered(v, 330, 74 + Math.max(1, this.sum.lines.length) * 11 + (this.sum.newSpecies.length ? 30 : 0));
    ui.panel('paper', x, y, w, h);
    const wIcon = { sun: 'sun', rain: 'rain', cloud: 'cloud', snow: 'snow' }[this.sum.weather] || 'sun';
    ui.icon(SPR.ui(wIcon), x + 10, y + 8);
    ui.text('Good morning!', x + 30, y + 8, UI_COL.ink);
    ui.text(this.sum.date, x + 30, y + 18, UI_COL.inkSoft);
    let cy = y + 34;
    if (!this.sum.lines.length) { ui.text('A quiet night in the valley.', x + 14, cy, UI_COL.inkSoft); cy += 11; }
    for (const [ic, line] of this.sum.lines) {
      ui.icon(SPR.ui({ heart: 'heart', egg: 'egg', chick: 'chick', star: 'star', nest: 'nest', leaf: 'leaf' }[ic] || 'leaf'), x + 10, cy - 4, 0.75);
      ui.wrap(line, x + 24, cy, w - 34, line.startsWith('NEW SPECIES') ? '#a8761a' : UI_COL.ink, LINE_H, 1);
      cy += 11;
    }
    if (this.sum.newSpecies.length) {
      cy += 4;
      this.sum.newSpecies.forEach((id, i) => {
        const bob = Math.round(Math.sin(this.t / 200 + i) * 2);
        birdThumb(ui, id, x + w / 2 - this.sum.newSpecies.length * 14 + i * 28, cy + bob, 24, false);
      });
      cy += 26;
    }
    if (G.isHost) ui.text('Game saved.', x + w - 10, y + 8, UI_COL.muted, { align: 'right' });
    if (ui.button('dy:ok', 'Start the day', x + w / 2 - 50, y + h - 22, 100, 15, { key: Input.keyLabel('ok') }) || (this.t > 400 && wantClose())) G.closeModal();
  }
}

// ===================================================================== map
class MapScreen {
  constructor() { this.pause = false; this.cv = null; this.season = -1; }
  draw(ui, dt) {
    const S = G.state, v = ui.view;
    if (!this.cv || this.season !== S.time.season || S.mapDirty) this.build();
    const sc = Math.max(1, Math.min(Math.floor((v.w - 20) / MAP_W), Math.floor((v.h - 34) / MAP_H)));
    const mw = MAP_W * sc, mh = MAP_H * sc;
    const x = Math.floor((v.w - mw) / 2), y = Math.floor((v.h - mh) / 2) + 6;
    ui.panel('wood', x - 6, y - 16, mw + 12, mh + 22);
    ui.text(S.name + ' Valley', x, y - 12, '#fff4d8');
    if (ui.closeX('mp:x', x + mw - 11, y - 14) || wantClose('map')) { G.closeModal(); return; }
    ui.g.drawImage(this.cv, x, y, mw, mh);
    const P = (wx, wy) => [x + wx / TS * sc, y + wy / TS * sc];
    // labels
    const label = (t, tx, ty) => { const [lx, ly] = [x + tx * sc, y + ty * sc]; ui.text(t, lx, ly, '#ffffff', { outline: '#2a1a0e', align: 'center' }); };
    if (sc >= 3) {
      label('Forest', 30, 6); label('Pine grove', 9, 4); label('Hills', 84, 8); label('Farm', 14, 20); label('Hay meadow', 15, 43);
      label('Pond', 24, 52); label('Home', 44, 23); label('Village', 66, 24); label('Orchard', 52, 47); label('Wet meadow', 89, 56); label('South meadow', 66, 62);
    }
    // nests
    for (const o of S.objs.values()) {
      if (o.type !== 'nest' || o.st === 'old') continue;
      const [nx, ny] = nestCenter(S, o);
      ui.rect(x + nx * sc + sc / 2 - 2, y + ny * sc + sc / 2 - 2, 4, 4, o.st === 'built' || o.st === 'cock' ? '#f6ecd2' : '#f6c83a');
    }
    // leads
    const t = performance.now();
    for (const id of S.featured || []) {
      const sp = SPECIES_BY_ID[id];
      if (!sp || S.journal[id].h >= 3) continue;
      const z = sp.zone === 'river' ? [74, 30, 82, 46] : ZONES[sp.zone];
      const cx = x + (z[0] + z[2]) / 2 * sc, cy = y + (z[1] + z[3]) / 2 * sc;
      const r = 4 + (t / 200) % 4;
      ui.g.strokeStyle = '#ffffff'; ui.g.lineWidth = 1;
      ui.g.strokeRect(Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2));
      ui.text('?', cx - 1, cy - 4, '#ffffff', { outline: '#3a6ab0' });
    }
    for (const k in NPCS) { const n = npcPos(k, S.clock()); if (!n.away) ui.rect(x + n.x * sc - 1, y + n.y * sc - 2, 3, 3, '#c070d8'); }
    for (const o of S.objs.values()) if (o.type === 'landmark' && S.found && S.found[o.kind] != null) ui.icon(SPR.ui('star'), x + o.x * sc - 4, y + o.y * sc - 4, 0.5);
    for (const p of S.players.values()) {
      const [px, py] = P(p.x, p.y);
      const blink = p.pid === S.me && Math.floor(t / 300) % 2;
      ui.rect(px - 2, py - 2, 5, 5, blink ? '#ffffff' : '#e8485a');
      if (S.players.size > 1) ui.text(p.name, px + 4, py - 4, '#ffffff', { outline: '#2a1a0e' });
    }
    ui.text('■ you   ■ nest (gold = busy)   ? clue leads   ■ villagers', x, y + mh + 1, '#fff4d8');
  }
  build() {
    const S = G.state;
    const px = new Pix(MAP_W, MAP_H);
    const colOf = { 0: '#5aa04a', 1: '#3a7a3a', 2: '#d8b070', 3: '#7a5a3a', 4: '#ecd9a0', 5: '#a49c8e', 6: '#6a4e34', 7: '#6fc0e0', 8: '#3383b8', 9: '#9a9ea6', 10: '#5a5862', 11: '#6aa080', 12: '#a8743f', 13: '#c07a52' };
    for (let i = 0; i < MAP_W * MAP_H; i++) {
      let c = colOf[S.tiles[i]];
      if (S.tiles[i] === T.GRASS && S.grass[i] === 2) c = '#7ab85a';
      if (S.time.season === WINTER && (S.tiles[i] === T.GRASS || S.tiles[i] === T.FOREST)) c = '#e4ecf4';
      px.p[i] = C(c);
    }
    for (const o of S.objs.values()) {
      const [fw, fh] = footprint(o);
      const c = o.type === 'tree' ? (o.kind === 'pine' ? '#1e4a32' : '#2f6a2e') : o.type === 'shrub' ? '#457e36' : o.type === 'building' ? '#b4503a' : o.type === 'rock' ? '#c8c6cc' : o.type === 'fence' ? '#c89458' : o.type === 'struct' ? '#e8c890' : null;
      if (!c) continue;
      for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) px.set(o.x + dx, o.y + dy, c);
    }
    this.cv = px.canvas();
    this.season = S.time.season;
    S.mapDirty = false;
  }
}

// ===================================================================== sleeping
class SleepScreen {
  constructor() { this.pause = false; this.t = 0; }
  draw(ui, dt) {
    this.t += dt;
    const S = G.state, v = ui.view;
    ui.rect(0, 0, v.w, v.h, 'rgba(10,10,30,0.7)');
    const [x, y, w, h] = centered(v, 220, 60);
    ui.panel('dark', x, y, w, h);
    ui.text('Zzz… waiting for everyone to sleep', x + w / 2, y + 10, '#f6ecd2', { align: 'center' });
    ui.text((S.sleepN || 1) + ' of ' + (S.sleepTotal || 1) + ' asleep', x + w / 2, y + 22, '#c8c0e0', { align: 'center' });
    if (ui.button('slp:c', 'Get up', x + w / 2 - 35, y + h - 20, 70, 14) || wantClose()) { G.send({ t: 'act', a: 'sleep', v: false }); G.closeModal(); }
  }
}
