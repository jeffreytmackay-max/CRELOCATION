// Vercel serverless function — per-site crime/safety score from the Zyla Labs
// "Crime Data by Zipcode" API.
//
// For each candidate site we resolve a ZIP (use the one supplied, else reverse-
// geocode the coordinates with the Google key), query Zyla for that ZIP, and map
// the result to a 0–100 safety score (higher = safer) for the "Crime & safety"
// slider. Both keys stay server-side.
//
// POST { sites: [{ id, lat, lng, zip? }] }  →  { results: [{ id, zip, score, grade }] }
// GET  ?zip=01370&debug=1  →  raw Zyla response (to confirm the shape; no key leaked)
//
// Requires Crime_DATA (Zyla API key). ZIP reverse-geocoding uses GOOGLE_MAPS_API_KEY.

const MAX_SITES = 25;

/** Read the Zyla key tolerantly of casing/naming (env var names are case-sensitive). */
function resolveCrimeKey() {
  const explicit = [
    'CRIME_DATA',
    'Crime_DATA',
    'crime_data',
    'Crime_Data',
    'CRIME_API_KEY',
    'ZYLA_API_KEY',
    'ZYLA_CRIME_API_KEY',
  ];
  for (const n of explicit) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  // Last resort: any env var whose name mentions "crime".
  for (const n of Object.keys(process.env)) {
    if (/crime/i.test(n)) {
      const v = process.env[n];
      if (v && String(v).trim()) return String(v).trim();
    }
  }
  return '';
}

const zylaUrl = (zip) =>
  `https://zylalabs.com/api/824/crime+data+by+zipcode+api/583/get+crime+rates+by+zip?zip=${encodeURIComponent(zip)}`;

/** Letter grade (A+ … F) → 0–100 safety score (A = safest). */
function gradeToScore(g) {
  const map = {
    'A+': 99, A: 96, 'A-': 92,
    'B+': 88, B: 84, 'B-': 80,
    'C+': 74, C: 68, 'C-': 62,
    'D+': 57, D: 52, 'D-': 47,
    F: 30,
  };
  const k = String(g || '').trim().toUpperCase();
  return map[k] ?? null;
}

/** Depth-first search for the first value whose key matches `re`. */
function findByKey(obj, re, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 5) return undefined;
  for (const k of Object.keys(obj)) {
    if (re.test(k) && (typeof obj[k] === 'string' || typeof obj[k] === 'number')) return obj[k];
  }
  for (const k of Object.keys(obj)) {
    const v = findByKey(obj[k], re, depth + 1);
    if (v !== undefined) return v;
  }
  return undefined;
}

// Blend of the sub-grades into the safety score, weighting violent crime most
// (staff safety). Weights are renormalized over whichever grades are present.
const CRIME_WEIGHTS = { violent: 0.6, property: 0.3, other: 0.1 };

/** Map a Zyla crime response to a 0–100 safety score (higher = safer). */
function parseSafety(data) {
  const gradeScore = (re) => {
    const v = findByKey(data, re);
    return v != null ? gradeToScore(v) : null;
  };
  const overallRaw = findByKey(data, /overall.*crime.*grade/i) ?? findByKey(data, /overall.*grade/i);
  const overallGrade = overallRaw != null ? String(overallRaw).trim().toUpperCase() : undefined;

  // Preferred: violent-weighted blend of the violent / property / other grades.
  const parts = [
    [gradeScore(/violent.*grade/i), CRIME_WEIGHTS.violent],
    [gradeScore(/property.*grade/i), CRIME_WEIGHTS.property],
    [gradeScore(/other.*grade/i), CRIME_WEIGHTS.other],
  ].filter(([s]) => s != null);
  if (parts.length) {
    const wsum = parts.reduce((a, [, w]) => a + w, 0);
    const score = Math.round(parts.reduce((a, [s, w]) => a + s * w, 0) / wsum);
    return {
      score: Math.max(0, Math.min(100, score)),
      grade: overallGrade,
      breakdown: {
        violent: gradeScore(/violent.*grade/i),
        property: gradeScore(/property.*grade/i),
        other: gradeScore(/other.*grade/i),
      },
    };
  }

  // Fallback: the single overall letter grade.
  const gs = overallGrade ? gradeToScore(overallGrade) : null;
  if (gs != null) return { score: gs, grade: overallGrade };

  // Last resort: a numeric overall score/index (assume higher = more crime).
  const raw = findByKey(data, /overall.*(score|index|rate)/i);
  const num = raw != null ? Number(String(raw).replace(/[^0-9.]/g, '')) : NaN;
  if (Number.isFinite(num) && num <= 100) {
    return { score: Math.max(0, Math.min(100, Math.round(100 - num))), index: num };
  }
  return { score: null, error: 'Could not read a crime score from the response.' };
}

async function reverseZip(lat, lng, gkey) {
  if (!gkey || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=postal_code&key=${gkey}`,
    );
    const j = await r.json();
    for (const res of j.results || []) {
      const pc = (res.address_components || []).find((c) => (c.types || []).includes('postal_code'));
      if (pc) return (pc.short_name || pc.long_name || '').slice(0, 5);
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchZyla(zip, key) {
  try {
    const r = await fetch(zylaUrl(zip), { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) return { score: null, error: `Crime API returned HTTP ${r.status}.` };
    const j = await r.json();
    return parseSafety(j);
  } catch {
    return { score: null, error: 'Crime API request failed.' };
  }
}

export default async function handler(req, res) {
  const key = resolveCrimeKey();

  // Debug: GET ?zip=01370&debug=1 → raw Zyla response, so the shape can be
  // confirmed from a browser. No key is exposed (crime data is public).
  if (req.method === 'GET' && req.query && req.query.debug) {
    if (!key) return res.status(500).json({ error: 'Missing CRIME_DATA env var (checked common names).' });
    const zip = String(req.query.zip || '01370').replace(/[^0-9]/g, '').slice(0, 5) || '01370';
    try {
      const r = await fetch(zylaUrl(zip), { headers: { Authorization: `Bearer ${key}` } });
      const text = await r.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 2000);
      }
      return res.status(200).json({ zip, status: r.status, parsed: parseSafety(body), body });
    } catch (e) {
      return res.status(502).json({ error: String(e && e.message ? e.message : e) });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  if (!key) {
    return res.status(500).json({
      error:
        'Missing crime API key. Add your Zyla key as CRIME_DATA in Vercel → Project → Settings → ' +
        'Environment Variables (Production), then Redeploy — new env vars only apply to deployments ' +
        'created after they are added.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const sites = (body && Array.isArray(body.sites) ? body.sites : []).slice(0, MAX_SITES);
  if (!sites.length) return res.status(400).json({ error: 'Provide sites: [{ id, lat, lng, zip? }].' });

  const gkey = process.env.GOOGLE_MAPS_API_KEY;
  const byZip = new Map(); // zip -> parsed result (cache duplicate ZIPs)
  const results = [];
  for (const s of sites) {
    let zip = s.zip ? String(s.zip).replace(/[^0-9]/g, '').slice(0, 5) : '';
    if (!/^\d{5}$/.test(zip)) zip = (await reverseZip(s.lat, s.lng, gkey)) || '';
    if (!/^\d{5}$/.test(zip)) {
      results.push({ id: s.id, zip: null, score: null, error: 'No ZIP for this site.' });
      continue;
    }
    let parsed = byZip.get(zip);
    if (!parsed) {
      parsed = await fetchZyla(zip, key);
      byZip.set(zip, parsed);
    }
    results.push({ id: s.id, zip, ...parsed });
  }

  return res.status(200).json({ results });
}
