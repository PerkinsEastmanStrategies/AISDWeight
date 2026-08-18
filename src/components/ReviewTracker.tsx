import type { ReviewCount } from "../lib/weighting";

function pct(scored: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((scored / total) * 100);
}

export function ReviewTracker({
  title,
  rows,
}: {
  title: string;
  rows: ReviewCount[];
}) {
  return (
    <div className="review-tracker">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      <div className="tracker-bars" style={{ marginTop: "0.65rem" }}>
        {rows.map((row) => (
          <div key={row.label} className="tracker-bar-block">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="muted">{row.label}</span>
              <span className="mono">
                {row.scored}/{row.total} ({pct(row.scored, row.total)}%)
              </span>
            </div>
            <div className="tracker-bar">
              <div
                className="tracker-bar-fill"
                style={{ width: `${pct(row.scored, row.total)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
