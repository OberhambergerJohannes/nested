'use strict';
// Village festivals: one each season, on the middle day. The whole village gathers on the green,
// there is one small activity with three ribbons to earn, and a keepsake for a gold ribbon.
// Each festival is modelled on a real event (see README "Design notes"):
//   Dawn Chorus Day — International Dawn Chorus Day (first Sunday in May)
//   Midsummer Fair  — the midsummer fairs and bonfires held all over Europe
//   Migration Watch — BirdLife's EuroBirdwatch (first weekend of October, since 1993)
//   Feeder Day      — garden bird counts like the RSPB's Big Garden Birdwatch (late January, since 1979)

const FEST_DAY = 4;
const FEST_GREEN = [60.5, 33.6];   // the village green (tiles): south of the main road, by the pond
const FEST_ROAD_Y = 30.5;          // villagers walk to the green along the main road

// Where villagers stand at a gathering (tiles, facing). Slot 0 belongs to the festival's host.
const FEST_SLOTS = [
  [60.5, 31.9, 0], [58.3, 32.6, 2], [62.7, 32.6, 1], [57.6, 34.0, 2], [63.4, 34.0, 1],
  [58.6, 35.3, 3], [62.4, 35.3, 3], [60.5, 35.7, 3], [64.4, 32.4, 1],
];
const FEST_ORDER = ['ada', 'rosie', 'edith', 'basil', 'tom', 'finn', 'mabel', 'juniper', 'luna'];
// From each villager's front door to the main road (or straight onto the green)
const FEST_DOOR = {
  ada: [[69.5, 37.5], [66.3, 37.4], [65.6, 34.6]], finn: [[69.5, 37.5], [66.3, 37.4], [65.6, 34.6]],
  basil: [[62.5, 30.5]], tom: [[70.5, 30.5]],
  edith: [[52.5, 30.5], [55.5, 30.6]], rosie: [[52.5, 30.5], [55.5, 30.6]],
  mabel: [[18.5, 28.6], [21.5, 30.0]], juniper: [[36.5, 9.5], [36.5, 30.5]], luna: [[31.5, 30.5]],
};

// Ribbons: what each one brings. A gold ribbon also brings the festival's keepsake (once).
const RIBBONS = ['', 'Bronze', 'Silver', 'Gold'];
const RIBBON_PRIZE = [null, { coins: 40, xp: 25 }, { coins: 60, xp: 35 }, { coins: 100, xp: 50 }];

// Food that villagers can put out for the birds on Feeder Day
const BIRD_FOOD = ['seedmix', 'apple', 'hazelnut', 'blackberry', 'elderberry', 'sloe'];

