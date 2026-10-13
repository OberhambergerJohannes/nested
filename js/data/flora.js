'use strict';
// Trees, shrubs and small plants. grow[i] = days needed at stage i to reach stage i+1 (max stage 2).

const FLORA = {
  oak:    { type: 'tree', name: 'Oak', grow: [3, 4], decid: true },
  birch:  { type: 'tree', name: 'Birch', grow: [2, 3], decid: true },
  willow: { type: 'tree', name: 'Willow', grow: [2, 3], decid: true },
  pine:   { type: 'tree', name: 'Scots Pine', grow: [3, 4], conifer: true },
  apple:  { type: 'tree', name: 'Apple Tree', grow: [2, 3], decid: true, fruit: { item: 'apple', seasons: [AUTUMN] } },
  snag:   { type: 'tree', name: 'Dead Tree', dead: true },

  hawthorn:   { type: 'shrub', name: 'Hawthorn', thorny: true, grow: [2, 2] },
  blackthorn: { type: 'shrub', name: 'Blackthorn', thorny: true, grow: [2, 2], fruit: { item: 'sloe', seasons: [AUTUMN] } },
  bramble:    { type: 'shrub', name: 'Bramble', thorny: true, grow: [1, 2], fruit: { item: 'blackberry', seasons: [SUMMER, AUTUMN] } },
  elder:      { type: 'shrub', name: 'Elder', grow: [2, 2], fruit: { item: 'elderberry', seasons: [SUMMER] } },
  hazel:      { type: 'shrub', name: 'Hazel', grow: [2, 2], fruit: { item: 'hazelnut', seasons: [AUTUMN] } },

  wildflower: { type: 'plant', name: 'Wildflowers', grow: [1, 1], flower: true },
  thistle:    { type: 'plant', name: 'Thistle', grow: [1, 2], flower: true,
                harvest: { mat: 'thistledown', n: 2, seasons: [SUMMER, AUTUMN] } },
  herbs:      { type: 'plant', name: 'Herb Patch', grow: [1, 1], flower: true,
                harvest: { mat: 'herbs', n: 1, seasons: [SPRING, SUMMER, AUTUMN] } },
  reed:       { type: 'plant', name: 'Reeds', grow: [1, 2], wet: true,
                harvest: { mat: 'reedplume', n: 1, seasons: [SUMMER, AUTUMN, WINTER] } },
  cattail:    { type: 'plant', name: 'Cattails', grow: [1, 2], wet: true,
                harvest: { mat: 'fluff', n: 2, seasons: [AUTUMN, WINTER] } },
};

// Structures that players place. site: which nest-site type they provide.
const STRUCTS = {
  box_small:  { name: 'Nest Box (25 mm)', site: 'box_small' },
  box_medium: { name: 'Nest Box (28 mm)', site: 'box_medium' },
  box_large:  { name: 'Nest Box (32 mm)', site: 'box_large' },
  box_open:   { name: 'Open-fronted Box', site: 'box_open' },
  owlbox:     { name: 'Owl Box', site: 'owlbox' },
  platform:   { name: 'Stork Platform', site: 'platform' },
  bank:       { name: 'Earth Bank', site: 'bank', solid: true },
  brushpile:  { name: 'Brush Pile', site: 'brushpile', deadwood: true, solid: true },
  anvil:      { name: 'Anvil Stone' },
  birdbath:   { name: 'Bird Bath', solid: true },
};

// Where nests can go. Used by journal & nest-site panels.
const SITES = {
  shrub:      { label: 'A dense shrub', detail: 'Any fully grown shrub.' },
  thorny:     { label: 'A thorny shrub', detail: 'A fully grown hawthorn, blackthorn or bramble.' },
  tree:       { label: 'A broadleaf tree', detail: 'A fully grown oak, birch, apple or willow.' },
  pine:       { label: 'A pine tree', detail: 'A fully grown pine.' },
  willow:     { label: 'A willow over water', detail: 'A fully grown willow within 2 tiles of water.' },
  snag:       { label: 'A standing dead tree', detail: 'A dead tree — natural, or a crafted Deadwood Trunk.' },
  box_small:  { label: 'Nest box, 25 mm hole', detail: 'Craft it at your workbench.' },
  box_medium: { label: 'Nest box, 28 mm hole', detail: 'Craft it at your workbench.' },
  box_large:  { label: 'Nest box, 32 mm hole', detail: 'Craft it at your workbench.' },
  box_open:   { label: 'Open-fronted nest box', detail: 'Craft it at your workbench.' },
  owlbox:     { label: 'Owl Box', detail: 'Craft it at your workbench.' },
  platform:   { label: 'Stork Platform', detail: 'Craft it at your workbench.' },
  bank:       { label: 'An Earth Bank', detail: 'Craft it at your workbench. Some tunnel-diggers want it at the water\'s edge.' },
  brushpile:  { label: 'Brush pile', detail: 'Craft it at your workbench.' },
  barn:       { label: 'Inside a barn', detail: 'Mabel\'s barn has room for three nests.' },
  eaves:      { label: 'Under house eaves', detail: 'Under the eaves of any house in the village or on the farm.' },
  reeds:      { label: 'A dense reed bed', detail: 'Mature reeds with at least 6 reeds or cattails within 2 tiles.' },
  ground:     { label: 'Long grass by water', detail: 'A tile of long grass or marsh within 3 tiles of water.' },
  field:      { label: 'Long grass in the open', detail: 'A tile of long grass with no trees within 3 tiles.' },
  shingle:    { label: 'Bare gravel by water', detail: 'An empty sand or gravel tile within 2 tiles of water.' },
  clearing:   { label: 'A woodland clearing', detail: 'Bare ground with at least 4 trees within 3 tiles, but none right next to it.' },
  ledge:      { label: 'A rock ledge', detail: 'A rocky tile at the foot of a cliff face, up in the hills.' },
  bridge:     { label: 'Beside a bridge', detail: 'The bank or shallows right next to a bridge over the river.' },
  chimney:    { label: 'A chimney', detail: 'The chimney of a house in the village or on the farm.' },
  parasite:   { label: 'Another bird\'s nest!', detail: 'Builds no nest at all.' },
};
