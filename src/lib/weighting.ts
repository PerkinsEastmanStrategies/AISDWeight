import type { Catalog } from "./types";
import type {
  CompanySuggestionsV3,
  HierarchyFocusArea,
  HierarchySchoolLevel,
  HierarchySpaceType,
  RollupSuggestion,
  SiteHierarchy,
  WeightEntry,
  WeightingSession,
} from "./hierarchyTypes";
import type { SchoolLevelId } from "./hierarchyTypes";

export function emptyWeightEntry(): WeightEntry {
  return { importance: null, comment: "", includeInScore: false, touched: false };
}

export function isReviewed(session?: WeightEntry): boolean {
  return Boolean(session?.touched);
}

export function emptyWeightingSession(): WeightingSession {
  return {
    company: "",
    reviewerName: "",
    contact: "",
    schoolLevel: "",
    focusAreaWeights: {},
    spaceTypeWeights: {},
    categoryWeights: {},
    subcategoryWeights: {},
    suggestions: {
      focusAreaWeights: {},
      spaceTypeWeights: {},
      categoryWeights: {},
      subcategoryWeights: {},
    },
  };
}

export function getSchoolLevel(
  hierarchy: SiteHierarchy,
  id: SchoolLevelId,
): HierarchySchoolLevel | undefined {
  return hierarchy.schoolLevels.find((s) => s.id === id);
}

export function focusAreaKey(schoolLevel: string, focusArea: string) {
  return `${schoolLevel}||fa||${focusArea}`;
}

export function spaceTypeKey(spaceTypeId: string) {
  return spaceTypeId;
}

export function categoryKey(spaceTypeId: string, category: string) {
  return `${spaceTypeId}||cat||${category}`;
}

export function subcategoryKey(
  spaceTypeId: string,
  category: string,
  subcategory: string,
) {
  return `${spaceTypeId}||sub||${category}||${subcategory}`;
}

export function seedSessionForLevel(
  prev: WeightingSession,
  level: HierarchySchoolLevel,
): WeightingSession {
  const focusAreaWeights = { ...prev.focusAreaWeights };
  const spaceTypeWeights = { ...prev.spaceTypeWeights };
  const suggestions = {
    focusAreaWeights: { ...prev.suggestions.focusAreaWeights },
    spaceTypeWeights: { ...prev.suggestions.spaceTypeWeights },
    categoryWeights: { ...prev.suggestions.categoryWeights },
    subcategoryWeights: { ...prev.suggestions.subcategoryWeights },
  };

  for (const fa of level.focusAreas) {
    const fk = focusAreaKey(level.id, fa.name);
    if (!focusAreaWeights[fk]) {
      const entry: WeightEntry = {
        importance: null,
        comment: "",
        includeInScore: true,
      };
      focusAreaWeights[fk] = entry;
      if (!suggestions.focusAreaWeights[fk]) {
        suggestions.focusAreaWeights[fk] = { ...entry };
      }
    }
    for (const st of fa.spaceTypes) {
      const sk = spaceTypeKey(st.id);
      if (!spaceTypeWeights[sk]) {
        const entry: WeightEntry = {
          importance: null,
          comment: "",
          includeInScore: st.required,
        };
        spaceTypeWeights[sk] = entry;
        if (!suggestions.spaceTypeWeights[sk]) {
          suggestions.spaceTypeWeights[sk] = { ...entry };
        }
      }
    }
  }

  return {
    ...prev,
    schoolLevel: level.id,
    focusAreaWeights,
    spaceTypeWeights,
    suggestions,
  };
}

export function effectiveWeight(entry: WeightEntry | undefined): number {
  if (!entry || entry.importance == null) return 0;
  return entry.importance;
}

export function isIncludedInRollup(
  entry: WeightEntry | undefined,
  required: boolean,
): boolean {
  if (!entry || entry.importance == null) return false;
  if (required) return true;
  return Boolean(entry.includeInScore);
}

export type DonutSlice = {
  key: string;
  label: string;
  weight: number;
  pct: number;
  color: string;
  required?: boolean;
  included: boolean;
};

