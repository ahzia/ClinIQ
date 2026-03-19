# Frontend Demo Must-Have Checklist (Execution Ready)

Purpose: final UI checklist so demo reflects backend work already implemented.

## A) Non-Negotiable Screens (Must Exist)

- Dashboard (KPI + quality + alerts snapshot)
- Files page (table + file details + preview)
- Mapping intelligence panel (hypothesis + confidence + route action)
- Corrections queue (approve/reject/edit)
- Alerts page (severity grouping + action hints)
- SQL validation panel (storage sql-load result card)

## B) Non-Negotiable API Wiring (Must Be Live)

- `GET /files`
- `GET /files/{file_id}`
- `GET /files/{file_id}/preview`
- `GET /mapping/hypotheses/{file_id}`
- `GET /mapping/confidence/{file_id}`
- `POST /mapping/route/{file_id}`
- `GET /corrections/queue`
- `POST /corrections/{correction_id}/approve`
- `PATCH /corrections/{correction_id}`
- `GET /mapping/alerts`
- `GET /quality/summary`
- `GET /quality/by-source`
- `GET /meta/runtime-config`
- `POST /storage/sql-load/{file_id}`
- `GET /contracts/version`

## C) Must-Visible "AI" Elements in UI

- Hypothesis candidate list with:
  - candidate field
  - score
  - reason
  - signal (`config_exact`, `fuzzy`, `correction_memory`)
- Confidence route badges:
  - `auto`, `warning`, `manual_review`
- Short "Why this mapping?" drawer or inline panel

If these are not visible, judges may think this is only manual ETL.

## D) 5-Minute Presentation UX Rules

- Max 5 primary nav items visible at once.
- No deep clicks (>2 clicks) to show key intelligence evidence.
- Keep one "Demo Mode" filter preset loaded on app start.
- Keep one fallback static summary card ready per page.

## E) Ready-to-Demo Data Presets

Preset 1: `f_clinic2_device`
- show confidence routing + SQL conformance

Preset 2: `f_epaac_1`
- show ambiguous mapping + explainability

Preset 3: `f_clinic3_header_broken`
- show schema drift and alert handling

## F) UI Components to Prioritize Tonight

- Route summary chips (`auto`, `warning`, `manual_review`)
- Confidence progress bars
- Severity badges (`high`, `medium`, `low`)
- Correction action buttons with optimistic feedback
- SQL load result card:
  - target table
  - conformance %
  - rows inserted
  - issues count

## G) "Done" Definition Before Demo

Mark ready only if all are true:

- [ ] End-to-end story can be shown in under 5 minutes
- [ ] AI evidence is visible without explaining backend internals
- [ ] At least one correction action is demonstrable live
- [ ] Quality + alerts are visible and understandable in 10 seconds
- [ ] SQL conformance result is visible in frontend
- [ ] Contract version is displayed somewhere (`/contracts/version`)

## H) Last-Minute Fallback Plan

If any endpoint is unstable at demo time:

1. keep cached last-success response in UI state,
2. show "last updated" timestamp,
3. continue narration with loaded data,
4. avoid live retries during pitch unless critical.

Goal: protect presentation flow even under runtime issues.

