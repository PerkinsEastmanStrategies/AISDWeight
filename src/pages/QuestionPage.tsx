import { Link, useParams } from "react-router-dom";
import { useAppData } from "../lib/DataContext";
import { findSpace, SCHOOL_NAME } from "../lib/hierarchy";
import { suggestFromPeers } from "../lib/similarity";
import {
  classifyQuestion,
  fmtWeight,
  missingWeightFields,
} from "../lib/weights";
import { RolePill } from "../components/Ui";
import { PeerScoresPanel } from "../components/PeerScores";
import type { WeightValue } from "../lib/types";

function delta(current: WeightValue, suggested: WeightValue): string {
  if (typeof current !== "number" || typeof suggested !== "number") return "—";
  const d = suggested - current;
  if (d === 0) return "0";
  return d > 0 ? `+${d}` : String(d);
}

export function QuestionPage() {
  const { questionKey: rawKey } = useParams();
  const questionKey = rawKey ? decodeURIComponent(rawKey) : "";
  const { catalog, overrides, companies } = useAppData();

  if (!catalog) return null;
  const q = catalog.questions.find((x) => x.key === questionKey);
  if (!q) {
    return (
      <div className="card">
        <h2>Question not found</h2>
        <Link to="/browse">Back to browse</Link>
      </div>
    );
  }

  const space = findSpace(catalog, q.spaceTypeId);
  const role = classifyQuestion(q);
  const peer = suggestFromPeers(catalog, q.key, overrides);
  const companyRows = companies.flatMap((c) => {
    const s = c.questionScores.find((x) => x.questionKey === q.key);
    const sub = c.subcategoryScores.find(
      (x) =>
        x.spaceTypeId === q.spaceTypeId &&
        x.category === q.category &&
        x.subcategory === q.subcategory,
    );
    if (!s && !sub) return [];
    return [{ company: c.company, s, sub }];
  });

  const levels = [
    ...new Set(q.options.map((o) => o.schoolLevel).filter(Boolean) as string[]),
  ];

  return (
    <div>
      <nav className="breadcrumb">
        <Link to="/browse">{SCHOOL_NAME}</Link>
        <span className="sep">/</span>
        {space && (
          <>
            <Link to={`/browse?focus=${encodeURIComponent(space.focusArea)}`}>
              {space.focusArea}
            </Link>
            <span className="sep">/</span>
            <Link
              to={`/browse?focus=${encodeURIComponent(space.focusArea)}&space=${encodeURIComponent(space.id)}`}
            >
              {space.name}
            </Link>
            <span className="sep">/</span>
            <Link
              to={`/browse?focus=${encodeURIComponent(space.focusArea)}&space=${encodeURIComponent(space.id)}&category=${encodeURIComponent(q.category)}`}
            >
              {q.category}
            </Link>
            <span className="sep">/</span>
            <Link
              to={`/browse?focus=${encodeURIComponent(space.focusArea)}&space=${encodeURIComponent(space.id)}&category=${encodeURIComponent(q.category)}&sub=${encodeURIComponent(q.subcategory)}`}
            >
              {q.subcategory}
            </Link>
            <span className="sep">/</span>
          </>
        )}
        <span className="here">{q.id}</span>
      </nav>

      <div className="row" style={{ marginBottom: "0.75rem" }}>
        <RolePill role={role} />
        <span className="pill">{q.type || "—"}</span>
        <span className="pill">{q.schoolLevel}</span>
        {peer.peerCount > 0 && <span className="pill">{peer.peerCount} peer(s)</span>}
      </div>

      <p className="question-text">{q.text}</p>
      {q.context && <p className="muted">Context: {q.context}</p>}

      {role === "incomplete" && (
        <div className="callout warn">
          Incomplete weights — fill in: {missingWeightFields(q).join(", ")}. Excluded from score
          until complete.
        </div>
      )}
      {role === "blank" && (
        <div className="callout info">
          All weight fields are blank — noted and excluded from scoring.
        </div>
      )}
      {role === "inventory" && (
        <div className="callout info">
          Inventory question (QW = i). Does not contribute to the score.
        </div>
      )}

      <div className="weight-grid">
        <div className="weight-box">
          <div className="w-label">Question weight</div>
          <div className="w-value">{fmtWeight(q.qw)}</div>
        </div>
        <div className="weight-box">
          <div className="w-label">Subcategory weight</div>
          <div className="w-value">{fmtWeight(q.sw)}</div>
        </div>
        <div className="weight-box">
          <div className="w-label">Category weight</div>
          <div className="w-value">{fmtWeight(q.cw)}</div>
        </div>
      </div>

      <PeerScoresPanel questionKey={q.key} />

      <div className="grid-2">
        <div className="card">
          <h3>Suggested from peers</h3>
          <p className="muted">
            Median of scoring peers in other space types (auto similarity + manual links).
          </p>
          {peer.peerCount === 0 ? (
            <p className="muted">No scoring peers linked yet.</p>
          ) : (
            <>
              <div className="weight-grid">
                <div className="weight-box">
                  <div className="w-label">Suggested QW</div>
                  <div className="w-value">{peer.qw ?? "—"}</div>
                  {peer.conflictQw && <div className="conflict">Wide peer spread</div>}
                </div>
                <div className="weight-box">
                  <div className="w-label">Suggested SW</div>
                  <div className="w-value">{peer.sw ?? "—"}</div>
                  {peer.conflictSw && <div className="conflict">Wide peer spread</div>}
                </div>
                <div className="weight-box">
                  <div className="w-label">Suggested CW</div>
                  <div className="w-value">{peer.cw ?? "—"}</div>
                  {peer.conflictCw && <div className="conflict">Wide peer spread</div>}
                </div>
              </div>
              <p className="muted">
                Δ vs current: QW {delta(q.qw, peer.qw)} · SW {delta(q.sw, peer.sw)} · CW{" "}
                {delta(q.cw, peer.cw)}
              </p>
            </>
          )}
        </div>

        <div className="card">
          <h3>Company suggestions (3 / 6 / 9 / 12)</h3>
          {companyRows.length === 0 ? (
            <p className="muted">
              No imported company suggestions for this question. Use Import / Export to load files.
            </p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="num">Question importance</th>
                  <th className="num">Subcategory importance</th>
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {companyRows.map(({ company, s, sub }) => (
                  <tr key={company}>
                    <td>{company}</td>
                    <td className="num">{s?.importance ?? "—"}</td>
                    <td className="num">{sub?.importance ?? "—"}</td>
                    <td>{s?.comment || sub?.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Response options (0–1)</h3>
        {levels.length > 1 ? (
          levels.map((level) => (
            <div key={level} style={{ marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "0.95rem" }}>{level}</h3>
              <OptionTable options={q.options.filter((o) => o.schoolLevel === level)} />
            </div>
          ))
        ) : (
          <OptionTable options={q.options} />
        )}
      </div>
    </div>
  );
}

function OptionTable({
  options,
}: {
  options: Array<{ scoreId: string; label: string; score: number | null }>;
}) {
  return (
    <table className="data">
      <thead>
        <tr>
          <th>Score ID</th>
          <th>Option</th>
          <th className="num">Score</th>
        </tr>
      </thead>
      <tbody>
        {options.map((o, i) => (
          <tr key={`${o.scoreId}-${i}`}>
            <td className="mono">{o.scoreId}</td>
            <td>{o.label}</td>
            <td className="num">{o.score === null ? "—" : o.score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
