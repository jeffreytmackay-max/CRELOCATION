import type { FactorKey, Scores } from '../types';

export interface FactorDef {
  key: FactorKey;
  /** Short label used in the weighting rail. */
  short: string;
  /** Full label used in the factor breakdown. */
  label: string;
  color: string;
  desc: string;
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
    key: 'space',
    short: 'Real estate supply',
    label: 'Real estate supply',
    color: '#ff7f41',
    desc: 'Availability & cost of office / lab space nearby',
  },
  {
    key: 'risk',
    short: 'Climate & reg. risk',
    label: 'Climate & regulatory risk',
    color: '#e0996a',
    desc: 'Flood / seismic exposure & local regulatory load',
  },
];

export const DEFAULT_WEIGHTS: Scores = {
  hospital: 85,
  airport: 75,
  commute: 55,
  space: 45,
  risk: 60,
};

/** SVG path data for each factor icon (24×24 viewBox, 2px stroke). */
export const FACTOR_ICON_PATHS: Record<FactorKey, string[]> = {
  hospital: ['M3 12h4l2-5 3 10 2-6 1.5 1h5.5'],
  airport: [
    'M17.8 19.2 16 11l3.5-3.5c1.5-1.5 2-3.5 1.5-4-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  ],
  commute: ['M3 11 22 2l-9 19-2-8-8-2z'],
  space: [
    'M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M4 22h14M8 6h.01M8 10h.01M8 14h.01M12 6h.01M12 10h.01M12 14h.01',
  ],
  risk: ['M12 2 20 6v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z', 'M12 8v4', 'M12 16h.01'],
};
