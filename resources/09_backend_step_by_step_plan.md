# Backend Step-by-Step Plan (MVP First)

Constraint acknowledged:
- No heavy orchestration frameworks unless they add clear value.
- Lightweight LLM usage is acceptable.
- Focus on core intelligent mapping feature first.

## Execution Status

Status labels:
- `REAL` = production-style implementation (non-mock behavior)
- `REAL+MEM` = real logic but state is in-memory (not DB persisted)
- `FIXTURE` = response still fixture-backed/mock data

- [x] Step 1 - backend workspace created (`REAL`)
- [x] Step 2 - challenge dataset/docs moved into backend workspace (`REAL`)
- [x] Step 3 - folder structure created (`REAL`)
- [x] Step 4 - dependencies initialized (`REAL`)
- [x] Step 5 - FastAPI app + health endpoint created (`REAL`)
- [x] Step 6 - settings loader (`.env`) added (`REAL`)
- [x] Step 7 - structured logging and request IDs (`REAL`)
- [x] Step 8 - upload endpoint implemented (`REAL+MEM`: upload saved to disk, metadata in memory)
- [x] Step 9 - parser adapters implemented (`REAL`)
- [x] Step 10 - source categorization added for uploaded files (`REAL+MEM`)
- [x] Step 11 - canonical model entities (`REAL`)
- [x] Step 12 - deterministic normalization (`REAL`, preview-layer)
- [x] Step 13 - mapping configs (`REAL`, config-driven mapping preview)
- [x] Step 14-17 - intelligence layer (`REAL+MEM`: step 14-16 runtime logic, step 17 memory persisted in-memory)
- [x] Step 18-20 - quality engine (`REAL`: sample-based runtime checks + computed metrics/alerts)
- [~] Step 21-22 - persistent storage + export (Step 21 done for SQL persistence validation path; Step 22 pending)
- [x] AI-assisted mapping baseline (`REAL`: OpenAI-compatible provider abstraction + dual-score endpoint; requires API key for live model calls)
- [x] Step 23 - frontend-required API surface implemented (`MIXED`: `REAL` + `REAL+MEM` + `FIXTURE`)
- [x] Step 24 - rerun mapping endpoint implemented (`REAL+MEM`, currently queue-stub behavior)
- [ ] Step 25-27 - tests, demo hardening, Docker

## Status Discipline Rule (Important)

From now on, every completed step must include:
1. a status label (`REAL`, `REAL+MEM`, or `FIXTURE`),
2. test evidence (endpoint/command and observed result),
3. explicit note of what is still mocked/fixture-backed.

No step should be marked complete without these three items.

## Organizer Clarification Alignment (Must Follow)

- Validation reference dataset:
  - use `Checkdata-final.zip` (latest official validation package).
- Target standard:
  - conform output shape with `DB/CreateImportTables.sql`.
- Scope:
  - no patient condition analysis needed.
- Data intent:
  - `mit_Fehlern` -> error detection/cleaning tests
  - `split_data...` -> mapping robustness tests
  - `ohne_Fehler` -> baseline correctness tests
- Identity mapping:
  - use `patient_id` + datetime heuristics when `case_id` missing
  - unresolved/contradictory identity must raise alerts and go to manual queue

## Locked Decisions From Latest Team + Organizer Insights

- AI usage is in scope and required for competitiveness:
  - deterministic mapping remains baseline, but AI-assisted semantic disambiguation must be included for unknown/multilingual/abbreviated headers.
- Auto-accepted/final mapped outputs must align with:
  - `DB/CreateImportTables.sql` structure,
  - and should be validated by writing into a DB with same schema in later phases.
- Missing-`case_id` linking policy:
  - use configurable `patient_id + datetime` window (safe default first),
  - expose this as a settings/config value (future UI control).
- Identity conflicts (example: contradictory demographic attributes for same key):
  - must trigger alerts,
  - route severity (`warning` vs `manual_review`) should be degree-based.

## AI-Assisted Requirement (Tracked, In-Scope)

For fields/routes currently ending in `warning` or `manual_review`, implement a future **safe AI-assist stage**:

- Objective:
  - reduce manual load without sacrificing trust and traceability.
- Scope:
  - ambiguous mappings, weak headers, and unstructured text extraction.
