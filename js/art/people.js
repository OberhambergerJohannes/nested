'use strict';
// Characters (players & villagers), animals and dialogue portraits, drawn with primitives so that
// colours and styles can be swapped freely. Characters are chibi-proportioned: a big round head
// with shiny eyes on a small body. Sprites are 16x26; the figure is drawn in "body rows"
// (head 0-10, torso 11-15, legs 16-18, shoes 19-20) shifted down to leave headroom for hats,
// buns and spiky hair. Children have a shorter torso and legs.

const NPC_LOOKS = {
  ada:     { skin: '#f1c7a5', hair: '#d9d4c7', style: 'bun', eyes: '#4a6a8a', eyeshape: 'happy', top: 'fieldvest', shirt: '#b8a274', under: '#4a7a4a', bottom: 'trousers', pants: '#6a5a4a', shoes: '#4a3424', hat: 'none', eyewear: 'glasses', acc: 'binoculars', face: 'wrinkles', prop: 'notebook' },
  basil:   { skin: '#c98d63', hair: '#3b2418', style: 'short', eyes: '#3a2a20', eyeshape: 'round', top: 'tee', shirt: '#e8dcc0', apron: '#5a8a4a', bottom: 'trousers', pants: '#4a4a5a', shoes: '#3a2a1e', hat: 'cap', hatCol: '#3e6b4e', eyewear: 'none', acc: 'none', face: 'beard', prop: 'trowel' },
  mabel:   { skin: '#e8b48f', hair: '#a33b2b', style: 'braids', eyes: '#3f8a4a', eyeshape: 'round', top: 'overalls', shirt: '#c84a3a', bottom: 'trousers', pants: '#4a6ab0', shoes: '#3e6a3e', boots: true, hat: 'straw', hatCol: '#c84a3a', eyewear: 'none', acc: 'neckerchief', face: 'freckles' },
  tom:     { skin: '#e2b08a', hair: '#ebe7df', style: 'short', eyes: '#3a6ab0', eyeshape: 'happy', top: 'raincoat', shirt: '#e8b830', bottom: 'trousers', pants: '#465a7e', shoes: '#2f4a32', boots: true, hat: 'beanie', hatCol: '#34507a', eyewear: 'none', acc: 'none', face: 'beard', prop: 'rod' },
  edith:   { skin: '#f6d0b1', hair: '#cfcbd4', style: 'bob', eyes: '#6a4a2a', eyeshape: 'happy', top: 'cardigan', shirt: '#a85a7a', under: '#f4ecdc', bottom: 'skirt', pants: '#4a5a7a', shoes: '#5a3a2a', hat: 'none', eyewear: 'glasses', acc: 'none', face: 'rosy', prop: 'basket' },
  rosie:   { kid: true, skin: '#e8b48f', hair: '#6b3e1f', style: 'pigtails', eyes: '#3a2a20', eyeshape: 'round', top: 'dress', shirt: '#f08aa8', bottom: 'skirt', pants: '#f08aa8', shoes: '#d8342a', boots: true, hat: 'none', hatCol: '#f6d84c', eyewear: 'none', acc: 'none', face: 'freckles' },
  finn:    { skin: '#9a6142', hair: '#24242c', style: 'curly', eyes: '#3a2a20', eyeshape: 'round', top: 'hoodie', shirt: '#3fa8a0', bottom: 'trousers', pants: '#3a3a44', shoes: '#e8e4dc', hat: 'beanie', hatCol: '#e0a43c', eyewear: 'none', acc: 'camera', face: 'none' },
  juniper: { skin: '#c98d63', hair: '#6b3e1f', style: 'ponytail', eyes: '#3f8a4a', eyeshape: 'lashes', top: 'fieldvest', shirt: '#6a7a44', under: '#efe6d0', bottom: 'trousers', pants: '#5a4a3a', shoes: '#4a3424', boots: true, hat: 'fieldhat', hatCol: '#7a6a44', eyewear: 'none', acc: 'backpack', face: 'none' },
  luna:    { skin: '#f6d0b1', hair: '#2e2a44', style: 'long', eyes: '#6a5ab0', eyeshape: 'lashes', top: 'jacket', shirt: '#2f3e62', under: '#e8e0f0', bottom: 'trousers', pants: '#34343c', shoes: '#2a2a30', hat: 'none', hatCol: '#c8a8e8', eyewear: 'none', acc: 'scarf', face: 'none', prop: 'lantern' },
};

function playerLookOpts(look) {
  const l = cleanLook(look);
  return {
    skin: SKIN_COLORS[l.skin], hair: HAIR_COLORS[l.hair], style: HAIR_STYLES[l.style], eyes: EYE_COLORS[l.eyes],
    eyeshape: EYE_SHAPES[l.eyeshape], top: TOP_STYLES[l.top], shirt: SHIRT_COLORS[l.shirt], bottom: BOTTOM_STYLES[l.bottom],
    pants: PANTS_COLORS[l.pants], shoes: SHOE_COLORS[l.shoes], hat: HAT_STYLES[l.hat], hatCol: SHIRT_COLORS[l.hatc],
    eyewear: EYEWEAR[l.eyewear], acc: ACCESSORIES[l.acc], face: FACE_EXTRAS[l.face],
  };
}

const PERSON_W = 16, PERSON_H = 26;
const tone = (c, dd, l) => ({ m: c, d: darken(c, dd), dd: darken(c, dd * 2), l: lighten(c, l), h: lighten(c, l * 2.1) });

