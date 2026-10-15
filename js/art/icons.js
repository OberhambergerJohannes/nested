'use strict';
// 16x16 icons for nest materials, bag items and the UI.

function icoNew() { return new Pix(16, 16); }
function icoDone(px, ol) { px.outline(ol || '#1e1612'); return px; }

const MAT_ICON = {
  twig(px) { px.line(2, 13, 12, 3, '#7a5a3a'); px.line(3, 13, 13, 3, '#5a3e26'); px.line(7, 8, 4, 3, '#7a5a3a'); px.line(9, 6, 13, 7, '#8a6a46'); px.set(4, 3, '#5aa048'); px.set(13, 7, '#5aa048'); },
  stick(px) { px.thick(2, 13, 13, 3, 3, '#6b4c34'); px.line(2, 12, 12, 3, '#8a6646'); px.line(8, 7, 4, 2, '#6b4c34'); px.line(10, 5, 14, 6, '#6b4c34'); px.set(13, 3, '#c8a070'); },
  grass(px) { for (let i = 0; i < 7; i++) px.line(4 + i, 14, 3 + i * 1.5, 2 + (i % 3), i % 2 ? '#d8bc72' : '#b89a52'); px.rect(4, 9, 8, 2, '#8a6a3a'); px.hline(4, 11, 9, '#a8844a'); },
  moss(px) { px.ellipse(8, 10, 6.5, 4, '#3e7a2a'); px.ellipse(7, 9, 5, 3, '#5aa03a'); for (const [x, y] of [[4, 7], [7, 6], [10, 7], [6, 9], [9, 9], [12, 9]]) px.set(x, y, '#8ccc4a'); px.set(5, 12, '#2e5a1e'); },
  mud(px) { px.ellipse(8, 10, 6, 4.5, '#5e4630'); px.ellipse(7, 8.5, 4, 2.6, '#7c6044'); px.set(5, 7, '#a8906a'); px.set(6, 7, '#a8906a'); px.set(11, 12, '#3e2c1c'); },
  feather(px) { px.thick(4, 13, 12, 3, 3, '#f4f2ee'); px.line(4, 13, 12, 3, '#c8c6c0'); px.line(3, 14, 5, 12, '#8a8a8a'); px.set(12, 2, '#ffffff'); px.set(8, 6, '#ffffff'); },
  wool(px) { for (const [x, y, r] of [[6, 9, 3.5], [10, 8, 3.5], [8, 6, 3], [9, 11, 3]]) px.disc(x, y, r, '#f4f2ee'); for (const [x, y] of [[5, 10], [9, 6], [11, 10], [7, 12]]) px.set(x, y, '#d8d4cc'); },
  hair(px) { for (let i = 0; i < 4; i++) { let x = 4 + i * 2; for (let y = 2; y < 14; y++) { px.set(x + Math.round(Math.sin(y * 0.7 + i) * 1.2), y, i % 2 ? '#5a3a22' : '#7a5232'); } } },
  silk(px) { for (let a = 0; a < 40; a++) { const t = a * 0.45, r = 1 + a * 0.15; px.set(8 + Math.cos(t) * r, 8 + Math.sin(t) * r, '#f4f8ff'); } px.set(8, 8, '#ffffff'); px.set(3, 3, '#cfe8f4'); px.set(12, 12, '#cfe8f4'); },
  lichen(px) { px.ellipse(8, 9, 6, 4.5, '#9aa088'); for (const [x, y, c] of [[5, 7, '#e8b030'], [9, 6, '#b8c87a'], [11, 10, '#e8b030'], [6, 11, '#c8d898'], [8, 9, '#b8c87a'], [4, 9, '#d8a020']]) { px.set(x, y, c); px.set(x + 1, y, c); } },
  leaves(px) { px.poly([[3, 13], [6, 4], [13, 2], [11, 10]], '#c8662a'); px.line(3, 13, 12, 3, '#8a3e1a'); px.line(6, 9, 9, 10, '#8a3e1a'); px.line(7, 7, 6, 4, '#8a3e1a'); px.set(9, 4, '#e8a040'); },
  bark(px) { for (const [x, y, w, h, c] of [[3, 4, 6, 4, '#a8643a'], [7, 8, 6, 4, '#8a4e2c'], [2, 10, 5, 3, '#b8744a']]) { px.rect(x, y, w, h, c); px.hline(x, x + w - 1, y, lighten(c, 0.22)); px.set(x + w - 1, y + h - 1, darken(c, 0.3)); } px.set(5, 6, '#6a3a20'); px.set(10, 10, '#5a3018'); },
  rotwood(px) { px.rect(3, 6, 10, 7, '#8a6a46'); px.rect(3, 6, 10, 2, '#a8844e'); for (const [x, y] of [[4, 9], [7, 10], [10, 8], [6, 12], [11, 11]]) px.set(x, y, '#5a3e28'); px.set(13, 12, '#8a6a46'); px.set(2, 12, '#8a6a46'); px.set(12, 5, '#a8844e'); },
  thistledown(px) { px.rect(6, 10, 4, 4, '#8a6aa0'); px.rect(7, 13, 2, 2, '#5a8a5a'); px.ellipse(8, 6, 5.5, 4.5, '#f4f0e6'); for (const [x, y] of [[4, 4], [8, 2], [12, 4], [6, 6], [10, 6]]) px.set(x, y, '#ffffff'); px.set(3, 2, '#f4f0e6'); px.set(13, 1, '#f4f0e6'); },
  fluff(px) { for (const [x, y, r] of [[6, 8, 3.5], [10, 7, 3.5], [8, 10, 3.5]]) px.disc(x, y, r, '#f8f6f0'); px.line(8, 10, 8, 14, '#a89a6a'); for (const [x, y] of [[3, 5], [13, 4], [12, 11]]) px.set(x, y, '#f8f6f0'); px.set(7, 7, '#e8e4d8'); },
  herbs(px) { px.line(6, 14, 6, 4, '#5a8a4a'); px.line(10, 14, 10, 5, '#5a8a4a'); for (let y = 3; y < 8; y++) { px.set(5, y, '#8a5ad0'); px.set(7, y, '#a07ae0'); } px.rect(9, 6, 3, 2, '#5ac05a'); px.rect(9, 9, 3, 2, '#4aa84a'); px.rect(3, 9, 3, 2, '#7aba5a'); px.hline(5, 11, 13, '#c8a070'); },
  reedplume(px) { px.line(8, 15, 8, 6, '#a8a058'); for (let i = 0; i < 9; i++) px.line(8, 2 + i, 8 + (i % 2 ? 3 : -3), 3 + i, i % 2 ? '#b89a7a' : '#d8c4a4'); px.set(8, 1, '#d8c4a4'); },
  wood(px) { px.rect(2, 5, 12, 4, '#a8743f'); px.hline(2, 13, 5, '#c89458'); px.rect(3, 9, 12, 4, '#8a5a34'); px.hline(3, 14, 9, '#a8743f'); px.set(5, 7, '#6a4426'); px.set(11, 11, '#5a3a22'); },
  stone(px) { px.ellipse(8, 9, 6, 4.5, '#7e7c86'); px.ellipse(7, 7.5, 4, 2.5, '#a4a2aa'); px.set(5, 6, '#c8c6cc'); px.line(9, 10, 11, 12, '#5a5862'); },
  sand(px) { px.poly([[1, 13], [8, 4], [15, 13]], '#e6cf98'); px.line(8, 4, 15, 13, '#d0b47a'); for (const [x, y] of [[6, 10], [9, 8], [11, 11], [7, 12]]) px.set(x, y, '#c09a62'); px.set(7, 6, '#f4e3b6'); },
  clay(px) { px.rect(3, 6, 10, 7, '#b46e4a'); px.rect(3, 6, 10, 2, '#c8845c'); px.hline(4, 11, 10, '#985a3a'); px.set(5, 9, '#d89a70'); px.set(11, 8, '#985a3a'); },
};