/** AISD brand palette (primary + secondary) for donut slices */
export const DONUT_PALETTE = [
  "#293678", // Dark Blue
  "#547DBF", // Blue
  "#B7000B", // Red
  "#5BA649", // Green
  "#F9BC15", // Yellow
  "#4555A5", // Medium Blue
  "#6B3534", // Brown
  "#4B4B4B", // Charcoal Gray
];

const PALETTE = DONUT_PALETTE;

export function buildDonutSlices(
  items: Array<{
    key: string;
    label: string;
    weight: number;
    included: boolean;
    required?: boolean;
  }>,
): { slices: DonutSlice[]; total: number } {
  const included = items.filter((i) => i.included && i.weight > 0);
  const total = included.reduce((s, i) => s + i.weight, 0);
  const slices = items.map((i, idx) => ({
    ...i,
    pct: total > 0 && i.included && i.weight > 0 ? (i.weight / total) * 100 : 0,
    color: PALETTE[idx % PALETTE.length],
  }));
  return { slices, total };
}

export function questionsInCategory(
  catalog: Catalog,
  catalogSpaceTypeId: string | null,
  category: string,
) {
  if (!catalogSpaceTypeId) return [];
  return catalog.questions
    .filter(
      (q) => q.spaceTypeId === catalogSpaceTypeId && q.category === category,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function questionsInSubcategory(
  catalog: Catalog,
  catalogSpaceTypeId: string | null,
  category: string,
  subcategory: string,
) {
  if (!catalogSpaceTypeId) return [];
  return catalog.questions
    .filter(
      (q) =>
        q.spaceTypeId === catalogSpaceTypeId &&
        q.category === category &&
        q.subcategory === subcategory,
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

export type ReviewCount = { label: string; scored: number; total: number };

export function schoolLevelReviewCounts(
  catalog: Catalog,
  level: HierarchySchoolLevel,
  session: WeightingSession,
): ReviewCount[] {
  let faScored = 0;
  const faTotal = level.focusAreas.length;
  let stScored = 0;
  let stTotal = 0;
  let catScored = 0;
  let catTotal = 0;
  let subScored = 0;
  let subTotal = 0;

  for (const fa of level.focusAreas) {
    const fk = focusAreaKey(level.id, fa.name);
    if (isReviewed(session.focusAreaWeights[fk])) {
      faScored++;
    }
    for (const st of fa.spaceTypes) {
      stTotal++;
      const sk = spaceTypeKey(st.id);
      if (isReviewed(session.spaceTypeWeights[sk])) {
        stScored++;
      }
      const cats = categoriesForCatalogSpace(catalog, st.catalogSpaceTypeId);
      for (const cat of cats) {
        catTotal++;
        const ck = categoryKey(st.id, cat);
        if (isReviewed(session.categoryWeights[ck])) {
          catScored++;
        }
        const subs = subcategoriesForCatalogSpace(
          catalog,
          st.catalogSpaceTypeId,
          cat,
        );
        for (const sub of subs) {
          subTotal++;
          const suk = subcategoryKey(st.id, cat, sub);
          if (isReviewed(session.subcategoryWeights[suk])) {
            subScored++;
          }
        }
      }
    }
  }

  return [
    { label: "Focus areas", scored: faScored, total: faTotal },
    { label: "Space types", scored: stScored, total: stTotal },
    { label: "Categories", scored: catScored, total: catTotal },
    { label: "Subcategories", scored: subScored, total: subTotal },
  ];
}

export function categoriesForCatalogSpace(
  catalog: Catalog,
  catalogSpaceTypeId: string | null,
): string[] {
  if (!catalogSpaceTypeId) return [];
  const set = new Set<string>();
  for (const q of catalog.questions) {
    if (q.spaceTypeId === catalogSpaceTypeId && q.category) set.add(q.category);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function subcategoriesForCatalogSpace(
  catalog: Catalog,
  catalogSpaceTypeId: string | null,
  category: string,
): string[] {
  if (!catalogSpaceTypeId) return [];
  const set = new Set<string>();
  for (const q of catalog.questions) {
    if (
      q.spaceTypeId === catalogSpaceTypeId &&
      q.category === category &&
      q.subcategory
    ) {
      set.add(q.subcategory);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function findFocusArea(
  level: HierarchySchoolLevel,
  name: string,
): HierarchyFocusArea | undefined {
  return level.focusAreas.find((f) => f.name === name);
}

export function findSpaceType(
  level: HierarchySchoolLevel,
  spaceTypeId: string,
): { focusArea: HierarchyFocusArea; spaceType: HierarchySpaceType } | undefined {
  for (const fa of level.focusAreas) {
    const st = fa.spaceTypes.find((s) => s.id === spaceTypeId);
    if (st) return { focusArea: fa, spaceType: st };
  }
  return undefined;
}

export function updateLinkedSuggestion(
  session: WeightingSession,
  bucket:
    | "focusAreaWeights"
    | "spaceTypeWeights"
    | "categoryWeights"
    | "subcategoryWeights",
  key: string,
  patch: Partial<WeightEntry>,
  linkSuggestion: boolean,
): WeightingSession {
  const current = session[bucket][key] ?? emptyWeightEntry();
  const nextEntry = { ...current, ...patch, touched: true };
  const nextSession = {
    ...session,
    [bucket]: { ...session[bucket], [key]: nextEntry },
  };
  if (!linkSuggestion) return nextSession;
  const sug = session.suggestions[bucket][key] ?? emptyWeightEntry();
  return {
    ...nextSession,
    suggestions: {
      ...session.suggestions,
      [bucket]: {
        ...session.suggestions[bucket],
        [key]: {
          ...sug,
          importance: nextEntry.importance,
          includeInScore: nextEntry.includeInScore,
          comment: patch.comment !== undefined ? patch.comment : sug.comment,
          touched: true,
        },
      },
    },
  };
}

export function setSuggestionOnly(
  session: WeightingSession,
  bucket:
    | "focusAreaWeights"
    | "spaceTypeWeights"
    | "categoryWeights"
    | "subcategoryWeights",
  key: string,
  patch: Partial<WeightEntry>,
): WeightingSession {
  const current = session.suggestions[bucket][key] ?? emptyWeightEntry();
  return {
    ...session,
    suggestions: {
      ...session.suggestions,
      [bucket]: {
        ...session.suggestions[bucket],
        [key]: { ...current, ...patch, touched: true },
      },
    },
  };
}

export function packWeightEntries(
  map: Record<string, WeightEntry>,
  labelFor: (key: string) => string,
): RollupSuggestion[] {
  return Object.entries(map)
    .filter(([, e]) => e.importance != null)
    .map(([key, e]) => ({
      key,
      label: labelFor(key),
      importance: e.importance!,
      comment: e.comment.trim() || undefined,
      includeInScore: e.includeInScore,
    }));
}

export function buildCompanySuggestionsV3(
  session: WeightingSession,
  hierarchy: SiteHierarchy,
  level: HierarchySchoolLevel,
): CompanySuggestionsV3 {
  if (!session.schoolLevel) {
    throw new Error("Select a school level first.");
  }
  return {
    version: 3,
    company: session.company.trim(),
    reviewerName: session.reviewerName.trim() || undefined,
    contact: session.contact.trim() || undefined,
    schoolLevel: session.schoolLevel,
    exportedAt: new Date().toISOString(),
    hierarchyGeneratedAt: hierarchy.meta.generatedAt,
    focusAreaWeights: packWeightEntries(session.focusAreaWeights, (k) =>
      k.split("||").slice(-1)[0],
    ),
    spaceTypeWeights: packWeightEntries(session.spaceTypeWeights, (k) => {
      const hit = findSpaceType(level, k);
      return hit?.spaceType.name ?? k;
    }),
    categoryWeights: packWeightEntries(session.categoryWeights, (k) =>
      k.split("||").slice(-1)[0],
    ),
    subcategoryWeights: packWeightEntries(session.subcategoryWeights, (k) =>
      k.split("||").slice(-1)[0],
    ),
  };
}
