import type { CompanySuggestions, SimilarityOverrides } from "./types";
import type { Importance } from "./relative";
import type { CompanySuggestionsV3, WeightingSession } from "./hierarchyTypes";
import { emptyWeightingSession } from "./weighting";

const SUGGESTIONS_KEY = "esa-scoring-company-suggestions";
const SUGGESTIONS_V3_KEY = "esa-scoring-company-suggestions-v3";
const OVERRIDES_KEY = "esa-scoring-similarity-overrides";
const REVIEWER_DRAFT_KEY = "esa-scoring-reviewer-draft-v3";
const WEIGHTING_SESSION_KEY = "esa-scoring-weighting-session-v1";

export function loadCompanySuggestions(): CompanySuggestions[] {
  try {
    const raw = localStorage.getItem(SUGGESTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompanySuggestions[];
    return Array.isArray(parsed) ? parsed.filter((c) => c?.version === 2) : [];
  } catch {
    return [];
  }
}

export function loadCompanySuggestionsV3(): CompanySuggestionsV3[] {
  try {
    const raw = localStorage.getItem(SUGGESTIONS_V3_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompanySuggestionsV3[];
    return Array.isArray(parsed) ? parsed.filter((c) => c?.version === 3) : [];
  } catch {
    return [];
  }
}

export function saveCompanySuggestionsV3(list: CompanySuggestionsV3[]) {
  localStorage.setItem(SUGGESTIONS_V3_KEY, JSON.stringify(list));
}

export function addCompanySuggestionsV3(file: CompanySuggestionsV3) {
  const list = loadCompanySuggestionsV3().filter(
    (c) =>
      !(
        c.company.toLowerCase() === file.company.toLowerCase() &&
        c.schoolLevel === file.schoolLevel
      ),
  );
  list.push(file);
  saveCompanySuggestionsV3(list);
  return list;
}

export function clearCompanySuggestionsV3() {
  localStorage.removeItem(SUGGESTIONS_V3_KEY);
}

export function loadWeightingSession(): WeightingSession {
  try {
    const raw = localStorage.getItem(WEIGHTING_SESSION_KEY);
    if (!raw) return emptyWeightingSession();
    return { ...emptyWeightingSession(), ...JSON.parse(raw) } as WeightingSession;
  } catch {
    return emptyWeightingSession();
  }
}

export function saveWeightingSession(session: WeightingSession) {
  localStorage.setItem(WEIGHTING_SESSION_KEY, JSON.stringify(session));
}

export function clearWeightingSession() {
  localStorage.removeItem(WEIGHTING_SESSION_KEY);
}

export function saveCompanySuggestions(list: CompanySuggestions[]) {
  localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(list));
}

export function addCompanySuggestions(file: CompanySuggestions) {
  const list = loadCompanySuggestions().filter(
    (c) => c.company.toLowerCase() !== file.company.toLowerCase(),
  );
  list.push(file);
  saveCompanySuggestions(list);
  return list;
}

export function clearCompanySuggestions() {
  localStorage.removeItem(SUGGESTIONS_KEY);
}

export function loadOverridesFromStorage(): SimilarityOverrides | null {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SimilarityOverrides;
  } catch {
    return null;
  }
}

export function saveOverridesToStorage(ov: SimilarityOverrides) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(ov));
}

export type ReviewerDraft = {
  company: string;
  contact: string;
  spaceTypeId: string;
  /** key: `${spaceTypeId}||${category}||${subcategory}` → 3/6/9/12 */
  subcategoryScores: Record<string, { importance: Importance | null; comment: string }>;
  /** key: questionKey → 3/6/9/12 */
  questionScores: Record<string, { importance: Importance | null; comment: string }>;
};

export function subcategoryScoreKey(
  spaceTypeId: string,
  category: string,
  subcategory: string,
): string {
  return `${spaceTypeId}||${category}||${subcategory}`;
}

export function loadReviewerDraft(): ReviewerDraft | null {
  try {
    const raw = localStorage.getItem(REVIEWER_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewerDraft;
  } catch {
    return null;
  }
}

export function saveReviewerDraft(draft: ReviewerDraft) {
  localStorage.setItem(REVIEWER_DRAFT_KEY, JSON.stringify(draft));
}

export function clearReviewerDraft() {
  localStorage.removeItem(REVIEWER_DRAFT_KEY);
}
