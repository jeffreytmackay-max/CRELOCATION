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
  const params = [`size=${size}`, 'scale=2', 'maptype=roadmap'];
  let count = 0;

  for (const [k, msize, color] of MARKERS) {
    const raw = k === 'office' || k === 'aviation' ? (finite(body[k]) ? [body[k]] : []) : body[k];
    const list = (Array.isArray(raw) ? raw : []).filter(finite).slice(0, 30);
    if (!list.length) continue;
    count += list.length;
    const style = `size:${msize}|color:0x${color}`;
    params.push(`markers=${encodeURIComponent(`${style}|${list.map(pt).join('|')}`)}`);
  }

  if (!count) return res.status(400).json({ error: 'No map markers provided.' });

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
