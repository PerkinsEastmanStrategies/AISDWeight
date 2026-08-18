import { useState } from "react";
import { useAppData } from "../lib/DataContext";
import {
  buildComparisonCsv,
  buildStandaloneReviewerHtml,
  downloadJson,
  downloadText,
  exportReviewerZip,
  parseRollupSuggestionFile,
  parseSuggestionFile,
} from "../lib/export";
import { SimilarityPage } from "./SimilarityPage";

export function ImportExportPage() {
  const {
    catalog,
    overrides,
    companies,
    companiesV3,
    importCompanyFile,
    importCompanyFileV3,
    clearCompanies,
    clearCompaniesV3,
  } = useAppData();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (!catalog) return null;

  async function onImportSuggestions(file: File) {
    try {
      const raw = JSON.parse(await file.text());
      if (raw?.version === 3) {
        const data = parseRollupSuggestionFile(raw);
        importCompanyFileV3(data);
        setMsg(
          `Imported rollup suggestions from ${data.company} (${data.schoolLevel}): ${data.focusAreaWeights.length} FA / ${data.spaceTypeWeights.length} ST.`,
        );
        return;
      }
      const data = parseSuggestionFile(raw);
      importCompanyFile(data);
      setMsg(
        `Imported Past Weighting suggestions from ${data.company} (${data.questionScores.length} questions, ${data.subcategoryScores.length} subcategories).`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  async function onExportZip() {
    setBusy(true);
    setMsg("Building package…");
    try {
      await exportReviewerZip(catalog!, overrides);
      setMsg("Review package ZIP downloaded.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onExportStandaloneHtml() {
    const html = buildStandaloneReviewerHtml(catalog!, overrides);
    downloadText(
      "esa-scoring-reviewer.html",
      html,
      "text/html;charset=utf-8",
    );
    setMsg("Standalone reviewer HTML downloaded — send this single file to companies.");
  }

  function onExportCsv() {
    const csv = buildComparisonCsv(catalog!, companies, overrides);
    downloadText("esa-scoring-comparison.csv", csv, "text/csv;charset=utf-8");
    setMsg("Comparison CSV downloaded.");
  }

  return (
    <div>
      <div className="card">
        <h2>Export review package for companies</h2>
        <p className="muted">
          Share a standalone HTML reviewer (recommended) or a ZIP. Reviewers pick a space type, score
          subcategories within each category (3 / 6 / 9 / 12), then score questions within each
          subcategory (3 / 6 / 9 / 12). They download a suggestions JSON to send back. No login
          required.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={onExportStandaloneHtml}
          >
            Download standalone reviewer HTML
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void onExportZip()}>
            Download review ZIP
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Import company suggestions</h2>
        <p className="muted">
          Load one or more <span className="mono">suggestions-*.json</span> files returned by
          companies. Stored in this browser until cleared.
        </p>
        <div className="row">
          <label className="btn primary">
            Import suggestions JSON
            <input
              type="file"
              accept="application/json,.json"
              hidden
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => void onImportSuggestions(f));
                e.target.value = "";
              }}
            />
          </label>
          {companies.length > 0 && (
            <button type="button" className="btn" onClick={clearCompanies}>
              Clear imported companies (v2)
            </button>
          )}
          {companiesV3.length > 0 && (
            <button type="button" className="btn" onClick={clearCompaniesV3}>
              Clear imported rollups (v3)
            </button>
          )}
        </div>
        {companiesV3.length > 0 && (
          <table className="data" style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Level</th>
                <th className="num">Focus / Space</th>
                <th>Exported</th>
              </tr>
            </thead>
            <tbody>
              {companiesV3.map((c) => (
                <tr key={`${c.company}-${c.schoolLevel}-${c.exportedAt}`}>
                  <td>{c.company}</td>
                  <td>{c.schoolLevel}</td>
                  <td className="num">
                    {c.focusAreaWeights.length} / {c.spaceTypeWeights.length}
                  </td>
                  <td className="muted">
                    {c.exportedAt ? new Date(c.exportedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {companies.length > 0 && (
          <table className="data" style={{ marginTop: "1rem" }}>
            <thead>
              <tr>
                <th>Company (Past Weighting)</th>
                <th>Contact</th>
                <th className="num">Suggestions</th>
                <th>Exported</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.company}>
                  <td>{c.company}</td>
                  <td>{c.contact || "—"}</td>
                  <td className="num">
                    {c.questionScores.length}q / {c.subcategoryScores.length}sub
                  </td>
                  <td className="muted">
                    {c.exportedAt ? new Date(c.exportedAt).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Comparison export</h2>
        <p className="muted">
          CSV of every question with current weights, peer medians, and each imported company&apos;s
          suggestions.
        </p>
        <div className="row">
          <button type="button" className="btn primary" onClick={onExportCsv}>
            Download comparison CSV
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadJson("catalog-snapshot.json", {
                catalogMeta: catalog.meta,
                overrides,
                companies,
              })
            }
          >
            Download session snapshot JSON
          </button>
        </div>
      </div>

      <SimilarityPage />

      {msg && <div className="callout info">{msg}</div>}
    </div>
  );
}
