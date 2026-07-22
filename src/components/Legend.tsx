const scoreBands: [string, string][] = [
  ['#9d2235', 'Excellent · 80+'],
  ['#ff7f41', 'Strong · 72–79'],
  ['#ffae81', 'Fair · 64–71'],
  ['#8a8790', 'Weak · <64'],
];

const dot = (color: string): React.CSSProperties => ({
  width: 10,
  height: 10,
  borderRadius: '50%',
  background: color,
  flex: 'none',
});
const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7 };
const label: React.CSSProperties = { fontSize: 10.5, color: 'var(--text-body)' };

/** Bottom-left glassy legend: score bands + marker-type key. */
export function Legend() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        zIndex: 800,
        padding: '11px 14px',
        borderRadius: 12,
        background: 'rgba(255,255,255,.94)',
        backdropFilter: 'blur(6px)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          marginBottom: 6,
        }}
      >
        Location score
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {scoreBands.map(([color, text]) => (
          <div key={text} style={row}>
            <span style={dot(color)} />
            <span style={label}>{text}</span>
          </div>
        ))}
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '3px 0' }} />
        <div style={row}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: '#9d2235', flex: 'none' }} />
          <span style={label}>Transplant center</span>
        </div>
        <div style={row}>
          <span style={{ width: 13, height: 11, borderRadius: 3, background: '#44546a', flex: 'none' }} />
          <span style={label}>Airport</span>
        </div>
        <div style={row}>
          <span
            style={{ width: 10, height: 10, background: '#302f32', transform: 'rotate(45deg)', flex: 'none' }}
          />
          <span style={label}>Your office</span>
        </div>
      </div>
    </div>
  );
}
