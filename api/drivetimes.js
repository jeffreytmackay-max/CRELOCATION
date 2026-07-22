// Vercel serverless function — traffic-aware drive times.
//
// Proxies Google Distance Matrix so the API key stays server-side. The browser
// never sees GOOGLE_MAPS_API_KEY.
//
// POST body: {
//   origins:      [{ lat, lng }, ...],   // 1–25
//   destinations: [{ lat, lng }, ...],   // 1–25  (origins × destinations ≤ 100)
//   departureTime: "now" | <unix seconds>  // enables traffic-aware durations
// }
// Response: { durations: (number|null)[][], departureTime }
//   durations[i][j] = minutes from origins[i] to destinations[j], traffic-aware
//   when Google returns duration_in_traffic; null when a leg can't be routed.

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
        'Environment Variables (all environments), then redeploy.',
    });
  }

  // Vercel usually parses JSON bodies, but be defensive.
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }

  const origins = body && body.origins;
  const destinations = body && body.destinations;
  const departureTime = (body && body.departureTime) || 'now';

  const valid = (p) =>
    p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));
  if (
    !Array.isArray(origins) ||
    !Array.isArray(destinations) ||
    !origins.length ||
    !destinations.length ||
    !origins.every(valid) ||
    !destinations.every(valid)
  ) {
    return res.status(400).json({
      error: 'origins and destinations must be non-empty arrays of { lat, lng }.',
    });
  }
  // Google limits: ≤25 per side, ≤100 elements per request.
  if (origins.length > 25 || destinations.length > 25 || origins.length * destinations.length > 100) {
    return res.status(400).json({
      error: 'Too many points — max 25 per side and 100 origin×destination pairs per request.',
    });
  }

  const fmt = (p) => `${Number(p.lat)},${Number(p.lng)}`;
  const params = new URLSearchParams({
    origins: origins.map(fmt).join('|'),
    destinations: destinations.map(fmt).join('|'),
    mode: 'driving',
    departure_time: String(departureTime), // "now" or a future unix-seconds timestamp
    traffic_model: 'best_guess',
    key,
  });

  let data;
  try {
    const r = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
    );
    data = await r.json();
  } catch {
    return res.status(502).json({ error: 'Could not reach the Google Distance Matrix API.' });
  }

  if (data.status !== 'OK') {
    return res.status(502).json({
      error:
        `Google Distance Matrix error: ${data.status}` +
        (data.error_message ? ` — ${data.error_message}` : ''),
    });
  }

  const durations = (data.rows || []).map((row) =>
    (row.elements || []).map((el) => {
      if (!el || el.status !== 'OK') return null;
      const secs =
        (el.duration_in_traffic && el.duration_in_traffic.value) ||
        (el.duration && el.duration.value);
      return secs != null ? Math.round(secs / 60) : null;
    }),
  );

  return res.status(200).json({ durations, departureTime });
}
