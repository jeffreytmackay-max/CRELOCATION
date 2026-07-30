import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { DEFAULT_IMPORTANCE, DEFAULT_WEIGHTS, importanceOf } from './data/factors';
import { minutesToScore, normalize, scoreCity } from './lib/scoring';
import { geocode } from './lib/geocode';
import { departureTimestamp, matrix } from './lib/drivetimes';
import type { DiscoveredPlace } from './lib/places';
import {
  exportState,
  freshState,
  loadState,
  parseImport,
  saveState,
} from './lib/storage';
import type { AddKind, AppState, City, FactorKey, ScoredSite } from './types';

let idCounter = 0;
const uid = (p: string) => `${p}${++idCounter}${Date.now()}`;

/** Great-circle distance in km between two lat/lng points. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** A weighted-optimal office suggestion (from proximity, before real drive times). */
export interface Suggestion {
  lat: number;
  lng: number;
  score: number;
  note: string;
}
export interface StaffImportRow {
  city: string;
  state: string;
  zip: string;
  employees: string;
}

export type MobileView = 'weights' | 'map' | 'details';

export interface Store {
  state: AppState;
  /** The currently analyzed city, or undefined when there are no cities yet. */
  city: City | undefined;
  /** Scored + ranked sites (office injected when enabled). */
  scored: ScoredSite[];
  /** Effective selected id (falls back to rank 1). */
  selId: string;
  /** Weights normalized to sum 1. */
  norm: Record<FactorKey, number>;
  /** What the user is placing on the map, if anything. */
  addMode: AddKind | null;
  cityModalOpen: boolean;

  /** True on narrow (phone) viewports — drives the responsive layout. */
  isMobile: boolean;
  /** Active pane on the mobile tab layout. */
  mobileView: MobileView;
  setMobileView: (v: MobileView) => void;

  registerMap: (map: LeafletMap) => void;
  onMapClick: (lat: number, lng: number) => void;
  /** Tell Leaflet to recompute its size (e.g. after the map tab becomes visible). */
  refreshMapSize: () => void;
  /** Zoom/pan the map to frame every candidate site (+ office when enabled). */
  fitAll: () => void;
  /** Pan/zoom the map to a point (used by the on-map location search). */
  flyTo: (lat: number, lng: number, zoom?: number) => void;

  /** Edit a field on a candidate site in the current city (ignores the office pseudo-site). */
  editSite: (id: string, field: 'area', v: string) => void;
  /** Create a candidate site at a location (from search), select it, and pan to it. */
  addSiteAt: (name: string, lat: number, lng: number) => void;
  /**
   * Auto-score the access factors (transplant / airport / staff commute) for
   * every candidate site from traffic-aware drive times. Leaves the other
   * factors untouched. Returns how many sites were updated (or an error).
   */
  autoScoreCity: () => Promise<{ scored: number; error?: string }>;

  /** A proximity-optimal office location suggestion, or null. */
  suggestion: Suggestion | null;
  /** Compute the weighted-best office location from reference points + staff. */
  suggestOffice: () => { ok: boolean; error?: string };
  /** Dismiss the current suggestion marker. */
  clearSuggestion: () => void;

  /* ---- Per-site editing (works for a real site or the "__office" benchmark) ---- */
  setSiteScore: (id: string, key: FactorKey, val: number) => void;
  setSiteText: (id: string, field: 'name' | 'short' | 'note', v: string) => void;
  setFact: (id: string, index: number, which: 0 | 1, v: string) => void;
  addFact: (id: string) => void;
  removeFact: (id: string, index: number) => void;

  setWeight: (key: FactorKey, val: number) => void;
  resetWeights: () => void;
  /** Whether the opt-in real-estate factor counts toward the score. */
  includeSpace: boolean;
  /** Toggle (or set) whether real estate is included in the analysis. */
  toggleIncludeSpace: (on?: boolean) => void;
  selectCity: (id: string) => void;
  deleteCity: (id: string) => void;
  selectSite: (id: string) => void;

