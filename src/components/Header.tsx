import { useRef } from 'react';
import { useApp } from '../store';

/** Top bar: brand lockup + data actions. */
export function Header() {
  const { exportData, importData, resetData, resetWeights } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importData(file);
    } catch {
      window.alert(
        'Could not read that file — expected an exported Site Selection data JSON.',
      );
    }
    e.target.value = '';
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 60,
        flex: 'none',
        padding: '0 22px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface-page)',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          flex: 'none',
          borderRadius: 8,
          background: 'var(--tmdx-crimson)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 17,
          lineHeight: 1,
        }}
      >
        m
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '.16em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          TransMedics OCS Network
        </span>
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--text-strong)',
          }}
        >
          Site Selection Explorer
        </span>
      </div>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
        Saved locally
      </span>
      <button className="sx-btn sx-btn-sm sx-btn-secondary" onClick={exportData}>
        Export
      </button>
      <button
        className="sx-btn sx-btn-sm sx-btn-secondary"
        onClick={() => fileRef.current?.click()}
      >
        Import
      </button>
      <button className="sx-btn sx-btn-sm sx-btn-ghost" onClick={resetData}>
        Reset data
      </button>
      <button className="sx-btn sx-btn-sm sx-btn-ghost" onClick={resetWeights}>
        Reset weights
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={onFile}
      />
    </header>
  );
}
