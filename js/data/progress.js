'use strict';
// Progression: birder rank (XP), badges, villager friendship and the daily notice board.
//
// Design notes (see README): visible progress and level-ups support the feeling of competence
// and the goal-gradient effect; badges are informational (they celebrate what you did, they never
// take anything away); friendships give the valley's people a reason to matter; nothing here ever
// punishes the player or runs out.

const XP = {
  observe: 4, firstSight: 15, clue: 10, blueprint: 20, build: 15, hatch: 10, fledge: 30, newSpecies: 100,
  quest: 50, landmark: 30, rare: 40, board: 20, gift: 5, badge: 40, heart: 15,
};
function xpForLevel(l) { return 60 + 40 * l; } // XP needed to go from level l to l + 1
const MAX_LEVEL = 15;
const RANKS = ['Fledgling', 'Bird Spotter', 'Hedgerow Helper', 'Nest Builder', 'Field Naturalist', 'Song Listener',
  'Habitat Maker', 'Wetland Warden', 'Woodland Keeper', 'Night Watcher', 'Valley Guardian', 'Master Birder',
  'Ornithologist', 'Bird Whisperer', 'Legend of the Valley'];

// What each new rank brings. perk: binoculars (observe from farther, faster), quiet (birds let you closer)
const LEVEL_REWARDS = {
  2: { coins: 50, items: { seed_wildflower: 3 } },
  3: { recipe: 'feeder', coins: 50 },
  4: { perk: 'binoculars' },
  5: { recipe: 'lamppost', items: { sap_oak: 1 } },
  6: { coins: 120, items: { seed_thistle: 3 } },
  7: { recipe: 'gardenbench', coins: 80 },
  8: { perk: 'quiet' },
  9: { coins: 200, items: { sap_pine: 2, sap_willow: 1 } },
  10: { coins: 250, mats: { wood: 10 } },
  11: { coins: 300, items: { owlbox: 1 } },
  12: { coins: 300, items: { platform: 1 } },
  13: { coins: 400 },
  14: { coins: 500 },
  15: { coins: 1000 },
};
const PERK_TEXT = {
  binoculars: 'Better binoculars: you can observe birds from farther away, and faster.',
  quiet: 'Quiet steps: birds let you come much closer before they fly off.',
};

// Badges: s = the stats counter they watch (world.stats), n = goal
const BADGES = [
  { id: 'firstnest', name: 'First Nest', desc: 'Build your first nest.', s: 'built', n: 1 },
  { id: 'builder', name: 'Home Builder', desc: 'Build 10 nests.', s: 'built', n: 10 },
  { id: 'parent', name: 'Proud Neighbour', desc: 'See 5 broods fledge.', s: 'fledged', n: 5 },
  { id: 'restorer', name: 'Valley Restorer', desc: 'Help 20 species nest.', s: 'species', n: 20 },
  { id: 'allbirds', name: 'Full Chorus', desc: 'Help every species nest.', s: 'species', n: 0 },
  { id: 'clues', name: 'Clue Hunter', desc: 'Find 30 clues.', s: 'clues', n: 30 },
  { id: 'observer', name: 'Keen Eye', desc: 'Observe 50 birds.', s: 'observed', n: 50 },
  { id: 'nightowl', name: 'Night Owl', desc: 'Observe 4 different birds of the night.', s: 'nightSpecies', n: 4 },
  { id: 'earlybird', name: 'Early Bird', desc: 'Observe a bird before 7 am.', s: 'early', n: 1 },
  { id: 'explorer', name: 'Explorer', desc: 'Discover every landmark.', s: 'landmarks', n: 0 },
  { id: 'neighbour', name: 'Good Neighbour', desc: 'Complete 10 villager requests.', s: 'quests', n: 10 },
  { id: 'friend', name: 'Best Friends', desc: 'Become best friends (5 hearts) with a villager.', s: 'bestFriends', n: 1 },
  { id: 'gardener', name: 'Green Thumb', desc: 'Plant 25 trees, shrubs or flowers.', s: 'planted', n: 25 },
  { id: 'rare', name: 'Rare Sighting', desc: 'Spot 3 rare visiting birds.', s: 'rare', n: 3 },
  { id: 'gatherer', name: 'Magpie', desc: 'Gather 500 nest materials.', s: 'gathered', n: 500 },
  { id: 'board', name: 'Helping Hand', desc: 'Fill 10 notice-board requests.', s: 'board', n: 10 },
  { id: 'year', name: 'Four Seasons', desc: 'Spend a whole year in the valley.', s: 'days', n: 28 },
];
function badgeGoal(b) {
  if (b.id === 'allbirds') return SPECIES.length;
  if (b.id === 'explorer') return Object.keys(LANDMARKS).length;
  return b.n;
}

