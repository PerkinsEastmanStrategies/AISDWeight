import { useMemo } from "react";
import type { Catalog } from "../lib/types";
import type { SiteHierarchy } from "../lib/hierarchyTypes";
import {
  formatCountRange,
  hierarchyLayerRanges,
} from "../lib/weighting";

export function ScoringHierarchyChart({
  catalog,
  hierarchy,
}: {
  catalog: Catalog;
  hierarchy: SiteHierarchy;
}) {
  const layers = useMemo(() => {
    const ranges = hierarchyLayerRanges(catalog, hierarchy);
    return [
      {
        name: "Building / site score",
        madeOf: formatCountRange(ranges.focusAreasPerLevel, "focus area"),
      },
      {
        name: "Focus area",
        madeOf: formatCountRange(ranges.spaceTypesPerFocus, "space type"),
      },
      {
        name: "Space type",
        madeOf: formatCountRange(ranges.categoriesPerSpace, "category", "categories"),
      },
      {
        name: "Category",
        madeOf: formatCountRange(
          ranges.subcategoriesPerCategory,
          "subcategory",
          "subcategories",
        ),
      },
      {
        name: "Subcategory",
        madeOf: formatCountRange(ranges.questionsPerSubcategory, "question"),
      },
      {
        name: "Question",
      },
    ];
  }, [catalog, hierarchy]);

  return (
    <div className="hierarchy-chart" aria-label="Scoring hierarchy">
      {layers.map((layer, i) => (
        <div key={layer.name} className="hierarchy-step">
          <div className={`hierarchy-node level-${i}`}>
            <span className="hierarchy-num">{i + 1}</span>
            <div className="hierarchy-copy">
              <span className="hierarchy-name">{layer.name}</span>
              {layer.madeOf && (
                <span className="hierarchy-madeof">Built from {layer.madeOf}</span>
              )}
            </div>
          </div>
          {i < layers.length - 1 && (
            <div className="hierarchy-connector" aria-hidden>
              <span className="hierarchy-line" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
