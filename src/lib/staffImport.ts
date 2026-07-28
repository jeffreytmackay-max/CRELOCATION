// Parse an uploaded spreadsheet (.xlsx / .xls / .csv / .tsv) into staff rows.
//
// SheetJS is loaded lazily (dynamic import) so it never lands in the initial
// bundle — the ~400 KB library only downloads when someone actually imports a
// file. Columns are matched by header name, with a content-based fallback when
// the sheet has no recognizable header row.

export interface StaffRow {
  city: string;
  state: string;
  zip: string;
  employees: string;
}

const HEADER = {
  city: /\b(city|town|municipal(ity)?|location|home\s*city)\b/i,
  state: /\b(state|province|region|\bst\b)\b/i,
  zip: /\b(zip|postal|post\s*code|zipcode)\b/i,
  emp: /\b(employ\w*|head\s*count|headcount|staff|people|count|qty|quantity|number|#)\b/i,
};

const ZIP_RE = /^\d{5}(-\d{4})?$/;
const STATE_RE = /^[A-Za-z]{2}$/;

const cell = (v: unknown): string => (v == null ? '' : String(v).trim());

type Idx = { city: number; state: number; zip: number; emp: number };

/** Map columns by header, then infer any still-unmapped column from its values. */
function rowsToStaff(rows: string[][]): StaffRow[] {
  const clean = rows.filter((r) => Array.isArray(r) && r.some((c) => cell(c) !== ''));
  if (!clean.length) return [];

  // Try to find a header row within the first few rows.
  let headerIdx = -1;
  let idx: Idx = { city: -1, state: -1, zip: -1, emp: -1 };
  for (let i = 0; i < Math.min(5, clean.length); i++) {
    const cols = clean[i].map(cell);
    const found: Idx = { city: -1, state: -1, zip: -1, emp: -1 };
    cols.forEach((c, ci) => {
      if (found.city < 0 && HEADER.city.test(c)) found.city = ci;
      else if (found.state < 0 && HEADER.state.test(c)) found.state = ci;
      else if (found.zip < 0 && HEADER.zip.test(c)) found.zip = ci;
      else if (found.emp < 0 && HEADER.emp.test(c)) found.emp = ci;
    });
    if (found.city >= 0 || found.zip >= 0 || found.state >= 0) {
      headerIdx = i;
      idx = found;
      break;
    }
  }

  const dataRows = headerIdx >= 0 ? clean.slice(headerIdx + 1) : clean;
  // Fill any column the header didn't identify (e.g. an "ST" state column, or
  // a headerless sheet) by sampling the actual values.
  fillByInference(dataRows, idx);

  const out: StaffRow[] = [];
  for (const r of dataRows) {
    const cols = r.map(cell);
    const city = idx.city >= 0 ? cols[idx.city] || '' : '';
    const state = (idx.state >= 0 ? cols[idx.state] || '' : '').toUpperCase().slice(0, 2);
    const zip = (idx.zip >= 0 ? cols[idx.zip] || '' : '').replace(/\.0$/, '');
    const employees = (idx.emp >= 0 ? cols[idx.emp] || '' : '').replace(/[^0-9]/g, '');
    if (!city && !zip && !state) continue; // skip blank / separator rows
    out.push({ city, state, zip, employees });
  }
  return out;
}

/** Assign roles to unmapped columns by sampling their values. Mutates idx. */
function fillByInference(rows: string[][], idx: Idx): void {
  const nCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const sample = rows.slice(0, 30);
  const used = new Set<number>([idx.city, idx.state, idx.zip, idx.emp].filter((i) => i >= 0));
  const frac = (c: number, test: (s: string) => boolean) => {
    const vals = sample.map((r) => cell(r[c])).filter(Boolean);
    return vals.length ? vals.filter(test).length / vals.length : 0;
  };
  const pick = (test: (s: string) => boolean, min = 0.5) => {
    let best = -1;
    let bestScore = min;
    for (let c = 0; c < nCols; c++) {
      if (used.has(c)) continue;
      const s = frac(c, test);
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }
    if (best >= 0) used.add(best);
    return best;
  };
  if (idx.zip < 0) idx.zip = pick((s) => ZIP_RE.test(s));
  if (idx.state < 0) idx.state = pick((s) => STATE_RE.test(s));
  if (idx.emp < 0) idx.emp = pick((s) => /^\d{1,4}$/.test(s) && !ZIP_RE.test(s));
  if (idx.city < 0) {
    for (let c = 0; c < nCols; c++) {
      if (used.has(c)) continue;
      if (frac(c, (s) => /[a-zA-Z]/.test(s)) >= 0.5) {
        idx.city = c;
        used.add(c);
        break;
      }
    }
  }
}

/** Parse a staff spreadsheet File into normalized rows. Throws on unreadable files. */
export async function parseStaffFile(file: File): Promise<StaffRow[]> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  let wb;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new Error('Could not read that file — save it as .xlsx or .csv and try again.');
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new Error('The spreadsheet has no sheets.');
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    raw: false,
    defval: '',
  }) as string[][];
  return rowsToStaff(rows);
}
