import { useState } from 'react';
import { FACTORS } from '../data/factors';
import { geocode, type GeocodeResult } from '../lib/geocode';
import { isUnscored, scoreColor } from '../lib/scoring';
import { useApp } from '../store';
import { FactorIcon } from './FactorIcon';

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color: 'var(--brand-primary)',
};

/** Left rail: factor weighting sliders + ranked candidate list. */
export function LeftRail() {
  const { isMobile } = useApp();
  return (
    <aside
      className="sx-scroll"
      style={{
        width: isMobile ? '100%' : 362,
        flex: isMobile ? 1 : 'none',
        borderRight: isMobile ? 'none' : '1px solid var(--border-subtle)',
        overflowY: 'auto',
        background: 'var(--surface-page)',
      }}
    >
      <FactorWeighting />
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
      <Ranking />
    </aside>
  );
}

function FactorWeighting() {
  const { state, norm, setWeight } = useApp();
  return (
    <div style={{ padding: '22px 22px 18px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span style={eyebrow}>Factor weighting</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>normalized to 100%</span>
      </div>
      <p
        style={{
          margin: '0 0 18px',
          fontSize: 12.5,
          lineHeight: 1.5,
          color: 'var(--text-muted)',
        }}
      >
        Drag to set how much each factor matters. Scores, pins and rankings update live.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {FACTORS.map((f) => {
          const v = state.weights[f.key] ?? 0;
          const pct = Math.round(norm[f.key] * 100);
          return (
            <div key={f.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    flex: 'none',
                    color: '#fff',
                    background: f.color,
                  }}
                >
                  <FactorIcon factor={f.key} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>
                      {f.short}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        color: 'var(--text-strong)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {pct}%
                    </span>
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.35, color: 'var(--text-muted)' }}>
                    {f.desc}
                  </div>
                </div>
              </div>
              <input
                className="sx-range"
                type="range"
                min={0}
                max={100}
                step={1}
                value={v}
                onChange={(e) => setWeight(f.key, Number(e.target.value))}
                style={{
                  background: `linear-gradient(90deg, ${f.color} 0%, ${f.color} ${v}%, #e3dddb ${v}%, #e3dddb 100%)`,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Ranking() {
  const { scored, selId, city, selectSite } = useApp();
  if (!city) return null;
  return (
    <div style={{ padding: '20px 22px 26px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 3,
        }}
      >
        <span style={eyebrow}>Candidate locations</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{scored.length} sites</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {city.name}, {city.state || ''} — ranked by weighted score
      </div>
      <SearchAddSite />
      <AutoScore />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {scored.map((s) => {
          const isSel = s.id === selId;
          const col = scoreColor(s.composite);
          const rankBg = s.isOffice
            ? '#302f32'
            : s.rank === 1
              ? 'var(--tmdx-crimson)'
              : 'var(--tmdx-neutral-200)';
          const rankFg = s.isOffice || s.rank === 1 ? '#fff' : 'var(--text-body)';
          return (
            <button
              key={s.id}
              onClick={() => selectSite(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '11px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                background: isSel
                  ? 'color-mix(in srgb, var(--tmdx-crimson) 6%, #fff)'
                  : '#fff',
                border: `1.5px solid ${isSel ? 'var(--tmdx-crimson)' : 'var(--border-subtle)'}`,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  flex: 'none',
                  borderRadius: '50%',
                  fontSize: 12,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: rankFg,
                  background: rankBg,
                }}
              >
                {s.rank}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: 'var(--text-strong)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.name}
                  </span>
                  {s.isOffice && (
                    <span
                      style={{
                        flex: 'none',
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '.07em',
                        textTransform: 'uppercase',
                        color: '#fff',
                        background: '#302f32',
                        padding: '2px 6px',
                        borderRadius: 999,
                      }}
                    >
                      Current
                    </span>
                  )}
                  {!s.isOffice && isUnscored(s.scores) && (
                    <span
                      title="Still at neutral defaults — score it or use Auto-score"
                      style={{
                        flex: 'none',
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        background: 'var(--tmdx-neutral-200)',
                        padding: '2px 6px',
                        borderRadius: 999,
                      }}
                    >
                      Unscored
                    </span>
                  )}
                </div>
                {s.area && (
                  <div
                    style={{
                      fontSize: 10.5,
                      color: 'var(--text-muted)',
                      marginTop: 2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {s.area}
                  </div>
                )}
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: 'var(--tmdx-neutral-200)',
                    marginTop: 6,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${s.composite}%`,
                      background: col,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: col,
                  minWidth: 34,
                  textAlign: 'right',
                }}
              >
                {s.composite}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Search an address / city (geocode) and drop a candidate site there. */
function SearchAddSite() {
  const { addSiteAt, startAdd } = useApp();
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
      const found = await geocode(query);
      setResults(found);
      if (!found.length) setError('No matches — try a more specific address.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  function pick(r: GeocodeResult) {
    addSiteAt(r.name, r.lat, r.lng);
    setQ('');
    setResults(null);
    setError(null);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 7 }}>
        <input
          className="sx-inp"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search();
          }}
          placeholder="Search address or city to add a site…"
          aria-label="Search an address or city to add a candidate site"
          style={{ flex: 1 }}
        />
        <button
          className="sx-btn sx-btn-sm sx-btn-primary"
          onClick={search}
          disabled={busy}
          style={{ flex: 'none', opacity: busy ? 0.7 : 1 }}
        >
          {busy ? '…' : 'Search'}
        </button>
      </div>

      {results && results.length > 0 && (
        <div
          style={{
            marginTop: 7,
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            overflow: 'hidden',
            background: '#fff',
          }}
        >
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => pick(r)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '9px 11px',
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

      <div style={{ marginTop: 6, fontSize: 10.5, lineHeight: 1.4 }}>
        {error ? (
          <span style={{ color: 'var(--tmdx-crimson)' }}>{error}</span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            Reach surrounding suburbs by name, or{' '}
            <button
              onClick={() => startAdd('site')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                font: 'inherit',
                fontWeight: 700,
                color: 'var(--brand-primary)',
                cursor: 'pointer',
              }}
            >
              drop one on the map
            </button>
            .
          </span>
        )}
      </div>
    </div>
  );
}

/** Auto-score the access factors for every site from traffic-aware drive times. */
function AutoScore() {
  const { autoScoreCity } = useApp();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; err: boolean } | null>(null);

  async function run() {
    setBusy(true);
    setStatus(null);
    try {
      const r = await autoScoreCity();
      if (r.error) setStatus({ text: r.error, err: true });
      else
        setStatus({
          text: `Scored transplant, airport & commute for ${r.scored} site${r.scored === 1 ? '' : 's'} from drive times.`,
          err: false,
        });
    } catch (e) {
      setStatus({ text: e instanceof Error ? e.message : 'Auto-score failed.', err: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <button
        className="sx-btn sx-btn-sm sx-btn-secondary"
        onClick={run}
        disabled={busy}
        style={{ width: '100%', justifyContent: 'center', opacity: busy ? 0.7 : 1 }}
        title="Fill transplant, airport and staff-commute scores from traffic-aware drive times"
      >
        {busy ? 'Scoring…' : '⚡ Auto-score access from drive times'}
      </button>
      <div style={{ marginTop: 6, fontSize: 10.5, lineHeight: 1.4 }}>
        {status ? (
          <span style={{ color: status.err ? 'var(--tmdx-crimson)' : 'var(--tmdx-green)' }}>
            {status.text}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>
            Sets transplant, airport &amp; commute (closer = higher). You still set real estate,
            climate &amp; crime.
          </span>
        )}
      </div>
    </div>
  );
}
