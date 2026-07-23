/** Client for the /api/geocode serverless proxy (Google Geocoding). */

export interface GeocodeResult {
  name: string;
  lat: number;
  lng: number;
}

/** Geocode an address / place name into candidate matches. Throws on failure. */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  const res = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  let data: { results?: GeocodeResult[]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Search failed (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Search failed (HTTP ${res.status}).`);
  return data.results ?? [];
}
