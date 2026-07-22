import { useState } from 'react';
import { findNearby } from '../lib/places';
import { useApp } from '../store';

const cbStyle: React.CSSProperties = {
  accentColor: 'var(--tmdx-crimson)',
  width: 15,
  height: 15,
};

interface FindStatus {
  kind: 'centers' | 'airports';
  text: string;
  err: boolean;
}

/** Floating reference-points editor over the right rail. */
export function ReferencePanel() {
  const {
    state,
    city,
    togglePanel,
    toggleLayer,
    toggleOffice,
    setOfficeAddress,
    editRef,
    removeRef,
    startAdd,
    addStaff,
    editStaff,
    removeStaff,
    addDiscoveredRefs,
  } = useApp();

  const [busy, setBusy] = useState<'centers' | 'airports' | null>(null);
  const [status, setStatus] = useState<FindStatus | null>(null);

  async function discover(kind: 'centers' | 'airports') {
    setBusy(kind);
    setStatus(null);
    try {
      const found = await findNearby(
        kind === 'centers' ? 'transplant' : 'airport',
        city.center[0],
        city.center[1],
      );
      const added = addDiscoveredRefs(kind, found);
      const noun = kind === 'centers' ? 'transplant center' : 'airport';
      const text =
        added > 0
          ? `Added ${added} ${noun}${added === 1 ? '' : 's'}${kind === 'airports' ? ' — set their codes below.' : '.'}`
          : found.length
            ? 'Nothing new — the nearby ones are already listed.'
            : 'None found nearby.';
      setStatus({ kind, text, err: false });
    } catch (e) {
      setStatus({ kind, text: e instanceof Error ? e.message : 'Discovery failed.', err: true });
    } finally {
      setBusy(null);
    }
  }

  if (!state.panelOpen) return null;
  const Ly = state.layers;
  const staff = city.staff ?? [];
  const totalStaff = staff.reduce((a, s) => a + (parseInt(s.employees, 10) || 0), 0);

  return (
    <div
      id="panel"
      style={{
        position: 'fixed',
        top: 132,
        right: 410,
        width: 344,
        maxHeight: 'calc(100vh - 150px)',
        zIndex: 950,
      }}
    >
      <div
        className="sx-scroll"
        style={{
          maxHeight: 'calc(100vh - 150px)',
          overflowY: 'auto',
          background: 'var(--surface-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Sticky header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 18px 12px',
            background: 'var(--surface-card)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: 'var(--brand-primary)',
              }}
            >
              Reference points
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {city.name}, {city.state || ''}
            </div>
          </div>
          <button
            onClick={togglePanel}
            style={{
              width: 28,
              height: 28,
              flex: 'none',
              border: '1px solid var(--border-default)',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              color: 'var(--text-muted)',
            }}
          >
            ×
          </button>
        </div>

        {/* Show on map */}
        <div
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            Show on map
          </div>
          {(
            [
              ['centers', 'Transplant centers'],
              ['airports', 'Airports'],
              ['office', 'Your office'],
            ] as const
          ).map(([k, txt]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
              <input type="checkbox" checked={Ly[k]} onChange={() => toggleLayer(k)} style={cbStyle} />
              <span style={{ fontSize: 12.5, color: 'var(--text-body)' }}>{txt}</span>
            </label>
          ))}
        </div>

        {/* Current office */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginBottom: 10 }}>
            <input
              type="checkbox"
              checked={city.office.on}
              onChange={(e) => toggleOffice(e.target.checked)}
              style={cbStyle}
            />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>
              Current office in this city
            </span>
          </label>
          {city.office.on && (
            <>
              <input
                className="sx-inp"
                value={city.office.address || ''}
                onChange={(e) => setOfficeAddress(e.target.value)}
                placeholder="Office address"
                style={{ marginBottom: 8 }}
              />
              <button
                className="sx-btn sx-btn-sm sx-btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => startAdd('office')}
              >
                Reposition office on map
              </button>
            </>
          )}
        </div>

        {/* Transplant centers */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <SectionHeader
            label="Transplant centers"
            onAdd={() => startAdd('center')}
            onFind={() => discover('centers')}
            finding={busy === 'centers'}
          />
          <FindStatusLine status={status} kind="centers" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {city.centers.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingBottom: 12,
                  borderBottom: '1px dashed var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    className="sx-inp"
                    value={c.short || ''}
                    onChange={(e) => editRef('centers', c.id, 'short', e.target.value)}
                    placeholder="Label (map)"
                    style={{ flex: 1 }}
                  />
                  <RemoveButton onClick={() => removeRef('centers', c.id)} />
                </div>
                <input
                  className="sx-inp"
                  value={c.address || ''}
                  onChange={(e) => editRef('centers', c.id, 'address', e.target.value)}
                  placeholder="Full address"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Airports */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <SectionHeader
            label="Airports"
            onAdd={() => startAdd('airport')}
            onFind={() => discover('airports')}
            finding={busy === 'airports'}
          />
          <FindStatusLine status={status} kind="airports" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {city.airports.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <input
                  className="sx-inp"
                  value={a.code || ''}
                  onChange={(e) => editRef('airports', a.id, 'code', e.target.value)}
                  placeholder="Code"
                  style={{ width: 64, flex: 'none', textTransform: 'uppercase', fontWeight: 700 }}
                />
                <input
                  className="sx-inp"
                  value={a.name || ''}
                  onChange={(e) => editRef('airports', a.id, 'name', e.target.value)}
                  placeholder="Airport name"
                  style={{ flex: 1 }}
                />
                <RemoveButton onClick={() => removeRef('airports', a.id)} />
              </div>
            ))}
          </div>
        </div>

        {/* Staff locations */}
        <div style={{ padding: '16px 18px 20px' }}>
          <SectionHeader label="Staff locations" addLabel="+ Add" onAdd={addStaff} />
          <div style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>
            Employees by home city / ZIP — context for the staff-commute factor.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {staff.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingBottom: 12,
                  borderBottom: '1px dashed var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    className="sx-inp"
                    value={s.city}
                    onChange={(e) => editStaff(s.id, 'city', e.target.value)}
                    placeholder="City"
                    style={{ flex: 1 }}
                  />
                  <RemoveButton onClick={() => removeStaff(s.id)} />
                </div>
                <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                  <input
                    className="sx-inp"
                    value={s.state}
                    onChange={(e) => editStaff(s.id, 'state', e.target.value)}
                    placeholder="State"
                    style={{ width: 56, flex: 'none', textTransform: 'uppercase', fontWeight: 700 }}
                  />
                  <input
                    className="sx-inp"
                    value={s.zip}
                    onChange={(e) => editStaff(s.id, 'zip', e.target.value)}
                    placeholder="ZIP"
                    inputMode="numeric"
                    style={{ width: 80, flex: 'none' }}
                  />
                  <input
                    className="sx-inp"
                    value={s.employees}
                    onChange={(e) => editStaff(s.id, 'employees', e.target.value)}
                    placeholder="# staff"
                    inputMode="numeric"
                    style={{ flex: 1, textAlign: 'right' }}
                  />
                </div>
              </div>
            ))}
          </div>
          {staff.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '2px 0' }}>
              No staff locations yet — add employee counts by city / ZIP.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginTop: 12,
                paddingTop: 10,
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}
              >
                Total staff
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--text-strong)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {totalStaff} · {staff.length} location{staff.length === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const linkBtnStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 11.5,
  fontWeight: 700,
  color: 'var(--brand-primary)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '2px 4px',
};

function SectionHeader({
  label,
  onAdd,
  addLabel = '+ Add on map',
  onFind,
  finding = false,
}: {
  label: string;
  onAdd: () => void;
  addLabel?: string;
  onFind?: () => void;
  finding?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 11 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-strong)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        {onFind && (
          <button
            onClick={onFind}
            disabled={finding}
            title="Discover nearby places with Google and add them"
            style={{ ...linkBtnStyle, opacity: finding ? 0.6 : 1 }}
          >
            {finding ? 'Finding…' : 'Find nearby'}
          </button>
        )}
        <button onClick={onAdd} style={linkBtnStyle}>
          {addLabel}
        </button>
      </div>
    </div>
  );
}

function FindStatusLine({
  status,
  kind,
}: {
  status: FindStatus | null;
  kind: 'centers' | 'airports';
}) {
  if (!status || status.kind !== kind) return null;
  return (
    <div
      style={{
        fontSize: 10.5,
        lineHeight: 1.4,
        margin: '-4px 0 11px',
        color: status.err ? 'var(--tmdx-crimson)' : 'var(--tmdx-green)',
      }}
    >
      {status.text}
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
  );
}
