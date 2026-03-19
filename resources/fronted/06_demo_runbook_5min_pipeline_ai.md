# 5-Minute Demo Runbook (Pipeline + AI First)

Audience: frontend developer + presenter.  
Goal: show full value without backend screens, with clear "intelligent mapping" story.

## 1) Demo Goal (Say This in First 15 Seconds)

"ClinIQ automatically ingests messy healthcare files, maps them to a unified model, scores confidence, routes risky mappings for review, validates quality, and checks SQL-schema conformance - with explainable AI-assisted mapping signals."

## 2) Exact 5-Minute Timeline

## 0:00-0:30 - Problem + Scope
- Show dashboard hero area.
- Say:
  - multiple file types/sources,
  - on-prem compatible,
  - no clinical diagnosis analysis, focus on harmonization + quality.

UI should show:
- app name `ClinIQ`
- top KPIs (`/files`, `/quality/summary`, `/mapping/alerts`)

## 0:30-1:20 - Ingestion + Source Visibility
- Open Files page.
- Show at least one file from each lane:
  - baseline (`ohne_Fehler`)
  - mapping stress (`split_data...`)
  - validation (`Checkdata-final`)
- Open one file details panel.

Use:
- `GET /files`
- `GET /files/{file_id}`
- `GET /files/{file_id}/preview`

Say:
- "We parse CSV/XLSX/PDF/TXT and keep source lineage visible."

## 1:20-2:20 - Mapping Intelligence (Most Important)
- In file details, show:
  1) normalized preview,
  2) hypotheses with candidate scores,
  3) confidence routing summary.
- Highlight signal labels:
  - `config_exact`
  - `fuzzy`
  - `correction_memory`

Use:
- `GET /mapping/normalize-preview/{file_id}`
- `GET /mapping/hypotheses/{file_id}`
- `GET /mapping/confidence/{file_id}`
- `POST /mapping/route/{file_id}`

Say:
- "Deterministic + intelligent suggestions reduce manual work."
- "Low-confidence fields are never silently auto-accepted."

## 2:20-3:10 - Human-in-the-Loop + Explainability
- Open Corrections page filtered to one routed file.
- Approve/edit one row live.
- Return to hypotheses/confidence panel and show impact if available.

Use:
- `GET /corrections/queue`
- `POST /corrections/{id}/approve`
- `PATCH /corrections/{id}`

Say:
- "Reviewer decisions become memory for future mappings."

## 3:10-4:00 - Quality + Risk Control
- Open Alerts + Quality section.
- Show:
  - schema drift alert,
  - missing required IDs,
  - duplicate composite key,
  - identity conflict-related behavior.
- Show quality by source chart.

Use:
- `GET /mapping/alerts`
- `GET /quality/summary`
- `GET /quality/by-source`
- `GET /meta/runtime-config`

Say:
- "Fallback case linking is controlled by safe runtime config."
- "Conflicts are surfaced, not hidden."

## 4:00-4:40 - SQL Conformance Proof
- Trigger SQL load validation action for one file.
- Show response card:
  - target SQL table,
  - schema conformance percent,
  - inserted rows,
  - issue list (if any).

Use:
- `POST /storage/sql-load/{file_id}`

Say:
- "Auto-mapped outputs are validated against official DB schema."

## 4:40-5:00 - Close
- Show one-slide summary panel in UI:
  - pipeline complete
  - AI-assisted mapping visible
  - quality + correction workflow visible
  - SQL-target compliance validated

Say:
- "ClinIQ is a trustworthy intelligence layer for healthcare data harmonization."

## 3) Demo File IDs (Recommended)

- `f_clinic2_device` (great for mapping/confidence/routing/sql-load)
- `f_epaac_1` (great for epaAC complexity)
- `f_clinic3_header_broken` (great for schema drift alert)
- optional uploaded CSV for live ingestion moment

## 4) Presenter Safety Rules

- Never open backend terminal/code during pitch.
- If an API call fails, immediately switch to already-loaded state and continue story.
- Focus on 3 outcomes, not implementation detail:
  - automation,
  - explainability,
  - safety/governance.
- Keep model/provider wording neutral in presentation:
  - say "AI-assisted mapping engine" and "on-prem/local-model deployable"
  - avoid naming specific cloud vendors in the live demo UI narrative.

