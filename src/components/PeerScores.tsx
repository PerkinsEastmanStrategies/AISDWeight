import { Link } from "react-router-dom";
import { useAppData } from "../lib/DataContext";
import { findSpace } from "../lib/hierarchy";
import { getPeerQuestions, suggestFromPeers } from "../lib/similarity";
import { classifyQuestion, fmtWeight } from "../lib/weights";
import { RolePill } from "./Ui";

/** Compact one-line peer summary for tables. */
export function PeerScoresSummary({ questionKey }: { questionKey: string }) {
  const { catalog, overrides } = useAppData();
  if (!catalog) return <span className="muted">—</span>;
  const peers = getPeerQuestions(catalog, questionKey, overrides);
  if (peers.length === 0) return <span className="muted">No peers</span>;

  const bits = peers
    .slice()
    .sort((a, b) => {
      const an = findSpace(catalog, a.spaceTypeId)?.name ?? "";
      const bn = findSpace(catalog, b.spaceTypeId)?.name ?? "";
      return an.localeCompare(bn);
    })
    .map((p) => {
      const name = findSpace(catalog, p.spaceTypeId)?.name ?? p.spaceTypeId;
      return `${name} ${fmtWeight(p.qw)}`;
    });

  const shown = bits.slice(0, 4);
  const more = bits.length - shown.length;
  return (
    <span className="peer-summary" title={bits.join(" · ")}>
      {shown.join(" · ")}
      {more > 0 ? ` · +${more}` : ""}
    </span>
  );
}

/** Full peer comparison table for a question. */
export function PeerScoresPanel({
  questionKey,
  title = "Also asked in other space types",
  compact = false,
}: {
  questionKey: string;
  title?: string;
  compact?: boolean;
}) {
  const { catalog, overrides } = useAppData();
  if (!catalog) return null;

  const peers = getPeerQuestions(catalog, questionKey, overrides)
    .slice()
    .sort((a, b) => {
      const an = findSpace(catalog, a.spaceTypeId)?.name ?? "";
      const bn = findSpace(catalog, b.spaceTypeId)?.name ?? "";
      return an.localeCompare(bn);
    });
  const peer = suggestFromPeers(catalog, questionKey, overrides);

  if (peers.length === 0) {
    return (
      <div className={compact ? "peer-inline muted" : "card"}>
        {!compact && <h3>{title}</h3>}
        <p className="muted" style={{ margin: compact ? 0 : undefined }}>
          No matching or linked questions in other space types yet.
          {!compact && (
            <>
              {" "}
              You can add manual links under Import / Export → Similarity links.
            </>
          )}
        </p>
      </div>
    );
  }

  const table = (
    <table className="data">
      <thead>
        <tr>
          <th>Space type</th>
          <th>ID</th>
          <th>Role</th>
          <th className="num">QW</th>
          <th className="num">SW</th>
          <th className="num">CW</th>
          {!compact && <th>Category / Sub</th>}
          {!compact && <th></th>}
        </tr>
      </thead>
      <tbody>
        {peers.map((p) => {
          const sp = findSpace(catalog, p.spaceTypeId);
          return (
            <tr key={p.key}>
              <td>{sp?.name ?? p.spaceTypeId}</td>
              <td className="mono">{p.id}</td>
              <td>
                <RolePill role={classifyQuestion(p)} />
              </td>
              <td className="num">{fmtWeight(p.qw)}</td>
              <td className="num">{fmtWeight(p.sw)}</td>
              <td className="num">{fmtWeight(p.cw)}</td>
              {!compact && (
                <td className="muted">
                  {p.category} › {p.subcategory}
                </td>
              )}
              {!compact && (
                <td>
                  <Link className="btn" to={`/question/${encodeURIComponent(p.key)}`}>
                    Open
                  </Link>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  if (compact) {
    return (
      <div className="peer-inline">
        <div className="muted" style={{ marginBottom: "0.35rem" }}>
          {title}
          {peer.peerCount > 0 && peer.qw != null && (
            <> · peer median QW {peer.qw}</>
          )}
        </div>
        {table}
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{title}</h3>
      <p className="muted">
        Exact or manually linked similar questions in other space types, with their current weights.
        {peer.peerCount > 0 && (
          <>
            {" "}
            Peer median among scoring peers: QW {peer.qw ?? "—"} · SW {peer.sw ?? "—"} · CW{" "}
            {peer.cw ?? "—"}.
          </>
        )}
      </p>
      {table}
    </div>
  );
}