function seedPacket(px, art) {
  px.rect(3, 2, 10, 13, '#f2e6c8');
  px.hline(3, 12, 2, '#d8c8a0'); px.hline(3, 12, 4, '#c8b48a');
  px.rect(4, 6, 8, 7, '#bfe0a8');
  art(px);
}

function potted(px, fn) {
  px.poly([[4, 11], [12, 11], [11, 15], [5, 15]], '#c86a3a');
  px.hline(4, 11, 11, '#e08a50'); px.hline(5, 10, 14, '#a8542a');
  fn(px);
}

const ITEM_ICON = {
  seed_wildflower(px) { seedPacket(px, (p) => { p.vline(8, 8, 12, '#4a8a3a'); p.rect(7, 7, 3, 3, '#e8402e'); p.set(8, 8, '#f4d84c'); p.set(5, 10, '#4a6ae0'); p.set(11, 9, '#ffffff'); }); },
  seed_thistle(px) { seedPacket(px, (p) => { p.vline(8, 9, 12, '#5a8a5a'); p.rect(7, 7, 3, 3, '#b048c8'); p.set(8, 6, '#d070e0'); p.line(5, 12, 7, 10, '#6a9a6a'); }); },
  seed_herbs(px) { seedPacket(px, (p) => { p.vline(6, 7, 12, '#5a8a4a'); for (let y = 7; y < 10; y++) p.set(6, y, '#8a5ad0'); p.rect(9, 9, 2, 3, '#5ac05a'); p.rect(9, 7, 3, 1, '#ffffff'); }); },
  rhizome_reed(px) { px.thick(3, 12, 13, 11, 3, '#a8845a'); px.set(5, 13, '#8a6a46'); px.set(10, 13, '#8a6a46'); px.line(8, 11, 7, 2, '#5a9a48'); px.line(9, 11, 11, 4, '#78bc5a'); px.rect(6, 1, 2, 3, '#7a4a5a'); },
  rhizome_cattail(px) { px.thick(3, 12, 13, 11, 3, '#a8845a'); px.line(8, 11, 8, 2, '#4a8a3a'); px.rect(7, 3, 3, 5, '#6a3e22'); px.line(10, 11, 13, 4, '#5a9a48'); },
  sap_oak(px) { potted(px, (p) => { p.vline(8, 5, 11, '#6b4c34'); drawClump(p, 8, 5, 3.6, FOLIAGE.oak[1]); }); },
  sap_birch(px) { potted(px, (p) => { p.vline(8, 5, 11, '#e8e4dc'); p.set(8, 8, '#2a2a2a'); drawClump(p, 8, 4, 3, FOLIAGE.birch[0]); }); },
  sap_willow(px) { potted(px, (p) => { p.vline(8, 6, 11, '#6e5a40'); drawClump(p, 8, 5, 3.4, FOLIAGE.willow[0]); for (const x of [5, 7, 9, 11]) p.vline(x, 6, 9, '#8cb848'); }); },
  sap_pine(px) { potted(px, (p) => { p.poly([[8, 1], [3, 11], [13, 11]], '#2c6644'); p.line(8, 1, 3, 11, '#3e8256'); p.hline(5, 11, 7, '#1e4a32'); }); },
  sap_apple(px) { potted(px, (p) => { p.vline(8, 6, 11, '#6e5038'); drawClump(p, 8, 5, 3.6, FOLIAGE.apple[1]); p.rect(6, 5, 2, 2, '#d8342a'); p.rect(10, 4, 2, 2, '#d8342a'); }); },
  cut_hawthorn(px) { potted(px, (p) => { drawClump(p, 8, 7, 4, SHRUB_PAL.hawthorn[0]); for (const [x, y] of [[6, 5], [9, 4], [11, 7], [7, 8]]) p.set(x, y, '#ffffff'); }); },
  cut_blackthorn(px) { potted(px, (p) => { drawClump(p, 8, 7, 4, SHRUB_PAL.blackthorn[0]); for (const [x, y] of [[6, 5], [10, 6]]) { p.set(x, y, '#3a3a6a'); p.set(x + 1, y, '#5a5a9a'); } }); },
  cut_bramble(px) { potted(px, (p) => { p.line(5, 11, 8, 3, '#6a3a4a'); p.line(11, 11, 9, 4, '#6a3a4a'); drawClump(p, 8, 6, 3.4, SHRUB_PAL.bramble[0]); p.rect(9, 7, 2, 2, '#2a1a2a'); }); },
  cut_elder(px) { potted(px, (p) => { drawClump(p, 8, 7, 4, SHRUB_PAL.elder[0]); p.rect(5, 4, 3, 1, '#f6f0d0'); p.rect(9, 3, 3, 1, '#f6f0d0'); }); },
  cut_hazel(px) { potted(px, (p) => { drawClump(p, 8, 7, 4, SHRUB_PAL.hazel[0]); p.vline(6, 4, 6, '#d8c84a'); p.vline(10, 3, 5, '#d8c84a'); }); },
  box_small(px) { boxIcon(px, 'small'); },
  box_medium(px) { boxIcon(px, 'medium'); },
  box_large(px) { boxIcon(px, 'large'); },
  box_open(px) { boxIcon(px, 'open'); },
  feeder(px) { px.vline(8, 9, 15, '#8a5a34'); px.rect(5, 4, 7, 6, '#cfe4ec'); for (let y = 6; y < 10; y++) px.hline(6, 10, y, y % 2 ? '#c8a050' : '#a87a3a'); px.poly([[3, 5], [13, 5], [8, 1]], '#a8483a'); },
  lamppost(px) { px.vline(8, 7, 15, '#3a3a44'); px.rect(6, 15, 5, 1, '#2a2a30'); px.rect(5, 2, 7, 6, '#2a2a30'); px.rect(6, 3, 5, 4, '#ffe08a'); px.set(7, 4, '#fff6c8'); },
  birdtable(px) { px.vline(8, 9, 15, '#8a5a34'); px.rect(2, 8, 13, 2, '#a8743f'); px.vline(3, 4, 8, '#5a3a22'); px.vline(13, 4, 8, '#5a3a22'); px.poly([[1, 5], [15, 5], [8, 0]], '#a8483a'); px.set(6, 7, '#e0c070'); px.set(10, 7, '#c8a050'); },
  bughotel(px) { px.rect(3, 6, 10, 9, '#5a3a22'); px.poly([[2, 7], [14, 7], [8, 1]], '#6a4a2e'); px.rect(4, 8, 3, 3, '#d8c080'); px.rect(9, 8, 3, 3, '#a06a38'); px.rect(4, 12, 3, 2, '#a8743f'); px.rect(9, 12, 3, 2, '#7a5a3a'); },
  scope(px) { px.line(8, 8, 4, 15, '#3a3a44'); px.line(8, 8, 12, 15, '#3a3a44'); px.vline(8, 8, 15, '#5a5a66'); px.thick(2, 4, 13, 7, 3, '#4a5a4a'); px.rect(12, 5, 3, 3, '#2a2a30'); px.set(14, 6, '#9ac8e0'); },
  lantern(px) { px.vline(4, 3, 15, '#3a3a44'); px.line(4, 3, 7, 1, '#3a3a44'); px.line(7, 1, 10, 2, '#3a3a44'); px.vline(11, 3, 5, '#3a3a44'); px.rect(8, 6, 7, 8, '#2a2a30'); px.rect(9, 7, 5, 6, '#ffd27a'); px.set(10, 8, '#fff4c8'); },
  seedmix(px) { px.poly([[4, 4], [12, 4], [13, 15], [3, 15]], '#d8c49a'); px.hline(4, 12, 4, '#b8a47a'); px.rect(5, 2, 7, 3, '#c8b48a'); px.ellipse(8, 10, 3, 2.5, '#f6ecd2'); px.set(7, 9, '#a87a3a'); px.set(9, 10, '#3a3a2a'); px.set(8, 11, '#e0c070'); },
  gardenbench(px) { px.rect(2, 5, 12, 2, '#8a5a34'); px.hline(2, 13, 5, '#c89458'); px.rect(2, 9, 12, 2, '#a8743f'); px.hline(2, 13, 9, '#c89458'); px.vline(3, 5, 14, '#3a3a44'); px.vline(12, 5, 14, '#3a3a44'); },
  owlbox(px) { px.rect(3, 4, 10, 10, '#9a6a3a'); px.vline(3, 4, 13, '#b8844e'); px.poly([[2, 5], [14, 5], [12, 1], [4, 1]], '#5a3e26'); px.rect(5, 7, 6, 4, '#1a120c'); px.rect(7, 14, 2, 2, '#8a5a34'); },
  platform(px) { px.ellipse(8, 5, 7, 3, '#5a3a22'); px.ellipse(8, 5, 5.5, 2, '#a8743f'); for (let a = 0; a < 6; a++) { const t = a / 6 * Math.PI * 2; px.line(8, 5, 8 + Math.cos(t) * 5, 5 + Math.sin(t) * 2, '#c89458'); } px.rect(7, 8, 3, 8, '#8a5a34'); },
  bank(px) { px.rect(2, 5, 12, 10, '#b07c4c'); for (let y = 5; y < 15; y += 3) px.hline(2, 13, y, '#8a5e38'); px.rect(1, 3, 14, 3, '#5aa048'); px.ellipse(9, 10, 2, 1.6, '#1a120c'); },
  brushpile(px) { for (let i = 0; i < 7; i++) px.line(1 + i, 13 - (i % 3), 9 + i, 7 + (i % 4), i % 2 ? '#7a5a3a' : '#5a3e26'); px.set(5, 8, '#c8662a'); px.set(10, 6, '#e09a3a'); px.set(12, 10, '#8a6a3a'); },
  anvil(px) { px.ellipse(8, 10, 6.5, 3.5, STONE.m); px.ellipse(7, 9, 4.5, 2, STONE.l); for (const [x, y] of [[2, 13], [12, 13], [10, 14]]) { px.set(x, y, '#e8c87a'); px.set(x + 1, y, '#8a5a2a'); } },
  birdbath(px) { px.rect(7, 7, 3, 7, STONE.m); px.rect(5, 13, 7, 2, STONE.d); px.ellipse(8, 6, 6.5, 2.5, STONE.l); px.ellipse(8, 5.6, 5, 1.6, '#5eb6d6'); px.set(6, 5, '#ffffff'); },
  snag(px) { px.rect(6, 3, 5, 12, '#7a7066'); px.vline(6, 3, 14, '#9a9086'); px.vline(10, 3, 14, '#544c44'); for (const [x, y] of [[6, 2], [8, 1], [10, 2]]) px.set(x, y, '#7a7066'); px.line(10, 7, 13, 5, '#7a7066'); px.ellipse(8, 9, 1, 1.5, '#1e160e'); },
  pondpatch(px) { px.ellipse(8, 9, 7, 5, '#b46e4a'); px.ellipse(8, 9, 5.5, 3.6, '#5eb6d6'); px.ellipse(7, 8, 3, 1.4, '#8cd2ea'); px.set(5, 8, '#ffffff'); },
  mushroom(px) { px.rect(7, 8, 3, 6, '#f2e2b0'); px.ellipse(8.5, 7, 6, 3.2, '#f2b02a'); px.ellipse(7, 6, 3, 1.4, '#f8d060'); px.hline(4, 13, 9, '#c88a1a'); },
  garlic(px) { for (const [a, b] of [[3, 4], [8, 1], [13, 5]]) px.thick(8, 14, a, b, 2.5, '#4a9a3a'); px.disc(8, 2, 1.6, '#ffffff'); px.set(3, 4, '#6aba5a'); },
  blackberry(px) { for (const [x, y] of [[6, 7], [9, 7], [7.5, 10], [10.5, 10], [5, 10]]) { px.disc(x, y, 2, '#2a1a2a'); px.set(x - 1, y - 1, '#6a4a7a'); } px.line(8, 5, 10, 1, '#4a8a3a'); px.rect(9, 1, 3, 2, '#5aa048'); },
  elderberry(px) { px.line(8, 1, 8, 6, '#6a3a4a'); px.line(8, 6, 4, 9, '#6a3a4a'); px.line(8, 6, 12, 9, '#6a3a4a'); for (const [x, y] of [[3, 10], [5, 11], [7, 9], [9, 10], [11, 11], [13, 10], [6, 13], [10, 13], [8, 12]]) { px.set(x, y, '#1e1a24'); px.set(x + 1, y, '#3a2a40'); } },
  apple(px) { px.disc(8, 9, 5, '#d8342a'); px.disc(6.5, 7.5, 2, '#f07050'); px.line(8, 4, 9, 1, '#6b4c34'); px.ellipse(11, 3, 2, 1, '#5aa048'); px.set(5, 7, '#ffc0a0'); },
  hazelnut(px) { for (const [x, y] of [[6, 9], [10, 9]]) { px.disc(x, y, 3.4, '#a87438'); px.disc(x - 1, y - 1, 1.4, '#c89458'); px.hline(x - 3, x + 3, y - 3, '#5a8a3a'); } px.line(8, 2, 8, 6, '#5a8a3a'); },
  sloe(px) { for (const [x, y] of [[5, 10], [9, 8], [11, 12]]) { px.disc(x, y, 2.6, '#3a3a6a'); px.set(x - 1, y - 1, '#8a8ac8'); } px.line(9, 5, 9, 2, '#4a3a2a'); },
};

