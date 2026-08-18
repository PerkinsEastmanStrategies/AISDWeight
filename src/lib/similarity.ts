import type {
  Catalog,
  PeerSuggestion,
  Question,
  SimilarityOverrides,
} from "./types";
import {
  classifyQuestion,
  hasConflict,
  median,
  numericWeights,
} from "./weights";

/** Normalize question text for exact-group matching. */
export function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAutoSimilarityGroups(
  questions: Question[],
): Catalog["similarityGroups"] {
  const byNorm = new Map<string, Question[]>();
  for (const q of questions) {
    const n = normalizeQuestionText(q.text);
    if (!n) continue;
    const list = byNorm.get(n) ?? [];
    list.push(q);
    byNorm.set(n, list);
  }

  const groups: Catalog["similarityGroups"] = [];
  let i = 0;
  for (const [normalizedText, qs] of byNorm) {
    if (qs.length < 2) continue;
    groups.push({
      id: `auto-${i++}`,
      normalizedText,
      sampleText: qs[0].text,
      questionKeys: qs.map((q) => q.key),
    });
  }
  groups.sort((a, b) => b.questionKeys.length - a.questionKeys.length);
  return groups;
}

function emptyOverrides(): SimilarityOverrides {
  return { manualLinks: [] };
}

export function mergeOverrides(
  base: SimilarityOverrides | null | undefined,
): SimilarityOverrides {
  return {
    manualLinks: [...(base?.manualLinks ?? [])],
  };
}

/** Union-find to resolve auto groups + manual links into peer sets. */
export function buildPeerIndex(
  catalog: Catalog,
  overrides: SimilarityOverrides | null | undefined,
): Map<string, Set<string>> {
  const ov = mergeOverrides(overrides);
  const parent = new Map<string, string>();

  function find(x: string): string {
    if (!parent.has(x)) parent.set(x, x);
    let p = parent.get(x)!;
    while (parent.get(p) !== p) {
      parent.set(p, parent.get(parent.get(p)!)!);
      p = parent.get(p)!;
    }
    parent.set(x, p);
    return p;
  }

  function union(a: string, b: string) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const q of catalog.questions) find(q.key);

  for (const g of catalog.similarityGroups) {
    if (g.questionKeys.length < 2) continue;
    const first = g.questionKeys[0];
    for (let i = 1; i < g.questionKeys.length; i++) {
      union(first, g.questionKeys[i]);
    }
  }

  for (const link of ov.manualLinks) {
    if (link.a && link.b) union(link.a, link.b);
  }

  const clusters = new Map<string, Set<string>>();
  for (const q of catalog.questions) {
    const r = find(q.key);
    const set = clusters.get(r) ?? new Set();
    set.add(q.key);
    clusters.set(r, set);
  }

  const byKey = new Map<string, Set<string>>();
  for (const set of clusters.values()) {
    for (const k of set) byKey.set(k, set);
  }
  return byKey;
}

export function getPeerQuestions(
  catalog: Catalog,
  questionKey: string,
  overrides: SimilarityOverrides | null | undefined,
): Question[] {
  const byKey = new Map(catalog.questions.map((q) => [q.key, q]));
  const index = buildPeerIndex(catalog, overrides);
  const cluster = index.get(questionKey);
  if (!cluster) return [];
  const target = byKey.get(questionKey);
  if (!target) return [];

  const peers: Question[] = [];
  for (const k of cluster) {
    if (k === questionKey) continue;
    const q = byKey.get(k);
    if (!q) continue;
    if (q.spaceTypeId === target.spaceTypeId) continue;
    peers.push(q);
  }
  return peers;
}

export function suggestFromPeers(
  catalog: Catalog,
  questionKey: string,
  overrides: SimilarityOverrides | null | undefined,
): PeerSuggestion {
  const peers = getPeerQuestions(catalog, questionKey, overrides).filter(
    (q) => classifyQuestion(q) === "scoring",
  );
  const qwVals = numericWeights(peers, "qw");
  const swVals = numericWeights(peers, "sw");
  const cwVals = numericWeights(peers, "cw");
  return {
    qw: median(qwVals),
    sw: median(swVals),
    cw: median(cwVals),
    peerCount: peers.length,
    peers,
    conflictQw: hasConflict(qwVals),
    conflictSw: hasConflict(swVals),
    conflictCw: hasConflict(cwVals),
  };
}

export { emptyOverrides };
