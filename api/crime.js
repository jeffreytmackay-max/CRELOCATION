// Vercel serverless function — city/agency-level crime rate from the FBI CDE.
//
// FBI Uniform Crime Reporting data is jurisdiction-level (police agency), not
// point-level. For each site we find the nearest reporting agency in the state
// and return its latest violent + property crime rate per 100k. The client maps
// that rate to the 0–100 "Crime & safety" score.
//
// POST body: { state: "TX", sites: [{ id, lat, lng }] }
// Response:  { results: [{ id, agency, rate, year }] }   // rate = per-100k, or null
//
// Requires FBI_CRIME_API_KEY (free key from https://api.data.gov/signup/).

const BASE = 'https://api.usa.gov/crime/fbi/sapi/api';
const MAX_AGENCIES = 20; // cap live sub-requests per invocation

function distKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FBI API ${r.status}`);
  return r.json();
}

// Latest year's { actual, population, rate } for one offense category at an agency.
async function offense(ori, slug, key) {
  const url = `${BASE}/summarized/agencies/${encodeURIComponent(ori)}/${slug}?API_KEY=${key}&api_key=${key}`;
  let data;
  try {
    data = await getJson(url);
  } catch {
    return null;
  }
  const arr = Array.isArray(data) ? data : data.results || [];
  if (!arr.length) return null;
  arr.sort((a, b) => (b.data_year || b.year || 0) - (a.data_year || a.year || 0));
  const top = arr.find((x) => x.actual != null || x.rate != null) || arr[0];
  return {
    year: top.data_year || top.year || null,
    actual: Number(top.actual) || 0,
    population: Number(top.population) || 0,
    rate: top.rate != null ? Number(top.rate) : null,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  const key = process.env.FBI_CRIME_API_KEY;
  if (!key) {
    return res.status(500).json({
      error:
        'Missing FBI_CRIME_API_KEY. Get a free key at https://api.data.gov/signup/ and add it ' +
        'in Vercel → Project → Settings → Environment Variables, then redeploy.',
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
  const state = body && typeof body.state === 'string' ? body.state.trim().toUpperCase() : '';
  const sites = (body && body.sites) || [];
  if (!/^[A-Z]{2}$/.test(state)) {
    return res.status(400).json({ error: 'Provide a 2-letter state (the city’s state).' });
  }
  if (!Array.isArray(sites) || !sites.length) {
    return res.status(400).json({ error: 'Provide sites: [{ id, lat, lng }].' });
  }

  // 1) Agencies in the state (with coordinates).
  let agencies;
  try {
    const data = await getJson(`${BASE}/agencies/byStateAbbr/${state}?API_KEY=${key}&api_key=${key}`);
    const list = Array.isArray(data) ? data : data.results || [];
    agencies = list
      .map((a) => ({
        ori: a.ori,
        name: a.agency_name || a.name || a.ori,
        lat: Number(a.latitude ?? a.lat),
        lng: Number(a.longitude ?? a.lng),
      }))
      .filter((a) => a.ori && Number.isFinite(a.lat) && Number.isFinite(a.lng));
  } catch (e) {
    return res.status(502).json({ error: `Could not load FBI agencies for ${state} (${e.message}).` });
  }
  if (!agencies.length) {
    return res.status(502).json({ error: `No geolocated FBI agencies found for ${state}.` });
  }

  // 2) Nearest agency per site.
  const nearestFor = (s) => {
    let best = null;
    let bestD = Infinity;
    for (const a of agencies) {
      const d = distKm(a, { lat: Number(s.lat), lng: Number(s.lng) });
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    return best;
  };
  const siteAgency = sites
    .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
    .map((s) => ({ site: s, agency: nearestFor(s) }));

  // 3) Crime rate per unique agency (capped).
  const oris = [...new Set(siteAgency.map((x) => x.agency.ori))].slice(0, MAX_AGENCIES);
  const byOri = {};
  await Promise.all(
    oris.map(async (ori) => {
      const [v, p] = await Promise.all([
        offense(ori, 'violent-crime', key),
        offense(ori, 'property-crime', key),
      ]);
      let rate = null;
      if (v?.rate != null || p?.rate != null) {
        rate = (v?.rate || 0) + (p?.rate || 0);
      } else {
        const pop = v?.population || p?.population || 0;
        if (pop > 0) rate = (((v?.actual || 0) + (p?.actual || 0)) / pop) * 100000;
      }
      byOri[ori] = { rate: rate != null ? Math.round(rate) : null, year: v?.year || p?.year || null };
    }),
  );

  const results = siteAgency.map(({ site, agency }) => ({
    id: site.id,
    agency: agency.name,
    rate: byOri[agency.ori]?.rate ?? null,
    year: byOri[agency.ori]?.year ?? null,
  }));

  return res.status(200).json({ results });
}