// dir: 0 down, 1 left (mirrored right), 2 right, 3 up. frame: 0 stand, 1 walkA, 2 walkB, 3 act
function genPerson(o, dir, frame) {
  const px = new Pix(PERSON_W, PERSON_H);
  const d = dir === 1 ? 2 : dir;
  const walk = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const act = frame === 3;
  const kid = !!o.kid;
  const OY = kid ? 6 : 4;
  const TB = kid ? 14 : 15, LT = TB + 1, LB = kid ? 16 : 18, SH = LB + 1;
  const set = (x, y, c) => px.set(x, y + OY, c);
  const rect = (x, y, w, h, c) => px.rect(x, y + OY, w, h, c);
  const S = tone(o.skin, 0.13, 0.08), H = tone(o.hair, 0.26, 0.2), T = tone(o.shirt, 0.2, 0.14);
  const Pn = tone(o.pants, 0.24, 0.14), Sh = tone(o.shoes || '#5a3a22', 0.3, 0.24);
  const C2 = tone(o.hatCol || o.shirt, 0.24, 0.18);
  const U = tone(o.under || '#efe8d6', 0.14, 0.08);
  const style = o.style || 'short', top = o.top || 'tee', bottom = o.bottom || 'trousers';
  const hat = o.hat || 'none', acc = o.acc || 'none', eyewear = o.eyewear || 'none', face = o.face || 'none';
  const layered = top === 'vest' || top === 'jacket' || top === 'fieldvest' || top === 'cardigan';
  const sleeve = top === 'vest' || top === 'fieldvest' ? U : T;
  const shortSleeves = top === 'tee' || top === 'dress';
  const bareLegs = bottom === 'shorts' || bottom === 'skirt' || (top === 'dress' && bottom !== 'trousers');
  const pack = tone('#7a5a3a', 0.25, 0.18), strap = '#5a3e26';
  const eyeCol = o.eyes || '#3a2a20';
  const binoUp = act && o.binoc;

  // ------------------------------------------------ back layer
  if (d === 0) {
    if (style === 'long') { rect(1, 5, 14, 10, H.d); for (let y = 6; y < 15; y += 3) set(1, y, H.m); }
    if (style === 'bob') rect(1, 5, 14, 6, H.d);
    if (style === 'curly') for (let y = 3; y <= 12; y++) for (let x = 0; x <= 15; x++) if ((x - 7.5) ** 2 / 56 + (y - 6) ** 2 / 40 < 1) set(x, y, ((x >> 1) + (y >> 1)) % 2 ? H.d : H.m);
    if (style === 'afro') for (let y = -3; y <= 10; y++) for (let x = 0; x <= 15; x++) if ((x - 7.5) ** 2 / 64 + (y - 3.5) ** 2 / 46 < 1) set(x, y, (x & 1) && (y & 1) ? H.d : ((x >> 1) * 5 + (y >> 1) * 3) % 4 === 0 && !(x & 1) ? H.l : H.m);
    if (top === 'hoodie') rect(3, 9, 10, 3, T.d);
  } else if (d === 2) {
    if (style === 'long') rect(1, 4, 6, 11, H.d);
    if (style === 'bob') rect(1, 4, 6, 7, H.d);
    if (style === 'ponytail') { rect(0, 4, 2, 8, H.m); set(1, 4, H.l); set(0, 11, H.d); set(1, 3, C2.m); set(2, 3, C2.m); }
    if (style === 'pigtails') { rect(1, 4, 2, 7, H.m); set(2, 4, C2.m); }
    if (style === 'braids') for (let y = 8; y <= 16; y++) { set(2, y, y % 2 ? H.m : H.d); set(3, y, y % 2 ? H.d : H.m); }
    if (style === 'curly') for (let y = 2; y <= 12; y++) for (let x = 0; x <= 8; x++) if ((x - 4) ** 2 / 18 + (y - 7) ** 2 / 26 < 1) set(x, y, ((x >> 1) + (y >> 1)) % 2 ? H.d : H.m);
    if (style === 'afro') for (let y = -3; y <= 10; y++) for (let x = 0; x <= 14; x++) if ((x - 6.5) ** 2 / 52 + (y - 3.5) ** 2 / 46 < 1) set(x, y, (x & 1) && (y & 1) ? H.d : ((x >> 1) * 5 + (y >> 1) * 3) % 4 === 0 && !(x & 1) ? H.l : H.m);
    if (acc === 'backpack') { rect(1, 11, 4, 7, pack.m); set(1, 11, pack.l); rect(1, 14, 4, 1, pack.d); }
    if (top === 'hoodie') rect(2, 9, 5, 3, T.d);
  } else if (o.prop === 'rod') { for (let i = 0; i < 17; i++) set(1 + (i > 9 ? 0 : 1), 14 - i, '#7a5434'); }

  // ------------------------------------------------ legs & shoes
  const legCol = (y) => (bareLegs && (bottom === 'shorts' ? y >= LT + 1 : true) ? S : Pn);
  const legPix = (x, y0, y1, side) => {
    for (let y = y0; y <= y1; y++) { const P = legCol(y); for (let i = 0; i < 3; i++) set(x + i, y, i === 0 && !side ? P.l : i === 2 ? P.d : P.m); }
  };
  const boot = o.boots ? 1 : 0;
  const shoe = (x, y, w, toeRight) => {
    if (boot) { rect(x, y - 1, w, 1, Sh.m); set(x + (toeRight ? 0 : w - 1), y - 1, Sh.l); }
    rect(x, y, w, 1, Sh.m); rect(x, y + 1, w, 1, Sh.d);
    set(toeRight ? x + w - 1 : x, y, Sh.l);
    if (!boot && w >= 3) set(x + 1, y, Sh.h);
  };
  if (d === 0 || d === 3) {
    const lUp = walk > 0 ? 1 : 0, rUp = walk < 0 ? 1 : 0;
    legPix(5, LT, LB - lUp, 0); legPix(8, LT, LB - rUp, 1);
    shoe(5, SH - lUp, 3, false); shoe(8, SH - rUp, 3, true);
  } else if (walk === 0) {
    for (let y = LT; y <= LB; y++) { const P = legCol(y); for (let x = 6; x <= 9; x++) set(x, y, x === 6 ? P.l : x === 9 ? P.d : P.m); }
    shoe(6, SH, 5, true);
  } else {
    const back = walk > 0 ? 4 : 8, front = walk > 0 ? 8 : 4;
    for (let y = LT; y <= LB; y++) for (let i = 0; i < 3; i++) set(back + i, y, legCol(y).d);
    legPix(front, LT, LB, 0);
    rect(back, SH, 4, 1, Sh.d); rect(back, SH + 1, 4, 1, Sh.dd);
    shoe(front, SH, 4, true);
  }

  // ------------------------------------------------ torso
  const skirtRows = (x0f, x1f, P, n) => {
    for (let k = 0; k < n; k++) {
      const y = TB + k, x0 = x0f - (k >= 1 ? 1 : 0) - (k >= 3 ? 1 : 0), x1 = x1f + (k >= 1 ? 1 : 0) + (k >= 3 ? 1 : 0);
      for (let x = x0; x <= x1; x++) set(x, y, x === x0 ? P.l : x === x1 ? P.d : (k > 0 && (x - x0) % 3 === 2) ? P.d : P.m);
    }
    for (let x = x0f - 2; x <= x1f + 2; x++) if (px.op(x, TB + n - 1 + OY)) set(x, TB + n - 1, P.d);
  };
  const torsoFront = () => {
    const base = layered ? U : T;
    rect(4, 11, 8, TB - 10, base.m);
    for (let y = 11; y <= TB; y++) { set(4, y, base.l); set(11, y, base.d); }
    rect(5, TB, 6, 1, base.d);
    set(7, 11, S.d); set(8, 11, S.d);
    if (top === 'tee') { set(6, 11, T.l); set(9, 11, T.l); set(8, 13, T.d); }
    if (top === 'sweater') { for (let x = 4; x <= 11; x++) set(x, TB, x % 2 ? T.d : T.m); set(6, 11, T.d); set(9, 11, T.d); set(6, 12, T.l); set(9, 13, T.d); }
    if (top === 'flannel') {
      for (let y = 11; y <= TB; y++) for (let x = 4; x <= 11; x++) { const v = x % 3 === 1, h = y % 3 === 0; if (v && h) set(x, y, T.dd); else if (v || h) set(x, y, T.d); }
      set(6, 11, T.l); set(9, 11, T.l); set(7, 11, S.d); set(8, 11, S.d); set(8, 13, U.m);
    }
    if (top === 'hoodie') {
      rect(5, 11, 6, 1, T.d); set(7, 11, S.d); set(8, 11, S.d);
      set(6, 12, U.m); set(6, 13, U.d); set(9, 12, U.m); set(9, 13, U.d);
      rect(5, TB - 1, 6, 1, T.d); rect(6, TB - 1, 4, 1, T.l);
    }
    if (top === 'vest' || top === 'fieldvest' || top === 'jacket' || top === 'cardigan') {
      const V = top === 'cardigan' || top === 'jacket' ? T : T;
      for (let y = 11; y <= TB; y++) { rect(4, y, 3, 1, V.m); rect(9, y, 3, 1, V.m); set(6, y, V.d); set(9, y, V.l); set(4, y, V.l); set(11, y, V.d); }
      if (top === 'vest') { set(5, 13, '#e8c860'); set(5, TB - 1, '#e8c860'); set(7, 12, T.dd); set(8, 12, T.dd); }
      if (top === 'fieldvest') { rect(4, 12, 2, 2, V.d); rect(10, 12, 2, 2, V.d); set(4, 12, V.l); set(10, 12, V.l); rect(4, TB - 1, 2, 1, V.d); rect(10, TB - 1, 2, 1, V.d); }
      if (top === 'jacket') { set(6, 11, T.l); set(6, 12, T.l); set(9, 11, T.l); set(9, 12, T.l); set(5, TB - 1, T.d); set(10, TB - 1, T.d); }
      if (top === 'cardigan') { for (let y = 12; y < TB; y += 2) set(6, y, '#f2e6c8'); for (let x = 4; x <= 11; x++) if (x < 7 || x > 8) set(x, TB, x % 2 ? T.d : T.m); }
    }
    if (top === 'raincoat') {
      set(6, 11, T.l); set(9, 11, T.l); rect(7, 11, 2, 1, T.d);
      for (let y = 12; y <= TB; y++) set(7, y, T.d);
      for (let y = 12; y < TB; y += 2) set(8, y, '#3a3a40');
      rect(4, TB - 1, 2, 1, T.d); rect(10, TB - 1, 2, 1, T.d);
    }
    if (top === 'dress') { rect(4, TB - 1, 8, 1, T.d); set(7, 12, T.l); set(8, 12, T.l); skirtRows(4, 11, T, kid ? 2 : 3); }
    if (top === 'overalls') {
      rect(5, 13, 6, TB - 12, Pn.m); rect(5, 13, 6, 1, Pn.l);
      set(5, 11, Pn.m); set(5, 12, Pn.m); set(10, 11, Pn.m); set(10, 12, Pn.m);
      set(5, 13, '#f2d24a'); set(10, 13, '#f2d24a');
      if (TB - 12 >= 3) { rect(7, 14, 2, 2, Pn.d); set(7, 14, Pn.l); }
    }
    if (bottom === 'skirt' && top !== 'dress') skirtRows(4, 11, Pn, 2);
    else if (top !== 'dress' && top !== 'overalls' && top !== 'raincoat') { rect(4, TB, 8, 1, darken(o.pants, 0.32)); set(7, TB, '#c8a848'); }
    if (o.apron) {
      const A = tone(o.apron, 0.2, 0.18);
      rect(5, 12, 6, TB - 12 + 3, A.m); rect(5, 12, 6, 1, A.l); set(5, 11, A.d); set(10, 11, A.d);
      rect(6, 14, 4, 2, A.d); set(6, 14, A.l);
      if (o.prop === 'trowel') { set(8, 13, '#a8743f'); set(8, 12, '#a8743f'); set(9, 12, '#c8ccd4'); }
    }
    if (acc === 'neckerchief') { rect(5, 11, 6, 1, '#d8342a'); set(7, 12, '#d8342a'); set(8, 12, '#b02a24'); set(6, 11, '#f05a4a'); }
  };
  const torsoBack = () => {
    rect(4, 11, 8, TB - 10, T.m);
    for (let y = 11; y <= TB; y++) { set(4, y, T.l); set(11, y, T.d); }
    rect(5, TB, 6, 1, T.d);
    if (top === 'flannel') for (let y = 11; y <= TB; y++) for (let x = 4; x <= 11; x++) { const v = x % 3 === 1, h = y % 3 === 0; if (v && h) set(x, y, T.dd); else if (v || h) set(x, y, T.d); }
    if (top === 'hoodie') { rect(5, 11, 6, 3, T.d); rect(6, 11, 4, 2, T.m); }
    if (top === 'vest' || top === 'fieldvest') { set(4, 11, U.m); set(11, 11, U.m); rect(5, TB - 1, 6, 1, T.d); }
    if (top === 'raincoat') { rect(5, 11, 6, 2, T.l); rect(5, 12, 6, 1, T.d); }
    if (top === 'overalls') { set(5, 11, Pn.m); set(6, 12, Pn.m); set(10, 11, Pn.m); set(9, 12, Pn.m); set(7, 13, Pn.m); set(8, 13, Pn.m); rect(5, 14, 6, TB - 13, Pn.m); }
    if (top === 'dress') skirtRows(4, 11, T, kid ? 2 : 3);
    else if (bottom === 'skirt') skirtRows(4, 11, Pn, 2);
    else if (top !== 'overalls' && top !== 'raincoat') rect(4, TB, 8, 1, darken(o.pants, 0.32));
    if (o.apron) rect(4, TB - 1, 8, 1, o.apron);
    if (acc === 'neckerchief') { rect(5, 11, 6, 1, '#d8342a'); }
  };
  const torsoSide = () => {
    rect(5, 11, 6, TB - 10, T.m);
    for (let y = 11; y <= TB; y++) { set(5, y, T.l); set(10, y, layered ? U.m : T.d); }
    if (layered) for (let y = 11; y <= TB; y++) set(9, y, T.d);
    rect(5, TB, 6, 1, T.d);
    set(10, 11, S.d);
    if (top === 'flannel') for (let y = 11; y <= TB; y++) for (let x = 5; x <= 10; x++) { const v = x % 3 === 1, h = y % 3 === 0; if (v && h) set(x, y, T.dd); else if (v || h) set(x, y, T.d); }
    if (top === 'hoodie') { rect(3, 10, 3, 3, T.d); set(10, 12, U.m); set(10, 13, U.d); }
    if (top === 'raincoat') { for (let y = 12; y < TB; y += 2) set(10, y, '#3a3a40'); }
    if (top === 'overalls') { rect(7, 13, 4, TB - 12, Pn.m); set(9, 11, Pn.m); set(9, 12, Pn.m); set(9, 13, '#f2d24a'); }
    if (top === 'dress') skirtRows(5, 10, T, kid ? 2 : 3);
    else if (bottom === 'skirt') skirtRows(5, 10, Pn, 2);
    else if (top !== 'overalls' && top !== 'raincoat') rect(5, TB, 6, 1, darken(o.pants, 0.32));
    if (o.apron) { const A = tone(o.apron, 0.2, 0.18); rect(9, 12, 2, TB - 9, A.m); set(9, 12, A.l); }
    if (acc === 'neckerchief') { rect(8, 11, 3, 1, '#d8342a'); set(10, 12, '#b02a24'); }
  };
  if (d === 0) torsoFront(); else if (d === 3) torsoBack(); else torsoSide();

  // ------------------------------------------------ arms
  const armLen = TB - 11;
  const armDown = (x, y0, P) => {
    const sl = shortSleeves ? 2 : armLen;
    for (let y = y0; y < y0 + sl; y++) { set(x, y, P === 'L' ? sleeve.l : sleeve.m); set(x + 1, y, P === 'R' ? sleeve.d : sleeve.m); }
    if (shortSleeves) { set(x, y0 + 1, sleeve.d); set(x + 1, y0 + 1, sleeve.d); for (let y = y0 + 2; y < y0 + armLen; y++) { set(x, y, S.m); set(x + 1, y, S.d); } }
    else { set(x, y0 + armLen - 1, sleeve.d); set(x + 1, y0 + armLen - 1, sleeve.d); }
    set(x, y0 + armLen, S.m); set(x + 1, y0 + armLen, S.d);
  };
  const hold = (hx, hy) => {
    if (o.prop === 'notebook') { rect(hx - 1, hy - 2, 3, 3, '#c84a3a'); set(hx - 1, hy - 2, '#e86a5a'); set(hx + 1, hy - 1, '#f4ecdc'); }
    if (o.prop === 'lantern') { set(hx, hy - 1, '#2a2a30'); rect(hx - 1, hy, 3, 3, '#ffd86a'); set(hx, hy + 1, '#fff6c8'); set(hx - 1, hy, '#3a3a40'); set(hx + 1, hy, '#3a3a40'); set(hx - 1, hy + 2, '#3a3a40'); set(hx + 1, hy + 2, '#3a3a40'); }
    if (o.prop === 'rod') {
      if (d === 2) { for (let i = 0; i < 13; i++) set(hx + 1 + Math.floor(i / 2), hy - 1 - i, i > 8 ? '#9a7450' : '#6a4428'); set(15, hy - 14, '#f4f4f4'); set(15, hy - 13, '#d8d8d8'); }
      else { for (let i = 0; i < 17; i++) set(hx + 1 + (i > 9 ? 1 : 0), hy - 1 - i, i > 10 ? '#9a7450' : '#6a4428'); set(15, hy - 18, '#e83a2a'); }
    }
    if (o.prop === 'basket') { rect(hx - 2, hy, 4, 2, '#b8864a'); set(hx - 2, hy - 1, '#8a5a30'); set(hx + 1, hy - 1, '#8a5a30'); set(hx - 1, hy - 1, '#f08aa8'); set(hx, hy - 1, '#f6d84c'); set(hx - 1, hy - 2, '#4f9a40'); }
  };
  if (d === 0 || d === 3) {
    if (act && d === 0) {
      rect(3, 11, 2, 3, sleeve.d); rect(11, 11, 2, 3, sleeve.d);
      rect(5, 10, 2, 2, S.m); rect(9, 10, 2, 2, S.m);
    } else {
      const ly = 11 + Math.max(0, walk), ry = 11 + Math.max(0, -walk);
      armDown(2, ly, 'L'); armDown(12, ry, 'R');
      if (d === 0) hold(13, ry + armLen + 1);
    }
  } else {
    if (act) { rect(8, 12, 5, 2, sleeve.d); rect(8, 12, 5, 1, sleeve.m); rect(13, 11, 2, 2, S.m); }
    else { const sw = walk * 2; armDown(7 + sw, 11, 'M'); hold(8 + sw, 11 + armLen + 1); }
  }

  // ------------------------------------------------ head
  rect(5, 0, 6, 1, S.m); rect(3, 1, 10, 1, S.m); rect(2, 2, 12, 7, S.m); rect(3, 9, 10, 1, S.m); rect(4, 10, 8, 1, S.d);
  if (d === 0) {
    for (let y = 2; y <= 8; y++) set(13, y, S.d);
    set(12, 1, S.d); set(12, 9, S.d);
    set(4, 2, S.l); set(5, 2, S.l); set(4, 3, S.l);
    set(1, 5, S.m); set(1, 6, S.d); set(14, 5, S.d); set(14, 6, S.dd);
    if (!binoUp) drawEyes(set, o.eyeshape || 'round', eyeCol, S, 0);
    const blush = mixHex(o.skin, '#ff7a8a', face === 'rosy' ? 0.5 : 0.3);
    if (face === 'freckles') { const f = mixHex(o.skin, '#8a4a2a', 0.4); set(3, 8, f); set(5, 9, f); set(4, 8, blush); set(11, 8, blush); set(10, 9, f); set(12, 8, f); }
    else { set(3, 8, blush); set(4, 8, blush); set(11, 8, blush); set(12, 8, blush); if (face === 'rosy') { set(3, 9, blush); set(12, 9, blush); } }
    // a small smile
    set(7, 9, '#9a4a42'); set(8, 9, '#9a4a42'); set(6, 8, S.d); set(9, 8, S.d);
    if (face === 'wrinkles') { set(3, 6, S.d); set(12, 6, S.d); set(6, 9, S.d); set(9, 9, S.d); }
    if (face === 'beard') { rect(2, 6, 1, 3, H.m); rect(13, 6, 1, 3, H.d); rect(3, 8, 10, 2, H.m); rect(4, 10, 8, 1, H.m); rect(5, 11, 6, 1, H.d); set(7, 9, '#7a3a34'); set(8, 9, '#7a3a34'); set(5, 8, H.l); set(6, 10, H.l); set(10, 9, H.d); }
    if (face === 'moustache') { rect(6, 8, 4, 1, H.m); set(5, 9, H.m); set(10, 9, H.m); set(9, 8, H.d); }
    if (face === 'stubble') for (let y = 8; y <= 10; y++) for (let x = 3; x <= 12; x++) if ((x + y) % 2 === 0 && (x < 7 || x > 8 || y !== 9)) set(x, y, mixHex(o.skin, o.hair, 0.3));
  } else if (d === 2) {
    set(14, 6, S.m); set(14, 7, S.d);
    for (let y = 2; y <= 8; y++) set(2, y, S.d);
    set(7, 5, S.d); set(7, 6, S.d); set(8, 6, S.d);
    if (!binoUp) drawEyes(set, o.eyeshape || 'round', eyeCol, S, 2);
    set(12, 9, '#9a4a42');
    const blush = mixHex(o.skin, '#ff7a8a', face === 'rosy' ? 0.5 : 0.3);
    if (face === 'freckles') { const f = mixHex(o.skin, '#8a4a2a', 0.4); set(10, 8, blush); set(9, 8, f); set(11, 9, f); }
    else { set(10, 8, blush); set(11, 8, blush); }
    if (face === 'wrinkles') set(12, 6, S.d);
    if (face === 'beard') { rect(8, 6, 1, 3, H.m); rect(9, 8, 5, 2, H.m); rect(9, 10, 4, 1, H.m); rect(10, 11, 3, 1, H.d); set(13, 9, '#7a3a34'); }
    if (face === 'moustache') { set(12, 8, H.m); set(13, 8, H.m); set(13, 9, H.d); }
    if (face === 'stubble') for (let y = 8; y <= 10; y++) for (let x = 9; x <= 13; x++) if ((x + y) % 2 === 0) set(x, y, mixHex(o.skin, o.hair, 0.3));
  } else {
    rect(4, 10, 8, 1, S.d);
  }

  // ------------------------------------------------ hair, hat, eyewear
  drawHair(set, rect, d, style, H, S, C2, hat !== 'none');
  drawHat(set, rect, d, hat, C2);
  if (d === 0 && !binoUp) {
    if (eyewear === 'glasses') { const f = '#6a6a7a'; for (const x of [3, 9]) { rect(x, 4, 4, 1, f); set(x, 5, f); set(x + 3, 5, f); set(x, 6, f); set(x + 3, 6, f); } set(7, 5, f); set(8, 5, f); set(3, 7, '#d8ecf8'); set(12, 7, '#d8ecf8'); }
    if (eyewear === 'square') { const f = '#2a2a34'; for (const x of [3, 9]) { rect(x, 4, 4, 1, f); set(x, 5, f); set(x + 3, 5, f); set(x, 6, f); set(x + 3, 6, f); rect(x, 7, 4, 1, f); } set(7, 5, f); set(8, 5, f); }
    if (eyewear === 'sunglasses') { for (const x of [3, 9]) { rect(x, 5, 4, 2, '#1c1c26'); set(x + 1, 5, '#5a6a90'); } set(7, 5, '#1c1c26'); set(8, 5, '#1c1c26'); }
  } else if (d === 2 && !binoUp) {
    if (eyewear === 'glasses' || eyewear === 'square') { const f = eyewear === 'square' ? '#2a2a34' : '#6a6a7a'; rect(8, 4, 4, 1, f); set(8, 5, f); set(11, 5, f); set(8, 6, f); set(11, 6, f); set(7, 5, f); set(6, 5, f); }
    if (eyewear === 'sunglasses') { rect(8, 5, 4, 2, '#1c1c26'); set(7, 5, '#1c1c26'); set(6, 5, '#1c1c26'); }
  }

  // ------------------------------------------------ accessories
  const sc = C2;
  if (acc === 'scarf') {
    if (d === 0) { for (let x = 4; x <= 11; x++) { set(x, 11, x % 3 === 0 ? sc.d : sc.m); set(x, 12, x % 3 === 0 ? sc.dd : sc.d); } rect(9, 13, 2, 3, sc.m); set(9, 16, sc.l); set(10, 16, sc.l); }
    else if (d === 2) { rect(5, 11, 6, 2, sc.m); rect(5, 12, 6, 1, sc.d); rect(10, 13, 2, 3, sc.m); set(10, 16, sc.l); }
    else { rect(4, 11, 8, 2, sc.m); rect(4, 12, 8, 1, sc.d); rect(5, 13, 2, 2, sc.d); }
  }
  if (acc === 'backpack') {
    if (d === 0) { for (let y = 11; y <= TB; y++) { set(5, y, strap); set(10, y, strap); } }
    else if (d === 2) { for (let y = 11; y <= 14; y++) set(6, y, strap); }
    else { rect(4, 11, 8, TB - 9, pack.m); rect(4, 11, 8, 2, pack.d); rect(4, 11, 8, 1, pack.l); rect(5, 14, 6, TB - 13, pack.d); set(7, 13, '#c8a848'); set(8, 13, '#c8a848'); }
  }
  if (acc === 'satchel') {
    const B = tone('#9a6a3a', 0.25, 0.2);
    if (d === 0) { for (let i = 0; i <= 6; i++) set(4 + i, 11 + Math.round(i * 0.7), '#6a4428'); rect(10, TB - 1, 4, 3, B.m); rect(10, TB - 1, 4, 1, B.l); set(12, TB, '#e8c860'); }
    else if (d === 2) { set(8, 11, '#6a4428'); set(8, 12, '#6a4428'); rect(6, TB - 1, 4, 3, B.m); rect(6, TB - 1, 4, 1, B.l); }
    else { for (let i = 0; i <= 6; i++) set(11 - i, 11 + Math.round(i * 0.7), '#6a4428'); rect(2, TB - 1, 4, 3, B.m); rect(2, TB - 1, 4, 1, B.l); }
  }
  if ((acc === 'binoculars' || acc === 'camera') && !act) {
    const cam = acc === 'camera';
    if (d === 0) {
      set(5, 11, '#2a2a30'); set(10, 11, '#2a2a30'); set(5, 12, '#2a2a30'); set(10, 12, '#2a2a30');
      if (cam) { rect(6, 12, 4, 3, '#3a3a44'); rect(6, 12, 4, 1, '#5a5a66'); set(7, 13, '#7a9ab8'); set(8, 13, '#2a2a30'); set(9, 12, '#e8485a'); }
      else { rect(6, 13, 4, 2, '#3a3a44'); set(6, 13, '#2a2a30'); set(9, 13, '#2a2a30'); set(6, 14, '#7a9ab8'); set(9, 14, '#7a9ab8'); }
    } else if (d === 2) { set(9, 11, '#2a2a30'); set(10, 12, '#2a2a30'); rect(10, 13, 2, 2, '#3a3a44'); set(11, 14, cam ? '#2a2a30' : '#7a9ab8'); }
    else { for (let x = 5; x <= 10; x++) set(x, 11, '#2a2a30'); }
  }
  if (binoUp) {
    if (d === 0) { rect(4, 5, 8, 3, '#2a2a30'); rect(4, 5, 8, 1, '#4a4a56'); set(5, 6, '#6a8aa8'); set(10, 6, '#6a8aa8'); }
    else if (d === 2) { rect(10, 4, 4, 3, '#2a2a30'); set(13, 5, '#6a8aa8'); }
  }
  shadeOutline(px, '#2a1c18', 0.62);
  return dir === 1 ? px.flipped() : px;
}

