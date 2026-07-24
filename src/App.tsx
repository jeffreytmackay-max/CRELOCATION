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
  const { isMobile, state } = useApp();
  const hasCities = state.cities.length > 0;
  return (
    <>
      <div className="app-shell">
        <Header />
        <CityNav />
        {!hasCities ? <EmptyState /> : isMobile ? <MobileBody /> : <DesktopBody />}
      </div>
      <ReferencePanel />
      <AddCityModal />
    </>
  );
}

/** Shown when there are no cities — prompts the user to add their first metro. */
function EmptyState() {
  const { openCityModal } = useApp();
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--surface-subtle)',
      }}
    >
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 18px',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'var(--tmdx-crimson)',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
          Start from a blank slate
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-muted)', textWrap: 'pretty' }}>
          No cities yet. Add a metro to begin, then drop candidate sites, transplant centers,
          airports, your office, and staff locations — and rank them on a live weighted score.
        </p>
        <button
          className="sx-btn sx-btn-sm sx-btn-primary"
          style={{ fontSize: 13, padding: '9px 18px' }}
          onClick={openCityModal}
        >
          + Add your first city
        </button>
      </div>
    </div>
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
