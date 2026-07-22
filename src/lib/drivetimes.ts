/** Client for the /api/drivetimes serverless proxy (Google Distance Matrix). */

export interface LatLng {
  lat: number;
  lng: number;
}

export type DepartureChoice = 'now' | 'weekday-8' | 'weekday-12' | 'weekday-17';

export const DEPARTURE_OPTIONS: { value: DepartureChoice; label: string }[] = [
  { value: 'now', label: 'Leaving now' },
  { value: 'weekday-8', label: 'Weekday 8:00 AM' },
  { value: 'weekday-12', label: 'Weekday 12:00 PM' },
  { value: 'weekday-17', label: 'Weekday 5:00 PM' },
];

/**
 * Google `departure_time` for a scenario: 'now', or the next weekday (Mon–Fri)
 * at the chosen hour, strictly in the future (Google rejects past times).
 */
export function departureTimestamp(choice: DepartureChoice): number | 'now' {
  if (choice === 'now') return 'now';
  const hour = choice === 'weekday-8' ? 8 : choice === 'weekday-12' ? 12 : 17;
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  const isWeekend = () => d.getDay() === 0 || d.getDay() === 6;
  while (d.getTime() <= Date.now() || isWeekend()) {
    d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
  }
  return Math.floor(d.getTime() / 1000);
}

/**
 * Ask the proxy for a durations matrix (minutes) from each origin to each
 * destination. Throws with the server's message on failure.
 */
export async function fetchDriveTimes(
  origins: LatLng[],
  destinations: LatLng[],
  departureTime: number | 'now',
): Promise<(number | null)[][]> {
  const res = await fetch('/api/drivetimes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origins, destinations, departureTime }),
  });
  let data: { durations?: (number | null)[][]; error?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(`Drive-time request failed (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(data.error || `Drive-time request failed (HTTP ${res.status}).`);
  return data.durations ?? [];
}
