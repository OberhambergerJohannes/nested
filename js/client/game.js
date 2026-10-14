'use strict';
// The game client: main loop, player control, interaction targeting and reacting to host events.

class Game {
  constructor() {
    this.ui = new UI();
    this.fx = new FX();
    this.birds = new Birds(this);
    this.renderer = new Renderer(this);
    this.state = null;
    this.link = null;
    this.mode = 'title';
    this.title = null;
    this.modals = [];
    this.toasts = [];
    this.chatLog = [];
    this.chatOpen = false;
    this.chatText = '';
    this.selSlot = -1;
    this.cam = { x: 0, y: 0 };
    this.target = null;
    this.placeGhost = null;
    this.shakeT = new Map();
    this.begT = new Map();
    this.posT = 0;
    this.lastPos = null;
    this.observe = null;
    this.actT = 0;
    this.stepT = 0;
    this.tracked = null;
    this.server = false;
    this.isHost = false;
    this.roomCode = null;
    this.nightLevel = 0;
    this.dt = 16;
    this.view = { w: 480, h: 270, scale: 3 };
    this.touchPref = 'auto';
    try { this.touchPref = localStorage.getItem('nested.touch') || 'auto'; } catch (e) { /* ignore */ }
  }

  get modal() { return this.modals[this.modals.length - 1] || null; }
  get me() { return this.state ? this.state.players.get(this.state.me) : null; }

