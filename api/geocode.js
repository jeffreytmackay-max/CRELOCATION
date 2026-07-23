// Vercel serverless function — geocode an address or place name.
//
// Proxies Google Geocoding so the API key stays server-side. Used by
// search-to-add: type a city / suburb / address to drop a candidate site.
//
// POST body: { query: string }
// Response: { results: [{ name, lat, lng }] }  // top matches
//
// Requires the "Geocoding API" enabled on GOOGLE_MAPS_API_KEY.

const MAX_RESULTS = 5;

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

  const query = body && typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return res.status(400).json({ error: 'Provide a non-empty "query".' });
  }

  const params = new URLSearchParams({ address: query, key });
  let data;
  try {
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    data = await r.json();
  } catch {
    return res.status(502).json({ error: 'Could not reach the Google Geocoding API.' });
  }

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    return res.status(502).json({
      error:
        `Google Geocoding error: ${data.status}` +
        (data.error_message ? ` — ${data.error_message}` : ''),
    });
  }

  const results = (data.results || [])
    .filter((r) => r.geometry && r.geometry.location)
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      name: r.formatted_address || query,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    }));

  return res.status(200).json({ results });
}
