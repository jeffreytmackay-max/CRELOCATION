/** Client for the /api/places serverless proxy (Google Places discovery). */

export type PlaceKind = 'transplant' | 'airport';

export interface DiscoveredPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  code: string;
  /** ICAO code (airports only, from the OurAirports dataset). */
  icao?: string;
}

/**
 * Discover nearby airports from the bundled OurAirports dataset (no Google, no
 * token). Returns them in DiscoveredPlace form with real ICAO/IATA codes.
 */
export async function nearbyAirports(
  lat: number,
  lng: number,
  radius?: number,
): Promise<DiscoveredPlace[]> {
  const res = await fetch(
    `/api/nearby-airports?lat=${lat}&lng=${lng}${radius ? `&radius=${radius}` : ''}`,
  );
  let data: { results?: Array<Record<string, unknown>>; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Airport search failed (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Airport search failed (HTTP ${res.status}).`);
  return (data.results ?? []).map((a) => ({
    name: String(a.name ?? ''),
    address: [a.city, a.region].filter(Boolean).join(', '),
    lat: Number(a.lat),
    lng: Number(a.lng),
    code: String(a.iata || a.icao || ''),
    icao: String(a.icao || ''),
  }));
}

/**
 * Discover nearby reference points around a metro center. Throws with the
 * server's message on failure.
 */
export async function findNearby(
  kind: PlaceKind,
  lat: number,
  lng: number,
  radius?: number,
): Promise<DiscoveredPlace[]> {
  const res = await fetch('/api/places', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, lat, lng, radius }),
  });
  let data: { places?: DiscoveredPlace[]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Discovery failed (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Discovery failed (HTTP ${res.status}).`);
  return data.places ?? [];
}
