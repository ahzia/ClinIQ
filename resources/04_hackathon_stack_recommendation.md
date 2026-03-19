# epaCC START Hack 2026 - Recommended Stack (<24h Build)

## Recommended Best Option (for this challenge)

Use a **Python-first data app stack**:

- **Backend + API:** `FastAPI` + `Pydantic`
- **Data processing:** `pandas` + `pyarrow`
- **Data quality checks:** `Great Expectations` (or lightweight custom rules if time is tight)
- **Database:** `PostgreSQL` (or `SQLite` fallback for demo speed), with schema aligned to `DB/CreateImportTables.sql`
- **Queue/background tasks:** `Celery` + `Redis` (optional; skip if team is small)
- **Dashboard/UI:** `Streamlit` (fastest path to clickable prototype + interactive corrections)
- **LLM/NLP layer:** local-first abstraction with `LangChain` (or simple provider wrapper) for:
  - header inference,
  - free-text nursing note extraction,
  - mapping suggestions
- **PDF extraction:** `pdfplumber`
- **Excel ingestion:** `openpyxl`
- **Visualization:** `plotly`
- **Packaging/deploy:** `Docker Compose` (offline-capable demo)

This is the highest probability stack to ship a convincing end-to-end prototype in less than 24 hours.

## Why this is the best fit for judging criteria

### Complexity & technical sophistication (20%)
- Combine deterministic mapping rules with AI-assisted schema inference.
- Handle structured + semi-structured + PDF inputs in one pipeline.

### Viability / business applicability (25%)
- Python + SQL + Docker is practical for on-prem enterprise adoption.
- Easy to integrate with epaSOLUTIONS-compatible SQL workflows.

### Feasibility & maturity (20%)
- FastAPI + Streamlit is fast to implement and stable for demos.
- Most work can be completed with proven libraries and minimal custom infra.

### Creativity & innovation (15%)
- "Human-in-the-loop" mapping assistant (AI suggestions + manual override) is both innovative and useful.

### Design & usability (10%)
- Streamlit enables clean panels for source view, quality alerts, and correction UX quickly.

### Presentation quality (10%)
- Easy to produce live walkthrough: upload -> map -> quality alerts -> corrected output.

## 24-Hour Build Plan (realistic)

## Hour 0-3: Foundation
- Set up FastAPI project + Streamlit app.
- Create canonical target schema (`case`, `patient`, `labs`, `medication`, `device`, `nursing`, `epa`).
- Implement file loader with delimiter/encoding detection.

## Hour 3-8: Ingestion + Harmonization
- Build adapters for:
  - clean canonical CSVs,
  - clinic 2 renamed schemas,
  - clinic 3 broken headers,
  - clinic 4 generic `colN`.
- Add ID normalization + null/date normalization.

## Hour 8-12: Quality + Validation
- Add checks:
  - required keys,
  - schema drift,
  - duplicate composite keys,
  - out-of-range values.
- Generate per-file quality score and alert list.

## Hour 12-16: AI-assisted mapping
- Add LLM helper to propose column mappings and explain confidence.
- Add manual correction form in Streamlit and persist overrides.

## Hour 16-20: Dashboard + demo flow
- Build core screens:
  - source overview,
  - mapping table,
  - anomaly list,
  - corrected output preview.

## Hour 20-24: Polish
- Add Docker Compose.
- Seed demo with 3-4 representative files (clean + clinic2 + clinic3 + PDF).
- Prepare architecture slide and judging-criteria narrative.

## Suggested Project Structure

```text
app/
  api/                 # FastAPI endpoints
  ui/                  # Streamlit pages
  ingest/              # CSV/XLSX/PDF loaders
  mapping/             # column maps + inference
  normalize/           # id/date/null normalization
  quality/             # validation rules and scoring
  models/              # pydantic + db models
  storage/             # db and file persistence
configs/
  mapping_rules/       # per-clinic, per-file rules
  quality_rules/
data/
  raw/
  processed/
docker-compose.yml
```

## Minimal "Must-Have" Features for Demo Success

- Multi-format ingestion (CSV, XLSX, PDF)
- Automatic schema mapping suggestions
- Data quality dashboard (missingness, schema drift, anomalies)
- Manual mapping correction UI
- Export of harmonized dataset into SQL-compatible tables

## If Team Size Is Small (2-3 people)

Use an even leaner variant:

- **Single app:** Streamlit only (no separate FastAPI initially)
- **Storage:** SQLite + parquet
- **Rules:** custom pandas-based checks (skip Great Expectations)
- **AI calls:** one provider wrapper function

Then add FastAPI only if time remains.

## Final Recommendation

For this hackathon, the best balance is:

**`FastAPI + Streamlit + pandas + PostgreSQL + pdfplumber + openpyxl + Docker`**, with lightweight AI mapping assistance.

It is strong on technical depth and business viability while still realistic to build and demo in under 24 hours.
