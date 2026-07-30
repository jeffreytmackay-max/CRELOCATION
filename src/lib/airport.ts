/** Client for the /api/airport serverless proxy (AirportDB.io lookup by ICAO). */

export interface AirportInfo {
  ident: string; // ICAO
  iata: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  elevationFt: number | null;
  municipality: string;
  runwayCount: number;
  longestRunwayFt: number | null;
}

/** Look up an airport by ICAO code. Throws with a readable message on failure. */
export async function lookupAirport(icao: string): Promise<AirportInfo> {
  const res = await fetch(`/api/airport?icao=${encodeURIComponent(icao.trim())}`);
  let data: AirportInfo & { error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Lookup failed (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Lookup failed (HTTP ${res.status}).`);
  return data;
}
