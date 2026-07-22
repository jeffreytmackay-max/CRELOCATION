import { useState } from 'react';
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
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');

  if (!cityModalOpen) return null;

  function reset() {
    setName('');
    setSt('');
    setLat('');
    setLng('');
  }
  function cancel() {
    reset();
    closeCityModal();
  }
  function confirm() {
    const nm = name.trim();
    if (!nm) return;
    // lat/lng optional — NaN tells the store to fall back to the current map center.
    addCity(nm, st.trim().toUpperCase(), parseFloat(lat), parseFloat(lng));
    reset();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(48,47,50,.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 400,
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
          className="sx-inp"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Nashville"
          autoFocus
          style={{ margin: '5px 0 14px' }}
        />

        <label style={fieldLabel}>State</label>
        <input
          className="sx-inp"
          value={st}
          onChange={(e) => setSt(e.target.value)}
          placeholder="e.g. TN"
          style={{ margin: '5px 0 14px' }}
        />

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

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 18 }}>
          Tip: leave lat/long blank to center on the current map view.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="sx-btn sx-btn-sm sx-btn-secondary" onClick={cancel}>
            Cancel
          </button>
          <button className="sx-btn sx-btn-sm sx-btn-primary" onClick={confirm}>
            Add city
          </button>
        </div>
      </div>
    </div>
  );
}
