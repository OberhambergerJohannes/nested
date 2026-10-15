'use strict';
// Lofi hip-hop for the valley, synthesised by the game like every other sound.
//
// Instruments: a felt piano and plucked strings (guitar, bass) are rendered once per note into
// sample buffers (inharmonic, slightly out-of-tune piano strings with a soft hammer; Karplus–Strong
// strings), so they sound like played instruments rather than oscillators. Drums, kalimba, flute and
// vibraphone are synthesised live. Vinyl crackle and a wobbling tape sit on top.
//
// Players: a pianist with two hands who rolls, breaks and anticipates chords, holds the pedal, plays
// little runs at the end of phrases and sometimes takes the tune; a guitarist (fingerpicking or
// licks), a bass player, a drummer with fills — all with a human, swung, slightly loose feel.
//
// Mix: every instrument has its own EQ and place in the stereo field, the bass and keys duck under
// the kick, and the whole band goes through a gentle glue compressor and tape saturation.

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------------------------------------------------------- harmony
// Chord qualities: the notes above the root the pianist's right hand plays (the bass plays the root)
const LOFI_CHORDS = {
  maj7: [0, 4, 7, 11], maj9: [4, 7, 11, 14], 'maj9#11': [4, 11, 14, 18], '6/9': [4, 7, 9, 14],
  m7: [0, 3, 7, 10], m9: [3, 7, 10, 14], m11: [3, 10, 14, 17], m7b5: [0, 3, 6, 10],
  9: [4, 7, 10, 14], 13: [4, 10, 14, 21], '13sus': [5, 10, 14, 21], '7b9': [4, 7, 10, 13],
};
const NOTE_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 'Ebmaj9' -> {root: 3, iv: [4, 7, 11, 14]}
function parseChord(name) {
  let pc = NOTE_PC[name[0]], i = 1;
  if (name[i] === 'b') { pc--; i++; } else if (name[i] === '#') { pc++; i++; }
  return { root: (pc + 12) % 12, iv: LOFI_CHORDS[name.slice(i)] };
}

// A close or drop-2 voicing between E3 and E5 that moves as little as possible from the last one,
// with the top voice kept around A4 — so the chords glide into each other instead of jumping,
// and never sink into a muddy low cluster on top of the bass
function voiceChord(ch, prev) {
  const pcs = ch.iv.map((v) => (ch.root + v) % 12);
  let best = null, bestCost = 1e9;
  for (let lo = 52; lo <= 66; lo++) {
    for (let r = 0; r < pcs.length; r++) {
      if (lo % 12 !== pcs[r]) continue;
      const close = [lo];
      for (let k = 1; k < pcs.length; k++) { let n = close[k - 1] + 1; while (n % 12 !== pcs[(r + k) % pcs.length]) n++; close.push(n); }
      const drop2 = close.slice(); drop2[drop2.length - 2] -= 12; drop2.sort((a, b) => a - b);
      for (const v of [close, drop2]) {
        const top = v[v.length - 1];
        if (v[0] < 52 || top > 76) continue;
        let cost = Math.abs(top - 69) * 0.5 + Math.max(0, 65 - top) * 2;
        if (prev) for (let i = 0; i < v.length; i++) cost += Math.abs(v[i] - prev[Math.min(i, prev.length - 1)]);
        if (cost < bestCost) { bestCost = cost; best = v; }
      }
    }
  }
  return best;
}
// The bass note for a chord root, kept between C2 and B2
const bassMidi = (root) => 36 + root;
// The chord's third and seventh (for left-hand shells), as intervals above the root
const chordThird = (ch) => ch.iv.find((i) => i >= 3 && i <= 5) ?? 4;
const chordSeventh = (ch) => ch.iv.find((i) => i >= 9 && i <= 11) ?? 10;
// Every note of the pitch classes pcs between lo and hi, ascending
function notesIn(pcs, lo, hi) { const out = []; for (let n = lo; n <= hi; n++) if (pcs.includes(n % 12)) out.push(n); return out; }

// ---------------------------------------------------------------- sampled instruments
// Played notes are rendered once into buffers and kept. Half the output sample rate is plenty for
// these mellow sounds and halves the memory and the time it takes to make them.
// A piano note is rendered one overtone at a time, so rendering ahead can stop after any of them and
// carry on in the next frame without ever holding up the game.
const LofiSamples = {
  cache: new Map(),
  jobs: new Map(),
  key(ctx, kind, m) { return kind + m + ':' + Math.round(ctx.sampleRate / 2); },
  has(ctx, kind, m) { return this.cache.has(this.key(ctx, kind, m)); },
  // work on a note until `deadline` (performance.now() ms); true once it's ready
  step(ctx, kind, m, deadline) {
    const key = this.key(ctx, kind, m);
    if (this.cache.has(key)) return true;
    const sr = Math.round(ctx.sampleRate / 2);
    let job = this.jobs.get(key);
    if (!job) { job = kind === 'piano' ? pianoSamples(sr, m) : (function* () { return pluckSamples(sr, m, kind === 'bass'); })(); this.jobs.set(key, job); }
    for (;;) {
      const r = job.next();
      if (r.done) {
        const b = ctx.createBuffer(1, r.value.length, sr);
        b.getChannelData(0).set(r.value);
        this.cache.set(key, b); this.jobs.delete(key);
        return true;
      }
      if (performance.now() > deadline) return false;
    }
  },
  get(ctx, kind, m) { this.step(ctx, kind, m, Infinity); return this.cache.get(this.key(ctx, kind, m)); },
};

// Felt piano: each note is two strings, slightly out of tune with each other (the slow beating of a
// real piano), with stretched (inharmonic) overtones that die away faster the higher they are, a
// quick "prompt" decay and a long "after-sound", and the soft thump of a felt hammer.
function* pianoSamples(sr, m) {
  const f0 = mtof(m), top = Math.min(sr * 0.45, 7000);
  const dur = clamp(4.6 - (m - 40) * 0.07, 1.6, 4.6), n = Math.floor(sr * dur), out = new Float32Array(n);
  const B = 0.00018 * Math.pow(2, (m - 60) / 14);            // string stiffness: overtones a little sharp
  const tau = clamp(3.8 - (m - 48) * 0.055, 0.7, 4.6);         // low notes ring longer
  const rnd = mulberry32(m * 977 + 11);
  for (let k = 1; k <= 30; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > top) break;
    // a soft hammer: overtones fall away, with a dip where it strikes (1/8 of the string)
    const a = Math.pow(k, -1.55) * (0.3 + 0.7 * Math.abs(Math.sin(Math.PI * k * 0.125)));
    const d1 = Math.exp(-1 / (tau * 0.25 / (1 + 0.6 * (k - 1)) * sr)), d2 = Math.exp(-1 / (tau / (1 + 0.5 * (k - 1)) * sr));
    for (const s of [-1, 1]) {
      // the two strings are about half a cent apart: a slow, gentle shimmer, not a wobble
      const w = 2 * Math.PI * fk * (1 + s * 0.00028 * (1 + 0.02 * k)) / sr, c2 = 2 * Math.cos(w), ph = rnd() * 6.2832;
      let y1 = Math.sin(ph - w), y2 = Math.sin(ph - 2 * w), e1 = a * 0.55, e2 = a * 0.45;
      for (let i = 0; i < n; i++) {
        const y = c2 * y1 - y2; y2 = y1; y1 = y;
        out[i] += y * (e1 + e2);
        e1 *= d1; e2 *= d2;
        if (e2 < 2e-5) break;
      }
    }
    yield;
  }
  // the felt hammer and the key bed: a short, soft thump
  let lp = 0;
  for (let i = 0, tn = Math.floor(sr * 0.04); i < tn; i++) { lp += ((rnd() * 2 - 1) - lp) * 0.12; out[i] += lp * 0.35 * Math.exp(-i / (sr * 0.008)); }
  return normalise(out, sr);
}

