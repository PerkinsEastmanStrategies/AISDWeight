/**
 * ETL: AISD ESA Survey Final Draft_Copy.xlsx → public/data/catalog.json
 * Usage: node scripts/import-xlsx.mjs [path-to-xlsx]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultXlsx =
  "C:\\Users\\k.rasmussen\\Downloads\\AISD ESA Survey Final Draft_Copy.xlsx";

const xlsxPath = process.argv[2] || defaultXlsx;
const outDir = path.join(root, "public", "data");
const catalogPath = path.join(outDir, "catalog.json");
const reportPath = path.join(outDir, "quality-report.json");
const overridesSeed = path.join(outDir, "similarity-overrides.json");

function parseWeight(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.toLowerCase() === "i") return "i";
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseOptionScore(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function classifyWeights(qw, sw, cw) {
  if (qw === "i") return "inventory";
  const qwBlank = qw === null;
  const swBlank = sw === null;
  const cwBlank = cw === null;
  if (qwBlank && swBlank && cwBlank) return "blank";
  if (typeof qw === "number" && !swBlank && !cwBlank) return "scoring";
  return "incomplete";
}

function normalizeQuestionText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function col(row, names) {
  for (const n of names) {
    if (Object.prototype.hasOwnProperty.call(row, n) && row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== "") {
      return row[n];
    }
  }
  // case-insensitive fallback
  const keys = Object.keys(row);
  for (const n of names) {
    const hit = keys.find((k) => k.trim().toLowerCase() === n.toLowerCase());
    if (hit && row[hit] !== undefined && row[hit] !== null && String(row[hit]).trim() !== "") {
      return row[hit];
    }
  }
  return undefined;
}

if (!fs.existsSync(xlsxPath)) {
  console.error("Workbook not found:", xlsxPath);
  process.exit(1);
}

console.log("Reading", xlsxPath);
const wb = XLSX.readFile(xlsxPath, { cellDates: false });
const questions = [];
const spaceTypeMap = new Map();
const focusSet = new Set();
const incomplete = [];
const blank = [];
const inventory = [];

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  if (!rows.length) continue;

  // forward-fill hierarchy fields within sheet
  let cur = {
    surveyFocus: "",
    scoreFocus: "",
    spaceType: "",
    category: "",
    subcategory: "",
    schoolLevel: "",
    question: "",
    context: "",
    questionType: "",
    questionId: "",
    qw: null,
    sw: null,
    cw: null,
    notes: "",
    sources: "",
  };

  /** @type {Map<string, any>} questionId+space -> accumulating question */
  const sheetQuestions = new Map();

  for (const row of rows) {
    const qid = col(row, ["QuestionID", "Question ID"]);
    const surveyFocus = col(row, ["Survey Focus Area"]);
    const scoreFocus = col(row, ["Score Focus Area"]);
    const spaceType = col(row, ["Space Type"]);
    const category = col(row, ["Category"]);
    const subcategory = col(row, ["Subcategory"]);
    const schoolLevel = col(row, ["School Level"]);
    const question = col(row, ["Question"]);
    const context = col(row, ["Context"]);
    const questionType = col(row, ["Question Type"]);
    const scoreId = col(row, ["ScoreID", "Score ID"]);
    const responseOption = col(row, ["Response Option"]);
    const optionScore = col(row, ["Option Score"]);
    const sources = col(row, ["Source(s)", "Sources"]);
    const notes = col(row, ["Notes"]);
    const qwRaw = col(row, ["Question Weight"]);
    const swRaw = col(row, ["Subcategory Weight"]);
    const cwRaw = col(row, ["Category Weight"]);

    if (surveyFocus !== undefined) cur.surveyFocus = String(surveyFocus);
    if (scoreFocus !== undefined) cur.scoreFocus = String(scoreFocus);
    if (spaceType !== undefined) cur.spaceType = String(spaceType);
    if (category !== undefined) cur.category = String(category);
    if (subcategory !== undefined) cur.subcategory = String(subcategory);
    if (schoolLevel !== undefined) cur.schoolLevel = String(schoolLevel);
    if (question !== undefined) cur.question = String(question);
    if (context !== undefined) cur.context = String(context);
    if (questionType !== undefined) cur.questionType = String(questionType);
    if (sources !== undefined) cur.sources = String(sources);
    if (notes !== undefined) cur.notes = String(notes);

    // weights: only update when present on this row (first question row typically)
    const qwOnRow = qwRaw !== undefined;
    const swOnRow = swRaw !== undefined;
    const cwOnRow = cwRaw !== undefined;

    if (qid !== undefined && String(qid).trim()) {
      cur.questionId = String(qid).trim();
      // reset weights at new question from this row's values
      cur.qw = qwOnRow ? parseWeight(qwRaw) : null;
      cur.sw = swOnRow ? parseWeight(swRaw) : null;
      cur.cw = cwOnRow ? parseWeight(cwRaw) : null;
    } else {
      if (qwOnRow) cur.qw = parseWeight(qwRaw);
      if (swOnRow) cur.sw = parseWeight(swRaw);
      if (cwOnRow) cur.cw = parseWeight(cwRaw);
    }

    if (!cur.questionId || !cur.spaceType) continue;

    const spaceTypeId = `${slug(sheetName)}__${slug(cur.spaceType)}`;
    if (!spaceTypeMap.has(spaceTypeId)) {
      const fa = cur.scoreFocus || cur.surveyFocus || "Unspecified";
      focusSet.add(fa);
      spaceTypeMap.set(spaceTypeId, {
        id: spaceTypeId,
        name: cur.spaceType,
        focusArea: fa,
        sheet: sheetName,
      });
    } else {
      // prefer first non-empty score focus already set
    }

    const qKey = `${spaceTypeId}::${cur.questionId}`;
    let q = sheetQuestions.get(qKey);
    if (!q) {
      q = {
        key: qKey,
        id: cur.questionId,
        spaceTypeId,
        category: cur.category,
        subcategory: cur.subcategory,
        schoolLevel: cur.schoolLevel || "ALL",
        text: cur.question,
        context: cur.context || undefined,
        type: cur.questionType || "",
        qw: cur.qw,
        sw: cur.sw,
        cw: cur.cw,
        options: [],
        surveyFocus: cur.surveyFocus,
        scoreFocus: cur.scoreFocus,
        notes: cur.notes || undefined,
        sources: cur.sources || undefined,
      };
      sheetQuestions.set(qKey, q);
    }

    if (responseOption !== undefined || scoreId !== undefined || optionScore !== undefined) {
      q.options.push({
        scoreId: scoreId !== undefined ? String(scoreId) : "",
        label: responseOption !== undefined ? String(responseOption) : "",
        score: parseOptionScore(optionScore),
        schoolLevel: cur.schoolLevel || undefined,
      });
    }
  }

  for (const q of sheetQuestions.values()) {
    questions.push(q);
    const role = classifyWeights(q.qw, q.sw, q.cw);
    if (role === "incomplete") {
      incomplete.push({
        key: q.key,
        id: q.id,
        space: q.spaceTypeId,
        qw: q.qw,
        sw: q.sw,
        cw: q.cw,
        text: q.text.slice(0, 120),
      });
    } else if (role === "blank") {
      blank.push({ key: q.key, id: q.id, space: q.spaceTypeId });
    } else if (role === "inventory") {
      inventory.push({ key: q.key, id: q.id, space: q.spaceTypeId });
    }
  }
}

