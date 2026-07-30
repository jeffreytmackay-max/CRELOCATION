// Vercel serverless function — find airports near a point from the bundled
// OurAirports dataset (no external API, no token). Replaces Google Places for
// airport discovery: results carry real ICAO/IATA codes, name, type and coords.
//
// GET /api/nearby-airports?lat=..&lng=..&radius=150&limit=12
// Response: { results: [{ icao, iata, name, type, lat, lng, city, region,
//                         country, elev, svc, distanceKm }] }

import { createRequire } from 'node:module';

// require() bundles the JSON with the function (Vercel traces required files).
const require = createRequire(import.meta.url);
const AIRPORTS = require('./_airports.json');

function distKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export default function handler(req, res) {
  const q = req.query || {};
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Provide numeric lat & lng.' });
  }
  const radius = Math.min(600, Math.max(10, Number(q.radius) || 150));
  const limit = Math.min(50, Math.max(1, Number(q.limit) || 12));

  const hits = [];
  for (const a of AIRPORTS) {
    const d = distKm(lat, lng, a.lat, a.lng);
    if (d <= radius) hits.push({ ...a, distanceKm: Math.round(d) });
  }
  // Nearest first; break ties by size (large before medium).
  hits.sort((x, y) => x.distanceKm - y.distanceKm || (y.type === 'L' ? 1 : 0) - (x.type === 'L' ? 1 : 0));

  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).json({ results: hits.slice(0, limit) });
}