// Eyes: round & shiny by default; side view (d === 2) shows one eye.
function drawEyes(set, shape, eyeCol, S, d) {
  const dark = '#2a1e1a', iris = eyeCol, irisD = darken(eyeCol, 0.25);
  const xs = d === 2 ? [10] : [4, 10];
  for (const x of xs) {
    if (shape === 'happy') { set(x - 1, 6, dark); set(x, 5, dark); set(x + 1, 5, dark); set(x + 2, 6, dark); continue; }
    if (shape === 'sleepy') { set(x, 6, dark); set(x + 1, 6, dark); set(x, 7, iris); set(x + 1, 7, irisD); continue; }
    set(x, 5, dark); set(x + 1, 5, dark);
    set(x, 6, '#ffffff'); set(x + 1, 6, iris);
    set(x, 7, iris); set(x + 1, 7, irisD);
    if (shape === 'lashes') { set(d === 2 ? x + 2 : (x === 4 ? x - 1 : x + 2), 5, dark); set(d === 2 ? x + 2 : (x === 4 ? x - 1 : x + 2), 4, dark); }
  }
}

// Hair for each style and view. With a hat on, top-knots and spikes are hidden.
function drawHair(set, rect, d, style, H, S, C2, hatOn) {
  const capF = (fringe) => {
    rect(4, -1, 8, 1, H.m); rect(3, 0, 10, 1, H.m); rect(2, 1, 12, 3, H.m);
    set(5, -1, H.l); set(6, -1, H.l); set(4, 0, H.l); set(5, 0, H.h); set(6, 0, H.h); set(7, 0, H.l); set(3, 1, H.l); set(4, 1, H.l);
    set(9, 0, H.d); set(11, 1, H.d); set(7, 2, H.d); set(4, 3, H.d); set(10, 3, H.d);
    for (let y = 1; y <= 3; y++) set(13, y, H.d);
    set(12, 0, H.d); set(11, -1, H.d);
    if (fringe) for (let i = 0; i < fringe.length; i++) { const ch = fringe[i]; if (ch === '#') set(3 + i, 4, H.m); else if (ch === 'd') set(3 + i, 4, H.d); else if (ch === 'l') set(3 + i, 4, H.l); }
    rect(2, 4, 1, 3, H.m); rect(13, 4, 1, 3, H.d);
  };
  const capS = (fringe) => {
    rect(4, -1, 7, 1, H.m); rect(3, 0, 9, 1, H.m); rect(2, 1, 11, 3, H.m); rect(2, 4, 5, 5, H.m);
    set(5, -1, H.l); set(6, 0, H.h); set(5, 0, H.l); set(4, 1, H.l); set(3, 2, H.l);
    set(6, 2, H.d); set(3, 6, H.d); set(5, 7, H.d); set(9, 1, H.d); set(12, 1, H.d); set(12, 2, H.d);
    set(3, 9, H.d); set(4, 9, H.d);
    if (fringe) { set(11, 4, H.m); set(12, 4, H.d); set(12, 3, H.m); set(13, 3, H.d); }
  };
  const capB = (bottom) => {
    rect(4, -1, 8, 1, H.m); rect(3, 0, 10, 1, H.m); rect(2, 1, 12, bottom, H.m);
    set(5, -1, H.l); set(5, 0, H.h); set(6, 0, H.l); set(4, 1, H.l);
    set(5, 3, H.d); set(8, 4, H.d); set(11, 6, H.d); set(6, 6, H.d); set(4, 5, H.l); set(9, 2, H.d);
    for (let y = 1; y < 1 + bottom; y++) set(13, y, H.d);
    for (let x = 3; x <= 12; x++) if (x % 2) set(x, bottom, H.d);
    // strands falling to the nape and a soft shine
    for (let x = 4; x <= 11; x += 3) for (let y = bottom - 4; y < bottom; y++) if ((x + y) % 4 !== 0) set(x, y, H.d);
    set(6, 1, H.h); set(7, 1, H.l); set(3, 2, H.l); set(6, 2, H.l);
    rect(2, 1 + bottom, 2, 1, H.d); rect(12, 1 + bottom, 2, 1, H.d);
  };
  const spikesTop = () => { for (const [x, t] of [[3, -1], [4, -2], [6, -3], [7, -2], [9, -3], [10, -2], [12, -1]]) for (let y = t; y <= 0; y++) set(x, y, y === t ? H.l : H.m); };
  const curlCol = (x, y) => { const v = ((x >> 1) * 5 + (y >> 1) * 3) % 4, ix = x & 1, iy = (y + 8) & 1; return !ix && !iy ? (v === 0 ? H.l : H.m) : ix && iy ? H.d : H.m; };
  const curls = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, curlCol(x, y)); };
  const curlsE = (cx, cy, rx, ry) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if ((x + 0.5 - cx) ** 2 / (rx * rx) + (y + 0.5 - cy) ** 2 / (ry * ry) <= 1) set(x, y, curlCol(x, y)); };
  const bun = (y0) => { rect(5, y0, 6, 3, H.m); rect(6, y0 - 1, 4, 1, H.m); set(6, y0, H.l); set(7, y0 - 1, H.h); set(10, y0 + 1, H.d); rect(6, y0 + 3, 4, 1, C2.m); };

  if (d === 0) {
    switch (style) {
      case 'short': capF('##.###.###'); break;
      case 'long': capF('##.####.##'); rect(1, 3, 2, 12, H.m); rect(13, 3, 2, 12, H.d); for (let y = 5; y <= 13; y += 2) set(1, y, H.l); set(2, 15, H.d); set(13, 15, H.dd); break;
      case 'bun': capF('#.##..##.#'); if (!hatOn) bun(-4); break;
      case 'ponytail': capF('#........#'); set(2, 3, H.m); rect(14, 3, 2, 6, H.d); set(14, 2, C2.m); set(15, 2, C2.m); set(3, 3, H.m); set(5, 3, H.d); break;
      case 'curly': curlsE(8, 1, 7, 3.6); curls(1, 3, 2, 9); curls(13, 3, 14, 9); for (const x of [4, 7, 10]) set(x, 4, H.m); break;
      case 'braids': capF('##......##'); set(7, -1, H.d); set(7, 0, H.d); set(8, 1, H.d);
        for (let y = 5; y <= 15; y++) { set(1, y, y % 2 ? H.m : H.d); set(2, y, y % 2 ? H.d : H.m); set(13, y, y % 2 ? H.m : H.d); set(14, y, y % 2 ? H.d : H.m); }
        rect(1, 16, 2, 1, C2.m); rect(13, 16, 2, 1, C2.m); break;
      case 'buzz': { const b = mixHex(H.m, S.m, 0.42); rect(4, -1, 8, 1, b); rect(3, 0, 10, 1, b); rect(2, 1, 12, 2, b); for (let x = 3; x <= 12; x++) if (x % 2) set(x, 1, mixHex(H.m, S.m, 0.2)); set(2, 3, b); set(13, 3, b); break; }
      case 'bob': capF('##########'); for (let x = 3; x <= 12; x++) set(x, 4, x % 3 === 0 ? H.d : H.m); rect(1, 3, 2, 8, H.m); rect(13, 3, 2, 8, H.d); rect(1, 10, 2, 1, H.d); break;
      case 'spiky': capF('#.#.#..#.#'); if (!hatOn) spikesTop(); break;
      case 'afro': curlsE(8, 0, 6.5, 3.6); for (let x = 3; x <= 12; x++) if (x % 2 === 0) set(x, 3, H.m); break;
      case 'pigtails': capF('##.####.##'); set(7, -1, H.d); set(7, 0, H.d); rect(0, 4, 2, 7, H.m); set(0, 4, H.l); set(1, 10, H.d); rect(14, 4, 2, 7, H.d); set(14, 4, H.m); set(2, 4, C2.m); set(13, 4, C2.m); set(2, 5, C2.d); set(13, 5, C2.d); break;
      case 'swept': capF('##########'); rect(2, 5, 5, 1, H.m); set(2, 6, H.m); set(3, 6, H.d); set(7, 4, H.d); break;
    }
  } else if (d === 2) {
    switch (style) {
      case 'short': capS(true); break;
      case 'long': capS(true); rect(2, 4, 5, 10, H.m); set(3, 8, H.l); set(2, 13, H.d); break;
      case 'bun': capS(true); if (!hatOn) { rect(0, -2, 4, 3, H.m); set(1, -2, H.h); set(3, 1, C2.m); } break;
      case 'ponytail': capS(false); break;
      case 'curly': curlsE(7.5, 1, 6, 3.6); curls(1, 4, 7, 9); break;
      case 'braids': capS(true); set(3, 8, H.d); break;
      case 'buzz': { const b = mixHex(H.m, S.m, 0.42); rect(4, -1, 7, 1, b); rect(3, 0, 9, 1, b); rect(2, 1, 11, 2, b); rect(2, 3, 4, 5, b); break; }
      case 'bob': capS(true); rect(2, 4, 5, 7, H.m); set(11, 5, H.m); set(12, 5, H.d); rect(2, 10, 5, 1, H.d); break;
      case 'spiky': capS(true); if (!hatOn) for (const [x, t] of [[3, -1], [4, -2], [6, -3], [8, -2], [10, -3], [12, -1]]) for (let y = t; y <= 0; y++) set(x, y, y === t ? H.l : H.m); break;
      case 'afro': curlsE(7, 0, 5.5, 3.6); break;
      case 'pigtails': capS(true); break;
      case 'swept': capS(true); rect(10, 4, 4, 1, H.m); set(13, 5, H.d); break;
    }
  } else {
    switch (style) {
      case 'short': capB(8); break;
      case 'long': capB(8); rect(2, 8, 12, 7, H.m); for (let x = 2; x <= 13; x++) set(x, 14 + (x % 2), H.d); set(5, 10, H.d); set(10, 11, H.d); break;
      case 'bun': capB(8); if (!hatOn) bun(-3); break;
      case 'ponytail': capB(8); rect(7, 8, 2, 7, H.m); set(7, 8, C2.m); set(8, 8, C2.m); set(8, 14, H.d); set(7, 10, H.l); break;
      case 'curly': curlsE(8, 4, 7, 6.5); break;
      case 'braids': capB(8); set(7, 0, H.d); set(7, 1, H.d); for (let y = 9; y <= 16; y++) { set(4, y, y % 2 ? H.m : H.d); set(5, y, y % 2 ? H.d : H.m); set(10, y, y % 2 ? H.m : H.d); set(11, y, y % 2 ? H.d : H.m); } rect(4, 17, 2, 1, C2.m); rect(10, 17, 2, 1, C2.m); break;
      case 'buzz': { const b = mixHex(H.m, S.m, 0.42); rect(4, -1, 8, 1, b); rect(3, 0, 10, 1, b); rect(2, 1, 12, 7, b); break; }
      case 'bob': capB(8); rect(1, 4, 14, 7, H.m); rect(1, 10, 14, 1, H.d); for (let y = 4; y <= 9; y++) { set(1, y, H.l); set(14, y, H.d); } break;
      case 'spiky': capB(8); if (!hatOn) spikesTop(); break;
      case 'afro': curlsE(8, 3, 8, 7); break;
      case 'pigtails': capB(8); rect(0, 4, 2, 7, H.m); rect(14, 4, 2, 7, H.d); set(2, 4, C2.m); set(13, 4, C2.m); break;
      case 'swept': capB(8); break;
    }
  }
}

