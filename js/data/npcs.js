'use strict';
// NPCs, their lines, letters and the tutorial.

// Villagers. Each walks a daily route: sched entries are [startMinute, waypoints, facing, 'away'?].
// At startMinute they walk through the waypoints (tile coordinates) and then stand facing that
// way; 'away' means they go indoors on arrival. Without a start position a villager is indoors
// (at home) until the first entry. Positions depend only on the game clock, so every co-op
// player sees the same thing.
const NPCS = {
  ada: { name: 'Prof. Ada', role: 'Ornithologist', start: [70.5, 39.6, 0], home: [69.5, 36.4], sched: [
    [690, [[69.5, 37.5], [66.5, 37.5], [56.5, 34.6]], 1],
    [840, [[66.5, 37.5], [70.5, 39.6]], 0],
    [1200, [[69.5, 36.4]], 3, 'away'],
  ] },
  basil: { name: 'Basil', role: 'Garden Shop', start: [64.5, 28.9, 0], home: [62.5, 28.3], sched: [
    [600, [[66.6, 29.0]], 0],
    [660, [[64.5, 28.9]], 0],
    [1080, [[62.5, 28.3]], 3, 'away'],
  ] },
  mabel: { name: 'Mabel', role: 'Farmer', start: [13.5, 29.6, 0], home: [18.5, 21.4], sched: [
    [480, [[15.5, 29.0], [15.5, 25.9]], 3],
    [600, [[15.5, 29.0], [9.5, 30.2]], 0],
    [780, [[13.5, 29.6]], 0],
    [900, [[19.5, 30.2]], 0],
    [1020, [[13.5, 29.6]], 0],
    [1140, [[18.5, 28.6], [18.5, 21.4]], 3, 'away'],
  ] },
  tom: { name: 'Old Tom', role: 'Fisherman', home: [70.5, 26.3], sched: [
    [400, [[70.5, 30.5], [75.5, 30.5], [76.4, 33.6]], 2],
    [750, [[75.5, 30.5], [73.6, 30.4]], 1],
    [840, [[75.5, 30.5], [76.4, 33.6]], 2],
    [1110, [[75.5, 30.5], [70.5, 30.5], [70.5, 26.3]], 3, 'away'],
  ] },
  edith: { name: 'Edith', role: 'Rose Cottage', home: [52.5, 27.3], sched: [
    [450, [[50.9, 27.9]], 3],
    [690, [[52.5, 30.5], [61.5, 30.5], [61.5, 29.4]], 3],
    [750, [[61.5, 30.5], [52.5, 30.5], [50.9, 27.9]], 3],
    [1050, [[52.5, 27.3]], 3, 'away'],
  ] },
  rosie: { name: 'Rosie', role: 'Little birder', home: [52.5, 27.3], kid: true, sched: [
    [480, [[52.5, 30.5], [55.5, 30.6], [54.5, 36.6]], 1],
    [600, [[54.5, 39.8]], 0],
    [720, [[54.5, 36.6], [55.5, 30.6], [52.5, 30.5], [52.5, 27.3]], 3, 'away'],
    [780, [[52.5, 30.5], [40.5, 30.5], [40.5, 33.6]], 0],
    [900, [[40.5, 30.5], [21.5, 30.0], [19.5, 30.2]], 0],
    [1020, [[21.5, 30.0], [40.5, 30.5], [52.5, 30.5], [52.5, 27.3]], 3, 'away'],
  ] },
  finn: { name: 'Finn', role: 'Photographer', home: [69.5, 36.4], sched: [
    [420, [[68.5, 33.5], [66.5, 30.5], [30.5, 30.5], [28.5, 40.5], [28.5, 48.5], [30.5, 49.6]], 0],
    [600, [[28.5, 48.5], [28.5, 44.5], [18.5, 44.5]], 1],
    [780, [[28.5, 44.5], [28.5, 40.5], [30.5, 30.5], [76.0, 30.5], [83.5, 30.5], [86.5, 26.5], [88.5, 20.6]], 3],
    [1020, [[86.5, 26.5], [83.5, 30.5], [66.5, 30.5], [68.5, 33.5], [69.5, 36.4]], 3, 'away'],
  ] },
  juniper: { name: 'Juniper', role: 'Forest ranger', home: [33.5, 2.6], sched: [
    [420, [[36.5, 9.5], [36.5, 16.5]], 0],
    [540, [[24.5, 8.5]], 1],
    [690, [[36.5, 9.5], [52.5, 7.5]], 2],
    [870, [[36.5, 12.5], [36.5, 22.5]], 0],
    [1080, [[36.5, 9.5], [33.5, 2.6]], 3, 'away'],
  ] },
  luna: { name: 'Luna', role: 'Night birder', home: [30.5, 31.0], night: true, sched: [
    [1170, [[28.5, 40.5], [18.5, 43.5]], 1],
    [1290, [[28.5, 40.5], [30.5, 31.0], [36.5, 30.5], [36.5, 17.5]], 3],
    [1410, [[36.5, 30.5], [44.5, 30.5], [45.5, 36.0], [52.0, 42.0], [58.5, 46.5], [58.5, 57.5], [62.5, 61.5]], 0],
    [1530, [[58.5, 57.5], [58.5, 46.5]], 3, 'away'],
  ] },
};
const NPC_SPEED = 1.4; // tiles per game minute

