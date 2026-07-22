import { FACTORS } from '../data/factors';
import type { City, ScoredSite, Scores, Site } from '../types';

/** Weights normalized so they sum to 1. Falls back to an even split. */
export function normalize(weights: Scores): Scores {
  const total = FACTORS.reduce((a, f) => a + (weights[f.key] || 0), 0);
  const n = {} as Scores;
  FACTORS.forEach((f) => {
    n[f.key] = total > 0 ? (weights[f.key] || 0) / total : 1 / FACTORS.length;
  });
  return n;
}

/** Composite = Σ(rawScore × normalizedWeight). */
export function composite(scores: Scores, normWeights: Scores): number {
  return FACTORS.reduce((a, f) => a + (scores[f.key] || 0) * normWeights[f.key], 0);
}

/**
 * Score and rank a city's candidate sites. When the office is enabled it is
 * injected as a pseudo-site ("__office", isOffice) and ranked alongside.
 */
export function scoreCity(city: City, weights: Scores): ScoredSite[] {
  const n = normalize(weights);
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
