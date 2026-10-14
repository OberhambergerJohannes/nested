'use strict';
// Landmarks (discoverable places) and the little things villagers ask you to find.
// Landmarks are anchored like buildings: (ax, ay) is the footprint's top-left inside the image.

function genLandmark(kind, season) {
  const rnd = artRng('landmark' + kind + season);
  const lichen = ['#e0a830', '#b8c87a', '#c8d0a8'];
  let px, fw = (LANDMARKS[kind].w || 1) * TS;
  switch (kind) {
    case 'oak': {
      px = new Pix(84, 86);
      const cx = 42, base = 84, bark = BARK.oak;
      // massive gnarled trunk with buttress roots and a hollow
      for (let y = 40; y <= base; y++) {
        const t = (y - 40) / (base - 40), w = 11 + t * t * 9;
        for (let x = Math.round(cx - w / 2); x <= cx + w / 2; x++) {
          const rel = (x - (cx - w / 2)) / w;
          let c = rel < 0.18 ? bark.l : rel > 0.72 ? bark.d : bark.m;
          if (hashf(x, Math.floor(y / 3), 9) < 0.3 && rel > 0.15 && rel < 0.8) c = bark.d;
          px.set(x, y, c);
        }
      }
      px.ellipse(cx + 1, 66, 3, 5, '#1e140e'); px.ellipse(cx + 1, 64, 2, 2.5, '#120c08');
      for (const [x, y] of [[cx - 4, 74], [cx - 3, 75], [cx + 5, 58], [cx - 5, 52]]) px.set(x, y, '#5aa03a');
      if (season === WINTER) {
        const tips = [];
        for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) bareBranches(px, cx + a * 4, 44, -Math.PI / 2 + a, 16, 4, 3, rnd, bark.m, tips);
        px.outline(bark.o);
        addSnowOnTop(px, 0.55, 21);
      } else {
        const pal = FOLIAGE.oak[season];
        canopy(px, cx, 28, 38, 24, pal, rnd, 30, 7, 5);
        px.outline(pal.o);
      }
      return { px, ax: cx - 8, ay: base - 15 };
    }
    case 'stones': {
      px = new Pix(36, 38);
      const S = { o: '#2c2a30', d: '#5a5862', m: '#7e7c86', l: '#a4a2aa', h: '#c8c6cc' };
      const stone = (x0, y0, w, h, lean) => {
        for (let y = 0; y < h; y++) {
          const r = y < 3 ? [0.6, 0.85, 0.95][y] : 1;
          const ww = Math.round(w * r), off = Math.round((w - ww) / 2 + lean * (h - y) / h);
          for (let x = 0; x < ww; x++) {
            const rel = x / ww;
            let c = rel < 0.25 ? S.l : rel > 0.75 ? S.d : S.m;
            if (hashf(x0 + x, y0 + y, 7) < 0.08) c = S.d;
            px.set(x0 + off + x, y0 + y, c);
          }
        }
        for (let i = 0; i < w; i++) { const x = x0 + Math.floor(rnd() * w), y = y0 + 3 + Math.floor(rnd() * (h - 6)); if (px.op(x, y)) px.set(x, y, lichen[i % 3]); }
      };
      stone(4, 6, 10, 30, 1);
      stone(18, 18, 9, 18, -1);
      px.ellipse(29, 34, 5, 2.4, S.m); px.ellipse(28, 33.5, 3.5, 1.4, S.l);
      if (season === WINTER) { px.hline(5, 13, 6, '#f4f8fb'); px.hline(19, 26, 18, '#f4f8fb'); }
      else for (const x of [3, 15, 17, 27, 32]) { px.vline(x, 33, 36, '#4f9a40'); px.set(x, 32, season === SPRING ? '#f6e04a' : '#6aaa4e'); }
      px.outline(S.o);
      return { px, ax: 2, ay: 22 };
    }
    case 'cairn': {
      px = new Pix(22, 30);
      const S = ['#6a6872', '#8a8892', '#a8a6ae', '#c4c2ca'];
      const rows = [[3, 26, 16], [4, 22, 14], [6, 18, 10], [7, 14, 8], [8, 10, 6]];
      for (const [x0, y, w] of rows) {
        let x = x0;
        while (x < x0 + w) {
          const sw = 3 + Math.floor(rnd() * 3);
          px.ellipse(x + sw / 2, y + 2, sw / 2 + 0.4, 2.2, S[1 + Math.floor(rnd() * 2)]);
          px.set(Math.round(x + sw / 2) - 1, y + 1, S[3]);
          x += sw;
        }
      }
      px.vline(11, 1, 10, '#6a4428'); px.rect(12, 1, 6, 4, '#d8342a'); px.hline(12, 17, 1, '#f05a4a');
      if (season === WINTER) { px.hline(8, 14, 10, '#f4f8fb'); px.hline(5, 17, 18, '#f4f8fb'); }
      px.outline('#2c2a30');
      return { px, ax: 3, ay: 14 };
    }
    case 'mill': {
      px = new Pix(24, 24);
      px.ellipse(12, 19, 9, 3.5, '#6a6872');
      px.disc(12, 11, 9.5, '#8a8892');
      px.disc(12, 11, 8.5, '#a4a2aa');
      for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; px.line(12 + Math.cos(t) * 3, 11 + Math.sin(t) * 3, 12 + Math.cos(t + 0.4) * 8, 11 + Math.sin(t + 0.4) * 8, '#7e7c86'); }
      px.disc(12, 11, 2.2, '#2c2a30');
      px.disc(9, 7, 2, '#c4c2ca');
      if (season !== WINTER) { for (let i = 0; i < 14; i++) px.set(3 + Math.floor(rnd() * 6), 9 + Math.floor(rnd() * 12), i % 2 ? '#4f9a40' : '#2f6a32'); px.set(18, 5, '#5aa03a'); px.set(19, 6, '#3e7a2a'); }
      else px.hline(6, 16, 2, '#f4f8fb');
      px.outline('#2c2a30');
      return { px, ax: 4, ay: 8 };
    }
    case 'hide': {
      px = new Pix(36, 34);
      const W = { d: '#4a3220', m: '#7a5434', l: '#9a7048', h: '#b88a5a' };
      for (let x = 2; x < 34; x++) for (let y = 12; y < 32; y++) px.set(x, y, (x - 2) % 4 === 0 ? W.d : (x - 2) % 4 === 1 ? W.l : W.m);
      px.rect(5, 17, 26, 3, '#120c08'); px.hline(5, 30, 20, W.h);
      px.poly([[0, 13], [36, 13], [33, 5], [3, 5]], '#4f6a3e');
      for (let y = 6; y < 13; y += 2) px.hline(3, 32, y, '#3e5a30');
      px.hline(0, 35, 13, '#2a3a20');
      px.rect(26, 22, 6, 10, W.d); px.set(27, 27, '#c8a848');
      if (season === WINTER) px.poly([[1, 12], [35, 12], [33, 5], [3, 5]], '#f4f8fb');
      for (let i = 0; i < 12; i++) { const x = Math.floor(rnd() * 36); px.vline(x, 26 + Math.floor(rnd() * 4), 33, season === WINTER ? '#a89a6a' : '#6a9a4a'); }
      px.outline('#24160e');
      return { px, ax: 2, ay: 18 };
    }
    case 'willow': {
      px = new Pix(36, 44);
      const cx = 18, base = 42, bark = BARK.willow;
      for (let y = 22; y <= base; y++) { const w = 9 + (y > base - 4 ? (y - base + 4) * 1.5 : 0); for (let x = Math.round(cx - w / 2); x <= cx + w / 2; x++) px.set(x, y, x < cx - w / 4 ? bark.l : x > cx + w / 4 ? bark.d : bark.m); }
      px.ellipse(cx, 31, 2.6, 5, '#1e140e');
      px.rect(cx - 6, 20, 13, 4, bark.m); px.hline(cx - 6, cx + 6, 20, bark.l);
      // pollard shoots
      for (let i = 0; i < 16; i++) { const x = cx - 7 + i, h = 8 + Math.floor(rnd() * 10); px.line(x, 20, x + Math.round((rnd() - 0.5) * 4), 20 - h, i % 2 ? '#8a7a3a' : '#a8984a'); }
      if (season !== WINTER) {
        const pal = FOLIAGE.willow[season];
        for (let i = 0; i < 9; i++) drawClump(px, cx - 10 + rnd() * 20, 4 + rnd() * 12, 3 + rnd() * 2, pal);
        px.outline(pal.o);
      } else { px.outline(bark.o); addSnowOnTop(px, 0.5, 23); }
      return { px, ax: cx - 8, ay: base - 15 };
    }
    case 'spring': {
      px = new Pix(24, 20);
      px.ellipse(12, 12, 10, 6, '#7e7c86');
      px.ellipse(12, 12, 7, 4, season === WINTER ? '#c8e0ec' : '#4aa0c8');
      px.ellipse(11, 11, 4, 2, season === WINTER ? '#e8f4fa' : '#8cd2ea');
      for (const [x, y] of [[3, 10], [6, 6], [12, 5], [18, 6], [21, 10], [19, 16], [12, 17], [5, 15]]) { px.disc(x, y, 2.2, '#8a8892'); px.set(x - 1, y - 1, '#c4c2ca'); }
      if (season !== WINTER) { px.set(12, 11, '#ffffff'); px.set(10, 12, '#ffffff'); for (const [x, y] of [[1, 6], [22, 4], [2, 17]]) { px.line(x, y + 4, x - 1, y, '#3e7a2a'); px.line(x, y + 4, x + 2, y + 1, '#4f9a40'); } }
      px.outline('#2c2a30');
      return { px, ax: 4, ay: 4 };
    }
  }
  return { px: new Pix(16, 16), ax: 0, ay: 0 };
}

