import { useApp } from '../store';

/** City-selector nav: analyze-city tabs, add city, and reference-points toggle. */
export function CityNav() {
  const { state, selectCity, openCityModal, togglePanel } = useApp();

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flex: 'none',
        padding: '11px 22px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface-subtle)',
        zIndex: 900,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        Analyze city
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {state.cities.map((c) => {
          const sel = c.id === state.cityId;
          return (
            <button
              key={c.id}
              onClick={() => selectCity(c.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 7,
                padding: '7px 15px',
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: 13,
                fontWeight: 700,
                color: sel ? '#fff' : 'var(--text-strong)',
                background: sel ? 'var(--tmdx-crimson)' : '#fff',
                border: `1.5px solid ${sel ? 'var(--tmdx-crimson)' : 'var(--border-default)'}`,
              }}
            >
              {c.name}
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', opacity: 0.7 }}>
                {c.state || ''}
              </span>
            </button>
          );
        })}
      </div>
      <button className="sx-btn sx-btn-sm sx-btn-secondary" onClick={openCityModal}>
        + Add city
      </button>
      <div style={{ flex: 1 }} />
      <button
        className={`sx-btn sx-btn-sm ${state.panelOpen ? 'sx-btn-primary' : 'sx-btn-secondary'}`}
        onClick={togglePanel}
      >
        Reference points
      </button>
    </nav>
  );
}
