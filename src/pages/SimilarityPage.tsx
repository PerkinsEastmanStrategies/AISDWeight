import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../lib/DataContext";
import { findQuestion, findSpace } from "../lib/hierarchy";
import { downloadJson } from "../lib/export";
import type { SimilarityOverrides } from "../lib/types";

export function SimilarityPage() {
  const { catalog, overrides, setOverrides } = useAppData();
  const [filter, setFilter] = useState("");
  const [linkA, setLinkA] = useState("");
  const [linkB, setLinkB] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const questionOptions = useMemo(() => {
    if (!catalog) return [];
    return catalog.questions
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((q) => {
        const sp = findSpace(catalog, q.spaceTypeId);
        return {
          key: q.key,
          label: `${q.id} — ${sp?.name ?? ""} — ${q.text.slice(0, 70)}`,
        };
      });
  }, [catalog]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return questionOptions.slice(0, 80);
    return questionOptions.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 80);
  }, [questionOptions, search]);

  if (!catalog) return null;

  const groups = catalog.similarityGroups.filter((g) => {
    if (!filter.trim()) return true;
    const f = filter.toLowerCase();
    return (
      g.sampleText.toLowerCase().includes(f) ||
      g.questionKeys.some((k) => k.toLowerCase().includes(f))
    );
  });

  function addLink() {
    if (!linkA || !linkB || linkA === linkB) {
      alert("Pick two different questions.");
      return;
    }
    const exists = overrides.manualLinks.some(
      (l) =>
        (l.a === linkA && l.b === linkB) || (l.a === linkB && l.b === linkA),
    );
    if (exists) {
      alert("That link already exists.");
      return;
    }
    const next: SimilarityOverrides = {
      manualLinks: [
        ...overrides.manualLinks,
        { a: linkA, b: linkB, note: note.trim() || undefined },
      ],
    };
    setOverrides(next);
    setNote("");
  }

  function removeLink(i: number) {
    const next: SimilarityOverrides = {
      manualLinks: overrides.manualLinks.filter((_, idx) => idx !== i),
    };
    setOverrides(next);
  }

  function exportOverrides() {
    downloadJson("similarity-overrides.json", overrides);
  }

  async function importOverridesFile(file: File) {
    const text = await file.text();
    const data = JSON.parse(text) as SimilarityOverrides;
    if (!data || !Array.isArray(data.manualLinks)) {
      alert("Invalid overrides file.");
      return;
    }
    setOverrides(data);
  }

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h2>Manual similarity links (optional)</h2>
            <p className="muted" style={{ margin: 0 }}>
              Matching questions already appear under each question in Hierarchy and Reviewer. Use
              this only to link near-duplicates that are not exact text matches ({catalog.similarityGroups.length}{" "}
              auto groups already exist).
            </p>
          </div>
          <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Manage links"}
          </button>
        </div>
      </div>

      {open && (
        <>
      <div className="card">
        <h2>Similarity manager</h2>
        <p className="muted">
          Auto groups use normalized exact question text. Add manual links for near-duplicates.
          Overrides save in this browser; download the JSON to keep a copy.
        </p>
        <div className="row">
          <button type="button" className="btn primary" onClick={exportOverrides}>
            Download overrides JSON
          </button>
          <label className="btn">
            Load overrides JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importOverridesFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Add manual link</h3>
        <div className="field" style={{ marginBottom: "0.75rem" }}>
          <label>Search questions</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by id, space, or text…"
          />
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Question A</label>
            <select value={linkA} onChange={(e) => setLinkA(e.target.value)}>
              <option value="">Select…</option>
              {filteredOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Question B</label>
            <select value={linkB} onChange={(e) => setLinkB(e.target.value)}>
              <option value="">Select…</option>
              {filteredOptions.map((o) => (
                <option key={`b-${o.key}`} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ marginTop: "0.75rem" }}>
          <label>Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button type="button" className="btn primary" onClick={addLink}>
            Link questions
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Manual links ({overrides.manualLinks.length})</h3>
        {overrides.manualLinks.length === 0 ? (
          <p className="muted">No manual links yet.</p>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>A</th>
                <th>B</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {overrides.manualLinks.map((l, i) => {
                const a = findQuestion(catalog, l.a);
                const b = findQuestion(catalog, l.b);
                return (
                  <tr key={`${l.a}-${l.b}-${i}`}>
                    <td>
                      <Link to={`/question/${encodeURIComponent(l.a)}`}>
                        {a?.id ?? l.a}
                      </Link>
                      <div className="muted">{a?.text.slice(0, 60)}</div>
                    </td>
                    <td>
                      <Link to={`/question/${encodeURIComponent(l.b)}`}>
                        {b?.id ?? l.b}
                      </Link>
                      <div className="muted">{b?.text.slice(0, 60)}</div>
                    </td>
                    <td>{l.note || "—"}</td>
                    <td>
                      <button type="button" className="btn" onClick={() => removeLink(i)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Auto groups</h3>
        <div className="field" style={{ marginBottom: "0.75rem", maxWidth: 360 }}>
          <label>Filter</label>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search group text or keys…"
          />
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Sample question</th>
              <th className="num">Members</th>
              <th>Space types</th>
            </tr>
          </thead>
          <tbody>
            {groups.slice(0, 60).map((g) => {
              const spaces = [
                ...new Set(
                  g.questionKeys.map((k) => {
                    const q = findQuestion(catalog, k);
                    return q ? findSpace(catalog, q.spaceTypeId)?.name : null;
                  }).filter(Boolean),
                ),
              ];
              return (
                <tr key={g.id}>
                  <td>
                    {g.sampleText.slice(0, 120)}
                    {g.sampleText.length > 120 ? "…" : ""}
                    <div className="muted">
                      <Link to={`/question/${encodeURIComponent(g.questionKeys[0])}`}>
                        Open first
                      </Link>
                    </div>
                  </td>
                  <td className="num">{g.questionKeys.length}</td>
                  <td className="muted">{spaces.slice(0, 6).join(", ")}{spaces.length > 6 ? "…" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {groups.length > 60 && (
          <p className="muted">Showing 60 of {groups.length} groups — refine the filter.</p>
        )}
      </div>
        </>
      )}
    </div>
  );
}