const FESTIVALS = [
  {
    id: 'dawn', season: SPRING, name: 'Dawn Chorus Day', host: 'ada', icon: 'sun',
    gather: [DAY_START, 9 * 60], from: DAY_START, until: 11 * 60, goal: [3, 5, 7], unit: 'kinds of bird',
    task: 'Watch different birds before 11:00', keep: 'birdtable', decor: ['bunting', 'table'],
    invite: 'Tomorrow is Dawn Chorus Day! Set your alarm: we meet on the village green at 6 o\'clock, when the birds sing loudest.\n\n' +
      'Watch as many different kinds of bird as you can before 11:00. Every kind counts, even the sparrows! Ribbons for 3, 5 and 7 kinds — and a bird table for a gold ribbon.\n\n' +
      'Did you know? Dawn Chorus Day began with a few friends listening to the birds at dawn in Moseley Bog, Birmingham. Now people get up early for it all over the world, on the first Sunday in May.',
    hostLines: [
      'Good morning, and welcome to Dawn Chorus Day! Listen to that…',
      'Birds sing hardest in the first hours after dawn: the air is still, so songs carry far, and it\'s too dark yet to hunt for food.',
      'Let\'s see how many different birds we can watch before 11 o\'clock. Stand still near a bird and press E to watch it — every new kind counts!',
    ],
    lines: [
      'Shh! Was that a wren? Tiny bird, enormous voice.',
      'I brought a flask of tea. Dawn is chilly, even in spring!',
      'Rosie has been up since four. She says she heard an owl!',
      'Most of the singing is males, you know — holding their patch and calling to a mate.',
    ],
    wrap: 'What a morning! Together we watched {n} kinds of bird before 11 o\'clock.',
  },
  {
    id: 'midsummer', season: SUMMER, name: 'Midsummer Fair', host: 'rosie', icon: 'sun',
    gather: [17 * 60, 23 * 60 + 30], from: DAY_START, until: 21 * 60, goal: [4, 7, 10], unit: 'paper birds',
    task: 'Find Rosie\'s paper birds before 9 pm', keep: 'bughotel', decor: ['bunting', 'table', 'bonfire'],
    invite: 'Tomorrow is the Midsummer Fair — the longest day of the year!\n\n' +
      'Rosie has folded twelve paper birds and hidden them all over the valley. Find as many as you can before we light the bonfire on the green at 9 o\'clock. Ribbons for 4, 7 and 10 — and a bug hotel for a gold ribbon.\n\n' +
      'The fair opens on the green at 5. Do come!',
    hostLines: [
      'Happy Midsummer! I hid twelve paper birds ALL over the valley. Gardens, meadows, the farm, by the river…',
      'They\'re white and colourful and they sparkle a tiny bit. Find them before Grandma lights the bonfire at 9!',
      'Swifts are flying really high tonight. Did you know they eat and even sleep on the wing?',
    ],
    lines: [
      'Midsummer is the longest day. The swifts will be screaming over the rooftops until late!',
      'Mind the bonfire. We keep it small, and away from the hedges — hedgehogs sleep in there.',
      'Have you tried Edith\'s elderflower cordial? Best in the valley.',
      'On midsummer nights, half of Europe lights bonfires. Ours is the cosiest, I think.',
    ],
    wrap: 'The bonfire is lit! {n} of Rosie\'s paper birds were found today.',
  },
  {
    id: 'migration', season: AUTUMN, name: 'Migration Watch', host: 'ada', icon: 'binoculars',
    gather: [7 * 60, 12 * 60], from: 7 * 60, until: 13 * 60, goal: [3, 6, 9], unit: 'flocks',
    task: 'Count flocks flying south, 7:00–13:00', keep: 'scope', decor: ['bunting', 'scope'],
    invite: 'Tomorrow is Migration Watch! From 7 in the morning until 1 o\'clock, flocks of migrating birds will pass over the valley on their way south.\n\n' +
      'Stand under a flock and press E to count it. Ribbons for 3, 6 and 9 flocks — and a spotting scope for a gold ribbon.\n\n' +
      'Migrants love to follow a river valley, so most will come down along our river. Did you know? On the first weekend of October, thousands of people all over Europe count migrating birds for EuroBirdwatch. Millions of birds get counted in a single weekend!',
    hostLines: [
      'Welcome to Migration Watch! Look north, along the river — that\'s where the flocks come from.',
      'Rivers and valleys are "leading lines": migrants follow them like roads. Our river funnels them right over the village!',
      'When a flock flies over you, press E to count it. Cranes fly in a V and trumpet; finches and pipits pass in loose little groups, calling as they go.',
    ],
    lines: [
      'Many swallows will cross the Sahara this autumn. Imagine that, from our little valley!',
      'Finn wants to photograph the cranes. Their calls carry for kilometres.',
      'Some birds migrate by day, others by night — warblers and thrushes mostly fly in the dark.',
      'Birds fatten up before they migrate. Some nearly double their weight!',
    ],
    wrap: 'Migration Watch is over: we counted {n} flocks — {b} birds heading south!',
  },
  {
    id: 'feeders', season: WINTER, name: 'Feeder Day', host: 'edith', icon: 'snow',
    gather: [16 * 60 + 30, 20 * 60 + 30], from: DAY_START, until: 16 * 60 + 30, goal: [3, 5, 7], unit: 'feeders filled',
    task: 'Bring bird food to villagers before 4:30 pm', keep: 'lantern', decor: ['bunting', 'table', 'lanterns'],
    invite: 'Tomorrow is Feeder Day! Bring a little bird food to your neighbours — seed mix from Basil\'s shop, apples, nuts or berries. Each of us will fill a feeder and count the birds that come to it.\n\n' +
      'Hand the food over before half past four (just walk up to someone with food in your hands and press F). Ribbons for 3, 5 and 7 feeders filled — and a garden lantern for a gold ribbon.\n\n' +
      'Then come to the lantern evening on the green, where we\'ll add up the count! People have counted their garden birds like this every winter since 1979.',
    hostLines: [
      'Welcome to Feeder Day, dear! Winter is hard for little birds.',
      'A blue tit can lose a tenth of its weight on one cold night, just keeping warm. A full feeder in the morning can save its life.',
      'Bring bird food to the villagers before half past four. Hold it in your hands and press F when you\'re next to them. Then we\'ll count the birds together at the lantern evening!',
    ],
    lines: [
      'Keep feeders clean, and put out fresh water too — birds need to drink and bathe even in winter.',
      'Robins and blackbirds like food on the ground. Tits and finches prefer a hanging feeder.',
      'Mulled apple juice by the lanterns tonight! Don\'t be late.',
      'Count the most of each kind you see at one time — that way no bird gets counted twice.',
    ],
    wrap: 'The count is in! {n} feeders filled, and {b} bird visits counted.',
  },
];
const FESTIVALS_BY_ID = {};
for (const f of FESTIVALS) FESTIVALS_BY_ID[f.id] = f;

