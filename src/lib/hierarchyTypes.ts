import type { Importance } from "./relative";

export type SchoolLevelId = "ES" | "MS" | "HS";

export type HierarchySpaceType = {
  id: string;
  name: string;
  scoreCode: string;
  required: boolean;
  baselineWeight: number | null;
  importanceSeed: Importance | null;
  minSurveys: number | null;
  notes?: string;
  navFocusArea: string;
  scoringFocus?: string;
  catalogSpaceTypeId: string | null;
  catalogSpaceTypeName: string | null;
};

export type HierarchyFocusArea = {
  name: string;
  navLabel?: string;
  scoringFocus?: string;
  baselineWeight: number | null;
  importanceSeed: Importance | null;
  spaceTypes: HierarchySpaceType[];
};

export type HierarchySchoolLevel = {
  id: SchoolLevelId;
  label: string;
  focusAreas: HierarchyFocusArea[];
};

export type SiteHierarchy = {
  meta: {
    sourceFile: string;
    generatedAt: string;
    note?: string;
  };
  schoolLevels: HierarchySchoolLevel[];
};

/** Session / suggestion weight entry */
export type WeightEntry = {
  importance: Importance | null;
  comment: string;
  /** Not-required items: when true (or when importance set), include in donut */
  includeInScore?: boolean;
  /** True after the reviewer edits this row (prefills do not count as reviewed). */
  touched?: boolean;
};

export type WeightingSession = {
  company: string;
  reviewerName: string;
  contact: string;
  schoolLevel: SchoolLevelId | "";
  submittedAt?: string;
  /** Session weights drive the donut */
  focusAreaWeights: Record<string, WeightEntry>;
  spaceTypeWeights: Record<string, WeightEntry>;
  categoryWeights: Record<string, WeightEntry>;
  subcategoryWeights: Record<string, WeightEntry>;
  /** Formal reviewer suggestions (exported); start linked to session */
  suggestions: {
    focusAreaWeights: Record<string, WeightEntry>;
    spaceTypeWeights: Record<string, WeightEntry>;
    categoryWeights: Record<string, WeightEntry>;
    subcategoryWeights: Record<string, WeightEntry>;
  };
};

export type RollupSuggestion = {
  key: string;
  label: string;
  importance: Importance;
  comment?: string;
  includeInScore?: boolean;
};

export type CompanySuggestionsV3 = {
  version: 3;
  company: string;
  reviewerName?: string;
  contact?: string;
  schoolLevel: SchoolLevelId;
  exportedAt: string;
  hierarchyGeneratedAt?: string;
  focusAreaWeights: RollupSuggestion[];
  spaceTypeWeights: RollupSuggestion[];
  categoryWeights: RollupSuggestion[];
  subcategoryWeights: RollupSuggestion[];
};
