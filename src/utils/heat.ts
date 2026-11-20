// Fly "heat" — how well a fly produced on a trip.
// Replaces the old per-catch fish count with a simple qualitative bucket:
// Hot (crushing it) · Mild (some interest) · Cold (nothing).

export type Heat = 'hot' | 'mild' | 'cold';

export interface HeatLevel {
  key: Heat;
  label: string;        // Short label, e.g. "Hot"
  sectionTitle: string; // Section heading, e.g. "Hot Flies"
  emoji: string;
  icon: string;         // Ionicons name
  color: string;        // Hex, from the app palette
  hint: string;         // One-liner shown under the section
  score: number;        // For ranking / sorting
}

// Ordered best → worst (display order in the form and reports).
export const HEAT_LEVELS: HeatLevel[] = [
  {
    key: 'hot',
    label: 'Hot',
    sectionTitle: 'Hot Flies',
    emoji: '🔥',
    icon: 'flame',
    color: '#F59E0B', // amber (colors.warning)
    hint: 'Fish crushed it — tie these on first',
    score: 2,
  },
  {
    key: 'mild',
    label: 'Mild',
    sectionTitle: 'Mild Flies',
    emoji: '🟡',
    icon: 'thermometer-outline',
    color: '#0EA5E9', // sky blue (colors.primary)
    hint: 'Got some interest — worth a shot',
    score: 1,
  },
  {
    key: 'cold',
    label: 'Cold',
    sectionTitle: 'Cold Flies',
    emoji: '🧊',
    icon: 'snow-outline',
    color: '#64748B', // gray (colors.textTertiary)
    hint: "Nothing doing — probably skip",
    score: 0,
  },
];

const HEAT_MAP: Record<Heat, HeatLevel> = HEAT_LEVELS.reduce(
  (acc, lvl) => {
    acc[lvl.key] = lvl;
    return acc;
  },
  {} as Record<Heat, HeatLevel>
);

export function heatLevel(key: Heat): HeatLevel {
  return HEAT_MAP[key];
}

// Resolve the effective heat for a catch, including older entries that
// predate the heat field and only have a fish count. A logged fly that
// caught fish is treated as Hot; a logged fly with no count still meant
// the angler tied it on, so it defaults to Mild rather than disappearing.
export function effectiveHeat(c: { heat?: Heat | string | null; count?: number | null }): Heat {
  if (c.heat === 'hot' || c.heat === 'mild' || c.heat === 'cold') return c.heat;
  if ((c.count ?? 0) > 0) return 'hot';
  return 'mild';
}

export function heatScore(c: { heat?: Heat | string | null; count?: number | null }): number {
  return heatLevel(effectiveHeat(c)).score;
}

// Number of flies that ran hot across a set of catches.
export function hotFlyCount(
  catches: { heat?: Heat | string | null; count?: number | null }[]
): number {
  return catches.filter((c) => effectiveHeat(c) === 'hot').length;
}
