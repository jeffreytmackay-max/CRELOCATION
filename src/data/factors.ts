import type { FactorKey, Scores } from '../types';

export interface FactorDef {
  key: FactorKey;
  /** Short label used in the weighting rail. */
  short: string;
  /** Full label used in the factor breakdown. */
  label: string;
  color: string;
  desc: string;
  /** Opt-in factor: only counts toward the score when explicitly enabled. */
  optional?: boolean;
}

export const FACTORS: FactorDef[] = [
  {
    key: 'hospital',
    short: 'Transplant centers',
    label: 'Transplant centers',
    color: '#9d2235',
    desc: 'Drive-time to major transplant hospitals & OCS partners',
  },
  {
    key: 'airport',
    short: 'Airport access',
    label: 'Airport access',
    color: '#44546a',
    desc: 'Access to hubs for time-critical organ & staff transport',
  },
  {
    key: 'commute',
    short: 'Staff commute',
    label: 'Staff commute',
    color: '#c45057',
    desc: 'Drive-time & transit for current employees',
  },
  {
    key: 'crime',
    short: 'Crime & safety',
    label: 'Crime & safety',
    color: '#740223',
    desc: 'Local crime rates & personal safety (by ZIP)',
  },
  {
    key: 'space',
    short: 'Real estate supply',
    label: 'Real estate supply',
    color: '#ff7f41',
    desc: 'Availability & cost of office / lab space nearby',
    optional: true,
  },
];

export const DEFAULT_WEIGHTS: Scores = {
  hospital: 85,
  airport: 75,
  commute: 55,
  crime: 50,
  space: 45,
};

/** SVG path data for each factor icon (24×24 viewBox, 2px stroke). */
export const FACTOR_ICON_PATHS: Record<FactorKey, string[]> = {
  hospital: ['M3 12h4l2-5 3 10 2-6 1.5 1h5.5'],
  airport: [
    'M17.8 19.2 16 11l3.5-3.5c1.5-1.5 2-3.5 1.5-4-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  ],
  commute: ['M3 11 22 2l-9 19-2-8-8-2z'],
  crime: [
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'M12 9v4',
    'M12 17h.01',
  ],
  space: [
    'M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M4 22h14M8 6h.01M8 10h.01M8 14h.01M12 6h.01M12 10h.01M12 14h.01',
  ],
};

/** Factor keys that count toward the composite, given the real-estate toggle. */
export function activeFactorKeys(includeSpace: boolean): FactorKey[] {
  return FACTORS.filter((f) => includeSpace || !f.optional).map((f) => f.key);
}

// Reference points (transplant centers / airports) are ranked by their order in
// the list — drag to reorder. The weight each contributes to the access score is
// derived from its rank: the top item weighs 5, the bottom 1, spread linearly.

/** Weight for the item at `index` in a list of `count` ranked reference points. */
export function rankWeight(index: number, count: number): number {
  if (count <= 1) return 5;
  return 1 + (4 * (count - 1 - index)) / (count - 1); // rank #1 → 5 … last → 1
}

/** Weight applied to the TMDX aviation facility in the airport-access score. */
export const AVIATION_WEIGHT = 5;
