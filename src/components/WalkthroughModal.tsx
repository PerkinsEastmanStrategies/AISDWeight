import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type WalkthroughTab =
  | "building"
  | "spaces"
  | "categories"
  | "subcategories";

export type WalkthroughNavSelect = "clear" | "focus" | "space" | "category";

export type WalkthroughStep = {
  id: string;
  title: string;
  target: string | null;
  extraTargets?: string[];
  tab?: WalkthroughTab;
  needsWorkspace?: boolean;
  navSelect?: WalkthroughNavSelect;
  dock?: "top" | "bottom";
  center?: boolean;
  body: ReactNode;
};

export const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    target: null,
    center: true,
    body: (
      <>
        <p>
          This page collects relative weights for the layers assessed in the AISD ESA
          assessments.
        </p>
        <p>
          There are <strong>three school levels to score</strong>: Elementary (ES),
          Middle School (MS), and High School (HS). You can submit one level at a time,
          or score all three levels and then submit.
        </p>
      </>
    ),
  },
  {
    id: "setup-inputs",
    title: "Your information",
    target: "setup-inputs",
    dock: "top",
    body: (
      <>
        <p>
          In <strong>Reviewer setup</strong>, enter <strong>Company</strong>,{" "}
          <strong>Name</strong>, and <strong>Email</strong>. All three are required
          before you can submit.
        </p>
      </>
    ),
  },
  {
    id: "setup-level",
    title: "Choose a school level",
    target: "setup-level",
    dock: "top",
    body: (
      <>
        <p>
          Use <strong>School level</strong> to open Elementary, Middle School, or High
          School. The workspace below shows only the level you select. You can switch
          levels anytime; progress for all three stays in the tracker in this card.
        </p>
      </>
    ),
  },
  {
    id: "score-weights",
    title: "How to score",
    target: "score-weights",
    tab: "building",
    needsWorkspace: true,
    dock: "top",
    body: (
      <>
        <p>
          Compare items in the same set and give each a relative weight. Prefer{" "}
          <strong>3 / 6 / 9 / 12</strong> (3 = lower importance, 12 = higher). Nothing
          is prefilled — you choose every weight.
        </p>
        <p>
          Choose <strong>Custom</strong> to enter another number. Custom weights can be
          as high as you like, but they must be <strong>whole numbers</strong> (no
          decimals).
        </p>
      </>
    ),
  },
  {
    id: "score-donut",
    title: "The donut and notes",
    target: "score-donut",
    tab: "building",
    needsWorkspace: true,
    dock: "bottom",
    body: (
      <>
        <p>
          The donut shows each item’s share of the parent: item weight ÷ sum of weights
          in this set. Changing any weight recalculates every slice.
        </p>
        <p>
          Not-required space types stay out of the donut until you check{" "}
          <strong>Include</strong> (assigning a weight does that automatically). Notes
          are optional.
        </p>
      </>
    ),
  },
  {
    id: "layer-tabs",
    title: "Choose the next layer",
    target: "layer-tabs",
    tab: "building",
    needsWorkspace: true,
    dock: "bottom",
    body: (
      <>
        <p>
          Use these four buttons to pick the next layer of weighting. Start with{" "}
          <strong>Building Score</strong> (Focus Area), then move down to{" "}
          <strong>Focus Area</strong> (Space Type), <strong>Space Type</strong>{" "}
          (Category), and <strong>Category</strong> (Subcategory).
        </p>
        <p>
          Each layer’s weights roll up into the score of the layer above.
        </p>
      </>
    ),
  },
  {
    id: "nav-spaces-pick",
    title: "Choose a focus area",
    target: "nav-spaces",
    tab: "spaces",
    needsWorkspace: true,
    navSelect: "clear",
    dock: "top",
    body: (
      <>
        <p>
          Open the <strong>Focus Area</strong> layer (Space Type). Pick a focus area
          from this pill row.
        </p>
        <p>
          Start with <strong>Building Score</strong> (Focus Area) if you have not
          weighted the focus areas yet.
        </p>
      </>
    ),
  },
  {
    id: "nav-spaces-score",
    title: "Weight the space types",
    target: "score-weights",
    tab: "spaces",
    needsWorkspace: true,
    navSelect: "focus",
    dock: "top",
    body: (
      <>
        <p>
          After you choose a focus area, this table is where you score its space types
          against each other (3 / 6 / 9 / 12 or Custom).
        </p>
      </>
    ),
  },
  {
    id: "nav-categories-pick",
    title: "Choose a space type",
    target: "nav-categories",
    tab: "categories",
    needsWorkspace: true,
    navSelect: "clear",
    dock: "bottom",
    body: (
      <>
        <p>
          Open the <strong>Space Type</strong> layer (Category). The table headers are
          focus areas and are not clickable. Click a space type in a column to open
          that space’s categories.
        </p>
      </>
    ),
  },
  {
    id: "nav-categories-score",
    title: "Weight the categories",
    target: "score-weights",
    tab: "categories",
    needsWorkspace: true,
    navSelect: "space",
    dock: "top",
    body: (
      <>
        <p>
          After you choose a space type, this table is where you score its categories
          against each other.
        </p>
      </>
    ),
  },
  {
    id: "nav-subcategories-pick",
    title: "Choose a category",
    target: "nav-category-select",
    tab: "subcategories",
    needsWorkspace: true,
    navSelect: "space",
    dock: "top",
    body: (
      <>
        <p>
          Open the <strong>Category</strong> layer (Subcategory), then pick a category
          from this dropdown to open that set of subcategories.
        </p>
      </>
    ),
  },
  {
    id: "nav-subcategories-score",
    title: "Weight the subcategories",
    target: "score-panel",
    tab: "subcategories",
    needsWorkspace: true,
    navSelect: "category",
    dock: "top",
    body: (
      <>
        <p>
          After you choose a category, this table is where you score its subcategories
          against each other.
        </p>
      </>
    ),
  },
  {
    id: "progress-level",
    title: "This school level’s progress",
    target: "progress-left",
    tab: "building",
    needsWorkspace: true,
    dock: "bottom",
    body: (
      <>
        <p>
          The left panel shows completion for the school level you are on: focus areas,
          space types, categories, and subcategories.
        </p>
      </>
    ),
  },
  {
    id: "progress-overall",
    title: "Progress across school levels",
    target: "progress-setup",
    dock: "bottom",
    body: (
      <>
        <p>
          Reviewer setup also tracks all three school levels, so you can see whether
          Elementary, Middle School, and High School still need work.
        </p>
      </>
    ),
  },
  {
    id: "submit",
    title: "Submit",
    target: "submit-actions",
    dock: "top",
    body: (
      <>
        <p>
          When you are ready, click <strong>Submit</strong>. You can submit one school
          level at a time, or score all three levels and then submit.
        </p>
        <p>
          If some items are still blank, you will be asked to confirm. Download JSON is
          optional. Use <strong>How to use</strong> at the top anytime to replay these
          steps.
        </p>
      </>
    ),
  },
];

