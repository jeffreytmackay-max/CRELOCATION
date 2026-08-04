// Export the current city's analysis as a shareable PDF report.
//
// jsPDF + autotable are dynamically imported so they code-split and never land
// in the initial bundle — they only load when someone exports.

import { FACTORS, activeFactorKeys } from '../data/factors';
import { normalize, scoreCity, scoreOf } from './scoring';
import type { AppState, FactorKey } from '../types';

const CRIMSON: [number, number, number] = [157, 34, 53];
const SLATE: [number, number, number] = [68, 84, 106];
const INK: [number, number, number] = [48, 47, 50];
const MUTED: [number, number, number] = [122, 120, 122];

/** Compact column headers for the ranking table. */
const COMPACT: Record<FactorKey, string> = {
  hospital: 'Transplant',
  airport: 'Airport',
  commute: 'Commute',
  crime: 'Crime',
  space: 'Real estate',
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Build and download a PDF report for the current city. Returns false if empty. */
export async function exportPdf(state: AppState): Promise<boolean> {
  const city = state.cities.find((c) => c.id === state.cityId) ?? state.cities[0];
  if (!city) return false;

  const includeSpace = state.includeSpace;
  const activeKeys = activeFactorKeys(includeSpace);
  const factors = FACTORS.filter((f) => activeKeys.includes(f.key));
  const norm = normalize(state.weights, includeSpace);
  const scored = scoreCity(city, state.weights, includeSpace);

  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  // ---- Title bar ----
  doc.setFillColor(...CRIMSON);
  doc.rect(0, 0, W, 66, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('TRANSMEDICS OCS NETWORK', M, 26);
  doc.setFontSize(17);
  doc.text('Site Selection Explorer', M, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${city.name}${city.state ? `, ${city.state}` : ''}`, W - M, 30, { align: 'right' });
  doc.text(`Generated ${fmtDate(new Date())}`, W - M, 46, { align: 'right' });

  let y = 92;

  // ---- Factor weights ----
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('FACTOR WEIGHTING', M, y);
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const weightsLine = factors
    .map((f) => `${f.short} ${Math.round(norm[f.key] * 100)}%`)
    .join('   ·   ');
  const wl = doc.splitTextToSize(weightsLine, W - 2 * M);
  doc.text(wl, M, y);
  y += wl.length * 13 + 8;

  // ---- Ranked candidates ----
  const head = [['#', 'Candidate', 'Area', 'Score', ...factors.map((f) => COMPACT[f.key])]];
  const body = scored.map((s) => [
    s.isOffice ? '—' : String(s.rank),
    s.isOffice ? `${s.name} (current)` : s.name,
    s.area || `${city.name}${city.state ? `, ${city.state}` : ''}`,
    String(s.composite),
    ...factors.map((f) => String(scoreOf(s.scores, f.key))),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: M, right: M },
    styles: { fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: [227, 221, 219], lineWidth: 0.5 },
    headStyles: { fillColor: CRIMSON, textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [247, 245, 244] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', fontStyle: 'bold' },
      ...Object.fromEntries(factors.map((_, i) => [4 + i, { halign: 'center' }])),
    },
    didParseCell: (data) => {
      // Shade the score column and the office benchmark row.
      if (data.section === 'body') {
        const raw = body[data.row.index];
        if (raw && raw[1].toString().includes('(current)')) data.cell.styles.fillColor = [237, 234, 233];
      }
    },
  });

  // autoTable tracks its own final Y.
  const anyDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  y = (anyDoc.lastAutoTable?.finalY ?? y) + 26;

  // ---- Reference points ----
  const line = (label: string, value: string, color = INK) => {
    if (y > H - 60) {
      doc.addPage();
      y = 56;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...color);
    doc.text(label, M, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    const vl = doc.splitTextToSize(value || '—', W - 2 * M - 96);
    doc.text(vl, M + 96, y);
    y += Math.max(vl.length, 1) * 12 + 4;
  };

  const section = (title: string) => {
    if (y > H - 70) {
      doc.addPage();
      y = 56;
    }
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(title.toUpperCase(), M, y);
    y += 15;
  };

  section('Reference points');
  const centers = city.centers.map((c, i) => `${i + 1}. ${c.short || 'Center'}`).join('   ');
  line('Transplant', centers || 'None', SLATE);
  const airports = city.airports
    .map((a, i) => `${i + 1}. ${(a.code || a.icao || '?').toUpperCase()}${a.name ? ` (${a.name})` : ''}`)
    .join('   ');
  line('Airports', airports || 'None', SLATE);
  if (city.aviation?.on) line('TMDX aviation', city.aviation.address || 'On (placed on map)', SLATE);
  if (city.office.on) line('Current office', city.office.address || 'On (placed on map)', SLATE);

  const staff = city.staff ?? [];
  const totalStaff = staff.reduce((a, s) => a + (parseInt(s.employees, 10) || 0), 0);
  if (staff.length) {
    line('Staff', `${totalStaff} employees across ${staff.length} location${staff.length === 1 ? '' : 's'}`, SLATE);
  }

  // ---- Footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('Weighted score = sum of (factor score x normalized weight). Higher is better.', M, H - 24);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 24, { align: 'right' });
  }

  const safe = `${city.name}`.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'city';
  doc.save(`site-selection-${safe}.pdf`);
  return true;
}
