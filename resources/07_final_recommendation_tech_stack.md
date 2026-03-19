# Final Recommendation - Tech Stack and Build Strategy

This is the final recommendation after considering:
- challenge requirements,
- judging criteria,
- dataset findings,
- your team decision to use **Next.js frontend**,
- and the need to build something unique (not generic ETL).

## Final Stack (Recommended)

## Frontend (fixed by team)
- **Next.js (App Router)**
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query**
- **Recharts** (or ECharts) for quality/coverage charts

Why:
- Best chance for strong usability/design points with a polished demo UX.

## Backend
- **Python + FastAPI**
- **Pydantic** for typed contracts
- **Uvicorn** runtime

Why:
- Fastest way to implement complex data parsing, normalization, and mapping logic.

## Data Processing / Mapping Engine
- **pandas + pyarrow**
- **openpyxl** (XLSX)
- **pdfplumber** (PDF)
- built-in CSV sniffing for delimiter/encoding detection

Why:
- Your dataset is heterogeneous and messy. Python data tooling is the shortest path to reliable transforms in hackathon time.

## Data Store
- **PostgreSQL** (primary recommendation)
- **SQLite fallback** (if infrastructure/time is constrained)

Why:
- Business credibility + easy querying + stable demo persistence.

## AI Layer (Scoped, Practical)
- Lightweight LLM integration (single provider wrapper or local model endpoint)
- Use only for:
  - ambiguous column mapping suggestions,
  - free-text to structured candidate extraction,
  - mapping explanation generation

Why:
- Adds innovation without making the system fragile.

## Validation / Quality
- Start with **custom rule engine** (required IDs, null tokens, date parsing, value range checks, duplicates by composite keys)
- Optional: add **Great Expectations** if time remains

Why:
- Custom rules are quicker to ship and easier to debug in 24h.

## Deployment
- **Docker Compose** (Next.js + FastAPI + DB)
- Keep all processing local/on-prem compatible

Why:
- Directly aligns with the "on-premises/offline-capable" requirement.

## Product Strategy (How to be different)

Build a **Trust Layer for Data Mapping**, not only a parser:

- mapping confidence score per field
- explainable rationale for mapping
- risk labels and mapping alerts
- manual correction queue
- "save correction as reusable rule" (learning loop)
- data lineage (source file -> mapped field)

This is the strongest differentiator against teams building only static pipelines.

## FHIR Position (Final Decision)

Use **FHIR as an export/interoperability layer**, not as day-1 core storage dependency.

Recommended in hackathon scope:
- Canonical internal model first
- Export subset to FHIR JSON for key resources:
  - `Patient`
  - `Encounter`
  - `Observation`
  - `Condition`
  - `Procedure`
  - `MedicationRequest`
- Optional stretch: push subset to HAPI FHIR if stable

Avoid for MVP:
- full HAPI FHIR-first architecture
- full toFHIR pipeline dependency

Reason:
- Great value, but too risky to make the demo depend on it in <24h.

## Tool Decisions (Final)

- **AnythingLLM**: optional only; use if team can integrate fast and tie to correction workflow
- **HAPI FHIR**: stretch/bonus integration
- **toFHIR**: optional accelerator for limited export only
- **MCP server**: skip for MVP (low judging ROI)
- **Next.js frontend**: yes (already fixed and good choice)

## MVP Scope (Must Deliver)

1. Ingest CSV/XLSX/PDF and categorize source type
2. Auto-map to canonical model with confidence scores
3. Show mapping alerts + manual correction flow
4. Show dashboard metrics:
   - files imported
   - successful mappings
   - mapping alerts
   - quality breakdown per category (clean/missing/incorrect)
5. Persist outputs in SQL
6. Export harmonized output (+ optional FHIR subset)

## Stretch Scope (Only if Core is done)

- FHIR subset export with validation report
- HAPI FHIR push
- correction memory auto-reapplication across new files
- anomaly detection enhancements

## Why this maximizes judging score

- **Viability (25%)**: on-prem, auditable, standards-aware path (FHIR-ready)
- **Complexity (20%)**: hybrid intelligence (rules + AI + confidence + human loop)
- **Feasibility (20%)**: realistic 24h architecture with stable components
- **Creativity (15%)**: trust layer + what-if/correction memory concept
- **Design (10%)**: strong Next.js UX
- **Presentation (10%)**: clear end-to-end story and measurable outputs

## One-Line Final Recommendation

Build a **Next.js + FastAPI + pandas + Postgres** platform with a **trust-centered autonomous mapping engine**, and position **FHIR as a high-value export layer** (core subset now, full integration later).
