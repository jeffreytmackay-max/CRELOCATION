/** Domain model for the Site Selection Explorer. */

export type FactorKey = 'hospital' | 'airport' | 'commute' | 'space';

/**
 * Raw 0–100 scores keyed by factor (higher is better). `space` (real estate)
 * is an opt-in factor: its score is always stored, but it only counts toward
 * the composite when the "Real estate" toggle is on (see AppState.includeSpace).
 * Older saved/exported states may carry retired factors (crime, risk) as extra
 * keys — harmless and ignored.
 */
export type Scores = {
  hospital: number;
  airport: number;
  commute: number;
  space: number;
};

/** A label/value fact pair shown in the "Site facts" list. */
export type Fact = [label: string, value: string];

export interface Office {
  on: boolean;
  address: string;
  lat: number;
  lng: number;
  scores: Scores;
  note: string;
  facts: Fact[];
}

export interface Center {
  id: string;
  short: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Airport {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Site {
  id: string;
  name: string;
  short: string;
  lat: number;
  lng: number;
  scores: Scores;
  note: string;
  facts: Fact[];
  /** Municipality / sub-area (e.g. "The Woodlands, TX"). Falls back to the metro. */
  area?: string;
}

/** Where current staff live — context for the staff-commute factor. */
export interface StaffLocation {
  id: string;
  city: string;
  state: string;
  zip: string;
  /** Employee count, stored as typed (digits only); parse for totals. */
  employees: string;
  /** Geocoded coordinates (set by "Plot on map"); cleared when the address changes. */
  lat?: number;
  lng?: number;
}

export interface City {
  id: string;
  name: string;
  state: string;
  /** Optional ZIP used to geocode the map center when the city was added. */
  zip?: string;
  center: [number, number];
  zoom: number;
  office: Office;
  centers: Center[];
  airports: Airport[];
  sites: Site[];
  /** Optional — older saved/exported states may omit it (treat as []). */
  staff?: StaffLocation[];
}

export interface Layers {
  centers: boolean;
  airports: boolean;
  office: boolean;
  /** Staff-location markers. Optional — older saved states may omit it. */
  staff?: boolean;
}

/**
 * driveTimes[cityId][originId][refId] = minutes (string, as typed).
 * originId is a site id or the literal "office".
 */
export type DriveTimes = Record<
  string,
  Record<string, Record<string, string>>
>;

export interface AppState {
  weights: Scores;
  /** Whether the opt-in "Real estate" factor counts toward the composite score. */
  includeSpace: boolean;
  cityId: string;
  selectedSiteId: string | null;
  panelOpen: boolean;
  layers: Layers;
  cities: City[];
  driveTimes: DriveTimes;
}

/** A site (or the injected office) with derived scoring fields. */
export interface ScoredSite extends Site {
  composite: number;
  raw: number;
  rank: number;
  isOffice?: boolean;
}

/** What the user is currently placing on the map, if anything. */
export type AddKind = 'center' | 'airport' | 'site' | 'office';
