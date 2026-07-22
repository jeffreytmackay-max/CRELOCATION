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
import {
  exportState,
  freshState,
  loadState,
  parseImport,
  saveState,
} from './lib/storage';
import type {
  AddKind,
  AppState,
  City,
  FactorKey,
  ScoredSite,
  Scores,
} from './types';

let idCounter = 0;
const uid = (p: string) => `${p}${++idCounter}${Date.now()}`;

export interface Store {
  state: AppState;
  /** The currently analyzed city. */
  city: City;
  /** Scored + ranked sites (office injected when enabled). */
  scored: ScoredSite[];
  /** Effective selected id (falls back to rank 1). */
  selId: string;
  /** Weights normalized to sum 1. */
  norm: Scores;
  /** What the user is placing on the map, if anything. */
  addMode: AddKind | null;
  cityModalOpen: boolean;

  registerMap: (map: LeafletMap) => void;
  onMapClick: (lat: number, lng: number) => void;

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

  const startAdd = useCallback((kind: AddKind) => setAddMode(kind), []);
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
            scores: { hospital: 70, airport: 70, commute: 70, space: 70, risk: 70 },
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
            scores: { hospital: 70, airport: 70, commute: 70, space: 70, risk: 70 },
            note: 'Your current office — scored on the same factors as a benchmark for the candidate sites.',
            facts: [['Status', 'Current office']],
          },
          centers: [],
          airports: [],
          sites: [],
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
    registerMap,
    onMapClick,
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
