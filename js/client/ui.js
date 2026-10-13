'use strict';
// Immediate-mode UI drawn on the pixel canvas. Works with mouse, touch, keyboard and gamepad:
// every interactive widget registers its rectangle; arrow keys / d-pad move focus spatially
// between widgets, E / Enter / A activates the focused one.

class UI {
  constructor() {
    this.g = null;
    this.widgets = [];
    this.prev = [];
    this.focus = null;
    this.activate = null;
    this.tip = null;
    this.view = { w: 480, h: 270 };
    this.layer = 0;
  }
  get font() { return SPR.font; }

  // nav: whether keyboard/gamepad menu navigation is active (off while walking around)
  begin(g, view, nav) {
    this.g = g;
    this.view = view;
    this.prev = this.widgets;
    this.widgets = [];
    this.tip = null;
    this.activate = null;
    this.lock = false;
    if (!nav) { this.focus = null; return; }
    const ids = this.prev.map((w) => w.id);
    if (this.focus && !ids.includes(this.focus)) this.focus = null;
    if (!this.focus && !this.wantFocus && this.prev.length && this.showFocus()) {
      const first = this.prev.find((w) => !w.id.endsWith(':x')) || this.prev[0];
      this.focus = first.id;
    }
    // spatial navigation
    const dirs = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    for (const [d, dx, dy] of dirs) {
      if (!Input.nav(d) || !this.prev.length) continue;
      if (!this.focus) { this.focus = this.prev[0].id; Audio2.sfx('tick'); continue; }
      const cur = this.prev.find((w) => w.id === this.focus);
      const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
      let best = null, bs = 1e9;
      for (const w of this.prev) {
        if (w.id === cur.id) continue;
        const wx = w.x + w.w / 2, wy = w.y + w.h / 2;
        const ax = wx - cx, ay = wy - cy;
        const along = ax * dx + ay * dy;
        if (along <= 2) continue;
        const across = Math.abs(ax * dy - ay * dx);
        const score = along + across * 2.2;
        if (score < bs) { bs = score; best = w; }
      }
      if (best) { this.focus = best.id; Audio2.sfx('tick'); }
    }
    if ((Input.hit('act') || Input.hit('enter')) && this.focus) this.activate = this.focus;
    else if ((Input.hit('act') || Input.hit('enter')) && !this.focus && this.prev.length && Input.lastDevice !== 'mouse') { this.focus = this.prev[0].id; }
  }

  showFocus() { return Input.lastDevice === 'kb' || Input.lastDevice === 'pad'; }

  hit(x, y) {
    for (const w of this.widgets) if (x >= w.x && y >= w.y && x < w.x + w.w && y < w.y + w.h) return true;
    for (const w of this.prev) if (x >= w.x && y >= w.y && x < w.x + w.w && y < w.y + w.h) return true;
    return false;
  }

  widget(id, x, y, w, h, opts) {
    if (this.lock) return { over: false, clicked: false, focused: false };
    this.widgets.push({ id, x, y, w, h });
    if (this.wantFocus === id) { this.focus = id; this.wantFocus = null; }
    if (opts && opts.passive) return { over: false, clicked: false, focused: false };
    const m = Input.mouse;
    const over = m.x >= x && m.y >= y && m.x < x + w && m.y < y + h;
    if (over && m.moved) this.focus = id;
    let clicked = false;
    if (over && m.clicked) { clicked = true; m.clicked = false; this.focus = id; }
    if (this.activate === id) { clicked = true; this.activate = null; }
    return { over: over && !Input.touchMode, clicked, focused: this.focus === id && this.showFocus() };
  }

  // ---------------------------------------------------------------- drawing helpers
  panel(style, x, y, w, h) { this.g.drawImage(SPR.panel(style, w, h), Math.round(x), Math.round(y)); }

  text(str, x, y, color, opts) {
    opts = opts || {};
    const sc = opts.scale || 1;
    let tx = x;
    if (opts.align === 'center') tx = x - this.font.measure(str) * sc / 2;
    else if (opts.align === 'right') tx = x - this.font.measure(str) * sc;
    tx = Math.round(tx); y = Math.round(y);
    if (opts.outline) return this.font.drawOutline(this.g, str, tx, y, color, opts.outline, sc);
    if (opts.shadow) return this.font.drawShadow(this.g, str, tx, y, color, opts.shadow === true ? '#1d1a2b' : opts.shadow, sc);
    return this.font.draw(this.g, str, tx, y, color || UI_COL.ink, sc);
  }

