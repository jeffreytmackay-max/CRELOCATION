import { useApp } from '../store';

/** City-selector nav: analyze-city tabs, add city, and reference-points toggle. */
export function CityNav() {
  const { state, selectCity, deleteCity, openCityModal, togglePanel, isMobile } = useApp();
  const hasCities = state.cities.length > 0;

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 8 : 14,
        rowGap: 8,
        flex: 'none',
        flexWrap: 'wrap',
        padding: isMobile ? '9px 14px' : '11px 22px',
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
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => selectCity(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') selectCity(c.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: 7,
                padding: sel ? '7px 9px 7px 15px' : '7px 15px',
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
              {sel && (
                <span
                  role="button"
                  tabIndex={0}
                  title={`Delete ${c.name}`}
                  aria-label={`Delete ${c.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete “${c.name}” and all its locations? This cannot be undone.`)) {
                      deleteCity(c.id);
                    }
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    alignSelf: 'center',
                    marginLeft: 2,
                    borderRadius: 999,
                    background: 'rgba(255,255,255,.22)',
                    color: '#fff',
                    fontSize: 13,
                    lineHeight: 1,
                    cursor: 'pointer',
                  }}
                >
                  ×
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button className="sx-btn sx-btn-sm sx-btn-secondary" onClick={openCityModal}>
        + Add city
      </button>
      <div style={{ flex: 1 }} />
      {hasCities && (
        <button
          className={`sx-btn sx-btn-sm ${state.panelOpen ? 'sx-btn-primary' : 'sx-btn-secondary'}`}
          onClick={togglePanel}
        >
          Reference points
        </button>
      )}
    </nav>
  );
}
