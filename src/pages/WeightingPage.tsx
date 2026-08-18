import { useEffect, useMemo, useState } from "react";
import { useAppData } from "../lib/DataContext";
import type {
  HierarchySpaceType,
  SchoolLevelId,
  WeightEntry,
} from "../lib/hierarchyTypes";
import {
  buildDonutSlices,
  categoriesForCatalogSpace,
  categoryKey,
  emptyWeightEntry,
  findFocusArea,
  findSpaceType,
  focusAreaKey,
  getSchoolLevel,
  isIncludedInRollup,
  questionsInCategory,
  questionsInSubcategory,
  schoolLevelReviewCounts,
  seedSessionForLevel,
  spaceTypeKey,
  subcategoryKey,
  subcategoriesForCatalogSpace,
  updateLinkedSuggestion,
  buildCompanySuggestionsV3,
} from "../lib/weighting";
import { submitWeightingToSupabase } from "../lib/submitWeighting";
import {
  clearWeightingSession,
  loadWeightingSession,
  saveWeightingSession,
} from "../lib/storage";
import { downloadJson } from "../lib/export";
import { type PeerRow } from "../components/WeightEditorRow";
import { ScoringHierarchyChart } from "../components/ScoringHierarchyChart";
import { WeightSetPanel } from "../components/WeightSetPanel";
import { ReviewTracker } from "../components/ReviewTracker";
import { IMPORTANCE_LEGEND } from "../lib/relative";

type LevelTab = "building" | "spaces" | "categories" | "subcategories";

type NavSelection = {
  focusArea?: string;
  spaceTypeId?: string;
  category?: string;
};

function peersForKey(
  companies: CompanySuggestionsV3[],
  schoolLevel: SchoolLevelId,
  bucket:
    | "focusAreaWeights"
    | "spaceTypeWeights"
    | "categoryWeights"
    | "subcategoryWeights",
  key: string,
): PeerRow[] {
  const out: PeerRow[] = [];
  for (const c of companies) {
    if (c.schoolLevel !== schoolLevel) continue;
    const hit = c[bucket]?.find((r) => r.key === key);
    if (hit) {
      out.push({
        company: c.company,
        importance: hit.importance,
        comment: hit.comment,
      });
    }
  }
  return out;
}

