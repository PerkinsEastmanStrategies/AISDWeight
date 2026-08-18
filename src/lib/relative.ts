/** Relative importance: preferred steps 3/6/9/12, or any custom positive number. */
export type Importance = number;

export const IMPORTANCE_LEVELS = [3, 6, 9, 12] as const;
export type PresetImportance = (typeof IMPORTANCE_LEVELS)[number];

export const IMPORTANCE_LEGEND =
  "Prefer 3 / 6 / 9 / 12 (3 = lower · 12 = higher), or choose Custom to enter any weight. Score items in a set relative to each other.";

export function isPresetImportance(v: unknown): v is PresetImportance {
  return v === 3 || v === 6 || v === 9 || v === 12;
}

/** Any finite whole number > 0 is a valid weight. */
export function isImportance(v: unknown): v is Importance {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function parseImportance(raw: unknown): Importance | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Prefill from existing numeric weights in a comparison set.
 * Higher weight → higher importance. Equal weights → all 6 (or keep if already on-scale).
 * Missing weights → null. Non-preset values snap to the nearest 3/6/9/12 step by range.
 */
export function suggestImportanceFromWeights(
  weights: Array<number | null | undefined>,
): Array<Importance | null> {
  const nums = weights.map((w) => (typeof w === "number" ? w : null));
  const present = nums.filter((n): n is number => n !== null);
  if (present.length === 0) return nums.map(() => null);
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (min === max) {
    const only = present[0];
    const kept = isPresetImportance(only) ? only : 6;
    return nums.map((n) => (n === null ? null : kept));
  }
  return nums.map((n) => {
    if (n === null) return null;
    if (isPresetImportance(n)) return n;
    const t = (n - min) / (max - min);
    const idx = Math.max(0, Math.min(3, Math.round(t * 3)));
    return IMPORTANCE_LEVELS[idx];
  });
}

export function setProgress(
  items: number,
  scored: number,
): { scored: number; total: number; complete: boolean } {
  return { scored, total: items, complete: items > 0 && scored === items };
}
