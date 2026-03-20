# ClinIQ

ClinIQ is an AI-assisted healthcare data harmonization platform built for START Hack.
It ingests heterogeneous clinical files, maps fields into a canonical model, scores
quality and trust, and supports a human-in-the-loop review workflow before SQL move.

## What Makes This Project Different

- Pattern-first mapping with AI fallback (AI only for uncertain fields)
- Explainable per-field routing (`auto`, `warning`, `manual_review`)
- Live review queue from current data, not stale stored states
- "Ready for Database Move" validation gate before persistence
- On-prem/local-model compatible AI integration

## Repository Structure

```text
code/
  backend/                    # FastAPI APIs, mapping engine, quality, SQL conformance
  frontend/                   # Next.js dashboard (Overview, Quality, Matching, Review, DB Move)
  resources/                  # architecture, UX, pitch, and implementation docs
```

## Quick Start

### 1) Backend

```bash
cd "backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend URLs:

- API docs: `http://localhost:8000/docs`
- API base: `http://localhost:8000/api/v1`

### 2) Frontend

In a second terminal:

```bash
cd "frontend"
npm install
npm run dev -- --hostname 0.0.0.0 --port 3001
```

Frontend URL:

- App: `http://localhost:3001`

## Demo Data Flow

From `backend/`, load curated two-lane demo sources:

```bash
./scripts/demo_load_two_sources.sh
```

This prepares:

- `expected_pass` (mostly good mappings, some warnings)
- `error_heavy` (more issues, lower readiness)

## Core Backend API Areas

- Health: `/health`
- Ingestion/files: `/ingest/upload`, `/sources`, `/files`, `/files/{id}/preview`
- Mapping: `/mapping/summary`, `/mapping/alerts`, `/mapping/hypotheses/{id}`, `/mapping/confidence/{id}`, `/mapping/ai-assist/{id}`, `/mapping/route/{id}`, `/mapping/rerun`
- Quality: `/quality/summary`, `/quality/by-source`, `/quality/by-file`
- Review queue: `/corrections/queue`, `/corrections/{id}` (patch)
- Database move: `/storage/database-move/candidates`, `/storage/database-move`, `/storage/sql-load/{id}`
- Export/meta: `/export/normalized/{id}`, `/meta/enums`, `/meta/runtime-config`, `/contracts/version`

## Current Scoring Policy (Demo)

- Deterministic thresholds:
  - `auto >= 0.75`
  - `warning >= 0.65 and < 0.75`
  - `manual_review < 0.65`
- AI is requested only for deterministic non-auto fields.
- Combined score for non-conflicting AI-assisted cases:
  - `0.45 * deterministic + 0.55 * ai`

## Documentation Pointers

- Backend details: `backend/README.md`
- Frontend/API handoff: `resources/fronted/01_frontend_requirements_and_api_contract.md`
- API lock matrix: `resources/fronted/03_api_contract_lock_matrix.md`
- Demo/pitch content: `resources/17_presentation_slide_plan_problem_demo_technical.md`

## Notes

- Use provider-neutral language in UI/pitch: "AI-assisted mapping engine", not vendor names.
- The project is designed to support local/on-prem AI endpoints via openai-compatible API base URL.