// ---------------------------------------------------------------- friendship
const HEART = 50, MAX_HEARTS = 5;
// Gift tastes: love / like; anything else is a kind thought (a little friendship)
const NPC_GIFTS = {
  ada:     { love: ['hazelnut', 'garlic'], like: ['apple', 'mushroom', 'elderberry'] },
  basil:   { love: ['mushroom'], like: ['garlic', 'blackberry', 'seed_herbs'] },
  mabel:   { love: ['apple'], like: ['blackberry', 'elderberry', 'sloe'] },
  tom:     { love: ['sloe'], like: ['apple', 'mushroom', 'hazelnut'] },
  edith:   { love: ['elderberry', 'seed_wildflower'], like: ['apple', 'blackberry', 'seed_herbs'] },
  rosie:   { love: ['blackberry'], like: ['apple', 'hazelnut', 'seed_wildflower'] },
  finn:    { love: ['garlic'], like: ['apple', 'hazelnut', 'mushroom'] },
  juniper: { love: ['hazelnut'], like: ['mushroom', 'garlic', 'sloe'] },
  luna:    { love: ['elderberry'], like: ['blackberry', 'sloe', 'hazelnut'] },
};
const GIFT_LINES = {
  love: ['Oh! My absolute favourite. Thank you!', 'For me? You remembered! That\'s so kind.'],
  like: ['How lovely, thank you!', 'Oh, that\'s a nice thought. Thank you.'],
  ok: ['Thank you — that\'s very thoughtful.', 'Oh! Thank you, neighbour.'],
};
// Stories villagers share as you become friends (hearts 2 and 4) and a keepsake at 5 hearts
const HEART_STORIES = {
  ada: {
    2: ['I first fell for birds as a girl — a wren sang right outside my window every morning.', 'Forty years later I still get goosebumps when I hear one. Funny, isn\'t it?'],
    4: ['When I came here, the valley was almost silent. Hedges gone, ponds filled in.', 'Seeing it come alive again… you\'ve given an old ornithologist her dream back.'],
    5: { lines: ['Here — my old ringing notebook and a little something from the Fund. You\'ve earned it, partner.'], coins: 200, items: { box_large: 2 } },
  },
  basil: {
    2: ['My grandfather ran this shop. He said: "Sell plants that feed the birds, and the birds will sing for your customers."', 'Best business advice I ever got.'],
    4: ['I almost sold the shop once. Nobody wanted native plants. Then you showed up and started planting hedges!', 'Business has never been better — and the birds are back.'],
    5: { lines: ['Take these, on the house. Friends don\'t pay for saplings.'], items: { sap_oak: 2, cut_hawthorn: 2, sap_apple: 1 } },
  },
  mabel: {
    2: ['The swallows came back to my barn the spring my Jim passed away.', 'I like to think he sent them. Silly old woman, eh?'],
    4: ['My farm\'s never made much money. But I wouldn\'t cut the hay early, not for anything.', 'Corncrakes and skylarks nested here when I was young. Maybe they will again.'],
    5: { lines: ['A basket of the best wool and feathers. For your nests, my dear.'], mats: { wool: 10, feather: 10, hair: 6 } },
  },
  tom: {
    2: ['Fifty years on this river. I\'ve seen it poisoned and I\'ve seen it heal.', 'The day the first kingfisher came back, I cried like a baby.'],
    4: ['Truth is, I don\'t care much about catching fish any more.', 'I come down here to watch the herons and the dippers. Best company there is.'],
    5: { lines: ['My father\'s old spotting telescope. You\'ll get more use out of it than me.'], coins: 150, mats: { wood: 8, stone: 6 } },
  },
  edith: {
    2: ['Arthur and I planted every rose on Rose Cottage. Fifty-one years of roses.', 'He always said a garden is never finished — just like a friendship.'],
    4: ['Rosie lives with me now. Her parents work in the city.', 'You\'ve given her something to love here. I can\'t thank you enough.'],
    5: { lines: ['Arthur\'s favourite seeds. He\'d want them in your hands.'], items: { seed_wildflower: 6, seed_herbs: 4, seed_thistle: 4 } },
  },
  rosie: {
    2: ['Can I tell you a secret? I\'m keeping a bird diary! I draw every bird I see.', 'Yesterday I drew a robin. It looked like a potato with legs. Hee hee.'],
    4: ['When I grow up I\'m going to protect birds all over the world!', 'You\'re my best grown-up friend. Don\'t tell Grandma!'],
    5: { lines: ['I made you a friendship bracelet out of feathers I found! And here are my best marbles.'], coins: 77, mats: { feather: 5 } },
  },
  finn: {
    2: ['I used to only care about getting the perfect shot.', 'Aunt Ada taught me the bird always matters more than the photo.'],
    4: ['One of my photos — the swifts over the village — got into a magazine!', 'Couldn\'t have done it without your nest work. Thanks, mate.'],
    5: { lines: ['A print of my best photo, and my old camera bag. Keep birding!'], coins: 180, items: { box_small: 2 } },
  },
  juniper: {
    2: ['People think a ranger\'s job is tidying the forest. It\'s the opposite.', 'Dead trees, tangles, fallen logs — that\'s where the life is.'],
    4: ['I grew up in a city with no trees at all. The first time I heard a woodpecker drum, I knew where I belonged.', 'This forest is my home now.'],
    5: { lines: ['Seasoned timber and a dead trunk — perfect for woodpeckers. From one tree-hugger to another.'], mats: { wood: 15 }, items: { snag: 2 } },
  },
  luna: {
    2: ['I work nights at the observatory in town. Birds and stars — the night has both.', 'Most people never see the valley\'s night shift. Their loss!'],
    4: ['Some people think the night is scary. I think it\'s the kindest time of day.', 'Everything slows down. You can hear an owl breathe.'],
    5: { lines: ['My spare lantern and a star map of the valley sky. Clear skies, friend.'], coins: 160, items: { lamppost: 1 } },
  },
};

