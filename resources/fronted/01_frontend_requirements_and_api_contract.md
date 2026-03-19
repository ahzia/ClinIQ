# Frontend Requirements and API Contract

Audience: frontend developer building dashboard and workflows in Next.js.

Status: backend endpoints are contract-locked. Some endpoints are fixture-backed, while file preview and upload listing already run on real parser logic. Response shapes remain stable.

## 1) Product Goals for Frontend

Build a modern dashboard for:
- ingestion visibility,
- mapping status and alerts,
- data quality insights,
- manual correction queue.

Core principle:
- frontend should feel "intelligent and trustworthy," not just charts.

## 2) Tech Requirements (Frontend)

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Recharts (or ECharts)
- Zod (optional, runtime response validation)

## 3) Environment and Base URL

- Local backend base URL: `http://localhost:8000`
- API prefix: `/api/v1`
- Full base: `http://localhost:8000/api/v1`

Suggested env var:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`

## 4) Endpoints You Can Use Now

## Health
- `GET /health`
- Purpose: backend availability + version display.

Response:
```json
{
  "status": "ok",
  "service": "Smart Health Mapping Backend",
  "version": "0.1.0",
  "env": "dev"
}
```

## Ingestion
- `POST /ingest/upload`
- Content-Type: `multipart/form-data`
- Field: `file`
- Allowed suffixes: `.csv`, `.xlsx`, `.pdf`, `.txt`

Response:
```json
{
  "file_id": "uuid",
  "filename": "my_file.csv",
  "content_type": "text/csv",
  "size_bytes": 12345,
  "stored_path": "/absolute/path/..."
}
```

## Source Categories
- `GET /sources`
- Purpose: category cards and source metadata.

Response shape:
```json
{
  "sources": [
    {
      "id": "labs",
      "label": "Lab Parameters",
      "file_count": 8,
      "formats": ["csv", "xlsx"],
      "notes": "..."
    }
  ],
  "totals": {
    "files_seen": 60,
    "csv": 43,
    "xlsx": 12,
    "pdf": 1,
    "docs": 4
  }
}
```

## File List + Summary
- `GET /files`
- Purpose: ingestion table + top KPI cards.

Response shape:
```json
{
  "files": [
    {
      "id": "f_clean_icd_ops",
      "name": "synthetic_cases_icd10_ops.csv",
      "source_id": "diagnoses_icd_ops",
      "format": "csv",
      "status": "imported",
      "mapping_status": "mapped",
      "quality_status": "clean",
      "rows_estimate": 50
    }
  ],
  "summary": {
    "imported_files": 6,
    "successful_mappings": 3,
    "mappings_with_warnings": 1,
    "failed_mappings": 1,
    "needs_review": 2
  }
}
```

## File Details
- `GET /files/{file_id}`
- Purpose: file metadata + inference + mapping + quality.

Response shape:
```json
{
  "file": {
    "id": "f_any",
    "name": "synthetic_cases_icd10_ops.csv",
    "path": "...",
    "format": "csv",
    "source_id": "diagnoses_icd_ops",
    "imported_at": "2026-03-19T10:22:00Z",
    "status": "imported"
  },
  "inference": {
    "delimiter": ",",
    "encoding": "utf-8",
    "header_confidence": 0.98,
    "detected_schema_variant": "canonical"
  },
  "mapping": {
    "status": "mapped",
    "auto_mapped_fields": 12,
    "needs_review_fields": 0,
    "confidence_overview": {
      "high": 12,
      "medium": 0,
      "low": 0
    }
  },
  "quality": {
    "status": "clean",
    "missing_required_keys": 0,
    "anomalies": 0,
    "notes": []
  }
}
```

## File Preview
- `GET /files/{file_id}/preview`
- Purpose: preview table component.
- Current behavior:
  - fixture IDs resolve to real dataset files
  - uploaded file IDs resolve to real uploaded files in `backend/data/raw`
  - parser supports CSV/XLSX/PDF/TXT

Response shape:
```json
{
  "file_id": "f_any",
  "kind": "table",
  "columns": ["case_id", "patient_id"],
  "rows": [
    {
      "case_id": "CASE-001",
      "patient_id": "PAT-7177"
    }
  ],
  "notes": ["..."]
}
```

## Mapping Summary
- `GET /mapping/summary`
- Purpose: mapping KPI section + per-source bar charts.

## Canonical Target Model
- `GET /mapping/canonical-model`
- Purpose: fetch the backend canonical entity/field catalog.
- Recommended use:
  - target-field dropdowns in correction UI
  - schema explorer panel
  - validation of selected `suggested_target`

## Mapping Alerts
- `GET /mapping/alerts`
- Purpose: alert list with severity chips and action hints.

Response item fields:
- `id`
- `severity` (`high`, `medium`, `low`)
- `file_id`
- `source_id`
- `type`
- `message`
- `action`

## Quality Summary
- `GET /quality/summary`
- Purpose: overall quality score + KPI counters.

## Quality by Source
- `GET /quality/by-source`
- Purpose: stacked percentage chart by category.

Response item fields:
- `source_id`
- `clean_percent`
- `missing_percent`
- `incorrect_percent`

## Corrections Queue
- `GET /corrections/queue`
- Purpose: manual review table.

Response item fields:
- `id`
- `file_id`
- `source_id`
- `source_field`
- `suggested_target`
- `confidence`
- `status`
- `reason`

## 5) Pages to Build

1. `Dashboard`
   - KPIs (imported files, successful mappings, alerts)
   - quality overview chart
   - mapping summary cards

2. `Sources`
   - source category cards
   - format + file count + notes

3. `Files`
   - file table (status badges)
   - details drawer/page
   - preview table

4. `Alerts`
   - mapping alerts list grouped by severity

5. `Corrections`
   - queue table
   - approve/reject/edit action placeholders

## 6) Status/Badge Enum Suggestions

- file `status`: `imported | processing | failed`
- mapping `status`: `mapped | mapped_with_warnings | needs_review | failed`
- quality `status`: `clean | mixed | unknown`
- alert `severity`: `high | medium | low`

## 7) Frontend Data Layer Best Practices

- Use TanStack Query keys:
  - `["health"]`
  - `["sources"]`
  - `["files"]`
  - `["file", fileId]`
  - `["preview", fileId]`
  - `["mapping-summary"]`
  - `["mapping-alerts"]`
  - `["quality-summary"]`
  - `["quality-by-source"]`
  - `["corrections-queue"]`

- Use polling only where needed:
  - files list and mapping summary (e.g. every 10-20s)

- Normalize data in FE model layer:
  - map `source_id -> source label`
  - map statuses to consistent color tokens

## 8) Contract Stability Notes

- These response shapes are now the frontend contract.
- Backend internals will evolve from fixture -> real pipeline while keeping endpoint shape stable.
- If contract changes become necessary, version under `/api/v2` rather than breaking `/api/v1`.

## 9) Immediate Frontend TODO Checklist

- [ ] Setup API client with base URL env var
- [ ] Build dashboard using `/files`, `/mapping/summary`, `/quality/summary`
- [ ] Build source cards using `/sources`
- [ ] Build file table + details + preview
- [ ] Build alerts page
- [ ] Build corrections queue page
- [ ] Add empty/loading/error states to all views

## 10) Contract Lock Additions (v1)

These endpoints are now part of the locked frontend contract:

## Meta / Contract
- `GET /contracts/version`
  - Returns `api_version`, `contract_version`, `stability`, `breaking_change_policy`.
- `GET /meta/enums`
  - Returns all enums needed for status badges and filters.

## Corrections Actions (write APIs)
- `POST /corrections/{correction_id}/approve`
- `POST /corrections/{correction_id}/reject`
- `PATCH /corrections/{correction_id}`

Request body (shared shape):
```json
{
  "comment": "optional note",
  "apply_as_rule": false,
  "target_override": "optional_target_field"
}
```

Response shape:
```json
{
  "id": "c_001",
  "status": "accepted",
  "updated_at": "2026-03-19T12:00:00Z",
  "message": "Correction approved."
}
```

## Mapping Control
- `POST /mapping/rerun`

Request body:
```json
{
  "scope": "all",
  "file_id": null,
  "source_id": null
}
```

Rules:
- if `scope=file`, `file_id` is required
- if `scope=source`, `source_id` is required

Response:
```json
{
  "job_id": "job_...",
  "status": "queued",
  "queued_at": "2026-03-19T12:00:00Z",
  "scope": "all",
  "file_id": null,
  "source_id": null
}
```

## Updated TanStack Query Keys

Add:
- `["contract-version"]`
- `["meta-enums"]`

For mutations:
- `approve-correction`
- `reject-correction`
- `edit-correction`
- `rerun-mapping`

Suggested invalidation after correction mutation:
- `["corrections-queue"]`
- `["mapping-summary"]`
- `["mapping-alerts"]`
- `["quality-summary"]`

