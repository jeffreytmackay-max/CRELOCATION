// Export a comprehensive PowerPoint deck covering every city and every section,
// styled to the TransMedics brand & collateral standards (crimson + peach accent,
// charcoal ink, cream surfaces, Mulish type, logo header, crimson section rule,
// confidentiality footer, faint monogram watermark on cover / divider slides).
//
// PptxGenJS is dynamically imported so it code-splits and only loads on export.

import { FACTORS, activeFactorKeys } from '../data/factors';
import { normalize, scoreCity, scoreOf } from './scoring';
import type { AppState, FactorKey } from '../types';

// Brand palette (design system).
const FONT = 'Mulish';
const CRIMSON = '9D2235';
const WINE = '740223';
const PEACH = 'FFAE81';
const INK = '302F32';
const CREAM = 'EFECEA';
const BORDER = 'DAD3D1';
const MUTED = '8A8483';
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
const finite = (p: { lat?: number; lng?: number } | null | undefined) =>
  !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
const xy = (p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng });

/** Fetch the static overview map for a city as a data URL (or null on failure). */
async function fetchMapDataUrl(payload: unknown): Promise<string | null> {
  try {
    const res = await fetch('/api/staticmap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image')) return null;
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportPptx(state: AppState): Promise<{ ok: boolean; error?: string }> {
  const cities = state.cities;
  if (!cities.length) return { ok: false, error: 'Add a city with candidate sites first.' };

  const includeSpace = state.includeSpace;
  const factors = FACTORS.filter((f) => activeFactorKeys(includeSpace).includes(f.key));
  const norm = normalize(state.weights, includeSpace);

  const { matrix, departureTimestamp } = await import('./drivetimes');
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 × 7.5 in (16:9)
  pptx.author = 'TransMedics Group, Inc.';
  pptx.company = 'TransMedics';
  pptx.title = 'Site Selection Explorer';
  const W = 13.33;
  const H = 7.5;
  const CY = 2.05; // content top (below the section heading + crimson rule)
  const rect = pptx.ShapeType.rect;
  const roundRect = pptx.ShapeType.roundRect;

  // Placeholder "m" monogram lockup (crimson tile + wordmark).
  type Slide = ReturnType<typeof pptx.addSlide>;
  const lockup = (s: Slide, x: number, y: number, onDark = false) => {
    s.addShape(roundRect, { x, y, w: 0.32, h: 0.32, rectRadius: 0.06, fill: { color: onDark ? WHITE : CRIMSON } });
    s.addText('m', { x, y: y - 0.03, w: 0.32, h: 0.38, align: 'center', valign: 'middle', fontFace: FONT, bold: true, fontSize: 15, color: onDark ? CRIMSON : WHITE });
    s.addText('TransMedics', { x: x + 0.4, y: y - 0.03, w: 2.6, h: 0.38, valign: 'middle', fontFace: FONT, bold: true, fontSize: 14, color: onDark ? WHITE : INK });
  };
  // Faint oversized monogram bleeding off the bottom-right corner.
  const watermark = (s: Slide, color: string) =>
    s.addText('m', { x: 9.6, y: 3.2, w: 5, h: 5, fontFace: FONT, bold: true, fontSize: 230, color, align: 'center', valign: 'middle' });

  // Branded content-slide chrome: logo header, eyebrow, section heading with a
  // crimson rule, and the confidentiality footer. Content starts at CY.
  const chrome = (title: string, cityLabel: string) => {
    const s = pptx.addSlide();
    s.background = { color: WHITE };
    lockup(s, 0.5, 0.42);
    s.addText('SITE SELECTION EXPLORER', { x: W - 5, y: 0.46, w: 4.5, h: 0.3, align: 'right', fontFace: FONT, bold: true, fontSize: 9, color: MUTED, charSpacing: 2 });
    s.addShape(rect, { x: 0.5, y: 0.92, w: W - 1, h: 0.014, fill: { color: BORDER } });
    s.addText(title, { x: 0.5, y: 1.12, w: W - 1, h: 0.55, fontFace: FONT, bold: true, fontSize: 26, color: INK, valign: 'middle' });
    s.addShape(rect, { x: 0.5, y: 1.78, w: W - 1, h: 0.022, fill: { color: CRIMSON } });
    s.addShape(rect, { x: 0.5, y: H - 0.52, w: W - 1, h: 0.014, fill: { color: BORDER } });
    s.addText('TRANSMEDICS PROPRIETARY & CONFIDENTIAL', { x: 0.5, y: H - 0.45, w: 8, h: 0.3, fontFace: FONT, fontSize: 8, color: MUTED, charSpacing: 1.2, valign: 'middle' });
    s.addText(cityLabel, { x: W - 5, y: H - 0.45, w: 4.5, h: 0.3, align: 'right', fontFace: FONT, fontSize: 8, color: MUTED, valign: 'middle' });
    return s;
  };

  const headerRow = (labels: string[]) =>
    labels.map((t) => ({ text: t, options: { fill: { color: CRIMSON }, color: WHITE, bold: true, align: 'center' as const, valign: 'middle' as const } }));
  const tableOpts = (x: number, y: number, w: number, colW: number[], fontSize = 10) => ({
    x, y, w, colW,
    border: { type: 'solid' as const, pt: 0.5, color: BORDER },
    fontFace: FONT, fontSize, color: INK, valign: 'middle' as const, autoPage: false,
  });

  // ---- Cover slide ----
  {
    const s = pptx.addSlide();
    s.background = { color: CRIMSON };
    watermark(s, WINE);
    lockup(s, 0.7, 0.7, true);
    s.addText('TRANSMEDICS OCS NETWORK', { x: 0.72, y: 2.35, w: 12, h: 0.4, fontFace: FONT, bold: true, fontSize: 13, color: PEACH, charSpacing: 3 });
    s.addText('Site selection explorer', { x: 0.68, y: 2.8, w: 12, h: 1, fontFace: FONT, fontSize: 42, color: WHITE, charSpacing: -0.5 });
    const sub = cities.length === 1 ? `${cities[0].name}${cities[0].state ? `, ${cities[0].state}` : ''}` : `${cities.length} metros analyzed`;
    s.addText(sub, { x: 0.72, y: 4.05, w: 12, h: 0.6, fontFace: FONT, fontSize: 22, color: WHITE });
    s.addText(`Generated ${fmtDate(new Date())}`, { x: 0.72, y: 4.7, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: PEACH });
    s.addText('TRANSMEDICS PROPRIETARY & CONFIDENTIAL INFORMATION', { x: 0.72, y: H - 0.55, w: 11, h: 0.3, fontFace: FONT, fontSize: 8, color: PEACH, charSpacing: 1.2 });
  }

  for (const city of cities) {
    const cityLabel = `${city.name}${city.state ? `, ${city.state}` : ''}`;
    const scored = scoreCity(city, state.weights, includeSpace);
    const candidates = scored.filter((s) => !s.isOffice);

    // City divider (only when multiple cities).
    if (cities.length > 1) {
      const s = pptx.addSlide();
      s.background = { color: INK };
      watermark(s, '3B3A3E');
      lockup(s, 0.7, 0.7, true);
      s.addText('METRO', { x: 0.72, y: 2.7, w: 12, h: 0.35, fontFace: FONT, bold: true, fontSize: 12, color: PEACH, charSpacing: 3 });
      s.addText(cityLabel, { x: 0.68, y: 3.1, w: 12, h: 1, fontFace: FONT, fontSize: 36, color: WHITE, charSpacing: -0.5 });
      s.addText(`${candidates.length} candidate site${candidates.length === 1 ? '' : 's'}`, { x: 0.72, y: 4.15, w: 12, h: 0.5, fontFace: FONT, fontSize: 16, color: 'C9C6C7' });
    }

    // ---- Recommendation ----
    {
      const s = chrome('Recommendation', cityLabel);
      if (!candidates.length) {
        s.addText('No candidate sites yet — add sites to generate a recommendation.', { x: 0.5, y: CY, w: 12, h: 0.6, fontFace: FONT, fontSize: 14, color: MUTED });
      } else {
        const top = candidates[0];
        s.addShape(roundRect, { x: 0.5, y: CY, w: 4.3, h: 2.5, rectRadius: 0.12, fill: { color: CREAM }, line: { color: BORDER, width: 1 } });
        s.addText('TOP RECOMMENDATION', { x: 0.72, y: CY + 0.16, w: 3.9, h: 0.3, fontFace: FONT, bold: true, fontSize: 9, color: CRIMSON, charSpacing: 2 });
        s.addText(`#${top.rank}  ${top.name}`, { x: 0.72, y: CY + 0.5, w: 3.9, h: 0.7, fontFace: FONT, bold: true, fontSize: 20, color: INK });
        s.addText(top.area || cityLabel, { x: 0.72, y: CY + 1.15, w: 3.9, h: 0.35, fontFace: FONT, fontSize: 12, color: MUTED });
        s.addText([{ text: `${top.composite}`, options: { fontSize: 44, color: CRIMSON, bold: true } }, { text: '  /100 weighted score', options: { fontSize: 13, color: MUTED } }], { x: 0.72, y: CY + 1.55, w: 3.9, h: 0.7, fontFace: FONT });
        const contrib = factors
          .map((f) => ({ label: f.label, c: scoreOf(top.scores, f.key) * norm[f.key] }))
          .sort((a, b) => b.c - a.c)
          .slice(0, 3)
          .map((x2) => `•  ${x2.label}`);
        s.addText('STRONGEST FACTORS', { x: 5.2, y: CY + 0.05, w: 7.4, h: 0.4, fontFace: FONT, bold: true, fontSize: 9, color: MUTED, charSpacing: 2 });
        s.addText(contrib.join('\n'), { x: 5.2, y: CY + 0.45, w: 7.4, h: 1.4, fontFace: FONT, fontSize: 15, color: INK, lineSpacingMultiple: 1.35 });
        if (candidates.length > 1) {
          s.addText('RUNNERS-UP', { x: 5.2, y: CY + 2.0, w: 7.4, h: 0.4, fontFace: FONT, bold: true, fontSize: 9, color: MUTED, charSpacing: 2 });
          s.addText(candidates.slice(1, 4).map((s2) => `#${s2.rank}   ${s2.name} — ${s2.composite}`).join('\n'), { x: 5.2, y: CY + 2.4, w: 7.4, h: 1.6, fontFace: FONT, fontSize: 14, color: INK, lineSpacingMultiple: 1.35 });
        }
      }
    }

    // ---- Factor weighting (bars) ----
    {
      const s = chrome('Factor weighting', cityLabel);
      let y = CY + 0.15;
      const barX = 4.3;
      const barMax = 7.2;
      factors.forEach((f) => {
        const pct = Math.round(norm[f.key] * 100);
        s.addText(f.short, { x: 0.6, y, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 13, color: INK, valign: 'middle' });
        s.addShape(rect, { x: barX, y: y + 0.06, w: barMax, h: 0.3, fill: { color: CREAM } });
        s.addShape(rect, { x: barX, y: y + 0.06, w: Math.max(0.04, (barMax * pct) / 100), h: 0.3, fill: { color: hex(f.color) } });
        s.addText(`${pct}%`, { x: barX + barMax + 0.15, y, w: 1, h: 0.4, fontFace: FONT, fontSize: 12, bold: true, color: INK, valign: 'middle' });
        y += 0.66;
      });
      s.addText('Weights are normalized to 100% across the active factors.', { x: 0.6, y: y + 0.1, w: 11, h: 0.4, fontFace: FONT, fontSize: 10, italic: true, color: MUTED });
    }

    // ---- Location overview ----
    {
      const s = chrome('Location overview', cityLabel);
      const payload = {
        sites: city.sites.filter(finite).map(xy),
        centers: city.centers.filter(finite).map(xy),
        airports: city.airports.filter(finite).map(xy),
        staff: (city.staff ?? []).filter(finite).map((p) => xy(p as { lat: number; lng: number })),
        office: city.office.on && finite(city.office) ? xy(city.office) : undefined,
        aviation: city.aviation?.on && finite(city.aviation) ? xy(city.aviation) : undefined,
        size: '640x400',
      };
      const hasPoints = payload.sites.length + payload.centers.length + payload.airports.length + payload.staff.length > 0;
      const dataUrl = hasPoints ? await fetchMapDataUrl(payload) : null;
      if (dataUrl) {
        s.addImage({ data: dataUrl, x: 0.5, y: CY, w: 7.5, h: 4.69 });
        const legend: [string, string][] = [
          ['D62828', 'Candidate sites'],
          [CRIMSON, 'Transplant centers'],
          ['44546A', 'Airports'],
          ['0E7490', 'TMDX aviation'],
          [INK, 'Current office'],
          ['1F8F5F', 'Staff'],
        ];
        s.addText('LEGEND', { x: 8.4, y: CY + 0.1, w: 3.4, h: 0.4, fontFace: FONT, bold: true, fontSize: 10, color: MUTED, charSpacing: 2 });
        legend.forEach(([c, label], i) => {
          const yy = CY + 0.6 + i * 0.5;
          s.addShape(rect, { x: 8.45, y: yy, w: 0.28, h: 0.28, fill: { color: c } });
          s.addText(label, { x: 8.85, y: yy - 0.06, w: 3.2, h: 0.4, fontFace: FONT, fontSize: 13, color: INK, valign: 'middle' });
        });
      } else {
        s.addText('Map preview unavailable — enable the Maps Static API on the Google key and place points on the map.', { x: 0.5, y: CY, w: 12, h: 0.8, fontFace: FONT, fontSize: 13, color: MUTED });
      }
    }

    // ---- Ranked candidates ----
    {
      const s = chrome('Ranked candidates', cityLabel);
      const heads = ['#', 'Candidate', 'Area', 'Score', ...factors.map((f) => COMPACT[f.key])];
      const base = [0.5, 2.6, 2.4, 0.9];
      const fw = (12.33 - base.reduce((a, b) => a + b, 0)) / factors.length;
      const colW = [...base, ...factors.map(() => fw)];
      const rows = [
        headerRow(heads),
        ...scored.map((s2) => {
          const fill = s2.isOffice ? CREAM : undefined;
          const cells = [
            { text: s2.isOffice ? '—' : String(s2.rank), options: { align: 'center' as const } },
            { text: s2.isOffice ? `${s2.name} (current)` : s2.name, options: {} },
            { text: s2.area || cityLabel, options: {} },
            { text: String(s2.composite), options: { align: 'center' as const, bold: true } },
            ...factors.map((f) => ({ text: String(scoreOf(s2.scores, f.key)), options: { align: 'center' as const } })),
          ];
          return cells.map((c) => ({ ...c, options: { ...c.options, ...(fill ? { fill: { color: fill } } : {}) } }));
        }),
      ];
      s.addTable(rows, tableOpts(0.5, CY, 12.33, colW));
    }

    // ---- Factor breakdown (top site) ----
    if (candidates.length) {
      const top = candidates[0];
      const s = chrome(`Factor breakdown — ${top.name}`, cityLabel);
      const rows = [
        headerRow(['Factor', 'Score', 'Weight', 'Contribution']),
        ...factors.map((f) => {
          const raw = scoreOf(top.scores, f.key);
          return [
            { text: f.label, options: {} },
            { text: String(raw), options: { align: 'center' as const } },
            { text: `${Math.round(norm[f.key] * 100)}%`, options: { align: 'center' as const } },
            { text: `+${(raw * norm[f.key]).toFixed(1)}`, options: { align: 'center' as const, bold: true } },
          ];
        }),
        [
          { text: 'Weighted score', options: { bold: true, fill: { color: CREAM } } },
          { text: '', options: { fill: { color: CREAM } } },
          { text: '', options: { fill: { color: CREAM } } },
          { text: String(top.composite), options: { align: 'center' as const, bold: true, fill: { color: CREAM } } },
        ],
      ];
      s.addTable(rows, tableOpts(0.5, CY, 8.5, [3.6, 1.5, 1.5, 1.9]));
    }

    // ---- Employee commute drive times ----
    {
      const s = chrome('Employee commute drive times', cityLabel);
      const staff = (city.staff ?? []).filter((st) => st.lat != null && st.lng != null);
      const dtSites = city.sites.filter((st) => st.lat != null && st.lng != null);
      const centers = city.centers.filter(finite);
      const airports = city.airports.filter(finite);
      let note = '';
      if (!staff.length) note = 'No staff plotted on the map — add staff and use “Plot on map”.';
      else if (!dtSites.length) note = 'No candidate sites with locations yet.';
      if (note) {
        s.addText('Minutes from each staff location to the candidate offices and nearest key locations.', { x: 0.5, y: CY, w: 12, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: MUTED });
        s.addText(note, { x: 0.5, y: CY + 0.5, w: 12, h: 0.6, fontFace: FONT, fontSize: 14, color: MUTED });
      } else {
        try {
          const shown = [...dtSites]
            .sort((a, b) => (candidates.find((s2) => s2.id === a.id)?.rank ?? 99) - (candidates.find((s2) => s2.id === b.id)?.rank ?? 99))
            .slice(0, 6);
          const dests = [...shown, ...centers, ...airports].map((p) => xy(p as { lat: number; lng: number }));
          const origins = staff.map((st) => ({ lat: st.lat as number, lng: st.lng as number }));
          const M = await matrix(origins, dests, departureTimestamp('weekday-8'));
          const nS = shown.length;
          const rowsData = staff.map((st, i) => {
            const row = M[i] ?? [];
            const ctrVals = row.slice(nS, nS + centers.length).filter((v): v is number => v != null);
            const airVals = row.slice(nS + centers.length).filter((v): v is number => v != null);
            return {
              label: [st.city, st.state, st.zip].filter(Boolean).join(' '),
              hc: Math.max(0, parseInt(st.employees, 10) || 0),
              siteMins: row.slice(0, nS),
              ctr: ctrVals.length ? Math.min(...ctrVals) : null,
              air: airVals.length ? Math.min(...airVals) : null,
            };
          });
          const wavg = shown.map((_, j) => {
            let w = 0;
            let ws = 0;
            rowsData.forEach((r) => {
              const m = r.siteMins[j];
              if (m == null) return;
              const h = Math.max(1, r.hc);
              w += h;
              ws += h * m;
            });
            return w ? Math.round(ws / w) : null;
          });
          const siteNames = shown.map((s2) => s2.short || s2.name);
          s.addText('Minutes from each staff location (weekday 8 AM, traffic-aware).', { x: 0.5, y: CY - 0.02, w: 12, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: MUTED });
          const heads = ['Staff location', 'Staff', ...siteNames, 'Nrst ctr', 'Nrst airport'];
          const b0 = [3.0, 0.8];
          const tail = [1.0, 1.1];
          const midW = (12.33 - b0.reduce((a, b) => a + b, 0) - tail.reduce((a, b) => a + b, 0)) / Math.max(1, siteNames.length);
          const colW = [...b0, ...siteNames.map(() => midW), ...tail];
          const rows = [
            headerRow(heads),
            ...rowsData.map((r) => [
              { text: r.label || '—', options: {} },
              { text: String(r.hc), options: { align: 'center' as const } },
              ...r.siteMins.map((m) => ({ text: mins(m), options: { align: 'center' as const } })),
              { text: mins(r.ctr), options: { align: 'center' as const } },
              { text: mins(r.air), options: { align: 'center' as const } },
            ]),
            [
              { text: 'Weighted avg commute', options: { bold: true, fill: { color: CREAM } } },
              { text: '', options: { fill: { color: CREAM } } },
              ...wavg.map((m) => ({ text: mins(m), options: { align: 'center' as const, bold: true, fill: { color: CREAM } } })),
              { text: '', options: { fill: { color: CREAM } } },
              { text: '', options: { fill: { color: CREAM } } },
            ],
          ];
          s.addTable(rows, tableOpts(0.5, CY + 0.3, 12.33, colW, 9.5));
        } catch (e) {
          s.addText(`Drive times unavailable: ${e instanceof Error ? e.message : 'lookup failed'}.`, { x: 0.5, y: CY + 0.3, w: 12, h: 0.6, fontFace: FONT, fontSize: 13, color: MUTED });
        }
      }
    }

    // ---- Reference points ----
    {
      const s = chrome('Reference points', cityLabel);
      const left = 0.5;
      let y = CY;
      const listBlock = (title: string, items: string[]) => {
        s.addText(title.toUpperCase(), { x: left, y, w: 8, h: 0.35, fontFace: FONT, bold: true, fontSize: 10, color: CRIMSON, charSpacing: 1.5 });
        y += 0.4;
        s.addText(items.length ? items.join('\n') : 'None', { x: left + 0.2, y, w: 11.8, h: 0.4 + items.length * 0.28, fontFace: FONT, fontSize: 12, color: INK, lineSpacingMultiple: 1.25 });
        y += Math.max(1, items.length) * 0.3 + 0.35;
      };
      listBlock('Transplant centers (ranked)', city.centers.map((c, i) => `${i + 1}.  ${c.short || 'Center'}${c.address ? ` — ${c.address}` : ''}`));
      listBlock('Airports (ranked)', city.airports.map((a, i) => `${i + 1}.  ${(a.code || a.icao || '?').toUpperCase()}${a.name ? ` — ${a.name}` : ''}`));
      const extras: string[] = [];
      if (city.aviation?.on) extras.push(`TMDX aviation facility — ${city.aviation.address || 'placed on map'}`);
      if (city.office.on) extras.push(`Current office — ${city.office.address || 'placed on map'}`);
      if (extras.length) listBlock('TMDX facilities', extras);
    }

    // ---- Staff locations ----
    {
      const staffAll = city.staff ?? [];
      const s = chrome('Staff locations', cityLabel);
      if (!staffAll.length) {
        s.addText('No staff locations recorded.', { x: 0.5, y: CY, w: 12, h: 0.5, fontFace: FONT, fontSize: 14, color: MUTED });
      } else {
        const total = staffAll.reduce((a, x2) => a + (parseInt(x2.employees, 10) || 0), 0);
        const rows = [
          headerRow(['City', 'State', 'ZIP', 'Employees']),
          ...staffAll.map((x2) => [
            { text: x2.city || '—', options: {} },
            { text: x2.state || '', options: { align: 'center' as const } },
            { text: x2.zip || '', options: { align: 'center' as const } },
            { text: x2.employees || '0', options: { align: 'center' as const } },
          ]),
          [
            { text: 'Total', options: { bold: true, fill: { color: CREAM } } },
            { text: '', options: { fill: { color: CREAM } } },
            { text: '', options: { fill: { color: CREAM } } },
            { text: String(total), options: { align: 'center' as const, bold: true, fill: { color: CREAM } } },
          ],
        ];
        s.addTable(rows, tableOpts(0.5, CY, 8, [3.2, 1.4, 1.6, 1.8]));
      }
    }
  }

  const base = cities.length === 1 ? `${cities[0].name}`.replace(/[^a-z0-9]+/gi, '-') : 'all-metros';
  await pptx.writeFile({ fileName: `site-selection-${base || 'city'}.pptx` });
  return { ok: true };
}
