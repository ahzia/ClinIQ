# ClinIQ Backend

FastAPI backend for ClinIQ, an AI-assisted healthcare data harmonization demo.
It ingests heterogeneous files, generates deterministic + LLM-assisted mappings,
scores quality, builds review queues, and validates "ready for database move"
before persisting into a SQL-compatible SQLite layer.

## What This Service Provides

- File ingest and preview (`csv`, `xlsx`, `pdf` parsing)
- Mapping pipeline (hypotheses -> confidence -> AI assist -> routing)
- Quality scoring and alerts
- Live review queue from current mapping confidence
- SQL conformance checks against `CreateImportTables.sql`
- Database move candidate evaluation and optional persistence
- Normalized export endpoints (JSON/CSV)

## Prerequisites

- Python 3.11+
- `pip`

## Setup

From project root:

```bash
cd "Project/code/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Environment Variables

Core:

- `APP_NAME` (default: `Smart Health Mapping Backend`)
- `APP_ENV` (default: `dev`)
- `APP_VERSION` (default: `0.1.0`)
- `API_PREFIX` (default: `/api/v1`)
- `CASE_LINK_WINDOW_HOURS` (default: `6`)
- `IDENTITY_CONFLICT_HIGH_THRESHOLD` (default: `2`)
- `PROCESSED_DB_PATH` (default: `data/processed/harmonized.sqlite`)

AI/LLM:

- `AI_ENABLED` (default: `true`)
- `AI_PROVIDER` (default: `openai`, used as openai-compatible provider)
- `AI_MODEL` (default: `gpt-4o-mini`)
- `AI_API_KEY` (required when `AI_ENABLED=true`)
- `AI_API_BASE_URL` (default: `https://api.openai.com/v1`; replace for local/on-prem gateways)
- `AI_TIMEOUT_SECONDS` (default: `25`)

Database move policy:

- `DB_MOVE_INCLUDE_WARNINGS` (default from settings)
- `DB_MOVE_WARNING_SCORE_THRESHOLD` (default from settings)

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Endpoints:

- Swagger UI: `http://localhost:8000/docs`
- API base: `http://localhost:8000/api/v1`

## Demo Data Commands

Load curated two-lane demo files (`expected_pass` + `error_heavy`):

```bash
./scripts/demo_load_two_sources.sh
```

Full demo reset/seed:

```bash
./scripts/demo_seed_reset.sh
```

Smoke test:

```bash
./scripts/smoke.sh
```

## Quick API Checks

Health:

```bash
curl "http://localhost:8000/api/v1/health"
```

Contract version:

```bash
curl "http://localhost:8000/api/v1/contracts/version"
```

Files and sources:

```bash
curl "http://localhost:8000/api/v1/files"
curl "http://localhost:8000/api/v1/sources"
```

AI-assisted mapping for one file:

```bash
curl "http://localhost:8000/api/v1/mapping/ai-assist/<file_id>"
```

Database move candidates:

```bash
curl "http://localhost:8000/api/v1/storage/database-move/candidates?auto_move=false"
```

## Mapping and Scoring Behavior

- Deterministic confidence route thresholds:
  - `auto`: `>= 0.75`
  - `warning`: `>= 0.65 and < 0.75`
  - `manual_review`: `< 0.65`
- Pattern-first policy:
  - Fields already `>= 0.75` deterministic are accepted without AI.
  - AI is requested only for non-auto deterministic fields.
- Combined score for non-conflicting AI-assisted fields:
  - `0.45 * deterministic + 0.55 * ai`
- Conflict handling applies a conservative penalty and review-first routing.

## Important Endpoints

- `GET /api/v1/health`
- `POST /api/v1/ingest/upload`
- `POST /api/v1/demo/reset-uploads`
- `POST /api/v1/demo/load-two-sources`
- `GET /api/v1/sources`
- `GET /api/v1/files`
- `GET /api/v1/files/{file_id}`
- `GET /api/v1/files/{file_id}/preview`
- `GET /api/v1/mapping/summary`
- `GET /api/v1/mapping/alerts`
- `GET /api/v1/mapping/hypotheses/{file_id}`
- `GET /api/v1/mapping/confidence/{file_id}`
- `GET /api/v1/mapping/ai-assist/{file_id}`
- `POST /api/v1/mapping/route/{file_id}`
- `POST /api/v1/mapping/rerun`
- `GET /api/v1/mapping/epaac-dictionary`
- `GET /api/v1/mapping/epaac-coverage/{file_id}`
- `GET /api/v1/quality/summary`
- `GET /api/v1/quality/by-source`
- `GET /api/v1/quality/by-file`
- `GET /api/v1/corrections/queue`
- `PATCH /api/v1/corrections/{correction_id}`
- `POST /api/v1/storage/sql-load/{file_id}`
- `GET /api/v1/storage/database-move/candidates`
- `POST /api/v1/storage/database-move`
- `GET /api/v1/export/normalized/{file_id}`
- `GET /api/v1/export/normalized/{file_id}/csv`
- `GET /api/v1/meta/enums`
- `GET /api/v1/meta/runtime-config`
- `GET /api/v1/contracts/version`

## Local/On-Prem LLM Note

This backend supports openai-compatible LLM endpoints. For local deployment
(for example, a local Llama-family gateway), set `AI_API_BASE_URL` and
`AI_MODEL` accordingly while keeping provider wording vendor-neutral in UI.

## Notes

- Request logging includes request ID (`X-Request-ID`) support.
- Overview metrics are global (all loaded files); downstream pages can be source-scoped.
- API contract is stable for frontend integration under `/api/v1`.

