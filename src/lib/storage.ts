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
        // One-time migration: ranking moved from a 1–5 `importance` field to list
        // order. Sort by any legacy importance (desc), then drop the field so a
        // later drag-reorder isn't undone on the next load.
        (['centers', 'airports'] as const).forEach((k) => {
          const list = c[k] as Array<{ importance?: number }>;
          if (list.some((x) => x.importance !== undefined)) {
            list.sort((a, b) => (b.importance ?? 3) - (a.importance ?? 3));
            list.forEach((x) => delete x.importance);
          }
        });
      });
      return loaded;
    }
  } catch {
    /* fall through to a fresh empty state */
  }
  return freshState();
}

/**
 * Ask the browser to treat our origin's storage as persistent so it is not
 * evicted under storage pressure or by time-based cleanup (e.g. Safari's ~7-day
 * rule). Best-effort — unsupported browsers just ignore it.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage && navigator.storage.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* unsupported — ignore */
  }
  return false;
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
