# Frontend Gap Audit for 5-Min Demo

Date: 2026-03-19  
Scope audited:
- `resources/fronted/implemented/01_imlementation.md`
- frontend code under `frontend/src/*`
- demo-focused docs (`06_demo_runbook_5min_pipeline_ai.md`, `07_frontend_demo_must_have_checklist.md`)

Validation run:
- `npm run lint` -> pass
- `npm run build` -> pass

---

## 1) What Is Implemented (Verified in Code)

- App shell and navigation are implemented (`Overview`, `Sources`, `Mapping`, `Quality`, `Corrections`).
- Backend proxy exists at `src/app/api/v1/[...path]/route.ts`.
- Overview panel consumes:
  - `/health`
  - `/contracts/version`
  - `/files`
  - `/mapping/summary`
  - `/mapping/alerts`
  - `/quality/summary`
  - `/corrections/queue`
- Sources panel consumes:
  - `/sources`
  - `/files`
  - `/files/{id}`
  - `/files/{id}/preview`
- Mapping panel consumes:
  - `/mapping/summary`
  - `/mapping/alerts`
  - `/mapping/canonical-model`
  - `POST /mapping/rerun`
- Quality panel consumes:
  - `/quality/summary`
  - `/quality/by-source`
- Corrections panel consumes:
  - `/corrections/queue`
  - correction action endpoints (approve/reject/edit)

---

## 2) Critical Gaps vs Demo Goal (Main Pipeline + AI)

These are the highest-impact missing pieces for tomorrow's 5-minute demo.

1. **No visible AI mapping evidence panel yet**
- Missing live UI for:
  - `/mapping/hypotheses/{file_id}`
  - `/mapping/confidence/{file_id}`
- Impact:
  - judges may perceive current UI as dashboard + manual workflow, not "intelligent mapping."

2. **No route-persistence action in UI**
- Missing frontend action for:
  - `POST /mapping/route/{file_id}`
- Impact:
  - cannot visibly demonstrate auto/warning/manual routing workflow from confidence engine.

3. **No SQL conformance/load card in UI**
- Missing frontend action/result view for:
  - `POST /storage/sql-load/{file_id}`
- Impact:
  - you cannot show DB-schema conformance proof visually in frontend.

4. **No runtime-config visibility**
- Missing UI readout for:
  - `/meta/runtime-config`
- Impact:
  - cannot explain safe configurable identity-link window and conflict threshold during pitch.

5. **Validation mode/data lanes not implemented**
- Missing badges/filters/cards for:
  - baseline/error/mapping/validation lanes
- Impact:
  - weaker alignment with organizer framing and demo narrative.

---

## 3) Serious Issues to Fix (Demo Risk)

## S1 - API base configuration is brittle
- `src/lib/api.ts` hard-fails if `NEXT_PUBLIC_API_BASE_URL` is missing.
- Current proxy exists, but there is no guaranteed fallback in code.
- Risk:
  - demo can fail immediately if env var is misconfigured.
- Fix:
  - fallback `NEXT_PUBLIC_API_BASE_URL` to `"/api/v1"` in code.

## S2 - Mapping view still relies on fixture-like summary endpoint
- Main mapping KPI currently uses `/mapping/summary` rather than confidence/hypothesis pipeline views.
- Risk:
  - demo does not reflect strongest implemented backend intelligence.
- Fix:
  - shift primary mapping narrative UI to file-scoped confidence+hypothesis panels.

## S3 - Sources preview error is silently swallowed
- In `SourcesPanel`, preview/details fetch failure resets data without showing explicit error message.
- Risk:
  - looks like empty data instead of known issue during demo.
- Fix:
  - show a visible "preview load failed" state with retry.

---

## 4) Mismatch Between Implementation Note and Code

The implementation note is strong, but these items are not yet reflected in actual code:
- AI proof components (hypothesis + confidence signal cards) are not implemented.
- Route persistence (`/mapping/route/{file_id}`) not wired in UI.
- Storage SQL load (`/storage/sql-load/{file_id}`) not wired in UI.
- Runtime config (`/meta/runtime-config`) not shown in UI.
- Validation mode and data-lane segmentation UI not present.

---

## 5) Frontend Next Steps (Priority Order)

## Priority P0 (Do first, demo-blocking)

1. Add "AI Mapping Evidence" block on Mapping page:
- File selector + call:
  - `/mapping/hypotheses/{file_id}`
  - `/mapping/confidence/{file_id}`
- Show:
  - top candidate, score, reason, signal.

2. Add "Apply Routing" action:
- call `POST /mapping/route/{file_id}`
- show returned counts (`auto`, `warning`, `manual_review`, `queued_items_added`).

3. Add "SQL Conformance Proof" card:
- call `POST /storage/sql-load/{file_id}`
- show:
  - `target_table`
  - `schema_conformance_percent`
  - rows inserted/failed
  - issues count.

4. Add runtime config display chip:
- call `/meta/runtime-config`
- show linking window + conflict threshold in mapping/quality panel.

## Priority P1 (High demo value)

5. Add Validation Mode lane tags in Files list:
- simple heuristic tags by file/source naming now;
- optional backend metadata later.

6. Add dedicated "Identity & Linking Issues" filter in alerts:
- highlight `identity_conflict`, `case_link_config_required`, `missing_required_ids`.

## Priority P2 (Polish)

7. Improve error handling:
- explicit retry buttons in Sources/Mapping details sections.

8. Add one-click "Demo mode preset":
- preselect `f_clinic2_device` at startup in mapping page.

---

## 6) Demo-Ready Minimum Definition

Frontend is demo-ready only if all are true:
- [ ] AI signal evidence visible on screen (not just mentioned verbally).
- [ ] Routing action is triggerable in UI and result counts visible.
- [ ] SQL conformance proof is visible in UI.
- [ ] Corrections action can be performed live in under 20 seconds.
- [ ] Quality + alerts visible in one screen without deep clicks.

---

## 7) Suggested Immediate Execution (Tonight)

1. implement P0 items in `MappingPanel.tsx` (single page, fastest).
2. add safe API base fallback in `src/lib/api.ts`.
3. add error state in `SourcesPanel.tsx` for preview/details fetch.
4. quick end-to-end rehearsal with:
   - `f_clinic2_device`
   - `f_epaac_1`
   - `f_clinic3_header_broken`