type WalkthroughContextValue = {
  open: boolean;
  step: WalkthroughStep | null;
};

const WalkthroughContext = createContext<WalkthroughContextValue>({
  open: false,
  step: null,
});

export function useWalkthroughTour() {
  return useContext(WalkthroughContext);
}

function clearSpotlights() {
  document.querySelectorAll(".walkthrough-spotlight").forEach((el) => {
    el.classList.remove("walkthrough-spotlight");
  });
}

function applySpotlight(
  target: string | null,
  extraTargets: string[] = [],
  dock: "top" | "bottom" = "bottom",
) {
  clearSpotlights();
  const tried = (target ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let first: HTMLElement | null = null;
  for (const id of tried) {
    const el = document.querySelector(`[data-walkthrough="${id}"]`);
    if (el instanceof HTMLElement) {
      first = el;
      break;
    }
  }
  const extras = extraTargets
    .map((id) => document.querySelector(`[data-walkthrough="${id}"]`))
    .filter((el): el is HTMLElement => el instanceof HTMLElement);
  for (const el of [first, ...extras]) {
    el?.classList.add("walkthrough-spotlight");
  }
  first?.scrollIntoView({
    behavior: "smooth",
    block: dock === "top" ? "end" : "start",
    inline: "nearest",
  });
}

export function WalkthroughModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const [step, setStep] = useState(0);
  const current = WALKTHROUGH_STEPS[step] ?? null;
  const last = step === WALKTHROUGH_STEPS.length - 1;

  useEffect(() => {
    if (open) setStep(0);
    else clearSpotlights();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !current) {
      clearSpotlights();
      return;
    }
    const shine = () =>
      applySpotlight(current.target, current.extraTargets, current.dock ?? "bottom");
    const timer = window.setTimeout(shine, 220);
    window.addEventListener("walkthrough-respotlight", shine);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("walkthrough-respotlight", shine);
      clearSpotlights();
    };
  }, [open, current]);

  return (
    <WalkthroughContext.Provider value={{ open, step: open ? current : null }}>
      {children}
      {open && current ? (
        <div
          className={`walkthrough-overlay${
            current.center
              ? " is-center"
              : current.dock === "top"
                ? " is-docked-top"
                : " is-docked"
          }`}
          role="presentation"
        >
          <div
            className="walkthrough-dialog card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkthrough-title"
          >
            <p className="muted walkthrough-kicker">
              Step {step + 1} of {WALKTHROUGH_STEPS.length}
            </p>
            <h2 id="walkthrough-title" style={{ marginTop: 0 }}>
              {current.title}
            </h2>
            <div className="walkthrough-body">{current.body}</div>
            <div className="walkthrough-dots" role="tablist" aria-label="Walkthrough steps">
              {WALKTHROUGH_STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={i === step ? "active" : ""}
                  aria-label={s.title}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                />
              ))}
            </div>
            <div className="row walkthrough-actions">
              <button type="button" className="btn" onClick={onClose}>
                Skip
              </button>
              <div className="row" style={{ marginLeft: "auto", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn"
                  disabled={step === 0}
                  onClick={() => setStep((n) => Math.max(0, n - 1))}
                >
                  Back
                </button>
                {last ? (
                  <button type="button" className="btn primary" onClick={onClose}>
                    Done
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() =>
                      setStep((n) => Math.min(WALKTHROUGH_STEPS.length - 1, n + 1))
                    }
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </WalkthroughContext.Provider>
  );
}
