# ESA Scoring Review

Local app for browsing AISD ESA survey weights, comparing the same question across space types, suggesting weights from similar questions, and collecting offline company reviews.

## Quick start

```bash
# Use portable Node if needed
# $env:Path = "$env:LOCALAPPDATA\node-portable;" + $env:Path

npm install
npm run import-xlsx
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

Re-import after Excel changes:

```bash
npm run import-xlsx -- "C:\path\to\AISD ESA Survey Final Draft_Copy.xlsx"
```

## Admin tabs

- **Overview** — counts by focus area, weight quality flags
- **Hierarchy** — AISD → Focus Area → Space Type → Category → Subcategory → Question (with “also asked in” peer scores)
- **Import / Export** — standalone reviewer HTML for companies; import suggestions; optional manual similarity links
- **Reviewer** — comparative 3/6/9/12 scoring with peer scores shown under each question

## Company workflow

1. In Import / Export, **Download standalone reviewer HTML** and send the file.
2. Reviewer opens it, picks a **space type**, then:
   - scores **subcategories within each category** on a **3 / 6 / 9 / 12** scale (12 = highest importance)
   - scores **questions within each subcategory** on the same **3 / 6 / 9 / 12** scale
3. They download JSON; you **Import suggestions JSON** and compare on question pages or via CSV.

## Data

- `public/data/catalog.json` — generated catalog
- `public/data/quality-report.json` — incomplete / blank / inventory summary
- `public/data/similarity-overrides.json` — seed file for manual links (browser overrides take precedence once edited)

## Scoring reminder

Weight `i` = inventory (excluded). Fully blank weights = excluded. Partial blanks = incomplete (flagged). Peer suggestion = median of scoring peers in other space types linked by auto group or manual link.
