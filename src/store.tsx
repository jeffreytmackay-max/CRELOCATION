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
import { DEFAULT_WEIGHTS } from './data/factors';
import { normalize, scoreCity } from './lib/scoring';
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

export type MobileView = 'weights' | 'map' | 'details';

export interface Store {
  state: AppState;
  /** The currently analyzed city. */
  city: City;
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

  /** Edit a field on a candidate site in the current city (ignores the office pseudo-site). */
  editSite: (id: string, field: 'area', v: string) => void;
  /** Create a candidate site at a location (from search), select it, and pan to it. */
  addSiteAt: (name: string, lat: number, lng: number) => void;

  setWeight: (key: FactorKey, val: number) => void;
  resetWeights: () => void;
  selectCity: (id: string) => void;
  selectSite: (id: string) => void;

  getDrive: (originId: string, refId: string) => string;
  setDrive: (originId: string, refId: string, val: string) => void;

  togglePanel: () => void;
  toggleLayer: (k: keyof AppState['layers']) => void;
  toggleOffice: (on: boolean) => void;
  setOfficeAddress: (v: string) => void;
  editRef: (
    kind: 'centers' | 'airports',
    id: string,
    field: string,
    v: string,
  ) => void;
  removeRef: (kind: 'centers' | 'airports', id: string) => void;

  addStaff: () => void;
  editStaff: (id: string, field: 'city' | 'state' | 'zip' | 'employees', v: string) => void;
  removeStaff: (id: string) => void;

  /** Append discovered centers/airports, skipping near-duplicates. Returns count added. */
  addDiscoveredRefs: (kind: 'centers' | 'airports', items: DiscoveredPlace[]) => number;

  startAdd: (kind: AddKind) => void;
  cancelAdd: () => void;

  openCityModal: () => void;
  closeCityModal: () => void;
  /** lat/lng may be NaN — falls back to the current map center. */
  addCity: (name: string, state: string, lat: number, lng: number) => void;

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
  const norm = useMemo(() => normalize(state.weights), [state.weights]);
  const scored = useMemo(() => scoreCity(city, state.weights), [city, state.weights]);
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

  const selectSite = useCallback(
    (id: string) => {
      apply((d) => void (d.selectedSiteId = id));
      const s = scored.find((x) => x.id === id);
      if (s && s.lat != null && mapRef.current) mapRef.current.panTo([s.lat, s.lng]);
    },
    [apply, scored],
  );

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
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
          scores: { hospital: 70, airport: 70, commute: 70, space: 70, risk: 70, crime: 70 },
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

  const findCity = (d: AppState) =>
    d.cities.find((c) => c.id === d.cityId) ?? d.cities[0];

  const toggleOffice = useCallback(
    (on: boolean) => apply((d) => void (findCity(d).office.on = on)),
    [apply],
  );
  const setOfficeAddress = useCallback(
    (v: string) => apply((d) => void (findCity(d).office.address = v)),
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

  const addDiscoveredRefs = useCallback(
    (kind: 'centers' | 'airports', items: DiscoveredPlace[]): number => {
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
            c.centers.push({ id: uid('c'), short: it.name, address: it.address, lat: it.lat, lng: it.lng }),
          );
        } else {
          fresh.forEach((it) =>
            c.airports.push({ id: uid('a'), code: it.code || '', name: it.name, lat: it.lat, lng: it.lng }),
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
            scores: { hospital: 70, airport: 70, commute: 70, space: 70, risk: 70, crime: 70 },
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
        } else if (kind === 'center') {
          c.centers.push({ id: uid('c'), short: 'New center', address: '', lat, lng });
        } else if (kind === 'airport') {
          c.airports.push({ id: uid('a'), code: 'XXX', name: '', lat, lng });
        }
      });
    },
    [addMode, apply],
  );

  const openCityModal = useCallback(() => setCityModalOpen(true), []);
  const closeCityModal = useCallback(() => setCityModalOpen(false), []);
  const addCity = useCallback(
    (name: string, st: string, lat: number, lng: number) => {
      const id = `city${Date.now()}`;
      let clat = lat;
      let clng = lng;
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
          center,
          zoom: mapRef.current?.getZoom() ?? 10,
          office: {
            on: false,
            address: '',
            lat: clat,
            lng: clng,
            scores: { hospital: 70, airport: 70, commute: 70, space: 70, risk: 70, crime: 70 },
            note: 'Your current office — scored on the same factors as a benchmark for the candidate sites.',
            facts: [['Status', 'Current office']],
          },
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
      if (mapRef.current) mapRef.current.setView(center, mapRef.current.getZoom() ?? 10);
    },
    [apply],
  );

  const exportData = useCallback(() => exportState(state), [state]);
  const importData = useCallback(async (file: File) => {
    const text = await file.text();
    const data = parseImport(text);
    if (!data.cities.some((c) => c.id === data.cityId)) {
      data.cityId = data.cities[0].id;
    }
    setState(data);
    const c = data.cities.find((x) => x.id === data.cityId) ?? data.cities[0];
    if (mapRef.current) mapRef.current.setView(c.center, c.zoom ?? 10);
  }, []);
  const resetData = useCallback(() => {
    const s = freshState();
    setState(s);
    const c = s.cities[0];
    if (mapRef.current) mapRef.current.setView(c.center, c.zoom);
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
    editSite,
    addSiteAt,
    setWeight,
    resetWeights,
    selectCity,
    selectSite,
    getDrive,
    setDrive,
    togglePanel,
    toggleLayer,
    toggleOffice,
    setOfficeAddress,
    editRef,
    removeRef,
    addStaff,
    editStaff,
    removeStaff,
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
