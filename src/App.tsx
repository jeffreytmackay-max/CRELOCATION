import { useEffect } from 'react';
import { AddCityModal } from './components/AddCityModal';
import { CityNav } from './components/CityNav';
import { Header } from './components/Header';
import { LeftRail } from './components/LeftRail';
import { MapView } from './components/MapView';
import { ReferencePanel } from './components/ReferencePanel';
import { RightRail } from './components/RightRail';
import { AppProvider, useApp, type MobileView } from './store';

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}

function Shell() {
  const { isMobile } = useApp();
  return (
    <>
      <div className="app-shell">
        <Header />
        <CityNav />
        {isMobile ? <MobileBody /> : <DesktopBody />}
      </div>
      <ReferencePanel />
      <AddCityModal />
    </>
  );
}

function DesktopBody() {
  return (
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <LeftRail />
      <MapView />
      <RightRail />
    </div>
  );
}

function MobileBody() {
  const { refreshMapSize, mobileView: view, setMobileView: setView } = useApp();

  // Leaflet renders blank if it was sized while hidden — refresh on reveal.
  useEffect(() => {
    if (view === 'map') {
      const t = setTimeout(refreshMapSize, 60);
      return () => clearTimeout(t);
    }
  }, [view, refreshMapSize]);

  const tabs: { id: MobileView; label: string }[] = [
    { id: 'weights', label: 'Weights' },
    { id: 'map', label: 'Map' },
    { id: 'details', label: 'Details' },
  ];

  return (
    <>
      <div
        role="tablist"
        style={{
          flex: 'none',
          display: 'flex',
          gap: 6,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface-page)',
        }}
      >
        {tabs.map((t) => {
          const sel = t.id === view;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={sel}
              onClick={() => setView(t.id)}
              style={{
                flex: 1,
                padding: '9px 10px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 700,
                color: sel ? '#fff' : 'var(--text-body)',
                background: sel ? 'var(--tmdx-crimson)' : 'transparent',
                border: `1.5px solid ${sel ? 'var(--tmdx-crimson)' : 'var(--border-default)'}`,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <Pane show={view === 'weights'}>
          <LeftRail />
        </Pane>
        <Pane show={view === 'map'}>
          <MapView />
        </Pane>
        <Pane show={view === 'details'}>
          <RightRail />
        </Pane>
      </div>
    </>
  );
}

/** Keeps every pane mounted (so the map keeps its state) and toggles visibility. */
function Pane({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: show ? 'flex' : 'none',
        minHeight: 0,
      }}
    >
      {children}
    </div>
  );
}
