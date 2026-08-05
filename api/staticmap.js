// Vercel serverless function — a static overview map with all of a city's
// markers, for embedding in the PowerPoint export. Uses the Google Maps Static
// API; the key stays server-side (the browser only calls /api/staticmap).
//
// POST { sites:[{lat,lng}], centers:[...], airports:[...], staff:[...],
//        office:{lat,lng}?, aviation:{lat,lng}?, size?:"640x400" }
// Response: image/png (auto-fit to the markers), or 500 JSON when no key.

const MARKERS = [
  ['sites', 'mid', 'D62828'],
  ['centers', 'small', '9D2235'],
  ['airports', 'small', '44546A'],
  ['aviation', 'small', '0E7490'],
  ['office', 'small', '302F32'],
  ['staff', 'tiny', '1F8F5F'],
];

const pt = (p) => `${Number(p.lat).toFixed(5)},${Number(p.lng).toFixed(5)}`;
const finite = (p) => p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

/**
 * Compute a { lat, lng, zoom } that frames the given points within a mapW×mapH
 * viewport (Web Mercator), with padding. Returns null for no points.
 */
function computeView(points, mapW, mapH) {
  if (!points.length) return null;
  let n = -90, s = 90, e = -180, w = 180;
  for (const p of points) {
    n = Math.max(n, p.lat);
    s = Math.min(s, p.lat);
    e = Math.max(e, p.lng);
    w = Math.min(w, p.lng);
  }
  const center = { lat: (n + s) / 2, lng: (e + w) / 2 };
  const latRad = (lat) => {
    const sn = Math.sin((lat * Math.PI) / 180);
    const r = Math.log((1 + sn) / (1 - sn)) / 2;
    return Math.max(Math.min(r, Math.PI), -Math.PI) / 2;
  };
  const zoomFor = (px, frac) => Math.log(px / 256 / frac) / Math.LN2;
  const EPS = 1e-6;
  const latFrac = (latRad(n) - latRad(s)) / Math.PI;
  let lngDiff = e - w;
  if (lngDiff < 0) lngDiff += 360;
  const lngFrac = lngDiff / 360;
  const latZoom = latFrac > EPS ? zoomFor(mapH, latFrac) : 16;
  const lngZoom = lngFrac > EPS ? zoomFor(mapW, lngFrac) : 16;
  // Floor already zooms out enough to fit the bounds (with inherent margin);
  // clamp wide enough for cross-country spreads, tight enough for one point.
  const zoom = Math.max(3, Math.min(16, Math.floor(Math.min(latZoom, lngZoom))));
  return { lat: Number(center.lat.toFixed(5)), lng: Number(center.lng.toFixed(5)), zoom };
}

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return res.status(500).json({ error: 'Missing GOOGLE_MAPS_API_KEY.' });

  // Debug: GET /api/staticmap?debug=1 → reports whether the Maps Static API
  // works and, on failure, Google's exact error text. No key is exposed.
  if (req.method === 'GET' && req.query && req.query.debug) {
    const lat = req.query.lat || '42.3601';
    const lng = req.query.lng || '-71.0589';
    const url = `https://maps.googleapis.com/maps/api/staticmap?size=400x300&markers=color:0x9D2235%7C${lat},${lng}&key=${key}`;
    try {
      const r = await fetch(url);
      const type = r.headers.get('content-type') || '';
      if (type.startsWith('image')) {
        return res.status(200).json({ ok: true, status: r.status, contentType: type, note: 'Maps Static API is working.' });
      }
      const text = await r.text();
      return res.status(200).json({ ok: false, status: r.status, contentType: type, googleError: text.slice(0, 600) });
    } catch (e) {
      return res.status(200).json({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  body = body || {};

  const size = /^\d{2,4}x\d{2,4}$/.test(String(body.size || '')) ? String(body.size) : '640x400';
  const [mapW, mapH] = size.split('x').map(Number);
  const params = [`size=${size}`, 'scale=2', 'maptype=roadmap'];
  let count = 0;

  const groups = {};
  for (const [k, msize, color] of MARKERS) {
    const raw = k === 'office' || k === 'aviation' ? (finite(body[k]) ? [body[k]] : []) : body[k];
    const list = (Array.isArray(raw) ? raw : []).filter(finite).slice(0, 30);
    groups[k] = list;
    if (!list.length) continue;
    count += list.length;
    const style = `size:${msize}|color:0x${color}`;
    params.push(`markers=${encodeURIComponent(`${style}|${list.map(pt).join('|')}`)}`);
  }

  if (!count) return res.status(400).json({ error: 'No map markers provided.' });

  // Frame tightly on ALL markers (including staff) so every point is shown.
  const focus = [
    ...groups.sites, ...groups.centers, ...groups.airports,
    ...groups.office, ...groups.aviation, ...groups.staff,
  ].map((p) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
  const view = computeView(focus, mapW || 640, mapH || 400);
  if (view) params.push(`center=${view.lat},${view.lng}`, `zoom=${view.zoom}`);

  const url = `https://maps.googleapis.com/maps/api/staticmap?${params.join('&')}&key=${key}`;
  try {
    const r = await fetch(url);
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !type.startsWith('image')) {
      return res.status(502).json({ error: `Static map error (HTTP ${r.status}). Enable the Maps Static API.` });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return res.status(200).send(buf);
  } catch {
    return res.status(502).json({ error: 'Static map request failed.' });
  }
}
