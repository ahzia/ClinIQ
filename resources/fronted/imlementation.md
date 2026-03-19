# Frontend Implementation Overview (Current Status)

Last updated: 2026-03-19

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
2. Add **Data Lane segmentation** cards/filters on dashboard:
   - Baseline Correctness
   - Error Detection
   - Mapping Robustness
   - Validation Package
3. Add explicit **Identity and Linking Issues** alert section:
   - support `id_conflict`
   - support `unresolved_case_link`
4. Add **Linking Strategy** explanation panel in file details/corrections:
   - primary: `case_id`
   - fallback: `patient_id + datetime window`
   - low confidence => manual review
5. Add **Validation Status** widget:
   - files processed
   - major errors
   - pass/fail indicator
6. Add **epaAC dictionary context placeholders** in mapping/corrections:
   - IID/SID lookup area
   - dictionary label rendering placeholder
   - dictionary coverage placeholder metrics

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
  - `/sources`, `/files`, `/files/{id}`, `/files/{id}/preview`
  - `/mapping/summary`, `/mapping/alerts`, `/mapping/canonical-model`, `/mapping/rerun`
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
- Core contract endpoints are consumed and operational through frontend proxy.
- Remaining work is mostly organizer-alignment features and explainability additions.
- No backend rewrite needed; mainly additive metadata to maximize frontend completeness.