function drawHat(set, rect, d, hat, C2) {
  if (hat === 'none') return;
  const straw = tone('#e2c262', 0.22, 0.16);
  switch (hat) {
    case 'cap':
      rect(2, -1, 12, 4, C2.m); rect(4, -2, 8, 1, C2.m);
      for (let x = 4; x <= 9; x++) set(x, -1, C2.l);
      set(5, -1, C2.h); for (let y = -1; y <= 2; y++) set(13, y, C2.d);
      set(7, -2, C2.d); set(8, -2, C2.d);
      if (d === 0) { rect(1, 3, 14, 1, C2.dd); rect(2, 2, 12, 1, C2.d); }
      else if (d === 2) { rect(12, 2, 4, 2, C2.d); rect(12, 3, 4, 1, C2.dd); }
      else { rect(2, 3, 12, 1, C2.d); set(7, 2, C2.dd); set(8, 2, C2.dd); }
      break;
    case 'straw':
      rect(4, -3, 8, 4, straw.m); rect(5, -3, 6, 1, straw.l);
      rect(4, 0, 8, 1, C2.m); set(5, 0, C2.l);
      rect(1, 1, 14, 1, straw.m); rect(2, 2, 12, 1, straw.d);
      for (let x = 2; x <= 13; x += 3) set(x, 1, straw.l);
      for (let x = 5; x <= 10; x += 2) set(x, -2, straw.d);
      if (d !== 3) { set(11, -1, '#f4f0f4'); set(12, -1, '#f08aa8'); }
      break;
    case 'beanie':
      rect(2, -2, 12, 4, C2.m); rect(4, -3, 8, 1, C2.m);
      for (let x = 2; x <= 13; x++) { set(x, 2, x % 2 ? C2.d : C2.m); set(x, 3, x % 2 ? C2.dd : C2.d); }
      for (let x = 4; x <= 9; x++) set(x, -2, C2.l);
      for (let y = -2; y <= 1; y++) set(13, y, C2.d);
      set(7, -4, '#f4f0e6'); set(8, -4, '#f4f0e6'); set(6, -3, '#f4f0e6'); set(9, -3, '#d8d0c0'); set(7, -3, '#ffffff'); set(8, -3, '#e8e0d4');
      break;
    case 'bucket':
      rect(3, -2, 10, 3, C2.m); rect(4, -3, 8, 1, C2.m); for (let x = 4; x <= 9; x++) set(x, -2, C2.l);
      rect(2, 1, 12, 1, C2.d); rect(1, 2, 14, 1, C2.dd); set(4, 0, C2.dd); set(11, 0, C2.dd);
      break;
    case 'flowers': {
      const cols = ['#f4f0f4', '#f08aa8', '#f6dc4a', C2.l];
      for (let x = 2; x <= 13; x++) {
        set(x, 1, x % 2 ? '#4f9a40' : '#3e7a34');
        if (x % 2 === 0) { set(x, 0, cols[(x / 2) % cols.length]); set(x, 1, cols[(x / 2 + 1) % cols.length]); }
      }
      break;
    }
    case 'fieldhat':
      rect(3, -3, 10, 4, C2.m); rect(4, -3, 8, 1, C2.l); rect(3, 0, 10, 1, C2.dd);
      rect(1, 1, 14, 1, C2.m); rect(1, 2, 14, 1, C2.d); set(1, 1, C2.d); set(14, 1, C2.d);
      set(12, -2, C2.d); set(12, -1, C2.d);
      break;
    case 'headband':
      rect(2, 2, 12, 1, C2.m); set(2, 2, C2.l); set(13, 2, C2.d);
      if (d === 0) { set(14, 3, C2.d); set(14, 4, C2.m); }
      else if (d === 2) { set(1, 2, C2.d); set(1, 3, C2.m); set(0, 4, C2.d); }
      else { set(7, 3, C2.d); set(8, 3, C2.d); set(7, 4, C2.m); set(8, 5, C2.d); }
      break;
  }
}

