import { DEFAULT_WEIGHTS } from '../data/factors';
import type { AppState } from '../types';

// v3 starts empty (no sample cities). The version bump abandons older sample
// data so existing users get the blank slate automatically.
export const STORE_KEY = 'tmdx_site_explorer_v3';

/** A pristine, empty state — the user builds cities up from scratch. */
export function freshState(): AppState {
  return {
    weights: { ...DEFAULT_WEIGHTS },
    includeSpace: false,
    cityId: '',
    selectedSiteId: null,
    panelOpen: false,
    layers: { centers: true, airports: true, office: true, staff: true, aviation: true },
    cities: [],
    driveTimes: {},
  };
}

/** Load persisted state, repairing obvious gaps. */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const loaded = JSON.parse(raw) as AppState;
      if (!loaded.cities) loaded.cities = [];
      // Real-estate is opt-in; default off for states saved before the toggle.
      if (typeof loaded.includeSpace !== 'boolean') loaded.includeSpace = false;
      if (loaded.layers && loaded.layers.aviation === undefined) loaded.layers.aviation = true;
      // Ensure each city has an aviation-facility slot (added after some saves).
      loaded.cities.forEach((c) => {
        if (!c.aviation) {
          c.aviation = { on: false, address: '', lat: c.center?.[0] ?? 0, lng: c.center?.[1] ?? 0 };
        }
      });
      return loaded;
    }
  } catch {
    /* fall through to a fresh empty state */
  }
  return freshState();
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

/** Download the current state as site-selection-data.json. */
export function exportState(state: AppState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'site-selection-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Parse an imported JSON file into a validated AppState. Throws on bad data. */
export function parseImport(text: string): AppState {
  const data = JSON.parse(text) as AppState;
  if (!data.cities) throw new Error('Missing cities');
  return data;
}