// Auto similarity groups
const byNorm = new Map();
for (const q of questions) {
  const n = normalizeQuestionText(q.text);
  if (!n) continue;
  const list = byNorm.get(n) ?? [];
  list.push(q);
  byNorm.set(n, list);
}
const similarityGroups = [];
let gi = 0;
for (const [normalizedText, qs] of byNorm) {
  if (qs.length < 2) continue;
  similarityGroups.push({
    id: `auto-${gi++}`,
    normalizedText,
    sampleText: qs[0].text,
    questionKeys: qs.map((q) => q.key),
  });
}
similarityGroups.sort((a, b) => b.questionKeys.length - a.questionKeys.length);

const catalog = {
  meta: {
    sourceFile: path.basename(xlsxPath),
    generatedAt: new Date().toISOString(),
    school: "AISD",
  },
  focusAreas: [...focusSet].sort((a, b) => a.localeCompare(b)),
  spaceTypes: [...spaceTypeMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  questions,
  similarityGroups,
};

const report = {
  generatedAt: catalog.meta.generatedAt,
  totals: {
    sheets: wb.SheetNames.length,
    questions: questions.length,
    spaceTypes: catalog.spaceTypes.length,
    focusAreas: catalog.focusAreas.length,
    autoSimilarityGroups: similarityGroups.length,
    scoring: questions.filter((q) => classifyWeights(q.qw, q.sw, q.cw) === "scoring").length,
    inventory: inventory.length,
    blank: blank.length,
    incomplete: incomplete.length,
  },
  incomplete,
  blankSample: blank.slice(0, 50),
  inventorySample: inventory.slice(0, 50),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
if (!fs.existsSync(overridesSeed)) {
  fs.writeFileSync(overridesSeed, JSON.stringify({ manualLinks: [] }, null, 2));
}

console.log("Wrote", catalogPath);
console.log("Wrote", reportPath);
console.log(JSON.stringify(report.totals, null, 2));
