'use strict';
// Villagers' side quests and the valley's landmarks.
//
// kind:  find    – pick up n quest items hidden in an area (spawned when the quest is accepted)
//        bring   – hand over n of a nest material from the shared pouch
//        visit   – discover n landmarks
//        observe – observe n different bird species (night: only birds of the night count)
//        plant   – plant n of a plant
// reward: coins, items (to the bag), mats (to the pouch), clue (a clue for a bird you don't know
//         yet; 'night' picks a bird of the night)

const QITEMS = {
  marble: { name: 'Rosie\'s blue marble' },
  float:  { name: 'Tom\'s lucky float' },
  plate:  { name: 'an old brass plate' },
  litter: { name: 'litter' },
  pellet: { name: 'an owl pellet' },
  hen:    { name: 'Henrietta the hen' },
  orchid: { name: 'a wild orchid seed pod' },
};

const QUESTS = [
  { id: 'marble', npc: 'rosie', title: 'The blue marble', kind: 'find', item: 'marble', n: 1, area: [14, 46, 36, 66],
    ask: ['I lost my best marble! The blue swirly one!', 'I was playing by the big pond with the reeds… Can you look for it? Pleeease?'],
    hint: 'Search the grass around the big pond in the south-west.',
    thanks: ['You found it!! Thank you thank you thank you!', 'Here, you can have my pocket money. And Grandma\'s flower seeds!'],
    reward: { coins: 60, items: { seed_wildflower: 2 } } },
  { id: 'feathers', npc: 'rosie', after: 'marble', title: 'Feather collection', kind: 'bring', mat: 'feather', n: 4,
    ask: ['I\'m making a feather collection for school!', 'Can you bring me 4 feathers? Mabel\'s hens drop lots of them.'],
    hint: 'Bring Rosie 4 feathers from the nest-material pouch.',
    thanks: ['So soft! This one\'s from a hen, I think… and this one\'s a pigeon!', 'I drew you a picture of a bird I saw. Maybe it helps!'],
    reward: { coins: 40, clue: true } },
  { id: 'float', npc: 'tom', title: 'The lucky float', kind: 'find', item: 'float', n: 1, area: [2, 56, 30, 66], shore: true,
    ask: ['Lost my lucky float yesterday. The current took it downstream, past the big pond.', 'Red and white, can\'t miss it. Probably washed up on a bank somewhere south-west.'],
    hint: 'Look along the water\'s edge downstream, south-west of the big pond.',
    thanks: ['That\'s the one! Fifty years I\'ve had that float.', 'Here — take this, and some driftwood I\'ve been saving.'],
    reward: { coins: 70, mats: { wood: 4 } } },
  { id: 'stones', npc: 'tom', after: 'float', title: 'Stones for a wall', kind: 'bring', mat: 'stone', n: 5,
    ask: ['I\'m patching the old dry-stone wall behind my house.', 'Wrens and wagtails nest in the gaps of old walls, you know. Could you spare 5 stones?'],
    hint: 'Bring Tom 5 stones (gravel banks and the hills have plenty).',
    thanks: ['Grand. A good wall is full of little nooks for birds and bees.', 'I chiselled you a flat stone. Song thrushes use them as anvils for snails!'],
    reward: { coins: 60, items: { anvil: 1 } } },
  { id: 'border', npc: 'edith', title: 'A wildflower border', kind: 'plant', plant: 'wildflower', n: 4,
    ask: ['My knees aren\'t what they were, dear. Would you plant some wildflowers for me?', 'Anywhere in the valley will do — four patches. The bees and the birds will thank you.'],
    hint: 'Plant 4 wildflower patches anywhere (seeds from Basil\'s shop).',
    thanks: ['Oh, lovely! Insects will come, and the birds will follow.', 'Take these herb seedlings from my garden. Blue tits love them.'],
    reward: { coins: 40, items: { seed_herbs: 2 } } },
  { id: 'oldbox', npc: 'edith', after: 'border', title: 'Arthur\'s nest box', kind: 'find', item: 'plate', n: 1, area: [4, 2, 66, 13],
    ask: ['My husband Arthur put up a nest box deep in the forest, forty years ago.', 'It had a little brass plate with his initials. I wonder if anything is left of it…'],
    hint: 'Search the forest for the brass plate from Arthur\'s old nest box.',
    thanks: ['A.H. — that\'s his plate. Oh, my.', 'He\'d want his boxes to go on. Here, I had one made just like his.'],
    reward: { coins: 80, items: { box_large: 1 } } },
  { id: 'landmarks', npc: 'finn', title: 'Photo safari', kind: 'visit', n: 4,
    ask: ['I\'m making a photo book of the valley\'s secret places.', 'Find four landmarks for me — old trees, standing stones, that kind of thing. Look at them closely!'],
    hint: 'Discover 4 landmarks around the valley.',
    thanks: ['These are amazing spots! The book is going to look great.', 'I heard a rumour about a bird while I was out. Here, I wrote it down.'],
    reward: { coins: 120, clue: true } },
  { id: 'spotter', npc: 'finn', after: 'landmarks', title: 'Bird spotter', kind: 'observe', n: 6,
    ask: ['Challenge time! Observe six different kinds of birds.', 'Get close, stand still and watch. No running at them!'],
    hint: 'Observe 6 different bird species.',
    thanks: ['Six species! You\'re a natural birder.', 'Here\'s the prize money from the photo club.'],
    reward: { coins: 150, mats: { feather: 3 } } },
  { id: 'litter', npc: 'juniper', title: 'Forest clean-up', kind: 'find', item: 'litter', n: 5, area: [4, 2, 66, 13],
    ask: ['Someone\'s been leaving litter in my forest. Tins and plastic tangle up birds\' feet.', 'Pick up five bits of rubbish for me?'],
    hint: 'Pick up 5 pieces of litter in the forest.',
    thanks: ['Much better. Thank you!', 'Take some wood, and this old dead trunk — woodpeckers love them.'],
    reward: { mats: { wood: 6 }, items: { snag: 1 } } },
  { id: 'brush', npc: 'juniper', after: 'litter', title: 'Shelter for wrens', kind: 'bring', mat: 'stick', n: 6,
    ask: ['I want to build brush piles for the wrens along the forest edge.', 'Bring me six good sticks?'],
    hint: 'Bring Juniper 6 sticks.',
    thanks: ['Perfect. Wrens and hedgehogs will be snug in there.', 'Here, I made one for you as well.'],
    reward: { coins: 50, items: { brushpile: 1 } } },
  { id: 'henrietta', npc: 'mabel', title: 'Henrietta escapes', kind: 'find', item: 'hen', n: 1, area: [45, 36, 58, 47],
    ask: ['Henrietta\'s got out again! My best hen.', 'She loves the orchard — fallen apples and worms. Would you fetch her back?'],
    hint: 'Find Henrietta the hen in the orchard.',
    thanks: ['There you are, you naughty girl!', 'Thank you, dear. Have some feathers and wool for your nests.'],
    reward: { coins: 50, mats: { feather: 4, wool: 2 } } },
  { id: 'orchids', npc: 'basil', title: 'Wild orchids', kind: 'find', item: 'orchid', n: 3, area: [74, 22, 93, 62],
    ask: ['Wild orchids grow on the far side of the river — lovely, but rare.', 'Could you collect three seed pods? Only the dry ones — never dig up the plants!'],
    hint: 'Find 3 orchid seed pods east of the river.',
    thanks: ['Perfect pods! I\'ll sow them carefully — orchids need a special fungus in the soil.', 'Here\'s something for your trouble, and some seeds.'],
    reward: { coins: 120, items: { seed_thistle: 2, seed_wildflower: 2 } } },
  { id: 'survey', npc: 'ada', title: 'Spring survey', kind: 'observe', n: 5,
    ask: ['I\'m doing the yearly bird survey and could use a hand.', 'Observe five different species for me — any you like.'],
    hint: 'Observe 5 different bird species.',
    thanks: ['Excellent survey work! Every record counts.', 'Here is a little fee from the Conservation Fund.'],
    reward: { coins: 100, clue: true } },
  { id: 'pellets', npc: 'luna', title: 'Owl pellets', kind: 'find', item: 'pellet', n: 3, area: [2, 37, 30, 49],
    ask: ['Owls cough up pellets of fur and tiny bones after a meal.', 'Find three in the hay meadow and we can see what they\'ve been eating!'],
    hint: 'Find 3 owl pellets in the hay meadow.',
    thanks: ['Look — vole skulls! These owls are well fed.', 'And here: while I waited, I heard something unusual out there…'],
    reward: { coins: 90, clue: 'night' } },
  { id: 'moths', npc: 'luna', after: 'pellets', title: 'A garden for moths', kind: 'plant', plant: 'herbs', n: 3,
    ask: ['Nightjars and bats live on moths — and moths need flowers.', 'Plant three herb patches? Fragrant flowers feed moths at night.'],
    hint: 'Plant 3 herb patches (herb seedlings from Basil or Edith).',
    thanks: ['Smell that? The moths will find it tonight.', 'Here — a bird of the night I\'ve been hearing lately.'],
    reward: { coins: 90, clue: 'night' } },
];
const QUESTS_BY_ID = {};
for (const q of QUESTS) QUESTS_BY_ID[q.id] = q;

