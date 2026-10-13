'use strict';
// Particles, floating texts and item icons flying to the player.

const HEART_PX = ['.#.#.', '#####', '#####', '.###.', '..#..'];
const NOTE_PX = ['..##', '..#.', '..#.', '###.', '##..'];

class FX {
  constructor() { this.parts = []; this.texts = []; this.flyers = []; }

  burst(kind, x, y, n, season) {
    const R = Math.random;
    for (let i = 0; i < n; i++) {
      const p = { kind, x: x + (R() - 0.5) * 8, y: y + (R() - 0.5) * 6, vx: (R() - 0.5) * 40, vy: -20 - R() * 40, g: 120, life: 0.6 + R() * 0.4, t: 0, size: 1 + (R() < 0.3 ? 1 : 0) };
      switch (kind) {
        case 'leaf': {
          const cols = season === AUTUMN ? ['#c8662a', '#e09a3a', '#a4482a', '#f2c254'] : season === WINTER ? ['#f4f8fb', '#dfe7f0'] : ['#5aa040', '#7dbe55', '#3e7a34'];
          p.c = pick(cols); p.vy = -10 - R() * 20; p.g = 30; p.life = 1.2 + R() * 1; p.sway = R() * 6; break;
        }
        case 'twig': p.c = pick(['#7a5a3a', '#5a3e26']); p.size = 2; break;
        case 'grass': p.c = pick(['#5aa048', '#7cbc58', '#c8b06a']); break;
        case 'mud': p.c = pick(['#5e4630', '#7c6044']); p.size = 2; p.vy = -30 - R() * 30; break;
        case 'dust': p.c = pick(['#d8c8a8', '#c8b898']); p.vy = -8 - R() * 10; p.g = -5; p.vx *= 0.5; p.size = 2; break;
        case 'sparkle': p.c = pick(['#fff4b0', '#ffffff', '#f6d860']); p.vy = -15 - R() * 20; p.g = 10; p.life = 0.7 + R() * 0.6; break;
        case 'heart': p.c = '#e8485a'; p.vx *= 0.3; p.vy = -14 - R() * 8; p.g = 0; p.life = 1.4; break;
        case 'note': p.c = pick(['#3a3a5a', '#5a4a8a']); p.vx = (R() - 0.5) * 10; p.vy = -16; p.g = 0; p.life = 1.6; p.sway = 3; break;
        case 'splash': p.c = pick(['#8cd2ea', '#d6f0f6', '#5eb6d6']); p.vy = -40 - R() * 40; p.g = 220; break;
        case 'feather': p.c = '#f4f2ee'; p.vy = -10; p.g = 12; p.life = 2; p.sway = 8; p.size = 2; break;
        case 'chip': p.c = pick(['#e8d8b0', '#c8a070']); p.vy = -10; break;
        case 'silk': p.c = '#ffffff'; p.vy = -12; p.g = 0; p.life = 0.8; break;
        case 'zzz': p.c = '#e8eef8'; p.vx = 4; p.vy = -10; p.g = 0; p.life = 2; break;
        case 'smoke': p.c = pick(['#d8d4d0', '#c8c4c0', '#e8e4e0']); p.vx = 3 + R() * 4; p.vy = -10 - R() * 5; p.g = 0; p.life = 2.5 + R(); p.size = 2 + (R() < 0.5 ? 1 : 0); break;
        case 'drip': p.c = '#8cd2ea'; p.vx = 0; p.vy = 0; p.g = 160; p.life = 0.5; break;
        case 'ripple': p.c = '#d6f0f6'; p.vx = 0; p.vy = 0; p.g = 0; p.life = 0.8; break;
      }
      this.parts.push(p);
    }
  }

  text(str, x, y, color, icon) {
    this.texts.push({ str, x, y, color: color || '#ffffff', icon, t: 0, life: 1.4 });
  }

  fly(icon, fx, fy, target, onArrive) {
    this.flyers.push({ icon, fx, fy, target, t: 0, life: 0.45, onArrive });
  }

  update(dt) {
    const s = dt / 1000;
    for (const p of this.parts) {
      p.t += s;
      p.vy += p.g * s;
      p.x += p.vx * s + (p.sway ? Math.sin(p.t * 5) * p.sway * s : 0);
      p.y += p.vy * s;
      if (p.kind === 'leaf' || p.kind === 'feather') p.vx *= 0.98;
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const t of this.texts) t.t += s;
    this.texts = this.texts.filter((t) => t.t < t.life);
    for (const f of this.flyers) {
      f.t += s;
      if (f.t >= f.life && !f.done) { f.done = true; if (f.onArrive) f.onArrive(); }
    }
    this.flyers = this.flyers.filter((f) => !f.done);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  draw(g, camX, camY) {
    for (const p of this.parts) {
      const a = 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
      g.globalAlpha = clamp(a, 0, 1);
      const x = Math.round(p.x - camX), y = Math.round(p.y - camY);
      g.fillStyle = p.c;
      if (p.kind === 'heart') this._pat(g, HEART_PX, x - 2, y - 2, p.c);
      else if (p.kind === 'note') this._pat(g, NOTE_PX, x - 2, y - 2, p.c);
      else if (p.kind === 'zzz') SPR.font.draw(g, 'z', x, y, p.c);
      else if (p.kind === 'sparkle') { g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); }
      else if (p.kind === 'ripple') { const r = Math.round(2 + p.t * 8); g.fillRect(x - r, y, 2, 1); g.fillRect(x + r - 1, y, 2, 1); g.fillRect(x - 1, y - Math.round(r / 2), 2, 1); }
      else g.fillRect(x, y, p.size, p.size);
    }
    g.globalAlpha = 1;
    for (const f of this.flyers) {
      const k = clamp(f.t / f.life, 0, 1);
      const tx = f.target.x, ty = f.target.y - 18;
      const x = lerp(f.fx, tx, k), y = lerp(f.fy, ty, k) - Math.sin(k * Math.PI) * 18;
      g.drawImage(f.icon.img, Math.round(x - 8 - camX), Math.round(y - 8 - camY));
    }
    for (const t of this.texts) {
      const k = t.t / t.life;
      g.globalAlpha = clamp(1 - Math.max(0, (k - 0.65) / 0.35), 0, 1);
      const w = SPR.font.measure(t.str) + (t.icon ? 11 : 0);
      const x = Math.round(t.x - camX - w / 2), y = Math.round(t.y - camY - 12 - k * 14);
      if (t.icon) g.drawImage(t.icon.img, x - 4, y - 4, 16, 16);
      SPR.font.drawOutline(g, t.str, x + (t.icon ? 11 : 0), y, t.color, '#1d1a2b');
    }
    g.globalAlpha = 1;
  }

  _pat(g, rows, x, y, c) {
    g.fillStyle = c;
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) if (rows[j][i] === '#') g.fillRect(x + i, y + j, 1, 1);
  }
}
