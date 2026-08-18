import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../lib/DataContext";
import {
  categoriesForSpace,
  findSpace,
  questionsForSub,
  subcategoriesFor,
} from "../lib/hierarchy";
import {
  clearReviewerDraft,
  loadReviewerDraft,
  saveReviewerDraft,
  subcategoryScoreKey,
  type ReviewerDraft,
} from "../lib/storage";
import { classifyQuestion, fmtWeight } from "../lib/weights";
import type { CompanySuggestions, Question, WeightValue } from "../lib/types";
import { downloadJson } from "../lib/export";
import { RolePill } from "../components/Ui";
import { PeerScoresPanel } from "../components/PeerScores";
import { ImportanceRadios } from "../components/WeightEditorRow";
import {
  IMPORTANCE_LEGEND,
  type Importance,
  suggestImportanceFromWeights,
} from "../lib/relative";

type Step =
  | { view: "home" }
  | { view: "category"; category: string }
  | { view: "subcategory"; category: string; subcategory: string };

function emptyDraft(): ReviewerDraft {
  return {
    company: "",
    contact: "",
    spaceTypeId: "",
    subcategoryScores: {},
    questionScores: {},
  };
}

function reviewableQuestions(qs: Question[]): Question[] {
  return qs.filter((q) => classifyQuestion(q) !== "inventory");
}

function pct(scored: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((scored / total) * 100);
}