// Things villagers say when they have nothing else on their mind
const NPC_LINES = {
  basil: [
    'Native plants for native birds! What can I get you?',
    'Hawthorn and blackthorn are thorny — small birds feel safe nesting in them.',
    'Plant thistles and the goldfinches will come, you mark my words.',
    'Reeds and cattails need wet feet. Plant them in the shallows, marsh or mud.',
    'Willows love water. Plant them right by the pond.',
    'I\'ll buy any mushrooms, berries or nuts you find. Leave some for the birds, though!',
    'Hundreds of kinds of caterpillars live on oaks — and tit chicks eat caterpillars by the thousand.',
  ],
  mabel: [
    'Brush the sheep and the horse once a day, dear. The birds go mad for wool and horsehair!',
    'My hens drop feathers round the coop every morning. Help yourself.',
    'Swallows have nested in my barn for generations. I always leave the door open for them.',
    'I leave the hay meadow uncut. Owls hunt voles in the long grass at night.',
    'After rain the farmyard turns to mud. The swallows love that.',
    'There\'s a little pond by the coop. Mind the mud — the swallows love it.',
  ],
  tom: [
    'Herons are the best fishermen on this river. They stand still for ages — patience is everything.',
    'See that flash of blue? Kingfisher. Fifty years I\'ve fished here and it still makes my day.',
    'A river needs its banks wild and its water clean. Fish, insects, birds — it\'s all one family.',
    'Dippers walk right into the rapids, looking for insect larvae under the stones. Clever little things.',
    'Caught nothing again. The herons always beat me to it!',
  ],
  edith: [
    'A garden full of flowers is a garden full of insects — and a garden full of birds.',
    'I never tidy the garden too much in autumn. Seed heads feed the finches all winter.',
    'Robins sing all winter, you know. They\'re defending their patch, the little scamps.',
    'My late husband Arthur loved his nest boxes. He put them up all over the valley.',
    'Rosie never stops talking about birds. I think you\'ve inspired her!',
  ],
  rosie: [
    'I saw a bird that was ALL blue and orange! It went zoom over the river!',
    'Did you know swifts sleep while they fly? That\'s so cool!',
    'Grandma says I\'m not allowed to touch nests. Only look. Birds get scared!',
    'When I grow up I want to be a bird scientist like Prof. Ada!',
    'The hens at the farm are my friends. Henrietta is the best one.',
  ],
  finn: [
    'The secret to bird photos? Patience, and don\'t wear bright colours.',
    'Always keep your distance from nests. No photo is worth scaring a bird away.',
    'Early morning light is the best. And that\'s when the birds sing loudest!',
    'I\'m staying with my aunt Ada at the Field Station this summer.',
  ],
  juniper: [
    'Leave dead wood where it falls — it\'s home to beetles, fungi and woodpeckers.',
    'An old forest isn\'t tidy. Tangles, logs and hollow trees are what wildlife needs.',
    'If you find a fledgling on the ground, leave it be. Its parents are usually close by.',
    'Wrens love brush piles. Stack some sticks and leaves and they\'ll move right in.',
  ],
  luna: [
    'The valley has a whole night shift. Owls, nightjars, nightingales… you just have to listen.',
    'Owls swallow their prey whole and cough up the bones and fur as pellets. Scientists study them!',
    'A nightingale singing at midnight is usually a male still looking for a mate.',
    'Let your eyes get used to the dark. It takes about twenty minutes.',
    'Nightjars eat moths. No moths, no nightjars — so plant flowers that bloom and smell at night.',
  ],
};
const MABEL_LINES = NPC_LINES.mabel, BASIL_LINES = NPC_LINES.basil;

