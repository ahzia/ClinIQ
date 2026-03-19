# Frontend — Recent Changes Report (Session / Commit Summary)

**Date:** 2026-03-19  
**Scope:** Changes delivered in the ClinIQ frontend after the demo gap work, focused on **non-technical UX**, **API reliability**, **copy density**, and **system diagnostics**.

**Code root:** `frontend/`  
**Related plan:** `10_non_technical_ui_simplification_plan.md`

---

## 1) Purpose of This Document

This report records **what was implemented** in the frontend in the last iteration(s), so mentors, judges, and future contributors can see **outcomes without reading the full diff**. It complements:

- `implemented/01_imlementation.md` (broader status)
- `08_DEMO_FRONTEND_GAP_AUDIT.md` (demo gaps vs goals)
- `09_AI_BACKEND_INTEGRATION_NOTES.md` (AI / mapping API usage)

---

## 2) Non-Technical UI Simplification (Plan §2–§6)

### 2.1 Navigation labels

| Previous (typical) | Current |
|--------------------|---------|
| Sources | **Data Sources** |
| Mapping | **Field Matching** |
| Corrections | **Review & Fix** |
| — | **System** (new; technical / support path) |

Overview, Quality, and ClinIQ branding strings were adjusted per the copy map (e.g. **ClinIQ Workspace**, outcome-oriented stat labels).

### 2.2 Overview page (outcome-first)

- **Top row:** Files imported · Fields matched (auto) · Needs review (queue + uncertain matches) · Overall data health.
- **Middle:** Validation status (high-severity alert count + pass/attention pill) · **Demo file groups** (lane counts from filenames; descriptions via tooltips).
- **Then:** Confidence & risk (auto-match vs potential data issues bars).
- **Then:** Important issues (top alerts + detail) with CTAs **Open Review & Fix** and **Open Field Matching**.
- **Removed from Overview:** API connection card, contract version in header, backend/API summary widgets in the main header (moved to **System**).

### 2.3 New: System / Diagnostics

- New panel: **`SystemDiagnosticsPanel`** (`frontend/src/components/panels/SystemDiagnosticsPanel.tsx`).
- Surfaces: API/backend reachability, service, version/env, contract version, browser API base, **runtime config** (`GET /meta/runtime-config`), short note on **X-Request-ID**.
- **Not** on the primary demo path; intended for support and technical demos.

### 2.4 Panel copy (high level)

- **Data Sources:** “Browse your data”, Your files, Structure tab, Data type, Detected format, Match quality, Data health checks.
- **Field matching:** Help hint on “field matching”, match confidence summary, matching issues, target data model, Start re-check, compact linking line.
- **Data health:** Summary column, KPI wording (unexpected structure, unusual values), filters kept.
- **Review & fix:** Queue wording, epaAC placeholder compressed, dialog copy for rules / field override aligned with plain language.

### 2.5 Capabilities preserved

Per plan §6: validation/lane visibility, identity/linking filters, epaAC placeholder, mapping intelligence (hypotheses, confidence, AI-assist, route, SQL), and endpoint wiring were **not** removed—only **labels and layout** were simplified.

---

## 3) API Proxy & Mapping Intelligence Hardening

### 3.1 Next.js → FastAPI proxy (`src/app/api/v1/[...path]/route.ts`)

- **`resolveBackendApiV1Base()`:** Normalizes `BACKEND_API_BASE_URL` so requests always target `{origin}/api/v1` (handles host-only or full `/api/v1` URLs).
- **Path resolution:** Supports `params.path` as `string[]` or `string`; **fallback** parses the request URL pathname when catch-all params are empty (mitigates Next.js 16+ behavior).
- **DRY:** Single `forward` handler for GET/POST/PATCH/PUT/DELETE.
- **Dev debugging:** Response header `x-cliniq-proxy-target` shows the exact backend URL; console warn if path would forward empty (base-only → likely FastAPI 404).

### 3.2 Mapping intelligence UI (`MappingIntelligenceSection.tsx`)

- **Independent fetches** for hypotheses, confidence, and AI-assist so one failure does not block the others.
- **`encodeURIComponent(file_id)`** on path segments for mapping and storage calls.
- **AI-assist–specific error** state when only that endpoint fails (e.g. older backend).
- **Runtime config pills** removed from this panel (duplicated purpose); runtime lives under **System**.

---

## 4) Copy Reduction Pass (Density)

After simplification, a second pass **removed or shortened** non-essential paragraphs while keeping:

- Errors and retry flows  
- Control labels, filters, and primary actions  
- Tooltips where terms need explanation (`HelpHint`, lane `title` attributes)

Notable trims: long workspace hero, overview explanatory paragraphs, Quality “interpretation” block, Corrections review-strategy essay, verbose System intros, Mapping “Auto-rerun” sidebar card, several subtitles.

**UX polish:** `scroll-smooth` on main content, slightly tighter vertical spacing, **`layout.tsx`** metadata title/description updated.

---

## 5) New / Notable Files

| File | Role |
|------|------|
| `src/lib/demoLanes.ts` | Filename heuristics → demo lane keys; labels + tooltip descriptions for Overview. |
| `src/components/ui/HelpHint.tsx` | Small “?” control with native `title` for glossary-style hints. |
| `src/components/panels/SystemDiagnosticsPanel.tsx` | System page content (API, contract, runtime, request IDs). |

---

## 6) Verification

- **`npm run lint`** — pass (as of last run during this work).
- **`npx tsc --noEmit`** — pass (as of last run during this work).
- Manual: confirm `BACKEND_API_BASE_URL` / `NEXT_PUBLIC_API_BASE_URL` per proxy notes; hit **System** to confirm runtime and health.

---

## 7) Suggested Follow-Ups (Optional)

- Update **`implemented/01_imlementation.md`** Overview / nav bullets to match current labels and System page.
- If backend adds real **lane** or **file role** fields, replace filename heuristics in `demoLanes.ts`.
- Optional: collapsible “details” sections for long intelligence tables for even calmer pages.

---

*End of report.*