  // word-wrapped text, returns height used
  wrap(str, x, y, w, color, lh, maxLines) {
    const lines = this.font.wrap(str, w);
    const n = maxLines ? Math.min(maxLines, lines.length) : lines.length;
    for (let i = 0; i < n; i++) {
      let s = lines[i];
      if (maxLines && i === n - 1 && lines.length > n) s = s.replace(/.{0,2}$/, '…');
      this.font.draw(this.g, s, Math.round(x), Math.round(y + i * (lh || LINE_H)), color || UI_COL.ink);
    }
    return n * (lh || LINE_H);
  }
  wrapHeight(str, w, lh) { return this.font.wrap(str, w).length * (lh || LINE_H); }

  icon(spr, x, y, scale) {
    if (!spr) return;
    const s = scale || 1;
    this.g.drawImage(spr.img || spr, Math.round(x), Math.round(y), (spr.w || spr.width) * s, (spr.h || spr.height) * s);
  }

  rect(x, y, w, h, col) { this.g.fillStyle = col; this.g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  bar(x, y, w, h, frac, col) {
    this.panel('bar', x, y, w, h);
    this.rect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(frac, 0, 1)), h - 2, col || UI_COL.green);
  }

  focusRing(x, y, w, h) {
    const t = Math.floor(performance.now() / 300) % 2;
    this.g.fillStyle = '#fff4b0';
    const o = 1 + t;
    this.g.fillRect(x - o, y - o, w + o * 2, 1); this.g.fillRect(x - o, y + h + o - 1, w + o * 2, 1);
    this.g.fillRect(x - o, y - o, 1, h + o * 2); this.g.fillRect(x + w + o - 1, y - o, 1, h + o * 2);
  }

  // A little keycap showing which key triggers something; returns its width
  keyHint(label, x, y) {
    const w = this.font.measure(label) + 6;
    this.rect(x, y, w, 12, '#3a2614');
    this.rect(x + 1, y + 1, w - 2, 9, '#6a4c30');
    this.rect(x + 1, y + 1, w - 2, 1, '#8a6a46');
    this.text(label, x + 3, y + 2, '#fff4d8');
    return w;
  }
  keyHintW(label) { return label ? this.font.measure(label) + 6 : 0; }

  // ---------------------------------------------------------------- widgets
  button(id, label, x, y, w, h, opts) {
    opts = opts || {};
    const st = this.widget(id, x, y, w, h);
    const dis = !!opts.disabled;
    const style = dis ? 'btnd' : (st.over || st.focused) ? 'btnh' : 'btn';
    this.panel(opts.selected ? 'btnp' : style, x, y, w, h);
    let tx = x + w / 2;
    if (opts.icon) {
      const iw = 16 + 2;
      const lw = this.font.measure(label);
      const total = iw + lw;
      this.icon(opts.icon, x + w / 2 - total / 2, y + h / 2 - 8);
      tx = x + w / 2 - total / 2 + iw + lw / 2;
    }
    this.text(label, tx, y + Math.floor(h / 2) - 4, dis ? '#8a7a64' : UI_COL.ink, { align: 'center' });
    if (opts.key && !Input.touchMode) this.keyHint(opts.key, x + w + 3, y + Math.floor((h - 12) / 2));
    if (st.focused) this.focusRing(x, y, w, h);
    if (opts.tip && (st.over || st.focused)) this.tip = opts.tip;
    if (st.clicked) {
      if (dis) { Audio2.sfx('error'); return false; }
      Audio2.sfx('click');
      return true;
    }
    return false;
  }

  iconButton(id, spr, x, y, opts) {
    opts = opts || {};
    const s = opts.size || 20;
    const st = this.widget(id, x, y, s, s);
    this.panel(opts.selected ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', x, y, s, s);
    this.icon(spr, x + (s - 16) / 2, y + (s - 16) / 2);
    if (opts.badge) {
      this.rect(x + s - 6, y - 1, 7, 7, '#c8483a');
      this.text(String(opts.badge), x + s - 5, y - 1, '#ffffff');
    }
    if (st.focused) this.focusRing(x, y, s, s);
    if (opts.tip && (st.over || st.focused)) this.tip = opts.tip;
    if (st.clicked) { Audio2.sfx('click'); return true; }
    return false;
  }

  // An inventory-like slot with an icon and count
  slot(id, x, y, spr, count, opts) {
    opts = opts || {};
    const s = opts.size || 20;
    const st = this.widget(id, x, y, s, s);
    this.panel(opts.selected ? 'slotsel' : (st.over || st.focused) ? 'slothot' : 'slot', x, y, s, s);
    if (spr) {
      if (opts.dim) this.g.globalAlpha = 0.35;
      this.icon(spr, x + (s - 16) / 2, y + (s - 16) / 2);
      this.g.globalAlpha = 1;
    }
    if (count != null && count !== '' && count !== 1) {
      const t = String(count);
      this.text(t, x + s - 2 - this.font.measure(t), y + s - 9, '#ffffff', { outline: '#2a1a0e' });
    }
    if (st.focused) this.focusRing(x, y, s, s);
    if (opts.tip && (st.over || st.focused)) this.tip = opts.tip;
    return st.clicked;
  }

  tabs(id, labels, x, y, sel, w) {
    let cx = x;
    let out = sel;
    labels.forEach((lab, i) => {
      const tw = w || this.font.measure(lab) + 12;
      const st = this.widget(id + ':' + i, cx, y, tw, 13);
      this.panel(i === sel ? 'tabsel' : 'tab', cx, y + (i === sel ? 0 : 1), tw, i === sel ? 14 : 12);
      this.text(lab, cx + tw / 2, y + 3, i === sel ? UI_COL.ink : '#5a4026', { align: 'center' });
      if (st.focused) this.focusRing(cx, y, tw, 13);
      if (st.clicked && i !== sel) { out = i; Audio2.sfx('page'); }
      cx += tw + 1;
    });
    // Q/E style switching with prev/next keys
    if (Input.hit('prev') && sel > 0) { out = sel - 1; Audio2.sfx('page'); }
    if (Input.hit('next') && sel < labels.length - 1) { out = sel + 1; Audio2.sfx('page'); }
    return out;
  }

  // Close "X" button in a panel corner; returns true when clicked
  closeX(id, x, y) {
    if (!Input.touchMode) {
      const k = Input.lastDevice === 'pad' ? 'B' : 'Esc';
      this.text(k, x - 2, y + 2, '#9a8464', { align: 'right' });
    }
    const st = this.widget(id, x, y, 11, 11);
    this.panel(st.over || st.focused ? 'btnh' : 'btn', x, y, 11, 11);
    this.g.fillStyle = UI_COL.ink;
    for (let i = 0; i < 5; i++) { this.g.fillRect(x + 3 + i, y + 3 + i, 1, 1); this.g.fillRect(x + 7 - i, y + 3 + i, 1, 1); }
    if (st.focused) this.focusRing(x, y, 11, 11);
    if (st.clicked) { Audio2.sfx('close'); return true; }
    return false;
  }

  textField(id, value, x, y, w, maxLen, opts) {
    opts = opts || {};
    const st = this.widget(id, x, y, w, 14);
    const active = this.editing === id;
    this.panel(active ? 'slotsel' : 'slot', x, y, w, 14);
    const shown = value + (active && Math.floor(performance.now() / 400) % 2 ? '_' : '');
    this.text(shown || (active ? '' : opts.placeholder || ''), x + 4, y + 3, value ? UI_COL.ink : '#9a8464');
    if (st.focused && !active) this.focusRing(x, y, w, 14);
    if (st.clicked && !active) { this.editing = id; Input.startText(value); return value; }
    if (active) {
      let v = value;
      if (Input.text.buf) v = (v + Input.text.buf).slice(0, maxLen || 20);
      for (let i = 0; i < Input.text.back; i++) v = v.slice(0, -1);
      if (Input.text.enter || Input.text.esc) { this.editing = null; Input.stopText(); }
      return v;
    }
    return value;
  }

  stopEditing() { if (this.editing) { this.editing = null; Input.stopText(); } }

  // Small left/right selector: returns new index
  stepper(id, label, x, y, w, idx, n, render) {
    const l = this.widget(id + ':l', x, y, 12, 14), r = this.widget(id + ':r', x + w - 12, y, 12, 14);
    this.panel(l.over || l.focused ? 'btnh' : 'btn', x, y, 12, 14);
    this.panel(r.over || r.focused ? 'btnh' : 'btn', x + w - 12, y, 12, 14);
    this.text('<', x + 4, y + 3, UI_COL.ink); this.text('>', x + w - 8, y + 3, UI_COL.ink);
    if (l.focused) this.focusRing(x, y, 12, 14);
    if (r.focused) this.focusRing(x + w - 12, y, 12, 14);
    if (render) render(x + 14, y, w - 28); else this.text(label, x + w / 2, y + 3, UI_COL.ink, { align: 'center' });
    if (l.clicked) { Audio2.sfx('tick'); return (idx + n - 1) % n; }
    if (r.clicked) { Audio2.sfx('tick'); return (idx + 1) % n; }
    return idx;
  }

  end() {
    if (this.tip) {
      const lines = this.font.wrap(this.tip, 150);
      const w = Math.max(...lines.map((l) => this.font.measure(l))) + 8;
      const h = lines.length * LINE_H + 6;
      let x = Input.lastDevice === 'mouse' ? Input.mouse.x + 10 : this.view.w / 2 - w / 2;
      let y = Input.lastDevice === 'mouse' ? Input.mouse.y + 10 : this.view.h - h - 34;
      x = clamp(x, 2, this.view.w - w - 2); y = clamp(y, 2, this.view.h - h - 2);
      this.panel('dark', x, y, w, h);
      lines.forEach((l, i) => this.text(l, x + 4, y + 3 + i * LINE_H, '#f6ecd2'));
    }
  }
}
