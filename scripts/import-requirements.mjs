/**
 * ETL: ESA Space Type Survey Requirements.xlsx → public/data/site-hierarchy.json
 * Usage: node scripts/import-requirements.mjs [path-to-xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultXlsx =
  "C:\\Users\\k.rasmussen\\OneDrive - Perkins Eastman Architects DPC\\AISD\\ESA Space Type Surey Requirements.xlsx";
const xlsxPath = process.argv[2] || defaultXlsx;
const outPath = path.join(root, "public", "data", "site-hierarchy.json");
const catalogPath = path.join(root, "public", "data", "catalog.json");

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/tranditional/g, "traditional")
    .replace(/rehersal/g, "rehearsal")
    .replace(/multi-purpose/g, "multipurpose")
    .replace(/locker rooms?/g, "locker room")
    .replace(/outdoor elements/g, "outdoor")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreFocus(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^outdoor$/i.test(s) || /^outdoor elements$/i.test(s)) return "Outdoor Elements";
  if (/^special education$/i.test(s)) return "Special Education";
  return s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and");
}

function snapImportance(n) {
  if (n == null || !Number.isFinite(n)) return null;
  const levels = [3, 6, 9, 12];
  let best = levels[0];
  let dist = Math.abs(n - best);
  for (const L of levels) {
    const d = Math.abs(n - L);
    if (d < dist) {
      dist = d;
      best = L;
    }
  }
  return best;
}

function matchCatalogSpace(catalog, spaceTypeName, focusArea) {
  if (!catalog) return null;
  const target = normName(spaceTypeName);
  const focusN = normName(focusArea);
  let best = null;
  let bestScore = 0;
  for (const st of catalog.spaceTypes) {
    const nameN = normName(st.name);
    const stFocus = normName(st.focusArea === "Outdoor" ? "Outdoor Elements" : st.focusArea);
    let score = 0;
    if (nameN === target) score = 100;
    else if (nameN.includes(target) || target.includes(nameN)) score = 70;
    else {
      const a = new Set(nameN.split(" "));
      const b = new Set(target.split(" "));
      let overlap = 0;
      for (const w of a) if (b.has(w)) overlap++;
      score = (overlap / Math.max(a.size, b.size)) * 50;
    }
    if (score >= 50 && stFocus === focusN) score += 15;
    if (score > bestScore) {
      bestScore = score;
      best = st;
    }
  }
  return bestScore >= 55 ? best : null;
}

if (!fs.existsSync(xlsxPath)) {
  console.error("Workbook not found:", xlsxPath);
  process.exit(1);
}

let catalog = null;
if (fs.existsSync(catalogPath)) {
  catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

const wb = XLSX.readFile(xlsxPath, { cellDates: false });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });

/** @type {Record<string, { schoolLevel: string, focusAreas: Map<string, any> }>} */
const byLevel = {};

for (const row of rows) {
  const schoolLevel = String(row["School Level"] || "").trim().toUpperCase();
  if (!["ES", "MS", "HS"].includes(schoolLevel)) continue;

  const navFocus = String(row["Focus Area"] || "").trim();
  const spaceType = String(row["Space Type"] || "").trim();
  if (!navFocus || !spaceType) continue;

  const scoringFocus = scoreFocus(row["Focus Area (Scoring)"] || navFocus);
  const requiredRaw = String(row["Required"] || "").trim().toUpperCase();
  const required = requiredRaw === "Y";
  const spaceTypeWeight =
    typeof row["Space Type Weight"] === "number" ? row["Space Type Weight"] : null;
  const focusAreaWeight =
    typeof row["Focus Area Weight"] === "number" ? row["Focus Area Weight"] : null;
  const scoreCode = row["Score Code"] != null ? String(row["Score Code"]).trim() : "";
  const minSurveys =
    typeof row["Minimum Number of Surveys"] === "number"
      ? row["Minimum Number of Surveys"]
      : null;
  const notes = row["Notes"] != null ? String(row["Notes"]).trim() : "";

  if (!byLevel[schoolLevel]) {
    byLevel[schoolLevel] = { schoolLevel, focusAreas: new Map() };
  }
  const level = byLevel[schoolLevel];
  // Group by survey-tool Focus Area (includes Visual Arts), not scoring rollup.
  if (!level.focusAreas.has(navFocus)) {
    level.focusAreas.set(navFocus, {
      name: navFocus,
      navLabel: navFocus,
      scoringFocus,
      baselineWeight: focusAreaWeight,
      importanceSeed: snapImportance(focusAreaWeight),
      spaceTypes: [],
    });
  }
  const fa = level.focusAreas.get(navFocus);
  if (fa.baselineWeight == null && focusAreaWeight != null) {
    fa.baselineWeight = focusAreaWeight;
    fa.importanceSeed = snapImportance(focusAreaWeight);
  }

  const matched = matchCatalogSpace(catalog, spaceType, scoringFocus) ||
    matchCatalogSpace(catalog, spaceType, navFocus);
  const slug = normName(spaceType).replace(/\s+/g, "-");
  fa.spaceTypes.push({
    id: `${schoolLevel}::${slug || scoreCode}`,
    name: spaceType.replace(/Tranditional/i, "Traditional").replace(/Rehersal/i, "Rehearsal"),
    scoreCode,
    required,
    baselineWeight: spaceTypeWeight,
    importanceSeed: snapImportance(spaceTypeWeight),
    minSurveys,
    notes: notes || undefined,
    navFocusArea: navFocus,
    scoringFocus,
    catalogSpaceTypeId: matched?.id ?? null,
    catalogSpaceTypeName: matched?.name ?? null,
  });
}

const schoolLevels = ["ES", "MS", "HS"].map((sl) => {
  const level = byLevel[sl];
  const focusAreas = [...level.focusAreas.values()].map((fa) => ({
    ...fa,
    spaceTypes: fa.spaceTypes,
  }));
  return {
    id: sl,
    label: sl === "ES" ? "Elementary" : sl === "MS" ? "Middle School" : "High School",
    focusAreas,
  };
});

const out = {
  meta: {
    sourceFile: path.basename(xlsxPath),
    generatedAt: new Date().toISOString(),
    note: "Site → Focus Area → Space Type requirements by school level. Categories/subcategories come from catalog when matched.",
  },
  schoolLevels,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("Wrote", outPath);
for (const level of schoolLevels) {
  const sts = level.focusAreas.reduce((n, f) => n + f.spaceTypes.length, 0);
  const unmatched = level.focusAreas
    .flatMap((f) => f.spaceTypes)
    .filter((s) => !s.catalogSpaceTypeId).length;
  console.log(
    `  ${level.id}: ${level.focusAreas.length} focus areas, ${sts} space types (${unmatched} unmatched to catalog)`,
  );
}
