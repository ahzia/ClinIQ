# AI Backend Integration Notes (Frontend)

Purpose: what frontend needs to integrate AI-assisted mapping features now.

## 1) New AI Endpoint

- `GET /api/v1/mapping/ai-assist/{file_id}`
- Example file IDs:
  - `f_clinic2_device`
  - `f_epaac_1`

Response shape:

```json
{
  "file_id": "f_clinic2_device",
  "source_id": "device_motion",
  "ai_provider": "openai-compatible",
  "ai_model": "llm-model-name",
  "ai_available": false,
  "columns_analyzed": 8,
  "results": [
    {
      "source_field": "id",
      "deterministic_target": "patient_id",
      "deterministic_score": 0.89,
      "ai_target": "patient_id",
      "ai_score": 0.91,
      "conflict": false,
      "final_target": "patient_id",
      "final_score": 0.90,
      "route": "auto",
      "deterministic_reason": "...",
      "ai_reason": "...",
      "final_reason": "..."
    }
  ],
  "route_summary": {
    "auto": 1,
    "warning": 5,
    "manual_review": 2
  },
  "notes": ["..."]
}
```

## 2) Runtime Config Endpoint (AI + Safety Settings)

- `GET /api/v1/meta/runtime-config`

Includes:
- `case_link_window_hours`
- `identity_conflict_high_threshold`
- `processed_db_path`
- `ai_enabled`
- `ai_provider`
- `ai_model`

Use this in UI:
- show one compact "Runtime AI Config" chip in Mapping or Quality page.

## 3) Recommended Mapping UI Changes (P0)

1. Add new card: **AI-Assisted Mapping**
- Input: selected `file_id`
- Fetch: `/mapping/ai-assist/{file_id}`
- Show:
  - `ai_available`
  - `route_summary`
  - per-field table (`source_field`, deterministic/AI/final target, scores, conflict)

2. Add per-row explain panel:
- show:
  - `deterministic_reason`
  - `ai_reason`
  - `final_reason`

3. Add conflict badge:
- if `conflict=true`, show red badge and force review emphasis.

4. Add no-key fallback state:
- if `ai_available=false`, show:
  - "AI unavailable; deterministic baseline active"
  - still render deterministic/final fields from response.

## 4) Query Keys (if using TanStack Query)

- `["ai-assist", fileId]`
- `["runtime-config"]`

Invalidate `["ai-assist", fileId]` after:
- approve/reject/edit correction action,
- mapping route action,
- mapping rerun.

## 5) Contract Notes

- This is additive to `/api/v1` (no breaking changes).
- Existing mapping endpoints remain valid:
  - `/mapping/hypotheses/{file_id}`
  - `/mapping/confidence/{file_id}`
  - `/mapping/route/{file_id}`
  - `/storage/sql-load/{file_id}`

For demo, prefer `mapping/ai-assist` as primary evidence of intelligence.

## 6) UI Copy Rule (important)

- In UI labels, avoid explicit provider/vendor names.
- Recommended labels:
  - `AI-assisted mapping`
  - `LLM confidence`
  - `local-model compatible`

