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
  const items = flattenWeightingItems(payload, level);
  const res = await fetch("/api/submit-weighting", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company: payload.company,
      contact: payload.contact ?? null,
      school_level: payload.schoolLevel,
      hierarchy_generated_at: payload.hierarchyGeneratedAt ?? null,
      raw_payload: payload,
      items,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    itemCount?: number;
    error?: string;
  };
  if (!res.ok || !data.id) {
    throw new Error(data.error || `Could not save to Supabase (${res.status}).`);
  }
  return { id: data.id, itemCount: data.itemCount ?? items.length };
}