- Safety requirements (mandatory):
  1. deterministic pipeline remains primary; AI is a secondary disambiguation layer,
  2. structured AI output only (schema-validated JSON),
  3. confidence threshold gating before auto-apply,
  4. explanation/rationale captured for each AI-assisted suggestion,
  5. low-confidence or conflicting outputs must remain in manual review queue.

Implementation placement:
- start in next implementation phases after quality baseline is stable.
- initial target:
  - AI assist for unknown header mapping and multilingual/abbreviation normalization.

## Dual-Scoring Decision Policy (Future Step Requirement)

Implement a two-phase confidence strategy:

1. **Deterministic score** (current baseline)
   - rules, lexical match, value patterns, cross-field consistency, history prior.
2. **AI-assisted score** (future layer)
   - semantic disambiguation and contextual mapping confidence from AI model.

Decision logic (future target):
- combine both scores into `final_decision_score` with configurable weights.
- only allow `auto` when:
  - both scores pass minimum threshold, and
  - there is no conflict flag.
- otherwise route to:
  - `warning` or `manual_review` with explicit reason codes.

Suggested baseline weighting (configurable):
- deterministic: `0.6`
- AI-assisted: `0.4`

## Explainability Requirement for Unresolved Items (Future Step Requirement)

For every field still in `warning` or `manual_review` after both phases, store a structured explanation record.

Minimum fields to store:
- source file id / source field
- top deterministic candidate + score + reason
- top AI candidate + score + reason
- conflict details (if deterministic and AI disagree)
- final route decision (`warning` or `manual_review`)
- user-facing explanation text
- recommended next action (e.g., "needs dictionary entry", "ambiguous date field", "missing key context")

Why this is required:
- improves trust and transparency,
- makes manual correction faster,
- provides clear dashboard explanations for why mapping could not be auto-accepted.

## Step 9 Completion Notes (Done)

- `GET /api/v1/files/{file_id}/preview` now parses real files instead of fixture-only response.
- Supported preview parsers:
  - CSV (delimiter sniff + encoding fallback)
  - XLSX (first sheet)
  - PDF (text line extraction)
  - TXT (line preview)
- Uploaded files are now registered in an in-memory store and visible in:
  - `GET /api/v1/files`
  - `GET /api/v1/files/{file_id}`
  - `GET /api/v1/files/{file_id}/preview`
- Smoke-tested successfully with both fixture IDs and real uploaded files.

## Step 7 Completion Notes (Done)

- Added structured request logging with method/path/status/duration.
- Added request ID middleware:
  - accepts inbound `X-Request-ID` if provided
  - generates UUID when missing
  - returns `X-Request-ID` header in responses
- Smoke-tested:
  - `GET /api/v1/health` with custom `X-Request-ID` returns same header.
  - request logs include the request ID for traceability.

## Step 11 Completion Notes (Done)

- Added canonical entity definitions for:
  - patient, case, assessment, labs, medication, device, nursing, diagnosis_procedure
- Added API endpoint:
  - `GET /api/v1/mapping/canonical-model`
- Frontend can now use this endpoint as the target-field catalog for:
  - correction UI dropdowns
  - mapping review screens
  - future "target schema explorer" panel

## Current API Maturity Snapshot

- `REAL`:
  - `GET /api/v1/health`
  - `POST /api/v1/ingest/upload` (disk write path)
  - `GET /api/v1/files/{file_id}/preview`
  - `GET /api/v1/mapping/canonical-model`
  - `GET /api/v1/mapping/normalize-preview/{file_id}`
  - `GET /api/v1/mapping/configs`
  - `GET /api/v1/mapping/configs/{source_id}`
  - `GET /api/v1/mapping/mapped-preview/{file_id}`
  - `GET /api/v1/mapping/hypotheses/{file_id}`
  - `GET /api/v1/mapping/confidence/{file_id}`
  - `GET /api/v1/mapping/ai-assist/{file_id}`
  - `POST /api/v1/mapping/route/{file_id}`
  - `GET /api/v1/mapping/alerts` (quality-derived runtime alerts)
  - `GET /api/v1/quality/summary`
  - `GET /api/v1/quality/by-source`
  - `GET /api/v1/meta/runtime-config`
  - `POST /api/v1/storage/sql-load/{file_id}`
  - request logging + `X-Request-ID` middleware

- `REAL+MEM`:
  - `GET /api/v1/files` (fixture list + in-memory uploads)
  - `GET /api/v1/files/{file_id}` (fixture template + in-memory uploads)
  - `GET /api/v1/corrections/queue`
  - `POST /api/v1/corrections/{id}/approve`
  - `POST /api/v1/corrections/{id}/reject`
  - `PATCH /api/v1/corrections/{id}`
  - `POST /api/v1/mapping/rerun`

