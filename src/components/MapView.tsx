import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { scoreColor } from '../lib/scoring';
import { useApp } from '../store';
import { Legend } from './Legend';

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

function centerIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="sx-mark" style="width:18px;height:18px;border-radius:4px;background:#9d2235;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:12px">+</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}
function airportIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="sx-mark" style="width:20px;height:16px;border-radius:4px;background:#44546a;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35);font-size:0">✈</div>`,
    iconSize: [20, 16],
    iconAnchor: [10, 8],
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
function siteIcon(score: number, color: string, selected: boolean, d: number) {
  const html = `<div style="position:relative"><div class="sx-mark" style="width:${d}px;height:${d}px;border-radius:50%;background:${color};border:${
    selected ? '3px solid #9d2235' : '2.5px solid #fff'
  };box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:${Math.round(d * 0.42)}px">${score}</div></div>`;
  return L.divIcon({ className: '', html, iconSize: [d, d], iconAnchor: [d / 2, d / 2] });
}

/** Center column: interactive Leaflet map with all marker layers + overlays. */
export function MapView() {
  const { city, state, scored, selId, selectSite, addMode, cancelAdd, fitAll } = useApp();
  const Ly = state.layers;

  return (
    <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
      <MapContainer
        center={city.center}
        zoom={city.zoom}
        zoomControl
        attributionControl
        style={{ position: 'absolute', inset: 0 }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution="© OpenStreetMap contributors"
        />
        <MapController />

        {Ly.centers &&
          city.centers.map((c) =>
            c.lat == null ? null : (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={centerIcon()}>
                <Tooltip permanent direction="top" offset={[0, -11]} className="sx-tt sx-tt-ref">
                  {c.short || 'Center'}
                </Tooltip>
              </Marker>
            ),
          )}

        {Ly.airports &&
          city.airports.map((a) =>
            a.lat == null ? null : (
              <Marker key={a.id} position={[a.lat, a.lng]} icon={airportIcon()}>
                <Tooltip permanent direction="top" offset={[0, -10]} className="sx-tt sx-tt-ref">
                  {(a.code || '?').toUpperCase()}
                </Tooltip>
              </Marker>
            ),
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

      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          zIndex: 800,
          padding: '11px 15px',
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