// What a villager says when they have filled their feeder (Feeder Day)
const FEEDER_THANKS = {
  ada: 'Splendid! I\'ll hang it outside the Field Station window and keep a proper tally.',
  basil: 'Ha! Selling it AND getting it back. I\'ll put it on the bird table behind the shop.',
  mabel: 'Lovely, dear. The sparrows round the barn will be beside themselves.',
  tom: 'For me? I\'ll fill the old feeder by the jetty. The tits love it there.',
  edith: 'Thank you, dear! Arthur\'s old feeder will be full for the first time in years.',
  rosie: 'YES! I\'m going to count EVERY bird. Even the ones that don\'t sit still!',
  finn: 'Cheers! I\'ll set up a hide by my feeder. Perfect light this afternoon.',
  juniper: 'Thanks. I\'ll hang it at the ranger hut — the nuthatches will find it in minutes.',
  luna: 'You found me awake! I\'ll put it out at dusk and see who comes before the stars do.',
};

// Migrating flocks: name, flock size, formation (v = skein, loose, cloud) and size of each bird
const MIGRANTS = {
  autumn: [
    { name: 'Common Cranes', n: [18, 60], form: 'v', big: true, song: 'crane', v: 1.0 },
    { name: 'Greylag Geese', n: [12, 40], form: 'v', big: true, song: 'goose', v: 1.1 },
    { name: 'Barn Swallows', n: [20, 70], form: 'loose', song: 'swallow', v: 1.5 },
    { name: 'House Martins', n: [15, 50], form: 'loose', song: 'martin', v: 1.4 },
    { name: 'Chaffinches', n: [10, 40], form: 'loose', song: 'chaffinch', v: 1.2 },
    { name: 'Common Starlings', n: [60, 200], form: 'cloud', song: 'starling', v: 1.3 },
    { name: 'Wood Pigeons', n: [40, 250], form: 'cloud', song: 'woodpigeon', v: 1.3 },
    { name: 'Northern Lapwings', n: [20, 80], form: 'loose', song: 'lapwing', v: 1.2 },
    { name: 'Skylarks', n: [6, 25], form: 'loose', song: 'skylark', v: 1.1 },
    { name: 'Meadow Pipits', n: [8, 30], form: 'loose', song: 'tsip', v: 1.1 },
  ],
  spring: [
    { name: 'Common Cranes', n: [12, 40], form: 'v', big: true, song: 'crane', v: 1.0 },
    { name: 'Greylag Geese', n: [10, 30], form: 'v', big: true, song: 'goose', v: 1.1 },
    { name: 'Barn Swallows', n: [10, 40], form: 'loose', song: 'swallow', v: 1.5 },
    { name: 'House Martins', n: [10, 30], form: 'loose', song: 'martin', v: 1.4 },
    { name: 'Northern Lapwings', n: [10, 40], form: 'loose', song: 'lapwing', v: 1.2 },
  ],
};