- `FIXTURE`:
  - `GET /api/v1/sources`
  - `GET /api/v1/mapping/summary`

## Step 18-20 Completion Notes (Done)

- Added runtime quality engine module:
  - `app/quality/engine.py`
- Implemented file-level quality checks over parsed table previews:
  - missing required IDs (`case_id`/`patient_id` aliases)
  - schema drift detection (generic/data-like headers)
  - invalid value pattern checks (binary/date-like fields)
  - duplicate composite keys (`patient_id + datetime`)
  - identity conflict detection with severity
- Added configurable identity-link runtime defaults:
  - `CASE_LINK_WINDOW_HOURS` (default `6`)
  - `IDENTITY_CONFLICT_HIGH_THRESHOLD` (default `2`)
  - exposed via `GET /api/v1/meta/runtime-config`
- Replaced fixture-backed quality endpoints with runtime-computed payloads:
  - `GET /api/v1/quality/summary`
  - `GET /api/v1/quality/by-source`
- Replaced fixture-backed mapping alerts with runtime-generated quality/mapping alerts:
  - `GET /api/v1/mapping/alerts`

Test evidence:
- `GET /quality/summary` returned computed score/KPIs:
  - `overall_quality_score=49`
  - `files_with_schema_drift=1`
- `GET /quality/by-source` returned computed per-source aggregates:
  - `by_source_items=4`
- `GET /mapping/alerts` returned runtime alert types:
  - `duplicate_composite_key`, `missing_required_ids`, `schema_drift`, `value_pattern_anomaly`
- `GET /meta/runtime-config` returned:
  - `case_link_window_hours=6`

## Step 21 Completion Notes (Done)

- Added SQL schema conformance + persistence validation module:
  - `app/storage/sql_conformance.py`
- Schema source of truth:
  - parses `epaCC-START-Hack-2026/DB/CreateImportTables.sql`
- Added runtime endpoint:
  - `POST /api/v1/storage/sql-load/{file_id}`
- Runtime behavior:
  - computes auto-mapped fields from confidence output
  - maps auto targets to SQL-table columns by source type
  - validates mapped SQL columns against parsed SQL schema table
  - inserts sampled mapped rows into persistent sqlite DB:
    - default path: `backend/data/processed/harmonized.sqlite`
- Added config:
  - `PROCESSED_DB_PATH` (default `data/processed/harmonized.sqlite`)

Test evidence:
- `POST /storage/sql-load/f_clinic2_device` returned:
  - `target_table=tbImportDeviceMotionData`
  - `schema_conformance_percent=100`
  - `rows_attempted=20`, `rows_inserted=20`, `rows_failed=0`
- Verified DB persistence:
  - sqlite file exists at `data/processed/harmonized.sqlite`
  - table row count check: `tbImportDeviceMotionData_rows=20`
- `POST /storage/sql-load/f_epaac_1` in validation mode also completed without endpoint errors.

## AI-Assisted Mapping Baseline Notes (Done)

- Added provider abstraction:
  - `app/ai/provider.py`
- Current provider mode:
  - OpenAI-compatible `chat/completions` API via env-configured base URL/model.
- Added dual-score combiner module:
  - `app/mapping/ai_assist.py`
- Added endpoint:
  - `GET /api/v1/mapping/ai-assist/{file_id}`
- Output includes per-source-field:
  - deterministic target/score
  - AI target/score
  - conflict flag
  - final target/final score
  - final route (`auto`/`warning`/`manual_review`)
- Added runtime AI configs:
  - `AI_ENABLED`, `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_TIMEOUT_SECONDS`
  - exposed via `GET /api/v1/meta/runtime-config`

Test evidence:
- `GET /mapping/ai-assist/f_clinic2_device` returns stable dual-score payload shape.
- Without API key, endpoint degrades safely:
  - `ai_available=false`
  - deterministic baseline still returned with clear notes.

## Step 12 Completion Notes (Done)

- Implemented deterministic normalization module:
  - `app/mapping/normalization.py`
- Added normalization API endpoint:
  - `GET /api/v1/mapping/normalize-preview/{file_id}`