// Plucked strings (Karplus–Strong): a burst of soft noise circulating in a tuned delay line that
// loses a little brightness on every round — a fingerpicked nylon guitar, or a thumbed bass.
function pluckSamples(sr, m, bass) {
  const f0 = mtof(m), dur = bass ? 2.4 : 2.8, n = Math.floor(sr * dur), out = new Float32Array(n);
  const N = sr / f0, L = Math.max(2, Math.floor(N - 0.6)), frac = N - 0.5 - L;   // an allpass tunes the fraction
  const C = (1 - frac) / (1 + frac);
  const t60 = bass ? 1.8 : clamp(3 - (m - 52) * 0.05, 1.2, 3);
  const g = Math.pow(0.001, 1 / (f0 * t60));
  const rnd = mulberry32(m * 131 + (bass ? 7 : 3));
  const buf = new Float32Array(L);
  let lp = 0;
  for (let i = 0; i < L; i++) { lp += ((rnd() * 2 - 1) - lp) * (bass ? 0.22 : 0.55); buf[i] = lp; }
  const pick = Math.max(1, Math.floor(L * (bass ? 0.22 : 0.14)));   // where the string is plucked
  for (let i = L - 1; i >= pick; i--) buf[i] -= buf[i - pick];
  let idx = 0, prev = 0, apX = 0, apY = 0;
  for (let i = 0; i < n; i++) {
    const cur = buf[idx];
    const avg = (cur + prev) * 0.5 * g;
    prev = cur;
    const ap = C * avg + apX - C * apY; apX = avg; apY = ap;
    buf[idx] = ap;
    out[i] = cur;
    if (++idx === L) idx = 0;
  }
  return normalise(out, sr);
}

function normalise(out, sr) {
  let peak = 1e-9;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const g = 0.9 / peak, fade = Math.floor(sr * 0.08), n = out.length;
  for (let i = 0; i < n; i++) out[i] *= g * (i > n - fade ? (n - i) / fade : 1);
  return out;
}

// ---------------------------------------------------------------- patterns
// Drums: one character per 16th note. X accent, x normal, o ghost.
// Two kick patterns: the first for most bars, the second for every fourth bar.
const LOFI_DRUMS = {
  boom: { kick: ['X.........X.....', 'X......x..X..x..'], snare: '....X.......X...', ghost: '..........o...o.', hat: 'x.o.x.ox.ox.x.o.', sn: 'snare' },
  lazy: { kick: ['X......x..X.....', 'X.........x..x..'], snare: '....X.......X...', ghost: '..............o.', hat: 'x...x.o.x...x.ox', sn: 'snare' },
  brush: { kick: ['X.......X.......', 'X.....x.X.......'], snare: '....X.......X...', ghost: '..o.......o.....', hat: 'x.o.x.o.x.o.x.o.', sn: 'brush' },
  half: { kick: ['X.........x.....', 'X.....x...x.....'], snare: '........X.......', ghost: '..............o.', hat: '..o...o...o...o.', sn: 'rim' },
};
// Bass: [step, note, length, velocity]; R root, F fifth, O octave, N a chromatic step into the next chord
const LOFI_BASS = {
  walk: [[0, 'R', 7, 0.9], [10, 'R', 3, 0.6], [14, 'N', 2, 0.55]],
  hold: [[0, 'R', 15, 0.85]],
  bounce: [[0, 'R', 5, 0.9], [6, 'O', 2, 0.45], [8, 'F', 5, 0.7], [14, 'N', 2, 0.5]],
};
// Guitar licks: rhythms ([step, length]) for little phrases at the end of a line
const LOFI_LICKS = [
  [[8, 2], [10, 1], [11, 1], [12, 4]],
  [[9, 1], [10, 2], [12, 2], [14, 2]],
  [[8, 1], [9, 1], [10, 2], [13, 3]],
  [[10, 2], [12, 1], [13, 1], [14, 2]],
];
// Song form. parts: k keys, b bass, d drums, h hats & soft kick, l lead, g guitar, m the piano takes the tune
const LOFI_FORM = [
  { s: 'intro', n: 4, parts: 'k', lp: [900, 9000] },
  { s: 'A', n: 8, parts: 'kbdg', lp: [9000, 9000] },
  { s: 'B', n: 8, parts: 'kbdlg', lp: [9000, 9000] },
  { s: 'break', n: 4, parts: 'khgl', lp: [2400, 3600] },
  { s: 'A', n: 8, parts: 'kbdgm', lp: [9000, 9000] },
  { s: 'B', n: 8, parts: 'kbdlg', lp: [9000, 9000] },
  { s: 'outro', n: 4, parts: 'kb', lp: [9000, 700] },
];

