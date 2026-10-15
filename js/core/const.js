'use strict';
// World-wide constants and enums.

const GAME_VERSION = 1;
const TS = 16;               // tile size in pixels
const MAP_W = 96, MAP_H = 72;

// Terrain types
const T = {
  GRASS: 0, FOREST: 1, PATH: 2, SOIL: 3, SAND: 4, GRAVEL: 5, MUD: 6,
  SHALLOW: 7, WATER: 8, ROCK: 9, CLIFF: 10, MARSH: 11, BRIDGE: 12, CLAY: 13,
};

// pri = blending priority (higher draws its fringe over lower neighbours)
const TINFO = [];
TINFO[T.GRASS]   = { name: 'Grass',        solid: false, speed: 1.0,  pri: 11, land: true };
TINFO[T.FOREST]  = { name: 'Forest floor', solid: false, speed: 1.0,  pri: 10, land: true };
TINFO[T.PATH]    = { name: 'Path',         solid: false, speed: 1.08, pri: 12, land: true };
TINFO[T.SOIL]    = { name: 'Soil',         solid: false, speed: 1.0,  pri: 6,  land: true };
TINFO[T.SAND]    = { name: 'Sand',         solid: false, speed: 0.9,  pri: 4,  land: true };
TINFO[T.GRAVEL]  = { name: 'Gravel',       solid: false, speed: 0.95, pri: 5,  land: true };
TINFO[T.MUD]     = { name: 'Mud',          solid: false, speed: 0.75, pri: 2,  land: true };
TINFO[T.SHALLOW] = { name: 'Shallows',     solid: false, speed: 0.55, pri: 1,  water: true };
TINFO[T.WATER]   = { name: 'Water',        solid: true,  speed: 0,    pri: 0,  water: true };
TINFO[T.ROCK]    = { name: 'Rock',         solid: false, speed: 1.0,  pri: 8,  land: true };
TINFO[T.CLIFF]   = { name: 'Cliff',        solid: true,  speed: 0,    pri: 13 };
TINFO[T.MARSH]   = { name: 'Marsh',        solid: false, speed: 0.85, pri: 9,  land: true, wet: true };
TINFO[T.BRIDGE]  = { name: 'Bridge',       solid: false, speed: 1.08, pri: 14 };
TINFO[T.CLAY]    = { name: 'Clay bank',    solid: false, speed: 0.9,  pri: 3,  land: true };

const isWaterT = (t) => t === T.WATER || t === T.SHALLOW;

// Time
const DAY_START = 360;          // 6:00
const DAY_END = 1560;           // 2:00 (next morning) – everyone passes out
const MS_PER_MIN = 500;         // real ms per game minute (≈10 real minutes per day)
const DAYS_PER_SEASON = 7;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const SPRING = 0, SUMMER = 1, AUTUMN = 2, WINTER = 3;

// Directions: 0 down, 1 left, 2 right, 3 up
const DIR_VEC = [[0, 1], [-1, 0], [1, 0], [0, -1]];

const PLAYER_SPEED = 84;        // px per second
const BAG_SIZE = 24, HOTBAR = 8;
const STACK_MAX = 99;
const MAX_PLAYERS = 6;

// Player look options. Saves store indices into these lists, so only ever append to them.
const HAIR_COLORS = ['#3b2418', '#6b3e1f', '#b5651d', '#e0b04a', '#d9d4c7', '#24242c', '#a33b2b', '#4a6fb5',
  '#f2dc96', '#8a5a36', '#d8752e', '#e47aa6', '#4f9a6c', '#8a5ab4'];
const SHIRT_COLORS = ['#3f7fbf', '#c0463c', '#4a9a4f', '#e0a43c', '#8a54b0', '#e07aa8', '#3fa8a0', '#efe6d0',
  '#2f3e62', '#6f7d3c', '#b0602c', '#8a929c', '#34343c', '#f0d050', '#9c3a5a', '#7ab8e0'];
