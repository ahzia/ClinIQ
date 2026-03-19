# Suggested Packages (Now) + Future Product Vision

This note captures:
- recommended packages for the current phase,
- what each package solves,
- and how the product can evolve into a smarter AI-assisted system without unnecessary complexity.

## 1) Package Recommendations for Now (MVP)

Focus: ship fast, be reliable, stay hackathon-friendly.

## Core API + Backend
- `fastapi`
- `uvicorn`
- `pydantic`
- `pydantic-settings`
- `python-multipart`

Why:
- fast endpoint development, typed contracts, quick iteration with frontend.

## Data Processing + Ingestion
- `pandas`
- `pyarrow`
- `openpyxl`
- `pdfplumber`

Why:
- handles mixed source formats (CSV/XLSX/PDF) with minimal custom plumbing.

## Persistence
- `sqlalchemy`
- `psycopg2-binary` (PostgreSQL)

Why:
- stable SQL storage and clear path to production-grade persistence.

## Smart Mapping (High ROI AI/NLP additions now)
- `rapidfuzz`
- `sentence-transformers`

Why:
- `rapidfuzz`: fast lexical column matching
- `sentence-transformers`: semantic similarity for unknown headers

Together they create a practical "smart matching" layer without overengineering.

## Optional but Recommended Soon (after MVP baseline works)
- `pandera` (schema validation)
- `fhir.resources` (FHIR model serialization)
- `alembic` (database migrations)

Why:
- improves quality, interoperability, and maintainability quickly.

## 2) LLM / NLP / AI - Where It Should Be Used

Use AI where ambiguity is high; keep deterministic logic where correctness is critical.

## Keep deterministic (rules-based)
- file parsing
- null/date normalization
- required-key validation
- DB writes and transactions

## Use AI/NLP
- infer mapping candidates for unknown column names
- extract structured facts from nursing free text / PDF text
- generate mapping rationale and confidence explanation
- suggest manual-correction shortcuts

## Suggested practical AI setup
- thin LLM wrapper (single interface in backend)
- configurable model providers:
  - local model endpoint (preferred for on-prem story)
  - API provider fallback
- strict JSON output schema for model responses (no free-form parsing)

## 3) Suggested "Smart but Simple" Architecture

1. Ingest file (CSV/XLSX/PDF)
2. Parse and normalize deterministically
3. Run smart mapper:
   - lexical score (`rapidfuzz`)
   - semantic score (`sentence-transformers`)
   - optional LLM tie-breaker for ambiguous fields
4. Confidence-based routing:
   - high: auto-apply
   - medium: apply with warning
   - low: send to manual queue
5. Save corrections and reuse as rules in next run

This gives genuine intelligence while keeping behavior controllable.

## 4) Future Product Vision (Post-Hackathon)

## Version 1 (current target)
- ingestion + smart mapping + quality alerts + manual correction
- SQL persistence
- dashboard metrics:
  - files imported
  - mapping success
  - mapping alerts
  - quality by category

## Version 2 (next milestone)
- correction memory with rule learning
- FHIR subset export (`Patient`, `Encounter`, `Observation`, `Condition`, `Procedure`, `MedicationRequest`)
- richer NLP extraction for clinical notes

## Version 3 (scalable product)
- policy-driven mapping engine per institution
- explainable trust score and governance audit logs
- on-prem packaging and institution-specific model tuning

## 5) What Not to Add Too Early

- full multi-agent orchestration
- full HAPI FHIR-first dependency
- heavy frameworks that do not improve core mapping quality in demo window

Rule:
- if a tool does not improve mapping quality, trust, or UX within a few hours, postpone it.

## 6) Practical "Install Next" Shortlist

If adding packages immediately, prioritize:
1. `rapidfuzz`
2. `sentence-transformers`
3. `pandera`
4. `fhir.resources`
5. `alembic`

This sequence gives maximum value with minimum disruption.