// ---------------------------------------------------------------- animals
function genSheep(frame) {
  const px = new Pix(20, 16);
  const wool = '#f4f2ee', woolD = '#d8d4cc', face = '#4a4a50';
  const lg = frame ? 1 : 0;
  for (const [x, top] of [[5, 0], [8, lg], [12, 0], [15, lg]]) px.rect(x, 11 + top, 2, 4 - top, face);
  for (const [x, y, r] of [[6, 8, 4], [10, 6, 4.5], [14, 8, 4], [9, 10, 4], [13, 10, 3.5], [5, 10, 3]]) px.disc(x, y, r, wool);
  for (const [x, y] of [[4, 11], [8, 12], [12, 12], [15, 11], [10, 4], [6, 6]]) px.set(x, y, woolD);
  px.ellipse(17, 7, 2.6, 3.2, face);
  px.set(18, 6, '#f4f4f4'); px.set(18, 7, '#1a1a1a');
  px.rect(15, 4, 2, 1, face);
  px.disc(15, 5, 2, wool);
  shadeOutline(px, '#2a2a30', 0.55);
  return px;
}

function genHorse(frame) {
  const px = new Pix(34, 28);
  const b = '#8a5a34', bD = '#6a4226', bL = '#a8744a', mane = '#3a2418';
  px.ellipse(15, 13, 10, 6, b);
  px.ellipse(14, 11, 8, 3, bL);
  px.hline(8, 22, 18, bD);
  const lift = frame ? 1 : 0;
  for (const [x, l] of [[7, 0], [10, lift], [19, lift], [22, 0]]) { px.rect(x, 17 + l, 3, 8 - l, bD); px.rect(x, 24, 3, 2, '#2a1a10'); }
  // neck & head
  px.poly([[22, 12], [27, 3], [30, 4], [27, 14]], b);
  px.ellipse(29, 5, 3.5, 2.6, b);
  px.ellipse(31, 7, 2.5, 2, bD);
  px.set(29, 4, '#1a1a1a');
  px.vline(30, 3, 6, '#f4f0e6');
  px.rect(27, 1, 2, 2, b);
  // mane & tail
  px.line(26, 2, 21, 11, mane); px.line(25, 3, 21, 10, mane); px.line(27, 2, 22, 11, mane);
  px.thick(5, 10, 2, 20, 2, mane); px.line(4, 12, 1, 21, mane);
  shadeOutline(px, '#24160e', 0.6);
  return px;
}

