// Vercel serverless function — city/agency-level crime rate from the FBI CDE.
//
// FBI Uniform Crime Reporting data is jurisdiction-level (police agency), not
// point-level. For each site we find the nearest reporting agency in the state
// and return its latest violent + property crime rate per 100k. The client maps
// that rate to the 0–100 "Crime & safety" score.
//
// The FBI has two API generations on api.usa.gov: the newer "cde" base and the
// older "sapi" base (paths differ). We try cde first, then fall back to sapi,
// and parse either response shape.
//
// POST body: { state: "TX", sites: [{ id, lat, lng }] }
// Response:  { results: [{ id, agency, rate, year }] }   // rate = per-100k, or null
//
// Requires FBI_CRIME_API_KEY (free key from https://api.data.gov/signup/).

const MAX_AGENCIES = 20;

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

/** Fetch the first URL that returns 200 JSON; returns null if all fail. */
async function firstJson(urls) {
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {
      /* try next */
    }
  }
  return null;
}

/** From a { key: { year: value } } object, the most-recent year's value summed across keys. */
function latestNested(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const byYear = {};
  for (const k of Object.keys(obj)) {
    const yv = obj[k];
    if (yv && typeof yv === 'object') {
      for (const y of Object.keys(yv)) {
        const n = Number(yv[y]);
        if (Number.isFinite(n)) byYear[y] = (byYear[y] || 0) + n;
      }
    }
  }
  const years = Object.keys(byYear)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a);
  if (!years.length) return null;
  return { year: years[0], value: byYear[String(years[0])] };
}

/** Latest { rate, actual, population, year } for one offense at an agency (either API shape). */
async function offense(ori, slug, key) {
  const data = await firstJson([
    `https://api.usa.gov/crime/fbi/cde/summarized/agency/${encodeURIComponent(ori)}/${slug}?from=2018&to=2024&API_KEY=${key}`,
    `https://api.usa.gov/crime/fbi/sapi/api/summarized/agencies/${encodeURIComponent(ori)}/${slug}?API_KEY=${key}&api_key=${key}`,
  ]);
  if (!data) return null;

  // sapi shape: array of yearly rows.
  const arr = Array.isArray(data) ? data : Array.isArray(data.results) ? data.results : null;
  if (arr && arr.length) {
    arr.sort((a, b) => (b.data_year || b.year || 0) - (a.data_year || a.year || 0));
    const top = arr.find((x) => x.actual != null || x.rate != null) || arr[0];
    return {
      year: top.data_year || top.year || null,
      actual: Number(top.actual) || 0,
      population: Number(top.population) || 0,
      rate: top.rate != null ? Number(top.rate) : null,
    };
  }

  // cde shape: { offenses: { rates, actuals }, populations: {...} }.
  const rates = latestNested(data.offenses && data.offenses.rates);
  if (rates) return { year: rates.year, rate: rates.value, actual: 0, population: 0 };
  const actuals = latestNested(data.offenses && data.offenses.actuals);
  const pop = latestNested(data.populations) || latestNested(data.population);
  if (actuals && pop && pop.value > 0) {
    return { year: actuals.year, actual: actuals.value, population: pop.value, rate: null };
  }
  return null;
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

  // 1) Agencies in the state (with coordinates) — cde first, then sapi.
  const agData = await firstJson([
    `https://api.usa.gov/crime/fbi/cde/agency/byStateAbbr/${state}?API_KEY=${key}`,
    `https://api.usa.gov/crime/fbi/sapi/api/agencies/byStateAbbr/${state}?API_KEY=${key}&api_key=${key}`,
  ]);
  if (!agData) {
    return res.status(502).json({
      error: `FBI agency lookup failed for ${state} (check the API key is enabled at api.data.gov).`,
    });
  }
  const rawList = Array.isArray(agData)
    ? agData
    : Array.isArray(agData.results)
      ? agData.results
      : typeof agData === 'object'
        ? Object.values(agData)
        : [];
  const agencies = rawList
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      ori: a.ori,
      name: a.agency_name || a.name || a.ori,
      lat: Number(a.latitude ?? a.lat),
      lng: Number(a.longitude ?? a.lng ?? a.longtitude),
    }))
    .filter((a) => a.ori && Number.isFinite(a.lat) && Number.isFinite(a.lng));
  if (!agencies.length) {
    return res.status(502).json({ error: `No geolocated FBI agencies found for ${state}.` });
  }

  // 2) Nearest agency per site.
  const siteAgency = sites
    .filter((s) => Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng)))
    .map((s) => {
      let best = null;
      let bestD = Infinity;
      for (const a of agencies) {
        const d = distKm(a, { lat: Number(s.lat), lng: Number(s.lng) });
        if (d < bestD) {
          bestD = d;
          best = a;
        }
      }
      return { site: s, agency: best };
    });

  // 3) Violent + property rate per unique agency (capped).
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