function genQItem(kind) {
  if (kind === 'hen') { const px = genChicken(0, true); return { px, ax: 7, ay: 12 }; }
  const px = new Pix(12, 12);
  switch (kind) {
    case 'marble': px.disc(6, 7, 3.6, '#3a6ac8'); px.line(4, 6, 7, 9, '#8ab8f0'); px.set(4, 5, '#ffffff'); px.set(5, 5, '#d8ecff'); break;
    case 'float': px.ellipse(6, 7, 2.6, 3.4, '#f4f0e6'); px.rect(4, 4, 5, 3, '#d8342a'); px.vline(6, 0, 3, '#5a3a22'); px.vline(6, 10, 11, '#5a3a22'); px.set(5, 5, '#f08a7a'); break;
    case 'plate': px.rect(2, 4, 8, 5, '#b8903a'); px.hline(2, 9, 4, '#e0bc5a'); px.set(4, 6, '#6a5420'); px.set(5, 7, '#6a5420'); px.set(7, 6, '#6a5420'); px.set(8, 7, '#6a5420'); px.set(9, 8, '#5a8a6a'); break;
    case 'litter': px.rect(3, 4, 6, 6, '#b8bcc4'); px.hline(3, 8, 4, '#e0e4ea'); px.rect(3, 6, 6, 2, '#c83a3a'); px.set(4, 5, '#ffffff'); px.line(8, 10, 10, 11, '#8a8e96'); break;
    case 'pellet': px.ellipse(6, 7, 4, 2.4, '#7a7470'); px.ellipse(5, 6.5, 2.5, 1.2, '#948e88'); px.set(4, 7, '#f4f0e6'); px.set(7, 8, '#f4f0e6'); px.set(8, 6, '#e8e4dc'); break;
    case 'orchid': px.vline(6, 3, 11, '#5a8a4a'); px.ellipse(6, 3, 1.6, 2.4, '#a88a5a'); px.set(4, 7, '#b86ad0'); px.set(5, 6, '#d08ae8'); px.set(3, 8, '#5a8a4a'); px.set(8, 9, '#5a8a4a'); break;
    case 'bell':
      px.rect(5, 2, 2, 2, '#5a3a22');
      px.poly([[3, 10], [9, 10], [8, 4], [4, 4]], '#c8962a');
      px.vline(4, 5, 9, '#f0c85a'); px.set(5, 4, '#f6dc8a'); px.hline(2, 9, 10, '#a8761a'); px.set(6, 11, '#5a4a3a');
      px.set(10, 3, '#f8f0c0');
      break;
    case 'map':
      px.rect(1, 3, 10, 7, '#e8dcb8'); px.vline(4, 3, 9, '#c8b890'); px.vline(8, 3, 9, '#c8b890');
      px.line(2, 8, 5, 5, '#5a9ad8'); px.line(5, 5, 9, 6, '#5a9ad8'); px.set(6, 7, '#d8342a'); px.set(3, 4, '#5aa03a'); px.set(9, 4, '#5aa03a');
      break;
    case 'carving':
      px.ellipse(5, 7, 3.2, 2.2, '#2a8ac8'); px.ellipse(5, 8, 2.4, 1.2, '#e88a3a'); px.disc(8, 5, 1.8, '#2a8ac8');
      px.hline(9, 11, 5, '#3a3a3a'); px.set(8, 4, '#ffffff'); px.line(1, 8, 2, 7, '#1e6a9a'); px.hline(3, 8, 10, '#a87a4a');
      break;
    case 'jam':
      px.rect(3, 4, 6, 7, '#6a1a3a'); px.rect(4, 5, 1, 4, '#a83a6a'); px.rect(3, 2, 6, 2, '#e8dcc8');
      px.hline(3, 8, 2, '#c84a4a'); px.set(5, 3, '#c84a4a'); px.set(7, 3, '#c84a4a'); px.rect(4, 7, 4, 2, '#f4ecd8');
      break;
  }
  px.outline('#1e1612');
  return { px, ax: 6, ay: 10 };
}
