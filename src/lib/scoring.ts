import { FACTORS, activeFactorKeys } from '../data/factors';
import type { City, FactorKey, ScoredSite, Scores, Site } from '../types';

/** Score used when a site is missing a factor (e.g. a factor added after it was saved). */
export const NEUTRAL_SCORE = 70;

/** A factor's raw score, defaulting missing factors to a neutral value. */
export function scoreOf(scores: Scores, key: FactorKey): number {
  return scores[key] ?? NEUTRAL_SCORE;
}

/** True when every active factor is still at the neutral default (site not yet scored). */
export function isUnscored(scores: Scores, includeSpace = true): boolean {
  return activeFactorKeys(includeSpace).every((k) => scoreOf(scores, k) === NEUTRAL_SCORE);
}

/**
 * Map a drive time (minutes) to a 0–100 access score — closer is better.
 * ~10 min ≈ 90, 30 min ≈ 70, 60 min ≈ 40; clamped to [10, 100].
 */
export function minutesToScore(mins: number): number {
  return Math.max(10, Math.min(100, Math.round(100 - mins)));
}

/**
 * Weights normalized so the active factors sum to 1. Inactive factors (the
 * real-estate factor when its toggle is off) get weight 0 so they never affect
 * the composite. Falls back to an even split across the active factors.
 */
export function normalize(weights: Scores, includeSpace = true): Record<FactorKey, number> {
  const keys = activeFactorKeys(includeSpace);
  const total = keys.reduce((a, k) => a + (weights[k] ?? 0), 0);
  const n = {} as Record<FactorKey, number>;
  FACTORS.forEach((f) => (n[f.key] = 0));
  keys.forEach((k) => {
    n[k] = total > 0 ? (weights[k] ?? 0) / total : 1 / keys.length;
  });
  return n;
}

/** Composite = Σ(rawScore × normalizedWeight). Inactive factors carry weight 0. */
export function composite(scores: Scores, normWeights: Record<FactorKey, number>): number {
  return FACTORS.reduce((a, f) => a + scoreOf(scores, f.key) * normWeights[f.key], 0);
}

/**
 * Score and rank a city's candidate sites. When the office is enabled it is
 * injected as a pseudo-site ("__office", isOffice) and ranked alongside.
 */
export function scoreCity(city: City, weights: Scores, includeSpace = true): ScoredSite[] {
  const n = normalize(weights, includeSpace);
  const list: Site[] = city.sites.slice();
  if (city.office.on) {
    list.push({
      id: '__office',
      name: 'Your office',
      short: 'Your office',
      lat: city.office.lat,
      lng: city.office.lng,
      scores: city.office.scores,
      note: city.office.note,
      facts: city.office.facts,
    });
  }
  const arr: ScoredSite[] = list
    .map((s) => {
      const raw = composite(s.scores, n);
      return {
        ...s,
        composite: Math.round(raw),
        raw,
        rank: 0,
        isOffice: s.id === '__office',
      };
    })
    .sort((a, b) => b.raw - a.raw);
  arr.forEach((s, i) => (s.rank = i + 1));
  return arr;
}

/** Threshold color scale used for pins, bars and score numerals. */
export function scoreColor(s: number): string {
  return s >= 80 ? '#9d2235' : s >= 72 ? '#ff7f41' : s >= 64 ? '#ffae81' : '#8a8790';
}
