# Backend Step-by-Step Plan (MVP First)

Constraint acknowledged:
- No heavy orchestration frameworks unless they add clear value.
- Lightweight LLM usage is acceptable.
- Focus on core intelligent mapping feature first.

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