  // ---------------------------------------------------------------- boot
  boot() {
    this.canvas = document.getElementById('game');
    this.g = this.canvas.getContext('2d', { alpha: false });
    SPR.init();
    Audio2.loadPrefs();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    Input.init(this.canvas, this.view);
    Input.uiHit = (x, y) => this.ui.hit(x, y);
    this.title = new TitleScreen();
    try {
      // favicon: a little blue tit, drawn by the game itself
      const s = SPR.bird('bluetit');
      const cv = document.createElement('canvas'); cv.width = cv.height = 32;
      const cg = cv.getContext('2d'); cg.imageSmoothingEnabled = false;
      cg.drawImage(s.perch, 0, 0, s.w, s.h, 0, -2, 32, 32);
      const link = document.querySelector('link[rel=icon]');
      if (link) link.href = cv.toDataURL();
    } catch (e) { /* ignore */ }
    if (location.protocol.startsWith('http')) {
      this.fetchRooms().then(() => { this.server = true; }).catch(() => { this.server = false; });
    }
    window.addEventListener('beforeunload', () => { if (this.isHost && this.link && this.link.world && this.link.world.onSave) this.link.world.onSave(); });
    // If the browser takes keyboard focus away (another window, or the page around an embedded game),
    // pause and tell the player instead of silently ignoring keys.
    window.addEventListener('blur', () => { if (this.mode === 'play') { this.focusLost = true; this._pauseSync(); } });
    window.addEventListener('focus', () => { this.focusLost = false; this._pauseSync(); });
    this.canvas.addEventListener('pointerdown', () => {
      try { this.canvas.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      if (this.focusLost) { this.focusLost = false; this._pauseSync(); }
    });
    this.last = performance.now();
    const loop = (t) => { this.frame(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const host = document.body;
    const cw = host.clientWidth || window.innerWidth, ch = host.clientHeight || window.innerHeight;
    const W = Math.floor(cw * dpr), H = Math.floor(ch * dpr);
    const scale = Math.max(1, Math.floor(Math.min(W / 400, H / 225)));
    const vw = Math.ceil(W / scale), vh = Math.ceil(H / scale);
    this.canvas.width = vw; this.canvas.height = vh;
    this.canvas.style.width = (vw * scale / dpr) + 'px';
    this.canvas.style.height = (vh * scale / dpr) + 'px';
    this.view.w = vw; this.view.h = vh; this.view.scale = scale;
    this.g.imageSmoothingEnabled = false;
  }

  touchControls() { return this.touchPref === 'on' || (this.touchPref === 'auto' && Input.touchMode); }

  fetchRooms() {
    return fetch('rooms', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('no server'); return r.json(); });
  }

  // ---------------------------------------------------------------- modals & toasts
  openModal(m) {
    this.modals.push(m);
    this.ui.focus = null;
    this.ui.wantFocus = m.defaultFocus || null;
    this._consumeInput();
    this._pauseSync();
  }
  closeModal() {
    this.modals.pop();
    this.ui.focus = null;
    this.ui.stopEditing();
    this._consumeInput();
    this._pauseSync();
  }
  // the key/click that opened or closed a window must not also act on what's underneath
  _consumeInput() { Input.pressed.clear(); Input.mouse.clicked = false; Input.mouse.rclicked = false; }
  closeAll() { this.modals = []; this.ui.stopEditing(); this._pauseSync(); }
  _pauseSync() {
    if (this.mode !== 'play' || !this.link) return;
    const want = this.modals.some((m) => m.pause) || !!this.focusLost;
    if (want !== this._paused) { this._paused = want; this.send({ t: 'act', a: 'pause', v: want }); }
  }
  isPausedLocal() { return this._paused && this.state && this.state.players.size === 1; }

  toast(text, icon) {
    this.toasts.push({ text, icon, t: 0, life: 2600 + text.length * 35 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  send(msg) { if (this.link) this.link.send(msg); }

  // ---------------------------------------------------------------- sessions
  startHosting(mode, slot, newName) {
    const prof = Profile.get();
    const data = Saves.load(slot);
    if (!prof) { this.openModal(new CreateScreen({ mode, slot, newWorld: !data })); return; }
    let world;
    try {
      world = (data && !newName) ? World.fromSave(data) : World.create(newName || 'Featherbrook', Math.floor(Math.random() * 1e9));
    } catch (e) {
      console.error(e);
      this.toast('Could not load this save: ' + e.message, 'no');
      return;
    }
    world.onSave = () => { if (!Saves.save(slot, world.serialize())) this.toast('Saving failed (browser storage full?)', 'no'); };
    this.isHost = true;
    this.slot = slot;
    this.closeAll();
    this.link = mode === 'host' ? new HostLink(world, this) : new LocalLink(world, this);
    this.link.join({ t: 'hello', token: Profile.token(), name: prof.name, look: prof.look });
    if (newName) world.onSave();
  }

  joinRoom(code) {
    const prof = Profile.get();
    if (!prof) { this.openModal(new CreateScreen({ join: code })); return; }
    this.isHost = false;
    this.closeAll();
    this.toast('Connecting to ' + code + '…', 'people');
    this.link = new GuestLink(code, this, { t: 'hello', token: Profile.token(), name: prof.name, look: prof.look });
  }

  quitToTitle(reason) {
    if (this.link) {
      if (this.isHost && this.link.world && this.link.world.onSave) this.link.world.onSave();
      this.link.close();
    }
    this.link = null;
    this.state = null;
    this.mode = 'title';
    this.isHost = false;
    this.roomCode = null;
    this.modals = [];
    this._paused = false;
    Audio2.setRain(false);
    if (reason) this.toast(reason, 'no');
  }

  // ---------------------------------------------------------------- inbox
  processInbox() {
    if (!this.link) return;
    const msgs = this.link.drain();
    for (const m of msgs) {
      if (!m) continue;
      switch (m.t) {
        case 'welcome': this.onWelcome(m); break;
        case 'pl': if (this.state) this.state.onPositions(m); break;
        case 'ev': if (this.state) this.state.apply(m.e, this); break;
        case 'link': this.onLinkEvent(m); break;
      }
    }
  }

  onLinkEvent(m) {
    if (m.what === 'room') { this.roomCode = m.code; this.toast('Your valley is open! Room code: ' + m.code, 'people'); }
    else if (m.what === 'closed') { if (this.isHost) { this.roomCode = null; this.toast('Co-op server connection lost — playing on solo.', 'no'); } else this.quitToTitle(m.reason || 'Disconnected from the host.'); }
    else if (m.what === 'error') this.toast(m.reason, 'no');
  }

  onWelcome(m) {
    const first = !this.state;
    if (!this.state) this.state = new ClientState();
    const me = this.me;
    const keep = me && !m.day ? { x: me.x, y: me.y } : null;
    this.state.loadSnap(m.snap);
    if (keep && this.me) { this.me.x = keep.x; this.me.y = keep.y; }
    this.renderer.invalidateAll();
    this.birds.reset();
    if (this.mode !== 'play') {
      this.mode = 'play';
      this.closeAll();
      const p = this.me;
      if (p) { this.cam.x = p.x - this.view.w / 2; this.cam.y = p.y - this.view.h / 2; }
      Audio2.unlock();
    }
    if (m.day) {
      this.closeAll();
      this.observe = null;
      // rank-ups from the night show up after the morning summary
      const ups = (this.state.prog && this.state.prog.lvlUps) || [];
      for (let i = ups.length - 1; i >= 0; i--) this.openModal(new LevelUpScreen(ups[i].lvl, ups[i].got));
      this.openModal(new DayScreen(m.day));
      this.fx = new FX();
    } else if (first && this.state.quest === 0) {
      this.toast('Welcome! Your mailbox has a letter — walk to it and press ' + Input.keyLabel('act') + '.', 'letter');
    }
  }

  // ---------------------------------------------------------------- event hooks (called by ClientState)
  onObjAdded(o) {
    if (o.type === 'nest') this.birds.syncNests();
    if (o.type !== 'forage' && o.type !== 'web' && o.type !== 'puddle') this.state.mapDirty = true;
  }
  onObjUpdated(o, patch, prevSt) {
    if (o.type === 'nest' && 'st' in patch) {
      this.birds.syncNests();
      if (patch.st === 'pair' && prevSt !== 'pair') { const a = nestAnchor(this.state, o); this.fx.burst('heart', a.x, a.y - a.z - 6, 4); }
    }
    if ('st' in patch && o.type !== 'nest') this.state.mapDirty = true;
  }
  onObjRemoved(o) {
    if (o.type === 'nest') this.birds.syncNests();
    this.shakeT.delete(o.id);
    this.state.mapDirty = true;
  }
  onCoins(delta) {
    if (delta > 0) { Audio2.sfx('coin'); const me = this.me; if (me) this.fx.text('+' + delta, me.x, me.y - 24, '#f6d860', SPR.ui('coin')); }
  }
  onClue(sp, i, src, pid, name) {
    const mine = pid === this.state.me;
    if (src === 'ada') return; // Ada tells you in person
    // a clue given in a conversation shows up once the conversation is over
    if (mine && this.modal instanceof DialogueScreen) { this.modals.splice(this.modals.length - 1, 0, new ClueScreen(sp, i, src)); return; }
    if (mine) this.openModal(new ClueScreen(sp, i, src));
    else this.toast(name + ' found a clue: ' + SPECIES_BY_ID[sp].name + ' (' + (i + 1) + '/3)', 'clue');
  }
  onFx(kind, id, x, y) {
    const S = this.state;
    const o = id ? S.objs.get(id) : null;
    let px = x, py = y;
    if (o) { const [w] = footprint(o); px = o.x * TS + w * 8; py = o.y * TS + 10; }
    const season = S.time.season;
    switch (kind) {
      case 'shake':
        if (o) this.shakeT.set(o.id, 450);
        this.fx.burst('leaf', px, py - (o && o.type === 'tree' ? 26 : 8), o && o.type === 'tree' ? 7 : 4, season);
        Audio2.sfx('shake', px, py);
        break;
      case 'rustle': this.fx.burst('grass', px, py - 6, 6); Audio2.sfx('rustle', px, py); break;
      case 'scrape': this.fx.burst('dust', px, py - 4, 5); this.fx.burst('grass', px, py - 6, 3); Audio2.sfx('scrape', px, py); break;
      case 'crumble': this.fx.burst('chip', px, py - 4, 7); Audio2.sfx('crumble', px, py); break;
      case 'silk': this.fx.burst('sparkle', px, py - 8, 7); Audio2.sfx('silk', px, py); break;
      case 'mud': this.fx.burst('mud', px, py, 7); Audio2.sfx('mud', px, py); break;
      case 'pickup': this.fx.burst('sparkle', px, py - 4, 4); Audio2.sfx('pickup', px, py); break;
      case 'grass': this.fx.burst('grass', px, py - 4, 9); Audio2.sfx('rustle', px, py); break;
      case 'dig': this.fx.burst('dust', px, py, 7); Audio2.sfx('dig', px, py); break;
      case 'splash': this.fx.burst('splash', px, py, 12); Audio2.sfx('splash', px, py); break;
      case 'place': this.fx.burst('dust', px, py, 8); Audio2.sfx('place', px, py); break;
      case 'plant': this.fx.burst('dust', px, py, 5); this.fx.burst('leaf', px, py - 4, 3, SPRING); Audio2.sfx('plant', px, py); break;
      case 'build': {
        if (o && o.type === 'nest') { const a = nestAnchor(S, o); px = a.x; py = a.y - a.z; }
        this.fx.burst('sparkle', px, py - 4, 12); this.fx.burst('feather', px, py - 4, 3);
        Audio2.sfx('build', px, py);
        break;
      }
      case 'hearts': {
        if (o && o.type === 'nest') { const a = nestAnchor(S, o); px = a.x; py = a.y - a.z; }
        this.fx.burst('heart', px, py - 6, 4);
        break;
      }
    }
  }
  onGain(pid, x, y, list) {
    const me = this.me;
    for (const [type, key, n] of list) {
      const icon = type === 'm' ? SPR.matIcon(key) : SPR.itemIcon(key);
      const name = type === 'm' ? MATS[key].name : ITEMS[key].name;
      if (pid === this.state.me && me) {
        this.fx.fly(icon, x, y, me, () => { this.fx.text('+' + n + ' ' + name, me.x, me.y - 24, '#ffffff', icon); Audio2.sfx('pop', me.x, me.y); });
      } else this.fx.text('+' + n, x, y - 8, '#e8e0d0', icon);
    }
  }
  onChat(name, text) {
    this.chatLog.push({ name, text, t: performance.now() });
    if (this.chatLog.length > 40) this.chatLog.shift();
    if (name) Audio2.sfx('tick');
  }
  onDialogue(d) {
    const top = this.modal;
    if (top instanceof DialogueScreen) top.set(d);
    else this.openModal(new DialogueScreen(d));
  }
  onLore(kind, first) { this.openModal(new LoreScreen(kind, first)); }
  // a small "+XP" float: feedback without fuss
  onXP(n, why) {
    const me = this.me;
    if (me && n > 0) this.fx.text('+' + n + ' XP', me.x, me.y - 34, '#9ae07a');
  }
  onLevel(lvl, got) {
    const scr = new LevelUpScreen(lvl, got);
    if (this.modal instanceof DialogueScreen) this.modals.splice(this.modals.length - 1, 0, scr);
    else this.openModal(scr);
  }
  // perks from birder rank
  perk(name) {
    const lvl = (this.state && this.state.prog && this.state.prog.lvl) || 1;
    for (const l in LEVEL_REWARDS) if (LEVEL_REWARDS[l].perk === name && lvl >= +l) return true;
    return false;
  }
  onFact(sp, text) { this.toast(SPECIES_BY_ID[sp].name + ': ' + text, 'star'); }
  onInv() {
    const S = this.state;
    if (this.autoSelect) {
      const want = this.autoSelect;
      this.autoSelect = null;
      const i = S.inv.findIndex((s, k) => k < HOTBAR && s && s.k === want);
      if (i >= 0) this.selSlot = i;
      else if (S.inv.some((s) => s && s.k === want)) this.toast('It went into your bag (' + Input.keyLabel('bag') + '). Move it to the top row to use it.', 'bag');
    }
    if (this.selSlot >= 0 && !S.inv[this.selSlot]) this.selSlot = -1;
  }
  onMail(l) { this.toast('New letter: ' + l.title, 'letter'); Audio2.sfx('mail'); }
  onVisitors() { this.birds.rebuildVisitors(); }
  onTeleport(x, y) { const me = this.me; if (me) { me.x = x; me.y = y; } }
  beg(nestId) { this.begT.set(nestId, 1600); }
  // A standing villager turns to face you when you come close
  npcFace(k, n) {
    const me = this.me;
    n = n || npcPos(k, this.state.clock());
    if (!me) return n.dir;
    const dx = me.x - n.x * TS, dy = me.y - n.y * TS;
    if (dx * dx + dy * dy > 60 * 60) return n.dir;
    return dirTo(dx, dy);
  }
  toScreen(x, y) { return [Math.round(x - this.cam.x), Math.round(y - this.cam.y)]; }

  // World positions that deserve a bouncing "!" marker
  questMarkers() {
    const S = this.state, out = [];
    const step = TUTORIAL[S.quest] ? TUTORIAL[S.quest].id : '';
    const b2 = (type, kind) => Array.from(S.objs.values()).find((o) => o.type === type && o.kind === kind);
    const b = (kind) => b2('building', kind);
    const mb = b('mailbox');
    if (mb && (step === 'mail' || S.mail.some((m) => !m.read))) out.push([mb.x * TS + 8, mb.y * TS - 14]);
    if (step === 'ada') { const n = npcPos('ada', S.clock()); out.push([n.x * TS, n.y * TS - 30]); }
    // villagers with a request ('!') or waiting for you to come back ('?')
    for (const k in NPCS) {
      const nq = npcQuest(S, k);
      if (!nq || nq.state === 'active') continue;
      const n = npcPos(k, S.clock());
      if (!n.away) out.push([n.x * TS, n.y * TS - (NPCS[k].kid ? 24 : 30), nq.state === 'ready' ? '?' : '!']);
    }
    // deliveries waiting at their recipient, and landmarks a quest sends you to
    for (const q of QUESTS) {
      const st = S.side && S.side[q.id];
      if (!st || st.st !== 'on') continue;
      if (q.kind === 'deliver') { const n = npcPos(q.to, S.clock()); if (!n.away) out.push([n.x * TS, n.y * TS - (NPCS[q.to].kid ? 24 : 30), '?']); }
      if (q.kind === 'trip' && !st.n) { const l = b2('landmark', q.lm); if (l) out.push([l.x * TS + (LANDMARKS[q.lm].w || 1) * 8, l.y * TS - 26, '!']); }
    }
    if (step === 'craft') { const be = b('bench'); if (be) out.push([be.x * TS + 16, be.y * TS - 14]); }
    if (step === 'sleep') { const c = b('cottage'); if (c) out.push([(c.x + 2) * TS + 8, (c.y + 2) * TS - 4]); }
    return out;
  }

  // ---------------------------------------------------------------- frame
  frame(t) {
    const dt = clamp(t - this.last, 0, 50);
    this.last = t;
    this.dt = dt;
    Input.poll();
    if (this.link) this.link.update(dt);
    this.processInbox();
    const g = this.g, v = this.view;
    this.ui.begin(g, v, this.mode !== 'play' || !!this.modal);
    if (this.mode === 'play' && this.state && this.me) {
      this.updatePlay(dt);
      this.renderer.draw(g, v, this.cam, t);
      if (dt < 25) this.renderer.prewarm(this.state, this.cam, v, 5);
      this.ui.lock = !!this.modal;
      HUD.draw(this.ui, this, dt);
      this.ui.lock = false;
    } else if (this.mode === 'play') {
      g.fillStyle = '#1d1a2b'; g.fillRect(0, 0, v.w, v.h);
      this.ui.text('Loading the valley…', v.w / 2, v.h / 2, '#f6ecd2', { align: 'center' });
    } else {
      this.ui.lock = !!this.modal;
      this.title.draw(this.ui, dt);
      this.ui.lock = false;
    }
    // modal screens on top
    if (this.modal) {
      if (this.mode === 'play' && !(this.modal instanceof DayScreen) && !(this.modal instanceof SleepScreen) && !(this.modal instanceof DialogueScreen)) {
        g.fillStyle = 'rgba(20,18,32,0.35)'; g.fillRect(0, 0, v.w, v.h);
      }
      this.modal.draw(this.ui, dt);
    }
    if (this.mode === 'play' && this.focusLost) {
      g.fillStyle = 'rgba(20,18,32,0.55)'; g.fillRect(0, 0, v.w, v.h);
      const msg = 'Paused — click the game to keep playing';
      const w = this.ui.font.measure(msg) + 16;
      this.ui.panel('dark', Math.floor((v.w - w) / 2), Math.floor(v.h / 2) - 9, w, 18);
      this.ui.text(msg, v.w / 2, Math.floor(v.h / 2) - 4, '#f6ecd2', { align: 'center' });
    }
    // toasts also on the title screen
    if (this.mode !== 'play' && this.toasts.length) {
      for (const tt of this.toasts) tt.t += dt;
      this.toasts = this.toasts.filter((tt) => tt.t < tt.life);
      let ty = 4;
      for (const tt of this.toasts) {
        const w = this.ui.font.measure(tt.text) + 12;
        this.ui.panel('dark', Math.floor((v.w - w) / 2), ty, w, 13);
        this.ui.text(tt.text, Math.floor((v.w - w) / 2) + 6, ty + 2, '#f6ecd2');
        ty += 15;
      }
    }
    this.ui.end();
    Input.endFrame();
  }

  updatePlay(dt) {
    const S = this.state, me = this.me;
    if (!this.isPausedLocal()) S.clockMs = Math.min(S.clockMs + dt, MS_PER_MIN * 12);
    Audio2.listener.x = me.x; Audio2.listener.y = me.y;
    Audio2.updateMusic(S.time.season, S.clock(), true);
    Audio2.setRain(S.weather === 'rain');
    for (const tt of this.toasts) tt.t += dt;
    this.toasts = this.toasts.filter((tt) => tt.t < tt.life);
    for (const [k, v] of this.shakeT) { if (v - dt <= 0) this.shakeT.delete(k); else this.shakeT.set(k, v - dt); }
    for (const [k, v] of this.begT) { if (v - dt <= 0) this.begT.delete(k); else this.begT.set(k, v - dt); }
    // sleeping players wait in the dark
    if (me.sleep && !(this.modal instanceof SleepScreen) && !(this.modal instanceof DayScreen)) this.openModal(new SleepScreen());
    const free = !this.modal;
    // ---- chat
    const multi = S.players.size > 1 || (this.link && this.link.isNet);
    if (this.chatOpen) {
      this.chatText = (this.chatText + Input.text.buf).slice(0, 100);
      for (let i = 0; i < Input.text.back; i++) this.chatText = this.chatText.slice(0, -1);
      if (Input.text.enter) { if (this.chatText.trim()) this.send({ t: 'act', a: 'chat', text: this.chatText }); this.chatOpen = false; this.chatText = ''; Input.stopText(); }
      if (Input.text.esc) { this.chatOpen = false; this.chatText = ''; Input.stopText(); }
    } else if (free) {
      if (multi && (Input.hit('chat') || Input.hit('enter'))) { this.chatOpen = true; this.chatText = ''; Input.startText(); }
      else if (Input.hit('journal')) this.openModal(new JournalScreen());
      else if (Input.hit('bag')) this.openModal(new BagScreen());
      else if (Input.hit('map')) this.openModal(new MapScreen());
      else if (Input.hit('cancel') && this.holding()) { this.selSlot = -1; Audio2.sfx('close'); }
      else if (Input.hit('cancel') || Input.hit('menu')) this.openModal(new PauseScreen());
      for (let i = 0; i < HOTBAR; i++) if (Input.hit('hot' + (i + 1))) { this.selSlot = this.selSlot === i ? -1 : i; Audio2.sfx('tick'); }
      const step = Input.mouse.wheel || (Input.hit('next') ? 1 : 0) - (Input.hit('prev') ? 1 : 0);
      if (step) {
        // cycle through the 8 slots plus "empty hands" (-1)
        const cur = this.selSlot < 0 ? HOTBAR : this.selSlot;
        const nxt = (cur + step + HOTBAR + 1) % (HOTBAR + 1);
        this.selSlot = nxt === HOTBAR ? -1 : nxt;
        Audio2.sfx('tick');
      }
    }
    // ---- movement
    const canMove = free && !this.chatOpen && !me.sleep;
    let [mx, my] = canMove ? Input.move() : [0, 0];
    if (this.observe && (mx || my)) this.cancelObserve();
    if (mx || my) {
      const speed = PLAYER_SPEED * speedAt(S, me.x, me.y);
      const dist = speed * dt / 1000;
      const steps = Math.max(1, Math.ceil(dist / 1.5));
      for (let i = 0; i < steps; i++) [me.x, me.y] = moveActor(S, me.x, me.y, mx * dist / steps, my * dist / steps);
      me.d = Math.abs(mx) > Math.abs(my) ? (mx < 0 ? 1 : 2) : (my < 0 ? 3 : 0);
      me.m = 1;
      me.walkT = (me.walkT || 0) + dt;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 300;
        const tx = Math.floor(me.x / TS), ty = Math.floor(me.y / TS);
        const t = tileAt(S, tx, ty);
        const tall = inBounds(tx, ty) && S.grass[tIdx(tx, ty)] === 2;
        if (tall) { Audio2.sfx('rustle', me.x, me.y); if (Math.random() < 0.5) this.fx.burst('grass', me.x, me.y - 4, 2); }
        else Audio2.sfx(isWaterT(t) || t === T.MUD ? 'stepw' : 'step');
        if (isWaterT(t)) this.fx.burst('ripple', me.x, me.y, 1);
      }
    } else { me.m = 0; me.walkT = 0; }
    // ---- interaction
    this.actT = Math.max(0, this.actT - dt);
    me.a = this.observe ? 'obs' : this.actT > 0 ? 'act' : '';
    this.target = (free && !this.chatOpen) ? this.computeTarget() : null;
    if (!free || this.chatOpen) this.placeGhost = null;
    if (this.target && canMove && !this.observe) {
      const mouseAct = Input.mouse.clicked && !this.ui.hit(Input.mouse.x, Input.mouse.y) && this._mouseNear();
      if (Input.hit('act') || mouseAct) { if (this.target.exec) { this.target.exec(); this.actT = 260; } }
      else if (Input.hit('alt') || (Input.mouse.rclicked && this._mouseNear())) { if (this.target.altExec) this.target.altExec(); else if (this.target.exec) this.target.exec(); }
    }
    if (this.observe) this.updateObserve(dt);
    // ---- others
    for (const p of S.players.values()) {
      if (p.pid === S.me) continue;
      const dx = p.tx - p.x, dy = p.ty - p.y;
      if (Math.abs(dx) > 120 || Math.abs(dy) > 120) { p.x = p.tx; p.y = p.ty; }
      else { p.x += dx * Math.min(1, dt / 90); p.y += dy * Math.min(1, dt / 90); }
      if (p.m) p.walkT = (p.walkT || 0) + dt; else p.walkT = 0;
    }
    for (const a of S.animals.values()) {
      a.x += (a.tx - a.x) * Math.min(1, dt / 120); a.y += (a.ty - a.y) * Math.min(1, dt / 120);
    }
    this.birds.update(dt);
    this.fx.update(dt);
    // ---- camera
    const v = this.view;
    const tx = clamp(me.x - v.w / 2, 0, MAP_W * TS - v.w), ty = clamp(me.y - 12 - v.h / 2, 0, MAP_H * TS - v.h);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt / 120);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt / 120);
    if (MAP_W * TS < v.w) this.cam.x = (MAP_W * TS - v.w) / 2;
    if (MAP_H * TS < v.h) this.cam.y = (MAP_H * TS - v.h) / 2;
    this.cam.x = Math.round(this.cam.x); this.cam.y = Math.round(this.cam.y);
    // ---- network position
    this.posT -= dt;
    const moved = !this.lastPos || Math.abs(this.lastPos[0] - me.x) > 0.5 || Math.abs(this.lastPos[1] - me.y) > 0.5 || this.lastPos[2] !== me.d || this.lastPos[3] !== me.m || this.lastPos[4] !== me.a;
    if ((moved && this.posT <= 0) || this.posT < -1000) {
      this.posT = 66;
      this.lastPos = [me.x, me.y, me.d, me.m, me.a];
      this.send({ t: 'pos', x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, d: me.d, m: me.m, a: me.a });
    }
  }

  _mouseNear() {
    const me = this.me;
    if (Input.touchMode) return false;
    const wx = Input.mouse.x + this.cam.x, wy = Input.mouse.y + this.cam.y;
    return dist2(wx, wy, me.x, me.y - 8) < 60 * 60;
  }

  // ---------------------------------------------------------------- observing birds
  startObserve(agent) {
    this.observe = { agent, t: 0, need: this.perk('binoculars') ? 850 : 1300 };
    agent.observed = true;
    Audio2.sfx('open');
  }
  cancelObserve() {
    if (this.observe) this.observe.agent.observed = false;
    this.observe = null;
  }
  updateObserve(dt) {
    const o = this.observe, a = o.agent, me = this.me;
    if (a.hidden || a.state === 'fly' || !this.birds.agents.includes(a) || dist2(a.x, a.y, me.x, me.y) > 110 * 110) { this.cancelObserve(); this.toast('The bird flew off — try again!', ''); return; }
    o.t += dt;
    me.d = Math.abs(a.x - me.x) > Math.abs(a.y - me.y) ? (a.x < me.x ? 1 : 2) : (a.y < me.y ? 3 : 0);
    if (o.t >= o.need) {
      if (a.ambient) {
        const sp = SPECIES_BY_ID[a.sp];
        this.toast(sp.name + ' (' + sp.latin + '): ' + pick(sp.facts) + ' A common bird of the valley.', 'binoculars');
        a.observed = false;
        this.observe = null;
        return;
      }
      this.send({ t: 'act', a: 'obs', sp: a.sp });
      a.observed = false;
      if (a.role === 'lead') setTimeout(() => { if (this.birds.agents.includes(a)) this.birds.flyTo(a, this.birds.pickPerch(a.sp, a.zone), 80); }, 700);
      this.observe = null;
    }
  }

  // ---------------------------------------------------------------- targeting
  // The item currently in hand (hotbar), or null for empty hands
  holding() { const s = this.state && this.state.inv[this.selSlot]; return s ? s.k : null; }

  computeTarget() {
    const S = this.state, me = this.me;
    const dv = DIR_VEC[me.d];
    const ipx = me.x + dv[0] * 12, ipy = me.y - 3 + dv[1] * 12;
    const ftx = Math.floor(ipx / TS), fty = Math.floor(ipy / TS);
    const selItem = this.holding();
    this.placeGhost = null;
    const world = this._worldTarget(ipx, ipy, ftx, fty);
    // placing / planting the item in hand; the normal interaction stays on F
    if (selItem && ITEMS[selItem] && ITEMS[selItem].cat !== 'forage') {
      const chk = canPlace(S, selItem, ftx, fty, Array.from(S.players.values()));
      this.placeGhost = { x: ftx, y: fty, ok: chk.ok };
      if (chk.ok) {
        const slot = this.selSlot;
        const t = { label: placeLabel(selItem), anchor: [ftx * TS + 8, fty * TS], box: [ftx * TS, fty * TS, ftx * TS + 15, fty * TS + 15],
          exec: () => this.send({ t: 'act', a: 'place', slot, x: ftx, y: fty }) };
        if (world) { t.alt = world.label || world.alt; t.altExec = world.exec || world.altExec; }
        return t;
      }
    }
    return world;
  }

  _worldTarget(ipx, ipy, ftx, fty) {
    const S = this.state, me = this.me;
    // 2. villagers
    const clock = S.clock();
    for (const k in NPCS) {
      const n = npcPos(k, clock);
      if (n.away) continue;
      const nx = n.x * TS, ny = n.y * TS;
      if (dist2(nx, ny - 6, ipx, ipy) < 18 * 18 || dist2(nx, ny, me.x, me.y) < 16 * 16) {
        const t = { label: 'Talk to ' + NPCS[k].name, anchor: [nx, ny - 30], box: [nx - 8, ny - 26, nx + 7, ny], exec: () => this.send({ t: 'act', a: 'talk', npc: k }) };
        const held = this.holding(), it = held && ITEMS[held];
        if (it && it.cat !== 'struct') { const slot = this.selSlot; t.alt = 'Give ' + it.name; t.altExec = () => this.send({ t: 'act', a: 'gift', npc: k, slot }); }
        return t;
      }
    }
    // 3. farm animals
    for (const a of S.animals.values()) {
      if (dist2(a.x, a.y - 4, ipx, ipy) < 16 * 16) {
        const lbl = a.kind === 'sheep' ? 'Brush the sheep' : a.kind === 'horse' ? 'Brush the horse' : 'Pet the hen';
        const r = a.kind === 'horse' ? 14 : 8;
        return { label: lbl, anchor: [a.x, a.y - 20], box: [a.x - r, a.y - r * 1.5, a.x + r, a.y], exec: () => {
          this.send({ t: 'act', a: 'brush', id: a.id });
          Audio2.sfx(a.kind === 'sheep' ? 'baa' : a.kind === 'horse' ? 'neigh' : 'cluck', a.x, a.y);
        } };
      }
    }
    // 4. objects in reach
    let best = null, bd = 15 * 15;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      for (const o of objsOnTile(S, ftx + dx, fty + dy)) {
        if (o.type === 'fence') continue;
        const [w, h] = footprint(o);
        let x0 = o.x * TS, y0 = o.y * TS, x1 = x0 + w * TS, y1 = y0 + h * TS;
        if (o.type === 'nest' && o.host) continue;
        const cx = clamp(ipx, x0, x1), cy = clamp(ipy, y0, y1);
        let d = dist2(cx, cy, ipx, ipy);
        if (o.type === 'forage' || o.type === 'web' || o.type === 'puddle') d -= 30; // small things win ties
        if (d < bd) { bd = d; best = o; }
      }
    }
    if (best) {
      const t = this.objTarget(best, ipx, ipy);
      if (t) return t;
    }
    // 5. tile actions
    const q = tileOp(S, ftx, fty);
    const groundSite = sitesOf(S, { tile: [ftx, fty] }).some((st) => SPECIES.some((sp) => sp.site === st && S.journal[sp.id] && S.journal[sp.id].h >= 2));
    if (q || groundSite) {
      const t = { anchor: [ftx * TS + 8, fty * TS], box: [ftx * TS, fty * TS, ftx * TS + 15, fty * TS + 15] };
      if (q) { t.label = q.label; t.exec = () => this.send({ t: 'act', a: 'tile', x: ftx, y: fty, op: q.op }); }
      if (groundSite) { t.alt = 'Nest site'; t.altExec = () => this.openModal(new SiteScreen({ tile: [ftx, fty] })); if (!t.exec) t.exec = t.altExec; }
      return t;
    }
    // 6. birds to observe
    const a = this.birds.observable(me.x, me.y - 10, this.perk('binoculars') ? 112 : 80);
    if (a) {
      const sp = SPECIES_BY_ID[a.sp], j = S.journal[a.sp];
      const known = a.ambient || (j && j.h > 0) || (sp.rare && S.rareLog && S.rareLog[a.sp]);
      const label = sp.rare && !known ? 'Observe the rare bird!' : 'Observe ' + (known ? sp.name : 'the bird');
      return { label, anchor: [a.x, a.y - a.z - 14], box: [a.x - 6, a.y - a.z - 12, a.x + 6, a.y - a.z], exec: () => this.startObserve(a) };
    }
    return null;
  }

  objTarget(o, ipx, ipy) {
    const S = this.state;
    const [w, h] = footprint(o);
    const box = [o.x * TS, o.y * TS, (o.x + w) * TS - 1, (o.y + h) * TS - 1];
    const anchor = [o.x * TS + w * 8, o.y * TS - 2];
    const t = { box, anchor };
    const q = quickOp(S, o);
    if (q) { t.label = q.label; t.exec = () => this.send({ t: 'act', a: 'use', id: o.id, op: q.op }); }
    if (o.type === 'struct' && o.kind === 'gardenbench') {
      if (S.players.size === 1 && S.clock() < 19 * 60) { t.label = 'Sit and rest until evening'; t.exec = () => this.openModal(new ConfirmScreen('Sit on the bench and watch the day go by until 7 pm?', () => this.send({ t: 'act', a: 'rest' }), 'Rest', 'Not now', true)); }
      else { t.label = 'Sit for a while'; t.exec = () => this.toast('A lovely spot to listen to the birds.', 'heart'); }
      return t;
    }
    // nests & nest sites
    if (o.type === 'nest') {
      t.label = 'View nest'; t.exec = () => this.openModal(new NestScreen(o.id));
      return t;
    }
    if (o.type === 'building') {
      const b = BUILDINGS[o.kind];
      if (o.kind === 'bench') { t.label = 'Craft at workbench'; t.exec = () => this.openModal(new CraftScreen()); return t; }
      if (o.kind === 'mailbox') { t.label = 'Read letters'; t.exec = () => this.openModal(new MailScreen()); return t; }
      if (o.kind === 'board') { t.label = 'Read the notice board'; t.exec = () => this.openModal(new BoardScreen()); return t; }
      if (o.kind === 'well' || o.kind === 'coop') { t.label = o.kind === 'well' ? 'An old well' : 'Mabel\'s hens live here'; t.exec = () => this.toast(o.kind === 'well' ? 'The water smells fresh and cold.' : 'Feathers! Check around the coop each morning.', ''); return t; }
      const doorX = b.door ? (o.x + b.door[0]) * TS + 8 : -999;
      const atDoor = Math.abs(ipx - doorX) < 12 && ipy > (o.y + b.h - 1) * TS;
      if (o.kind === 'cottage' && atDoor) {
        t.label = 'Go to bed';
        t.exec = () => this.openModal(new ConfirmScreen(S.players.size > 1 ? 'Go to bed? The day ends when everyone is asleep.' : 'Go to bed and end the day?', () => { this.send({ t: 'act', a: 'sleep', v: true }); Audio2.sfx('sleep'); }, 'Sleep', 'Not yet', true));
        if (S.players.size === 1 && S.clock() < 19 * 60) {
          t.alt = 'Rest until evening';
          t.altExec = () => this.openModal(new ConfirmScreen('Put the kettle on and rest until 7 pm? The birds of the night come out after dusk.', () => this.send({ t: 'act', a: 'rest' }), 'Rest', 'Not now', true));
          return t;
        }
      }
      if (o.kind === 'shop' && atDoor) {
        const open = !npcPos('basil', S.clock()).away;
        t.label = open ? 'Talk to Basil to shop' : 'Shop closed';
        t.exec = () => this.toast(open ? 'Basil is standing outside his shop.' : 'Closed for the night — Basil opens at 6:00 am.', '');
      }
      if (b.knock && atDoor) { t.label = 'Knock'; t.exec = () => { Audio2.sfx('knock'); this.toast(b.knock, ''); }; }
      if (!b.site) return t.exec ? t : null;
      const nests = nestsOfHost(S, o.id);
      const siteName = o.kind === 'barn' ? 'Barn nests' : 'Eaves';
      t.alt = nests.length ? siteName + ' (' + nests.length + ')' : siteName;
      t.altExec = () => this.openModal(new SiteScreen({ id: o.id }));
      if (!t.exec) { t.label = t.alt; t.exec = t.altExec; }
      return t;
    }
    if (isPotentialHost(o)) {
      const nests = nestsOfHost(S, o.id);
      if (nests.length === 1 && o.type !== 'building') { t.alt = 'View nest'; t.altExec = () => this.openModal(new NestScreen(nests[0].id)); }
      else { t.alt = o.pl ? 'Nest site / dig up' : 'Nest site'; if (o.type === 'struct') t.alt = 'Nest site'; t.altExec = () => this.openModal(new SiteScreen({ id: o.id })); }
      if (!t.exec) { t.label = t.alt; t.exec = t.altExec; }
      return t;
    }
    if (o.pl && (o.type === 'plant' || o.type === 'struct')) {
      t.alt = o.type === 'struct' ? 'Pick up' : 'Dig up';
      t.altExec = () => this.send({ t: 'act', a: 'pickup', id: o.id });
      if (!t.exec) {
        t.label = o.type === 'struct' ? STRUCTS[o.kind].name : FLORA[o.kind].name;
        t.exec = () => this.toast(this.describe(o), '');
      }
      return t;
    }
    if (!t.exec) {
      const d = this.describe(o);
      if (!d) return null;
      t.label = 'Look'; t.exec = () => this.toast(d, '');
    }
    return t;
  }

  describe(o) {
    const S = this.state;
    switch (o.type) {
      case 'rock': return o.kind === 'boulder' ? (o.li > 0 ? 'Lichen grows on this boulder.' : 'The lichen will grow back slowly — lichens grow only millimetres a year.') : 'The moss will grow back, faster after rain.';
      case 'log': return 'Old logs are full of beetles, fungi and moss. Come back tomorrow for more rotten wood.';
      case 'stump': return 'A mossy old stump.';
      case 'tree': return o.kind === 'snag' ? 'A standing dead tree. Woodpeckers love soft, rotting wood.' : 'You already shook this tree today.';
      case 'shrub': return 'You already took twigs from this shrub today.';
      case 'plant': {
        const f = FLORA[o.kind];
        if (o.st < 2) return f.name + ' — still growing.';
        if (f.harvest) return f.harvest.seasons.includes(S.time.season) ? 'Already harvested today.' : f.name + ': ready to harvest in ' + f.harvest.seasons.map((s) => SEASON_NAMES[s]).join(' & ') + '.';
        return f.name + ' — buzzing with insects.';
      }
      case 'struct': return STRUCTS[o.kind].name;
    }
    return '';
  }
}