// Landmarks: discovering one is shared by the whole valley and earns a small reward
const LANDMARKS = {
  oak:     { name: 'Ancient Oak', at: [22, 9], solid: [3, 9, 13, 15],
    lore: 'This oak has stood here for about five hundred years. Ancient oaks support more life than almost any other tree: lichens, beetles, bats, owls and over two thousand other species.' },
  stones:  { name: 'Standing Stones', at: [72, 63], w: 2, solid: [1, 8, 31, 15],
    lore: 'Nobody remembers who raised these stones. Some of the lichen crusts on them may be hundreds of years old — lichens grow only a few millimetres a year.' },
  cairn:   { name: 'Hilltop Cairn', at: [89, 6], solid: [2, 8, 14, 15],
    lore: 'Walkers add a stone each time they reach the top. From here you can see the whole valley — and kestrels hovering over the meadows.' },
  mill:    { name: 'Old Millstone', at: [64, 47], solid: [2, 8, 14, 15],
    lore: 'A watermill once ground flour here. Old mills, bridges and walls often have nooks where dippers, wagtails and bats raise their young.' },
  hide:    { name: 'Bird Hide', at: [88, 52], w: 2, solid: [0, 6, 32, 15],
    lore: 'Birdwatchers sit quietly in hides like this one, watching wetland birds without disturbing them. Quiet and patience reveal the most.' },
  willow:  { name: 'Hollow Willow', at: [12, 51], solid: [3, 9, 13, 15],
    lore: 'Pollarded willows are cut back every few years and grow strange, hollow trunks — perfect hideaways for owls, bats and insects.' },
  spring:  { name: 'Forest Spring', at: [57, 9], solid: [2, 9, 14, 15],
    lore: 'Clear water bubbles up from under the roots here. Birds come to drink and bathe — clean water is as important to them as food.' },
};
const LANDMARK_REWARD = 25;
