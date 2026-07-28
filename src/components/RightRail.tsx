import { useState } from 'react';
import { FACTORS } from '../data/factors';
import { scoreOf } from '../lib/scoring';
import {
  DEPARTURE_OPTIONS,
  departureTimestamp,
  fetchDriveTimes,
  type DepartureChoice,
  type LatLng,
} from '../lib/drivetimes';
import { useApp } from '../store';

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '.14em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-strong)' }}>{children}</span>
  );
}

/** A Street View photo (with static-map fallback) of the selected location. */
function LocationImage({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const [kind, setKind] = useState<'street' | 'map'>('street');
  const [failed, setFailed] = useState(false);
  const src = `/api/streetview?lat=${lat}&lng=${lng}&kind=${kind}&size=640x320`;
  const gmaps = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return (
    <div style={{ margin: '2px 0 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={sectionLabel}>Location</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['street', 'map'] as const).map((k) => (
            <button
              key={k}
              onClick={() => {
                setKind(k);
                setFailed(false);
              }}
              className={`sx-btn sx-btn-sm ${kind === k ? 'sx-btn-primary' : 'sx-btn-secondary'}`}
              style={{ padding: '3px 11px' }}
            >
              {k === 'street' ? 'Street' : 'Map'}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border-subtle)',
          background: 'var(--tmdx-neutral-200)',
          aspectRatio: '2 / 1',
        }}
      >
        {failed ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: 16,
              fontSize: 12,
              textAlign: 'center',
              color: 'var(--text-muted)',
            }}
          >
            Couldn’t load the location image.
          </div>
        ) : (
          <img
            key={src}
            src={src}
            alt={`${kind === 'street' ? 'Street view' : 'Map'} of ${label}`}
            onError={() => setFailed(true)}
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
      <a
        href={gmaps}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          marginTop: 8,
          fontSize: 11.5,
          fontWeight: 700,
          color: 'var(--brand-primary)',
          textDecoration: 'none',
        }}
      >
        Open in Google Maps ↗
      </a>
    </div>
  );
}

