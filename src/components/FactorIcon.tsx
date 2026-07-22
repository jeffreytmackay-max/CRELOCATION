import { FACTOR_ICON_PATHS } from '../data/factors';
import type { FactorKey } from '../types';

/** Inline SVG glyph for a weighting factor (24×24, 2px stroke, currentColor). */
export function FactorIcon({ factor, size = 18 }: { factor: FactorKey; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {FACTOR_ICON_PATHS[factor].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
