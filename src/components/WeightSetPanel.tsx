import type { ReactNode } from "react";
import type { DonutSlice } from "../lib/weighting";
import type { WeightEntry } from "../lib/hierarchyTypes";
import { DonutChart } from "./DonutChart";
import {
  ImportanceRadios,
  type PeerRow,
  type QuestionPreview,
} from "./WeightEditorRow";
import { ReviewTracker } from "./ReviewTracker";
import { isReviewed } from "../lib/weighting";

export type WeightSetItem = {
  id: string;
  label: string;
  color: string;
  badge?: ReactNode;
  session: WeightEntry;
  peers: PeerRow[];
  questions?: QuestionPreview[];
  showInclude?: boolean;
  onSessionChange: (patch: Partial<WeightEntry>) => void;
};

export function WeightSetPanel({
  title,
  description,
  slices,
  total,
  items,
  progressLabel,
  footer,
}: {
  title: ReactNode;
  description?: ReactNode;
  slices: DonutSlice[];
  total: number;
  items: WeightSetItem[];
  progressLabel: string;
  footer?: ReactNode;
}) {
  const scored = items.filter((i) => isReviewed(i.session)).length;

  return (
    <div className="card weighting-panel">
      <div className="weight-panel-head">
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {description && <p className="muted">{description}</p>}
        </div>
      </div>

      <ReviewTracker
        title="This set"
        rows={[{ label: progressLabel, scored, total: items.length }]}
      />

      <div className="donut-panel" data-walkthrough="score-donut">
        <DonutChart title={typeof title === "string" ? title : "Weight mix"} slices={slices} total={total} />
      </div>

      <div className="weight-table-wrap" data-walkthrough="score-weights">
        <table className="data weight-compact-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Weight</th>
              <th>Note</th>
              <th className="num">%</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const slice = slices.find((s) => s.key === item.id);
              const pct =
                slice && slice.included && slice.weight > 0
                  ? `${slice.pct.toFixed(1)}%`
                  : "—";
              return (
                <tr key={item.id}>
                  <td>
                    <div className="compact-item">
                      <span
                        className="color-chip"
                        style={{ background: item.color }}
                        aria-hidden
                      />
                      <div>
                        <strong>{item.label}</strong>
                        {item.badge}
                        {item.showInclude && (
                          <label className="include-toggle compact">
                            <input
                              type="checkbox"
                              checked={Boolean(item.session.includeInScore)}
                              onChange={(e) =>
                                item.onSessionChange({
                                  includeInScore: e.target.checked,
                                })
                              }
                            />
                            Include
                          </label>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <ImportanceRadios
                      name={`tbl-session-${item.id}`}
                      value={item.session.importance}
                      onChange={(importance) =>
                        item.onSessionChange({
                          importance,
                          includeInScore: item.showInclude
                            ? true
                            : item.session.includeInScore,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="compact-note"
                      value={item.session.comment}
                      placeholder="Note"
                      onChange={(e) =>
                        item.onSessionChange({ comment: e.target.value })
                      }
                    />
                  </td>
                  <td className="num mono">{pct}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {footer}
    </div>
  );
}