- Current normalization behaviors:
  - ID normalization:
    - case aliases -> `normalized_case_id` (`CASE-XXXX` style)
    - patient aliases -> `normalized_patient_id` (`PAT-XXXX` style)
  - null token normalization (`NULL`, `N/A`, `Missing`, blanks, etc.)
  - datetime normalization to ISO-like strings for date-like columns
- Includes normalization stats in response:
  - rows processed, IDs normalized, datetime conversions, source key columns

Test evidence:
- `f_epaac_1` normalization:
  - detected `FallID` and `PID`
  - produced normalized case/patient IDs
  - converted `Einschätzung`/`Aufnahme` timestamps
- `f_clinic2_device` normalization:
  - detected `id` as patient key
  - produced normalized patient IDs
- PDF case:
  - endpoint returns `pdf_text` with note "table-only normalization"

## Step 13 Completion Notes (Done)

- Added source-specific mapping config files under:
  - `configs/mapping_rules/`
  - `labs.json`
  - `medication.json`
  - `device_motion.json`
  - `diagnoses_icd_ops.json`
  - `nursing_reports.json`
  - `assessments_epaac.json`
- Added config loader and mapping applier:
  - `app/mapping/config_mapping.py`
- Added config and mapped-preview endpoints:
  - `GET /api/v1/mapping/configs`
  - `GET /api/v1/mapping/configs/{source_id}`
  - `GET /api/v1/mapping/mapped-preview/{file_id}`

Test evidence:
- `GET /mapping/configs` returned all config files.
- `GET /mapping/configs/device_motion` returned expected rule set.
- `GET /mapping/mapped-preview/f_clinic2_device` mapped `date->timestamp`, `id->patient_id`, `idx_mov->movement_index_0_100`, etc.
- `GET /mapping/mapped-preview/f_epaac_1` mapped epaAC fields (`FallID/FallNr`, `PID`, `SID`, `SID_value`) to canonical target fields.

## Step 14 Completion Notes (Done)

- Implemented mapping hypothesis generator:
  - module: `app/mapping/hypothesis.py`
  - approach: config aliases + lexical similarity against canonical target catalog
- Added API endpoint:
  - `GET /api/v1/mapping/hypotheses/{file_id}`
- Output per source column:
  - top target candidates
  - score (0-1)
  - reason
  - signal type (`correction_memory` / `config_exact` / `fuzzy`)

Test evidence:
- `GET /mapping/hypotheses/f_clinic2_device`:
  - correctly inferred candidates such as:
    - `date -> timestamp` (config exact)
    - `id -> patient_id` (config exact)
    - `idx_mov -> movement_index_0_100` (config exact)
- `GET /mapping/hypotheses/f_epaac_1`:
  - correctly inferred candidates such as:
    - `FallID -> case_id`
    - `PID -> patient_id`
    - `SID -> item_id`
    - `SID_value -> item_value`
- PDF file behavior:
  - returns table-only support note and empty candidate set.

## Step 15 Completion Notes (Done)

- Implemented confidence scoring module:
  - `app/mapping/confidence.py`
- Uses four signals per source field:
  - semantic name similarity
  - value pattern match
  - cross-field consistency
  - history prior (accepted/edited correction targets)
- Added endpoint:
  - `GET /api/v1/mapping/confidence/{file_id}`
- Routing thresholds implemented:
  - `auto` if score >= 0.85
  - `warning` if score >= 0.60
  - `manual_review` otherwise

Test evidence:
- `GET /mapping/confidence/f_clinic2_device` produced mixed routing:
  - auto: 1, warning: 5, manual_review: 2
  - with correct high-confidence mappings like `date -> timestamp`.
- `GET /mapping/confidence/f_epaac_1` produced mixed routing:
  - auto: 2, warning: 4, manual_review: 3
  - surfaced ambiguous fields (`Aufnahme`, `Entlassund`) as manual review.

## Step 16 Completion Notes (Done)

- Implemented route persistence endpoint:
  - `POST /api/v1/mapping/route/{file_id}`
- Runtime behavior:
  - runs confidence scoring for the selected file
  - stores `auto` routes outside manual queue
  - pushes unresolved routes to correction queue as `pending_review`
  - clears/rebuilds prior route-generated queue rows for same file (idempotent rerun behavior)
- Queue generation metadata:
  - route-generated rows carry `generated_by = routing_engine`

Test evidence:
- `POST /mapping/route/f_clinic2_device` returned:
  - `auto_count=1`, `warning_count=5`, `manual_review_count=2`, `queued_items_added=7`
