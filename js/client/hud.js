'use strict';
// Heads-up display: clock & coins, objective tracker, hotbar, prompts, toasts, chat, touch buttons.

const HUD = {
  itemNameT: 0, lastSel: -1,

  draw(ui, game, dt) {
    const S = game.state, v = ui.view, me = game.me;
    if (!S || !me) return;
    // The panels below change rarely (a new game minute, coins, the bag, a quest update…), so they're
    // drawn once into a cached picture and only repainted when something they show has changed.
    const unreadN = S.mail.reduce((n, m) => n + (m.read ? 0 : 1), 0);
    const sig = v.w + ',' + v.h + ',' + (S.evVer | 0) + ',' + fmtClock(S.clock()) + ',' + S.time.day + ',' + S.weather + ',' + game.selSlot + ',' +
      (Input.touchMode ? 't' : '') + Input.lastDevice + ',' + (unreadN ? Math.floor(performance.now() / 500) % 2 : 0) + ',' + game.tracked + ',' + (game.modal ? 1 : 0);
    ui.group('hud:tl', sig, [0, 0, 102, 72], () => {
      // ---------------- clock
      const t = S.clock();
      ui.panel('wood', 3, 3, 96, 30);
      const seasonIcon = SPR.ui(SEASONS[S.time.season]);
      ui.icon(seasonIcon, 6, 5);
      ui.text(SEASON_NAMES[S.time.season].slice(0, 3) + ' ' + S.time.day + ', Y' + S.time.year, 24, 7, UI_COL.cream);
      const wIcon = { sun: 'sun', rain: 'rain', cloud: 'cloud', snow: 'snow' }[S.weather] || 'sun';
      ui.icon(SPR.ui(t >= 20 * 60 || t < 6 * 60 ? 'moon' : wIcon), 6, 17);
      ui.text(fmtClock(t), 24, 21, t >= 23 * 60 ? '#ffb0a0' : UI_COL.cream);
      ui.panel('wood', 3, 34, 60, 16);
      ui.icon(SPR.ui('coin'), 4, 34);
      ui.text(String(S.coins), 21, 38, UI_COL.cream);
      // ---------------- birder rank: always-visible progress toward the next rank
      const mine = S.prog || { xp: 0, lvl: 1 };
      const need = xpForLevel(mine.lvl), frac = mine.lvl >= MAX_LEVEL ? 1 : mine.xp / need;
      const rw = ui.widget('hud:rank', 3, 51, 96, 18);
      ui.panel('wood', 3, 51, 96, 18);
      ui.text('★' + mine.lvl, 7, 54, '#f6d860');
      ui.text(RANKS[mine.lvl - 1], 22, 54, UI_COL.cream);
      ui.rect(7, 63, 88, 3, UI_COL.ink);
      ui.rect(7, 63, Math.round(88 * clamp(frac, 0, 1)), 3, '#9ae07a');
      if (rw.over || rw.focused) ui.tip = mine.lvl >= MAX_LEVEL ? 'Top birder rank!' : 'Birder rank ' + mine.lvl + ': ' + mine.xp + '/' + need + ' XP to the next rank. Earn XP by watching birds, building nests, finding clues and helping villagers.';
      if (rw.clicked) game.openModal(new JournalScreen(4));
    });
    ui.group('hud:tr', sig, [v.w - 116, 0, 116, 28], () => {
      // ---------------- buttons (journal, bag, map, mail, menu)
      let bx = v.w - 23;
      const by = 3;
      if (ui.iconButton('hud:menu', SPR.ui('gear'), bx, by, { tip: 'Menu (Esc)' })) game.openModal(new PauseScreen());
      bx -= 22;
      if (ui.iconButton('hud:map', SPR.ui('map'), bx, by, { tip: 'Map (M)' })) game.openModal(new MapScreen());
      bx -= 22;
      if (ui.iconButton('hud:bag', SPR.ui('bag'), bx, by, { tip: 'Bag (I)' })) game.openModal(new BagScreen());
      bx -= 22;
      if (ui.iconButton('hud:jr', SPR.ui('journal'), bx, by, { tip: 'Journal (Tab)' })) game.openModal(new JournalScreen());
      bx -= 22;
      const unread = S.mail.filter((m) => !m.read).length;
      if (unread) {
        const blink = Math.floor(performance.now() / 500) % 2;
        if (ui.iconButton('hud:mail', SPR.ui('letter'), bx, by + (blink ? 1 : 0), { tip: 'New letter! (also in the mailbox)', badge: unread })) game.openModal(new MailScreen());
      }
    });
    ui.group('hud:trk', sig, [v.w - 210, 24, 210, Math.min(150, v.h - 60)], () => {
      // ---------------- tracker & guide arrow
      this.tracker(ui, game, v);
    });
    ui.group('hud:bar', sig, [Math.floor(v.w / 2) - 160, v.h - 46, 320, 46], () => {
      // ---------------- hotbar
      const hw = HOTBAR * 21 + 5, hx = Math.floor((v.w - hw) / 2), hy = v.h - 26;
      ui.panel('wood', hx, hy, hw, 24);
      for (let i = 0; i < HOTBAR; i++) {
        const it = S.inv[i];
        const sx = hx + 3 + i * 21, sy = hy + 2;
        if (ui.slot('hb:' + i, sx, sy, it ? SPR.itemIcon(it.k) : null, it ? it.n : '', { selected: game.selSlot === i })) {
          game.selSlot = game.selSlot === i ? -1 : i; Audio2.sfx('tick');
        }
        if (!Input.touchMode) ui.text(String(i + 1), sx + 1, sy + 1, 'rgba(58,38,20,0.7)');
      }
      // what's in your hands, and how to put it away
      const held = S.inv[game.selSlot];
      if (held) {
        const how = Input.touchMode ? 'tap the slot again to put away' : Input.lastDevice === 'pad' ? '[B] put away' : '[Esc] put away';
        const txt = 'Holding ' + ITEMS[held.k].name + ' · ' + how;
        const w = ui.font.measure(txt) + 24;
        const x = Math.floor((v.w - w) / 2);
        ui.panel('dark', x, hy - 16, w, 14);
        ui.icon(SPR.itemIcon(held.k), x + 2, hy - 17);
        ui.text(txt, x + 20, hy - 13, UI_COL.paper);
      }
    });
    if (!game.modal) this.guide(ui, game, v);
    // ---------------- prompt
    if (!game.modal && game.target && !game.observe) this.prompt(ui, game, v);
    if (game.observe) {
      const k = clamp(game.observe.t / game.observe.need, 0, 1);
      const [sx, sy] = game.toScreen(me.x, me.y - 34);
      ui.bar(sx - 16, sy - 4, 32, 5, k, '#6ab0e0');
    }
    // ---------------- toasts (top centre; below the tracker on narrow screens)
    let ty = 6;
    const tr = this.trackerRect;
    for (const tt of game.toasts) {
      const lines = ui.font.wrap(tt.text, Math.min(280, v.w - 140));
      const w = Math.max(...lines.map((l) => ui.font.measure(l))) + (tt.icon ? 26 : 12), h = lines.length * LINE_H + 8;
      const x = Math.floor((v.w - w) / 2);
      if (tr && x + w > tr[0] - 2 && ty < tr[1] + tr[3]) ty = Math.max(ty, tr[1] + tr[3] + 3);
      const a = clamp(Math.min(tt.t / 200, (tt.life - tt.t) / 400), 0, 1);
      ui.g.globalAlpha = a;
      ui.panel('dark', x, ty, w, h);
      if (tt.icon && tt.icon !== 'no') ui.icon(SPR.ui(tt.icon), x + 4, ty + h / 2 - 8);
      lines.forEach((l, i) => ui.text(l, x + (tt.icon ? 22 : 6), ty + 4 + i * LINE_H, tt.icon === 'no' ? '#ffb0a0' : UI_COL.paper));
      ui.g.globalAlpha = 1;
      ty += h + 2;
    }
    // ---------------- the song that just came on, and chat
    if (!game.chatOpen) nowPlayingLabel(ui, v);
    this.chat(ui, game, v);
    // ---------------- touch controls
    if (game.touchControls()) this.touch(ui, game, v);
  },

  // An arrow at the screen edge pointing to the guide target (pin, nest spot, quest or tutorial step),
  // and bobbing markers over nest spots and the pin when they're in view.
  guide(ui, game, v) {
    const t = game.guideTarget(), me = game.me, g = ui.g;
    const now = performance.now(), bob = Math.round(Math.sin(now / 220) * 2);
    const top = 74, bot = v.h - 40, m = 16;
    const marker = (wx, wy, col) => {
      const [sx, sy] = game.toScreen(wx, wy);
      if (sx < -8 || sx > v.w + 8 || sy < 52 || sy > v.h - 24) return; // off screen, or under the HUD bars
      const y0 = sy - 16 + bob;
      g.fillStyle = '#1e2a14'; g.fillRect(sx - 4, y0 - 1, 9, 3); g.fillRect(sx - 3, y0 + 2, 7, 2); g.fillRect(sx - 2, y0 + 4, 5, 2); g.fillRect(sx - 1, y0 + 6, 3, 1);
      g.fillStyle = col; g.fillRect(sx - 3, y0, 7, 1); g.fillRect(sx - 2, y0 + 1, 5, 2); g.fillRect(sx - 1, y0 + 3, 3, 2); g.fillRect(sx, y0 + 5, 1, 1);
    };
    if (game.finder) for (const [x, y] of game.finder.spots) marker(x * TS + 8, y * TS + 6, '#7ae07a');
    if (game.finder && game.finder.best) marker(game.finder.best.x * TS + 8, game.finder.best.y * TS + 6, '#f6c83a');
    if (game.pin) marker(game.pin.x, game.pin.y, '#e8485a');
    if (!t) return;
    const [sx, sy] = game.toScreen(t.x, t.y);
    if (sx >= m && sx <= v.w - m && sy >= top && sy <= bot) return; // in view: its own marker shows it
    const [px, py] = game.toScreen(me.x, me.y - 12);
    let dx = sx - px, dy = sy - py;
    const L = Math.hypot(dx, dy) || 1;
    dx /= L; dy /= L;
    const kx = dx > 0 ? (v.w - m - px) / dx : dx < 0 ? (m - px) / dx : 1e9;
    const ky = dy > 0 ? (bot - py) / dy : dy < 0 ? (top - py) / dy : 1e9;
    const k = Math.min(kx, ky), ax = px + dx * k + dx * bob * 0.6, ay = py + dy * k + dy * bob * 0.6;
    const col = t.kind === 'spot' ? '#7ae07a' : t.kind === 'pin' ? '#e8485a' : '#f6c83a';
    const tri = (r) => {
      g.beginPath();
      g.moveTo(ax + dx * r, ay + dy * r);
      g.lineTo(ax - dx * r * 0.6 - dy * r * 0.8, ay - dy * r * 0.6 + dx * r * 0.8);
      g.lineTo(ax - dx * r * 0.6 + dy * r * 0.8, ay - dy * r * 0.6 - dx * r * 0.8);
      g.closePath(); g.fill();
    };
    g.fillStyle = '#2a1a0e'; tri(8);
    g.fillStyle = col; tri(5.5);
    const dist = Math.round(Math.hypot(t.x - me.x, t.y - me.y) / TS);
    const lbl = t.label + ' · ' + dist + ' m';
    const w = ui.font.measure(lbl);
    const lx = clamp(Math.round(ax - dx * 16 - w / 2), 3, v.w - w - 3), ly = clamp(Math.round(ay - dy * 16 - 4), top - 6, bot - 10);
    ui.text(lbl, lx, ly, '#ffffff', { outline: '#2a1a0e' });
  },

  prompt(ui, game, v) {
    const tg = game.target;
    const parts = [];
    if (tg.label) parts.push(['act', tg.label]);
    if (tg.alt && tg.alt !== tg.label) parts.push(['alt', tg.alt]);
    if (!parts.length) return;
    const txt = parts.map(([k, l]) => '[' + Input.keyLabel(k) + '] ' + l).join('   ');
    const w = ui.font.measure(txt) + 10;
    let [x, y] = tg.anchor ? game.toScreen(tg.anchor[0], tg.anchor[1]) : [v.w / 2, v.h - 44];
    x = clamp(Math.round(x - w / 2), 2, v.w - w - 2);
    y = clamp(Math.round(y - 16), 40, v.h - 44);
    ui.panel('dark', x, y, w, 13);
    let cx = x + 5;
    parts.forEach(([k, l], i) => {
      const key = '[' + Input.keyLabel(k) + ']';
      cx += ui.text(key, cx, y + 2, '#f6c83a');
      cx += ui.text(' ' + l + (i < parts.length - 1 ? '   ' : ''), cx, y + 2, UI_COL.paper);
    });
  },

  // What the tracker shows: the tutorial step, today's festival, the bird you're tracking, or your leads.
  // {title, lines: [[text, colour, material icon?]…]}
  trackerContent(game) {
    const S = game.state;
    if (S.quest < TUTORIAL.length) {
      const step = TUTORIAL[S.quest], lines = [[step.text, UI_COL.ink]];
      if (step.id === 'gather') lines.push(...this._matLines(S, { twig: 2, grass: 3, mud: 2 }));
      if (step.id === 'build') lines.push(['  Look for: shrub + short lawn', UI_COL.inkSoft]);
      return { title: 'Getting started', lines };
    }
    const fest = FestivalView.trackerLines(S);
    if (fest) return fest;
    const tj = game.tracked && S.journal[game.tracked];
    if (tj && tj.n === 0) {
      const sp = SPECIES_BY_ID[game.tracked], lines = [];
      if (tj.h < 3) lines.push(['Clues ' + tj.h + '/3 — look around ' + ZONES_LABEL[sp.zone], UI_COL.inkSoft]);
      else {
        lines.push(['Site: ' + SITES[sp.site].label, UI_COL.ink], ...this._matLines(S, sp.mats));
        if (!sp.breed.includes(S.time.season)) lines.push(['Nests in ' + sp.breed.map((b) => SEASON_NAMES[b]).join('/'), UI_COL.bad]);
      }
      return { title: 'Tracking: ' + sp.name, lines };
    }
    const lines = [];
    for (const q of QUESTS) {
      const st = S.side && S.side[q.id];
      if (!st || st.st !== 'on' || lines.length >= 2) continue;
      const ready = questReady(S, q);
      const more = ready ? ' — back to ' + NPCS[q.npc].name : q.kind === 'deliver' ? ' → ' + NPCS[q.to].name
        : q.n > 1 ? ' ' + questProgress(S, q) + '/' + q.n : q.night ? ' (after 9 pm)' : q.early ? ' (before 8 am)' : '';
      lines.push(['★ ' + q.title + more, ready ? UI_COL.ok : '#8a5a1a']);
    }
    for (const id of S.featured || []) {
      const sp = SPECIES_BY_ID[id], j = S.journal[id];
      if (!sp || j.h >= 3) continue;
      lines.push([(j.h ? sp.name : '???') + ' ' + j.h + '/3 · ' + ZONES_LABEL[sp.zone], UI_COL.ink]);
    }
    const ready = SPECIES.filter((s) => S.journal[s.id].h >= 3 && S.journal[s.id].n === 0 && s.site !== 'parasite' && !S.hasActiveNest(s.id));
    for (const s of ready.slice(0, 2)) lines.push(['Ready to build: ' + s.name, UI_COL.blue]);
    if (!lines.length) lines.push(['Nest more species to attract new birds', UI_COL.inkSoft]);
    return { title: 'Leads', lines };
  },
  // "Twigs 1/2" for each material, green once there's enough in the pouch
  _matLines(S, mats) {
    return Object.keys(mats).map((k) => ['  ' + MATS[k].name + ' ' + Math.min(mats[k], S.mats[k] || 0) + '/' + mats[k], (S.mats[k] || 0) >= mats[k] ? UI_COL.ok : UI_COL.inkSoft, k]);
  },

  tracker(ui, game, v) {
    this.trackerRect = null;
    const { title, lines } = this.trackerContent(game);
    if (!lines.length) return;
    const maxW = Math.min(200, Math.floor(v.w * 0.42));
    // wrap long lines
    const rows = [];
    for (const [t, c, mk] of lines) {
      // material rows get their icon instead of an indent
      const wrapped = ui.font.wrap(mk ? t.trim() : t, maxW - 14 - (mk ? 12 : 0));
      wrapped.forEach((wl, k) => rows.push([k ? '  ' + wl : wl, c, k ? null : mk]));
    }
    const w = Math.min(maxW, Math.max(ui.font.measure(title), ...rows.map((l) => ui.font.measure(l[0]) + (l[2] ? 12 : 0))) + 14);
    const h = 17 + rows.length * 10;
    const x = v.w - w - 3, y = 26;
    this.trackerRect = [x, y, w, h];
    if (game.modal) return; // windows show the same information; don't peek out around them
    ui.panel('paper', x, y, w, h);
    ui.text(title.length > 32 ? title.slice(0, 31) + '…' : title, x + 6, y + 4, UI_COL.blue);
    rows.forEach(([t, c, mk], i) => {
      if (mk) ui.icon(SPR.matIcon(mk), x + 8, y + 13 + i * 10, 0.5);
      ui.text(t, x + 6 + (mk ? 12 : 0), y + 14 + i * 10, c);
    });
  },

  chat(ui, game, v) {
    const now = performance.now();
    const show = game.chatOpen ? game.chatLog.slice(-6) : game.chatLog.filter((c) => now - c.t < 9000).slice(-4);
    let y = v.h - 40 - show.length * 10 - (game.chatOpen ? 14 : 0);
    for (const c of show) {
      const txt = (c.name ? c.name + ': ' : '') + c.text;
      const a = game.chatOpen ? 1 : clamp((9000 - (now - c.t)) / 1000, 0, 1);
      ui.g.globalAlpha = a;
      ui.text(txt.slice(0, 70), 5, y, c.name ? '#ffffff' : '#c8e0ff', { outline: '#1d1a2b' });
      ui.g.globalAlpha = 1;
      y += 10;
    }
    if (game.chatOpen) {
      ui.panel('dark', 3, v.h - 52, Math.min(240, v.w - 6), 13);
      const cur = Math.floor(now / 400) % 2 ? '_' : '';
      ui.text('Say: ' + game.chatText + cur, 7, v.h - 50, UI_COL.paper);
    }
  },

  touch(ui, game, v) {
    const g = ui.g;
    const st = Input.stick;
    // joystick
    const jx = st.active ? st.cx : 46, jy = st.active ? st.cy : v.h - 60;
    g.globalAlpha = 0.35;
    g.fillStyle = '#1d1a2b';
    g.beginPath(); g.arc(jx, jy, 22, 0, 7); g.fill();
    g.fillStyle = UI_COL.paper;
    const kx = st.active ? clamp(st.x - st.cx, -20, 20) : 0, ky = st.active ? clamp(st.y - st.cy, -20, 20) : 0;
    g.beginPath(); g.arc(jx + kx, jy + ky, 9, 0, 7); g.fill();
    g.globalAlpha = 1;
    // A / B buttons
    const ax = v.w - 34, ay = v.h - 62;
    const btn = (id, x, y, label, act) => {
      const s = ui.widget(id, x - 14, y - 14, 28, 28);
      g.globalAlpha = s.clicked ? 0.9 : 0.55;
      g.fillStyle = id.endsWith('a') ? '#4a8a3a' : UI_COL.blue;
      g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill();
      g.globalAlpha = 1;
      ui.text(label, x, y - 4, '#ffffff', { align: 'center' });
      if (s.clicked) Input.inject(act);
    };
    btn('tc:a', ax, ay, 'A', 'act');
    btn('tc:b', ax - 32, ay + 18, 'B', 'alt');
  },
};
