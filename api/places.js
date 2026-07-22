// Vercel serverless function — discover nearby reference points.
//
// Proxies Google Places so the API key stays server-side. Finds transplant
// centers / hospitals or airports around a metro center.
//
// POST body: { kind: "transplant" | "airport", lat, lng, radius? }  // radius m
// Response: { places: [{ name, address, lat, lng, code }], kind }
//
// Requires the "Places API" enabled on GOOGLE_MAPS_API_KEY.

const MAX_RESULTS = 8;
const DEFAULT_RADIUS = 50000; // 50 km
const MAX_RADIUS = 80000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return res.status(500).json({
      error:
        'Missing GOOGLE_MAPS_API_KEY. Add it in Vercel → Project → Settings → ' +
        'Environment Variables, then redeploy.',
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

  const kind = body && body.kind;
  const lat = Number(body && body.lat);
  const lng = Number(body && body.lng);
  const radius = Math.min(Number(body && body.radius) || DEFAULT_RADIUS, MAX_RADIUS);

  if ((kind !== 'transplant' && kind !== 'airport') || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({
      error: 'Provide kind ("transplant" | "airport") and numeric lat / lng.',
    });
  }

  let url;
  if (kind === 'airport') {
    const p = new URLSearchParams({
      location: `${lat},${lng}`,
      radius: String(radius),
      type: 'airport',
      key,
    });
    url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${p.toString()}`;
  } else {
    // Text search is better for a themed query like "transplant center".
    const p = new URLSearchParams({
      query: 'transplant center hospital',
      location: `${lat},${lng}`,
      radius: String(radius),
      key,
    });
    url = `https://maps.googleapis.com/maps/api/place/textsearch/json?${p.toString()}`;
  }

  let data;
  try {
    const r = await fetch(url);
    data = await r.json();
  } catch {
    return res.status(502).json({ error: 'Could not reach the Google Places API.' });
  }

  // ZERO_RESULTS is a valid, empty outcome.
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return res.status(502).json({
      error:
        `Google Places error: ${data.status}` +
        (data.error_message ? ` — ${data.error_message}` : ''),
    });
  }

  const codeFrom = (name) => {
    const m = /\(([A-Z]{3})\)/.exec(name || '');
    return m ? m[1] : '';
  };

  const places = (data.results || [])
    .filter((r) => r.business_status !== 'CLOSED_PERMANENTLY' && r.geometry && r.geometry.location)
    .filter((r) => (kind === 'airport' ? (r.types || []).includes('airport') : true))
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      name: r.name || '',
      address: r.formatted_address || r.vicinity || '',
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      code: kind === 'airport' ? codeFrom(r.name) : '',
    }));

  return res.status(200).json({ places, kind });
}