export function ReviewerApp() {
  const { catalog } = useAppData();
  const [draft, setDraft] = useState<ReviewerDraft>(
    () => loadReviewerDraft() ?? emptyDraft(),
  );
  const [focus, setFocus] = useState("");
  const [step, setStep] = useState<Step>({ view: "home" });
  const [showMissed, setShowMissed] = useState(true);

  useEffect(() => {
    saveReviewerDraft(draft);
  }, [draft]);

  const spaces = useMemo(() => {
    if (!catalog) return [];
    return catalog.spaceTypes
      .filter((s) => !focus || s.focusArea === focus)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, focus]);

  const space =
    draft.spaceTypeId && catalog
      ? findSpace(catalog, draft.spaceTypeId)
      : undefined;

  const categories = useMemo(() => {
    if (!catalog || !draft.spaceTypeId) return [];
    return categoriesForSpace(catalog, draft.spaceTypeId);
  }, [catalog, draft.spaceTypeId]);

  const progress = useMemo(() => {
    const missedSubs: Array<{ category: string; subcategory: string }> = [];
    const missedQuestionSets: Array<{
      category: string;
      subcategory: string;
      missingIds: string[];
      scored: number;
      total: number;
    }> = [];
    const categoriesStatus: Array<{
      category: string;
      subsTotal: number;
      subsScored: number;
      qSetsTotal: number;
      qSetsDone: number;
      complete: boolean;
    }> = [];
    let subTotal = 0;
    let subScored = 0;
    let qTotal = 0;
    let qScored = 0;

    if (!catalog || !draft.spaceTypeId) {
      return {
        missedSubs,
        missedQuestionSets,
        categoriesStatus,
        subTotal,
        subScored,
        qTotal,
        qScored,
        complete: false,
      };
    }

    for (const cat of categories) {
      const subs = subcategoriesFor(catalog, draft.spaceTypeId, cat);
      let catSubsScored = 0;
      let catQSets = 0;
      let catQDone = 0;

      for (const sub of subs) {
        subTotal++;
        const k = subcategoryScoreKey(draft.spaceTypeId, cat, sub);
        if (draft.subcategoryScores[k]?.importance != null) {
          subScored++;
          catSubsScored++;
        } else {
          missedSubs.push({ category: cat, subcategory: sub });
        }

        const qs = reviewableQuestions(
          questionsForSub(catalog, draft.spaceTypeId, cat, sub),
        );
        if (qs.length === 0) continue;
        catQSets++;
        const missing = qs.filter(
          (q) => draft.questionScores[q.key]?.importance == null,
        );
        qTotal += qs.length;
        qScored += qs.length - missing.length;
        if (missing.length === 0) {
          catQDone++;
        } else {
          missedQuestionSets.push({
            category: cat,
            subcategory: sub,
            missingIds: missing.map((q) => q.id),
            scored: qs.length - missing.length,
            total: qs.length,
          });
        }
      }

      categoriesStatus.push({
        category: cat,
        subsTotal: subs.length,
        subsScored: catSubsScored,
        qSetsTotal: catQSets,
        qSetsDone: catQDone,
        complete:
          subs.length > 0 &&
          catSubsScored === subs.length &&
          catQDone === catQSets,
      });
    }

    return {
      missedSubs,
      missedQuestionSets,
      categoriesStatus,
      subTotal,
      subScored,
      qTotal,
      qScored,
      complete:
        subTotal > 0 &&
        subScored === subTotal &&
        qTotal > 0 &&
        qScored === qTotal,
    };
  }, [
    catalog,
    draft.spaceTypeId,
    draft.subcategoryScores,
    draft.questionScores,
    categories,
  ]);

  if (!catalog) return null;

  function setSpace(id: string) {
    setDraft((d) => ({ ...d, spaceTypeId: id }));
    setStep({ view: "home" });
  }

  function seedSubcategoryScores(category: string) {
    if (!draft.spaceTypeId) return;
    const subs = subcategoriesFor(catalog, draft.spaceTypeId, category);
    const weights = subs.map((sub) => {
      const qs = questionsForSub(catalog, draft.spaceTypeId, category, sub);
      const scoring = qs.find((q) => typeof q.sw === "number");
      return scoring && typeof scoring.sw === "number" ? scoring.sw : null;
    });
    const suggested = suggestImportanceFromWeights(weights);
    setDraft((d) => {
      const next = { ...d.subcategoryScores };
      subs.forEach((sub, i) => {
        const key = subcategoryScoreKey(d.spaceTypeId, category, sub);
        if (!next[key]) {
          next[key] = { importance: suggested[i], comment: "" };
        }
      });
      return { ...d, subcategoryScores: next };
    });
  }

  function seedQuestionScores(category: string, subcategory: string) {
    if (!draft.spaceTypeId) return;
    const qs = reviewableQuestions(
      questionsForSub(catalog, draft.spaceTypeId, category, subcategory),
    );
    const weights = qs.map((q) => (typeof q.qw === "number" ? q.qw : null));
    const suggested = suggestImportanceFromWeights(weights);
    setDraft((d) => {
      const next = { ...d.questionScores };
      qs.forEach((q, i) => {
        if (!next[q.key]) {
          next[q.key] = { importance: suggested[i], comment: "" };
        }
      });
      return { ...d, questionScores: next };
    });
  }

  function openCategory(category: string) {
    seedSubcategoryScores(category);
    setStep({ view: "category", category });
  }

  function openSubcategory(category: string, subcategory: string) {
    seedQuestionScores(category, subcategory);
    setStep({ view: "subcategory", category, subcategory });
  }

  function download() {
    if (!draft.company.trim()) {
      alert("Enter a company name first.");
      return;
    }
    if (!draft.spaceTypeId) {
      alert("Select a space type to review.");
      return;
    }
    if (!progress.complete) {
      const missCount =
        progress.missedSubs.length + progress.missedQuestionSets.length;
      const ok = confirm(
        `You still have ${missCount} incomplete set(s). Download anyway?`,
      );
      if (!ok) return;
    }

    const subcategoryScores = Object.entries(draft.subcategoryScores)
      .filter(([, s]) => s.importance != null)
      .map(([key, s]) => {
        const [spaceTypeId, category, subcategory] = key.split("||");
        return {
          spaceTypeId,
          category,
          subcategory,
          importance: s.importance as Importance,
          comment: s.comment.trim() || undefined,
        };
      })
      .filter((row) => row.spaceTypeId === draft.spaceTypeId);

    const questionScores = Object.entries(draft.questionScores)
      .filter(([, s]) => s.importance != null)
      .map(([questionKey, s]) => ({
        questionKey,
        importance: s.importance as Importance,
        comment: s.comment.trim() || undefined,
      }))
      .filter((row) => {
        const q = catalog.questions.find((x) => x.key === row.questionKey);
        return q?.spaceTypeId === draft.spaceTypeId;
      });

    const out: CompanySuggestions = {
      version: 2,
      company: draft.company.trim(),
      contact: draft.contact.trim() || undefined,
      exportedAt: new Date().toISOString(),
      catalogGeneratedAt: catalog.meta.generatedAt,
      subcategoryScores,
      questionScores,
    };
    const slug = out.company.replace(/\s+/g, "-").toLowerCase();
    downloadJson(`suggestions-${slug}.json`, out);
  }

  const missCount =
    progress.missedSubs.length + progress.missedQuestionSets.length;

  return (
    <div>
      <div className="card">
        <h2>Company reviewer — relative importance (3 / 6 / 9 / 12)</h2>
        <div className="grid-2">
          <div className="field">
            <label>Company (required)</label>
            <input
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Contact (optional)</label>
            <input
              value={draft.contact}
              onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
            />
          </div>
        </div>
        <div className="filters" style={{ marginTop: "0.75rem" }}>
          <div className="field">
            <label>Focus area</label>
            <select
              value={focus}
              onChange={(e) => {
                setFocus(e.target.value);
                setSpace("");
              }}
            >
              <option value="">All</option>
              {catalog.focusAreas.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Space type (required)</label>
            <select
              value={draft.spaceTypeId}
              onChange={(e) => setSpace(e.target.value)}
            >
              <option value="">Select…</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="btn primary" onClick={download}>
            Download suggestions JSON
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (confirm("Clear local reviewer draft?")) {
                clearReviewerDraft();
                setDraft(emptyDraft());
                setStep({ view: "home" });
              }
            }}
          >
            Clear draft
          </button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>How to score</h3>
        <p className="muted" style={{ marginBottom: "0.65rem" }}>
          {IMPORTANCE_LEGEND}
        </p>
        <ol className="score-instructions">
          <li>
            Enter your company name and select one <strong>space type</strong> to review at a time.
          </li>
          <li>
            Open a <strong>category</strong>. Compare its subcategories to each other and assign each
            one <strong>3</strong>, <strong>6</strong>, <strong>9</strong>, or <strong>12</strong>{" "}
            (3 = least important in that set, 12 = most important). You can give the same score to
            more than one item if they are equally important.
          </li>
          <li>
            Inside each subcategory, open <strong>Score questions</strong>. Compare those questions
            only to each other and assign 3 / 6 / 9 / 12 the same way. Inventory items (weight{" "}
            <span className="mono">i</span>) are listed but not scored.
          </li>
          <li>
            Values may be prefilled from current catalog weights — change any that do not match your
            judgment. Optional comments are welcome.
          </li>
          <li>
            Use <strong>Review progress</strong> below to find anything still missing, then download
            your suggestions JSON when ready.
          </li>
        </ol>
      </div>

      {!draft.spaceTypeId && (
        <div className="callout info">Select a space type to start comparative scoring.</div>
      )}

      {draft.spaceTypeId && step.view === "home" && (
        <div className="card">
          <h3>{space?.name} — categories</h3>
          <p className="muted">
            Open a category to score its subcategories (3 / 6 / 9 / 12). Then open each subcategory to
            score questions.
          </p>
          <table className="data">
            <thead>
              <tr>
                <th>Category</th>
                <th className="num">Sub scores</th>
                <th className="num">Question sets</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {progress.categoriesStatus.map((st) => (
                <tr key={st.category}>
                  <td>{st.category}</td>
                  <td className="num">
                    {st.subsScored}/{st.subsTotal}
                  </td>
                  <td className="num">
                    {st.qSetsDone}/{st.qSetsTotal}
                  </td>
                  <td>
                    {st.complete ? (
                      <span className="pill scoring">Done</span>
                    ) : (
                      <span className="pill incomplete">Needs work</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => openCategory(st.category)}
                    >
                      {st.complete ? "Review" : "Continue"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {draft.spaceTypeId && step.view === "category" && (
        <CategoryCompare
          category={step.category}
          spaceTypeId={draft.spaceTypeId}
          spaceName={space?.name ?? ""}
          draft={draft}
          setDraft={setDraft}
          onBack={() => setStep({ view: "home" })}
          onOpenSub={(sub) => openSubcategory(step.category, sub)}
        />
      )}

      {draft.spaceTypeId && step.view === "subcategory" && (
        <QuestionCompare
          category={step.category}
          subcategory={step.subcategory}
          spaceTypeId={draft.spaceTypeId}
          spaceName={space?.name ?? ""}
          draft={draft}
          setDraft={setDraft}
          onBack={() => setStep({ view: "category", category: step.category })}
        />
      )}

      {draft.spaceTypeId && (
        <div className={`card tracker-card${progress.complete ? " tracker-done" : ""}`}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Review progress — {space?.name}</h3>
            {progress.complete ? (
              <span className="pill scoring">Complete</span>
            ) : (
              <span className="pill incomplete">{missCount} set(s) left</span>
            )}
          </div>

          <div className="tracker-bars" style={{ marginTop: "0.85rem" }}>
            <div className="tracker-bar-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Subcategory scores</span>
                <span className="mono">
                  {progress.subScored}/{progress.subTotal} ({pct(progress.subScored, progress.subTotal)}%)
                </span>
              </div>
              <div className="tracker-bar">
                <div
                  className="tracker-bar-fill"
                  style={{ width: `${pct(progress.subScored, progress.subTotal)}%` }}
                />
              </div>
            </div>
            <div className="tracker-bar-block">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Question scores</span>
                <span className="mono">
                  {progress.qScored}/{progress.qTotal} ({pct(progress.qScored, progress.qTotal)}%)
                </span>
              </div>
              <div className="tracker-bar">
                <div
                  className="tracker-bar-fill"
                  style={{ width: `${pct(progress.qScored, progress.qTotal)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: "0.85rem" }}>
            <button
              type="button"
              className="btn"
              onClick={() => setShowMissed((v) => !v)}
            >
              {showMissed ? "Hide missed list" : "Show missed list"}
            </button>
            {!progress.complete && progress.missedSubs[0] && (
              <button
                type="button"
                className="btn primary"
                onClick={() => openCategory(progress.missedSubs[0].category)}
              >
                Go to next missed subcategory set
              </button>
            )}
            {!progress.complete &&
              progress.missedSubs.length === 0 &&
              progress.missedQuestionSets[0] && (
                <button
                  type="button"
                  className="btn primary"
                  onClick={() =>
                    openSubcategory(
                      progress.missedQuestionSets[0].category,
                      progress.missedQuestionSets[0].subcategory,
                    )
                  }
                >
                  Go to next missed question set
                </button>
              )}
          </div>

          {showMissed && !progress.complete && (
            <div className="tracker-missed" style={{ marginTop: "1rem" }}>
              {progress.missedSubs.length > 0 && (
                <div style={{ marginBottom: "0.85rem" }}>
                  <h3 style={{ fontSize: "0.95rem" }}>
                    Missing subcategory scores ({progress.missedSubs.length})
                  </h3>
                  <p className="muted">
                    Open the category and assign 3 / 6 / 9 / 12 to each subcategory.
                  </p>
                  <ul className="missed-list">
                    {progress.missedSubs.map((m) => (
                      <li key={`${m.category}|${m.subcategory}`}>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => openCategory(m.category)}
                        >
                          {m.category} › {m.subcategory}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {progress.missedQuestionSets.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.95rem" }}>
                    Incomplete question sets ({progress.missedQuestionSets.length})
                  </h3>
                  <p className="muted">
                    These subcategories still have unscored questions (listed by ID).
                  </p>
                  <ul className="missed-list">
                    {progress.missedQuestionSets.map((m) => (
                      <li key={`q|${m.category}|${m.subcategory}`}>
                        <button
                          type="button"
                          className="linkish"
                          onClick={() => openSubcategory(m.category, m.subcategory)}
                        >
                          {m.category} › {m.subcategory}
                        </button>
                        <span className="muted">
                          {" "}
                          — {m.scored}/{m.total} scored · missing{" "}
                          <span className="mono">{m.missingIds.join(", ")}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {progress.complete && (
            <div className="callout info" style={{ marginTop: "0.85rem", marginBottom: 0 }}>
              All subcategory and question scores for this space type are filled in. You can
              download your suggestions JSON.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryCompare({
  category,
  spaceTypeId,
  spaceName,
  draft,
  setDraft,
  onBack,
  onOpenSub,
}: {
  category: string;
  spaceTypeId: string;
  spaceName: string;
  draft: ReviewerDraft;
  setDraft: (d: ReviewerDraft | ((prev: ReviewerDraft) => ReviewerDraft)) => void;
  onBack: () => void;
  onOpenSub: (sub: string) => void;
}) {
  const { catalog } = useAppData();
  if (!catalog) return null;
  const subs = subcategoriesFor(catalog, spaceTypeId, category);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Categories
        </button>
        <span className="muted">
          {spaceName} › {category}
        </span>
      </div>
      <h3>Score subcategories against each other</h3>
      <p className="muted">{IMPORTANCE_LEGEND}</p>
      <table className="data compare-table">
        <thead>
          <tr>
            <th>Subcategory</th>
            <th className="num">Questions</th>
            <th className="num">Current SW</th>
            <th>Importance (3 / 6 / 9 / 12 / custom)</th>
            <th>Comment</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {subs.map((sub) => {
            const key = subcategoryScoreKey(spaceTypeId, category, sub);
            const row = draft.subcategoryScores[key] ?? {
              importance: null,
              comment: "",
            };
            const qs = questionsForSub(catalog, spaceTypeId, category, sub);
            const sw: WeightValue =
              (qs.find((q) => typeof q.sw === "number")?.sw as number | undefined) ??
              qs.find((q) => q.sw != null)?.sw ??
              null;
            const rev = reviewableQuestions(qs);
            const qScored = rev.filter(
              (q) => draft.questionScores[q.key]?.importance != null,
            ).length;
            const missingSub = row.importance == null;
            return (
              <tr key={sub} className={missingSub ? "row-missed" : undefined}>
                <td>
                  <strong>{sub}</strong>
                  <div className="muted">
                    Question scores: {qScored}/{rev.length}
                    {missingSub ? " · subcategory unscored" : ""}
                  </div>
                </td>
                <td className="num">{qs.length}</td>
                <td className="num">{fmtWeight(sw)}</td>
                <td>
                  <ImportanceRadios
                    name={`sub-${key}`}
                    value={row.importance}
                    onChange={(importance) =>
                      setDraft((d) => ({
                        ...d,
                        subcategoryScores: {
                          ...d.subcategoryScores,
                          [key]: { ...row, importance },
                        },
                      }))
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.comment}
                    placeholder="Optional"
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        subcategoryScores: {
                          ...d.subcategoryScores,
                          [key]: {
                            importance: row.importance,
                            comment: e.target.value,
                          },
                        },
                      }))
                    }
                  />
                </td>
                <td>
                  <button type="button" className="btn" onClick={() => onOpenSub(sub)}>
                    Score questions
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuestionCompare({
  category,
  subcategory,
  spaceTypeId,
  spaceName,
  draft,
  setDraft,
  onBack,
}: {
  category: string;
  subcategory: string;
  spaceTypeId: string;
  spaceName: string;
  draft: ReviewerDraft;
  setDraft: (d: ReviewerDraft | ((prev: ReviewerDraft) => ReviewerDraft)) => void;
  onBack: () => void;
}) {
  const { catalog } = useAppData();
  if (!catalog) return null;
  const all = questionsForSub(catalog, spaceTypeId, category, subcategory);
  const qs = reviewableQuestions(all);
  const inventory = all.filter((q) => classifyQuestion(q) === "inventory");
  const missing = qs.filter((q) => draft.questionScores[q.key]?.importance == null);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button type="button" className="btn ghost" onClick={onBack}>
          ← Subcategories
        </button>
        <span className="muted">
          {spaceName} › {category} › {subcategory}
        </span>
      </div>
      <h3>Score questions against each other</h3>
      <p className="muted">{IMPORTANCE_LEGEND}</p>
      {missing.length > 0 ? (
        <div className="callout warn">
          Still missing scores for:{" "}
          <span className="mono">{missing.map((q) => q.id).join(", ")}</span>
        </div>
      ) : (
        <div className="callout info">All questions in this subcategory are scored.</div>
      )}

      {qs.map((q) => {
        const row = draft.questionScores[q.key] ?? {
          importance: null,
          comment: "",
        };
        const isMissed = row.importance == null;
        return (
          <div
            key={q.key}
            className="card"
            style={{
              background: "#fff",
              marginTop: "0.75rem",
              borderColor: isMissed ? "#e7b897" : undefined,
            }}
          >
            <div className="row" style={{ marginBottom: "0.35rem" }}>
              <span className="mono">{q.id}</span>
              <RolePill role={classifyQuestion(q)} />
              <span className="muted">Current QW {fmtWeight(q.qw)}</span>
              {isMissed && <span className="pill incomplete">Unscored</span>}
            </div>
            <p className="question-text" style={{ fontSize: "0.98rem", marginBottom: "0.65rem" }}>
              {q.text}
            </p>
            <div className="weight-grid" style={{ marginBottom: "0.75rem" }}>
              <div className="field">
                <label>Importance (3 / 6 / 9 / 12 / custom)</label>
                <ImportanceRadios
                  name={`q-${q.key}`}
                  value={row.importance}
                  onChange={(importance) =>
                    setDraft((d) => ({
                      ...d,
                      questionScores: {
                        ...d.questionScores,
                        [q.key]: { ...row, importance },
                      },
                    }))
                  }
                />
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Comment</label>
                <input
                  value={row.comment}
                  placeholder="Optional"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      questionScores: {
                        ...d.questionScores,
                        [q.key]: {
                          importance: row.importance,
                          comment: e.target.value,
                        },
                      },
                    }))
                  }
                />
              </div>
            </div>
            <PeerScoresPanel
              questionKey={q.key}
              title="Also asked / scored in other space types"
              compact
            />
          </div>
        );
      })}

      {inventory.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <h3>Inventory (not scored)</h3>
          <p className="muted">These use weight i and do not get a 3 / 6 / 9 / 12 importance score.</p>
          <ul className="muted">
            {inventory.map((q) => (
              <li key={q.key}>
                <span className="mono">{q.id}</span> — {q.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
