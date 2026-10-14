'use strict';
// All sound is synthesised with the Web Audio API: effects, bird songs and gentle music.
// (Named Audio2 to avoid clashing with the browser's built-in Audio constructor.)

const Audio2 = {
  ctx: null, master: null, sfxGain: null, musicGain: null, ambGain: null,
  vol: { music: 0.5, sfx: 0.8 },
  unlocked: false,
  musicOn: true,
  noiseBuf: null,
  listener: { x: 0, y: 0 },
  rainNode: null,
  nextNote: 0, step: 0, mood: null,

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('nested.audio') || '{}');
      if (typeof p.music === 'number') this.vol.music = p.music;
      if (typeof p.sfx === 'number') this.vol.sfx = p.sfx;
    } catch (e) { /* ignore */ }
  },
  savePrefs() { try { localStorage.setItem('nested.audio', JSON.stringify(this.vol)); } catch (e) { /* ignore */ } },

  unlock() {
    if (this.unlocked) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch (e) { return; }
    this.unlocked = true;
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.9; this.master.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(this.master);
    this.sfxGain = c.createGain(); this.sfxGain.connect(comp);
    this.musicGain = c.createGain(); this.musicGain.connect(comp);
    this.ambGain = c.createGain(); this.ambGain.connect(comp);
    this.applyVolumes();
    const len = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.nextNote = c.currentTime + 0.5;
  },

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.vol.sfx;
    this.musicGain.gain.value = this.vol.music * 0.35;
    this.ambGain.gain.value = this.vol.sfx * 0.6;
  },

  // --------------------------------------------------------------- primitives
  _out(x, y) {
    // spatial: volume & pan by distance to listener
    const c = this.ctx;
    const g = c.createGain();
    let v = 1;
    if (x != null) {
      const dx = x - this.listener.x, dy = y - this.listener.y, d = Math.hypot(dx, dy);
      v = clamp(1 - d / 260, 0, 1);
      if (c.createStereoPanner) {
        const p = c.createStereoPanner();
        p.pan.value = clamp(dx / 200, -0.8, 0.8);
        g.connect(p); p.connect(this.sfxGain);
      } else g.connect(this.sfxGain);
    } else g.connect(this.sfxGain);
    g.gain.value = v;
    return v > 0.01 ? g : null;
  },

  tone(dest, t, f0, f1, dur, vol, type, attack) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    const a = attack || 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  },

  noise(dest, t, dur, vol, ftype, f0, f1, q) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = ftype || 'bandpass';
    f.frequency.setValueAtTime(f0 || 2000, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.0); s.stop(t + dur + 0.02);
  },

  // --------------------------------------------------------------- effects
  sfx(name, x, y) {
    if (!this.ctx) return;
    const d = this._out(x, y);
    if (!d) return;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'step': this.noise(d, t, 0.06, 0.05, 'lowpass', 900, 400, 0.7); break;
      case 'stepw': this.noise(d, t, 0.1, 0.07, 'bandpass', 1400, 600, 1.5); break;
      case 'rustle': this.noise(d, t, 0.22, 0.25, 'bandpass', 3200, 1800, 0.8); this.noise(d, t + 0.08, 0.18, 0.15, 'bandpass', 4200, 2400, 1); break;
      case 'shake': for (let i = 0; i < 4; i++) this.noise(d, t + i * 0.06, 0.12, 0.2, 'bandpass', 2600 + i * 300, 1600, 0.9); break;
      case 'pop': this.tone(d, t, 620, 990, 0.09, 0.22, 'sine'); this.tone(d, t + 0.05, 990, 1320, 0.08, 0.14, 'triangle'); break;
      case 'pickup': this.tone(d, t, 880, 880, 0.07, 0.18, 'square'); this.tone(d, t + 0.06, 1320, 1320, 0.1, 0.12, 'square'); break;
      case 'mud': this.noise(d, t, 0.25, 0.3, 'lowpass', 600, 180, 1.2); this.tone(d, t, 180, 90, 0.2, 0.18, 'sine'); break;
      case 'scrape': for (let i = 0; i < 5; i++) this.noise(d, t + i * 0.035, 0.05, 0.15, 'highpass', 3000, 0, 0.7); break;
      case 'dig': this.noise(d, t, 0.18, 0.3, 'lowpass', 1200, 300, 1); this.tone(d, t, 140, 80, 0.12, 0.2, 'triangle'); break;
      case 'splash': this.noise(d, t, 0.45, 0.35, 'bandpass', 1800, 500, 0.8); this.noise(d, t + 0.05, 0.3, 0.2, 'highpass', 4000, 0, 1); break;
      case 'silk': for (let i = 0; i < 4; i++) this.tone(d, t + i * 0.05, 2400 + i * 400, 2600 + i * 400, 0.12, 0.05, 'sine'); break;
      case 'crumble': for (let i = 0; i < 6; i++) this.noise(d, t + i * 0.04, 0.06, 0.18, 'bandpass', 900 + Math.random() * 600, 0, 2); break;
      case 'place': this.tone(d, t, 220, 160, 0.12, 0.3, 'triangle'); this.noise(d, t, 0.1, 0.2, 'lowpass', 800, 0, 1); break;
      case 'plant': this.noise(d, t, 0.15, 0.2, 'lowpass', 900, 300, 1); this.tone(d, t + 0.08, 520, 780, 0.12, 0.1, 'sine'); break;
      case 'build': [523, 659, 784, 1046].forEach((f, i) => this.tone(d, t + i * 0.09, f, f, 0.25, 0.14, 'triangle')); this.noise(d, t, 0.3, 0.15, 'bandpass', 2400, 1200, 1); break;
      case 'craft': [392, 523, 659].forEach((f, i) => this.tone(d, t + i * 0.08, f, f, 0.18, 0.13, 'square')); this.noise(d, t, 0.08, 0.3, 'lowpass', 1500, 0, 1); break;
      case 'coin': this.tone(d, t, 988, 988, 0.08, 0.15, 'square'); this.tone(d, t + 0.07, 1319, 1319, 0.22, 0.13, 'square'); break;
      case 'click': this.tone(d, t, 1400, 1100, 0.04, 0.08, 'square'); break;
      case 'tick': this.tone(d, t, 1800, 1800, 0.02, 0.05, 'square'); break;
      case 'open': this.tone(d, t, 440, 660, 0.1, 0.1, 'triangle'); this.noise(d, t, 0.12, 0.08, 'bandpass', 3000, 2000, 1); break;
      case 'close': this.tone(d, t, 660, 440, 0.1, 0.1, 'triangle'); break;
      case 'error': this.tone(d, t, 180, 140, 0.18, 0.18, 'sawtooth'); break;
      case 'page': this.noise(d, t, 0.18, 0.15, 'bandpass', 5000, 2500, 0.6); break;
      case 'clue': [784, 988, 1175, 1568].forEach((f, i) => this.tone(d, t + i * 0.1, f, f, 0.3, 0.12, 'sine')); break;
      case 'arrive': [659, 784, 988].forEach((f, i) => this.tone(d, t + i * 0.12, f, f * 1.01, 0.3, 0.12, 'triangle')); break;
      case 'fanfare': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(d, t + i * 0.13, f, f, i === 6 ? 0.6 : 0.2, 0.15, 'square')); break;
      case 'chirps': for (let i = 0; i < 6; i++) this.tone(d, t + i * 0.07 + Math.random() * 0.03, 3600 + Math.random() * 900, 4200, 0.05, 0.05, 'sine'); break;
      case 'brush': for (let i = 0; i < 3; i++) this.noise(d, t + i * 0.1, 0.12, 0.12, 'bandpass', 2200, 1600, 1); break;
      case 'sleep': [392, 330, 262].forEach((f, i) => this.tone(d, t + i * 0.25, f, f, 0.5, 0.12, 'sine', 0.05)); break;
      case 'mail': this.tone(d, t, 880, 880, 0.12, 0.12, 'sine'); this.tone(d, t + 0.14, 1175, 1175, 0.2, 0.12, 'sine'); break;
      case 'quack': for (let i = 0; i < 2; i++) { const o = this.tone(d, t + i * 0.22, 420, 300, 0.16, 0.12, 'sawtooth'); void o; } break;
      case 'neigh': this.tone(d, t, 600, 900, 0.3, 0.06, 'sawtooth'); this.tone(d, t + 0.3, 900, 500, 0.4, 0.06, 'sawtooth'); break;
      case 'baa': this.tone(d, t, 330, 300, 0.4, 0.07, 'sawtooth', 0.04); break;
      case 'knock': for (let i = 0; i < 3; i++) { this.noise(d, t + i * 0.16, 0.06, 0.4, 'lowpass', 500, 120, 2); this.tone(d, t + i * 0.16, 160, 110, 0.06, 0.2, 'triangle'); } break;
      case 'cluck': for (let i = 0; i < 3; i++) this.tone(d, t + i * 0.1, 700, 500, 0.06, 0.08, 'square'); break;
    }
  },

  // --------------------------------------------------------------- bird songs
  song(spId, x, y) {
    if (!this.ctx) return;
    const d = this._out(x, y);
    if (!d) return;
    const t = this.ctx.currentTime + 0.02;
    const R = Math.random;
    const T = (dt, f0, f1, dur, v, type) => this.tone(d, t + dt, f0, f1, dur, v == null ? 0.07 : v, type || 'sine');
    switch (spId) {
      case 'blackbird': { // mellow fluting phrase ending in a squeaky twitter
        let k = 0;
        for (let i = 0; i < 5; i++) { const f = 1400 + R() * 900; T(k, f, f * (0.9 + R() * 0.25), 0.18 + R() * 0.12, 0.08); k += 0.22 + R() * 0.08; }
        for (let i = 0; i < 4; i++) T(k + i * 0.05, 4500 + R() * 1500, 5200, 0.04, 0.035);
        break;
      }
      case 'robin': { let k = 0; for (let i = 0; i < 7; i++) { const f = 3000 + R() * 3500; T(k, f, f * (R() < 0.5 ? 0.7 : 1.3), 0.08 + R() * 0.1, 0.05); k += 0.12 + R() * 0.1; } break; }
      case 'greattit': for (let i = 0; i < 3; i++) { T(i * 0.42, 5600, 5400, 0.14, 0.06); T(i * 0.42 + 0.18, 4100, 4000, 0.16, 0.06); } break;
      case 'bluetit': { T(0, 6800, 6600, 0.12, 0.04); T(0.18, 6800, 6600, 0.12, 0.04); for (let i = 0; i < 8; i++) T(0.4 + i * 0.06, 4600, 4300, 0.05, 0.045); break; }
      case 'songthrush': { let k = 0; for (let p = 0; p < 3; p++) { const f = 2200 + R() * 2500, f2 = f * (0.8 + R() * 0.5), n = 2 + Math.floor(R() * 2); for (let r = 0; r < n; r++) { T(k, f, f2, 0.09, 0.07); T(k + 0.1, f2, f, 0.08, 0.06); k += 0.24; } k += 0.15; } break; }
      case 'woodpigeon': { const s = [[0, 0.35, 380], [0.45, 0.5, 420], [1.0, 0.3, 380], [1.4, 0.3, 360], [1.75, 0.25, 340]]; for (const [k, dur, f] of s) T(k, f, f * 0.92, dur, 0.13, 'sine'); break; }
      case 'wren': { let k = 0; for (let i = 0; i < 26; i++) { const f = 4000 + R() * 3500; T(k, f, f * (0.85 + R() * 0.3), 0.04, 0.07); k += 0.045 + (i % 9 === 8 ? 0.12 : 0); } break; }
      case 'swallow': { let k = 0; for (let i = 0; i < 12; i++) { const f = 3000 + R() * 2500; T(k, f, f * (0.8 + R() * 0.4), 0.05, 0.045); k += 0.07 + R() * 0.06; } for (let i = 0; i < 6; i++) this.noise(d, t + k + i * 0.025, 0.02, 0.05, 'bandpass', 3500, 0, 4); break; }
      case 'martin': for (let i = 0; i < 4; i++) { T(i * 0.2, 2800, 3600, 0.06, 0.05); T(i * 0.2 + 0.07, 3600, 2900, 0.06, 0.04); } break;
      case 'mallard': for (let i = 0; i < 4; i++) { const k = i * 0.25; const v = 0.12 - i * 0.02; this.tone(d, t + k, 520, 360, 0.18, v, 'sawtooth'); this.noise(d, t + k, 0.15, v * 0.6, 'bandpass', 1100, 700, 3); } break;
      case 'goldfinch': { let k = 0; for (let i = 0; i < 16; i++) { const f = 3500 + R() * 3500; T(k, f, f * (0.85 + R() * 0.35), 0.05, 0.05); k += 0.06 + R() * 0.04; } break; }
      case 'longtailed': { for (let i = 0; i < 3; i++) T(i * 0.12, 7500, 7300, 0.08, 0.04); for (let i = 0; i < 5; i++) this.noise(d, t + 0.45 + i * 0.03, 0.03, 0.06, 'bandpass', 3000, 0, 5); break; }
      case 'woodpecker': { for (let i = 0; i < 16; i++) this.noise(d, t + i * 0.045, 0.03, 0.4 - i * 0.015, 'bandpass', 700, 0, 3); T(1.0, 2600, 2200, 0.05, 0.06, 'square'); break; }
      case 'reedwarbler': { let k = 0; for (let i = 0; i < 18; i++) { const harsh = R() < 0.35; if (harsh) this.noise(d, t + k, 0.05, 0.08, 'bandpass', 2500, 0, 3); else T(k, 2500 + R() * 2500, 2200 + R() * 2000, 0.06, 0.05); k += 0.08 + (i % 3 === 2 ? 0.05 : 0); } break; }
      case 'crossbill': for (let i = 0; i < 4; i++) T(i * 0.14, 3200, 2600, 0.05, 0.07, 'square'); break;
      case 'kingfisher': for (let i = 0; i < 3; i++) T(i * 0.25, 6000, 7000, 0.12, 0.07); break;
      case 'barnowl': { this.noise(d, t, 1.4, 0.18, 'bandpass', 2600, 3400, 2.2); this.noise(d, t, 1.2, 0.1, 'bandpass', 4500, 5200, 3); break; }
      case 'penduline': T(0, 6500, 4200, 0.6, 0.05); T(0.9, 6400, 4300, 0.55, 0.04); break;
      case 'cuckoo': for (let i = 0; i < 3; i++) { T(i * 0.9, 700, 690, 0.22, 0.13, 'sine'); T(i * 0.9 + 0.3, 580, 570, 0.32, 0.13, 'sine'); } break;
      case 'stork': { for (let i = 0; i < 22; i++) { const g = Math.sin(i / 22 * Math.PI); this.noise(d, t + i * 0.06 - g * 0.01, 0.025, 0.12 + g * 0.2, 'bandpass', 1400, 0, 2); } break; }
      case 'nuthatch': for (let i = 0; i < 6; i++) T(i * 0.13, 2300, 3300, 0.07, 0.08); break;
      case 'skylark': { let k = 0; for (let i = 0; i < 46; i++) { const f = 2600 + R() * 3200; T(k, f, f * (0.85 + R() * 0.3), 0.045, 0.045); k += 0.05 + (R() < 0.08 ? 0.08 : 0); } break; }
      case 'plover': T(0, 3700, 2700, 0.32, 0.07); T(0.6, 3700, 2700, 0.3, 0.06); break;
      case 'swift': for (let i = 0; i < 3; i++) { T(i * 0.45, 5400, 6600, 0.32, 0.04); this.noise(d, t + i * 0.45, 0.32, 0.05, 'bandpass', 6200, 5600, 6); } break;
      case 'tawny': { // the male's quavering hoot
        T(0, 560, 520, 0.42, 0.13, 'sine');
        for (let i = 0; i < 3; i++) T(1.0 + i * 0.12, 600, 560, 0.09, 0.09, 'sine');
        for (let i = 0; i < 9; i++) T(1.45 + i * 0.09, 590 - i * 6, 570 - i * 6, 0.09, 0.12 - i * 0.008, 'sine');
        break;
      }
      case 'heron': this.tone(d, t, 320, 220, 0.38, 0.1, 'sawtooth'); this.noise(d, t, 0.38, 0.16, 'bandpass', 900, 600, 2); break;
      case 'shrike': { for (let i = 0; i < 3; i++) this.noise(d, t + i * 0.16, 0.06, 0.12, 'bandpass', 2800, 0, 3); let k = 0.6; for (let i = 0; i < 7; i++) { const f = 2400 + R() * 2600; T(k, f, f * (0.85 + R() * 0.3), 0.07, 0.04); k += 0.1; } break; }
      case 'beeeater': for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) T(i * 0.42 + j * 0.026, 2250 + j * 50, 2350 + j * 50, 0.024, 0.05, 'triangle'); break;
      case 'flycatcher': { T(0, 5200, 5000, 0.08, 0.05); T(0.12, 4400, 4600, 0.07, 0.05); T(0.24, 5200, 5000, 0.08, 0.05); T(0.36, 3800, 4200, 0.12, 0.05); break; }
      case 'nightingale': {
        let k = 0;
        for (let i = 0; i < 4; i++) { T(k, 1300, 1250, 0.32, 0.03 + i * 0.02, 'sine'); k += 0.42; }
        for (let i = 0; i < 6; i++) { this.tone(d, t + k + i * 0.06, 900, 700, 0.05, 0.1, 'square'); }
        k += 0.5;
        for (let i = 0; i < 10; i++) { const f = 2500 + R() * 3500; T(k, f, f * (0.8 + R() * 0.4), 0.06, 0.06); k += 0.08; }
        break;
      }
      case 'dipper': { let k = 0; for (let i = 0; i < 3; i++) { T(k, 6000, 5200, 0.04, 0.06); k += 0.12; } for (let i = 0; i < 8; i++) { const f = 3500 + R() * 2500; T(k, f, f * 0.9, 0.05, 0.04); k += 0.07; } break; }
      case 'sandmartin': for (let i = 0; i < 8; i++) this.noise(d, t + i * 0.09 + R() * 0.03, 0.05, 0.08, 'bandpass', 3800, 3000, 4); break;
      case 'jackdaw': for (let i = 0; i < 2; i++) { this.tone(d, t + i * 0.32, 1300, 1100, 0.09, 0.08, 'square'); this.noise(d, t + i * 0.32, 0.08, 0.1, 'bandpass', 1600, 1200, 3); } break;
      case 'nightjar': { for (let i = 0; i < 60; i++) this.tone(d, t + i * 0.035, i % 2 ? 1550 : 1750, i % 2 ? 1500 : 1700, 0.03, 0.05, 'square'); break; }
      case 'longeared': T(0, 330, 310, 0.35, 0.12, 'sine'); T(2.4, 330, 310, 0.35, 0.12, 'sine'); break;
      case 'corncrake': for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) this.noise(d, t + i * 0.6 + j * 0.2, 0.14, 0.14, 'bandpass', 2400, 2600, 5); break;
      case 'eagleowl': T(0, 210, 230, 0.25, 0.16, 'sine'); T(0.45, 240, 200, 0.4, 0.14, 'sine'); break;
      case 'littleowl': T(0, 1400, 1050, 0.4, 0.08, 'sine'); T(1.2, 1450, 1080, 0.38, 0.07, 'sine'); break;
      case 'woodcock': T(0, 600, 560, 0.12, 0.06, 'sawtooth'); T(0.14, 600, 560, 0.12, 0.06, 'sawtooth'); T(0.5, 6500, 7200, 0.08, 0.04); break;
      // ---- added species
      case 'goldcrest': { let k = 0; for (let i = 0; i < 4; i++) { T(k, 7600, 7000, 0.07, 0.03); T(k + 0.08, 8200, 7600, 0.06, 0.03); k += 0.17; } for (let i = 0; i < 5; i++) T(k + i * 0.05, 7400 - i * 300, 6800 - i * 300, 0.04, 0.03); break; }
      case 'treecreeper': { let k = 0; for (let i = 0; i < 9; i++) { T(k, 7000 - i * 300, 6700 - i * 300, 0.06, 0.035); k += 0.07; } T(k + 0.05, 5200, 7200, 0.12, 0.035); break; }
      case 'bullfinch': T(0, 1900, 1700, 0.28, 0.07, 'sine'); T(0.9, 1850, 1650, 0.3, 0.06, 'sine'); break;
      case 'yellowhammer': { for (let i = 0; i < 7; i++) T(i * 0.11, 5600, 5400, 0.06, 0.05); T(0.85, 4400, 4500, 0.12, 0.06); T(1.0, 3500, 3300, 0.45, 0.06); break; }
      case 'kestrel': for (let i = 0; i < 6; i++) { T(i * 0.13, 3300, 3000, 0.09, 0.07, 'triangle'); } break;
      case 'lapwing': { T(0, 1600, 2900, 0.18, 0.08); T(0.2, 2900, 1800, 0.22, 0.07); T(0.9, 1700, 3000, 0.16, 0.07); T(1.08, 3000, 1900, 0.2, 0.06); break; }
      case 'waterrail': { // "sharming": grunts, then a piglet-like squeal
        for (let i = 0; i < 3; i++) this.noise(d, t + i * 0.16, 0.1, 0.1, 'bandpass', 900, 700, 3);
        this.tone(d, t + 0.55, 2400, 1300, 0.7, 0.07, 'sawtooth'); this.noise(d, t + 0.55, 0.7, 0.06, 'bandpass', 2600, 1600, 2);
        break;
      }
      case 'scopsowl': T(0, 1220, 1180, 0.22, 0.08, 'sine'); T(2.6, 1220, 1180, 0.22, 0.08, 'sine'); break;
      case 'hoopoe': for (let i = 0; i < 3; i++) T(i * 0.2, 520, 500, 0.12, 0.12, 'sine'); break;
      case 'oriole': { T(0, 1500, 1900, 0.14, 0.08); T(0.15, 1900, 1400, 0.12, 0.08); T(0.3, 1700, 2200, 0.2, 0.08); T(0.52, 2200, 1600, 0.18, 0.07); break; }
      case 'waxwing': for (let i = 0; i < 3; i++) { for (let j = 0; j < 8; j++) T(i * 0.5 + j * 0.03, 6200, 5900, 0.025, 0.035); } break;
      case 'osprey': for (let i = 0; i < 6; i++) T(i * 0.16, 2600 + i * 60, 2300 + i * 60, 0.1, 0.06); break;
      case 'bluethroat': { let k = 0; for (let i = 0; i < 4; i++) { T(k, 4200, 4200, 0.06, 0.05); k += 0.09; } for (let i = 0; i < 8; i++) { const f = 2500 + R() * 4000; T(k, f, f * (0.8 + R() * 0.4), 0.07, 0.05); k += 0.09; } this.noise(d, t + k, 0.05, 0.08, 'bandpass', 3000, 0, 4); break; }
      case 'hawfinch': T(0, 7200, 6400, 0.05, 0.07, 'square'); T(0.5, 7200, 6400, 0.05, 0.06, 'square'); break;
      // ---- fifth update
      case 'chaffinch': { // a rattling run that speeds up and ends in a flourish
        let k = 0, f = 5200;
        for (let i = 0; i < 11; i++) { T(k, f, f * 0.92, 0.05, 0.05); k += Math.max(0.045, 0.11 - i * 0.007); f -= 180; }
        T(k + 0.03, 3600, 4800, 0.07, 0.06); T(k + 0.12, 4800, 2800, 0.12, 0.06);
        break;
      }
      case 'blackcap': { let k = 0; for (let i = 0; i < 4; i++) { const f = 3000 + R() * 1200; T(k, f, f * 1.05, 0.07, 0.03 + i * 0.008); k += 0.09; } for (let i = 0; i < 6; i++) { const f = 2000 + R() * 1800; T(k, f, f * (0.85 + R() * 0.35), 0.13, 0.07, 'sine'); k += 0.15; } break; }
      case 'wagtail': for (let i = 0; i < 2; i++) { T(i * 0.14, 5200, 4400, 0.05, 0.06); this.noise(d, t + i * 0.14, 0.05, 0.05, 'bandpass', 4800, 0, 5); } break;
      case 'greenwoodpecker': for (let i = 0; i < 10; i++) T(i * 0.1, 1700 - i * 25, 1500 - i * 25, 0.08, 0.09, 'triangle'); break;
      case 'jay': for (let i = 0; i < 2; i++) { this.noise(d, t + i * 0.45, 0.28, 0.16, 'bandpass', 2100, 1600, 2); this.tone(d, t + i * 0.45, 900, 750, 0.26, 0.04, 'sawtooth'); } break;
      case 'redstart': { T(0, 4200, 4100, 0.18, 0.06); T(0.24, 3600, 3300, 0.1, 0.05); T(0.36, 3300, 3000, 0.1, 0.05); for (let i = 0; i < 5; i++) { const f = 3000 + R() * 2500; T(0.5 + i * 0.06, f, f * 0.9, 0.05, 0.04); } break; }
      case 'grebe': for (let i = 0; i < 4; i++) { this.tone(d, t + i * 0.13, 420, 360, 0.1, 0.09, 'sawtooth'); this.noise(d, t + i * 0.13, 0.09, 0.06, 'bandpass', 900, 700, 3); } break;
      case 'tern': for (let i = 0; i < 2; i++) { this.tone(d, t + i * 0.6, 3400, 2300, 0.35, 0.06, 'sawtooth'); this.noise(d, t + i * 0.6, 0.3, 0.05, 'bandpass', 3000, 2400, 4); } break;
      case 'stonecurlew': T(0, 1300, 2100, 0.28, 0.09, 'sine'); T(0.3, 2100, 1650, 0.32, 0.09, 'sine'); T(1.0, 1350, 2150, 0.26, 0.07, 'sine'); T(1.28, 2150, 1700, 0.3, 0.07, 'sine'); break;
      case 'marshharrier': for (let i = 0; i < 3; i++) T(i * 0.32, 2700, 1900, 0.22, 0.06); break;
      case 'redkite': T(0, 2300, 2600, 0.25, 0.07); T(0.27, 2600, 1700, 0.4, 0.07); T(0.75, 1800, 2400, 0.15, 0.05); T(0.92, 2400, 1700, 0.3, 0.05); break;
      case 'crane': for (let i = 0; i < 3; i++) { this.tone(d, t + i * 0.38, 760, 700, 0.3, 0.1, 'triangle'); this.tone(d, t + i * 0.38, 1520, 1400, 0.3, 0.03, 'sawtooth'); } break;
      case 'wallcreeper': for (let i = 0; i < 4; i++) T(i * 0.3, 3800 + i * 300, 4600 + i * 300, 0.2, 0.04); break;
      case 'crow': for (let i = 0; i < 3; i++) { this.tone(d, t + i * 0.42, 620, 520, 0.28, 0.08, 'sawtooth'); this.noise(d, t + i * 0.42, 0.26, 0.12, 'bandpass', 1100, 800, 2); } break;
      case 'gull': for (let i = 0; i < 3; i++) { this.tone(d, t + i * 0.3, 1900, 1100, 0.24, 0.07, 'sawtooth'); this.noise(d, t + i * 0.3, 0.22, 0.04, 'bandpass', 1800, 1200, 3); } break;
      case 'sparrow': for (let i = 0; i < 5; i++) { const f = 3200 + R() * 600; T(i * 0.22, f, f * 0.85, 0.08, 0.06, 'triangle'); } break;
      case 'starling': { let k = 0; for (let i = 0; i < 10; i++) { const r = R(); if (r < 0.3) this.noise(d, t + k, 0.05, 0.06, 'bandpass', 3000 + R() * 2000, 0, 6); else T(k, 1500 + R() * 4000, 1500 + R() * 4000, 0.1 + R() * 0.15, 0.05); k += 0.14 + R() * 0.1; } break; }
      case 'magpie': for (let i = 0; i < 6; i++) { this.noise(d, t + i * 0.11, 0.07, 0.16, 'bandpass', 1900, 1500, 2.5); this.tone(d, t + i * 0.11, 900, 700, 0.06, 0.04, 'sawtooth'); } break;
      default: T(0, 4000, 3500, 0.1, 0.05);
    }
  },

  // --------------------------------------------------------------- ambience
  setRain(on) {
    if (!this.ctx) return;
    if (on && !this.rainNode) {
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
      const g = c.createGain(); g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.25, c.currentTime + 2);
      s.connect(f); f.connect(g); g.connect(this.ambGain); s.start();
      this.rainNode = { s, g };
    } else if (!on && this.rainNode) {
      const r = this.rainNode; this.rainNode = null;
      r.g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.5);
      r.s.stop(this.ctx.currentTime + 1.6);
    }
  },

  // --------------------------------------------------------------- music
  // A soft, sparse, generative tune per season & time of day.
  updateMusic(season, minute, enabled) {
    if (!this.ctx || !enabled || this.vol.music <= 0.001) return;
    const c = this.ctx;
    const night = minute >= 20 * 60 || minute < 6 * 60;
    const scales = [
      [0, 2, 4, 7, 9, 12, 14, 16],   // spring: major pentatonic
      [0, 2, 4, 7, 9, 12, 14, 16],   // summer
      [0, 2, 3, 7, 9, 12, 14, 15],   // autumn: dorian-ish
      [0, 3, 5, 7, 10, 12, 15, 17],  // winter: minor pentatonic
    ];
    const roots = [65, 67, 62, 57];  // F, G, D, A (midi)
    const tempo = night ? 0.9 : [0.5, 0.45, 0.55, 0.65][season];
    const prog = [0, 5, 3, 4];
    while (this.nextNote < c.currentTime + 0.3) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 8) % 4;
      const chordRoot = roots[season] - 12 + [0, 9, 5, 7][prog[bar] % 4];
      const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
      if (this.step % 8 === 0) {
        // soft pad chord
        for (const iv of [0, 7, 12 + (season === WINTER || season === AUTUMN ? 3 : 4)]) {
          this.tone(this.musicGain, t, midi(chordRoot + iv), midi(chordRoot + iv), tempo * 7.5, night ? 0.025 : 0.035, 'sine', 0.8);
        }
        this.tone(this.musicGain, t, midi(chordRoot - 12), midi(chordRoot - 12), tempo * 6, 0.05, 'triangle', 0.3);
      }
      const sc = scales[season];
      const play = night ? Math.random() < 0.25 : Math.random() < (this.step % 2 === 0 ? 0.55 : 0.3);
      if (play) {
        const deg = sc[Math.floor(Math.random() * sc.length)];
        const f = midi(roots[season] + deg);
        this.tone(this.musicGain, t, f, f, tempo * (1.2 + Math.random()), night ? 0.035 : 0.05, 'triangle', 0.01);
        if (Math.random() < 0.2) this.tone(this.musicGain, t + tempo / 2, f * 2, f * 2, tempo, 0.02, 'sine', 0.01);
      }
      this.step++;
      this.nextNote += tempo;
    }
  },
};
