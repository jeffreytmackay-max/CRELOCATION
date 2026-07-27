/** Client for the /api/crime serverless proxy (FBI Crime Data Explorer). */

export interface CrimeResult {
  id: string;
  agency: string;
  /** Combined violent + property crime rate per 100k, or null if unavailable. */
  rate: number | null;
  year: number | null;
}

/**
 * Map a combined violent+property crime rate (per 100k) to a 0–100 safety score
 * — lower crime is a higher score. US combined rates run ~1,000 (very safe) to
 * ~6,000+ (high); heuristic, tune as needed. Clamped to [5, 100].
 */
export function crimeRateToScore(rate: number): number {
  return Math.max(5, Math.min(100, Math.round(100 - rate / 70)));
}

export async function fetchCrimeRates(
  state: string,
  sites: { id: string; lat: number; lng: number }[],
): Promise<CrimeResult[]> {
  const res = await fetch('/api/crime', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state, sites }),
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
