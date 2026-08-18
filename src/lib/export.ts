import type {
  Catalog,
  CompanySuggestions,
  CompanySuggestionsV1,
  SimilarityOverrides,
} from "./types";
import type { CompanySuggestionsV3 } from "./hierarchyTypes";
import { classifyQuestion, fmtWeight } from "./weights";
import { suggestFromPeers } from "./similarity";
import { findQuestion, findSpace } from "./hierarchy";
import { isImportance } from "./relative";

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildComparisonCsv(
  catalog: Catalog,
  companies: CompanySuggestions[],
  overrides: SimilarityOverrides | null,
): string {
  const headers = [
    "questionKey",
    "questionId",
    "spaceType",
    "focusArea",
    "category",
    "subcategory",
    "role",
    "currentQw",
    "currentSw",
    "currentCw",
    "peerMedianQw",
    "peerMedianSw",
    "peerMedianCw",
    "peerCount",
    ...companies.flatMap((c) => [
      `${c.company}_questionImportance`,
      `${c.company}_subcategoryImportance`,
      `${c.company}_comment`,
    ]),
  ];

  const lines = [headers.map(csvEscape).join(",")];
  for (const q of catalog.questions) {
    const space = findSpace(catalog, q.spaceTypeId);
    const peer = suggestFromPeers(catalog, q.key, overrides);
    const row: string[] = [
      q.key,
      q.id,
      space?.name ?? "",
      space?.focusArea ?? q.scoreFocus,
      q.category,
      q.subcategory,
      classifyQuestion(q),
      fmtWeight(q.qw),
      fmtWeight(q.sw),
      fmtWeight(q.cw),
      peer.qw === null ? "" : String(peer.qw),
      peer.sw === null ? "" : String(peer.sw),
      peer.cw === null ? "" : String(peer.cw),
      String(peer.peerCount),
    ];
    for (const c of companies) {
      const qs = c.questionScores?.find((x) => x.questionKey === q.key);
      const ss = c.subcategoryScores?.find(
        (x) =>
          x.spaceTypeId === q.spaceTypeId &&
          x.category === q.category &&
          x.subcategory === q.subcategory,
      );
      row.push(
        qs ? String(qs.importance) : "",
        ss ? String(ss.importance) : "",
        qs?.comment ?? ss?.comment ?? "",
      );
    }
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function exportReviewerZip(
  catalog: Catalog,
  overrides: SimilarityOverrides,
): Promise<void> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const html = buildStandaloneReviewerHtml(catalog, overrides);
  zip.file("index.html", html);
  zip.file(
    "README.txt",
    [
      "ESA Scoring Review Package",
      "",
      "1. Open index.html in Chrome or Edge.",
      "2. Select a space type.",
      "3. Score subcategories within each category (3 / 6 / 9 / 12).",
      "4. Score questions within each subcategory (3 / 6 / 9 / 12).",
      "5. Download suggestions JSON and send it back.",
      "",
      "Scale: 3 = lowest importance, 12 = highest (aligned with existing weights).",
    ].join("\n"),
  );
  zip.folder("data")?.file("catalog.json", JSON.stringify(catalog, null, 2));
  zip.folder("data")?.file(
    "similarity-overrides.json",
    JSON.stringify(overrides, null, 2),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `esa-scoring-review-package-${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Offline single-file reviewer with comparative 3/6/9/12 scoring. */
export function buildStandaloneReviewerHtml(
  catalog: Catalog,
  _overrides: SimilarityOverrides,
): string {
  const payload = JSON.stringify({ catalog });
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>ESA Scoring Reviewer</title>
<style>
  :root { --bg:#ebe6df; --ink:#1a1714; --muted:#5c564e; --line:#cfc6ba; --accent:#0d4f5b; --card:#fffcf7; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: "Segoe UI", system-ui, sans-serif; background: var(--bg); color: var(--ink); }
  header { padding: 1.1rem 1.4rem; border-bottom: 1px solid var(--line); background: var(--card); }
  h1 { margin:0 0 .3rem; font-size: 1.3rem; }
  .sub { color: var(--muted); font-size: .9rem; }
  main { max-width: 1080px; margin: 0 auto; padding: 1.1rem 1.4rem 3rem; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 1rem; margin-bottom: 1rem; }
  label { display:block; font-size:.75rem; color:var(--muted); margin-bottom:.25rem; text-transform:uppercase; letter-spacing:.04em; }
  input, select { width:100%; padding:.45rem .55rem; border:1px solid var(--line); border-radius:6px; background:#fff; font: inherit; }
  .row { display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:.75rem; }
  button { font: inherit; border:1px solid var(--line); background:#fff; border-radius:6px; padding:.45rem .85rem; cursor:pointer; }
  button.primary { background: var(--accent); color:#fff; border-color: var(--accent); }
  button.ghost { background: transparent; }
  table { width:100%; border-collapse: collapse; font-size:.9rem; }
  th, td { text-align:left; padding:.55rem .5rem; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:.72rem; color:var(--muted); text-transform:uppercase; letter-spacing:.04em; }
  .imps { display:flex; gap:.35rem; }
  .imps label { text-transform:none; letter-spacing:0; font-size:.9rem; border:1px solid var(--line); border-radius:6px; padding:.25rem .55rem; cursor:pointer; margin:0; background:#fff; }
  .imps label.on { background: var(--accent); color:#fff; border-color: var(--accent); }
  .imps input { display:none; }
  .crumb { display:flex; gap:.5rem; align-items:center; margin-bottom:.75rem; flex-wrap:wrap; }
  .muted { color: var(--muted); font-size:.88rem; }
  .mono { font-family: ui-monospace, Consolas, monospace; font-size:.85em; }
  .actions { display:flex; gap:.5rem; flex-wrap:wrap; margin-top:.85rem; align-items:center; }
</style>
</head>
<body>
<header>
  <h1>ESA Scoring Reviewer</h1>
  <div class="sub">3 = lowest importance · 12 = highest (same as existing weights). Score items in each set relative to each other.</div>
</header>
<main>
  <div class="card">
    <div class="row">
      <div><label>Company (required)</label><input id="company"/></div>
      <div><label>Contact (optional)</label><input id="contact"/></div>
      <div><label>Focus area</label><select id="focus"></select></div>
      <div><label>Space type (required)</label><select id="space"></select></div>
    </div>
    <div class="actions">
      <button class="primary" id="download">Download suggestions JSON</button>
      <button id="clear">Clear draft</button>
      <span class="muted" id="status"></span>
    </div>
  </div>
  <div id="view"></div>
</main>
<script>
const catalog = ${payload}.catalog;
const LS = "esa-standalone-reviewer-draft-v3";
function load(){ try { return JSON.parse(localStorage.getItem(LS)||"null"); } catch { return null; } }
function save(d){ localStorage.setItem(LS, JSON.stringify(d)); }
function classify(q){
  if (q.qw === "i") return "inventory";
  const qb=q.qw==null,sb=q.sw==null,cb=q.cw==null;
  if (qb&&sb&&cb) return "blank";
  if (typeof q.qw==="number" && !sb && !cb) return "scoring";
  return "incomplete";
}
function suggestFromWeights(weights){
  const levels = [3,6,9,12];
  const nums = weights.map(w => typeof w==="number" ? w : null);
  const present = nums.filter(n => n!==null);
  if (!present.length) return nums.map(()=>null);
  const min=Math.min(...present), max=Math.max(...present);
  if (min===max) {
    const only = present[0];
    const kept = levels.includes(only) ? only : 6;
    return nums.map(n => n===null ? null : kept);
  }
  return nums.map(n => {
    if (n===null) return null;
    if (levels.includes(n)) return n;
    const t = (n-min)/(max-min);
    return levels[Math.max(0, Math.min(3, Math.round(t*3)))];
  });
}
function radios(name, value, onAttr){
  return [3,6,9,12].map(n => {
    const on = value===n ? " on" : "";
    return '<label class="'+on+'"><input type="radio" name="'+name+'" value="'+n+'" '+(value===n?"checked":"")+' data-imp="1"/>'+n+'</label>';
  }).join("");
}
function sk(space, cat, sub){ return space+"||"+cat+"||"+sub; }
function qsFor(spaceId, cat, sub){
  return catalog.questions.filter(q => q.spaceTypeId===spaceId && q.category===cat && q.subcategory===sub);
}
function reviewable(qs){ return qs.filter(q => classify(q)!=="inventory"); }
function cats(spaceId){
  return [...new Set(catalog.questions.filter(q=>q.spaceTypeId===spaceId).map(q=>q.category).filter(Boolean))].sort();
}
function subs(spaceId, cat){
  return [...new Set(catalog.questions.filter(q=>q.spaceTypeId===spaceId && q.category===cat).map(q=>q.subcategory).filter(Boolean))].sort();
}

let draft = load() || { company:"", contact:"", spaceTypeId:"", subcategoryScores:{}, questionScores:{}, step:{view:"home"} };
document.getElementById("company").value = draft.company||"";
document.getElementById("contact").value = draft.contact||"";
const focusSel = document.getElementById("focus");
const spaceSel = document.getElementById("space");
focusSel.innerHTML = '<option value="">All</option>' + catalog.focusAreas.map(f=>'<option value="'+f+'">'+f+'</option>').join("");

function refreshSpaces(){
  const fa = focusSel.value;
  const spaces = catalog.spaceTypes.filter(s=>!fa||s.focusArea===fa).sort((a,b)=>a.name.localeCompare(b.name));
  spaceSel.innerHTML = '<option value="">Select…</option>' + spaces.map(s=>'<option value="'+s.id+'" '+(s.id===draft.spaceTypeId?"selected":"")+'>'+s.name+'</option>').join("");
}
refreshSpaces();

document.getElementById("company").oninput = e => { draft.company=e.target.value; save(draft); };
document.getElementById("contact").oninput = e => { draft.contact=e.target.value; save(draft); };
focusSel.onchange = () => { refreshSpaces(); };
spaceSel.onchange = () => {
  draft.spaceTypeId = spaceSel.value;
  draft.step = { view:"home" };
  save(draft); render();
};

function seedSubs(cat){
  const list = subs(draft.spaceTypeId, cat);
  const weights = list.map(sub => {
    const q = qsFor(draft.spaceTypeId, cat, sub).find(x => typeof x.sw==="number");
    return q && typeof q.sw==="number" ? q.sw : null;
  });
  const sug = suggestFromWeights(weights);
  list.forEach((sub,i)=>{
    const k = sk(draft.spaceTypeId, cat, sub);
    if (!draft.subcategoryScores[k]) draft.subcategoryScores[k] = { importance: sug[i], comment:"" };
  });
}
function seedQs(cat, sub){
  const list = reviewable(qsFor(draft.spaceTypeId, cat, sub));
  const weights = list.map(q => typeof q.qw==="number" ? q.qw : null);
  const sug = suggestFromWeights(weights);
  list.forEach((q,i)=>{
    if (!draft.questionScores[q.key]) draft.questionScores[q.key] = { importance: sug[i], comment:"" };
  });
}

function render(){
  const view = document.getElementById("view");
  if (!draft.spaceTypeId) {
    view.innerHTML = '<div class="card muted">Select a space type to begin.</div>';
    document.getElementById("status").textContent = "";
    return;
  }
  const space = catalog.spaceTypes.find(s=>s.id===draft.spaceTypeId);
  const step = draft.step || { view:"home" };

  if (step.view === "home") {
    const rows = cats(draft.spaceTypeId).map(cat => {
      const sList = subs(draft.spaceTypeId, cat);
      const scored = sList.filter(sub => draft.subcategoryScores[sk(draft.spaceTypeId,cat,sub)]?.importance!=null).length;
      return '<tr><td>'+cat+'</td><td>'+sList.length+'</td><td>'+scored+'/'+sList.length+'</td><td><button data-open-cat="'+encodeURIComponent(cat)+'">Score subcategories</button></td></tr>';
    }).join("");
    view.innerHTML = '<div class="card"><h3>'+(space?.name||"")+' — categories</h3><p class="muted">Open a category to compare its subcategories (3 / 6 / 9 / 12), then score questions inside each subcategory.</p><table><thead><tr><th>Category</th><th>Subs</th><th>Scored</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  } else if (step.view === "category") {
    const cat = step.category;
    seedSubs(cat);
    const sList = subs(draft.spaceTypeId, cat);
    const rows = sList.map(sub => {
      const k = sk(draft.spaceTypeId, cat, sub);
      const row = draft.subcategoryScores[k] || { importance:null, comment:"" };
      const qq = qsFor(draft.spaceTypeId, cat, sub);
      const swQ = qq.find(x => typeof x.sw==="number");
      const sw = swQ ? swQ.sw : "—";
      const rev = reviewable(qq);
      const qDone = rev.filter(q => draft.questionScores[q.key]?.importance!=null).length;
      return '<tr data-subkey="'+k+'"><td><strong>'+sub+'</strong><div class="muted">Questions scored '+qDone+'/'+rev.length+'</div></td><td>'+qq.length+'</td><td>'+sw+'</td><td><div class="imps">'+radios("sub-"+k, row.importance)+'</div></td><td><input data-comment="1" value="'+(row.comment||"").replace(/"/g,"&quot;")+'"/></td><td><button data-open-sub="'+encodeURIComponent(sub)+'">Score questions</button></td></tr>';
    }).join("");
    view.innerHTML = '<div class="card"><div class="crumb"><button class="ghost" id="backHome">← Categories</button><span class="muted">'+(space?.name||"")+' › '+cat+'</span></div><h3>Score subcategories against each other</h3><p class="muted">3 = lowest · 12 = highest importance within this category.</p><table><thead><tr><th>Subcategory</th><th>Qs</th><th>Current SW</th><th>Importance</th><th>Comment</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  } else if (step.view === "subcategory") {
    const cat = step.category, sub = step.subcategory;
    seedQs(cat, sub);
    const all = qsFor(draft.spaceTypeId, cat, sub);
    const qs = reviewable(all);
    const inv = all.filter(q => classify(q)==="inventory");
    const rows = qs.map(q => {
      const row = draft.questionScores[q.key] || { importance:null, comment:"" };
      return '<tr data-qkey="'+q.key+'"><td><span class="mono">'+q.id+'</span><div>'+q.text+'</div></td><td>'+classify(q)+'</td><td>'+(q.qw??"—")+'</td><td><div class="imps">'+radios("q-"+q.key, row.importance)+'</div></td><td><input data-comment="1" value="'+(row.comment||"").replace(/"/g,"&quot;")+'"/></td></tr>';
    }).join("");
    const invHtml = inv.length ? '<p class="muted" style="margin-top:1rem">Inventory (not scored): '+inv.map(q=>q.id).join(", ")+'</p>' : "";
    view.innerHTML = '<div class="card"><div class="crumb"><button class="ghost" id="backCat">← Subcategories</button><span class="muted">'+(space?.name||"")+' › '+cat+' › '+sub+'</span></div><h3>Score questions against each other</h3><p class="muted">3 = lowest · 12 = highest importance within this subcategory.</p><table><thead><tr><th>Question</th><th>Role</th><th>Current QW</th><th>Importance</th><th>Comment</th></tr></thead><tbody>'+rows+'</tbody></table>'+invHtml+'</div>';
  }
  save(draft);
  wire();
}

function wire(){
  document.querySelectorAll("[data-open-cat]").forEach(btn => btn.onclick = () => {
    draft.step = { view:"category", category: decodeURIComponent(btn.getAttribute("data-open-cat")) };
    save(draft); render();
  });
  document.querySelectorAll("[data-open-sub]").forEach(btn => btn.onclick = () => {
    draft.step = { view:"subcategory", category: draft.step.category, subcategory: decodeURIComponent(btn.getAttribute("data-open-sub")) };
    save(draft); render();
  });
  const backHome = document.getElementById("backHome");
  if (backHome) backHome.onclick = () => { draft.step={view:"home"}; save(draft); render(); };
  const backCat = document.getElementById("backCat");
  if (backCat) backCat.onclick = () => { draft.step={view:"category", category: draft.step.category}; save(draft); render(); };

  document.querySelectorAll("tr[data-subkey]").forEach(tr => {
    const k = tr.getAttribute("data-subkey");
    tr.querySelectorAll("input[data-imp]").forEach(inp => {
      inp.onchange = () => {
        const v = Number(inp.value);
        draft.subcategoryScores[k] = draft.subcategoryScores[k] || { importance:null, comment:"" };
        draft.subcategoryScores[k].importance = v;
        save(draft); render();
      };
    });
    const c = tr.querySelector("input[data-comment]");
    if (c) c.oninput = () => {
      draft.subcategoryScores[k] = draft.subcategoryScores[k] || { importance:null, comment:"" };
      draft.subcategoryScores[k].comment = c.value;
      save(draft);
    };
  });
  document.querySelectorAll("tr[data-qkey]").forEach(tr => {
    const k = tr.getAttribute("data-qkey");
    tr.querySelectorAll("input[data-imp]").forEach(inp => {
      inp.onchange = () => {
        const v = Number(inp.value);
        draft.questionScores[k] = draft.questionScores[k] || { importance:null, comment:"" };
        draft.questionScores[k].importance = v;
        save(draft); render();
      };
    });
    const c = tr.querySelector("input[data-comment]");
    if (c) c.oninput = () => {
      draft.questionScores[k] = draft.questionScores[k] || { importance:null, comment:"" };
      draft.questionScores[k].comment = c.value;
      save(draft);
    };
  });
}

document.getElementById("download").onclick = () => {
  if (!draft.company.trim()) { alert("Enter a company name first."); return; }
  if (!draft.spaceTypeId) { alert("Select a space type."); return; }
  const subcategoryScores = Object.entries(draft.subcategoryScores).filter(([,s])=>s.importance!=null).map(([key,s])=>{
    const [spaceTypeId, category, subcategory] = key.split("||");
    return { spaceTypeId, category, subcategory, importance:s.importance, comment:s.comment||undefined };
  }).filter(r => r.spaceTypeId===draft.spaceTypeId);
  const questionScores = Object.entries(draft.questionScores).filter(([,s])=>s.importance!=null).map(([questionKey,s])=>({
    questionKey, importance:s.importance, comment:s.comment||undefined
  })).filter(r => {
    const q = catalog.questions.find(x=>x.key===r.questionKey);
    return q && q.spaceTypeId===draft.spaceTypeId;
  });
  const out = {
    version:2,
    company: draft.company.trim(),
    contact: draft.contact.trim()||undefined,
    exportedAt: new Date().toISOString(),
    catalogGeneratedAt: catalog.meta.generatedAt,
    subcategoryScores,
    questionScores
  };
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:"application/json"}));
  a.download="suggestions-"+out.company.replace(/\\s+/g,"-").toLowerCase()+".json";
  a.click();
};
document.getElementById("clear").onclick = () => {
  if (!confirm("Clear local draft?")) return;
  localStorage.removeItem(LS);
  location.reload();
};
render();
</script>
</body>
</html>`;
}

export function parseSuggestionFile(raw: unknown): CompanySuggestions {
  const data = raw as CompanySuggestions | CompanySuggestionsV1;
  if (!data || !data.company) {
    throw new Error("Invalid suggestions file (missing company).");
  }
  if (data.version === 2) {
    const v2 = data as CompanySuggestions;
    if (!Array.isArray(v2.questionScores) || !Array.isArray(v2.subcategoryScores)) {
      throw new Error("Invalid v2 suggestions file (need questionScores + subcategoryScores).");
    }
    for (const s of v2.questionScores) {
      if (!isImportance(s.importance)) {
        throw new Error(`Invalid question importance (must be a whole number > 0): ${s.questionKey}`);
      }
    }
    for (const s of v2.subcategoryScores) {
      if (!isImportance(s.importance)) {
        throw new Error(`Invalid subcategory importance (must be a whole number > 0): ${s.subcategory}`);
      }
    }
    return v2;
  }
  throw new Error(
    "This app now expects version 2 suggestions (relative scores). Re-export from the updated reviewer.",
  );
}

export function parseRollupSuggestionFile(raw: unknown): CompanySuggestionsV3 {
  const data = raw as CompanySuggestionsV3;
  if (!data || data.version !== 3 || !data.company || !data.schoolLevel) {
    throw new Error("Invalid rollup suggestions file (need version 3, company, schoolLevel).");
  }
  const buckets = [
    data.focusAreaWeights,
    data.spaceTypeWeights,
    data.categoryWeights,
    data.subcategoryWeights,
  ];
  for (const list of buckets) {
    if (!Array.isArray(list)) {
      throw new Error("Invalid rollup suggestions file (weight arrays required).");
    }
    for (const s of list) {
      if (!isImportance(s.importance)) {
        throw new Error(`Invalid importance on ${s.key ?? s.label}`);
      }
    }
  }
  return data;
}

export function suggestionFor(
  companies: CompanySuggestions[],
  company: string,
  questionKey: string,
) {
  const file = companies.find((c) => c.company === company);
  return file?.questionScores.find((s) => s.questionKey === questionKey);
}

export { findQuestion };
