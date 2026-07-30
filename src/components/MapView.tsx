import { useEffect, useState } from 'react';
import L from 'leaflet';
import {
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { importanceOf } from '../data/factors';
import { geocode, type GeocodeResult } from '../lib/geocode';
import { scoreColor } from '../lib/scoring';
import { useApp } from '../store';
import { Legend } from './Legend';

/** Compact importance badge for a reference tooltip (e.g. "★5"). */
function priorityStars(imp: number): string {
  return `★${imp}`;
}

/** Registers the map instance, wires click-to-place, keeps size in sync. */
function MapController() {
  const map = useMap();
  const { registerMap, onMapClick, addMode } = useApp();

  useEffect(() => {
    registerMap(map);
    // Leaflet needs a nudge once the flex layout has settled.
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 60);
    const t2 = setTimeout(fix, 300);
    window.addEventListener('resize', fix);
    const ro = new ResizeObserver(fix);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', fix);
      ro.disconnect();
    };
  }, [map, registerMap]);

  useEffect(() => {
    map.getContainer().style.cursor = addMode ? 'crosshair' : '';
  }, [map, addMode]);

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  return null;
}

// Reference markers scale with importance (1–5) so higher-ranked ones read bigger.
function centerIcon(importance = 3) {
  const d = 14 + (importance - 1) * 3; // 14 → 26
  return L.divIcon({
    className: '',
    html: `<div class="sx-mark" style="width:${d}px;height:${d}px;border-radius:4px;background:#9d2235;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:${Math.round(d * 0.62)}px">+</div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}
function airportIcon(importance = 3) {
  const w = 16 + (importance - 1) * 3; // 16 → 28
  const h = Math.round(w * 0.8);
  return L.divIcon({
    className: '',
    html: `<div class="sx-mark" style="width:${w}px;height:${h}px;border-radius:4px;background:#44546a;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:0">✈</div>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h / 2],
  });
}
function aviationIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="sx-mark" style="width:24px;height:24px;border-radius:6px;background:#0e7490;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:13px">✈</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
function officeIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:15px;height:15px;background:#302f32;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px rgba(0,0,0,.35)"></div>`,
    iconSize: [19, 19],
    iconAnchor: [9, 9],
  });
}
function staffIcon(count: number) {
  const label = count > 0 ? String(count) : '·';
  const d = 24;
  return L.divIcon({
    className: '',
    html: `<div class="sx-mark" style="width:${d}px;height:${d}px;border-radius:50%;background:#1f8f5f;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);font-size:12px">${label}</div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d / 2],
  });
}
/** Blue teardrop pin marking a location returned by the on-map search. */
function foundIcon() {
  return L.divIcon({
    className: '',
    html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 1C7 1 1.5 6.5 1.5 13.4 1.5 22.6 14 37 14 37s12.5-14.4 12.5-23.6C26.5 6.5 21 1 14 1z" fill="#2b6cb0" stroke="#fff" stroke-width="2.5"/>
      <circle cx="14" cy="13.4" r="5.2" fill="#fff"/>
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 37],
  });
}
/** Gold star pin marking the weighted-optimal office suggestion. */
function suggestIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:34px;height:44px">
      <svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
        <path d="M17 1C8.7 1 2 7.7 2 16c0 11 15 27 15 27s15-16 15-27C32 7.7 25.3 1 17 1z" fill="#dd9b1f" stroke="#fff" stroke-width="2.5"/>
      </svg>
      <div style="position:absolute;top:7px;left:0;width:34px;text-align:center;color:#fff;font-size:16px;line-height:1">★</div>
    </div>`,
    iconSize: [34, 44],
    iconAnchor: [17, 43],
  });
}
function siteIcon(score: number, color: string, selected: boolean, d: number) {
  const html = `<div style="position:relative"><div class="sx-mark" style="width:${d}px;height:${d}px;border-radius:50%;background:${color};border:${
    selected ? '3px solid #9d2235' : '2.5px solid #fff'
  };box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:${Math.round(d * 0.42)}px">${score}</div></div>`;
  return L.divIcon({ className: '', html, iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
}

/** Center column: interactive Leaflet map with all marker layers + overlays. */
export function MapView() {
  const { city, state, scored, selId, selectSite, addMode, cancelAdd, fitAll, suggestion } =
    useApp();
  const [found, setFound] = useState<GeocodeResult | null>(null);
  if (!city) return null;
  const Ly = state.layers;

  return (
    <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      <MapContainer
        center={city.center}
        zoom={city.zoom}
        zoomControl={false}
        attributionControl
        style={{ position: 'absolute', inset: 0 }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution="© OpenStreetMap contributors"
        />
        <ZoomControl position="bottomright" />
        <MapController />

        {found && (
          <Marker position={[found.lat, found.lng]} icon={foundIcon()} zIndexOffset={2000}>
            <Tooltip permanent direction="top" offset={[0, -34]} className="sx-tt sx-tt-ref">
              {found.name.split(',').slice(0, 2).join(',')}
            </Tooltip>
          </Marker>
        )}

        {suggestion && (
          <Marker position={[suggestion.lat, suggestion.lng]} icon={suggestIcon()} zIndexOffset={2500}>
            <Tooltip permanent direction="top" offset={[0, -40]} className="sx-tt sx-tt-ref">
              Suggested office · ≈{suggestion.score}
            </Tooltip>
          </Marker>
        )}

        {Ly.centers &&
          city.centers.map((c) =>
            c.lat == null ? null : (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={centerIcon(importanceOf(c))}>
                <Tooltip permanent direction="top" offset={[0, -11]} className="sx-tt sx-tt-ref">
                  {c.short || 'Center'} {priorityStars(importanceOf(c))}
                </Tooltip>
              </Marker>
            ),
          )}

        {Ly.airports &&
          city.airports.map((a) =>
            a.lat == null ? null : (
              <Marker key={a.id} position={[a.lat, a.lng]} icon={airportIcon(importanceOf(a))}>
                <Tooltip permanent direction="top" offset={[0, -10]} className="sx-tt sx-tt-ref">
                  {(a.code || '?').toUpperCase()} {priorityStars(importanceOf(a))}
                </Tooltip>
              </Marker>
            ),
          )}

        {Ly.aviation && city.aviation?.on && city.aviation.lat != null && (
          <Marker position={[city.aviation.lat, city.aviation.lng]} icon={aviationIcon()}>
            <Tooltip permanent direction="top" offset={[0, -13]} className="sx-tt sx-tt-ref">
              TMDX Aviation
            </Tooltip>
          </Marker>
        )}

        {Ly.office && city.office.on && city.office.lat != null && (
          <Marker position={[city.office.lat, city.office.lng]} icon={officeIcon()}>
            <Tooltip permanent direction="top" offset={[0, -11]} className="sx-tt sx-tt-ref">
              Your office
            </Tooltip>
          </Marker>
        )}

        {Ly.staff &&
          (city.staff ?? []).map((s) =>
            s.lat == null || s.lng == null ? null : (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={staffIcon(parseInt(s.employees, 10) || 0)}>
                <Tooltip permanent direction="top" offset={[0, -13]} className="sx-tt sx-tt-ref">
                  {s.city || 'Staff'}
                </Tooltip>
              </Marker>
            ),
          )}

        {scored
          .filter((s) => !s.isOffice && s.lat != null)
          .map((s) => {
            const col = scoreColor(s.composite);
            const isSel = s.id === selId;
            const d = Math.round(26 + ((s.composite - 50) / 50) * 18);
            return (
              <Marker
                key={s.id}
                position={[s.lat, s.lng]}
                icon={siteIcon(s.composite, col, isSel, d)}
                zIndexOffset={isSel ? 1000 : 0}
                eventHandlers={{ click: () => selectSite(s.id) }}
              >
                <Tooltip permanent direction="bottom" offset={[0, d / 2]} className="sx-tt">
                  {s.short}
                </Tooltip>
              </Marker>
            );
          })}
      </MapContainer>

      {addMode && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 800,
            padding: '9px 16px',
            borderRadius: 999,
            background: 'var(--tmdx-crimson)',
            color: '#fff',
            fontSize: 12.5,
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(48,47,50,.3)',
          }}
        >
          <span>
            {addMode === 'center'
              ? 'Click the map to place a transplant center'
              : addMode === 'airport'
                ? 'Click the map to place an airport'
                : addMode === 'site'
                  ? 'Click the map to place a candidate site'
                  : addMode === 'aviation'
                    ? 'Click the map to place the TMDX aviation facility'
                    : 'Click the map to place your office'}
          </span>
          <button
            onClick={cancelAdd}
            style={{
              marginLeft: 10,
              background: 'rgba(255,255,255,.2)',
              border: 'none',
              color: '#fff',
              borderRadius: 999,
              width: 20,
              height: 20,
              cursor: 'pointer',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      {!addMode && <MapSearch found={found} setFound={setFound} />}

      <div
        style={{
          position: 'absolute',
          top: addMode ? 14 : 66,
          left: 14,
          zIndex: 799,
          padding: '9px 13px',
          borderRadius: 12,
          background: 'rgba(255,255,255,.94)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--brand-primary)',
          }}
        >
          {city.name} metro
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-body)', marginTop: 2 }}>
          Candidate submarkets · scaled &amp; colored by live score
        </div>
      </div>

      <button
        onClick={fitAll}
        title="Zoom to show every candidate site across the metro"
        style={{
          position: 'absolute',
          top: 14,
          right: 14,
          zIndex: 800,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '8px 13px',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--text-strong)',
          background: 'rgba(255,255,255,.94)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        Fit all sites
      </button>

      <Legend />
    </div>
  );
}

/** Glassy on-map search: geocode a place, fly there, drop a pin, optionally add it. */
function MapSearch({
  found,
  setFound,
}: {
  found: GeocodeResult | null;
  setFound: (r: GeocodeResult | null) => void;
}) {
  const { flyTo, addSiteAt } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const list = await geocode(query);
      if (!list.length) setError('No matches — try a more specific place or address.');
      else if (list.length === 1) go(list[0]);
      else setResults(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  function go(r: GeocodeResult) {
    flyTo(r.lat, r.lng, 14);
    setFound(r);
    setResults(null);
    setError(null);
    setQ(r.name);
  }

  function clear() {
    setFound(null);
    setResults(null);
    setError(null);
    setQ('');
  }

  const panel: React.CSSProperties = {
    marginTop: 6,
    borderRadius: 10,
    overflow: 'hidden',
    background: '#fff',
    border: '1px solid var(--border-subtle)',
    boxShadow: 'var(--shadow-sm)',
  };

  return (
    <div style={{ position: 'absolute', top: 14, left: 14, right: 138, maxWidth: 380, zIndex: 802 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px 0 12px',
          height: 40,
          borderRadius: 12,
          background: 'rgba(255,255,255,.96)',
          backdropFilter: 'blur(6px)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={2.4}
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
            if (e.key === 'Escape') clear();
          }}
          placeholder="Search for a place or address…"
          aria-label="Search the map for a place or address"
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--text-strong)',
          }}
        />
        {(q || found) && (
          <button
            onClick={clear}
            title="Clear"
            aria-label="Clear search"
            style={{
              flex: 'none',
              width: 22,
              height: 22,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--tmdx-neutral-200)',
              color: 'var(--text-body)',
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
        <button
          onClick={search}
          disabled={busy}
          className="sx-btn sx-btn-sm sx-btn-primary"
          style={{ flex: 'none', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? '…' : 'Search'}
        </button>
      </div>

      {error && (
        <div
          style={{
            ...panel,
            padding: '9px 12px',
            fontSize: 12,
            color: 'var(--tmdx-crimson)',
            background: '#fff',
          }}
        >
          {error}
        </div>
      )}

      {results && results.length > 0 && (
        <div style={panel}>
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => go(r)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 12px',
                fontFamily: 'var(--font-sans)',
                fontSize: 12.5,
                color: 'var(--text-strong)',
                background: '#fff',
                border: 'none',
                borderTop: i ? '1px solid var(--border-subtle)' : 'none',
                cursor: 'pointer',
              }}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {found && !results && (
        <div style={{ ...panel, padding: 10 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-strong)', marginBottom: 8 }}>{found.name}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="sx-btn sx-btn-sm sx-btn-primary"
              onClick={() => {
                addSiteAt(found.name, found.lat, found.lng);
                clear();
              }}
              style={{ flex: 1, justifyContent: 'center' }}
              title="Add this location as a candidate site"
            >
              + Add as candidate site
            </button>
            <button className="sx-btn sx-btn-sm sx-btn-secondary" onClick={clear} style={{ flex: 'none' }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
