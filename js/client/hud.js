'use strict';
// Heads-up display: clock & coins, objective tracker, hotbar, prompts, toasts, chat, touch buttons.

const HUD = {
  itemNameT: 0, lastSel: -1,

  draw(ui, game, dt) {
    const S = game.state, v = ui.view, me = game.me;
    if (!S || !me) return;
    // ---------------- clock
    const t = S.clock();
    ui.panel('wood', 3, 3, 96, 30);
    const seasonIcon = SPR.ui(SEASONS[S.time.season]);
    ui.icon(seasonIcon, 6, 5);
    ui.text(SEASON_NAMES[S.time.season].slice(0, 3) + ' ' + S.time.day + ', Y' + S.time.year, 24, 7, '#fff4d8');
    const wIcon = { sun: 'sun', rain: 'rain', cloud: 'cloud', snow: 'snow' }[S.weather] || 'sun';
    ui.icon(SPR.ui(t >= 20 * 60 || t < 6 * 60 ? 'moon' : wIcon), 6, 17);
    ui.text(fmtClock(t), 24, 21, t >= 23 * 60 ? '#ffb0a0' : '#fff4d8');
    ui.panel('wood', 3, 34, 60, 16);
    ui.icon(SPR.ui('coin'), 4, 34);
    ui.text(String(S.coins), 21, 38, '#fff4d8');
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
    // ---------------- tracker
    this.tracker(ui, game, v);
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
      ui.text(txt, x + 20, hy - 13, '#f6ecd2');
    }
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
      lines.forEach((l, i) => ui.text(l, x + (tt.icon ? 22 : 6), ty + 4 + i * LINE_H, tt.icon === 'no' ? '#ffb0a0' : '#f6ecd2'));
      ui.g.globalAlpha = 1;
      ty += h + 2;
    }
    // ---------------- chat
    this.chat(ui, game, v);
    // ---------------- touch controls
    if (game.touchControls()) this.touch(ui, game, v);
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
      cx += ui.text(' ' + l + (i < parts.length - 1 ? '   ' : ''), cx, y + 2, '#f6ecd2');
    });
  },

  tracker(ui, game, v) {
    const S = game.state;
    const lines = [];
    let title = '';
    this.trackerRect = null;
    if (S.quest < TUTORIAL.length) {
      title = 'Getting started';
      const step = TUTORIAL[S.quest];
      lines.push([step.text, '#3a2614']);
      if (step.id === 'gather') {
        for (const [k, n] of [['twig', 2], ['grass', 3], ['mud', 2]]) lines.push(['  ' + MATS[k].name + ' ' + Math.min(n, S.mats[k] || 0) + '/' + n, (S.mats[k] || 0) >= n ? '#3a7a2a' : '#6e5232', k]);
      }
      if (step.id === 'build') lines.push(['  Look for: shrub + short lawn', '#6e5232']);
    } else if (game.tracked && S.journal[game.tracked] && S.journal[game.tracked].n === 0) {
      const sp = SPECIES_BY_ID[game.tracked];
      const j = S.journal[sp.id];
      title = 'Tracking: ' + sp.name;
      if (j.h < 3) lines.push(['Clues ' + j.h + '/3 — look around ' + ZONES_LABEL[sp.zone], '#6e5232']);
      else {
        lines.push(['Site: ' + SITES[sp.site].label, '#3a2614']);
        for (const k in sp.mats) lines.push(['  ' + MATS[k].name + ' ' + Math.min(sp.mats[k], S.mats[k] || 0) + '/' + sp.mats[k], (S.mats[k] || 0) >= sp.mats[k] ? '#3a7a2a' : '#6e5232', k]);
        if (!sp.breed.includes(S.time.season)) lines.push(['Nests in ' + sp.breed.map((b) => SEASON_NAMES[b]).join('/'), '#b8382a']);
      }
    } else {
      title = 'Leads';
      for (const q of QUESTS) {
        const st = S.side && S.side[q.id];
        if (!st || st.st !== 'on' || lines.length >= 2) continue;
        const ready = questReady(S, q);
        lines.push(['★ ' + q.title + (ready ? ' — back to ' + NPCS[q.npc].name : q.n > 1 ? ' ' + questProgress(S, q) + '/' + q.n : ''), ready ? '#3a7a2a' : '#8a5a1a']);
      }
      for (const id of S.featured || []) {
        const sp = SPECIES_BY_ID[id], j = S.journal[id];
        if (!sp || j.h >= 3) continue;
        lines.push([(j.h ? sp.name : '???') + ' ' + j.h + '/3 · ' + ZONES_LABEL[sp.zone], '#3a2614']);
      }
      const ready = SPECIES.filter((s) => S.journal[s.id].h >= 3 && S.journal[s.id].n === 0 && s.site !== 'parasite' && !Array.from(S.objs.values()).some((o) => o.type === 'nest' && o.kind === s.id && o.st !== 'old'));
      for (const s of ready.slice(0, 2)) lines.push(['Ready to build: ' + s.name, '#3a6ab0']);
      if (!lines.length) lines.push(['Nest more species to attract new birds', '#6e5232']);
    }
    if (!lines.length) return;
    const maxW = Math.min(200, Math.floor(v.w * 0.42));
    // wrap long lines
    const rows = [];
    for (const [t, c, mk] of lines) {
      const wrapped = ui.font.wrap(t, maxW - 14 - (mk ? 6 : 0));
      wrapped.forEach((wl, k) => rows.push([k ? '  ' + wl : wl, c, k ? null : mk]));
    }
    const w = Math.min(maxW, Math.max(ui.font.measure(title), ...rows.map((l) => ui.font.measure(l[0]) + (l[2] ? 6 : 0))) + 14);
    const h = 14 + rows.length * 10;
    const x = v.w - w - 3, y = 26;
    this.trackerRect = [x, y, w, h];
    if (game.modal && v.w < 520) return;
    ui.panel('paper', x, y, w, h);
    ui.text(title.length > 32 ? title.slice(0, 31) + '…' : title, x + 6, y + 4, '#3a6ab0');
    rows.forEach(([t, c, mk], i) => {
      if (mk) ui.icon(SPR.matIcon(mk), x + 4, y + 13 + i * 10, 0.5);
      ui.text(t, x + 6 + (mk ? 6 : 0), y + 14 + i * 10, c);
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
      ui.text('Say: ' + game.chatText + cur, 7, v.h - 50, '#f6ecd2');
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
    g.fillStyle = '#f6ecd2';
    const kx = st.active ? clamp(st.x - st.cx, -20, 20) : 0, ky = st.active ? clamp(st.y - st.cy, -20, 20) : 0;
    g.beginPath(); g.arc(jx + kx, jy + ky, 9, 0, 7); g.fill();
    g.globalAlpha = 1;
    // A / B buttons
    const ax = v.w - 34, ay = v.h - 62;
    const btn = (id, x, y, label, act) => {
      const s = ui.widget(id, x - 14, y - 14, 28, 28);
      g.globalAlpha = s.clicked ? 0.9 : 0.55;
      g.fillStyle = id.endsWith('a') ? '#4a8a3a' : '#3a6ab0';
      g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill();
      g.globalAlpha = 1;
      ui.text(label, x, y - 4, '#ffffff', { align: 'center' });
      if (s.clicked) Input.inject(act);
    };
    btn('tc:a', ax, ay, 'A', 'act');
    btn('tc:b', ax - 32, ay + 18, 'B', 'alt');
  },
};
