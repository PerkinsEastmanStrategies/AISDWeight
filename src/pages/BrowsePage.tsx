import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAppData } from "../lib/DataContext";
import {
  SCHOOL_NAME,
  categoriesForSpace,
  findSpace,
  questionsForSpace,
  questionsForSub,
  roleCounts,
  spaceTypesForFocus,
  subcategoriesFor,
} from "../lib/hierarchy";
import { classifyQuestion, fmtWeight } from "../lib/weights";
import { RolePill, Stat } from "../components/Ui";
import { PeerScoresSummary } from "../components/PeerScores";

export function BrowsePage() {
  const { catalog } = useAppData();
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const focus = params.get("focus") ?? "";
  const spaceTypeId = params.get("space") ?? "";
  const category = params.get("category") ?? "";
  const subcategory = params.get("sub") ?? "";

  if (!catalog) return null;

  const space = spaceTypeId ? findSpace(catalog, spaceTypeId) : undefined;

  const crumbs: Array<{ label: string; to?: string }> = [
    { label: SCHOOL_NAME, to: "/browse" },
  ];
  if (focus) {
    crumbs.push({
      label: focus,
      to: `/browse?focus=${encodeURIComponent(focus)}`,
    });
  }
  if (space) {
    crumbs.push({
      label: space.name,
      to: `/browse?focus=${encodeURIComponent(focus || space.focusArea)}&space=${encodeURIComponent(space.id)}`,
    });
  }
  if (category) {
    crumbs.push({
      label: category,
      to: `/browse?focus=${encodeURIComponent(focus || space?.focusArea || "")}&space=${encodeURIComponent(spaceTypeId)}&category=${encodeURIComponent(category)}`,
    });
  }
  if (subcategory) {
    crumbs.push({ label: subcategory });
  }

  return (
    <div>
      <nav className="breadcrumb" aria-label="Hierarchy">
        {crumbs.map((c, i) => (
          <span key={`${c.label}-${i}`} className="row">
            {i > 0 && <span className="sep">/</span>}
            {c.to && i < crumbs.length - 1 ? (
              <button type="button" onClick={() => navigate(c.to!)}>
                {c.label}
              </button>
            ) : (
              <span className="here">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {!focus && <FocusList />}
      {focus && !spaceTypeId && <SpaceList focusArea={focus} />}
      {space && !category && <CategoryList focus={focus || space.focusArea} spaceTypeId={space.id} />}
      {space && category && !subcategory && (
        <SubList
          focus={focus || space.focusArea}
          spaceTypeId={space.id}
          category={category}
        />
      )}
      {space && category && subcategory && (
        <QuestionList
          focus={focus || space.focusArea}
          spaceTypeId={space.id}
          category={category}
          subcategory={subcategory}
        />
      )}
    </div>
  );
}

function FocusList() {
  const { catalog } = useAppData();
  if (!catalog) return null;
  return (
    <div className="card">
      <h2>{SCHOOL_NAME} — focus areas</h2>
      <p className="muted">Select a score focus area to continue.</p>
      <table className="data">
        <thead>
          <tr>
            <th>Focus area</th>
            <th className="num">Space types</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {catalog.focusAreas.map((fa) => (
            <tr key={fa}>
              <td>{fa}</td>
              <td className="num">{spaceTypesForFocus(catalog, fa).length}</td>
              <td>
                <Link className="btn" to={`/browse?focus=${encodeURIComponent(fa)}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SpaceList({ focusArea }: { focusArea: string }) {
  const { catalog } = useAppData();
  if (!catalog) return null;
  const spaces = spaceTypesForFocus(catalog, focusArea);
  return (
    <div className="card">
      <h2>{focusArea} — space types</h2>
      <table className="data">
        <thead>
          <tr>
            <th>Space type</th>
            <th>Sheet</th>
            <th className="num">Questions</th>
            <th className="num">Scoring</th>
            <th className="num">Flags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {spaces.map((s) => {
            const qs = questionsForSpace(catalog, s.id);
            const c = roleCounts(qs);
            return (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="muted">{s.sheet}</td>
                <td className="num">{c.total}</td>
                <td className="num">{c.scoring}</td>
                <td className="num">{c.incomplete + c.blank}</td>
                <td>
                  <Link
                    className="btn"
                    to={`/browse?focus=${encodeURIComponent(focusArea)}&space=${encodeURIComponent(s.id)}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CategoryList({
  focus,
  spaceTypeId,
}: {
  focus: string;
  spaceTypeId: string;
}) {
  const { catalog } = useAppData();
  if (!catalog) return null;
  const cats = categoriesForSpace(catalog, spaceTypeId);
  const space = findSpace(catalog, spaceTypeId);
  const counts = roleCounts(questionsForSpace(catalog, spaceTypeId));

  return (
    <div>
      <div className="stats">
        <Stat value={counts.scoring} label="Scoring" />
        <Stat value={counts.inventory} label="Inventory" />
        <Stat value={counts.blank} label="Blank" />
        <Stat value={counts.incomplete} label="Incomplete" warn={counts.incomplete > 0} />
      </div>
      <div className="card">
        <h2>{space?.name} — categories</h2>
        <table className="data">
          <thead>
            <tr>
              <th>Category</th>
              <th className="num">Subcategories</th>
              <th className="num">Questions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cats.map((cat) => {
              const subs = subcategoriesFor(catalog, spaceTypeId, cat);
              const qs = questionsForSpace(catalog, spaceTypeId).filter(
                (q) => q.category === cat,
              );
              return (
                <tr key={cat}>
                  <td>{cat}</td>
                  <td className="num">{subs.length}</td>
                  <td className="num">{qs.length}</td>
                  <td>
                    <Link
                      className="btn"
                      to={`/browse?focus=${encodeURIComponent(focus)}&space=${encodeURIComponent(spaceTypeId)}&category=${encodeURIComponent(cat)}`}
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SubList({
  focus,
  spaceTypeId,
  category,
}: {
  focus: string;
  spaceTypeId: string;
  category: string;
}) {
  const { catalog } = useAppData();
  if (!catalog) return null;
  const subs = subcategoriesFor(catalog, spaceTypeId, category);
  return (
    <div className="card">
      <h2>{category} — subcategories</h2>
      <table className="data">
        <thead>
          <tr>
            <th>Subcategory</th>
            <th className="num">Questions</th>
            <th className="num">Scoring</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {subs.map((sub) => {
            const qs = questionsForSub(catalog, spaceTypeId, category, sub);
            const c = roleCounts(qs);
            return (
              <tr key={sub}>
                <td>{sub}</td>
                <td className="num">{c.total}</td>
                <td className="num">{c.scoring}</td>
                <td>
                  <Link
                    className="btn"
                    to={`/browse?focus=${encodeURIComponent(focus)}&space=${encodeURIComponent(spaceTypeId)}&category=${encodeURIComponent(category)}&sub=${encodeURIComponent(sub)}`}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QuestionList({
  focus,
  spaceTypeId,
  category,
  subcategory,
}: {
  focus: string;
  spaceTypeId: string;
  category: string;
  subcategory: string;
}) {
  const { catalog } = useAppData();
  if (!catalog) return null;
  const qs = questionsForSub(catalog, spaceTypeId, category, subcategory);
  return (
    <div className="card">
      <h2>{subcategory} — questions</h2>
      <p className="muted">
        “Also asked in” shows the same or similar question in other space types and their current QW.
      </p>
      <table className="data">
        <thead>
          <tr>
            <th>ID</th>
            <th>Role</th>
            <th className="num">QW</th>
            <th className="num">SW</th>
            <th className="num">CW</th>
            <th>Question</th>
            <th>Also asked in (QW)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {qs.map((q) => (
            <tr key={q.key}>
              <td className="mono">{q.id}</td>
              <td>
                <RolePill role={classifyQuestion(q)} />
              </td>
              <td className="num">{fmtWeight(q.qw)}</td>
              <td className="num">{fmtWeight(q.sw)}</td>
              <td className="num">{fmtWeight(q.cw)}</td>
              <td>
                {q.text.slice(0, 100)}
                {q.text.length > 100 ? "…" : ""}
              </td>
              <td>
                <PeerScoresSummary questionKey={q.key} />
              </td>
              <td>
                <Link className="btn" to={`/question/${encodeURIComponent(q.key)}`}>
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: "0.75rem" }}>
        Focus: {focus}
      </p>
    </div>
  );
}