// ---------------------------------------------------------------- the songs
// moods: when the song plays (the first is its home); key: tonic pitch class (minor or major), used
// for the guitar's pentatonic licks; piano: the pianist's favourite way to comp; prog: one chord per
// bar ('Am9 D13' = two chords, half a bar each); melody: per bar, [step, midi note, 16ths]
const LOFI_SONGS = [
  {
    id: 'featherbrook', title: 'Featherbrook', moods: ['title', 'spring', 'summer'], bpm: 78, swing: 0.6,
    key: 7, minor: false, piano: 'melodic', guitar: 'licks', drums: 'boom', bass: 'walk', lead: 'kalimba', pianoTune: true,
    prog: ['Gmaj9', 'Bm7', 'Em9', 'Cmaj9', 'Gmaj9', 'Bm7', 'Em9', 'Am9 D13'],
    melody: [
      [[0, 74, 3], [3, 71, 3], [6, 69, 2], [8, 71, 6], [14, 74, 2]],
      [[0, 78, 4], [4, 76, 2], [6, 74, 4], [12, 69, 4]],
      [[0, 67, 3], [3, 71, 3], [6, 74, 2], [8, 78, 6], [14, 76, 2]],
      [[0, 74, 8], [8, 71, 2], [10, 69, 2], [12, 67, 4]],
      [[0, 74, 3], [3, 71, 3], [6, 69, 2], [8, 71, 4], [12, 67, 2], [14, 69, 2]],
      [[0, 71, 3], [3, 74, 3], [6, 78, 6], [12, 76, 2], [14, 74, 2]],
      [[0, 76, 4], [4, 74, 2], [6, 71, 2], [8, 67, 4], [12, 69, 4]],
      [[0, 71, 4], [4, 69, 4], [8, 66, 4], [12, 69, 4]],
    ],
  },
  {
    id: 'garden', title: 'Garden Afternoon', moods: ['summer', 'spring', 'autumn'], bpm: 84, swing: 0.58,
    key: 3, minor: false, piano: 'charleston', guitar: 'licks', drums: 'lazy', bass: 'bounce', lead: 'vibes', pianoTune: true,
    prog: ['Ebmaj9', 'Cm9', 'Fm9', 'Bb13', 'Ebmaj9', 'Cm9', 'Fm9', 'Bb13sus Bb13'],
    melody: [
      [[2, 70, 2], [4, 74, 6], [10, 72, 2], [12, 70, 4]],
      [[0, 67, 4], [4, 70, 2], [6, 75, 6], [12, 74, 4]],
      [[0, 72, 3], [3, 68, 3], [6, 67, 2], [8, 68, 4], [12, 72, 2], [14, 75, 2]],
      [[0, 74, 6], [6, 72, 2], [8, 70, 4], [12, 67, 4]],
      [[0, 70, 2], [2, 74, 2], [4, 77, 6], [10, 75, 2], [12, 74, 4]],
      [[0, 75, 3], [3, 74, 3], [6, 70, 6], [12, 67, 4]],
      [[0, 68, 4], [4, 72, 4], [8, 75, 4], [12, 74, 2], [14, 72, 2]],
      [[0, 70, 8], [12, 67, 2], [14, 70, 2]],
    ],
  },
  {
    id: 'leaves', title: 'Falling Leaves', moods: ['autumn', 'winter'], bpm: 74, swing: 0.62,
    key: 7, minor: true, piano: 'pulse', guitar: 'arp', drums: 'boom', bass: 'walk', lead: 'flute', pianoTune: false,
    prog: ['Cm9', 'F13', 'Bbmaj9', 'Ebmaj9', 'Am7b5', 'D7b9', 'Gm9', 'Gm9'],
    melody: [
      [[0, 67, 3], [3, 70, 3], [6, 74, 6], [12, 72, 4]],
      [[0, 69, 4], [4, 72, 2], [6, 74, 6], [12, 75, 4]],
      [[0, 74, 8], [8, 72, 2], [10, 70, 2], [12, 69, 4]],
      [[0, 67, 6], [6, 70, 2], [8, 74, 8]],
      [[0, 72, 3], [3, 75, 3], [6, 74, 2], [8, 72, 4], [12, 69, 4]],
      [[0, 66, 4], [4, 69, 2], [6, 72, 4], [10, 75, 2], [12, 74, 4]],
      [[0, 74, 6], [6, 70, 2], [8, 69, 4], [12, 67, 4]],
      [[0, 67, 10], [12, 70, 2], [14, 69, 2]],
    ],
  },
  {
    id: 'snow', title: 'Snow on the Feeder', moods: ['winter', 'night'], bpm: 70, swing: 0.6,
    key: 0, minor: false, piano: 'broken', guitar: null, drums: 'brush', bass: 'hold', lead: 'kalimba', pianoTune: true,
    prog: ['Fmaj9#11', 'Em9', 'Dm9', 'Cmaj9', 'Fmaj9#11', 'Em9', 'Dm9', 'Cmaj9'],
    melody: [
      [[0, 76, 2], [2, 79, 2], [4, 81, 4], [8, 79, 2], [10, 76, 2], [12, 72, 4]],
      [[0, 74, 4], [4, 71, 2], [6, 67, 2], [8, 69, 8]],
      [[0, 69, 2], [2, 72, 2], [4, 76, 4], [8, 77, 2], [10, 76, 2], [12, 72, 4]],
      [[0, 74, 6], [6, 76, 2], [8, 79, 8]],
      [[0, 81, 4], [4, 79, 2], [6, 76, 2], [8, 72, 4], [12, 74, 4]],
      [[0, 76, 4], [4, 74, 4], [8, 71, 8]],
      [[0, 72, 2], [2, 74, 2], [4, 76, 2], [6, 77, 2], [8, 76, 4], [12, 74, 4]],
      [[0, 76, 8], [12, 71, 4]],
    ],
  },
  {
    id: 'moonlit', title: 'Moonlit Valley', moods: ['night'], bpm: 64, swing: 0.62,
    key: 3, minor: false, piano: 'broken', guitar: 'arp', drums: 'half', bass: 'hold', lead: 'flute', pianoTune: true,
    prog: ['Ebmaj9', 'Abmaj9', 'Fm11', 'Bb13sus', 'Ebmaj9', 'Abmaj9', 'Fm11', 'Bb13sus'],
    melody: [
      [[0, 67, 6], [6, 70, 2], [8, 74, 8]],
      [[0, 72, 8], [8, 70, 4], [12, 67, 4]],
      [[0, 68, 6], [6, 70, 2], [8, 72, 4], [12, 75, 4]],
      [[0, 77, 8], [8, 75, 4], [12, 72, 4]],
      [[0, 79, 6], [6, 77, 2], [8, 74, 8]],
      [[0, 75, 4], [4, 72, 4], [8, 70, 8]],
      [[0, 72, 4], [4, 68, 4], [8, 67, 4], [12, 65, 4]],
      [[0, 70, 12]],
    ],
  },
];

// ---------------------------------------------------------------- the radio
class LofiRadio {
  // ctx: an AudioContext (or OfflineAudioContext); out: where the music goes
  constructor(ctx, out) {
    this.ctx = ctx;
    this.rng = mulberry32(1979);
    this.song = null; this.mood = null; this.leaving = false;
    this.nowPlaying = null;     // {title, t (context time it starts)}
    this.plays = {};            // how often each song has started (to take turns)
    this.warm = [];             // notes to render ahead of time, a few per frame
    this._graph(out);
  }

