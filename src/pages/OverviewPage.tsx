import { Link } from "react-router-dom";
import { useAppData } from "../lib/DataContext";
import { overviewStats } from "../lib/hierarchy";
import { Stat } from "../components/Ui";

export function OverviewPage() {
  const { catalog, companies } = useAppData();
  if (!catalog) return null;
  const { byFocus, overall } = overviewStats(catalog);

  return (
    <div>
      <div className="stats">
        <Stat value={overall.total} label="Questions" />
        <Stat value={overall.scoring} label="Scoring" />
        <Stat value={overall.inventory} label="Inventory" />
        <Stat value={overall.blank} label="Blank" />
        <Stat
          value={overall.incomplete}
          label="Incomplete"
          warn={overall.incomplete > 0}
        />
        <Stat value={companies.length} label="Companies loaded" />
      </div>

      {overall.incomplete > 0 && (
        <div className="callout warn">
          {overall.incomplete} question(s) have partial weights and need to be filled in before
          they can score. Drill into Hierarchy or check public/data/quality-report.json.
        </div>
      )}

      <div className="card">
        <h2>By score focus area</h2>
        <p className="muted">
          School (AISD) → Focus Area → Space Type. Focus area and school are navigation only in
          v1 — weights are QW / SW / CW.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Focus area</th>
              <th className="num">Spaces</th>
              <th className="num">Questions</th>
              <th className="num">Scoring</th>
              <th className="num">Inventory</th>
              <th className="num">Blank</th>
              <th className="num">Incomplete</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {byFocus.map((f) => (
              <tr key={f.focusArea}>
                <td>{f.focusArea}</td>
                <td className="num">{f.spaces}</td>
                <td className="num">{f.total}</td>
                <td className="num">{f.scoring}</td>
                <td className="num">{f.inventory}</td>
                <td className="num">{f.blank}</td>
                <td className="num">{f.incomplete}</td>
                <td>
                  <Link
                    className="btn"
                    to={`/browse?focus=${encodeURIComponent(f.focusArea)}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>How scoring rolls up</h2>
        <p className="muted">
          Option scores are on a 0–1 scale. Subcategory = Σ(QW × questionScore) / Σ(QW). Category
          and space type use the same weighted average with SW and CW. Weight <strong>i</strong> =
          inventory (excluded). Blank = excluded. Incomplete = flagged until filled.
        </p>
        <p className="muted">
          Peer suggestions use the median QW/SW/CW from scoring peers in the same similarity group
          (exact text) plus any manual links — other space types only.
        </p>
      </div>

      <div className="card">
        <h2>Source</h2>
        <p className="muted">
          {catalog.meta.sourceFile} · generated {new Date(catalog.meta.generatedAt).toLocaleString()}{" "}
          · {catalog.spaceTypes.length} space types · {catalog.similarityGroups.length} auto
          similarity groups
        </p>
      </div>
    </div>
  );
}
