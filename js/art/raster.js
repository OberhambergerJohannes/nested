'use strict';
// A tiny pixel-buffer library. All of the game's art is generated with it at startup:
// hand-made sprite grids, procedural trees and terrain, icons and the font.

const _colCache = new Map();
// Colour -> packed uint32 (little-endian ABGR, ready for ImageData)
function C(hex, alpha) {
  if (typeof hex === 'number') return hex;
  if (!hex) return 0;
  const key = alpha == null ? hex : hex + '/' + alpha;
  let v = _colCache.get(key);
  if (v !== undefined) return v;
  let r = 0, g = 0, b = 0, a = 255;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16); g = parseInt(hex[2] + hex[2], 16); b = parseInt(hex[3] + hex[3], 16);
  } else {
    r = parseInt(hex.slice(1, 3), 16); g = parseInt(hex.slice(3, 5), 16); b = parseInt(hex.slice(5, 7), 16);
    if (hex.length === 9) a = parseInt(hex.slice(7, 9), 16);
  }
  if (alpha != null) a = Math.round(alpha * 255);
  v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  _colCache.set(key, v);
  return v;
}
const rgba = (c) => [c & 255, (c >>> 8) & 255, (c >>> 16) & 255, c >>> 24];
function toHex(c) {
  const [r, g, b] = rgba(c);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
function mixHex(h1, h2, t) {
  const a = rgba(C(h1)), b = rgba(C(h2));
  const r = Math.round(a[0] + (b[0] - a[0]) * t), g = Math.round(a[1] + (b[1] - a[1]) * t), bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
const lighten = (h, t) => mixHex(h, '#ffffff', t);
const darken = (h, t) => mixHex(h, '#10101a', t);

class Pix {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.p = new Uint32Array(w * h);
    this._cv = null;
  }
  static rows(rows, pal) {
    const h = rows.length, w = Math.max(...rows.map((r) => r.length));
    const px = new Pix(w, h);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c) px.p[y * w + x] = C(c);
      }
    }
    return px;
  }
  clone() { const q = new Pix(this.w, this.h); q.p.set(this.p); return q; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.p[y * this.w + x] = C(c);
  }
  // alpha-blend a colour onto the buffer
  blend(x, y, c, alpha) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x, d = this.p[i];
    const s = rgba(C(c));
    const a = alpha == null ? s[3] / 255 : alpha;
    if (!(d >>> 24)) { this.p[i] = C(c, a); return; }
    const t = rgba(d);
    const r = Math.round(t[0] + (s[0] - t[0]) * a), g = Math.round(t[1] + (s[1] - t[1]) * a), b = Math.round(t[2] + (s[2] - t[2]) * a);
    this.p[i] = ((t[3] << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }
  get(x, y) { x |= 0; y |= 0; return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.p[y * this.w + x]; }
  op(x, y) { return (this.get(x, y) >>> 24) > 0; }
  rect(x, y, w, h, c) {
    const v = C(c);
    for (let j = Math.max(0, y | 0); j < Math.min(this.h, (y + h) | 0); j++)
      for (let i = Math.max(0, x | 0); i < Math.min(this.w, (x + w) | 0); i++) this.p[j * this.w + i] = v;
  }
  frame(x, y, w, h, c) { this.hline(x, x + w - 1, y, c); this.hline(x, x + w - 1, y + h - 1, c); this.vline(x, y, y + h - 1, c); this.vline(x + w - 1, y, y + h - 1, c); }
  hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) this.set(x, y, c); }
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2000; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  thick(x0, y0, x1, y1, w, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      this.disc(x, y, w / 2, c);
    }
  }
  disc(cx, cy, r, c) { this.ellipse(cx, cy, r, r, c); }
  ellipse(cx, cy, rx, ry, c) {
    const v = C(c);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1 && this.inb(x, y)) this.p[y * this.w + x] = v;
      }
    }
  }
  poly(pts, c) {
    const v = C(c);
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= sy && by > sy) || (by <= sy && ay > sy)) xs.push(ax + (sy - ay) / (by - ay) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2)
        for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) if (this.inb(x, y)) this.p[y * this.w + x] = v;
    }
  }
  blit(src, dx, dy, flip) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const c = src.p[y * src.w + (flip ? src.w - 1 - x : x)];
      if (!(c >>> 24)) continue;
      const tx = dx + x, ty = dy + y;
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) continue;
      if ((c >>> 24) === 255) this.p[ty * this.w + tx] = c;
      else this.blend(tx, ty, c);
    }
  }
  // Outline opaque pixels with colour c (4-neighbourhood, or 8 with diag)
  outline(c, diag) {
    const v = C(c), src = this.p.slice(), w = this.w, h = this.h;
    const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (src[y * w + x] >>> 24) > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1) ||
          (diag && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1)))) this.p[y * w + x] = v;
    }
    return this;
  }
  // Replace colours: map of hex -> hex
  flipped() {
    const q = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) q.p[y * this.w + x] = this.p[y * this.w + this.w - 1 - x];
    return q;
  }
  // Expand canvas by padding (keeps content centred horizontally, bottom-aligned)
  pad(l, t, r, b) {
    const q = new Pix(this.w + l + r, this.h + t + b);
    q.blit(this, l, t);
    return q;
  }
  canvas() {
    if (this._cv) return this._cv;
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    const g = cv.getContext('2d');
    const id = g.createImageData(this.w, this.h);
    id.data.set(new Uint8ClampedArray(this.p.buffer));
    g.putImageData(id, 0, 0);
    this._cv = cv;
    return cv;
  }
}

// Deterministic per-sprite randomness
function artRng(name) { return mulberry32(strHash(name)); }
