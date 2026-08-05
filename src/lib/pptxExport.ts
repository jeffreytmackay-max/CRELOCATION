// Export the current city's full analysis as a PowerPoint deck.
//
// PptxGenJS is dynamically imported so it code-splits and only loads on export.
// The deck covers every section of the app: recommendation, factor weighting,
// ranked candidates, factor breakdown, reference points, staff, and (computed
// live via the Distance Matrix API) employee-commute drive times to key
// locations.

import { FACTORS, activeFactorKeys } from '../data/factors';
import { normalize, scoreCity, scoreOf } from './scoring';
import type { AppState, FactorKey } from '../types';

const CRIMSON = '9D2235';
const SLATE = '44546A';
const INK = '302F32';
const MUTED = '7A787A';
const LIGHT = 'F7F5F4';
const LINE = 'E3DDDB';
const WHITE = 'FFFFFF';

const COMPACT: Record<FactorKey, string> = {
  hospital: 'Transplant',
  airport: 'Airport',
  commute: 'Commute',
  crime: 'Crime',
  space: 'Real estate',
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
const hex = (c: string) => c.replace('#', '');
const mins = (v: number | null | undefined) => (v == null ? '—' : `${Math.round(v)}`);

/** Build and download a PPTX report for the current city. */
export async function exportPptx(state: AppState): Promise<{ ok: boolean; error?: string }> {
  const city = state.cities.find((c) => c.id === state.cityId) ?? state.cities[0];
  if (!city) return { ok: false, error: 'Add a city with candidate sites first.' };

  const includeSpace = state.includeSpace;
  const activeKeys = activeFactorKeys(includeSpace);
  const factors = FACTORS.filter((f) => activeKeys.includes(f.key));
  const norm = normalize(state.weights, includeSpace);
  const scored = scoreCity(city, state.weights, includeSpace);
  const candidates = scored.filter((s) => !s.isOffice);

  // ---- Employee-commute drive times (best-effort; needs Google + plotted staff) ----
  const staff = (city.staff ?? []).filter((s) => s.lat != null && s.lng != null);
  const dtSites = city.sites.filter((s) => s.lat != null && s.lng != null);
  const centers = city.centers.filter((c) => c.lat != null && c.lng != null);
  const airports = city.airports.filter((a) => a.lat != null && a.lng != null);
  type Commute = {
    rows?: { label: string; hc: number; siteMins: (number | null)[]; ctr: number | null; air: number | null }[];
    siteNames?: string[];
    wavg?: (number | null)[];
    error?: string;
  };
  let commute: Commute = {};
  if (!staff.length) commute = { error: 'No staff plotted on the map — add staff and use “Plot on map”.' };
  else if (!dtSites.length) commute = { error: 'No candidate sites with locations yet.' };
  else {
    try {
      const { matrix, departureTimestamp } = await import('./drivetimes');
      const dep = departureTimestamp('weekday-8');
      const shown = [...dtSites]
        .sort((a, b) => {
          const ra = candidates.find((s) => s.id === a.id)?.rank ?? 99;
          const rb = candidates.find((s) => s.id === b.id)?.rank ?? 99;
          return ra - rb;
        })
        .slice(0, 6);
      const dests = [
        ...shown.map((s) => ({ lat: s.lat, lng: s.lng })),
        ...centers.map((c) => ({ lat: c.lat, lng: c.lng })),
        ...airports.map((a) => ({ lat: a.lat, lng: a.lng })),
      ];
      const origins = staff.map((s) => ({ lat: s.lat as number, lng: s.lng as number }));
      const M = await matrix(origins, dests, dep);
      const nS = shown.length;
      const rows = staff.map((s, i) => {
        const row = M[i] ?? [];
        const siteMins = row.slice(0, nS);
        const ctrVals = row.slice(nS, nS + centers.length).filter((v): v is number => v != null);
        const airVals = row.slice(nS + centers.length).filter((v): v is number => v != null);
        return {
          label: [s.city, s.state, s.zip].filter(Boolean).join(' '),
          hc: Math.max(0, parseInt(s.employees, 10) || 0),
          siteMins,
          ctr: ctrVals.length ? Math.min(...ctrVals) : null,
          air: airVals.length ? Math.min(...airVals) : null,
        };
      });
      // Headcount-weighted average commute per shown site.
      const wavg = shown.map((_, j) => {
        let w = 0;
        let ws = 0;
        rows.forEach((r) => {
          const m = r.siteMins[j];
          if (m == null) return;
          const hc = Math.max(1, r.hc);
          w += hc;
          ws += hc * m;
        });
        return w ? Math.round(ws / w) : null;
      });
      commute = { rows, siteNames: shown.map((s) => s.short || s.name), wavg };
    } catch (e) {
      commute = { error: e instanceof Error ? e.message : 'Drive-time lookup failed.' };
    }
  }

  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 in
  pptx.author = 'TransMedics OCS Network';
  pptx.title = `Site Selection — ${city.name}`;
  const W = 13.33;
  const Hh = 7.5;
  const cityLabel = `${city.name}${city.state ? `, ${city.state}` : ''}`;

  // Section slide with a crimson title band + footer.
  const section = (title: string) => {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.85, fill: { color: CRIMSON } });
    s.addText(title, {
      x: 0.5, y: 0, w: W - 1, h: 0.85, fontFace: 'Arial', fontSize: 22, bold: true, color: WHITE, valign: 'middle',
    });
    s.addText(`${cityLabel} · TransMedics OCS Network`, {
      x: 0.5, y: Hh - 0.4, w: W - 1, h: 0.3, fontSize: 9, color: MUTED, valign: 'middle',
    });
    return s;
  };

  const headerRow = (labels: string[]) =>
    labels.map((t) => ({
      text: t,
      options: { fill: { color: CRIMSON }, color: WHITE, bold: true, align: 'center' as const, valign: 'middle' as const },
    }));
  const tableOpts = (x: number, y: number, w: number, colW: number[]) => ({
    x, y, w, colW,
    border: { type: 'solid' as const, pt: 0.5, color: LINE },
    fontFace: 'Arial', fontSize: 10, color: INK, valign: 'middle' as const,
    autoPage: false,
  });

  // ---- 1. Title slide ----
  {
    const s = pptx.addSlide();
    s.background = { color: CRIMSON };
    s.addText('TRANSMEDICS OCS NETWORK', { x: 0.7, y: 2.3, w: 12, h: 0.4, fontFace: 'Arial', fontSize: 14, bold: true, color: 'F2B8C1', charSpacing: 3 });
    s.addText('Site Selection Explorer', { x: 0.7, y: 2.75, w: 12, h: 1, fontFace: 'Arial', fontSize: 40, bold: true, color: WHITE });
    s.addText(cityLabel, { x: 0.7, y: 3.95, w: 12, h: 0.6, fontFace: 'Arial', fontSize: 22, color: WHITE });
    s.addText(`Generated ${fmtDate(new Date())}`, { x: 0.7, y: 4.55, w: 12, h: 0.4, fontFace: 'Arial', fontSize: 12, color: 'F2B8C1' });
  }

  // ---- 2. Recommendation ----
  {
    const s = section('Recommendation');
    if (!candidates.length) {
      s.addText('No candidate sites yet — add sites to generate a recommendation.', { x: 0.6, y: 3, w: 12, h: 0.6, fontSize: 14, color: MUTED });
    } else {
      const top = candidates[0];
      s.addShape(pptx.ShapeType.rect, { x: 0.6, y: 1.3, w: 4.2, h: 2.4, fill: { color: LIGHT }, line: { color: LINE, width: 1 } });
      s.addText(`#${top.rank}`, { x: 0.8, y: 1.45, w: 3.8, h: 0.4, fontSize: 12, bold: true, color: CRIMSON });
      s.addText(top.name, { x: 0.8, y: 1.8, w: 3.8, h: 0.8, fontSize: 22, bold: true, color: INK });
      s.addText(top.area || cityLabel, { x: 0.8, y: 2.5, w: 3.8, h: 0.4, fontSize: 12, color: MUTED });
      s.addText([{ text: `${top.composite}`, options: { fontSize: 44, bold: true, color: CRIMSON } }, { text: ' /100', options: { fontSize: 16, color: MUTED } }], { x: 0.8, y: 2.9, w: 3.8, h: 0.7 });
      // Top contributing factors.
      const contrib = factors
        .map((f) => ({ label: f.label, c: scoreOf(top.scores, f.key) * norm[f.key] }))
        .sort((a, b) => b.c - a.c)
        .slice(0, 3)
        .map((x) => `• ${x.label}`);
      s.addText('Strongest factors', { x: 5.2, y: 1.4, w: 7.4, h: 0.4, fontSize: 12, bold: true, color: MUTED });
      s.addText(contrib.join('\n'), { x: 5.2, y: 1.8, w: 7.4, h: 1.4, fontSize: 15, color: INK, lineSpacingMultiple: 1.3 });
      if (candidates.length > 1) {
        s.addText('Runners-up', { x: 5.2, y: 3.4, w: 7.4, h: 0.4, fontSize: 12, bold: true, color: MUTED });
        const others = candidates.slice(1, 4).map((s2) => `#${s2.rank}  ${s2.name} — ${s2.composite}`);
        s.addText(others.join('\n'), { x: 5.2, y: 3.8, w: 7.4, h: 1.6, fontSize: 14, color: INK, lineSpacingMultiple: 1.3 });
      }
    }
  }

  // ---- 3. Factor weighting (bars) ----
  {
    const s = section('Factor weighting');
    let y = 1.3;
    const barX = 4.3;
    const barMax = 7.2;
    factors.forEach((f) => {
      const pct = Math.round(norm[f.key] * 100);
      s.addText(f.short, { x: 0.6, y, w: 3.5, h: 0.4, fontSize: 13, color: INK, valign: 'middle' });
      s.addShape(pptx.ShapeType.rect, { x: barX, y: y + 0.05, w: barMax, h: 0.3, fill: { color: LIGHT } });
      s.addShape(pptx.ShapeType.rect, { x: barX, y: y + 0.05, w: Math.max(0.04, (barMax * pct) / 100), h: 0.3, fill: { color: hex(f.color) } });
      s.addText(`${pct}%`, { x: barX + barMax + 0.15, y, w: 1, h: 0.4, fontSize: 12, bold: true, color: INK, valign: 'middle' });
      y += 0.66;
    });
    s.addText('Weights are normalized to 100% across the active factors.', { x: 0.6, y: y + 0.1, w: 11, h: 0.4, fontSize: 10, italic: true, color: MUTED });
  }

  // ---- 4. Ranked candidates ----
  {
    const s = section('Ranked candidates');
    const heads = ['#', 'Candidate', 'Area', 'Score', ...factors.map((f) => COMPACT[f.key])];
    const base = [0.5, 2.6, 2.4, 0.9];
    const fw = (12.33 - base.reduce((a, b) => a + b, 0)) / factors.length;
    const colW = [...base, ...factors.map(() => fw)];
    const rows = [
      headerRow(heads),
      ...scored.map((s2) => {
        const cells = [
          { text: s2.isOffice ? '—' : String(s2.rank), options: { align: 'center' as const } },
          { text: s2.isOffice ? `${s2.name} (current)` : s2.name, options: {} },
          { text: s2.area || cityLabel, options: {} },
          { text: String(s2.composite), options: { align: 'center' as const, bold: true } },
          ...factors.map((f) => ({ text: String(scoreOf(s2.scores, f.key)), options: { align: 'center' as const } })),
        ];
        const fill = s2.isOffice ? 'EDEAE9' : undefined;
        return cells.map((c) => ({ ...c, options: { ...c.options, ...(fill ? { fill: { color: fill } } : {}) } }));
      }),
    ];
    s.addTable(rows, { ...tableOpts(0.5, 1.15, 12.33, colW), fontSize: 10 });
  }

  // ---- 5. Factor breakdown (top site) ----
  if (candidates.length) {
    const top = candidates[0];
    const s = section(`Factor breakdown — ${top.name}`);
    const rows = [
      headerRow(['Factor', 'Score', 'Weight', 'Contribution']),
      ...factors.map((f) => {
        const raw = scoreOf(top.scores, f.key);
        const wp = Math.round(norm[f.key] * 100);
        return [
          { text: f.label, options: {} },
          { text: String(raw), options: { align: 'center' as const } },
          { text: `${wp}%`, options: { align: 'center' as const } },
          { text: `+${(raw * norm[f.key]).toFixed(1)}`, options: { align: 'center' as const, bold: true } },
        ];
      }),
      [
        { text: 'Weighted score', options: { bold: true, fill: { color: LIGHT } } },
        { text: '', options: { fill: { color: LIGHT } } },
        { text: '', options: { fill: { color: LIGHT } } },
        { text: String(top.composite), options: { align: 'center' as const, bold: true, fill: { color: LIGHT } } },
      ],
    ];
    s.addTable(rows, tableOpts(0.5, 1.15, 8.5, [3.6, 1.5, 1.5, 1.9]));
  }

  // ---- 6. Employee commute drive times ----
  {
    const s = section('Employee commute drive times');
    if (commute.error || !commute.rows) {
      s.addText(commute.error || 'No commute data available.', { x: 0.6, y: 1.4, w: 12, h: 0.6, fontSize: 14, color: MUTED });
      s.addText('This section drives from each staff location to the top candidate sites and the nearest transplant center / airport (traffic-aware, typical weekday 8 AM). Plot staff on the map and configure the Google key to populate it.', { x: 0.6, y: 2.1, w: 11.5, h: 1.2, fontSize: 11, color: MUTED, lineSpacingMultiple: 1.3 });
    } else {
      s.addText('Minutes from each staff location (weekday 8 AM, traffic-aware).', { x: 0.5, y: 1.0, w: 12, h: 0.3, fontSize: 10, italic: true, color: MUTED });
      const siteCols = commute.siteNames ?? [];
      const heads = ['Staff location', 'Staff', ...siteCols, 'Nrst ctr', 'Nrst airport'];
      const base = [3.0, 0.8];
      const tail = [1.0, 1.1];
      const midW = (12.33 - base.reduce((a, b) => a + b, 0) - tail.reduce((a, b) => a + b, 0)) / Math.max(1, siteCols.length);
      const colW = [...base, ...siteCols.map(() => midW), ...tail];
      const rows = [
        headerRow(heads),
        ...commute.rows.map((r) => [
          { text: r.label || '—', options: {} },
          { text: String(r.hc), options: { align: 'center' as const } },
          ...r.siteMins.map((m) => ({ text: mins(m), options: { align: 'center' as const } })),
          { text: mins(r.ctr), options: { align: 'center' as const } },
          { text: mins(r.air), options: { align: 'center' as const } },
        ]),
        [
          { text: 'Weighted avg commute', options: { bold: true, fill: { color: LIGHT } } },
          { text: '', options: { fill: { color: LIGHT } } },
          ...(commute.wavg ?? []).map((m) => ({ text: mins(m), options: { align: 'center' as const, bold: true, fill: { color: LIGHT } } })),
          { text: '', options: { fill: { color: LIGHT } } },
          { text: '', options: { fill: { color: LIGHT } } },
        ],
      ];
      s.addTable(rows, { ...tableOpts(0.5, 1.35, 12.33, colW), fontSize: 9.5 });
    }
  }

  // ---- 7. Reference points ----
  {
    const s = section('Reference points');
    const left = 0.6;
    let y = 1.25;
    const listBlock = (title: string, items: string[]) => {
      s.addText(title, { x: left, y, w: 6, h: 0.35, fontSize: 13, bold: true, color: SLATE });
      y += 0.4;
      s.addText(items.length ? items.join('\n') : 'None', { x: left + 0.2, y, w: 11.8, h: 0.4 + items.length * 0.28, fontSize: 12, color: INK, lineSpacingMultiple: 1.25 });
      y += Math.max(1, items.length) * 0.3 + 0.3;
    };
    listBlock('Transplant centers (ranked)', city.centers.map((c, i) => `${i + 1}.  ${c.short || 'Center'}${c.address ? ` — ${c.address}` : ''}`));
    listBlock('Airports (ranked)', city.airports.map((a, i) => `${i + 1}.  ${(a.code || a.icao || '?').toUpperCase()}${a.name ? ` — ${a.name}` : ''}`));
    const extras: string[] = [];
    if (city.aviation?.on) extras.push(`TMDX aviation facility — ${city.aviation.address || 'placed on map'}`);
    if (city.office.on) extras.push(`Current office — ${city.office.address || 'placed on map'}`);
    if (extras.length) listBlock('TMDX facilities', extras);
  }

  // ---- 8. Staff locations ----
  {
    const staffAll = city.staff ?? [];
    const s = section('Staff locations');
    if (!staffAll.length) {
      s.addText('No staff locations recorded.', { x: 0.6, y: 1.4, w: 12, h: 0.5, fontSize: 14, color: MUTED });
    } else {
      const total = staffAll.reduce((a, x) => a + (parseInt(x.employees, 10) || 0), 0);
      const rows = [
        headerRow(['City', 'State', 'ZIP', 'Employees']),
        ...staffAll.map((x) => [
          { text: x.city || '—', options: {} },
          { text: x.state || '', options: { align: 'center' as const } },
          { text: x.zip || '', options: { align: 'center' as const } },
          { text: x.employees || '0', options: { align: 'center' as const } },
        ]),
        [
          { text: 'Total', options: { bold: true, fill: { color: LIGHT } } },
          { text: '', options: { fill: { color: LIGHT } } },
          { text: '', options: { fill: { color: LIGHT } } },
          { text: String(total), options: { align: 'center' as const, bold: true, fill: { color: LIGHT } } },
        ],
      ];
      s.addTable(rows, tableOpts(0.5, 1.15, 8, [3.2, 1.4, 1.6, 1.8]));
    }
  }

  const safe = `${city.name}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'city';
  await pptx.writeFile({ fileName: `site-selection-${safe}.pptx` });
  return { ok: true };
}
