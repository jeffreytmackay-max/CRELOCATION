/** Client for the /api/crime serverless proxy (Zyla "Crime Data by Zipcode"). */

export interface CrimeResult {
  id: string;
  zip: string | null;
  /** 0–100 safety score (higher = safer), or null when unavailable. */
  score: number | null;
  grade?: string;
  error?: string;
}

/**
 * Fetch a 0–100 safety score per candidate site. The server resolves each
 * site's ZIP (reverse-geocode when needed), queries the crime API and maps the
 * result to a safety score. Throws only on a total/transport failure.
 */
export async function fetchCrimeScores(
  sites: { id: string; lat: number; lng: number; zip?: string }[],
): Promise<CrimeResult[]> {
  const res = await fetch('/api/crime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sites }),
  });
  let data: { results?: CrimeResult[]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Crime lookup failed (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Crime lookup failed (HTTP ${res.status}).`);
  return data.results ?? [];
}
