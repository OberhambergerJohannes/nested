'use strict';
// Links between the game client and the authoritative World.
//  LocalLink – solo: the World runs in this page.
//  HostLink  – co-op host: the World runs in this page; guests connect through the relay server.
//  GuestLink – co-op guest: talks to the host's World through the relay server.
// Relay protocol (text frames): host <-> relay "<guestId>|<json>" / "*|<json>", relay control "@cmd|arg".

function wsURL() { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'; }
function roomCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return s; }

class LocalLink {
  constructor(world, game) {
    this.world = world;
    this.game = game;
    this.inbox = [];
    this.pid = 'L';
    this.isNet = false;
    world.out = {
      send: (pid, msg) => { if (pid === this.pid) this.inbox.push(JSON.parse(JSON.stringify(msg))); },
      broadcast: (msg) => { this.inbox.push(JSON.parse(JSON.stringify(msg))); },
    };
  }
  join(hello) { this.world.join(this.pid, hello); this.world.flush(); }
  send(msg) { this.world.handle(this.pid, JSON.parse(JSON.stringify(msg))); }
  update(dt) { this.world.tick(dt); }
  drain() { const m = this.inbox; this.inbox = []; return m; }
  close() { /* nothing to close */ }
}

class HostLink extends LocalLink {
  constructor(world, game) {
    super(world, game);
    this.isNet = true;
    this.code = roomCode();
    this.ws = null;
    this.closing = false;
    this.tries = 0;
    world.out = {
      send: (pid, msg) => {
        if (pid === this.pid) { this.inbox.push(JSON.parse(JSON.stringify(msg))); return; }
        if (pid[0] === 'g' && this.ws && this.ws.readyState === 1) this.ws.send(pid.slice(1) + '|' + JSON.stringify(msg));
      },
      broadcast: (msg) => {
        const s = JSON.stringify(msg);
        this.inbox.push(JSON.parse(s));
        if (this.ws && this.ws.readyState === 1 && this.world.players.size > 1) this.ws.send('*|' + s);
      },
    };
    this.connect();
  }

  connect() {
    const prof = Profile.get() || { name: 'Host' };
    const url = wsURL() + '?role=host&room=' + this.code + '&name=' + encodeURIComponent(prof.name) + '&valley=' + encodeURIComponent(this.world.name);
    let ws;
    try { ws = new WebSocket(url); } catch (e) { this.inbox.push({ t: 'link', what: 'error', reason: 'Could not reach the co-op server.' }); return; }
    this.ws = ws;
    ws.onmessage = (e) => this.onRelay(String(e.data));
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      for (const pid of Array.from(this.world.players.keys())) if (pid[0] === 'g') this.world.leave(pid);
      this.world.flush();
      if (!this.closing && !this.retrying) this.inbox.push({ t: 'link', what: 'closed' });
    };
  }

  onRelay(data) {
    if (data[0] === '@') {
      const bar = data.indexOf('|');
      const cmd = bar < 0 ? data.slice(1) : data.slice(1, bar), arg = bar < 0 ? '' : data.slice(bar + 1);
      if (cmd === 'ok') this.inbox.push({ t: 'link', what: 'room', code: this.code });
      else if (cmd === 'taken' && this.tries++ < 5) {
        this.retrying = true;
        const old = this.ws; this.ws = null; old.close();
        this.code = roomCode();
        this.retrying = false;
        this.connect();
      } else if (cmd === 'leave') {
        const pid = 'g' + arg;
        if (this.world.players.has(pid)) { this.world.leave(pid); this.world.flush(); }
      }
      return;
    }
    const bar = data.indexOf('|');
    if (bar < 0) return;
    const pid = 'g' + data.slice(0, bar);
    let msg;
    try { msg = JSON.parse(data.slice(bar + 1)); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      if (this.world.players.size >= MAX_PLAYERS) { this.ws.send(pid.slice(1) + '|' + JSON.stringify({ t: 'full' })); return; }
      this.world.join(pid, msg);
      this.world.flush();
    } else this.world.handle(pid, msg);
  }

  close() { this.closing = true; if (this.ws) this.ws.close(); }
}

class GuestLink {
  constructor(code, game, hello) {
    this.isNet = true;
    this.inbox = [];
    this.closing = false;
    let ws;
    try { ws = new WebSocket(wsURL() + '?role=guest&room=' + encodeURIComponent(code)); }
    catch (e) { this.inbox.push({ t: 'link', what: 'closed', reason: 'Could not reach the co-op server.' }); return; }
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify(hello));
    ws.onmessage = (e) => {
      const d = String(e.data);
      if (d[0] === '@') {
        const reasons = { hostleft: 'The host closed their valley.', noroom: 'No valley with that room code.', full: 'That valley is full.' };
        const cmd = d.slice(1).split('|')[0];
        if (reasons[cmd]) { this.closing = true; this.inbox.push({ t: 'link', what: 'closed', reason: reasons[cmd] }); ws.close(); }
        return;
      }
      let m;
      try { m = JSON.parse(d); } catch (err) { return; }
      if (m.t === 'full') { this.closing = true; this.inbox.push({ t: 'link', what: 'closed', reason: 'That valley is full.' }); ws.close(); return; }
      this.inbox.push(m);
    };
    ws.onclose = () => { if (!this.closing) this.inbox.push({ t: 'link', what: 'closed', reason: 'Lost the connection to the host.' }); };
  }
  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  update() { /* events arrive asynchronously */ }
  drain() { const m = this.inbox; this.inbox = []; return m; }
  close() { this.closing = true; if (this.ws) this.ws.close(); }
}
