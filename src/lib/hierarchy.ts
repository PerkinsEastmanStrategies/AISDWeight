import type { Catalog, Question, SpaceType } from "./types";
import { classifyQuestion } from "./weights";

export const SCHOOL_NAME = "AISD";

export type NavLevel =
  | { level: "school" }
  | { level: "focus"; focusArea: string }
  | { level: "space"; focusArea: string; spaceTypeId: string }
  | {
      level: "category";
      focusArea: string;
      spaceTypeId: string;
      category: string;
    }
  | {
      level: "subcategory";
      focusArea: string;
      spaceTypeId: string;
      category: string;
      subcategory: string;
    }
  | {
      level: "question";
      focusArea: string;
      spaceTypeId: string;
      category: string;
      subcategory: string;
      questionKey: string;
    };

export function spaceTypesForFocus(catalog: Catalog, focusArea: string): SpaceType[] {
  return catalog.spaceTypes
    .filter((s) => s.focusArea === focusArea)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function questionsForSpace(catalog: Catalog, spaceTypeId: string): Question[] {
  return catalog.questions.filter((q) => q.spaceTypeId === spaceTypeId);
}

export function categoriesForSpace(catalog: Catalog, spaceTypeId: string): string[] {
  const set = new Set(
    questionsForSpace(catalog, spaceTypeId).map((q) => q.category).filter(Boolean),
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function subcategoriesFor(
  catalog: Catalog,
  spaceTypeId: string,
  category: string,
): string[] {
  const set = new Set(
    questionsForSpace(catalog, spaceTypeId)
      .filter((q) => q.category === category)
      .map((q) => q.subcategory)
      .filter(Boolean),
  );
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function questionsForSub(
  catalog: Catalog,
  spaceTypeId: string,
  category: string,
  subcategory: string,
): Question[] {
  return questionsForSpace(catalog, spaceTypeId)
    .filter((q) => q.category === category && q.subcategory === subcategory)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function findQuestion(catalog: Catalog, key: string): Question | undefined {
  return catalog.questions.find((q) => q.key === key);
}

export function findSpace(catalog: Catalog, id: string): SpaceType | undefined {
  return catalog.spaceTypes.find((s) => s.id === id);
}

export function roleCounts(questions: Question[]) {
  const counts = { scoring: 0, inventory: 0, blank: 0, incomplete: 0, total: 0 };
  for (const q of questions) {
    counts[classifyQuestion(q)]++;
    counts.total++;
  }
  return counts;
}

export function overviewStats(catalog: Catalog) {
  const byFocus = catalog.focusAreas.map((fa) => {
    const spaces = spaceTypesForFocus(catalog, fa);
    const qs = catalog.questions.filter((q) =>
      spaces.some((s) => s.id === q.spaceTypeId),
    );
    return { focusArea: fa, spaces: spaces.length, ...roleCounts(qs) };
  });
  return { byFocus, overall: roleCounts(catalog.questions) };
}
