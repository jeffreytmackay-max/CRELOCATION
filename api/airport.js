// Vercel serverless function — airport lookup by ICAO code via AirportDB.io.
//
// Fills a reference airport's official name, exact coordinates, IATA code and a
// little capability context (type, elevation, runway count / longest runway)
// from the free AirportDB API (OurAirports data). The token stays server-side;
// the browser only ever calls /api/airport.
//
// GET /api/airport?icao=KBOS
// Response: { ident, iata, name, lat, lng, type, elevationFt, municipality,
//             runwayCount, longestRunwayFt }
//
// Requires AIRPORTDB_API_TOKEN (free token from https://airportdb.io/).

export default async function handler(req, res) {
  const token = process.env.AIRPORTDB_API_TOKEN;
  if (!token) {
    return res.status(500).json({
      error:
        'Missing AIRPORTDB_API_TOKEN. Get a free token at https://airportdb.io/ and add it in ' +
        'Vercel → Project → Settings → Environment Variables, then redeploy.',
    });
  }

  const icao = String((req.query && req.query.icao) || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(icao)) {
    return res.status(400).json({ error: 'Provide a 3–4 character ICAO code (e.g. KBOS).' });
  }

  let data;
  try {
    const r = await fetch(`https://airportdb.io/api/v1/airport/${icao}?apiToken=${token}`);
    if (r.status === 404) return res.status(404).json({ error: `No airport found for ICAO ${icao}.` });
    if (!r.ok) {
      return res.status(502).json({
        error: `AirportDB error (HTTP ${r.status}) — check the ICAO code and that the token is valid.`,
      });
    }
    data = await r.json();
  } catch {
    return res.status(502).json({ error: 'AirportDB request failed.' });
  }

  const lat = Number(data.latitude_deg);
  const lng = Number(data.longitude_deg);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(502).json({ error: 'AirportDB returned no coordinates for that code.' });
  }

  const runways = Array.isArray(data.runways) ? data.runways : [];
  const lengths = runways
    .filter((rw) => rw && Number(rw.closed) !== 1)
    .map((rw) => Number(rw.length_ft))
    .filter((n) => Number.isFinite(n) && n > 0);

  return res.status(200).json({
    ident: data.ident || icao,
    iata: data.iata_code || '',
    name: data.name || '',
    lat,
    lng,
    type: data.type || '',
    elevationFt: data.elevation_ft != null && data.elevation_ft !== '' ? Number(data.elevation_ft) : null,
    municipality: data.municipality || '',
    runwayCount: runways.length,
    longestRunwayFt: lengths.length ? Math.max(...lengths) : null,
  });
}
