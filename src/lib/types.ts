/** Portable domain types for catalog, suggestions, and similarity overrides. */

import type { Importance } from "./relative";

export type WeightValue = number | "i" | null;
export type WeightRole = "scoring" | "inventory" | "blank" | "incomplete";

export type Option = {
  scoreId: string;
  label: string;
  score: number | null;
  schoolLevel?: string;
};

export type Question = {
  /** Stable key: `${spaceTypeId}::${id}` — QuestionIDs repeat across sheets */
  key: string;
  id: string;
  spaceTypeId: string;
  category: string;
  subcategory: string;
  schoolLevel: string;
  text: string;
  context?: string;
  type: string;
  qw: WeightValue;
  sw: WeightValue;
  cw: WeightValue;
  options: Option[];
  surveyFocus: string;
  scoreFocus: string;
  notes?: string;
  sources?: string;
};

export type SpaceType = {
  id: string;
  name: string;
  focusArea: string;
  sheet: string;
};

export type Catalog = {
  meta: {
    sourceFile: string;
    generatedAt: string;
    school: string;
  };
  focusAreas: string[];
  spaceTypes: SpaceType[];
  questions: Question[];
  /** Auto groups by normalized question text (question keys) */
  similarityGroups: Array<{
    id: string;
    normalizedText: string;
    sampleText: string;
    questionKeys: string[];
  }>;
};

export type SimilarityOverrides = {
  /** Pairs of question keys considered similar */
  manualLinks: Array<{ a: string; b: string; note?: string }>;
};

/** @deprecated v1 absolute weight suggestions — still accepted on import */
export type QuestionSuggestionV1 = {
  questionKey: string;
  qw: WeightValue;
  sw: WeightValue;
  cw: WeightValue;
  comment?: string;
};

export type QuestionSuggestion = {
  questionKey: string;
  /** Relative importance within its subcategory (3 / 6 / 9 / 12) */
  importance: Importance;
  comment?: string;
};

export type SubcategorySuggestion = {
  spaceTypeId: string;
  category: string;
  subcategory: string;
  /** Relative importance within its category (3 / 6 / 9 / 12) */
  importance: Importance;
  comment?: string;
};

export type CompanySuggestions = {
  version: 2;
  company: string;
  contact?: string;
  exportedAt: string;
  catalogGeneratedAt?: string;
  subcategoryScores: SubcategorySuggestion[];
  questionScores: QuestionSuggestion[];
};

/** Legacy import shape */
export type CompanySuggestionsV1 = {
  version: 1;
  company: string;
  contact?: string;
  exportedAt: string;
  catalogGeneratedAt?: string;
  suggestions: QuestionSuggestionV1[];
};

export type PeerSuggestion = {
  qw: number | null;
  sw: number | null;
  cw: number | null;
  peerCount: number;
  peers: Question[];
  conflictQw: boolean;
  conflictSw: boolean;
  conflictCw: boolean;
};