  // ---- the mixing desk
  _graph(out) {
    const c = this.ctx, sr = c.sampleRate;
    const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filt = (type, f, q, to, db) => { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (db) b.gain.value = db; if (to) b.connect(to); return b; };
    const pan = (p, to) => { const s = c.createStereoPanner(); s.pan.value = p; s.connect(to); return s; };
    // the end of the chain: tape saturation (unity gain, rounds off peaks), a low cut, the radio
    // filter that opens in the intro and closes in the outro, and room for birdsong
    this.out = gain(1, out);
    const hp = filt('highpass', 30, 0.7, this.out);
    this.birdDuck = gain(1, hp);
    this.radioLP = filt('lowpass', 9000, 0.6, this.birdDuck);
    const sat = c.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(1.15 * x) / 1.15; }
    sat.curve = curve; sat.connect(this.radioLP);
    // glue: a gentle bus compressor that makes the band sit together
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -15; glue.knee.value = 8; glue.ratio.value = 2; glue.attack.value = 0.025; glue.release.value = 0.2;
    glue.connect(sat);
    this._glue = glue;
    this.mix = gain(1, glue);
    // sidechain: the bass gives way to the kick a lot, the rest of the band a little
    this.duckBass = gain(1, this.mix);
    this.duckBand = gain(1, this.mix);
    // piano: low cut (the bass owns the bottom), a little less boxiness, a touch of air
    this.piano = gain(1);
    const pHP = filt('highpass', 95, 0.6), pMud = filt('peaking', 320, 1.1, null, -3.5), pAir = filt('highshelf', 4500, 0.7, null, 2);
    this.piano.connect(pHP); pHP.connect(pMud); pMud.connect(pAir); pAir.connect(this.duckBand);
    // guitar: off to the left, with a little presence
    this.guitar = gain(1);
    const gHP = filt('highpass', 150, 0.7), gPres = filt('peaking', 2600, 1, null, 2.5);
    this.guitar.connect(gHP); gHP.connect(gPres); gPres.connect(pan(-0.38, this.duckBand));
    // lead: a little to the right, above the piano
    this.lead = gain(1);
    const lHP = filt('highpass', 230, 0.7);
    this.lead.connect(lHP); lHP.connect(pan(0.28, this.duckBand));
    // bass: centred, no rumble, no fizz
    this.bass = gain(1);
    const bHP = filt('highpass', 34, 0.7), bLP = filt('lowpass', 1100, 0.6);
    this.bass.connect(bHP); bHP.connect(bLP); bLP.connect(this.duckBass);
    // drums: kick and snare in the middle, hats a little right
    this.drums = gain(1, this.mix);
    this.hats = gain(1);
    const hLP = filt('lowpass', 11000, 0.5);
    this.hats.connect(hLP); hLP.connect(pan(0.3, this.mix));
    // room reverb (a decaying burst of dark noise), kept out of the bass and the fizz
    this.verb = gain(1);
    const conv = c.createConvolver();
    const len = Math.floor(sr * 2.2), ir = c.createBuffer(2, len, sr), rnd = mulberry32(77);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) { lp += ((rnd() * 2 - 1) - lp) * 0.4; d[i] = lp * Math.pow(1 - i / len, 2) * Math.exp(-i / (sr * 0.8)); }
    }
    conv.buffer = ir;
    const vHP = filt('highpass', 280, 0.7), vLP = filt('lowpass', 6000, 0.5);
    this.verb.connect(conv); conv.connect(vHP); vHP.connect(vLP); vLP.connect(gain(0.5, this.mix));
    // a soft echo for the lead and the guitar licks
    this.echo = c.createDelay(1.5);
    const fb = gain(0.3), eLP = filt('lowpass', 2400, 0.5), eHP = filt('highpass', 300, 0.6);
    this.echo.connect(eLP); eLP.connect(eHP); eHP.connect(fb); fb.connect(this.echo);
    eHP.connect(pan(-0.2, gain(0.28, this.mix)));
    // sends
    this.piano.connect(gain(0.2, this.verb));
    this.guitar.connect(gain(0.18, this.verb)); this.guitar.connect(gain(0.12, this.echo));
    this.lead.connect(gain(0.32, this.verb)); this.lead.connect(gain(0.28, this.echo));
    // tape: slow wow and fast flutter, shared by every pitched note
    this.wow = gain(1);
    this._lfo(0.45, 6, this.wow);
    this._lfo(6.5, 1.5, this.wow);
    // noise for drums, and vinyl crackle that runs under everything
    const nlen = sr * 2;
    this.noise = c.createBuffer(1, nlen, sr);
    const nd = this.noise.getChannelData(0), nr = mulberry32(5);
    for (let i = 0; i < nlen; i++) nd[i] = nr() * 2 - 1;
    this.crackle = this._crackleBuf();
    this.crackleGain = gain(0.0001, this.out);
  }

  // a low-frequency oscillator wobbling an AudioParam (or node) by ±depth
  _lfo(freq, depth, target) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq; g.gain.value = depth;
    o.connect(g); g.connect(target); o.start();
  }

  // a few seconds of record surface: soft hiss and random pops, looped
  _crackleBuf() {
    const c = this.ctx, sr = c.sampleRate, len = sr * 5;
    const b = c.createBuffer(2, len, sr), r = mulberry32(33);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) { lp += ((r() * 2 - 1) - lp) * 0.08; d[i] = lp * 0.035; }
      for (let k = 0; k < 60; k++) {
        const at = Math.floor(r() * (len - 400)), a = (r() < 0.15 ? 0.18 : 0.06) * (0.4 + r());
        for (let j = 0; j < 60; j++) d[at + j] += a * Math.exp(-j / 6) * (j % 2 ? -1 : 1);
      }
    }
    return b;
  }

  // ---- instruments (t: start time, vel 0..1)
  // tape wobble on a pitched source; unhooked when the note ends so finished notes can be cleaned up
  _wobble(src) {
    if (!src.detune) return;
    this.wow.connect(src.detune);
    src.onended = () => { try { this.wow.disconnect(src.detune); } catch (e) { /* already gone */ } };
  }
  _env(g, t, peak, attack, decayTo, decayTime, end, release) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * decayTo, t + attack, decayTime);
    g.gain.setTargetAtTime(0.0001, end, release);
  }
  _osc(type, f, t, stop, wob) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    if (wob !== false) this._wobble(o);
    o.start(t); o.stop(stop);
    return o;
  }
  // a sampled note: brighter the harder it's played; `end` is when the damper (or the hand) stops it
  _sample(kind, t, m, vel, end, to, opts) {
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = LofiSamples.get(c, kind, m);
    this._wobble(s);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.4;
    lp.frequency.value = opts.bright[0] + vel * vel * opts.bright[1];
    const g = c.createGain(), lvl = opts.level * Math.pow(vel, 1.4);
    g.gain.setValueAtTime(lvl, t);
    g.gain.setValueAtTime(lvl, Math.max(t, end));
    g.gain.setTargetAtTime(0.0001, Math.max(t, end), opts.release);
    s.connect(lp); lp.connect(g);
    if (opts.pan != null) { const p = c.createStereoPanner(); p.pan.value = opts.pan; g.connect(p); p.connect(to); } else g.connect(to);
    s.start(t); s.stop(Math.min(t + s.buffer.duration, Math.max(t, end) + opts.release * 6));
  }

  // Felt piano: low notes a little to the left, high notes to the right, as you'd hear sitting at it
  pianoNote(t, m, vel, end) {
    this._sample('piano', t, m, vel, end, this.piano, { level: 0.46, bright: [800, 5200], release: 0.12, pan: clamp((m - 62) / 36, -0.45, 0.45) });
    if (vel > 0.75) this._noise(t, 0.012, 0.004 * vel, 'bandpass', 2400, this.piano); // the key hitting the bed
  }
  guitarNote(t, m, vel, end) {
    this._sample('guitar', t, m, vel, end, this.guitar, { level: 0.5, bright: [1500, 3800], release: 0.1 });
  }
  // Bass: a thumbed string with a clean sine underneath for weight
  bassNote(t, m, vel, dur) {
    const end = t + dur;
    this._sample('bass', t, m, vel, end, this.bass, { level: 0.11, bright: [500, 900], release: 0.07 });
    const o = this._osc('sine', mtof(m), t, end + 0.5), g = this.ctx.createGain();
    this._env(g, t, 0.063 * (0.6 + vel * 0.5), 0.01, 0.8, 0.8, end, 0.06);
    o.connect(g); g.connect(this.bass);
  }

  kick(t, vel) {
    const c = this.ctx, o = this._osc('sine', 120, t, t + 0.6, false), g = c.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.1);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42 * vel, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.03, 0.1);
    o.connect(g); g.connect(this.drums);
    this._noise(t, 0.01, 0.07 * vel, 'bandpass', 3000, this.drums);       // the beater
    // the band breathes with the kick
    this.duckBass.gain.setTargetAtTime(0.45, t, 0.004);
    this.duckBass.gain.setTargetAtTime(1, t + 0.06, 0.1);
    this.duckBand.gain.setTargetAtTime(0.82, t, 0.006);
    this.duckBand.gain.setTargetAtTime(1, t + 0.05, 0.14);
  }
  snare(t, vel, kind) {
    if (kind === 'rim') {
      const o = this._osc('triangle', 1700, t, t + 0.1, false), g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.004, 0.012);
      o.connect(g); g.connect(this.drums); g.connect(this.verb);
      this._noise(t, 0.03, 0.14 * vel, 'highpass', 3200, this.drums, this.verb);
      return;
    }
    if (kind === 'brush') { this._noise(t, 0.32, 0.24 * vel, 'bandpass', 3800, this.drums, this.verb, 0.015, 0.07); return; }
    // the crack (filtered noise, two bands) and the drum's body
    this._noise(t, 0.2, 0.38 * vel, 'bandpass', 2200, this.drums, this.verb, 0.001, 0.045);
    this._noise(t, 0.12, 0.13 * vel, 'highpass', 6000, this.drums, null, 0.001, 0.03);
    const o = this._osc('triangle', 210, t, t + 0.2, false), g = this.ctx.createGain();
    o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(170, t + 0.07);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26 * vel, t + 0.002); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.035);
    o.connect(g); g.connect(this.drums);
  }
  hat(t, vel, open) {
    this._noise(t, open ? 0.35 : 0.06, 0.3 * vel, 'highpass', 7500, this.hats, null, 0.001, open ? 0.1 : 0.014);
  }
  // a burst of noise through a filter: snares, hats, clicks
  _noise(t, dur, peak, type, f, to, send, attack, tc) {
    const c = this.ctx, s = c.createBufferSource();
    s.buffer = this.noise;
    const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = type === 'bandpass' ? 0.8 : 0.7;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (attack || 0.002));
    g.gain.setTargetAtTime(0.0001, t + (attack || 0.002), tc || dur / 4);
    s.connect(b); b.connect(g); g.connect(to);
    if (send) { const sg = this.ctx.createGain(); sg.gain.value = 0.3; g.connect(sg); sg.connect(send); }
    s.start(t, (t * 7.31) % 1.5); s.stop(t + dur + 0.1);
  }

  // Leads
  kalimba(t, m, vel) {
    const c = this.ctx, f = mtof(m);
    const o = this._osc('sine', f, t, t + 2), g = c.createGain();
    this._env(g, t, 0.12 * vel, 0.003, 0.25, 0.5, t + 1.4, 0.2);
    const p = this._osc('sine', f * 5.95, t, t + 0.3), pg = c.createGain();
    pg.gain.setValueAtTime(0.035 * vel, t); pg.gain.setTargetAtTime(0.0001, t, 0.03);
    o.connect(g); g.connect(this.lead); p.connect(pg); pg.connect(this.lead);
  }
  flute(t, m, vel, dur) {
    const c = this.ctx, f = mtof(m), stop = t + dur + 0.4;
    const o = this._osc('sine', f, t, stop), o2 = this._osc('triangle', f, t, stop), g = c.createGain();
    // vibrato that blooms after the attack
    const vib = this._osc('sine', 5.2, t, stop, false), vg = c.createGain();
    vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(14, t + Math.min(0.5, dur));
    vib.connect(vg); vg.connect(o.detune); vg.connect(o2.detune);
    const g2 = c.createGain(); g2.gain.value = 0.12;
    this._env(g, t, 0.1 * vel, 0.07, 0.85, 0.5, t + dur, 0.09);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.lead);
    this._noise(t, Math.min(dur, 0.4), 0.016 * vel, 'bandpass', f * 2, this.lead, null, 0.05, 0.1);
  }
  vibes(t, m, vel, dur) {
    const c = this.ctx, f = mtof(m), len = Math.max(dur, 1.2), stop = t + len + 0.6;
    const o = this._osc('sine', f, t, stop), o4 = this._osc('sine', f * 4, t, t + 0.6), g = c.createGain(), g4 = c.createGain();
    this._env(g, t, 0.11 * vel, 0.003, 0.4, 0.9, t + len, 0.25);
    g4.gain.setValueAtTime(0.04 * vel, t); g4.gain.setTargetAtTime(0.0001, t, 0.08);
    // the vibraphone's motor: a soft tremolo
    const trem = c.createGain(); trem.gain.value = 0.8;
    const lo = this._osc('sine', 5.5, t, stop, false), lg = c.createGain(); lg.gain.value = 0.2;
    lo.connect(lg); lg.connect(trem.gain);
    o.connect(g); g.connect(trem); o4.connect(g4); g4.connect(trem); trem.connect(this.lead);
  }

  // ---- the sequencer
  // Which songs suit a mood: 'title', a season name or 'night'
  _songsFor(mood) { return LOFI_SONGS.filter((s) => s.moods.includes(mood)); }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    if (this.song && !this.song.moods.includes(mood)) this.leaving = true;
  }

  // Start a song (the next one for the mood, taking turns) at context time t
  start(t, song) {
    if (!song) {
      // songs take turns; on a tie, the one written for this mood goes first
      const mood = this.mood || 'title', rank = (s) => (this.plays[s.id] || 0) * 2 + (s.moods[0] === mood ? 0 : 1);
      song = this._songsFor(mood).sort((a, b) => rank(a) - rank(b))[0] || LOFI_SONGS[0];
    }
    this.plays[song.id] = (this.plays[song.id] || 0) + 1;
    this.song = song; this.leaving = false;
    this.sec = 0; this.bar = 0; this.barInSong = 0; this.t = t;
    this.dur16 = 60 / song.bpm / 4; this.barDur = this.dur16 * 16;
    this.anticipated = false;
    this.echo.delayTime.setValueAtTime(this.dur16 * 3, t);
    // the chords of every bar, voiced once (twice round, so the first bar follows on from the last)
    this.bars = song.prog.map((b) => b.split(' ').map(parseChord));
    let prev = null;
    for (let pass = 0; pass < 2; pass++) for (const b of this.bars) for (const ch of b) { ch.v = voiceChord(ch, prev); prev = ch.v; }
    // every note this song's piano, guitar and bass may play, to be rendered a few at a time ahead
    this.warm = this._notesOf(song);
    for (let i = 0; i < 6 && this.warm.length; i++) { const [k, m] = this.warm.shift(); LofiSamples.get(this.ctx, k, m); }
    this.nowPlaying = { title: song.title, t };
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(1, t, 0.05);
    this.crackleGain.gain.setTargetAtTime(0.32, t, 0.5);
    this._section(t);
    if (!this.crackleSrc) {
      const s = this.ctx.createBufferSource(); s.buffer = this.crackle; s.loop = true;
      s.connect(this.crackleGain); s.start(t);
      this.crackleSrc = s;
    }
  }

  // [kind, midi] for every note a song can ask for, the first bars' notes first
  _notesOf(song) {
    const out = [], seen = new Set(), add = (k, m) => { if (!seen.has(k + m) && !LofiSamples.has(this.ctx, k, m)) { seen.add(k + m); out.push([k, m]); } };
    for (const b of this.bars) for (const ch of b) {
      for (const m of ch.v) add('piano', m);
      add('bass', bassMidi(ch.root)); add('bass', bassMidi(ch.root) + 12); add('bass', bassMidi(ch.root) + 7);
    }
    for (const b of this.bars) for (const ch of b) {
      const pcs = [ch.root, ...ch.iv.map((i) => (ch.root + i) % 12)];
      for (const m of notesIn(pcs, 40, 59)) add('piano', m);
      for (const m of notesIn(pcs, 60, 84)) add('piano', m);
      if (song.guitar) for (const m of notesIn(pcs, 40, 79)) add('guitar', m);
    }
    for (const bar of song.melody) for (const [, m] of bar) add('piano', m);
    if (song.guitar) for (const m of this._penta(song, 59, 81)) add('guitar', m);
    for (let m = 35; m <= 48; m++) add('bass', m);
    return out;
  }
  // Render a few waiting notes, a little each frame (called by the game between frames). When this
  // song's notes are ready, the other songs' notes follow, so a new song never has to wait for them.
  warmUp(budgetMs) {
    const t0 = performance.now();
    if (!this.warm.length && !this.warmedAll && this.song) {
      this.warmedAll = true;
      for (const s of LOFI_SONGS) if (s !== this.song) {
        const keep = this.bars;
        this.bars = s.prog.map((b) => b.split(' ').map(parseChord));
        let prev = null;
        for (let pass = 0; pass < 2; pass++) for (const b of this.bars) for (const ch of b) { ch.v = voiceChord(ch, prev); prev = ch.v; }
        this.warm.push(...this._notesOf(s));
        this.bars = keep;
      }
    }
    const deadline = t0 + budgetMs;
    while (this.warm.length && performance.now() < deadline) {
      const [k, m] = this.warm[0];
      if (LofiSamples.step(this.ctx, k, m, deadline)) this.warm.shift();
    }
  }

  // filter moves at the start of a section
  _section(t) {
    const f = LOFI_FORM[this.sec], len = f.n * this.barDur;
    const p = this.radioLP.frequency;
    p.cancelScheduledValues(t);
    p.setValueAtTime(f.lp[0], t);
    p.exponentialRampToValueAtTime(f.lp[1], t + len * (f.s === 'outro' ? 0.95 : 0.6));
  }

  // Schedule everything up to context time `until` (a whole bar at a time)
  scheduleUntil(until) {
    if (!this.song) this.start(Math.max(this.ctx.currentTime + 0.1, until - 0.3));
    // after a pause (a hidden tab), skip ahead instead of playing everything that was missed
    if (this.t < this.ctx.currentTime - 0.25) {
      while (this.song && this.t < this.ctx.currentTime) this._nextBar();
      if (this.song) this.t = Math.max(this.t, this.ctx.currentTime + 0.05);
    }
    while (this.song && this.t < until) { this._bar(this.t); this._nextBar(); }
  }

  _nextBar() {
    this.t += this.barDur;
    this.bar++; this.barInSong++;
    const f = LOFI_FORM[this.sec];
    // leaving for another mood: wind down through the outro at the next four-bar line
    if (this.leaving && f.s !== 'outro' && this.bar % 4 === 0) {
      if (f.s === 'intro') return this.start(this.t);
      this.sec = LOFI_FORM.length - 1; this.bar = 0; this._section(this.t); return;
    }
    if (this.bar < f.n) return;
    this.bar = 0;
    if (++this.sec >= LOFI_FORM.length) { this.start(this.t + this.barDur / 2); return; }
    this._section(this.t);
  }

  // ---- one bar of music, played by the band
  _bar(T) {
    const song = this.song, f = LOFI_FORM[this.sec];
    const bars = this.bars, b = bars[this.barInSong % bars.length], next = bars[(this.barInSong + 1) % bars.length];
    const lastBar = f.s === 'outro' && this.bar === f.n - 1;
    const info = {
      T, f, b, next, lastBar,
      phrase: this.barInSong % 4,
      endOfSection: this.bar === f.n - 1,
      lead: f.parts.includes('l'),
      bassOn: f.parts.includes('b'),
      // when each chord of the bar starts and ends (the piano's pedal changes with the harmony)
      chordStart: (k) => T + (b.length > 1 && k ? 8 * this.dur16 : 0),
      chordEnd: (k) => T + (b.length > 1 && !k ? 8 * this.dur16 : this.barDur) + (lastBar ? this.barDur * 1.5 : 0.05),
    };
    if (f.parts.includes('k')) this._pianist(info);
    if (f.parts.includes('g') && song.guitar) this._guitarist(info);
    if (f.parts.includes('b')) this._bassist(info);
    if ((f.parts.includes('d') || f.parts.includes('h')) && !lastBar) this._drummer(info);
    if (f.parts.includes('l')) this._leadLine(info);
  }

  // a 16th of the bar, with swing: every second 16th comes a little late
  _at(T, step) { return T + step * this.dur16 + (step % 2 ? (this.song.swing - 0.5) * 2 * this.dur16 : 0); }
  _hum() { return (this.rng() - 0.5) * 0.014; }
  _pick(weights) {
    let sum = 0;
    for (const k in weights) sum += weights[k];
    let x = this.rng() * sum;
    for (const k in weights) { x -= weights[k]; if (x <= 0) return k; }
    return Object.keys(weights)[0];
  }

  // The pianist: a left hand and a right hand, chords rolled, broken, pushed early or played on the
  // off-beat, the pedal held through each chord, a little run at the end of a phrase, and in the
  // second A section the tune itself on top
  _pianist(I) {
    const song = this.song, r = this.rng, at = (s) => this._at(I.T, s);
    const secVel = { intro: 0.62, A: 0.7, B: 0.58, break: 0.52, outro: 0.55 }[I.f.s];
    const arc = [0.93, 1, 1.06, 0.95][I.phrase] * (I.f.s === 'outro' ? 1 - this.bar * 0.1 : 1);
    const vel0 = secVel * arc;
    const vary = (v) => clamp(v * (0.9 + r() * 0.2), 0.08, 1);
    // a chord pushed into the last bar has already been played: no downbeat this time
    const pushed = this.anticipated;
    this.anticipated = false;
    // one chord, rolled from the bottom up; the top note sings a little louder
    const play = (notes, t0, vel, spread, end) => notes.forEach((m, i) => {
      const w = i === notes.length - 1 ? 1.12 : i === 0 ? 0.9 : 0.8;
      this.pianoNote(t0 + 0.004 + i * spread + this._hum() * 0.5, m, vary(vel * w), end);
    });
    const tune = I.f.parts.includes('m') && song.pianoTune;
    for (let k = 0; k < I.b.length; k++) {
      const ch = I.b[k], s0 = I.b.length > 1 && k ? 8 : 0, end = I.chordEnd(k), half = I.b.length > 1;
      // ---- left hand
      if (!(pushed && k === 0)) {
        if (!I.bassOn) {
          // no bass player: the left hand plays the root deep down, and a tenth or fifth above it
          let root = 36 + ch.root; if (root < 40) root += 12;
          const above = r() < 0.5 ? root + 7 : root + 12 + chordThird(ch);
          play([root, above], at(s0), vel0 * 0.85, 0.05 + r() * 0.04, end);
        } else if (r() < 0.55) {
          // with the bass: just a soft shell, the third and seventh
          const third = 48 + ((ch.root + chordThird(ch)) % 12), sev = 48 + ((ch.root + chordSeventh(ch)) % 12);
          play([Math.min(third, sev), Math.max(third, sev)], at(s0), vel0 * 0.55, 0.02, end);
        }
      }
      // ---- right hand
      if (tune) {
        // the tune on top, the chord's lower notes rolled quietly underneath
        if (!(pushed && k === 0)) play(ch.v.slice(0, -1), at(s0), vel0 * 0.6, 0.03, end);
        if (k === I.b.length - 1) for (const [s, m, len] of song.melody[this.barInSong % song.melody.length]) {
          this.pianoNote(at(s) + this._hum(), m, vary(vel0 * 1.15), at(Math.min(16, s + len)) + 0.04);
        }
        continue;
      }
      if (pushed && k === 0) continue;
      // the song's favourite way to comp gets picked most in the A sections; intros float on arpeggios
      const style = half ? 'charleston' : I.lastBar ? 'roll' : this._pick(
        I.f.s === 'intro' ? { broken: 4, roll: 2 } : I.f.s === 'outro' ? { roll: 4, broken: 2 }
          : I.lead ? { roll: 4, pulse: 3, charleston: 2 }
            : Object.assign({ roll: 1, pulse: 2, charleston: 2, broken: 2.5, push: 1.5, melodic: 2.5 }, { [song.piano]: 5 }));
      // a run into the next chord at the end of a line, or a short answer halfway through it
      const fill = !I.lead && !half && (I.f.s === 'A' || I.f.s === 'intro') && ((I.phrase === 3 && r() < 0.8) || (I.phrase === 1 && r() < 0.45));
      const shortFill = fill && I.phrase === 1;
      const stop = fill ? at(shortFill ? 12 : 10) : end;
      if (style === 'roll') play(ch.v, at(s0), vel0, 0.022 + r() * 0.03, stop);
      else if (style === 'pulse') {
        play(ch.v, at(s0), vel0, 0.012, stop);
        if (!fill) { play(ch.v.slice(-2), at(6), vel0 * 0.55, 0.01, end); play(ch.v.slice(-2), at(12), vel0 * 0.5, 0.01, end); }
      } else if (style === 'charleston') {
        play(ch.v, at(s0), vel0 * 0.95, 0.008, at(s0 + 3));
        if (!fill) play(ch.v, at(s0 + 6), vel0 * 0.8, 0.01, end);
      } else if (style === 'broken') {
        // an arpeggio in eighths, every note left ringing under the pedal
        const order = [0, 1, 2, 3, 2, 1, 2, 3];
        for (let i = 0; i < (fill ? 5 : 8); i++) {
          const m = ch.v[Math.min(order[i], ch.v.length - 1)];
          this.pianoNote(at(i * 2) + this._hum(), m, vary(vel0 * (i === 0 ? 1 : i % 2 ? 0.72 : 0.82)), stop);
        }
      } else if (style === 'melodic') {
        // the chord underneath, and the top voice wandering to a neighbouring chord note and back
        play(ch.v.slice(0, -1), at(s0), vel0 * 0.85, 0.02, stop);
        const top = ch.v[ch.v.length - 1], pcs = [ch.root, ...ch.iv.map((i) => (ch.root + i) % 12)];
        const above = notesIn(pcs, top + 1, top + 5)[0] || top + 2, below = notesIn(pcs, top - 5, top - 1).pop() || top - 2;
        const line = r() < 0.5 ? [top, above, top] : [top, below, above];
        const when = r() < 0.5 ? [0, 6, 10] : [0, 4, 8];
        line.forEach((m, i) => { if (!fill || when[i] < 10) this.pianoNote(at(when[i]) + this._hum(), m, vary(vel0 * (i ? 0.85 : 1.05)), i < 2 ? at(when[i + 1]) + 0.05 : stop); });
      } else if (style === 'push') {
        // this chord, then the next one an eighth early, held over the bar line
        play(ch.v, at(s0), vel0, 0.015, at(14) + 0.02);
        const nx = I.next[0];
        if (!fill && nx.v.join() !== ch.v.join()) {
          play(nx.v, at(14), vel0 * 0.95, 0.015, I.T + this.barDur + (I.next.length > 1 ? 8 : 16) * this.dur16 + 0.05);
          this.anticipated = true;
          continue;
        }
      }
      // a little run down (or up) into the next chord
      if (fill) {
        const pcs = [ch.root, ...ch.iv.map((i) => (ch.root + i) % 12)];
        const pool = notesIn(pcs, 64, 86), target = I.next[0].v[I.next[0].v.length - 1];
        const from = pool.findIndex((m) => m > ch.v[ch.v.length - 1] + 2);
        const down = target <= ch.v[ch.v.length - 1] || r() < 0.6;
        let idx = from < 0 ? pool.length - 1 : from;
        const steps = shortFill ? [[12, 14], [13, 14, 15], [12, 13, 14]][Math.floor(r() * 3)] : [[10, 11, 12, 14], [10, 12, 13, 14], [11, 12, 13, 14, 15]][Math.floor(r() * 3)];
        steps.forEach((s, i) => {
          const m = pool[clamp(down ? idx - i : idx - steps.length + i + 1, 0, pool.length - 1)];
          this.pianoNote(at(s) + this._hum(), m, vary(vel0 * (0.55 + i * 0.07)), at(s + 2) + 0.12);
        });
      }
    }
  }

  // The guitarist: fingerpicked arpeggios (thumb on the bass, fingers on top) or a short lick at the
  // end of a line, picked from the song's pentatonic scale
  _penta(song, lo, hi) {
    const iv = song.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    return notesIn(iv.map((i) => (song.key + i) % 12), lo, hi);
  }
  _guitarist(I) {
    const song = this.song, r = this.rng, at = (s) => this._at(I.T, s);
    const vel0 = (song.guitar === 'licks' ? 0.85 : I.lead ? 0.5 : 0.66) * [0.95, 1, 1.05, 0.95][I.phrase];
    if (song.guitar === 'arp') {
      for (let k = 0; k < I.b.length; k++) {
        const ch = I.b[k], s0 = I.b.length > 1 && k ? 8 : 0, n = I.b.length > 1 ? 4 : 8, end = I.chordEnd(k) + 0.3;
        let bass = 40 + ((ch.root - 4 + 12) % 12);
        const pcs = [(ch.root + chordThird(ch)) % 12, (ch.root + chordSeventh(ch)) % 12, (ch.root + (ch.iv.includes(14) ? 14 : 7)) % 12];
        const upper = notesIn(pcs, 55, 71).slice(0, 4);
        const pattern = [-1, 0, 1, 2, -1, 2, 1, 0];
        for (let i = 0; i < n; i++) {
          if (I.f.s === 'break' && i % 2) continue;
          const p = pattern[i], m = p < 0 ? (i === 0 ? bass : bass + 7) : upper[Math.min(p, upper.length - 1)];
          this.guitarNote(at(s0 + i * 2) + this._hum(), m, clamp(vel0 * (p < 0 ? 0.95 : 0.75) * (0.9 + r() * 0.2), 0.1, 1), end);
        }
      }
      return;
    }
    // licks: at the end of a line, or now and then answering the melody
    if (!(I.phrase === 3 || (I.phrase === 1 && r() < 0.35)) || (I.lead && I.f.s === 'B' && I.phrase !== 3)) return;
    const ch = I.b[I.b.length - 1], scale = this._penta(song, 59, 81);
    const rhythm = LOFI_LICKS[Math.floor(r() * LOFI_LICKS.length)];
    const chordPcs = [ch.root, ...ch.iv.map((i) => (ch.root + i) % 12)];
    let idx = scale.findIndex((m) => m >= 70 && chordPcs.includes(m % 12));
    if (idx < 0) idx = Math.floor(scale.length / 2);
    const dir = r() < 0.65 ? -1 : 1;
    rhythm.forEach(([s, len], i) => {
      const last = i === rhythm.length - 1;
      let m = scale[clamp(idx + dir * i, 0, scale.length - 1)];
      // land on a note of the chord
      if (last && !chordPcs.includes(m % 12)) m = scale[clamp(idx + dir * i + (dir < 0 ? -1 : 1), 0, scale.length - 1)];
      this.guitarNote(at(s) + this._hum(), m, clamp(vel0 * (last ? 0.9 : 0.75) * (0.9 + r() * 0.2), 0.1, 1), at(Math.min(16, s + len)) + (last ? 0.6 : 0.05));
    });
  }

  // The bass player: the song's pattern, a ghost note now and then, the outro's last note held
  _bassist(I) {
    const song = this.song, r = this.rng, at = (s) => this._at(I.T, s);
    const notes = LOFI_BASS[song.bass];
    for (const [s, kind, len, bv] of notes) {
      if (I.lastBar && s > 0) continue;
      const ch = I.b[I.b.length > 1 && s >= 8 ? 1 : 0], root = bassMidi(ch.root);
      let n = root;
      if (kind === 'F') n = root + 7 > 47 ? root - 5 : root + 7;
      else if (kind === 'O') n = root + 12;
      else if (kind === 'N') { const nr = bassMidi(I.next[0].root); if (nr === root) continue; n = nr > root ? nr - 1 : nr + 1; }
      const l = I.b.length > 1 && song.bass === 'hold' ? 7 : len;   // two chords in the bar: half each
      this.bassNote(at(s) + this._hum() * 0.6, n, clamp(bv * (0.88 + r() * 0.24), 0.1, 1), (I.lastBar ? 24 : l) * this.dur16 * 0.95);
      if (I.b.length > 1 && s === 0 && song.bass === 'hold') this.bassNote(at(8), bassMidi(I.b[1].root), bv, 7 * this.dur16);
    }
    // a muted ghost note on an off-beat, the way a bass player keeps things moving
    if (song.bass !== 'hold' && !I.lastBar && r() < 0.3) this.bassNote(at(r() < 0.5 ? 7 : 13), bassMidi(I.b[0].root) + 12, 0.3, this.dur16 * 0.5);
  }

  // The drummer: the pattern, swung and never quite the same twice, with a fill at the end of a section
  _drummer(I) {
    const song = this.song, r = this.rng, D = LOFI_DRUMS[song.drums], at = (s) => this._at(I.T, s);
    const full = I.f.parts.includes('d');
    const amp = (c) => (c === 'X' ? 1 : c === 'x' ? 0.75 : c === 'o' ? 0.4 : 0);
    const vary = (v) => v * (0.86 + r() * 0.28);
    const fill = full && I.endOfSection && I.f.s !== 'intro';
    for (let st = 0; st < 16; st++) {
      const t = at(st);
      if (full) {
        const k = amp(D.kick[this.bar % 4 === 3 ? 1 : 0][st]);
        if (k) this.kick(t, vary(k));
        let s = amp(D.snare[st]) || (this.bar % 2 ? amp(D.ghost[st] || '.') : 0);
        if (fill && st >= 13) s = 0.35 + (st - 13) * 0.2;               // a little roll into the next section
        if (s) this.snare(t + 0.012 + this._hum() * 0.4, vary(s), D.sn);
      } else if (st === 0) this.kick(t, 0.55);                          // the break: just a soft pulse
      const h = amp(D.hat[st]), open = this.bar % 4 === 3 && st === 14 && !fill;
      if ((h && r() > 0.06) || open) this.hat(t + this._hum() * 0.3, vary(open ? 0.7 : h) * (full ? 1 : 0.8), open);
    }
  }

  // The lead: the melody in B sections (in the break, just the first note of each bar)
  _leadLine(I) {
    const song = this.song, at = (s) => this._at(I.T, s);
    for (const [s, n, len] of song.melody[this.barInSong % song.melody.length]) {
      if (I.f.s === 'break' && s > 0) continue;
      const t = at(s) + this._hum(), dur = len * this.dur16, vv = clamp(0.9 * (0.88 + this.rng() * 0.24), 0.1, 1);
      if (song.lead === 'kalimba') this.kalimba(t, n, vv);
      else if (song.lead === 'vibes') this.vibes(t, n, vv, dur);
      else this.flute(t, n, vv, dur * 0.95);
    }
  }

  // Let the birds be heard: dip the music for a moment
  duckForBird(t, dur) {
    const g = this.birdDuck.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.55, t, 0.08);
    g.setTargetAtTime(1, t + dur, 0.6);
  }

  // Fade out (volume turned down to zero)
  silence(t) {
    this.song = null;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0.0001, t, 0.15);
    this.crackleGain.gain.setTargetAtTime(0.0001, t, 0.3);
  }
}