- `GET /corrections/queue` showed generated route rows (IDs prefixed `rt_`) for `f_clinic2_device`.
- Re-running route after one approved correction reduced unresolved queue rows:
  - `routed_items_after_reroute=6` (one field moved to auto path due learned memory).

## Step 17 Completion Notes (Done)

- Added source-scoped correction memory reuse in hypothesis/confidence.
- Accepted/edited corrections now become hints for future mapping passes.
- Added new hypothesis signal:
  - `correction_memory` (exact source field seen in accepted/edited correction history)
- Current persistence mode:
  - in-memory only (resets after backend restart).

Test evidence:
- Approved routed correction sample:
  - `id=rt_...`, `source_field=id`, `suggested_target=patient_id`
- `GET /mapping/hypotheses/f_clinic2_device` then returned:
  - `memory_hit(id)=True`
  - top candidate for `id`: `patient_id` with signal `correction_memory`
- `GET /mapping/confidence/{file_id}` now consumes this memory-enhanced hypothesis input.

## Phase 0 - Workspace Setup

1. Create backend workspace under `Project/code/backend`.
2. Move challenge dataset/docs into backend workspace so ingestion and tests run locally in one place.
3. Define folder structure:
   - `app/api`
   - `app/core`
   - `app/ingest`
   - `app/mapping`
   - `app/quality`
   - `app/storage`
   - `data/raw`
   - `data/processed`
   - `configs`

## Phase 1 - Backend Skeleton (FastAPI)

4. Initialize Python project and dependencies.
5. Create FastAPI app with health endpoint and versioned API prefix.
6. Add config loader (`.env` + settings module).
7. Add structured logging and request IDs.

## Phase 2 - Ingestion Core

8. Build file ingestion endpoint:
   - accepts CSV/XLSX/PDF
   - stores original file metadata
9. Implement parser adapters:
   - CSV with delimiter/encoding sniffing
   - XLSX via `openpyxl`
   - PDF text extraction via `pdfplumber`
10. Add source categorization (labs, meds, nursing, device, ICD/OPS, epaAC).

## Phase 3 - Canonicalization

11. Define canonical model entities:
   - patient, case, labs, medication, device, nursing, assessment
12. Implement deterministic normalization:
   - ID normalization (`case_id`, `patient_id`)
   - null token normalization
   - date normalization
13. Add per-source mapping config files (YAML/JSON).

## Phase 4 - Intelligence Layer (Lightweight)

14. Implement mapping hypothesis generator:
   - candidate target fields for unseen source columns
15. Implement confidence scoring with 4 signals:
   - semantic name similarity
   - value pattern match
   - cross-field consistency
   - prior accepted mapping history
16. Implement routing:
   - high confidence auto-apply
   - medium apply-with-warning
   - low confidence -> manual review queue
17. Persist human corrections and reuse as future mapping hints.

## Phase 5 - Quality + Alerts

18. Add quality checks:
   - missing required IDs
   - schema drift
   - invalid value patterns/ranges
   - duplicate composite keys
   - identity conflict severity classification (`warning` / `manual_review`)
19. Compute per-file and per-category metrics:
   - clean / missing / incorrect percentages
20. Generate mapping and quality alerts for frontend display.

## Phase 6 - Storage + Export

21. Persist harmonized records in SQL tables.
   - validate auto-accepted mapped outputs against SQL target schema
   - run insertion test into DB using `CreateImportTables.sql` compatible structure
22. Add export endpoints:
   - normalized CSV/JSON
   - optional FHIR subset export (Patient/Encounter/Observation first).

## Phase 7 - API Endpoints Needed by Frontend

23. Implement endpoints for:
   - ingestion status and file counts
   - mapping status and alerts
   - data source category summary
   - manual correction CRUD
   - quality insights per category
24. Add one endpoint for "re-run mapping with saved corrections."

## Phase 8 - Demo-Ready Hardening

25. Add smoke tests for ingestion, mapping, quality pipeline.
26. Prepare seeded demo run using:
   - one clean CSV
   - one altered schema CSV
   - one PDF report
27. Add Docker setup for local on-prem style run.

## Initial 24h Delivery Cutline

Must-have by end of day:
- ingestion + parsing
- canonical mapping + confidence
- manual correction queue
- quality metrics API
- stable persistence

Stretch only if time remains:
- FHIR export
- advanced anomaly detection
- richer correction memory heuristics