const SKIN_COLORS = ['#f6d0b1', '#e8b48f', '#c98d63', '#9a6142', '#6b4130', '#fde4cf', '#dba57e', '#b3774f', '#4c2d20'];
const EYE_COLORS = ['#3a2a20', '#6a4628', '#3a6ab0', '#3f8a4a', '#6a7a8c', '#8a6a2a'];
const PANTS_COLORS = ['#465a7e', '#3a3a44', '#6a5240', '#6a7a4c', '#c8b48a', '#2f3a5a', '#8a3a3a', '#e8e0cc'];
const SHOE_COLORS = ['#5a3a22', '#2a2a30', '#a8342c', '#e8e4dc', '#3a6a3a', '#d8a830'];
const HAIR_STYLES = ['short', 'long', 'bun', 'ponytail', 'curly', 'braids', 'buzz', 'bob', 'spiky', 'afro', 'pigtails', 'swept'];
const TOP_STYLES = ['tee', 'sweater', 'flannel', 'hoodie', 'vest', 'dress', 'overalls', 'jacket', 'raincoat', 'cardigan'];
const BOTTOM_STYLES = ['trousers', 'shorts', 'skirt'];
const HAT_STYLES = ['none', 'cap', 'straw', 'beanie', 'bucket', 'flowers', 'fieldhat', 'headband'];
const EYEWEAR = ['none', 'glasses', 'square', 'sunglasses'];
const ACCESSORIES = ['none', 'binoculars', 'scarf', 'backpack', 'satchel', 'camera'];
const EYE_SHAPES = ['round', 'happy', 'lashes', 'sleepy'];
const FACE_EXTRAS = ['none', 'freckles', 'rosy', 'beard', 'moustache', 'stubble'];
const LOOK_LABELS = {
  short: 'Short', long: 'Long', bun: 'Bun', ponytail: 'Ponytail', curly: 'Curly', braids: 'Braids', buzz: 'Buzz cut',
  bob: 'Bob', spiky: 'Spiky', afro: 'Afro', pigtails: 'Pigtails', swept: 'Side-swept',
  tee: 'T-shirt', sweater: 'Jumper', flannel: 'Check shirt', hoodie: 'Hoodie', vest: 'Waistcoat', dress: 'Dress',
  overalls: 'Dungarees', jacket: 'Jacket', raincoat: 'Raincoat', cardigan: 'Cardigan', trousers: 'Trousers', shorts: 'Shorts', skirt: 'Skirt',
  none: 'None', cap: 'Cap', straw: 'Straw hat', beanie: 'Beanie', bucket: 'Bucket hat', flowers: 'Flower crown',
  fieldhat: 'Field hat', headband: 'Headband', glasses: 'Round glasses', square: 'Square glasses', sunglasses: 'Sunglasses',
  binoculars: 'Binoculars', scarf: 'Scarf', backpack: 'Backpack', satchel: 'Satchel', camera: 'Camera',
  round: 'Bright', happy: 'Happy', lashes: 'Lashes', sleepy: 'Dreamy',
  freckles: 'Freckles', rosy: 'Rosy cheeks', beard: 'Beard', moustache: 'Moustache', stubble: 'Stubble',
};
// The order colour swatches are offered in (light to dark, or by hue)
const SKIN_ORDER = [5, 0, 1, 6, 2, 7, 3, 4, 8];
const HAIR_ORDER = [5, 0, 1, 9, 2, 10, 6, 3, 8, 4, 11, 13, 7, 12];
const SHIRT_ORDER = [7, 13, 3, 10, 1, 14, 5, 4, 0, 15, 6, 2, 9, 8, 11, 12];

// Looks are stored as indices into the option lists above. Version-1 looks only had
// hair, shirt, skin and style, where style 3 was "Cap": that becomes short hair plus a cap.
function cleanLook(l) {
  l = l || {};
  const idx = (v, n) => clamp((v | 0), 0, n - 1);
  const legacyCap = !l.v && (l.style | 0) === 3;
  return {
    v: 2,
    skin: idx(l.skin, SKIN_COLORS.length), hair: idx(l.hair, HAIR_COLORS.length),
    style: legacyCap ? 0 : idx(l.style, HAIR_STYLES.length), eyes: idx(l.eyes, EYE_COLORS.length),
    top: idx(l.top, TOP_STYLES.length), shirt: idx(l.shirt, SHIRT_COLORS.length),
    bottom: idx(l.bottom, BOTTOM_STYLES.length), pants: idx(l.pants, PANTS_COLORS.length), shoes: idx(l.shoes, SHOE_COLORS.length),
    hat: legacyCap ? 1 : idx(l.hat, HAT_STYLES.length), hatc: idx(legacyCap ? l.shirt : l.hatc, SHIRT_COLORS.length),
    eyewear: idx(l.eyewear, EYEWEAR.length), acc: idx(l.acc, ACCESSORIES.length), face: idx(l.face, FACE_EXTRAS.length),
    eyeshape: idx(l.eyeshape, EYE_SHAPES.length),
  };
}
function lookKey(l) {
  return [l.skin, l.hair, l.style, l.eyes, l.top, l.shirt, l.bottom, l.pants, l.shoes, l.hat, l.hatc, l.eyewear, l.acc, l.face, l.eyeshape].join('.');
}

