# ClinIQ

**Clinical Intelligence Querying**

ClinIQ is an intelligent healthcare data harmonization platform for the START Hack challenge.  
It ingests heterogeneous sources (CSV/XLSX/PDF/free text), maps them into a unified structure, and exposes quality, mapping, and correction workflows through frontend-friendly APIs.

## Project Goals

- Automatically ingest and parse multi-format healthcare data
- Normalize and align source fields to a unified model
- Surface data quality, mapping confidence, and anomalies
- Support manual correction and iterative mapping improvement
- Stay on-prem/offline compatible

## Repository Structure

```text
code/
  backend/
    app/                      # FastAPI backend
    configs/fixtures/         # API fixture data used by stub endpoints
    data/                     # runtime raw/processed files (ignored by git)
    epaCC-START-Hack-2026/    # challenge data and reference material
    README.md                 # backend setup/run guide
    requirements.txt
  resources/
    fronted/                  # frontend handoff docs (API + UX)
    *.md                      # analysis, planning, and architecture notes
```

## Current Status

- Backend scaffold is running (`FastAPI`)
- `/api/v1` contract is locked for frontend integration
- Stub endpoints provide realistic JSON responses for frontend parallel development
- Upload endpoint is available and tested

## Quick Start (Backend)

```bash
cd "backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open:
- API docs: `http://localhost:8000/docs`
- API base: `http://localhost:8000/api/v1`

## Key API Groups

- Health: `/health`
- Ingestion: `/ingest/upload`
- Sources + Files: `/sources`, `/files`, `/files/{id}`, `/files/{id}/preview`
- Mapping: `/mapping/summary`, `/mapping/alerts`, `/mapping/rerun`
- Quality: `/quality/summary`, `/quality/by-source`
- Corrections: `/corrections/queue`, approve/reject/edit actions
- Contract metadata: `/meta/enums`, `/contracts/version`

## Frontend Handoff Docs

See:
- `resources/fronted/01_frontend_requirements_and_api_contract.md`
- `resources/fronted/02_ui_ux_best_practices.md`
- `resources/fronted/03_api_contract_lock_matrix.md`
- `resources/fronted/04_branding_name.md`

## Notes

- The project name is **ClinIQ**.
- `.gitignore` is configured to exclude environment files, caches, and runtime data folders.
- Backend data processing internals will evolve from fixtures to real pipeline logic while preserving `/api/v1` response shapes.

