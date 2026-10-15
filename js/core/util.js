'use strict';
// Shared helpers: math, seeded randomness, noise, encoding, formatting.
// All game scripts are classic scripts sharing one global scope (so the game
// also runs straight from file:// without a server).

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash32(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return h >>> 0;
}
const hashf = (x, y, s) => hash32(x, y, s || 0) / 4294967296;

function strHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function smoothstep(t) { return t * t * (3 - 2 * t); }

function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hashf(xi, yi, seed), b = hashf(xi + 1, yi, seed);
  const c = hashf(xi, yi + 1, seed), d = hashf(xi + 1, yi + 1, seed);
  const u = smoothstep(xf), v = smoothstep(yf);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

function fbm(x, y, seed, oct) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < (oct || 3); i++) {
    sum += amp * valueNoise(x * f, y * f, seed + i * 101);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}

function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}
const pick = (arr, rnd) => arr[Math.floor((rnd ? rnd() : Math.random()) * arr.length)];
const randInt = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));

function b64encode(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return btoa(s);
}
function b64decode(str) {
  const s = atob(str);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

function makeToken() {
  const chars = 'abcdefghijkmnopqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 16; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fmtClock(min) {
  let m = Math.floor(min) % 1440;
  let h = Math.floor(m / 60), mm = Math.floor(m % 60 / 10) * 10;
  const am = h < 12;
  let hh = h % 12; if (hh === 0) hh = 12;
  return hh + ':' + (mm < 10 ? '0' : '') + mm + (am ? ' am' : ' pm');
}

function plural(n, word, pl) { return n + ' ' + (n === 1 ? word : (pl || word + 's')); }

// Word-wrap text for a monospace-ish measure function.
function wrapText(text, maxW, measure) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (measure(test) <= maxW || !line) line = test;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
