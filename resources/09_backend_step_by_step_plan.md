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
- [ ] Step 12 - deterministic normalization
- [ ] Step 13 - mapping configs
- [ ] Step 14-17 - intelligence layer
- [ ] Step 18-20 - quality engine
- [ ] Step 21-22 - persistent storage + export
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
  - `GET /api/v1/mapping/alerts`
  - `GET /api/v1/quality/summary`
  - `GET /api/v1/quality/by-source`

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
19. Compute per-file and per-category metrics:
   - clean / missing / incorrect percentages
20. Generate mapping and quality alerts for frontend display.

## Phase 6 - Storage + Export

21. Persist harmonized records in SQL tables.
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