function genChicken(frame, brown) {
  const px = new Pix(14, 14);
  const body = brown ? '#b8763a' : '#f4f2ee', bodyD = brown ? '#8a5428' : '#d8d4cc';
  const peck = frame === 2;
  px.ellipse(6, 8, 4.5, 3.5, body);
  px.ellipse(5, 9, 3, 1.5, bodyD);
  px.poly([[1, 5], [3, 8], [1, 9]], bodyD);
  px.vline(6, 11, 13, '#e8b030'); px.vline(8, 11, 13, '#e8b030');
  if (frame === 1) px.set(7, 13, '#e8b030');
  const hx = peck ? 11 : 10, hy = peck ? 9 : 4;
  px.disc(hx, hy, 2.2, body);
  px.rect(hx - 1, hy - 3, 2, 1, '#d83a2a'); px.set(hx, hy - 3, '#e84a3a');
  px.set(hx + 2, hy, '#e8a020'); px.set(hx + 3, hy, '#e8a020');
  px.set(hx + 1, hy + 2, '#d83a2a');
  px.set(hx, hy - 1, '#1a1a1a');
  if (!peck) px.ellipse(9, 6, 2, 2, body);
  shadeOutline(px, '#3a2a1a', 0.55);
  return px;
}

// ---------------------------------------------------------------- portraits (32x32)
function genPortrait(o) {
  const px = new Pix(32, 32);
  const S = tone(o.skin, 0.13, 0.08), H = tone(o.hair, 0.26, 0.2), T = tone(o.shirt, 0.2, 0.14), C2 = tone(o.hatCol || o.shirt, 0.24, 0.18);
  const U = tone(o.under || '#efe8d6', 0.14, 0.08);
  const style = o.style || 'short', hat = o.hat || 'none', face = o.face || 'none', top = o.top || 'tee';
  const eye = o.eyes || '#3a2a20', eyewear = o.eyewear || 'none', acc = o.acc || 'none', shape = o.eyeshape || 'round';
  const curl = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if ((x + 0.5 - cx) ** 2 / (rx * rx) + (y + 0.5 - cy) ** 2 / (ry * ry) > 1) continue;
      const v = ((x >> 1) * 5 + (y >> 1) * 3) % 4;
      px.set(x, y, !(x & 1) && !(y & 1) ? (v === 0 ? H.l : H.m) : (x & 1) && (y & 1) ? H.d : H.m);
    }
  };
  // hair behind the head
  if (style === 'long') { px.ellipse(16, 16, 13, 12, H.d); px.rect(3, 16, 26, 14, H.d); }
  if (style === 'bob') px.ellipse(16, 16, 13, 10, H.d);
  if (style === 'curly') curl(16, 14, 15, 12);
  if (style === 'afro') curl(16, 12, 16, 12);
  if (style === 'ponytail') { px.ellipse(28, 19, 3, 7, H.d); px.rect(25, 9, 3, 3, C2.m); }
  if (style === 'pigtails') { px.ellipse(3, 18, 3, 7, H.m); px.ellipse(29, 18, 3, 7, H.d); px.disc(5, 11, 1.6, C2.m); px.disc(27, 11, 1.6, C2.m); }
  if (style === 'braids') { for (let y = 12; y < 30; y++) { px.set(4, y, y % 2 ? H.m : H.d); px.set(5, y, y % 2 ? H.d : H.m); px.set(26, y, y % 2 ? H.m : H.d); px.set(27, y, y % 2 ? H.d : H.m); } }
  if (style === 'bun' && hat === 'none') { px.disc(16, 3, 4.5, H.m); px.disc(15, 2, 2, H.l); px.hline(13, 19, 6, C2.m); }
  // shoulders and clothes
  const layered = top === 'vest' || top === 'jacket' || top === 'fieldvest' || top === 'cardigan';
  px.ellipse(16, 34, 13, 9, layered ? U.m : T.m);
  if (layered) { px.ellipse(7, 34, 7, 9, T.m); px.ellipse(25, 34, 7, 9, T.m); px.line(13, 26, 15, 31, T.d); px.line(19, 26, 17, 31, T.d); }
  else px.ellipse(16, 33, 9, 5, T.l);
  if (top === 'fieldvest') { px.rect(6, 28, 4, 3, T.d); px.rect(22, 28, 4, 3, T.d); }
  if (top === 'flannel') for (let y = 25; y < 32; y++) for (let x = 3; x < 29; x++) { if (!px.op(x, y)) continue; if (x % 4 === 0 || y % 4 === 0) px.set(x, y, T.d); }
  if (top === 'hoodie') { px.ellipse(16, 26, 10, 3, T.d); px.vline(13, 27, 31, U.m); px.vline(19, 27, 31, U.m); }
  if (top === 'sweater' || top === 'cardigan') px.ellipse(16, 26, 5, 2, T.d);
  if (top === 'raincoat') { px.ellipse(16, 26, 7, 2.5, T.l); px.vline(16, 27, 31, T.d); px.set(17, 28, '#3a3a40'); px.set(17, 30, '#3a3a40'); }
  if (top === 'overalls') { px.rect(10, 27, 12, 5, o.pants); px.rect(10, 25, 2, 3, o.pants); px.rect(20, 25, 2, 3, o.pants); px.set(11, 27, '#f2d24a'); px.set(20, 27, '#f2d24a'); }
  if (o.apron) { px.rect(10, 27, 12, 5, o.apron); px.hline(10, 21, 27, lighten(o.apron, 0.2)); }
  if (acc === 'neckerchief') { px.poly([[11, 25], [21, 25], [16, 30]], '#d8342a'); px.line(12, 25, 16, 29, '#f05a4a'); }
  px.rect(14, 23, 4, 3, S.d);
  // head: big and round
  px.ellipse(16, 15, 11, 10.5, S.m);
  px.ellipse(16, 18, 9, 7, S.m);
  px.ellipse(5.5, 16, 1.6, 2.4, S.d); px.ellipse(26.5, 16, 1.6, 2.4, S.d);
  for (let y = 5; y < 27; y++) for (let x = 21; x < 28; x++) if (px.get(x, y) === C(S.m) && (x - 16) ** 2 / 121 + (y - 15) ** 2 / 110 > 0.6) px.set(x, y, S.d);
  px.set(9, 9, S.l); px.set(10, 8, S.l); px.set(9, 10, S.l);
  // eyes
  const dark = '#2a1e1a', irisD = darken(eye, 0.25);
  for (const ex of [10, 19]) {
    if (shape === 'happy') { px.line(ex - 1, 17, ex + 1, 15, dark); px.line(ex + 1, 15, ex + 3, 17, dark); px.set(ex + 1, 15, dark); continue; }
    if (shape === 'sleepy') { px.hline(ex, ex + 2, 16, dark); px.hline(ex, ex + 2, 17, eye); px.set(ex + 2, 17, irisD); continue; }
    px.hline(ex, ex + 2, 14, dark);
    px.rect(ex, 15, 3, 3, eye); px.rect(ex, 17, 3, 1, irisD);
    px.set(ex, 15, '#ffffff'); px.set(ex + 1, 15, '#ffffff'); px.set(ex, 16, '#ffffff');
    px.set(ex + 2, 17, '#ffffff');
    if (shape === 'lashes') { px.set(ex === 10 ? ex - 1 : ex + 3, 14, dark); px.set(ex === 10 ? ex - 2 : ex + 4, 13, dark); }
  }
  // cheeks, nose, mouth
  const blush = mixHex(o.skin, '#ff7a8a', face === 'rosy' ? 0.55 : 0.35);
  if (face === 'freckles') { const f = mixHex(o.skin, '#8a4a2a', 0.42); for (const [x, y] of [[8, 19], [10, 20], [9, 21], [22, 19], [24, 20], [23, 21]]) px.set(x, y, f); px.hline(8, 10, 19, blush); px.hline(22, 24, 19, blush); }
  else { px.ellipse(9, 20, 2.2, 1.2, blush); px.ellipse(23, 20, 2.2, 1.2, blush); }
  px.set(16, 19, S.d);
  px.hline(15, 17, 22, '#9a4a42'); px.set(14, 21, '#9a4a42'); px.set(18, 21, '#9a4a42');
  if (face === 'wrinkles') { px.set(7, 17, S.d); px.set(25, 17, S.d); px.set(13, 22, S.d); px.set(19, 22, S.d); }
  if (face === 'beard') { px.ellipse(16, 23, 8, 4.5, H.m); px.hline(14, 18, 22, '#7a3a34'); px.rect(12, 20, 8, 1, H.m); px.ellipse(16, 25.5, 4, 2, H.d); px.set(12, 22, H.l); }
  if (face === 'moustache') { px.rect(12, 20, 8, 1, H.m); px.set(11, 21, H.m); px.set(20, 21, H.m); px.hline(15, 17, 22, '#9a4a42'); }
  if (face === 'stubble') for (let y = 20; y < 26; y++) for (let x = 8; x < 25; x++) if ((x + y) % 2 === 0 && px.op(x, y) && (x - 16) ** 2 + (y - 18) ** 2 > 10) px.set(x, y, mixHex(o.skin, o.hair, 0.3));
  // hair in front
  const base = (bangs) => {
    px.ellipse(16, 7, 11.5, 5.5, H.m);
    if (bangs) { px.rect(5, 7, 3, 8, H.m); px.rect(24, 7, 3, 8, H.d); px.poly([[7, 9], [25, 9], [24, 13], [20, 11], [16, 13], [12, 11], [8, 13]], H.m); }
    px.hline(10, 18, 3, H.l); px.hline(11, 14, 4, H.h); px.set(13, 7, H.d); px.set(20, 8, H.d); px.set(16, 6, H.d);
  };
  switch (style) {
    case 'short': base(true); break;
    case 'long': base(true); px.rect(4, 12, 3, 15, H.m); px.rect(25, 12, 3, 15, H.m); px.vline(5, 14, 24, H.l); break;
    case 'bun': base(true); break;
    case 'ponytail': px.ellipse(16, 6, 11, 4.5, H.m); px.rect(5, 6, 2, 7, H.m); px.rect(25, 6, 2, 7, H.d); px.hline(11, 19, 3, H.l); break;
    case 'curly': curl(16, 6, 12, 5.5); curl(5, 13, 2.6, 6); curl(27, 13, 2.6, 6); break;
    case 'braids': base(true); px.vline(16, 2, 8, H.d); break;
    case 'buzz': px.ellipse(16, 8, 11, 5.5, mixHex(H.m, S.m, 0.45)); for (let x = 8; x < 25; x += 2) px.set(x, 6, mixHex(H.m, S.m, 0.2)); break;
    case 'bob': base(true); px.rect(7, 7, 18, 5, H.m); px.hline(7, 24, 11, H.d); px.rect(4, 7, 4, 15, H.m); px.rect(24, 7, 4, 15, H.d); px.hline(4, 7, 21, H.d); break;
    case 'spiky': base(true); if (hat === 'none') for (const [x, h] of [[8, 4], [12, 6], [17, 6], [22, 5], [25, 3]]) px.poly([[x - 2, 5], [x + 2, 5], [x, 5 - h]], H.m); break;
    case 'afro': curl(16, 6, 12, 4.5); break;
    case 'pigtails': base(true); px.vline(16, 2, 7, H.d); break;
    case 'swept': base(true); px.poly([[6, 7], [20, 6], [12, 14], [6, 15]], H.m); px.line(8, 13, 17, 7, H.d); break;
  }
  // hats
  const straw = tone('#e2c262', 0.22, 0.16);
  switch (hat) {
    case 'cap': px.ellipse(16, 6, 12, 5, C2.m); px.hline(9, 20, 2, C2.l); px.rect(4, 8, 24, 2, C2.d); px.hline(3, 28, 10, C2.dd); break;
    case 'straw': px.ellipse(16, 7, 15, 3, straw.m); px.ellipse(16, 4, 8, 4, straw.l); px.hline(8, 24, 6, C2.m); px.hline(2, 30, 8, straw.d); px.disc(23, 5, 1.6, '#f08aa8'); break;
    case 'beanie': px.ellipse(16, 6, 12, 6, C2.m); px.rect(4, 8, 24, 3, C2.d); for (let x = 4; x < 28; x += 2) px.vline(x, 8, 10, C2.dd); px.disc(16, 1, 2.6, '#f4f0e6'); break;
    case 'bucket': px.ellipse(16, 5, 9, 4.5, C2.m); px.ellipse(16, 9, 13, 2.5, C2.d); px.hline(8, 24, 6, C2.dd); break;
    case 'flowers': for (let i = 0; i < 10; i++) { const x = 6 + i * 2.2, y = 6 + Math.round(Math.abs(i - 4.5) * 0.45); px.disc(x, y, 1.7, ['#f4f0f4', '#f08aa8', '#f6dc4a', C2.l][i % 4]); if (i % 2) px.set(Math.round(x), y + 2, '#3e7a34'); } break;
    case 'fieldhat': px.rect(8, 0, 16, 7, C2.m); px.hline(9, 22, 0, C2.l); px.hline(8, 23, 5, C2.dd); px.ellipse(16, 8, 15, 2.5, C2.d); break;
    case 'headband': px.rect(5, 8, 22, 2, C2.m); px.hline(5, 26, 8, C2.l); break;
  }
  // eyewear
  if (eyewear === 'glasses') { for (const x of [8, 18]) { px.frame(x, 13, 7, 6, '#6a6a7a'); px.set(x + 1, 14, '#e0f0fa'); } px.hline(15, 17, 15, '#6a6a7a'); }
  if (eyewear === 'square') { for (const x of [8, 18]) { px.frame(x, 13, 7, 6, '#24242c'); px.frame(x + 1, 14, 5, 4, '#24242c'); } px.hline(15, 17, 15, '#24242c'); }
  if (eyewear === 'sunglasses') { for (const x of [8, 18]) { px.rect(x, 13, 7, 5, '#1c1c26'); px.set(x + 1, 14, '#6a7aa0'); px.set(x + 2, 14, '#6a7aa0'); } px.hline(15, 17, 14, '#1c1c26'); }
  // accessories
  if (acc === 'scarf') { px.ellipse(16, 26, 10, 2.8, C2.m); px.hline(7, 25, 27, C2.d); px.rect(19, 27, 3, 5, C2.m); }
  if (acc === 'binoculars') { px.line(9, 25, 13, 30, '#2a2a30'); px.line(23, 25, 19, 30, '#2a2a30'); px.rect(12, 28, 8, 4, '#2a2a30'); px.set(13, 29, '#7a9ab8'); px.set(18, 29, '#7a9ab8'); }
  if (acc === 'camera') { px.line(9, 25, 12, 29, '#2a2a30'); px.line(23, 25, 20, 29, '#2a2a30'); px.rect(11, 28, 10, 4, '#3a3a44'); px.disc(16, 30, 1.8, '#7a9ab8'); px.set(19, 28, '#e8485a'); }
  if (acc === 'backpack') { px.vline(8, 25, 31, '#5a3e26'); px.vline(24, 25, 31, '#5a3e26'); px.vline(9, 25, 31, '#7a5a3a'); px.vline(23, 25, 31, '#7a5a3a'); }
  if (acc === 'satchel') px.line(8, 25, 22, 31, '#6a4428');
  shadeOutline(px, '#2a1c18', 0.62);
  return px;
}
