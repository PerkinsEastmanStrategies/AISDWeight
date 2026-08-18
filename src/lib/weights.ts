import type { Question, WeightRole, WeightValue } from "./types";

export function parseWeight(raw: unknown): WeightValue {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.toLowerCase() === "i") return "i";
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function classifyWeights(
  qw: WeightValue,
  sw: WeightValue,
  cw: WeightValue,
): WeightRole {
  if (qw === "i") return "inventory";
  const qwBlank = qw === null;
  const swBlank = sw === null;
  const cwBlank = cw === null;
  if (qwBlank && swBlank && cwBlank) return "blank";
  if (typeof qw === "number" && !swBlank && !cwBlank) return "scoring";
  return "incomplete";
}

export function classifyQuestion(q: Question): WeightRole {
  return classifyWeights(q.qw, q.sw, q.cw);
}

export function fmtWeight(w: WeightValue): string {
  if (w === "i") return "i";
  if (w === null) return "—";
  return String(w);
}

export function missingWeightFields(q: Question): string[] {
  const missing: string[] = [];
  if (q.qw === null) missing.push("Question Weight");
  if (q.sw === null) missing.push("Subcategory Weight");
  if (q.cw === null) missing.push("Category Weight");
  return missing;
}

export function roleLabel(role: WeightRole): string {
  switch (role) {
    case "scoring":
      return "Scoring";
    case "inventory":
      return "Inventory";
    case "blank":
      return "Blank";
    case "incomplete":
      return "Incomplete";
  }
}

/** Median of numeric values; null if empty. */
export function median(values: number[]): number | null {
  const nums = values.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

export function numericWeights(qs: Question[], field: "qw" | "sw" | "cw"): number[] {
  const out: number[] = [];
  for (const q of qs) {
    if (classifyQuestion(q) !== "scoring") continue;
    const v = q[field];
    if (typeof v === "number") out.push(v);
  }
  return out;
}

export const CONFLICT_SPAN = 6;

export function hasConflict(values: number[], span = CONFLICT_SPAN): boolean {
  if (values.length < 2) return false;
  return Math.max(...values) - Math.min(...values) >= span;
}