const BIRD_FACTS = [
  'Most birds don\'t sleep in nests! Nests are nurseries for eggs and chicks — the rest of the year, songbirds roost on branches.',
  'An eggshell has thousands of tiny pores, so the chick inside can breathe.',
  'Many songbirds lay one egg a day, usually early in the morning.',
  'Most songbirds only start incubating when the last egg is laid, so all the chicks hatch together. Barn owls are an exception!',
  'Songbird chicks hatch naked and blind. Ducklings hatch fluffy, eyes open, ready to walk. Scientists call these "altricial" and "precocial".',
  'Many songbird parents carry their chicks\' droppings away in neat little "faecal sacs" to keep the nest clean and hidden.',
  'Dead trees are full of life: beetles, fungi, woodpeckers, owls and bats all depend on them.',
  'Native plants host far more insects than exotic ones — and insects are baby-bird food.',
  'Clean old nests out of nest boxes in autumn to get rid of fleas and mites before next spring.',
  'The dawn chorus is loudest in spring, when males sing to hold territories and attract mates.',
  'Feathers wear out, so birds moult: most songbirds replace every single feather once a year.',
  'In most of Europe, wild birds, their nests and eggs are protected by law. We give them homes — we never take from them.',
  'Hedges and shrubs shouldn\'t be cut in the nesting season — many countries forbid it from spring to late summer.',
  'Insect-eating birds like swallows and martins decline when insects decline. Wildflowers and ponds help both!',
  'A bird\'s nest is often built in under a week — some, like the Long-tailed Tit\'s, take three weeks.',
  'Birds have no sweat glands. On hot days they pant, bathe and seek shade.',
];

// Tutorial steps shown in the objective tracker.
const TUTORIAL = [
  { id: 'mail',   text: 'Check the mailbox by your cottage' },
  { id: 'ada',    text: 'Visit Prof. Ada at the Field Station (east)' },
  { id: 'gather', text: 'Gather: 2 Twigs, 3 Dry Grass, 2 Mud' },
  { id: 'build',  text: 'Build a Blackbird nest in a shrub by the lawn' },
  { id: 'arrive', text: 'Wait for a Blackbird pair to move in' },
  { id: 'sleep',  text: 'Sleep in your cottage (end the day)' },
  { id: 'craft',  text: 'Craft a nest box at your workbench' },
  { id: 'clues',  text: 'Collect 3 clues on a new species' },
];

