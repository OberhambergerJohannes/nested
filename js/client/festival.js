'use strict';
// The client side of the village festivals (rules in js/sim, data in js/data/festivals.js):
// decorations on the green, their lights, migrating flocks in the sky (and counting them on
// Migration Watch), the HUD tracker lines and the guide arrow to the green.

const FestivalView = {
  heard: new Set(),   // flocks whose calls already played as they passed (flock id + day)

  // Today's festival, or null
  today(S) { return S && S.time ? festivalOn(S.time) : null; },

  // Decorations on the green for a festival: {kind, x, y (base, world px), spr}
  decor(f, season) {
    const key = f.id + ':' + season;
    if (this._dk === key) return this._decor;
    const gx = FEST_GREEN[0] * TS, out = [];
    const put = (kind, spr, tx, ty) => out.push({ kind, spr, x: tx * TS, y: ty * TS });
    const lanterns = f.decor.includes('lanterns');
    if (f.decor.includes('bunting')) put('bunting', SPR.festDecor(lanterns ? 'buntingL' : 'bunting', season), 56.0, 31.1);
    if (f.decor.includes('table')) put('table', SPR.festDecor('table', season), 65.4, 35.1);
    if (f.decor.includes('bonfire')) put('bonfire', SPR.festDecor('bonfire', season), gx / TS, 33.9);
    if (f.decor.includes('scope')) put('scope', SPR.struct('scope', season), 62.7, 31.6);
    this._dk = key; this._decor = out;
    return out;
  },

  // Is the midsummer bonfire burning? (from the end of the hunt until the fair ends)
  bonfireLit(f, m) { return f.id === 'midsummer' && m >= f.until && m < f.gather[1]; },

  // Add the decorations to the renderer's depth-sorted list
  collect(R, S, now) {
    const f = this.today(S);
    if (!f) return;
    const m = S.clock();
    for (const d of this.decor(f, S.time.season)) {
      R._e(d.y, d.spr.img, Math.round(d.x - d.spr.ax), Math.round(d.y - d.spr.ay));
      if (d.kind === 'bonfire' && this.bonfireLit(f, m)) {
        const fl = SPR.festDecor('flame' + (Math.floor(now / 120) % 3), S.time.season);
        R._e(d.y + 0.5, fl.img, Math.round(d.x - fl.ax), Math.round(d.y - 3 - fl.ay));
      }
    }
  },

  // Extra light at night: paper lanterns on the bunting and the bonfire (world px: x, y, radius)
  lights(S, m, now, add) {
    const f = this.today(S);
    if (!f) return;
    for (const d of this.decor(f, S.time.season)) {
      if (d.kind === 'bunting' && f.decor.includes('lanterns')) {
        // the lanterns hang at a quarter, half and three quarters of each span (see genFestDecor)
        for (const fx of [0.125, 0.25, 0.375, 0.625, 0.75, 0.875]) add(d.x - d.spr.ax + d.spr.w * fx, d.y - d.spr.ay + 16, 26);
      }
      if (d.kind === 'bonfire' && this.bonfireLit(f, m)) add(d.x, d.y - 8, 64 + Math.sin(now / 90) * 4);
    }
  },

  // ---------------------------------------------------------------- migrating flocks
  // The birds of a flock, as offsets from its centre (cached per flock)
  _shape(fl) {
    if (fl._shape) return fl._shape;
    const n = Math.min(fl.n, fl.kind.form === 'cloud' ? 48 : 28), pts = [], dir = fl.north ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const h = (j) => hashf(fl.id, i * 5 + j, 77);
      if (fl.kind.form === 'v') { const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1; pts.push([side * k * 6 + (h(1) - 0.5) * 2, dir * k * 5 + (h(2) - 0.5) * 2, h(3)]); }
      else if (fl.kind.form === 'cloud') pts.push([(h(1) - 0.5) * 80, (h(2) - 0.5) * 46, h(3)]);
      else pts.push([(h(1) - 0.5) * 60, (h(2) - 0.5) * 40, h(3)]);
    }
    return (fl._shape = pts);
  },

  // Flocks over the valley right now: [{fl, x, y}] in world px
  flocksNow(S) {
    const m = S.clock(), out = [];
    for (const fl of skyFlocks(S)) { const p = flockPos(fl, m); if (p) out.push({ fl, x: p.x, y: p.y }); }
    return out;
  },

  // Small dark birds flapping high overhead; their calls drift down as they pass
  drawSky(g, S, cx0, cy0, view, now, me) {
    const list = this.flocksNow(S);
    if (!list.length) return;
    const day = dayIdx(S.time);
    // one bird: a body and two wings that beat up and down
    const bird = (bx, by, big, up) => {
      if (big) { g.fillRect(bx - 1, by, 3, 2); g.fillRect(bx - 4, by - up, 3, 1); g.fillRect(bx + 2, by - up, 3, 1); g.fillRect(bx - 5, by + 1 - 2 * up, 1, 1); g.fillRect(bx + 5, by + 1 - 2 * up, 1, 1); }
      else { g.fillRect(bx, by, 2, 1); g.fillRect(bx - 2, by - up, 2, 1); g.fillRect(bx + 2, by - up, 2, 1); }
    };
    for (const { fl, x, y } of list) {
      const sx = x - cx0, sy = y - cy0;
      if (sx < -80 || sy < -60 || sx > view.w + 80 || sy > view.h + 60) continue;
      const big = !!fl.kind.big, cloud = fl.kind.form === 'cloud', pts = [];
      for (const [ox, oy, ph] of this._shape(fl)) {
        const wob = cloud ? Math.sin(now / 700 + ph * 9) * 4 : 0;
        pts.push(Math.round(sx + ox + wob), Math.round(sy + oy + Math.cos(now / 900 + ph * 7) * (cloud ? 3 : 1)), Math.floor(now / (big ? 260 : 140) + ph * 4) % 2);
      }
      // they're high up: their shadows fall well away from them
      g.fillStyle = 'rgba(20,30,20,0.16)';
      for (let k = 0; k < pts.length; k += 3) bird(pts[k] + 10, pts[k + 1] + 26, big, 0);
      g.fillStyle = 'rgba(34,32,44,0.9)';
      for (let k = 0; k < pts.length; k += 3) bird(pts[k], pts[k + 1], big, pts[k + 2]);
      const key = day + ':' + fl.id;
      if (me && !this.heard.has(key) && dist2(x, y, me.x, me.y) < 180 * 180) { this.heard.add(key); Audio2.song(fl.kind.song, x, y); }
    }
  },

  // The flock you could count from where you stand (Migration Watch only), or null
  countable(S, me) {
    const fa = festActive(S.time, S.clock());
    if (!fa || fa.id !== 'migration' || !S.fest) return null;
    let best = null, bd = 1e12;
    for (const c of this.flocksNow(S)) {
      if (S.fest.seen.includes('f' + c.fl.id)) continue;
      // a little stricter than the host's check, so a count is never refused because of lag
      if (Math.abs(c.x - me.x) > 150 || Math.abs(c.y - me.y) > 130) continue;
      const d = dist2(c.x, c.y, me.x, me.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  },

  // ---------------------------------------------------------------- HUD & guide
  // Tracker title and lines for today's festival, or null once it's over
  trackerLines(S) {
    const f = this.today(S);
    const m = S.clock();
    if (!f || m >= f.gather[1]) return null;
    const st = S.fest && S.fest.id === f.id ? S.fest : { n: 0, tier: 0, done: false };
    const lines = [];
    if (m < f.gather[0]) lines.push(['On the village green from ' + fmtClock(f.gather[0]), UI_COL.ink]);
    if (m < f.until && !st.done) {
      lines.push([f.task, UI_COL.ink]);
      const next = f.goal.find((goal) => goal > st.n);
      lines.push(['  ' + st.n + ' ' + f.unit + (next ? ' · next ribbon at ' + next : ' · every ribbon won!'), st.tier ? UI_COL.ok : UI_COL.inkSoft]);
    } else lines.push(['Join everyone on the green', UI_COL.ink]);
    if (st.tier) lines.push(['  ' + RIBBONS[st.tier] + ' ribbon', '#a8761a']);
    return { title: f.name, lines };
  },

  // Where the guide arrow points around the start of the gathering, or null
  guide(S, me) {
    const f = this.today(S);
    if (!f) return null;
    const m = S.clock(), x = FEST_GREEN[0] * TS, y = FEST_GREEN[1] * TS;
    if (m < f.gather[0] - 30 || m >= Math.min(f.gather[1], f.gather[0] + 120)) return null;
    if (dist2(x, y, me.x, me.y) < (6 * TS) ** 2) return null;
    return { x, y, label: f.name, kind: 'tut' };
  },
};
