# Frontend Implementation Overview (Current Status)

Last updated: 2026-03-19 (backend contract sync + demo pipeline)

This document summarizes:
- what has been implemented in frontend,
- what is still pending,
- and backend items important for frontend integration.

It reflects current code in `frontend/src/components/*` and organizer updates from `05_frontend_updates_from_organizer_findings.md`.

## 1) Frontend Work Completed

## A) Foundation and App Shell
- Next.js frontend initialized and wired as main app entry.
- Root page now renders unified shell UI (`AppShell`).
- Premium visual system added:
  - animated background,
  - glass cards,
  - reusable stat cards,
  - consistent pills/status chips.
- Sidebar + main content architecture implemented with nav sections:
  - Overview
  - Sources
  - Mapping
  - Quality
  - Corrections
- Mobile-friendly quick nav chips added in header for small screens.
- Current page context pill added in header for better orientation.

## B) API Connectivity and CORS-safe Integration
- Frontend API client implemented (`apiGet`, `apiPost`, `apiPatch`) with no-store fetch and error handling.
- **Safe default:** if `NEXT_PUBLIC_API_BASE_URL` is unset, client falls back to `"/api/v1"` (matches Next proxy; demo-safe).
- Next.js API proxy route added (`/api/v1/[...path]`) so frontend can call backend without browser CORS problems.
- Env setup adapted:
  - `NEXT_PUBLIC_API_BASE_URL=/api/v1`
  - `BACKEND_API_BASE_URL=http://localhost:8000/api/v1`
- Connection and contract status exposed in UI:
  - health check (`/health`)
  - contract version (`/contracts/version`)

## C) Overview Page
- KPI row implemented (ingestion, mapping, corrections).
- API Connection card implemented with online/offline and error state.
- Trust Signals section implemented:
  - mapping confidence %
  - anomaly likelihood %
- Recent Alerts redesigned:
  - severity-aware visuals,
  - list + details split view,
  - actionable context panel.
- Top cards now use full page width behavior per feedback.
- Alert detail experience remains split-view and was kept stable after iterative polish.

## D) Sources Page (Major Redesign)
- Source Explorer created with dual-pane workflow:
  - left: sources/files explorer
  - right: preview/schema inspection
- Search and source risk labeling implemented.
- File details + preview integrated:
  - `/files/{id}`
  - `/files/{id}/preview`
- Schema tab includes inference, mapping trust, quality signals, and notes.
- "Show more / show less" behavior implemented for:
  - sources list
  - files list
  - preview rows
  - preview notes
- Table behavior improved:
  - horizontal scroll on overflow,
  - sticky header,
  - no wrapping cells (`whitespace-nowrap`),
  - local overflow container.
- Additional clarity chips added (source count, file count, selected file context).
- **Preview / details error state** with message and **Retry** (no silent empty state).
- **Heuristic data-lane pills** on file rows (filename-based: validation / baseline / error test / mapping test) for organizer-style narrative until backend tags exist.

## E) Mapping Page
- Mapping summary integrated with breakdown progress bars:
  - auto-mapped
  - warnings
  - needs review
  - failed
- By-source mapping view implemented.
- Mapping rerun action integrated (`POST /mapping/rerun`) with scope logic:
  - all / file / source
- Alerts section implemented with severity pills and expandable list.
- Alert triage improvements added:
  - severity-prioritized ordering (high -> medium -> low),
  - filters (`all`, `high`, `needs_review`, `identity/linking`),
  - reset filter action,
  - severity counters for quick scanning.
- Explainability panel added for linking strategy:
  - `case_id` primary,
  - `patient_id + datetime window` fallback,
  - low-confidence goes to manual review.
- Canonical model integration added (`/mapping/canonical-model`) with:
  - search
  - compact select mode
  - expanded browse mode
  - entity details (key fields + fields)
- **`MappingIntelligenceSection`** (demo pipeline — aligns with `08_DEMO_FRONTEND_GAP_AUDIT.md` / `07_frontend_demo_must_have_checklist.md` / `09_AI_BACKEND_INTEGRATION_NOTES.md`):
  - `GET /meta/runtime-config` — link window, identity threshold, AI enabled (vendor-neutral copy).
  - File picker + quick presets: `f_clinic2_device`, `f_epaac_1`, `f_clinic3_header_broken`.
  - `GET /mapping/hypotheses/{file_id}` — top candidate, score, signal, reason.
  - `GET /mapping/confidence/{file_id}` — per-field scores, signal breakdown, route badges.
  - `GET /mapping/ai-assist/{file_id}` — deterministic vs LLM layer, conflict badge, expandable “why” reasons.
  - `POST /mapping/route/{file_id}` — apply routing; shows queued counts.
  - `POST /storage/sql-load/{file_id}` — conformance %, target table, rows inserted/failed, issues count (options: persist, clear table).

## E2) App shell — demo preset
- On load, fetches `/files` and selects the first available of `f_clinic2_device` → `f_epaac_1` → `f_clinic3_header_broken` (else first file), with matching `source_id`, so Mapping intelligence is ready for demo.

## F) Quality Page
- Quality summary integrated:
  - overall score
  - clean / missing / incorrect percentages
- KPI counters integrated.
- By-source quality view implemented with source picker + progress bars.
- Selected-source cross-highlighting from global selection context supported.
- Triage and readability improvements added:
  - quality filters (`all`, `healthy`, `needs_attention`, `critical`),
  - interpretation panel explaining clean/missing/incorrect signals,
  - reset filter action,
  - safe empty handling (dropdown disabled when filtered set is empty).

