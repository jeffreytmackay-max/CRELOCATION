import { useRef, useState } from 'react';
import { useApp } from '../store';

const fieldLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-strong)',
};

/** Centered overlay for adding a new metro. */
export function AddCityModal() {
  const { cityModalOpen, closeCityModal, addCity } = useApp();
  const [name, setName] = useState('');
  const [st, setSt] = useState('');
  const [zip, setZip] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  if (!cityModalOpen) return null;

  function reset() {
    setName('');
    setSt('');
    setZip('');
    setLat('');
    setLng('');
    setError('');
  }
  function cancel() {
    reset();
    closeCityModal();
  }
  async function confirm() {
    const nm = name.trim();
    if (!nm) {
      setError('Enter a city or metro name to continue.');
      nameRef.current?.focus();
      return;
    }
    setError('');
    setAdding(true);
    try {
      // lat/lng win when given; otherwise the store geocodes name/state/ZIP.
      await addCity(nm, st.trim().toUpperCase(), zip.trim(), parseFloat(lat), parseFloat(lng));
      reset();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2200,
        background: 'rgba(48,47,50,.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
      }}
    >
      <div
        style={{
          width: 'min(400px, calc(100vw - 28px))',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          background: '#fff',
          borderRadius: 16,
          boxShadow: 'var(--shadow-lg)',
          padding: '22px 24px',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '.14em',
            textTransform: 'uppercase',
            color: 'var(--brand-primary)',
            marginBottom: 4,
          }}
        >
          Add a city
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 16 }}>
          Name the metro and set its map center. Then drop candidate sites, transplant centers,
          airports and your office directly on the map.
        </div>

        <label style={fieldLabel}>City / metro name</label>
        <input
          ref={nameRef}
          className="sx-inp"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          placeholder="e.g. Nashville"
          autoFocus
          style={{
            margin: '5px 0 6px',
            borderColor: error ? 'var(--tmdx-crimson)' : undefined,
          }}
        />
        {error ? (
          <div style={{ fontSize: 11.5, color: 'var(--tmdx-crimson)', margin: '0 0 12px' }}>{error}</div>
        ) : (
          <div style={{ height: 8 }} />
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>State</label>
            <input
              className="sx-inp"
              value={st}
              onChange={(e) => setSt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm();
              }}
              placeholder="e.g. TN"
              style={{ marginTop: 5 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>ZIP code</label>
            <input
              className="sx-inp"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirm();
              }}
              placeholder="e.g. 37203"
              inputMode="numeric"
              style={{ marginTop: 5 }}
            />
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
          We’ll locate the metro from its name, state and ZIP. Lat/long below are
          optional — only for exact placement.
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>Center latitude</label>
            <input
              className="sx-inp"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="36.1627"
              style={{ marginTop: 5 }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>Center longitude</label>
            <input
              className="sx-inp"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-86.7816"
              style={{ marginTop: 5 }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="sx-btn sx-btn-sm sx-btn-secondary" onClick={cancel} disabled={adding}>
            Cancel
          </button>
          <button
            className="sx-btn sx-btn-sm sx-btn-primary"
            onClick={confirm}
            disabled={adding}
            style={{ opacity: adding ? 0.7 : 1 }}
          >
            {adding ? 'Adding…' : 'Add city'}
          </button>
        </div>
      </div>
    </div>
  );
}
