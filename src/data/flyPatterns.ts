export type FlyCategory = 'dry' | 'nymph' | 'streamer' | 'emerger' | 'terrestrial' | 'wet' | 'midge' | 'egg' | 'other';

export interface FlyPattern {
  name: string;
  category: FlyCategory;
  description: string;
  commonSizes: string[];
  imageUrl?: string; // cached web search result
}

export const categoryColors: Record<FlyCategory, string> = {
  dry: '#F59E0B',        // Amber
  nymph: '#A16207',      // Brown
  streamer: '#22C55E',   // Green
  emerger: '#8B5CF6',    // Purple
  terrestrial: '#EF4444', // Red
  wet: '#0EA5E9',        // Blue
  midge: '#EC4899',      // Pink
  egg: '#FB923C',        // Orange
  other: '#64748B',      // Gray
};

export const categoryLabels: Record<FlyCategory, string> = {
  dry: 'Dry Fly',
  nymph: 'Nymph',
  streamer: 'Streamer',
  emerger: 'Emerger',
  terrestrial: 'Terrestrial',
  wet: 'Wet Fly',
  midge: 'Midge',
  egg: 'Egg',
  other: 'Other',
};

// Curated database of ~100 common fly patterns
export const FLY_PATTERNS: FlyPattern[] = [
  // ── Dry Flies ──
  { name: 'Adams', category: 'dry', description: 'Classic all-purpose mayfly imitation', commonSizes: ['12', '14', '16', '18'] },
  { name: 'Parachute Adams', category: 'dry', description: 'High-visibility Adams variant with white post', commonSizes: ['12', '14', '16', '18', '20'] },
  { name: 'Elk Hair Caddis', category: 'dry', description: 'Go-to caddis imitation, great in riffles', commonSizes: ['12', '14', '16', '18'] },
  { name: 'Goddard Caddis', category: 'dry', description: 'Buoyant deer hair caddis, good in fast water', commonSizes: ['12', '14', '16'] },
  { name: 'Stimulator', category: 'dry', description: 'Big attractor, imitates stoneflies and caddis', commonSizes: ['6', '8', '10', '12', '14'] },
  { name: 'Royal Wulff', category: 'dry', description: 'Classic attractor pattern, visible in rough water', commonSizes: ['10', '12', '14', '16'] },
  { name: 'Blue Wing Olive (BWO)', category: 'dry', description: 'Matches Baetis mayflies, essential spring/fall fly', commonSizes: ['16', '18', '20', '22'] },
  { name: 'Pale Morning Dun (PMD)', category: 'dry', description: 'Matches Ephemerella mayflies, summer staple', commonSizes: ['14', '16', '18'] },
  { name: 'Green Drake', category: 'dry', description: 'Large mayfly imitation, explosive hatches', commonSizes: ['10', '12', '14'] },
  { name: 'Comparadun', category: 'dry', description: 'Low-profile mayfly, great for picky trout', commonSizes: ['14', '16', '18', '20'] },
  { name: 'Sparkle Dun', category: 'dry', description: 'Craig Mathews\' emerger/dun pattern', commonSizes: ['16', '18', '20'] },
  { name: 'Humpy', category: 'dry', description: 'Rugged attractor, floats well in fast water', commonSizes: ['10', '12', '14', '16'] },
  { name: 'Griffith\'s Gnat', category: 'dry', description: 'Tiny midge cluster imitation', commonSizes: ['18', '20', '22', '24'] },
  { name: 'CDC Blue Wing Olive', category: 'dry', description: 'CDC version of BWO, natural float', commonSizes: ['18', '20', '22'] },
  { name: 'Purple Haze', category: 'dry', description: 'Purple-bodied parachute, great attractor', commonSizes: ['14', '16', '18'] },
  { name: 'Trico Spinner', category: 'dry', description: 'Tiny spinner for morning Trico falls', commonSizes: ['20', '22', '24'] },
  { name: 'Rusty Spinner', category: 'dry', description: 'Generic spent mayfly spinner pattern', commonSizes: ['14', '16', '18', '20'] },
  { name: 'H & L Variant', category: 'dry', description: 'House and Lot Variant, classic attractor', commonSizes: ['10', '12', '14'] },
  { name: 'Yellow Sally', category: 'dry', description: 'Small yellow stonefly imitation', commonSizes: ['14', '16'] },
  { name: 'Chubby Chernobyl', category: 'dry', description: 'Big foam stonefly, great hopper-dropper top fly', commonSizes: ['6', '8', '10', '12'] },

  // ── Nymphs ──
  { name: 'Pheasant Tail Nymph', category: 'nymph', description: 'Classic mayfly nymph, works everywhere', commonSizes: ['14', '16', '18', '20'] },
  { name: 'Hare\'s Ear Nymph', category: 'nymph', description: 'Buggy all-purpose nymph', commonSizes: ['12', '14', '16', '18'] },
  { name: 'Prince Nymph', category: 'nymph', description: 'Flashy attractor nymph with biot wings', commonSizes: ['12', '14', '16', '18'] },
  { name: 'Copper John', category: 'nymph', description: 'Heavy copper wire nymph, sinks fast', commonSizes: ['12', '14', '16', '18'] },
  { name: 'RS2', category: 'nymph', description: 'Rim Chung\'s emerger/nymph, deadly on tailwaters', commonSizes: ['18', '20', '22', '24'] },
  { name: 'Zebra Midge', category: 'midge', description: 'Simple wire-wrapped midge, essential pattern', commonSizes: ['18', '20', '22', '24'] },
  { name: 'Mercury Midge', category: 'midge', description: 'Glass bead midge, great in clear water', commonSizes: ['18', '20', '22'] },
  { name: 'Black Beauty', category: 'midge', description: 'Black midge larva/pupa pattern', commonSizes: ['18', '20', '22', '24'] },
  { name: 'Juju Baetis', category: 'nymph', description: 'Charlie Craven\'s realistic Baetis nymph', commonSizes: ['18', '20', '22'] },
  { name: 'Barr\'s Emerger', category: 'emerger', description: 'John Barr\'s BWO emerger', commonSizes: ['18', '20', '22'] },
  { name: 'WD-40', category: 'nymph', description: 'Tiny emerger/nymph, matches many hatches', commonSizes: ['18', '20', '22', '24'] },
  { name: 'San Juan Worm', category: 'nymph', description: 'Simple worm pattern, deadly after rain', commonSizes: ['10', '12', '14'] },
  { name: 'Pat\'s Rubber Legs', category: 'nymph', description: 'Big stonefly nymph with rubber legs', commonSizes: ['4', '6', '8', '10'] },
  { name: 'Perdigon', category: 'nymph', description: 'Euro-nymph style, slim and fast-sinking', commonSizes: ['14', '16', '18', '20'] },
  { name: 'Frenchie', category: 'nymph', description: 'Euro-nymph variant of Pheasant Tail with hotspot', commonSizes: ['14', '16', '18'] },
  { name: 'Flashback Pheasant Tail', category: 'nymph', description: 'PT nymph with flashback wingcase', commonSizes: ['14', '16', '18', '20'] },
  { name: 'Bead Head Hare\'s Ear', category: 'nymph', description: 'Weighted Hare\'s Ear, bread and butter nymph', commonSizes: ['12', '14', '16', '18'] },
  { name: 'Stonefly Nymph', category: 'nymph', description: 'Generic stonefly nymph pattern', commonSizes: ['4', '6', '8', '10'] },
  { name: 'Mysis Shrimp', category: 'nymph', description: 'Freshwater shrimp imitation for tailwaters', commonSizes: ['14', '16', '18'] },
  { name: 'Scud', category: 'nymph', description: 'Freshwater scud/shrimp pattern', commonSizes: ['14', '16', '18'] },
  { name: 'Rainbow Warrior', category: 'nymph', description: 'Flashy attractor nymph by Lance Egan', commonSizes: ['16', '18', '20'] },
  { name: 'Breadcrust', category: 'nymph', description: 'Classic caddis pupa imitation', commonSizes: ['12', '14', '16'] },
  { name: 'Caddis Pupa', category: 'emerger', description: 'Generic caddis pupa, great during hatches', commonSizes: ['14', '16', '18'] },
  { name: 'Mercury Pheasant Tail', category: 'nymph', description: 'Glass bead version of the PT nymph', commonSizes: ['16', '18', '20'] },
  { name: 'Two Bit Hooker', category: 'nymph', description: 'Simple but effective small nymph', commonSizes: ['18', '20', '22'] },
  { name: 'Egg Pattern', category: 'egg', description: 'Simple egg fly, great during spawn', commonSizes: ['8', '10', '12'] },
  { name: 'Glo Bug', category: 'egg', description: 'Yarn egg pattern, bright and visible', commonSizes: ['8', '10', '12'] },

  // ── Streamers ──
  { name: 'Woolly Bugger', category: 'streamer', description: 'The most versatile fly ever tied', commonSizes: ['4', '6', '8', '10'] },
  { name: 'Clouser Minnow', category: 'streamer', description: 'Weighted baitfish pattern, works in all water', commonSizes: ['2', '4', '6', '8'] },
  { name: 'Muddler Minnow', category: 'streamer', description: 'Classic sculpin imitation with deer hair head', commonSizes: ['4', '6', '8', '10'] },
  { name: 'Zonker', category: 'streamer', description: 'Rabbit strip streamer, lots of action', commonSizes: ['2', '4', '6', '8'] },
  { name: 'Sculpin', category: 'streamer', description: 'Bottom-dwelling baitfish imitation', commonSizes: ['2', '4', '6'] },
  { name: 'Slumpbuster', category: 'streamer', description: 'John Barr\'s pine squirrel streamer', commonSizes: ['4', '6', '8'] },
  { name: 'Circus Peanut', category: 'streamer', description: 'Articulated streamer, big fish fly', commonSizes: ['2', '4', '6'] },
  { name: 'Sex Dungeon', category: 'streamer', description: 'Kelly Galloup\'s articulated streamer', commonSizes: ['2', '4'] },
  { name: 'Conehead Bugger', category: 'streamer', description: 'Cone head Woolly Bugger, sinks fast', commonSizes: ['4', '6', '8'] },
  { name: 'Mickey Finn', category: 'streamer', description: 'Classic flashy bucktail streamer', commonSizes: ['6', '8', '10'] },
  { name: 'Thin Mint', category: 'streamer', description: 'Modern streamer, flashy with movement', commonSizes: ['2', '4', '6'] },
  { name: 'Barely Legal', category: 'streamer', description: 'Articulated streamer for big trout', commonSizes: ['2', '4'] },
  { name: 'Meat Whistle', category: 'streamer', description: 'John Barr\'s cone head streamer', commonSizes: ['2', '4', '6'] },
  { name: 'Bunny Leech', category: 'streamer', description: 'Rabbit strip leech pattern', commonSizes: ['4', '6', '8'] },
  { name: 'Crystal Bugger', category: 'streamer', description: 'Woolly Bugger with crystal flash body', commonSizes: ['6', '8', '10'] },

  // ── Terrestrials ──
  { name: 'Dave\'s Hopper', category: 'terrestrial', description: 'Classic grasshopper pattern', commonSizes: ['6', '8', '10', '12'] },
  { name: 'Amy\'s Ant', category: 'terrestrial', description: 'Foam ant pattern, great in summer', commonSizes: ['14', '16', '18'] },
  { name: 'Beetle', category: 'terrestrial', description: 'Foam beetle, deadly near overhanging trees', commonSizes: ['12', '14', '16'] },
  { name: 'Chernobyl Ant', category: 'terrestrial', description: 'Big foam terrestrial, great attractor', commonSizes: ['6', '8', '10'] },
  { name: 'Morrish Hopper', category: 'terrestrial', description: 'Realistic foam hopper pattern', commonSizes: ['6', '8', '10'] },
  { name: 'Fat Albert', category: 'terrestrial', description: 'Big foam terrestrial, highly visible', commonSizes: ['6', '8', '10'] },
  { name: 'Foam Beetle', category: 'terrestrial', description: 'Simple foam beetle pattern', commonSizes: ['12', '14', '16'] },
  { name: 'Cricket', category: 'terrestrial', description: 'Cricket imitation for late summer', commonSizes: ['8', '10', '12'] },
  { name: 'Cicada', category: 'terrestrial', description: 'Large cicada pattern for emergence years', commonSizes: ['4', '6', '8'] },

  // ── Wet Flies ──
  { name: 'Soft Hackle', category: 'wet', description: 'Classic wet fly with partridge hackle', commonSizes: ['12', '14', '16', '18'] },
  { name: 'Partridge and Orange', category: 'wet', description: 'Classic North Country spider pattern', commonSizes: ['12', '14', '16'] },
  { name: 'Leadwing Coachman', category: 'wet', description: 'Traditional wet fly pattern', commonSizes: ['10', '12', '14'] },
  { name: 'March Brown', category: 'wet', description: 'Classic wet fly for spring', commonSizes: ['10', '12', '14'] },
  { name: 'Picket Pin', category: 'wet', description: 'Wet fly for lakes and ponds', commonSizes: ['8', '10', '12'] },
];

// Build a search index
const searchIndex = FLY_PATTERNS.map((fp) => ({
  ...fp,
  searchKey: `${fp.name} ${fp.category} ${fp.description}`.toLowerCase(),
}));

export function searchFlyPatterns(query: string): FlyPattern[] {
  if (!query.trim()) return FLY_PATTERNS;
  const q = query.toLowerCase();
  return searchIndex
    .filter((fp) => fp.searchKey.includes(q))
    .map(({ searchKey, ...fp }) => fp);
}

export function searchFlyPatternsByCategory(category: FlyCategory): FlyPattern[] {
  return FLY_PATTERNS.filter((fp) => fp.category === category);
}