/** Right rail: full detail for the selected candidate. */
export function RightRail() {
  const {
    scored,
    selId,
    city,
    norm,
    getDrive,
    setDrive,
    editSite,
    isMobile,
    selectSite,
    setSiteScore,
    setSiteText,
    setFact,
    addFact,
    removeFact,
    includeSpace,
  } = useApp();
  const [editing, setEditing] = useState(false);
  const s = scored.find((x) => x.id === selId);
  if (!city) return null;

  return (
    <aside
      id="rightRail"
      className="sx-scroll"
      style={{
        width: isMobile ? '100%' : 384,
        flex: isMobile ? 1 : 'none',
        borderLeft: isMobile ? 'none' : '1px solid var(--border-subtle)',
        overflowY: 'auto',
        background: 'var(--surface-subtle)',
      }}
    >
      {!s ? null : (
        <div style={{ padding: '24px 24px 28px' }}>
          {/* Eyebrow + state badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--brand-primary)',
              }}
            >
              Rank #{s.rank} of {scored.length}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '.08em',
                textTransform: 'uppercase',
                color: 'var(--text-body)',
                background: 'var(--tmdx-neutral-200)',
                padding: '3px 9px',
                borderRadius: 999,
              }}
            >
              {city.state || ''}
            </span>
            <div style={{ flex: 1 }} />
            <button
              className={`sx-btn sx-btn-sm ${editing ? 'sx-btn-primary' : 'sx-btn-secondary'}`}
              onClick={() => {
                // Pin the current site so re-scoring can't make the panel follow rank #1.
                if (!editing) selectSite(s.id);
                setEditing((e) => !e);
              }}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>

          {editing && !s.isOffice ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <FieldLabel>Site name</FieldLabel>
              <input
                className="sx-inp"
                value={s.name}
                onChange={(e) => setSiteText(s.id, 'name', e.target.value)}
                placeholder="Site name"
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <FieldLabel>Map label</FieldLabel>
                  <input
                    className="sx-inp"
                    value={s.short}
                    onChange={(e) => setSiteText(s.id, 'short', e.target.value)}
                    placeholder="Short label"
                    style={{ marginTop: 4 }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <FieldLabel>City / area</FieldLabel>
                  <input
                    className="sx-inp"
                    value={s.area ?? ''}
                    onChange={(e) => editSite(s.id, 'area', e.target.value)}
                    placeholder={`${city.name}, ${city.state || ''}`}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <h2
                style={{
                  margin: '0 0 2px',
                  fontSize: 28,
                  fontWeight: 300,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-strong)',
                  lineHeight: 1.1,
                }}
              >
                {s.name}
              </h2>
              {s.isOffice ? (
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginTop: 4 }}>
                  {city.name}, {city.state || ''}
                </div>
              ) : (
                <input
                  className="sx-inline-edit"
                  value={s.area ?? ''}
                  placeholder={`${city.name}, ${city.state || ''}`}
                  onChange={(e) => editSite(s.id, 'area', e.target.value)}
                  aria-label="Site city or area"
                  title="City / area — click to edit"
                  style={{ marginTop: 4 }}
                />
              )}
            </>
          )}
          {editing ? (
            <div style={{ marginTop: 12 }}>
              <FieldLabel>Notes</FieldLabel>
              <textarea
                className="sx-inp"
                value={s.note ?? ''}
                onChange={(e) => setSiteText(s.id, 'note', e.target.value)}
                placeholder="Notes about this location…"
                rows={3}
                style={{ marginTop: 4, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          ) : (
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--text-body)',
              }}
            >
              {s.note || ''}
            </p>
          )}

          {/* Score card */}
          <div
            style={{
              margin: '22px 0',
              padding: '18px 20px',
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderTop: '3px solid var(--brand-primary)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span
                style={{
                  fontSize: 46,
                  fontWeight: 300,
                  letterSpacing: '-.02em',
                  color: 'var(--tmdx-crimson)',
                  lineHeight: 1,
                }}
              >
                {s.composite}
              </span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-muted)' }}>
                /100
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginTop: 6,
              }}
            >
              Weighted location score
            </div>
          </div>

          {/* Location image (Street View → static-map fallback) */}
          {Number.isFinite(s.lat) && Number.isFinite(s.lng) && (
            <LocationImage lat={s.lat} lng={s.lng} label={s.area || s.name} />
          )}

          {/* Factor scores — editable */}
          {editing && (
            <>
              <div style={{ ...sectionLabel, marginBottom: 4 }}>Factor scores</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
                0–100, higher is better. The weighted score updates live.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {FACTORS.map((f) => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', flex: 'none', background: f.color }} />
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' }}>
                      {f.label}
                      {f.optional && !includeSpace && (
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}> · off</span>
                      )}
                    </span>
                    <input
                      className="sx-inp"
                      type="number"
                      min={0}
                      max={100}
                      value={scoreOf(s.scores, f.key)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setSiteScore(s.id, f.key, e.target.valueAsNumber)}
                      style={{ width: 66, flex: 'none', textAlign: 'center' }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Factor breakdown — read-only */}
          {!editing && (
          <>
          <div style={{ ...sectionLabel, marginBottom: 14 }}>Factor breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FACTORS.filter((f) => !f.optional || includeSpace)
              .map((f) => ({
              label: f.label,
              color: f.color,
              raw: scoreOf(s.scores, f.key),
              wPct: Math.round(norm[f.key] * 100),
              contrib: scoreOf(s.scores, f.key) * norm[f.key],
            }))
              .sort((a, b) => b.contrib - a.contrib)
              .map((b) => (
                <div key={b.label}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          flex: 'none',
                          background: b.color,
                        }}
                      />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' }}>
                        {b.label}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 800,
                        color: 'var(--text-strong)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {b.raw}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: 'var(--tmdx-neutral-200)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${b.raw}%`,
                        background: b.color,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      marginTop: 5,
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>weight {b.wPct}%</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      +{b.contrib.toFixed(1)} pts to score
                    </span>
                  </div>
                </div>
              ))}
          </div>
          </>
          )}

          {/* Site facts */}
          <div style={{ ...sectionLabel, margin: '26px 0 12px' }}>Site facts</div>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(s.facts || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    className="sx-inp"
                    value={r[0]}
                    onChange={(e) => setFact(s.id, i, 0, e.target.value)}
                    placeholder="Label"
                    style={{ flex: 1 }}
                  />
                  <input
                    className="sx-inp"
                    value={r[1]}
                    onChange={(e) => setFact(s.id, i, 1, e.target.value)}
                    placeholder="Value"
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() => removeFact(s.id, i)}
                    title="Remove fact"
                    style={{
                      width: 26,
                      height: 26,
                      flex: 'none',
                      border: '1px solid var(--border-default)',
                      borderRadius: 7,
                      background: '#fff',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 15,
                      lineHeight: 1,
                    }}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                onClick={() => addFact(s.id)}
                style={{
                  alignSelf: 'flex-start',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--brand-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 2px',
                }}
              >
                + Add fact
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {(s.facts || []).length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
                  No facts yet — use Edit to add asking rent, space, etc.
                </div>
              ) : (
                (s.facts || []).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '9px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r[0]}</span>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: 'var(--text-strong)',
                        textAlign: 'right',
                      }}
                    >
                      {r[1]}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          <DriveTimes
            selId={selId}
            siteName={s.name}
            siteLat={s.lat}
            siteLng={s.lng}
            officeOff={!city.office.on}
            getDrive={getDrive}
            setDrive={setDrive}
          />
        </div>
      )}
    </aside>
  );
}

interface Dest {
  id: string;
  label: string;
  color: string;
  lat: number;
  lng: number;
}

function DriveTimes({
  selId,
  siteName,
  siteLat,
  siteLng,
  officeOff,
  getDrive,
  setDrive,
}: {
  selId: string;
  siteName: string;
  siteLat: number;
  siteLng: number;
  officeOff: boolean;
  getDrive: (o: string, r: string) => string;
  setDrive: (o: string, r: string, v: string) => void;
}) {
  const { city } = useApp();
  const dests: Dest[] = !city
    ? []
    : [
        ...city.centers.map((c) => ({ id: c.id, label: c.short || 'Center', color: '#9d2235', lat: c.lat, lng: c.lng })),
        ...city.airports.map((a) => ({ id: a.id, label: (a.code || '?').toUpperCase(), color: '#44546a', lat: a.lat, lng: a.lng })),
      ];

  const [dep, setDep] = useState<DepartureChoice>('now');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledAt, setFilledAt] = useState<string | null>(null);

  async function autofill() {
    if (!city) return;
    setLoading(true);
    setError(null);
    setFilledAt(null);
    try {
      const refs = dests.filter((d) => d.lat != null && d.lng != null);
      if (!refs.length) {
        setError('Add transplant centers or airports first.');
        return;
      }
      const hasOffice = city.office.lat != null && city.office.lng != null;
      const origins: LatLng[] = [{ lat: siteLat, lng: siteLng }];
      if (hasOffice) origins.push({ lat: city.office.lat, lng: city.office.lng });
      const destinations: LatLng[] = refs.map((r) => ({ lat: r.lat, lng: r.lng }));

      const durations = await fetchDriveTimes(origins, destinations, departureTimestamp(dep));

      (durations[0] || []).forEach((mins, j) => {
        if (mins != null) setDrive(selId, refs[j].id, String(mins));
      });
      if (hasOffice && durations[1]) {
        durations[1].forEach((mins, j) => {
          if (mins != null) setDrive('office', refs[j].id, String(mins));
        });
      }
      const label = DEPARTURE_OPTIONS.find((o) => o.value === dep)?.label ?? '';
      setFilledAt(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Drive-time request failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div style={{ ...sectionLabel, margin: '26px 0 4px' }}>Drive times</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        {siteName} vs. your office — minutes. Auto-fill with live/predictive traffic, or type your
        own. Δ shows minutes saved (−) or lost (+) versus the office.
      </div>

      {/* Traffic-aware auto-fill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <select
          className="sx-inp"
          value={dep}
          onChange={(e) => setDep(e.target.value as DepartureChoice)}
          disabled={loading}
          aria-label="Departure time for traffic estimate"
          style={{ flex: 1, cursor: 'pointer' }}
        >
          {DEPARTURE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          className="sx-btn sx-btn-sm sx-btn-primary"
          onClick={autofill}
          disabled={loading}
          style={{ flex: 'none', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Calculating…' : 'Auto-fill traffic'}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 12 }}>
        {error ? (
          <span style={{ color: 'var(--tmdx-crimson)' }}>{error}</span>
        ) : filledAt ? (
          <span style={{ color: 'var(--tmdx-green)' }}>
            Filled with traffic for “{filledAt}”. You can still edit any value.
          </span>
        ) : (
          <>Powered by Google Distance Matrix — driving times with traffic.</>
        )}
      </div>

      {officeOff && (
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: 'var(--text-muted)',
            background: 'var(--surface-card)',
            border: '1px dashed var(--border-default)',
            borderRadius: 9,
            padding: '8px 10px',
            marginBottom: 12,
          }}
        >
          Enable{' '}
          <strong style={{ color: 'var(--text-strong)', fontWeight: 700 }}>Current office</strong>{' '}
          under Reference points to fill the office column.
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 2px 7px',
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: '.05em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ flex: 1 }}>Destination</span>
        <span style={{ width: 50, textAlign: 'center' }}>This site</span>
        <span style={{ width: 50, textAlign: 'center' }}>Office</span>
        <span style={{ width: 32, textAlign: 'right' }}>Δ</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {dests.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
            No reference points yet — add some under Reference points.
          </div>
        ) : (
          dests.map((d) => {
            const sv = getDrive(selId, d.id);
            const ov = getDrive('office', d.id);
            const a = sv === '' ? null : +sv;
            const b = ov === '' ? null : +ov;
            const has = a != null && b != null;
            const del = has ? a - b : null;
            const dl = !has ? '—' : del! > 0 ? `+${del}` : del === 0 ? '±0' : `${del}`;
            const dc = !has
              ? 'var(--text-muted)'
              : del! < 0
                ? '#1f8f5f'
                : del! > 0
                  ? 'var(--tmdx-crimson)'
                  : 'var(--text-muted)';
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                  <span
                    style={{ width: 8, height: 8, borderRadius: 2, flex: 'none', background: d.color }}
                  />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--text-strong)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {d.label}
                  </span>
                </span>
                <input
                  className="sx-inp"
                  inputMode="numeric"
                  value={sv}
                  onChange={(e) => setDrive(selId, d.id, e.target.value)}
                  placeholder="–"
                  style={{ width: 50, flex: 'none', textAlign: 'center', padding: '5px 4px' }}
                />
                <input
                  className="sx-inp"
                  inputMode="numeric"
                  value={ov}
                  onChange={(e) => setDrive('office', d.id, e.target.value)}
                  placeholder="–"
                  style={{ width: 50, flex: 'none', textAlign: 'center', padding: '5px 4px' }}
                />
                <span
                  style={{
                    width: 32,
                    textAlign: 'right',
                    fontSize: 12.5,
                    fontWeight: 800,
                    fontVariantNumeric: 'tabular-nums',
                    color: dc,
                  }}
                >
                  {dl}
                </span>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