function boxIcon(px, k) {
  px.rect(4, 4, 8, 10, '#b07a42'); px.vline(4, 4, 13, '#c8945a'); px.vline(11, 4, 13, '#8a5a30');
  px.poly([[3, 5], [13, 5], [12, 1], [4, 1]], '#5a3e26'); px.hline(4, 12, 1, '#7a5a3a');
  if (k === 'open') { px.rect(5, 6, 6, 3, '#2a1a10'); }
  else if (k === 'small') { px.disc(8, 8, 1.2, '#1a120c'); }
  else if (k === 'large') { px.disc(8, 8, 2.8, '#6e5236'); px.disc(8, 8, 2.2, '#1a120c'); }
  else px.disc(8, 8, 1.8, '#1a120c');
  px.rect(7, 14, 2, 2, '#8a5a34');
}

const UI_ICON = {
  coin(px) { px.disc(8, 8, 6, '#e8b830'); px.disc(8, 8, 4.5, '#f6d860'); px.vline(8, 5, 11, '#c8961a'); px.set(6, 5, '#fff4b0'); },
  clock(px) { px.disc(8, 8, 6, '#f2e6c8'); px.vline(8, 4, 8, '#3a2a1e'); px.hline(8, 11, 8, '#3a2a1e'); },
  sun(px) { px.disc(8, 8, 4, '#f6c83a'); for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; px.line(8 + Math.cos(t) * 5, 8 + Math.sin(t) * 5, 8 + Math.cos(t) * 7, 8 + Math.sin(t) * 7, '#f6a83a'); } px.disc(7, 7, 1.5, '#fff0a0'); },
  cloud(px) { for (const [x, y, r] of [[5, 9, 3], [9, 7, 4], [12, 10, 2.6], [8, 10, 3]]) px.disc(x, y, r, '#e8eef4'); px.hline(3, 13, 12, '#b8c4d0'); },
  rain(px) { for (const [x, y, r] of [[5, 6, 3], [9, 5, 3.5], [12, 7, 2.4]]) px.disc(x, y, r, '#a8b4c4'); for (const [x, y] of [[4, 11], [8, 12], [12, 11], [6, 14], [10, 14]]) px.line(x, y, x - 1, y + 1, '#5a9ad8'); },
  snow(px) { for (let a = 0; a < 3; a++) { const t = a / 3 * Math.PI; px.line(8 - Math.cos(t) * 6, 8 - Math.sin(t) * 6, 8 + Math.cos(t) * 6, 8 + Math.sin(t) * 6, '#e8f4ff'); } px.disc(8, 8, 1.5, '#ffffff'); },
  spring(px) { px.line(8, 15, 8, 8, '#4a8a3a'); px.line(8, 12, 5, 10, '#5aa048'); for (let a = 0; a < 5; a++) { const t = a / 5 * Math.PI * 2; px.disc(8 + Math.cos(t) * 3, 5 + Math.sin(t) * 3, 2, '#f4b8cc'); } px.disc(8, 5, 1.5, '#f6d84c'); },
  summer(px) { UI_ICON.sun(px); },
  autumn(px) { MAT_ICON.leaves(px); },
  winter(px) { UI_ICON.snow(px); },
  journal(px) { px.rect(3, 2, 10, 12, '#5a7a3a'); px.rect(4, 3, 8, 10, '#6a9a4a'); px.vline(3, 2, 13, '#3e5a26'); px.rect(5, 5, 6, 3, '#f2e6c8'); px.set(7, 6, '#3a6ab0'); px.set(8, 6, '#3a6ab0'); px.rect(12, 14, 1, 2, '#c83a2a'); },
  bag(px) { px.ellipse(8, 10, 6, 5, '#a8743f'); px.rect(4, 5, 8, 3, '#8a5a34'); px.line(5, 5, 7, 2, '#6b4c34'); px.line(11, 5, 9, 2, '#6b4c34'); px.rect(7, 8, 2, 2, '#e8b830'); },
  heart(px) { px.disc(5.5, 6.5, 3, '#e8485a'); px.disc(10.5, 6.5, 3, '#e8485a'); px.poly([[3, 8], [13, 8], [8, 14]], '#e8485a'); px.set(5, 5, '#ffb0b8'); },
  star(px) { const pts = []; for (let a = 0; a < 10; a++) { const t = -Math.PI / 2 + a / 10 * Math.PI * 2, r = a % 2 ? 2.8 : 7; pts.push([8 + Math.cos(t) * r, 8.5 + Math.sin(t) * r]); } px.poly(pts, '#f6c83a'); px.set(7, 6, '#fff4b0'); },
  egg(px) { px.ellipse(8, 9, 4.5, 5.5, '#8fc6b6'); px.set(6, 6, '#c8ece2'); px.set(9, 11, '#8a4f2f'); px.set(7, 12, '#8a4f2f'); },
  chick(px) { px.disc(8, 9, 5, '#f6d860'); px.disc(10, 6, 3, '#f6d860'); px.set(11, 5, '#1a1a1a'); px.rect(13, 6, 2, 1, '#e88a2a'); px.line(5, 9, 8, 11, '#e8c040'); },
  nest(px) { px.ellipse(8, 10, 7, 4, '#c8a86a'); px.ellipse(8, 8.5, 5, 1.6, '#8a6a3a'); px.line(1, 9, 4, 12, '#7a5a3a'); px.line(15, 9, 12, 12, '#7a5a3a'); for (const x of [6, 9]) px.ellipse(x, 7.5, 1.6, 1.4, '#8fc6b6'); },
  leaf(px) { px.poly([[3, 13], [5, 5], [13, 2], [11, 10]], '#5aa048'); px.line(3, 13, 12, 3, '#3a7a2a'); },
  feather(px) { MAT_ICON.feather(px); },
  hammer(px) { px.thick(4, 13, 10, 7, 2, '#8a5a34'); px.rect(8, 2, 6, 4, '#8a8e96'); px.rect(8, 2, 6, 1, '#b8bcc4'); px.rect(13, 3, 2, 2, '#6a6e76'); },
  water(px) { px.poly([[8, 2], [3, 10], [13, 10]], '#5eb6d6'); px.disc(8, 10, 5, '#5eb6d6'); px.disc(6, 9, 1.5, '#b8e8f4'); },
  moon(px) { px.disc(8, 8, 6, '#f2e6a0'); px.disc(11, 6, 5, 0); px.set(5, 7, '#fff8d0'); },
  check(px) { px.thick(3, 8, 6, 12, 2.5, '#5ac05a'); px.thick(6, 12, 13, 4, 2.5, '#5ac05a'); },
  cross(px) { px.thick(4, 4, 12, 12, 2.5, '#e8485a'); px.thick(12, 4, 4, 12, 2.5, '#e8485a'); },
  lock(px) { px.rect(4, 7, 8, 7, '#e8b830'); px.frame(5, 3, 6, 6, '#a8a8b0'); px.rect(7, 9, 2, 3, '#8a6a1a'); },
  letter(px) { px.rect(2, 4, 12, 9, '#f6eed8'); px.line(2, 4, 8, 9, '#c8b48a'); px.line(13, 4, 8, 9, '#c8b48a'); px.disc(8, 9, 1.6, '#c83a2a'); },
  binoculars(px) { px.rect(3, 5, 4, 8, '#3a3a44'); px.rect(9, 5, 4, 8, '#3a3a44'); px.rect(6, 7, 4, 3, '#2a2a30'); px.disc(5, 12, 2, '#6a8aa8'); px.disc(11, 12, 2, '#6a8aa8'); px.set(4, 11, '#c8e0f4'); px.set(10, 11, '#c8e0f4'); },
  map(px) { px.poly([[2, 3], [6, 2], [10, 4], [14, 2], [14, 13], [10, 15], [6, 13], [2, 14]], '#e8dcb8'); px.vline(6, 2, 13, '#c8b48a'); px.vline(10, 4, 15, '#c8b48a'); px.line(3, 10, 13, 6, '#5eb6d6'); px.disc(9, 9, 1.5, '#e8485a'); },
  gear(px) { px.disc(8, 8, 5.5, '#9a9ea6'); for (let a = 0; a < 8; a++) { const t = a / 8 * Math.PI * 2; px.disc(8 + Math.cos(t) * 6, 8 + Math.sin(t) * 6, 1.4, '#9a9ea6'); } px.disc(8, 8, 2.2, '#5a5e66'); },
  chat(px) { px.ellipse(8, 7, 6.5, 4.5, '#f6f2e6'); px.poly([[4, 10], [8, 10], [3, 14]], '#f6f2e6'); for (const x of [5, 8, 11]) px.set(x, 7, '#5a5e66'); },
  home(px) { px.poly([[1, 8], [8, 2], [15, 8]], '#b4503a'); px.rect(3, 8, 10, 6, '#efe2c4'); px.rect(7, 10, 3, 4, '#8a5a34'); },
  people(px) { for (const [x, c] of [[5, '#3f7fbf'], [11, '#c0463c']]) { px.disc(x, 5, 2.6, '#f1c7a5'); px.rect(x - 3, 9, 6, 5, c); } },
  observe(px) { UI_ICON.binoculars(px); },
  clue(px) { px.rect(3, 3, 10, 11, '#f6eed8'); px.hline(4, 11, 6, '#b0a080'); px.hline(4, 9, 8, '#b0a080'); px.hline(4, 10, 10, '#b0a080'); px.disc(11, 11, 2.5, '#5aa048'); px.set(11, 11, '#ffffff'); },
  sparkle(px) { px.line(8, 1, 8, 15, '#fff4b0'); px.line(1, 8, 15, 8, '#fff4b0'); px.disc(8, 8, 2, '#ffffff'); },
  no(px) { UI_ICON.cross(px); },
  note(px) { px.ellipse(5, 12, 2.5, 2, '#3a2614'); px.ellipse(11.5, 11, 2.5, 2, '#3a2614'); px.vline(7, 4, 12, '#3a2614'); px.vline(13, 3, 11, '#3a2614'); px.thick(7, 4, 13, 3, 2, '#3a2614'); px.set(4, 11, '#8a6a4a'); },
};

function genIcon(kind, key) {
  const px = icoNew();
  const fn = kind === 'mat' ? MAT_ICON[key] : kind === 'item' ? ITEM_ICON[key] : UI_ICON[key];
  if (!fn) { px.rect(4, 4, 8, 8, '#ff00ff'); return icoDone(px); }
  fn(px);
  return icoDone(px);
}