## G) Corrections Page
- Corrections queue integrated (`/corrections/queue`) with compact-first list behavior.
- Per-item confidence bar and contextual metadata added.
- Action flow fully wired:
  - approve (`POST /corrections/{id}/approve`)
  - reject (`POST /corrections/{id}/reject`)
  - edit (`PATCH /corrections/{id}`)
- Modal workflow implemented:
  - comment
  - apply-as-rule toggle
  - target override for edit
- Refresh after mutation implemented.
- Queue triage improvements added:
  - prioritized ordering (pending first, then lower confidence first),
  - filters (`all`, `pending_review`, `low_confidence`, `accepted`, `rejected`),
  - reset filter action,
  - low-confidence row highlight for faster review.
- Review strategy guidance panel added for operator workflow.

## H) Scrolling and Layout Improvements
- Sidebar no longer coupled to main page scroll.
- Main content uses controlled overflow and avoids global horizontal scroll.
- Long lists moved to local scroll/expansion patterns.
- Global scrollbar styling upgraded for premium look.
- Scroll/table container sizing fixed so wide previews remain inside page bounds while scrolling locally.
- Dropdowns upgraded globally to premium style:
  - custom arrow icon,
  - hover/focus states,
  - consistent dark glass look across pages.

## 2) Pending Frontend Work

## High Priority (from organizer findings)
1. Add **Validation Run** concept and badges/filters:
   - baseline (`ohne_Fehler`)
   - error test (`mit_Fehlern`)
   - mapping robustness (`split_data...`)
   - validation package (`Checkdata-final`)
   - *Partial:* filename-heuristic lane pills on Sources file list; dashboard lane cards still optional.
2. Add **Data Lane segmentation** cards/filters on dashboard:
   - Baseline Correctness
   - Error Detection
   - Mapping Robustness
   - Validation Package
   - *Not done yet* (overview cards); heuristic tags only on Sources rows for now.
3. Add explicit **Identity and Linking Issues** alert section:
   - support `id_conflict`
   - support `unresolved_case_link`
   - *Partial:* Mapping alerts filter **Identity/linking** extended for `identity_conflict`, `case_link`, `missing_required`, etc.
4. Add **Linking Strategy** explanation panel in file details/corrections:
   - primary: `case_id`
   - fallback: `patient_id + datetime window`
   - low confidence => manual review
   - *Mapping:* done. *Corrections / file drawer:* still optional duplicate.
5. Add **Validation Status** widget:
   - files processed
   - major errors
   - pass/fail indicator
6. Add **epaAC dictionary context placeholders** in mapping/corrections:
   - IID/SID lookup area
   - dictionary label rendering placeholder
   - dictionary coverage placeholder metrics
   - *Partial:* placeholder card on Corrections page; live IID/SID lookup waits on optional API fields.

## Medium Priority (contract/best-practice alignment)
1. Consume `/meta/enums` for badge/filter values instead of hardcoded statuses.
2. Improve query architecture toward TanStack Query (currently custom fetch/state):
   - standardized cache keys
   - mutation-driven invalidation
3. Add more consistent empty/error/loading patterns and retry actions.
4. Add optional URL-driven filter state for explorer/list views.
5. Accessibility pass:
   - keyboard flows in complex cards
   - focus states and ARIA checks for interactive containers.

## Optional UX Enhancements
- Alert filtering chips on mapping are now implemented.
- Optional next: add similar filtering chips to overview alerts.
- Compact-density toggle for data-heavy lists.
- Export visible rows from preview tables.

## 3) Backend Items Important for Frontend

These are backend-relevant from frontend perspective only (no required breaking change in `/api/v1`).

## Already Required and In Use
- Stable availability of:
  - `/health`
  - `/contracts/version`
  - `/meta/runtime-config`
  - `/sources`, `/files`, `/files/{id}`, `/files/{id}/preview`
  - `/mapping/summary`, `/mapping/alerts`, `/mapping/canonical-model`, `/mapping/rerun`
  - `/mapping/hypotheses/{file_id}`, `/mapping/confidence/{file_id}`, `/mapping/ai-assist/{file_id}`
  - `POST /mapping/route/{file_id}`, `POST /storage/sql-load/{file_id}`
  - `/quality/summary`, `/quality/by-source`
  - `/corrections/queue`, correction action endpoints

## Optional Additions That Unlock Pending UI
1. Validation run tagging metadata (file/source-level classification for lanes).
2. Identity conflict counters/details surfaced in alerts payloads.
3. Linking-confidence metadata for case linking logic (for explanation panels).
4. Dictionary coverage + IID/SID label enrichment endpoints/fields.
5. Validation status aggregate endpoint or additive fields (processed/errors/pass-fail).
6. `/meta/enums` completeness and consistency for all display enums.

All above can be additive in `/api/v1` and should not require breaking frontend changes.

## 4) Current Readiness Snapshot

- Frontend is functionally integrated and visually upgraded across all core sections.
- **Demo-critical pipeline** (hypotheses, confidence, AI-assist, route-to-queue, SQL conformance, runtime config) is wired on the Mapping page per gap audit.
- Core + extended `/api/v1` endpoints are consumed through the Next.js proxy.
- Remaining polish: overview data-lane cards, validation status widget, full epaAC dictionary wiring when backend adds fields, `/meta/enums` consumption, TanStack Query refactor (optional).
- No backend changes were made from the frontend workstream.