  getDrive: (originId: string, refId: string) => string;
  setDrive: (originId: string, refId: string, val: string) => void;

  togglePanel: () => void;
  toggleLayer: (k: keyof AppState['layers']) => void;
  toggleOffice: (on: boolean) => void;
  setOfficeAddress: (v: string) => void;
  /** Toggle the TMDX aviation facility on/off for the current city. */
  toggleAviation: (on: boolean) => void;
  setAviationAddress: (v: string) => void;
  editRef: (
    kind: 'centers' | 'airports',
    id: string,
    field: string,
    v: string,
  ) => void;
  /** Set a transplant center / airport's importance rank (1–5). */
  setRefImportance: (kind: 'centers' | 'airports', id: string, val: number) => void;
  removeRef: (kind: 'centers' | 'airports', id: string) => void;

  addStaff: () => void;
  editStaff: (id: string, field: 'city' | 'state' | 'zip' | 'employees', v: string) => void;
  removeStaff: (id: string) => void;
  /** Set a staff row's geocoded coordinates and reveal the staff map layer. */
  setStaffCoords: (id: string, lat: number, lng: number) => void;
  /** Append staff rows parsed from an uploaded spreadsheet. Returns count added. */
  importStaff: (rows: StaffImportRow[]) => number;

  /** Append discovered centers/airports, skipping near-duplicates. Returns count added. */
  addDiscoveredRefs: (kind: 'centers' | 'airports', items: DiscoveredPlace[]) => number;

  startAdd: (kind: AddKind) => void;
  cancelAdd: () => void;

  openCityModal: () => void;
  closeCityModal: () => void;
  /**
   * Add a metro. lat/lng win when provided; otherwise the center is geocoded
   * from name/state/zip, falling back to the current map center.
   */
  addCity: (
    name: string,
    state: string,
    zip: string,
    lat: number,
    lng: number,
  ) => Promise<void>;

  exportData: () => void;
  importData: (file: File) => Promise<void>;
  resetData: () => void;
}

const AppContext = createContext<Store | null>(null);

