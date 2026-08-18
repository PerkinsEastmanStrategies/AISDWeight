import { useEffect, useState, type ReactNode } from "react";
import {
  IMPORTANCE_LEVELS,
  isPresetImportance,
  type Importance,
} from "../lib/relative";
import type { WeightEntry } from "../lib/hierarchyTypes";

export function ImportanceRadios({
  name,
  value,
  onChange,
}: {
  name: string;
  value: Importance | null;
  onChange: (v: Importance) => void;
}) {
  const isCustom = value != null && !isPresetImportance(value);
  const [customMode, setCustomMode] = useState(isCustom);
  const [customText, setCustomText] = useState(
    isCustom && value != null ? String(value) : "",
  );

  useEffect(() => {
    if (value != null && isPresetImportance(value)) {
      setCustomMode(false);
    } else if (value != null) {
      setCustomMode(true);
      setCustomText(String(value));
    }
  }, [value]);

  function selectPreset(level: Importance) {
    setCustomMode(false);
    onChange(level);
  }

  function selectCustom() {
    setCustomMode(true);
    const n = Number(customText);
    if (Number.isInteger(n) && n > 0) onChange(n);
  }

  function commitCustom(raw: string) {
    // Digits only — whole numbers
    const cleaned = raw.replace(/[^\d]/g, "");
    setCustomText(cleaned);
    if (!cleaned) return;
    const n = Number(cleaned);
    if (Number.isInteger(n) && n > 0) onChange(n);
  }

  return (
    <div
      className="importance-radios"
      role="radiogroup"
      aria-label="Weight 3, 6, 9, 12, or custom"
    >
      {IMPORTANCE_LEVELS.map((level) => (
        <label
          key={level}
          className={`imp-opt${!customMode && value === level ? " selected" : ""}`}
        >
          <input
            className="imp-radio"
            type="radio"
            name={name}
            value={level}
            checked={!customMode && value === level}
            onChange={() => selectPreset(level)}
          />
          {level}
        </label>
      ))}
      <div className={`imp-opt custom-opt${customMode ? " selected" : ""}`}>
        <label className="custom-radio-label">
          <input
            className="imp-radio"
            type="radio"
            name={name}
            value="custom"
            checked={customMode}
            onChange={selectCustom}
          />
          Custom
        </label>
        {customMode && (
          <input
            className="imp-custom-input"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="e.g. 8"
            value={customText}
            autoFocus
            onChange={(e) => commitCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "+" || e.key === "-") {
                e.preventDefault();
              }
            }}
            aria-label="Custom weight (whole number)"
          />
        )}
      </div>
    </div>
  );
}

export type PeerRow = {
  company: string;
  importance: Importance | null;
  comment?: string;
};

export type QuestionPreview = {
  id: string;
  text: string;
};

export function WeightEditorRow({
  id,
  label,
  color,
  badge,
  session,
  peers,
  questions,
  showInclude,
  onSessionChange,
}: {
  id: string;
  label: string;
  color?: string;
  badge?: ReactNode;
  session: WeightEntry;
  peers: PeerRow[];
  questions?: QuestionPreview[];
  showInclude?: boolean;
  onSessionChange: (patch: Partial<WeightEntry>) => void;
}) {
  const [openQs, setOpenQs] = useState(false);
  return (
    <div
      className="weight-row"
      style={
        color
          ? { borderColor: color, borderWidth: 2, boxShadow: `inset 3px 0 0 ${color}` }
          : undefined
      }
    >
      <div className="weight-row-head">
        <div className="weight-row-title">
          {color && (
            <span className="color-chip" style={{ background: color }} aria-hidden />
          )}
          <strong>{label}</strong>
          {badge}
        </div>
        {showInclude && (
          <label className="include-toggle">
            <input
              type="checkbox"
              checked={Boolean(session.includeInScore)}
              onChange={(e) =>
                onSessionChange({ includeInScore: e.target.checked })
              }
            />
            Include in score
          </label>
        )}
      </div>

      <div className="weight-row-grid">
        <div className="field">
          <label>Weight</label>
          <ImportanceRadios
            name={`session-${id}`}
            value={session.importance}
            onChange={(importance) =>
              onSessionChange({
                importance,
                includeInScore: showInclude ? true : session.includeInScore,
              })
            }
          />
        </div>
        <div className="field">
          <label>Note</label>
          <input
            value={session.comment}
            placeholder="Optional rationale"
            onChange={(e) => onSessionChange({ comment: e.target.value })}
          />
        </div>
      </div>

      {questions && questions.length > 0 && (
        <div className="question-dropdown">
          <button
            type="button"
            className="question-caret"
            aria-expanded={openQs}
            onClick={() => setOpenQs((v) => !v)}
          >
            <span className="caret">{openQs ? "▾" : "▸"}</span>
            {openQs ? "Hide" : "Show"} {questions.length} question
            {questions.length === 1 ? "" : "s"} in this section
          </button>
          {openQs && (
            <ul className="question-preview-list">
              {questions.map((q) => (
                <li key={q.id}>
                  <span className="mono">{q.id}</span>
                  <span>{q.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {peers.length > 0 && (
        <div className="peer-mini">
          <div className="muted" style={{ marginBottom: "0.35rem" }}>
            Previous reviewers
          </div>
          <table className="data compact">
            <thead>
              <tr>
                <th>Company</th>
                <th className="num">Weight</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {peers.map((p) => (
                <tr key={p.company}>
                  <td>{p.company}</td>
                  <td className="num">{p.importance ?? "—"}</td>
                  <td className="muted">{p.comment || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
