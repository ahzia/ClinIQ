# Smart Health Mapping Backend

Backend service for the hackathon project.

Current status:
- FastAPI app scaffold is ready
- frontend contract endpoints are available under `/api/v1`
- data is currently served from fixture-backed stubs for rapid frontend development
- request logging and request IDs are enabled (`X-Request-ID`)

## 1) Prerequisites

- Python 3.11+ (recommended)
- `pip`

Optional (later):
- PostgreSQL (for persistence once DB layer is added)

## 2) Setup

From project root:

```bash
cd "Project/code/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3) Environment

Create `.env` from the example:

```bash
cp .env.example .env
```

Current variables:

- `APP_NAME` (default: `Smart Health Mapping Backend`)
- `APP_ENV` (default: `dev`)
- `APP_VERSION` (default: `0.1.0`)
- `API_PREFIX` (default: `/api/v1`)
- `CASE_LINK_WINDOW_HOURS` (default: `6`)
- `IDENTITY_CONFLICT_HIGH_THRESHOLD` (default: `2`)
- `PROCESSED_DB_PATH` (default: `data/processed/harmonized.sqlite`)
- `AI_ENABLED` (default: `true`)
- `AI_PROVIDER` (default: `openai` -> use as openai-compatible provider setting)
- `AI_MODEL` (default: `gpt-4o-mini`)
- `AI_API_KEY` (required for live AI suggestions)
- `AI_API_BASE_URL` (default: `https://api.openai.com/v1`, replace with local gateway for on-prem)
- `AI_TIMEOUT_SECONDS` (default: `25`)

## 4) Run the Backend

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Server:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- API base: `http://localhost:8000/api/v1`

## 5) Quick API Smoke Test

Health check:

```bash
curl "http://localhost:8000/api/v1/health"
```

Health check with custom request ID:

```bash
curl -i -H "X-Request-ID: demo-123" "http://localhost:8000/api/v1/health"
```

Contract version:

```bash
curl "http://localhost:8000/api/v1/contracts/version"
```

Sources:

```bash
curl "http://localhost:8000/api/v1/sources"
```

Runtime config (identity-link defaults):

```bash
curl "http://localhost:8000/api/v1/meta/runtime-config"
```

Validate + load auto-mapped rows into SQL-compatible sqlite table:

```bash
curl -X POST "http://localhost:8000/api/v1/storage/sql-load/f_clinic2_device" \
  -H "Content-Type: application/json" \
  -d '{"persist":true,"clear_table_before_insert":true}'
```

Corrections queue:

```bash
curl "http://localhost:8000/api/v1/corrections/queue"
```

Approve a correction:

```bash
curl -X POST "http://localhost:8000/api/v1/corrections/c_001/approve" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Looks good","apply_as_rule":true}'
```

Re-run mapping:

```bash
curl -X POST "http://localhost:8000/api/v1/mapping/rerun" \
  -H "Content-Type: application/json" \
  -d '{"scope":"all","file_id":null,"source_id":null}'
```

Route confidence output into queue:

```bash
curl -X POST "http://localhost:8000/api/v1/mapping/route/f_clinic2_device" \
  -H "Content-Type: application/json" \
  -d '{"include_warnings_in_queue": true}'
```

AI-assisted dual-scoring mapping preview:

```bash
curl "http://localhost:8000/api/v1/mapping/ai-assist/f_clinic2_device"
```

Demo communication note:
- keep UI/pitch wording provider-neutral:
  - "AI-assisted mapping engine"
  - "LLM provider abstraction"
  - "on-prem/local-model deployable (e.g., Llama-family via compatible gateway)"
- avoid naming cloud vendors in UI labels.

Upload a file:

```bash
curl -X POST "http://localhost:8000/api/v1/ingest/upload" \
  -F "file=@epaCC-START-Hack-2026/Endtestdaten_ohne_Fehler_ einheitliche ID/synthetic_cases_icd10_ops.csv"
```

## 6) Current Important Endpoints

- `GET /api/v1/health`
- `POST /api/v1/ingest/upload`
- `GET /api/v1/sources`
- `GET /api/v1/files`
- `GET /api/v1/files/{file_id}`
- `GET /api/v1/files/{file_id}/preview`
- `GET /api/v1/mapping/summary`
- `GET /api/v1/mapping/canonical-model`
- `GET /api/v1/mapping/normalize-preview/{file_id}`
- `GET /api/v1/mapping/configs`
- `GET /api/v1/mapping/configs/{source_id}`
- `GET /api/v1/mapping/mapped-preview/{file_id}`
- `GET /api/v1/mapping/hypotheses/{file_id}`
- `GET /api/v1/mapping/confidence/{file_id}`
- `GET /api/v1/mapping/ai-assist/{file_id}`
- `POST /api/v1/mapping/route/{file_id}`
- `GET /api/v1/mapping/alerts`
- `POST /api/v1/mapping/rerun`
- `GET /api/v1/quality/summary`
- `GET /api/v1/quality/by-source`
- `GET /api/v1/corrections/queue`
- `POST /api/v1/corrections/{correction_id}/approve`
- `POST /api/v1/corrections/{correction_id}/reject`
- `PATCH /api/v1/corrections/{correction_id}`
- `GET /api/v1/meta/enums`
- `GET /api/v1/meta/runtime-config`
- `POST /api/v1/storage/sql-load/{file_id}`
- `GET /api/v1/contracts/version`

## 7) Project Structure (Current)

```text
backend/
  app/
    api/
      health.py
      ingest.py
      frontend_stub.py
    core/
      settings.py
      fixtures.py
      stub_store.py
    schemas/
      contracts.py
    main.py
  configs/
    fixtures/
  data/
    raw/
    processed/
  epaCC-START-Hack-2026/
  requirements.txt
  .env.example
```

## 8) Notes

- `/api/v1` contract is locked for frontend integration.
- Internals continue moving from fixture-backed responses to real processing logic without breaking response shapes.
- Quality endpoints and mapping alerts are now runtime-computed from parser output samples.
- Frontend documentation is under:
  - `Project/resources/fronted/01_frontend_requirements_and_api_contract.md`
  - `Project/resources/fronted/03_api_contract_lock_matrix.md`