export function useApp(): Store {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);
  const [addMode, setAddMode] = useState<AddKind | null>(null);
  const [cityModalOpen, setCityModalOpen] = useState(false);
  const mapRef = useRef<LeafletMap | null>(null);

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>('weights');
  const [isMobile, setIsMobile] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Persist on every change.
  useEffect(() => {
    saveState(state);
  }, [state]);

  // A suggestion is tied to the current city's data — drop it when the city changes.
  useEffect(() => {
    setSuggestion(null);
  }, [state.cityId]);

  /** Immutable update via a mutable clone. */
  const apply = useCallback((mut: (draft: AppState) => void) => {
    setState((prev) => {
      const draft = structuredClone(prev);
      mut(draft);
      return draft;
    });
  }, []);

  const city = useMemo(
    () => state.cities.find((c) => c.id === state.cityId) ?? state.cities[0],
    [state.cities, state.cityId],
  );
  const norm = useMemo(
    () => normalize(state.weights, state.includeSpace),
    [state.weights, state.includeSpace],
  );
  const scored = useMemo(
    () => (city ? scoreCity(city, state.weights, state.includeSpace) : []),
    [city, state.weights, state.includeSpace],
  );
  const selId = useMemo(() => {
    const stored = state.selectedSiteId;
    if (stored && scored.some((s) => s.id === stored)) return stored;
    return scored[0]?.id ?? '';
  }, [state.selectedSiteId, scored]);

  const registerMap = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);
  const refreshMapSize = useCallback(() => {
    mapRef.current?.invalidateSize();
  }, []);

  const setWeight = useCallback(
    (key: FactorKey, val: number) => apply((d) => void (d.weights[key] = val)),
    [apply],
  );
  const resetWeights = useCallback(
    () => apply((d) => void (d.weights = { ...DEFAULT_WEIGHTS })),
    [apply],
  );
  const toggleIncludeSpace = useCallback(
    (on?: boolean) =>
      apply((d) => void (d.includeSpace = on === undefined ? !d.includeSpace : on)),
    [apply],
  );

  const selectCity = useCallback(
    (id: string) => {
      apply((d) => {
        d.cityId = id;
        d.selectedSiteId = null;
      });
      const c = state.cities.find((x) => x.id === id);
      if (c && mapRef.current) mapRef.current.setView(c.center, c.zoom);
    },
    [apply, state.cities],
  );

  const deleteCity = useCallback(
    (id: string) => {
      let next: City | undefined;
      apply((d) => {
        d.cities = d.cities.filter((c) => c.id !== id);
        delete d.driveTimes[id];
        if (d.cityId === id) {
          next = d.cities[0];
          d.cityId = next?.id ?? '';
          d.selectedSiteId = null;
        }
      });
      if (next && mapRef.current) mapRef.current.setView(next.center, next.zoom);
    },
    [apply],
  );

  const selectSite = useCallback(
    (id: string) => {
      apply((d) => void (d.selectedSiteId = id));
      const s = scored.find((x) => x.id === id);
      if (s && s.lat != null && mapRef.current) mapRef.current.panTo([s.lat, s.lng]);
    },
    [apply, scored],
  );

  const flyTo = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([lat, lng], zoom ?? Math.max(map.getZoom() ?? 12, 13));
  }, []);

  const clearSuggestion = useCallback(() => setSuggestion(null), []);

  const suggestOffice = useCallback((): { ok: boolean; error?: string } => {
    if (!city) return { ok: false, error: 'No city selected.' };
    const centers = city.centers
      .filter((c) => c.lat != null && c.lng != null)
      .map((c) => ({ lat: c.lat, lng: c.lng, imp: importanceOf(c) }));
    const airports = city.airports
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => ({ lat: a.lat, lng: a.lng, imp: importanceOf(a) }));
    const staff = (city.staff ?? [])
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ lat: s.lat as number, lng: s.lng as number, w: Math.max(1, parseInt(s.employees, 10) || 0) }));
    const useHosp = centers.length > 0;
    const useAir = airports.length > 0;
    const useCommute = staff.length > 0;
    if (!useHosp && !useAir && !useCommute) {
      return {
        ok: false,
        error: 'Add transplant centers or airports, and plot staff on the map, to optimize.',
      };
    }

    const w = state.weights;
    const anchors = [...centers, ...airports, ...staff.map((s) => ({ lat: s.lat, lng: s.lng }))];
    let minLat = Math.min(...anchors.map((a) => a.lat));
    let maxLat = Math.max(...anchors.map((a) => a.lat));
    let minLng = Math.min(...anchors.map((a) => a.lng));
    let maxLng = Math.max(...anchors.map((a) => a.lng));
    const padLat = (maxLat - minLat) * 0.12 + 0.03;
    const padLng = (maxLng - minLng) * 0.12 + 0.03;
    minLat -= padLat;
    maxLat += padLat;
    minLng -= padLng;
    maxLng += padLng;

    // Convert a straight-line distance to the same 0–100 access scale used
    // elsewhere: ~40 km/h city driving → minutes, then minutesToScore.
    const distScore = (km: number) => minutesToScore(km * 1.5);
    const totalW = staff.reduce((a, s) => a + s.w, 0);
    // Importance-weighted proximity score across a set of reference points.
    const impDistScore = (refs: { lat: number; lng: number; imp: number }[], at: { lat: number; lng: number }) => {
      let iw = 0;
      let iws = 0;
      refs.forEach((r) => {
        iw += r.imp;
        iws += r.imp * distScore(haversineKm(r, at));
      });
      return iw > 0 ? iws / iw : 0;
    };

    const scoreAt = (lat: number, lng: number): number => {
      let sum = 0;
      let wt = 0;
      const at = { lat, lng };
      if (useHosp) {
        sum += impDistScore(centers, at) * w.hospital;
        wt += w.hospital;
      }
      if (useAir) {
        sum += impDistScore(airports, at) * w.airport;
        wt += w.airport;
      }
      if (useCommute) {
        const d = staff.reduce((a, s) => a + s.w * haversineKm(s, at), 0) / totalW;
        sum += distScore(d) * w.commute;
        wt += w.commute;
      }
      return wt > 0 ? sum / wt : 0;
    };

    const gridSearch = (aLat: number, bLat: number, aLng: number, bLng: number, N: number) => {
      let best = { lat: (aLat + bLat) / 2, lng: (aLng + bLng) / 2 };
      let bestS = -Infinity;
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const lat = N === 1 ? (aLat + bLat) / 2 : aLat + ((bLat - aLat) * i) / (N - 1);
          const lng = N === 1 ? (aLng + bLng) / 2 : aLng + ((bLng - aLng) * j) / (N - 1);
          const s = scoreAt(lat, lng);
          if (s > bestS) {
            bestS = s;
            best = { lat, lng };
          }
        }
      }
      return { best, bestS };
    };

    // Coarse sweep, then refine within one cell of the best point.
    let { best, bestS } = gridSearch(minLat, maxLat, minLng, maxLng, 24);
    const rLat = (maxLat - minLat) / 24;
    const rLng = (maxLng - minLng) / 24;
    ({ best, bestS } = gridSearch(best.lat - rLat, best.lat + rLat, best.lng - rLng, best.lng + rLng, 16));

    const note = [useHosp && 'transplant centers', useAir && 'airports', useCommute && 'staff commute']
      .filter(Boolean)
      .join(', ');
    setSuggestion({ lat: best.lat, lng: best.lng, score: Math.round(bestS), note });
    flyTo(best.lat, best.lng, 11);
    if (isMobile) setMobileView('map');
    return { ok: true };
  }, [city, state.weights, flyTo, isMobile]);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || !city) return;
    const pts: [number, number][] = city.sites
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => [s.lat, s.lng]);
    if (city.office.on && city.office.lat != null && city.office.lng != null) {
      pts.push([city.office.lat, city.office.lng]);
    }
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView(pts[0], 12);
      return;
    }
    map.fitBounds(pts, { padding: [60, 60], maxZoom: 14 });
  }, [city]);

  const editSite = useCallback(
    (id: string, field: 'area', v: string) =>
      apply((d) => {
        const s = findCity(d).sites.find((x) => x.id === id);
        if (s) s[field] = v;
      }),
    [apply],
  );

  const addSiteAt = useCallback(
    (name: string, lat: number, lng: number) => {
      const id = uid('s');
      // Use the first segment (e.g. "Conroe") as the short map label.
      const short = name.split(',')[0].trim() || name;
      apply((d) => {
        findCity(d).sites.push({
          id,
          name: short,
          short,
          lat,
          lng,
          scores: { hospital: 70, airport: 70, commute: 70, space: 70 },
          note: 'Added by search — adjust its factor scores and facts.',
          facts: [
            ['Asking rent', '—'],
            ['Space available', '—'],
            ['Nearest transplant ctr', '—'],
          ],
          area: name,
        });
        d.selectedSiteId = id;
      });
      if (mapRef.current) mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom() ?? 11, 11));
      if (isMobile) setMobileView('map');
    },
    [apply, isMobile],
  );

  const autoScoreCity = useCallback(async (): Promise<{ scored: number; error?: string }> => {
    if (!city) return { scored: 0, error: 'No city selected.' };
    const sites = city.sites.filter((s) => s.lat != null && s.lng != null);
    if (!sites.length) return { scored: 0, error: 'Add candidate sites first.' };
    const centers = city.centers.filter((c) => c.lat != null && c.lng != null);
    const airports = city.airports.filter((a) => a.lat != null && a.lng != null);
    const staff = (city.staff ?? []).filter((s) => s.lat != null && s.lng != null);
    if (!centers.length && !airports.length && !staff.length) {
      return {
        scored: 0,
        error: 'Add transplant centers or airports, or plot staff on the map, first.',
      };
    }

    const dep = departureTimestamp('weekday-8'); // typical morning traffic
    const sitePts = sites.map((s) => ({ lat: s.lat, lng: s.lng }));
    const refPts = [...centers, ...airports].map((r) => ({ lat: r.lat, lng: r.lng }));
    const staffPts = staff.map((s) => ({ lat: s.lat as number, lng: s.lng as number }));

    let siteToRef: (number | null)[][] = [];
    let staffToSite: (number | null)[][] = [];
    try {
      if (refPts.length) siteToRef = await matrix(sitePts, refPts, dep);
      if (staffPts.length) staffToSite = await matrix(staffPts, sitePts, dep);
    } catch (e) {
      return { scored: 0, error: e instanceof Error ? e.message : 'Drive-time lookup failed.' };
    }

    // Importance-weighted average of the per-reference drive-time scores, so
    // proximity to the higher-ranked centers/airports counts for more.
    const weightedScore = (
      refs: { importance?: number }[],
      mins: (number | null)[],
    ): number | null => {
      let w = 0;
      let ws = 0;
      refs.forEach((r, k) => {
        const m = mins[k];
        if (m == null) return;
        const imp = importanceOf(r);
        w += imp;
        ws += imp * minutesToScore(m);
      });
      return w > 0 ? Math.round(ws / w) : null;
    };

    const updates = new Map<string, { hospital?: number; airport?: number; commute?: number }>();
    sites.forEach((site, i) => {
      const u: { hospital?: number; airport?: number; commute?: number } = {};
      const row = siteToRef[i] ?? [];
      const hospital = weightedScore(centers, row.slice(0, centers.length));
      const airport = weightedScore(airports, row.slice(centers.length));
      if (hospital != null) u.hospital = hospital;
      if (airport != null) u.airport = airport;
      // Staff commute — headcount-weighted average drive time to this site.
      let sumW = 0;
      let sumWM = 0;
      staff.forEach((st, j) => {
        const m = staffToSite[j]?.[i];
        if (m == null) return;
        const w = Math.max(parseInt(st.employees, 10) || 0, 1);
        sumW += w;
        sumWM += m * w;
      });
      if (sumW > 0) u.commute = minutesToScore(sumWM / sumW);
      if (u.hospital != null || u.airport != null || u.commute != null) updates.set(site.id, u);
    });

    if (!updates.size) {
      return { scored: 0, error: 'Could not compute drive times — check the Distance Matrix API.' };
    }
    apply((d) => {
      const c = findCity(d);
      updates.forEach((u, id) => {
        const s = c.sites.find((x) => x.id === id);
        if (!s) return;
        if (u.hospital != null) s.scores.hospital = u.hospital;
        if (u.airport != null) s.scores.airport = u.airport;
        if (u.commute != null) s.scores.commute = u.commute;
      });
    });
    return { scored: updates.size };
  }, [city, apply]);

  /** The editable target for an id: a real site, or the office for "__office". */
  const siteTarget = (d: AppState, id: string) =>
    id === '__office' ? findCity(d).office : findCity(d).sites.find((s) => s.id === id);

  const setSiteScore = useCallback(
    (id: string, key: FactorKey, val: number) =>
      apply((d) => {
        const t = siteTarget(d, id);
        if (t) t.scores[key] = Math.max(0, Math.min(100, Math.round(val || 0)));
      }),
    [apply],
  );
  const setSiteText = useCallback(
    (id: string, field: 'name' | 'short' | 'note', v: string) =>
      apply((d) => {
        const t = siteTarget(d, id);
        if (!t) return;
        if (field === 'note') t.note = v;
        else if ('name' in t) t[field] = v; // name/short only exist on real sites
      }),
    [apply],
  );
  const setFact = useCallback(
    (id: string, index: number, which: 0 | 1, v: string) =>
      apply((d) => {
        const t = siteTarget(d, id);
        if (t && t.facts[index]) t.facts[index][which] = v;
      }),
    [apply],
  );
  const addFact = useCallback(
    (id: string) =>
      apply((d) => {
        const t = siteTarget(d, id);
        if (t) t.facts.push(['', '']);
      }),
    [apply],
  );
  const removeFact = useCallback(
    (id: string, index: number) =>
      apply((d) => {
        const t = siteTarget(d, id);
        if (t) t.facts.splice(index, 1);
      }),
    [apply],
  );

  const getDrive = useCallback(
    (originId: string, refId: string) =>
      state.driveTimes[state.cityId]?.[originId]?.[refId] ?? '',
    [state.driveTimes, state.cityId],
  );
  const setDrive = useCallback(
    (originId: string, refId: string, val: string) => {
      const clean = String(val).replace(/[^0-9]/g, '');
      apply((d) => {
        const c = (d.driveTimes[d.cityId] ??= {});
        const o = (c[originId] ??= {});
        o[refId] = clean;
      });
    },
    [apply],
  );

  const togglePanel = useCallback(
    () => apply((d) => void (d.panelOpen = !d.panelOpen)),
    [apply],
  );
  const toggleLayer = useCallback(
    (k: keyof AppState['layers']) =>
      apply((d) => void (d.layers[k] = !d.layers[k])),
    [apply],
  );

  // Callers below only run from UI that requires an active city, so the
  // fallback is asserted non-null.
  const findCity = (d: AppState): City =>
    d.cities.find((c) => c.id === d.cityId) ?? d.cities[0]!;

  const toggleOffice = useCallback(
    (on: boolean) => apply((d) => void (findCity(d).office.on = on)),
    [apply],
  );
  const setOfficeAddress = useCallback(
    (v: string) => apply((d) => void (findCity(d).office.address = v)),
    [apply],
  );

  /** Ensure the current city has an aviation-facility object; returns it. */
  const ensureAviation = (c: City) =>
    (c.aviation ??= { on: false, address: '', lat: c.center[0], lng: c.center[1] });
  const toggleAviation = useCallback(
    (on: boolean) =>
      apply((d) => {
        const c = findCity(d);
        ensureAviation(c).on = on;
        if (on) d.layers.aviation = true;
      }),
    [apply],
  );
  const setAviationAddress = useCallback(
    (v: string) => apply((d) => void (ensureAviation(findCity(d)).address = v)),
    [apply],
  );

  const setRefImportance = useCallback(
    (kind: 'centers' | 'airports', id: string, val: number) =>
      apply((d) => {
        const item = findCity(d)[kind].find((x) => x.id === id);
        if (item) item.importance = Math.max(1, Math.min(5, Math.round(val) || DEFAULT_IMPORTANCE));
      }),
    [apply],
  );
  const editRef = useCallback(
    (kind: 'centers' | 'airports', id: string, field: string, v: string) =>
      apply((d) => {
        const item = findCity(d)[kind].find((x) => x.id === id) as
          | Record<string, unknown>
          | undefined;
        if (item) item[field] = v;
      }),
    [apply],
  );
  const removeRef = useCallback(
    (kind: 'centers' | 'airports', id: string) =>
      apply((d) => {
        const c = findCity(d);
        c[kind] = c[kind].filter((x) => x.id !== id) as never;
      }),
    [apply],
  );

  const addStaff = useCallback(
    () =>
      apply((d) => {
        const c = findCity(d);
        (c.staff ??= []).push({ id: uid('st'), city: '', state: '', zip: '', employees: '' });
      }),
    [apply],
  );
  const editStaff = useCallback(
    (id: string, field: 'city' | 'state' | 'zip' | 'employees', v: string) =>
      apply((d) => {
        const item = (findCity(d).staff ??= []).find((x) => x.id === id);
        if (!item) return;
        item[field] = field === 'employees' ? v.replace(/[^0-9]/g, '') : v;
        // Address changed → drop stale coordinates until re-plotted.
        if (field !== 'employees') {
          item.lat = undefined;
          item.lng = undefined;
        }
      }),
    [apply],
  );
  const setStaffCoords = useCallback(
    (id: string, lat: number, lng: number) =>
      apply((d) => {
        const item = (findCity(d).staff ??= []).find((x) => x.id === id);
        if (!item) return;
        item.lat = lat;
        item.lng = lng;
        d.layers.staff = true; // reveal the layer once anything is plotted
      }),
    [apply],
  );
  const removeStaff = useCallback(
    (id: string) =>
      apply((d) => {
        const c = findCity(d);
        c.staff = (c.staff ?? []).filter((x) => x.id !== id);
      }),
    [apply],
  );
  const importStaff = useCallback(
    (rows: StaffImportRow[]): number => {
      const clean = rows.filter((r) => r.city.trim() || r.zip.trim() || r.state.trim());
      apply((d) => {
        const c = findCity(d);
        c.staff ??= [];
        for (const r of clean) {
          c.staff.push({
            id: uid('st'),
            city: r.city.trim(),
            state: r.state.trim().toUpperCase().slice(0, 2),
            zip: r.zip.trim(),
            employees: (r.employees || '').replace(/[^0-9]/g, ''),
          });
        }
      });
      return clean.length;
    },
    [apply],
  );

  const addDiscoveredRefs = useCallback(
    (kind: 'centers' | 'airports', items: DiscoveredPlace[]): number => {
      if (!city) return 0;
      const existing: { lat: number; lng: number }[] =
        kind === 'centers' ? city.centers : city.airports;
      // ~0.004° ≈ 400 m — treats results at the same site as duplicates.
      const near = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
        Math.abs(a.lat - b.lat) < 0.004 && Math.abs(a.lng - b.lng) < 0.004;
      const fresh: DiscoveredPlace[] = [];
      items.forEach((it) => {
        if (!existing.some((e) => near(e, it)) && !fresh.some((f) => near(f, it))) {
          fresh.push(it);
        }
      });
      if (!fresh.length) return 0;
      apply((d) => {
        const c = findCity(d);
        if (kind === 'centers') {
          fresh.forEach((it) =>
            c.centers.push({
              id: uid('c'),
              short: it.name,
              address: it.address,
              lat: it.lat,
              lng: it.lng,
              importance: DEFAULT_IMPORTANCE,
            }),
          );
        } else {
          fresh.forEach((it) =>
            c.airports.push({
              id: uid('a'),
              code: it.code || '',
              name: it.name,
              lat: it.lat,
              lng: it.lng,
              importance: DEFAULT_IMPORTANCE,
            }),
          );
        }
      });
      return fresh.length;
    },
    [apply, city],
  );

  const startAdd = useCallback(
    (kind: AddKind) => {
      setAddMode(kind);
      // On mobile the full-screen panel would cover the map — reveal it.
      if (isMobile) {
        setMobileView('map');
        apply((d) => void (d.panelOpen = false));
      }
    },
    [isMobile, apply],
  );
  const cancelAdd = useCallback(() => setAddMode(null), []);

  const onMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!addMode) return;
      const kind = addMode;
      setAddMode(null);
      if (kind === 'site') {
        const nm = window.prompt('Name this candidate site:', 'New site');
        if (nm === null) return;
        apply((d) => {
          findCity(d).sites.push({
            id: uid('s'),
            name: nm || 'New site',
            short: nm || 'New site',
            lat,
            lng,
            scores: { hospital: 70, airport: 70, commute: 70, space: 70 },
            note: 'New candidate site — adjust its factor scores and facts.',
            facts: [
              ['Asking rent', '—'],
              ['Space available', '—'],
              ['Nearest transplant ctr', '—'],
            ],
          });
        });
        return;
      }
      apply((d) => {
        const c = findCity(d);
        if (kind === 'office') {
          c.office.on = true;
          c.office.lat = lat;
          c.office.lng = lng;
        } else if (kind === 'aviation') {
          c.aviation = { on: true, address: c.aviation?.address ?? '', lat, lng };
          d.layers.aviation = true;
        } else if (kind === 'center') {
          c.centers.push({
            id: uid('c'),
            short: 'New center',
            address: '',
            lat,
            lng,
            importance: DEFAULT_IMPORTANCE,
          });
        } else if (kind === 'airport') {
          c.airports.push({
            id: uid('a'),
            code: 'XXX',
            name: '',
            lat,
            lng,
            importance: DEFAULT_IMPORTANCE,
          });
        }
      });
    },
    [addMode, apply],
  );

  const openCityModal = useCallback(() => setCityModalOpen(true), []);
  const closeCityModal = useCallback(() => setCityModalOpen(false), []);
  const addCity = useCallback(
    async (name: string, st: string, zip: string, lat: number, lng: number) => {
      const id = `city${Date.now()}`;
      let clat = lat;
      let clng = lng;
      let zoom = mapRef.current?.getZoom() ?? 11;
      // No explicit lat/lng → geocode from name / state / ZIP.
      if (Number.isNaN(clat) || Number.isNaN(clng)) {
        const q = [name, st, zip].map((x) => (x || '').trim()).filter(Boolean).join(', ');
        if (q) {
          try {
            const r = await geocode(q);
            if (r[0]) {
              clat = r[0].lat;
              clng = r[0].lng;
              zoom = 11;
            }
          } catch {
            /* geocoding unavailable — fall back below */
          }
        }
      }
      // Still nothing → current map center, else continental-US center.
      if (Number.isNaN(clat) || Number.isNaN(clng)) {
        const c = mapRef.current?.getCenter();
        clat = c?.lat ?? 39.5;
        clng = c?.lng ?? -98.35;
      }
      const center: [number, number] = [clat, clng];
      apply((d) => {
        d.cities.push({
          id,
          name,
          state: st,
          zip: zip.trim() || undefined,
          center,
          zoom,
          office: {
            on: false,
            address: '',
            lat: clat,
            lng: clng,
            scores: { hospital: 70, airport: 70, commute: 70, space: 70 },
            note: 'Your current office — scored on the same factors as a benchmark for the candidate sites.',
            facts: [['Status', 'Current office']],
          },
          aviation: { on: false, address: '', lat: clat, lng: clng },
          centers: [],
          airports: [],
          sites: [],
          staff: [],
        });
        d.cityId = id;
        d.selectedSiteId = null;
        d.panelOpen = true;
      });
      setCityModalOpen(false);
      if (mapRef.current) mapRef.current.setView(center, zoom);
    },
    [apply],
  );

  const exportData = useCallback(() => exportState(state), [state]);
  const importData = useCallback(async (file: File) => {
    const text = await file.text();
    const data = parseImport(text);
    if (!data.cities.some((c) => c.id === data.cityId)) {
      data.cityId = data.cities[0]?.id ?? '';
    }
    setState(data);
    const c = data.cities.find((x) => x.id === data.cityId) ?? data.cities[0];
    if (c && mapRef.current) mapRef.current.setView(c.center, c.zoom ?? 10);
  }, []);
  const resetData = useCallback(() => {
    setState(freshState());
  }, []);

  const store: Store = {
    state,
    city,
    scored,
    selId,
    norm,
    addMode,
    cityModalOpen,
    isMobile,
    mobileView,
    setMobileView,
    registerMap,
    onMapClick,
    refreshMapSize,
    fitAll,
    flyTo,
    editSite,
    addSiteAt,
    autoScoreCity,
    suggestion,
    suggestOffice,
    clearSuggestion,
    setSiteScore,
    setSiteText,
    setFact,
    addFact,
    removeFact,
    setWeight,
    resetWeights,
    includeSpace: state.includeSpace,
    toggleIncludeSpace,
    selectCity,
    deleteCity,
    selectSite,
    getDrive,
    setDrive,
    togglePanel,
    toggleLayer,
    toggleOffice,
    setOfficeAddress,
    toggleAviation,
    setAviationAddress,
    editRef,
    setRefImportance,
    removeRef,
    addStaff,
    editStaff,
    removeStaff,
    setStaffCoords,
    importStaff,
    addDiscoveredRefs,
    startAdd,
    cancelAdd,
    openCityModal,
    closeCityModal,
    addCity,
    exportData,
    importData,
    resetData,
  };

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}