export function WeightingPage() {
  const { catalog, hierarchy, companiesV3 } = useAppData();
  const [session, setSession] = useState(loadWeightingSession);
  const [tab, setTab] = useState<LevelTab>("building");
  const [nav, setNav] = useState<NavSelection>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitKind, setSubmitKind] = useState<"info" | "warn">("info");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    saveWeightingSession(session);
  }, [session]);

  const level =
    hierarchy && session.schoolLevel
      ? getSchoolLevel(hierarchy, session.schoolLevel)
      : undefined;

  useEffect(() => {
    if (!hierarchy || !session.schoolLevel) return;
    const lv = getSchoolLevel(hierarchy, session.schoolLevel);
    if (!lv) return;
    setSession((s) => seedSessionForLevel(s, lv));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when level chosen
  }, [hierarchy, session.schoolLevel]);

  function chooseLevel(id: SchoolLevelId) {
    if (!hierarchy) return;
    const lv = getSchoolLevel(hierarchy, id);
    if (!lv) return;
    setSession((s) => seedSessionForLevel({ ...s, schoolLevel: id }, lv));
    setNav({});
    setTab("building");
    setExpanded({});
  }

  function patchSession(
    bucket:
      | "focusAreaWeights"
      | "spaceTypeWeights"
      | "categoryWeights"
      | "subcategoryWeights",
    key: string,
    patch: Partial<WeightEntry>,
  ) {
    setSession((s) => updateLinkedSuggestion(s, bucket, key, patch, true));
  }

  const buildingSlices = useMemo(() => {
    if (!level) return { slices: [], total: 0 };
    const items = level.focusAreas.map((fa) => {
      const key = focusAreaKey(level.id, fa.name);
      const entry = session.focusAreaWeights[key];
      return {
        key,
        label: fa.name,
        weight: entry?.importance ?? 0,
        included: isIncludedInRollup(entry, true),
        required: true as boolean | undefined,
      };
    });
    return buildDonutSlices(items);
  }, [level, session.focusAreaWeights]);

  const spaceSlices = useMemo(() => {
    if (!level || !nav.focusArea) return { slices: [], total: 0 };
    const fa = findFocusArea(level, nav.focusArea);
    if (!fa) return { slices: [], total: 0 };
    const items = fa.spaceTypes.map((st) => {
      const key = spaceTypeKey(st.id);
      const entry = session.spaceTypeWeights[key];
      return {
        key,
        label: st.name,
        weight: entry?.importance ?? 0,
        included: isIncludedInRollup(entry, st.required),
        required: st.required,
      };
    });
    return buildDonutSlices(items);
  }, [level, nav.focusArea, session.spaceTypeWeights]);

  const categorySlices = useMemo(() => {
    if (!catalog || !level || !nav.spaceTypeId) return { slices: [], total: 0 };
    const found = findSpaceType(level, nav.spaceTypeId);
    if (!found) return { slices: [], total: 0 };
    const cats = categoriesForCatalogSpace(
      catalog,
      found.spaceType.catalogSpaceTypeId,
    );
    const items = cats.map((cat) => {
      const key = categoryKey(nav.spaceTypeId!, cat);
      const entry = session.categoryWeights[key];
      return {
        key,
        label: cat,
        weight: entry?.importance ?? 0,
        included: isIncludedInRollup(entry, true),
      };
    });
    return buildDonutSlices(items);
  }, [catalog, level, nav.spaceTypeId, session.categoryWeights]);

  const subcategorySlices = useMemo(() => {
    if (!catalog || !level || !nav.spaceTypeId || !nav.category)
      return { slices: [], total: 0 };
    const found = findSpaceType(level, nav.spaceTypeId);
    if (!found) return { slices: [], total: 0 };
    const subs = subcategoriesForCatalogSpace(
      catalog,
      found.spaceType.catalogSpaceTypeId,
      nav.category,
    );
    const items = subs.map((sub) => {
      const key = subcategoryKey(nav.spaceTypeId!, nav.category!, sub);
      const entry = session.subcategoryWeights[key];
      return {
        key,
        label: sub,
        weight: entry?.importance ?? 0,
        included: isIncludedInRollup(entry, true),
      };
    });
    return buildDonutSlices(items);
  }, [
    catalog,
    level,
    nav.spaceTypeId,
    nav.category,
    session.subcategoryWeights,
  ]);

  function download() {
    if (!hierarchy || !level || !session.schoolLevel) {
      alert("Select a school level first.");
      return;
    }
    if (!session.company.trim()) {
      alert("Enter a company name first.");
      return;
    }
    const out = buildCompanySuggestionsV3(session, hierarchy, level);
    const slug = `${out.company}-${out.schoolLevel}`.replace(/\s+/g, "-").toLowerCase();
    downloadJson(`rollup-suggestions-${slug}.json`, out);
  }

  const globalProgress = useMemo(() => {
    if (!catalog || !level) return [];
    return schoolLevelReviewCounts(catalog, level, session);
  }, [catalog, level, session]);

  async function submit() {
    if (!session.company.trim()) {
      alert("Enter a company name first.");
      return;
    }
    if (!hierarchy || !level || !session.schoolLevel) {
      alert("Select a school level first.");
      return;
    }
    const remaining = globalProgress.reduce(
      (n, r) => n + Math.max(0, r.total - r.scored),
      0,
    );
    if (remaining > 0) {
      const ok = confirm(
        `You still have ${remaining} unreviewed item(s). Save this session to Supabase anyway?`,
      );
      if (!ok) return;
    }
    setSubmitting(true);
    setSubmitMsg("");
    try {
      const payload = buildCompanySuggestionsV3(session, hierarchy, level);
      const result = await submitWeightingToSupabase(payload, level);
      const submittedAt = payload.exportedAt;
      setSession((s) => ({ ...s, submittedAt }));
      setSubmitKind("info");
      setSubmitMsg(
        `Saved to Supabase at ${new Date(submittedAt).toLocaleString()} (${result.itemCount} weights).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Submit failed.";
      setSubmitKind("warn");
      setSubmitMsg(`Could not save to Supabase. ${message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!hierarchy) {
    return (
      <div className="callout warn">
        Site hierarchy missing. Run{" "}
        <span className="mono">npm run import-requirements</span>.
      </div>
    );
  }

  const selectedSpace: HierarchySpaceType | undefined =
    level && nav.spaceTypeId
      ? findSpaceType(level, nav.spaceTypeId)?.spaceType
      : undefined;

  return (
    <div className="weighting-page">
      <div className="card weighting-guide">
        <h2>How weighting works</h2>
        <div className="guide-grid">
          <div>
            <p>
              Scores roll <strong>upward</strong>. At every level you compare items in the same
              set and give each a relative weight of <strong>3</strong>, <strong>6</strong>,{" "}
              <strong>9</strong>, or <strong>12</strong> ({IMPORTANCE_LEGEND}).
            </p>
            <p>
              The donut shows share of the <em>parent</em> score. Add up the weights in the
              current set — that is the total. Each item’s slice is:
            </p>
            <p className="calc-formula mono">
              slice % = item weight ÷ sum of weights in this set × 100
            </p>
            <p>
              Example: if Studios is <strong>12</strong> and all focus-area weights add to{" "}
              <strong>60</strong>, Studios is <strong>20%</strong> of the building score
              (12 ÷ 60). Changing any weight in the set recalculates every slice.
            </p>
            <p className="muted">
              Not-required space types are shown but stay out of the total until you check{" "}
              <strong>Include in score</strong> (assigning a weight does this automatically).
              The weights you set here drive the donut and are what get submitted.
              Question-level weighting is shown in the hierarchy for context but is not edited
              on this screen.
            </p>
          </div>
          <div>
            <h3 style={{ marginTop: 0 }}>Scoring hierarchy</h3>
            <ScoringHierarchyChart />
          </div>
        </div>
      </div>

      <div className="card weighting-setup">
        <h2>Reviewer setup</h2>
        <p className="muted">
          Enter who is reviewing and which school level to weight. Use the left panel and top
          tabs to move through focus areas → space types → categories → subcategories.
        </p>
        <div className="grid-2">
          <div className="field">
            <label>Company (required for export)</label>
            <input
              value={session.company}
              onChange={(e) => setSession({ ...session, company: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Contact</label>
            <input
              value={session.contact}
              onChange={(e) => setSession({ ...session, contact: e.target.value })}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: "0.75rem", maxWidth: 280 }}>
          <label>School level</label>
          <select
            value={session.schoolLevel}
            onChange={(e) => {
              const v = e.target.value as SchoolLevelId | "";
              if (v) chooseLevel(v);
              else setSession({ ...session, schoolLevel: "" });
            }}
          >
            <option value="">Select…</option>
            {hierarchy.schoolLevels.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.id})
              </option>
            ))}
          </select>
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button
            type="button"
            className="btn primary"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
          <button type="button" className="btn" onClick={download}>
            Download JSON
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (confirm("Clear weighting session?")) {
                clearWeightingSession();
                setSession(loadWeightingSession());
                setNav({});
                setTab("building");
                setSubmitMsg("");
              }
            }}
          >
            Clear session
          </button>
        </div>
        {session.submittedAt && (
          <p className="muted" style={{ marginTop: "0.65rem", marginBottom: 0 }}>
            Last submitted {new Date(session.submittedAt).toLocaleString()}
          </p>
        )}
        {submitMsg && (
          <div
            className={`callout ${submitKind}`}
            style={{ marginTop: "0.75rem", marginBottom: 0 }}
          >
            {submitMsg}
          </div>
        )}
      </div>

      {!level ? (
        <div className="callout info">Select a school level to open the weighting workspace.</div>
      ) : (
        <div className="weighting-workspace">
          <aside className="weighting-nav card">
            <h3 style={{ marginTop: 0 }}>{level.label}</h3>
            <p className="muted" style={{ fontSize: "0.85rem" }}>
              Focus areas → space types
            </p>
            <ReviewTracker title="School-level progress" rows={globalProgress} />
            <ul className="tree" style={{ marginTop: "0.85rem" }}>
              {level.focusAreas.map((fa) => {
                const open = expanded[fa.name] ?? false;
                const activeFa = nav.focusArea === fa.name && !nav.spaceTypeId;
                return (
                  <li key={fa.name}>
                    <div className="tree-row">
                      <button
                        type="button"
                        className="tree-toggle"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [fa.name]: !open }))
                        }
                      >
                        {open ? "▾" : "▸"}
                      </button>
                      <button
                        type="button"
                        className={`tree-link${activeFa ? " active" : ""}`}
                        onClick={() => {
                          setNav({ focusArea: fa.name });
                          setTab("spaces");
                          setExpanded((e) => ({ ...e, [fa.name]: true }));
                        }}
                      >
                        {fa.name}
                      </button>
                    </div>
                    {open && (
                      <ul className="tree nested">
                        {fa.spaceTypes.map((st) => (
                          <li key={st.id}>
                            <button
                              type="button"
                              className={`tree-link${
                                nav.spaceTypeId === st.id ? " active" : ""
                              }`}
                              onClick={() => {
                                setNav({
                                  focusArea: fa.name,
                                  spaceTypeId: st.id,
                                });
                                setTab("categories");
                              }}
                            >
                              {st.name}
                              {!st.required && (
                                <span className="pill incomplete">N/R</span>
                              )}
                              {!st.catalogSpaceTypeId && (
                                <span className="pill incomplete">No survey</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="weighting-main">
            <div className="level-tabs card">
              {(
                [
                  ["building", "Building ← Focus areas"],
                  ["spaces", "Focus area ← Space types"],
                  ["categories", "Space type ← Categories"],
                  ["subcategories", "Category ← Subcategories"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "building" && (
              <WeightSetPanel
                title="Building score — focus area mix"
                description="Adjust how each focus area contributes to the overall building / site score."
                slices={buildingSlices.slices}
                total={buildingSlices.total}
                items={level.focusAreas.map((fa) => {
                  const key = focusAreaKey(level.id, fa.name);
                  const color =
                    buildingSlices.slices.find((s) => s.key === key)?.color ?? "#293678";
                  return {
                    id: key,
                    label: fa.name,
                    color,
                    session: session.focusAreaWeights[key] ?? emptyWeightEntry(),
                    peers: peersForKey(companiesV3, level.id, "focusAreaWeights", key),
                    onSessionChange: (p) => patchSession("focusAreaWeights", key, p),
                  };
                })}
                progressLabel="Focus areas"
              />
            )}

            {tab === "spaces" &&
              (!nav.focusArea ? (
                <div className="card weighting-panel">
                  <div className="callout info">
                    Select a focus area in the left panel to weight its space types.
                  </div>
                </div>
              ) : (
                <WeightSetPanel
                  title={`${nav.focusArea} — space type mix`}
                  description="Weights are relative within this focus area. Not-required space types are flagged; include them in the donut only when you choose to."
                  slices={spaceSlices.slices}
                  total={spaceSlices.total}
                  items={(findFocusArea(level, nav.focusArea)?.spaceTypes ?? []).map(
                    (st) => {
                      const key = spaceTypeKey(st.id);
                      const color =
                        spaceSlices.slices.find((s) => s.key === key)?.color ??
                        "#293678";
                      return {
                        id: key,
                        label: st.name,
                        color,
                        badge: !st.required ? (
                          <span className="pill incomplete" style={{ marginLeft: 8 }}>
                            Not required
                          </span>
                        ) : null,
                        session: session.spaceTypeWeights[key] ?? emptyWeightEntry(),
                        peers: peersForKey(
                          companiesV3,
                          level.id,
                          "spaceTypeWeights",
                          key,
                        ),
                        showInclude: !st.required,
                        onSessionChange: (p) =>
                          patchSession("spaceTypeWeights", key, p),
                      };
                    },
                  )}
                  progressLabel="Space types"
                />
              ))}

            {tab === "categories" &&
              (!selectedSpace ? (
                <div className="card weighting-panel">
                  <div className="callout info">
                    Select a space type in the left panel to weight its categories.
                  </div>
                </div>
              ) : !selectedSpace.catalogSpaceTypeId ? (
                <div className="card weighting-panel">
                  <div className="callout warn">
                    <strong>{selectedSpace.name}</strong> is in the school-level requirements
                    but does not yet have a matching survey in the uploaded catalog, so
                    categories are not available. You can still weight it at the space-type
                    level.
                  </div>
                </div>
              ) : (
                <WeightSetPanel
                  title={
                    <>
                      {selectedSpace.name} — category mix
                      {!selectedSpace.required && (
                        <span className="pill incomplete" style={{ marginLeft: 8 }}>
                          Not required
                        </span>
                      )}
                    </>
                  }
                  description="Categories come from the survey catalog for this space type."
                  slices={categorySlices.slices}
                  total={categorySlices.total}
                  items={categoriesForCatalogSpace(
                    catalog!,
                    selectedSpace.catalogSpaceTypeId,
                  ).map((cat) => {
                    const key = categoryKey(selectedSpace.id, cat);
                    const color =
                      categorySlices.slices.find((s) => s.key === key)?.color ??
                      "#293678";
                    return {
                      id: key,
                      label: cat,
                      color,
                      session: session.categoryWeights[key] ?? emptyWeightEntry(),
                      peers: peersForKey(
                        companiesV3,
                        level.id,
                        "categoryWeights",
                        key,
                      ),
                      questions: questionsInCategory(
                        catalog!,
                        selectedSpace.catalogSpaceTypeId,
                        cat,
                      ).map((q) => ({ id: q.id, text: q.text })),
                      onSessionChange: (p) => {
                        if (!session.categoryWeights[key]) {
                          patchSession("categoryWeights", key, {
                            importance: 6,
                            includeInScore: true,
                            ...p,
                          });
                        } else patchSession("categoryWeights", key, p);
                      },
                    };
                  })}
                  progressLabel="Categories"
                  footer={
                    <div className="row" style={{ marginTop: "1rem" }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          const cats = categoriesForCatalogSpace(
                            catalog!,
                            selectedSpace.catalogSpaceTypeId,
                          );
                          if (cats[0]) {
                            setNav((n) => ({ ...n, category: cats[0] }));
                            setTab("subcategories");
                          }
                        }}
                      >
                        Open first category → subcategories
                      </button>
                    </div>
                  }
                />
              ))}

            {tab === "subcategories" &&
              (!selectedSpace?.catalogSpaceTypeId ? (
                <div className="card weighting-panel">
                  <div className="callout info">
                    Select a catalog-matched space type, then a category, to weight
                    subcategories.
                  </div>
                </div>
              ) : (
                <>
                  <div className="card" style={{ marginBottom: "0.85rem" }}>
                    <div className="field" style={{ maxWidth: 360, marginBottom: 0 }}>
                      <label>Category</label>
                      <select
                        value={nav.category ?? ""}
                        onChange={(e) =>
                          setNav((n) => ({
                            ...n,
                            category: e.target.value || undefined,
                          }))
                        }
                      >
                        <option value="">Select category…</option>
                        {categoriesForCatalogSpace(
                          catalog!,
                          selectedSpace.catalogSpaceTypeId,
                        ).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {!nav.category ? (
                    <div className="callout info">Choose a category above.</div>
                  ) : (
                    <WeightSetPanel
                      title={`${selectedSpace.name} › ${nav.category} — subcategory mix`}
                      slices={subcategorySlices.slices}
                      total={subcategorySlices.total}
                      items={subcategoriesForCatalogSpace(
                        catalog!,
                        selectedSpace.catalogSpaceTypeId,
                        nav.category,
                      ).map((sub) => {
                        const key = subcategoryKey(
                          selectedSpace.id,
                          nav.category!,
                          sub,
                        );
                        const color =
                          subcategorySlices.slices.find((s) => s.key === key)
                            ?.color ?? "#293678";
                        return {
                          id: key,
                          label: sub,
                          color,
                          session:
                            session.subcategoryWeights[key] ?? emptyWeightEntry(),
                          peers: peersForKey(
                            companiesV3,
                            level.id,
                            "subcategoryWeights",
                            key,
                          ),
                          questions: questionsInSubcategory(
                            catalog!,
                            selectedSpace.catalogSpaceTypeId,
                            nav.category!,
                            sub,
                          ).map((q) => ({ id: q.id, text: q.text })),
                          onSessionChange: (p) =>
                            patchSession("subcategoryWeights", key, {
                              importance: 6,
                              includeInScore: true,
                              ...p,
                            }),
                        };
                      })}
                      progressLabel="Subcategories"
                    />
                  )}
                </>
              ))}
          </section>
        </div>
      )}
    </div>
  );
}
