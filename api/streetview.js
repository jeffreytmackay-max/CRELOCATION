// Vercel serverless function — a location image for a candidate site.
//
// Returns a Google **Street View Static** photo for the point when imagery
// exists, otherwise falls back to a **Maps Static** road/aerial image. The
// Google key stays server-side; the browser only ever loads /api/streetview.
//
// GET /api/streetview?lat=..&lng=..&kind=street|map&size=640x360
// Response: image bytes (image/jpeg or image/png), or an inline SVG placeholder
// with guidance when the key/APIs aren't configured.
//
// Enable the "Street View Static API" and "Maps Static API" on the key.

const MAX_W = 800;
const MAX_H = 600;

/** An inline SVG shown in the <img> slot when we can't fetch a real image. */
function placeholder(res, message) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="320" viewBox="0 0 640 320">
  <rect width="640" height="320" fill="#f2efee"/>
  <g fill="#b7b1af" transform="translate(296,120)">
    <path d="M24 4a20 20 0 1 0 0.001 0zM24 12a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 34c-6 0-11.3-3-14.3-7.6C9.9 34.9 18 33 24 33s14.1 1.9 14.3 5.4C35.3 43 30 46 24 46z"/>
  </g>
  <text x="320" y="210" text-anchor="middle" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-size="15" fill="#6b6663">${message}</text>
</svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(svg);
}

/** Clamp the requested size to something Google (and our layout) accepts. */
function parseSize(raw) {
  const m = /^(\d{2,4})x(\d{2,4})$/.exec(String(raw || ''));
  let w = m ? Number(m[1]) : 640;
  let h = m ? Number(m[2]) : 360;
  w = Math.min(MAX_W, Math.max(120, w));
  h = Math.min(MAX_H, Math.max(120, h));
  return `${w}x${h}`;
}

async function streamImage(res, url, kind) {
  const r = await fetch(url);
  const type = r.headers.get('content-type') || '';
  if (!r.ok || !type.startsWith('image')) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  res.setHeader('Content-Type', type);
  res.setHeader('X-Image-Kind', kind);
  // Location imagery is effectively static — cache hard at the edge.
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.status(200).send(buf);
  return true;
}

export default async function handler(req, res) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return placeholder(res, 'Set GOOGLE_MAPS_API_KEY to show a location image');

  const q = req.query || {};
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return placeholder(res, 'No coordinates for this location');
  }
  const size = parseSize(q.size);
  const loc = `${lat},${lng}`;
  const wantMap = q.kind === 'map';

  // 1) Street View — check metadata first so we never return the grey
  //    "no imagery" tile. Skip when the caller explicitly asked for the map.
  if (!wantMap) {
    try {
      const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${loc}&key=${key}`;
      const meta = await fetch(metaUrl).then((r) => r.json());
      if (meta && meta.status === 'OK') {
        const svUrl = `https://maps.googleapis.com/maps/api/streetview?size=${size}&location=${loc}&fov=80&source=outdoor&key=${key}`;
        if (await streamImage(res, svUrl, 'street')) return;
      }
    } catch {
      /* fall through to the static map */
    }
  }

  // 2) Static map fallback (road map with a marker on the point).
  const mapUrl =
    `https://maps.googleapis.com/maps/api/staticmap?center=${loc}&zoom=16&size=${size}` +
    `&scale=2&maptype=roadmap&markers=color:0x9d2235%7C${loc}&key=${key}`;
  if (await streamImage(res, mapUrl, 'map')) return;

  return placeholder(res, 'Enable Street View Static API and Maps Static API on your key');
}
