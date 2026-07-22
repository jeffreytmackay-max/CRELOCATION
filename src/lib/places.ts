/** Client for the /api/places serverless proxy (Google Places discovery). */

export type PlaceKind = 'transplant' | 'airport';

export interface DiscoveredPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  code: string;
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