const LETTERS = {
  welcome: {
    from: 'Prof. Ada Finch', title: 'Welcome to Featherbrook!',
    body: 'Dear neighbour,\n\nWelcome to your cottage in Featherbrook Valley! Our valley used to ring with birdsong, but many species have vanished as old hedges, meadows and ponds disappeared.\n\nYou can help them come home. Every bird builds its own special nest, in its own special place — find out how, and build them a home!\n\nPlease visit me at the Field Station, just east of Basil\'s Garden Shop.\n\nYours, Ada',
  },
  neighbours: { from: 'Prof. Ada Finch', title: 'Meet the neighbours',
    body: 'Dear neighbour,\n\nWord travels fast in a small valley! Now that the blackbirds have moved in, the villagers would love your help too.\n\n• A yellow "!" over someone\'s head means they have a request. Help them out and they\'ll reward you — and become your friends.\n• The Notice Board by the well has two small requests every morning.\n• Everyone likes a little gift. Hold something in your hands, walk up to a villager and press F (or right-click). They all have favourites!\n• Watching birds, finding clues and building nests all count towards your Birder Rank. New ranks bring rewards and new workbench recipes.\n• Now and then a rare visitor turns up for a single day. Watch for sparkles!\n\nAnd the valley doesn\'t sleep at sunset: some of our birds only come out at night.\n\n— Ada' },
  tier1: { from: 'Prof. Ada Finch', title: 'New leads!',
    body: 'Your first chicks have fledged — wonderful! Word is spreading.\n\nI\'ve had reports of a tiny blue bird in the orchard, a speckled singer in the gardens, soft cooing from the trees, a pink-breasted finch rattling out its song in the garden trees, and a little olive warbler in the forest that keeps singing its own name. Keep your eyes open and look for Field Notes!\n\n— Ada' },
  tier2: { from: 'Prof. Ada Finch', title: 'More birds arriving',
    body: 'Three species nesting already! Now I\'m hearing a tiny, very loud singer in the forest, glossy blue birds around the farm and the village roofs, and ducks on the pond. Something in the forest is walking head-first DOWN the tree trunks, and smart black-and-white flycatchers are back in the oaks.\n\nThere\'s more: a speck of gold flitting through the pines, a mouse-like bird creeping up the tree trunks, a rosy-breasted finch in the orchard hedge, a grey warbler with a black cap singing at the forest edge, a black-and-white bird wagging its tail around the farmyard, a red-billed "marsh hen" on the pond, a blue-grey dove cooing from the old trees and a sooty bird with a red tail singing on the village rooftops.\n\nTip: mud is precious for some birds. After rain, look for puddles!\n\n— Ada' },
  tier3: { from: 'Prof. Ada Finch', title: 'The valley is waking up',
    body: 'Seven species! New reports: a charm of red-faced finches in the south meadow, a fluffy long-tailed bird by the forest edge, drumming in the woods, chattering in the reeds and red birds in the pine grove.\n\nA song pours down from high above the hay meadow, a little plover runs over the river gravel, a dark bird walks right into the river, sand martins twitter along the banks and jackdaws chatter on the chimneys. A yellow bird sings about bread and cheese on the farm hedges, and a little falcon hangs in the wind above the hills. Something laughs out loud in the orchard, where an orange-tailed bird flickers between the old trees; a jay screeches in the oaks; and on the big pond, crested birds are dancing. Listen too for a purring dove in the southern hedges, a little grey bird snapping up flies in the gardens, a white-rumped bird bobbing on the rocks in the hills, a lemon-yellow wagtail by the river bridge and tiny finches hanging from the pine cones. And on spring nights — listen for the nightingale, and for something squealing like a piglet in the reeds!\n\n— Ada' },
  tier4: { from: 'Prof. Ada Finch', title: 'Rare visitors!',
    body: 'Thirteen species — the valley is becoming famous! Someone saw a flash of blue on the river, a ghostly white owl over the hay meadow at dusk, a masked little bird in the pond willows… and a certain bird calling its own name.\n\nScreaming swifts race around the rooftops and a tall grey heron stalks the river. And the nights are full of voices: hooting in the forest, a churring nightjar in the clearings, a long-eared owl in the pines and a corncrake rasping all night in the hay meadow. On summer nights a tiny owl whistles "tyuu" in the orchard. And over the wet meadow, a crested black-and-white bird tumbles through the air crying "pee-wit!" Elegant "sea swallows" dive for fish in the river — and on the gravel banks, after dark, something big-eyed wails "cur-lee". A great white swan has been seen on the pond, a buzzard mews over the woods, and from the pine grove at night comes a soft, quick "po-po-po-po"\n\n— Ada' },
  tier5: { from: 'Prof. Ada Finch', title: 'A very big visitor',
    body: 'Twenty species! And the biggest news of all: a pair of White Storks has been seen in the wet meadow east of the river. Storks need open, wet meadows and a high place to build. Could you make them a home?\n\nThere are rumours of a rainbow-coloured bird hunting bees over the south meadow — and of a "butcher bird" in the thorn hedges! And after dark, from the rocky hills, comes the deep hoot of an Eagle-Owl… while by day, a big brown bird of prey glides low over the reed beds.\n\n— Ada' },
  spring: { from: 'Prof. Ada Finch', title: 'Spring is here!',
    body: 'The nesting season has begun! Migrants are returning from Africa, and resident birds are pairing up. Most birds nest in spring and summer.\n\n— Ada' },
  summer: { from: 'Prof. Ada Finch', title: 'Summer days',
    body: 'Thistles are seeding now — perfect timing for late nesters like goldfinches, who line their nests with thistle down. Many birds also raise second broods.\n\n— Ada' },
  autumn: { from: 'Prof. Ada Finch', title: 'Autumn in the valley',
    body: 'Swallows, martins and other migrants are leaving for Africa. Most birds are done nesting — but Wood Pigeons and Barn Owls may still breed!\n\nAutumn is the time to clean out old nests and to plant trees and shrubs for next year. Leaf piles are everywhere now.\n\n— Ada' },
  winter: { from: 'Prof. Ada Finch', title: 'Winter',
    body: 'A quiet season… mostly! Crossbills breed in winter when the pine cones are full of seeds, and Grey Herons start building their nests in late winter. A good time to prepare structures, plant and plan for spring.\n\n— Ada' },
  allDone: { from: 'Prof. Ada Finch', title: 'You did it!',
    body: 'All sixty-seven species are nesting in Featherbrook Valley! I can hardly believe it. The valley rings with birdsong from dawn to dusk again.\n\nThank you, from me and from every bird in the valley.\n\n— Ada' },
};

function nestedLetter(sp, grant) {
  return {
    from: 'Prof. Ada Finch', title: sp.name + ' fledged!',
    body: 'Congratulations! A brood of ' + sp.name + 's has fledged in the valley. I\'ve added them to the official survey.\n\n' +
      'The Conservation Fund has sent you a grant of ' + grant + ' coins.\n\nDid you know? ' + sp.facts[0] + '\n\n— Ada',
  };
}