// ---------------------------------------------------------------- notice board
// Each morning two small requests go up. Fill them from the shared pouch — or don't; they're optional.
const BOARD_TASKS = [
  { npc: 'basil', mat: 'twig', n: 6, text: 'Twigs for plant supports' },
  { npc: 'basil', mat: 'leaves', n: 4, text: 'Dead leaves for my compost heap' },
  { npc: 'mabel', mat: 'grass', n: 6, text: 'Dry grass for the hen house' },
  { npc: 'mabel', mat: 'stone', n: 3, text: 'Stones to mend a wall' },
  { npc: 'tom', mat: 'stick', n: 3, text: 'Sticks for a new fishing rod rest' },
  { npc: 'tom', mat: 'wood', n: 2, text: 'Wood to patch the jetty' },
  { npc: 'edith', mat: 'moss', n: 3, text: 'Moss for my hanging baskets' },
  { npc: 'edith', mat: 'feather', n: 2, text: 'Feathers for a hat' },
  { npc: 'rosie', mat: 'feather', n: 1, text: 'One pretty feather for my collection!' },
  { npc: 'rosie', mat: 'stone', n: 2, text: 'Smooth stones for hopscotch' },
  { npc: 'finn', mat: 'lichen', n: 2, text: 'Lichen for a close-up photo' },
  { npc: 'juniper', mat: 'rotwood', n: 2, text: 'Rotten wood for a beetle survey' },
  { npc: 'juniper', mat: 'stick', n: 4, text: 'Sticks for a hedgehog house' },
  { npc: 'ada', mat: 'mud', n: 3, text: 'Mud samples from the pond' },
  { npc: 'ada', mat: 'grass', n: 4, text: 'Dry grass for a nest display' },
  { npc: 'luna', mat: 'herbs', n: 2, text: 'Fragrant herbs to attract moths' },
];
