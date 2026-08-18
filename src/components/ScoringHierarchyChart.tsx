/** Visual guide of ESA scoring layers and typical counts (from requirements Sheet2). */

const LAYERS: Array<{
  name: string;
  madeOf?: string;
}> = [
  {
    name: "Building / site score",
    madeOf: "7–9 focus areas",
  },
  {
    name: "Focus area",
    madeOf: "1–6 space types",
  },
  {
    name: "Space type",
    madeOf: "~4 categories",
  },
  {
    name: "Category",
    madeOf: "2–4 subcategories",
  },
  {
    name: "Subcategory",
    madeOf: "1–10 questions",
  },
  {
    name: "Question",
  },
];

export function ScoringHierarchyChart() {
  return (
    <div className="hierarchy-chart" aria-label="Scoring hierarchy">
      {LAYERS.map((layer, i) => (
        <div key={layer.name} className="hierarchy-step">
          <div className={`hierarchy-node level-${i}`}>
            <span className="hierarchy-num">{i + 1}</span>
            <div className="hierarchy-copy">
              <span className="hierarchy-name">{layer.name}</span>
              {layer.madeOf && (
                <span className="hierarchy-madeof">
                  Built from {layer.madeOf}
                </span>
              )}
            </div>
          </div>
          {i < LAYERS.length - 1 && (
            <div className="hierarchy-connector" aria-hidden>
              <span className="hierarchy-line" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
