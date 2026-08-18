import type {
  CompanySuggestionsV3,
  HierarchySchoolLevel,
  RollupSuggestion,
} from "./hierarchyTypes";
import { findSpaceType } from "./weighting";

export type WeightLayer = "focus_area" | "space_type" | "category" | "subcategory";

export type WeightingItemRow = {
  layer: WeightLayer;
  item_key: string;
  item_label: string;
  weight: number;
  comment: string | null;
  include_in_score: boolean;
  focus_area: string | null;
  space_type_id: string | null;
  category: string | null;
  subcategory: string | null;
};

function afterMarker(key: string, marker: string): { left: string; right: string } | null {
  const idx = key.indexOf(marker);
  if (idx < 0) return null;
  return { left: key.slice(0, idx), right: key.slice(idx + marker.length) };
}

function rowFromSuggestion(
  layer: WeightLayer,
  row: RollupSuggestion,
  level: HierarchySchoolLevel,
): WeightingItemRow {
  let focus_area: string | null = null;
  let space_type_id: string | null = null;
  let category: string | null = null;
  let subcategory: string | null = null;

  if (layer === "focus_area") {
    const parts = row.key.split("||");
    focus_area = parts.slice(2).join("||") || row.label;
  } else if (layer === "space_type") {
    space_type_id = row.key;
    const hit = findSpaceType(level, row.key);
    focus_area = hit?.focusArea.name ?? null;
  } else if (layer === "category") {
    const parsed = afterMarker(row.key, "||cat||");
    space_type_id = parsed?.left ?? null;
    category = parsed?.right || row.label;
    const hit = space_type_id ? findSpaceType(level, space_type_id) : undefined;
    focus_area = hit?.focusArea.name ?? null;
  } else {
    const parsed = afterMarker(row.key, "||sub||");
    space_type_id = parsed?.left ?? null;
    if (parsed) {
      const catIdx = parsed.right.indexOf("||");
      if (catIdx >= 0) {
        category = parsed.right.slice(0, catIdx);
        subcategory = parsed.right.slice(catIdx + 2);
      } else {
        subcategory = parsed.right || row.label;
      }
    }
    const hit = space_type_id ? findSpaceType(level, space_type_id) : undefined;
    focus_area = hit?.focusArea.name ?? null;
  }

  return {
    layer,
    item_key: row.key,
    item_label: row.label,
    weight: row.importance,
    comment: row.comment?.trim() || null,
    include_in_score: row.includeInScore !== false,
    focus_area,
    space_type_id,
    category,
    subcategory,
  };
}

export function flattenWeightingItems(
  payload: CompanySuggestionsV3,
  level: HierarchySchoolLevel,
): WeightingItemRow[] {
  return [
    ...payload.focusAreaWeights.map((r) => rowFromSuggestion("focus_area", r, level)),
    ...payload.spaceTypeWeights.map((r) => rowFromSuggestion("space_type", r, level)),
    ...payload.categoryWeights.map((r) => rowFromSuggestion("category", r, level)),
    ...payload.subcategoryWeights.map((r) => rowFromSuggestion("subcategory", r, level)),
  ];
}

export async function submitWeightingToSupabase(
  payload: CompanySuggestionsV3,
  level: HierarchySchoolLevel,
): Promise<{ id: string; itemCount: number }> {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then rebuild the site.",
    );
  }

  const items = flattenWeightingItems(payload, level).filter(
    (item) => Number.isInteger(item.weight) && item.weight > 0 && item.item_key && item.layer,
  );

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  async function insertSubmission(includeName: boolean) {
    const row: Record<string, unknown> = {
      company: payload.company,
      contact: payload.contact ?? null,
      school_level: payload.schoolLevel,
      hierarchy_generated_at: payload.hierarchyGeneratedAt ?? null,
      payload_version: 3,
      raw_payload: payload,
    };
    if (includeName) row.reviewer_name = payload.reviewerName ?? null;
    return fetch(`${url}/rest/v1/weighting_submissions`, {
      method: "POST",
      headers,
      body: JSON.stringify(row),
    });
  }

  let subRes = await insertSubmission(true);
  let subText = await subRes.text();
  if (!subRes.ok && /reviewer_name/i.test(subText)) {
    subRes = await insertSubmission(false);
    subText = await subRes.text();
  }
  if (!subRes.ok) {
    throw new Error(pgError(subText) || `Supabase submission insert failed (${subRes.status}).`);
  }
  const subRows = JSON.parse(subText) as Array<{ id: string }>;
  const id = subRows[0]?.id;
  if (!id) throw new Error("Supabase did not return a submission id.");

  if (items.length > 0) {
    const itemRes = await fetch(`${url}/rest/v1/weighting_items`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(
        items.map((item) => ({
          submission_id: id,
          layer: item.layer,
          item_key: item.item_key,
          item_label: item.item_label,
          weight: item.weight,
          comment: item.comment,
          include_in_score: item.include_in_score,
          focus_area: item.focus_area,
          space_type_id: item.space_type_id,
          category: item.category,
          subcategory: item.subcategory,
        })),
      ),
    });
    if (!itemRes.ok) {
      const itemText = await itemRes.text();
      throw new Error(pgError(itemText) || `Supabase items insert failed (${itemRes.status}).`);
    }
  }

  return { id, itemCount: items.length };
}

function pgError(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string; error?: string; hint?: string };
    return parsed.message || parsed.error || parsed.hint || text;
  } catch {
    return String(text || "").slice(0, 400);
  }
}
