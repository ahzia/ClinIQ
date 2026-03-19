# Non-Technical UI Simplification Plan (Demo + Real Users)

Purpose: make the frontend understandable for non-technical users while still preserving trust and explainability.

Scope:
- simplify wording (especially Overview),
- move technical diagnostics into a separate section,
- keep demo pages focused on user workflow and outcomes.

This plan is additive to existing frontend guidance files:
- `01_frontend_requirements_and_api_contract.md`
- `05_frontend_updates_from_organizer_findings.md`
- `06_demo_runbook_5min_pipeline_ai.md`
- `07_frontend_demo_must_have_checklist.md`
- `08_DEMO_FRONTEND_GAP_AUDIT.md`
- `09_AI_BACKEND_INTEGRATION_NOTES.md`

---

## 1) Main Problem in Current UI

Current copy is accurate but too engineering-heavy for non-technical users:
- terms like "contract", "canonical model", "schema", "mapping summary", "API connection", "queue rerun", "confidence routing".

For demo and real adoption, primary screens should answer:
1. What happened to my data?
2. Is it trustworthy?
3. What do I need to review next?

---

## 2) Technical -> Non-Technical Copy Map

Use these replacements in primary user-facing areas.

## Global Navigation
- `Overview` -> keep as `Overview`
- `Sources` -> `Data Sources`
- `Mapping` -> `Field Matching`
- `Quality` -> keep as `Quality`
- `Corrections` -> `Review & Fix`

## Overview Page
- `ClinIQ Console` -> `ClinIQ Workspace`
- `Trust layer for mapping` -> keep as `Trust layer for mapping`
- `API Connection` -> hide from main area (move fully to `System/Diagnostics`)
- `Contract version` -> move to technical section only
- `Ingestion` -> `Files Imported`
- `Mapping` -> `Fields Matched`
- `Corrections` -> `Needs Review`
- `Trust Signals` -> `Confidence & Risk`
- `Mapping confidence` -> `Auto-match confidence`
- `Anomaly likelihood` -> `Potential data issues`
- `Recent Alerts` -> `Important Issues`

## Sources Page
- `Source Explorer` -> `Browse Your Data`
- `Library` -> `Your Files`
- `Schema` tab -> `Structure`
- `Preview kind` -> `Data type`
- `Schema inference` -> `Detected format`
- `Mapping trust` -> `Match quality`
- `Quality signals` -> `Data health checks`

## Mapping Page
- `Mapping Control` -> `Field Matching`
- `Field confidence breakdown` -> `Match confidence summary`
- `By source` -> keep as `By source`
- `Rerun mapping` -> keep as `Rerun mapping`
- `Queue rerun` -> `Start re-check`
- `Canonical model` -> `Target data model`
- `Mapping alerts` -> `Matching issues`

## Quality Page
- `Quality Insights` -> `Data Health`
- `Trust score` -> `Overall data health score`
- `Missing required IDs` -> keep as `Missing required IDs`
- `Schema drift` -> `Unexpected file structure`
- `Value anomalies` -> `Unusual values`

## Corrections Page
- `Manual Corrections` -> `Review & Fix`
- `Corrections queue` -> `Items waiting for review`
- `Apply as rule` -> `Use this fix for similar files`
- `Target override` -> `Choose a better field match`

---

## 3) Overview Page Redesign (High Priority)

Current overview mixes business and technical signals.  
Recommended structure:

1. **Top row (user outcomes)**
- Files imported
- Auto-matched fields
- Items needing review
- Overall data health

2. **Middle row (workflow state)**
- Validation status (pass/fail + major issues)
- Data lanes (Baseline / Error Detection / Mapping Robustness / Validation Package)

3. **Bottom row (actionable list)**
- Important issues to resolve now (top 3)
- "Open Review & Fix" CTA

Move all technical diagnostics out of this page.
Mandatory:
- remove `API Connection` card from Overview and place it only in `System/Diagnostics`.

---

## 4) Add New "System & Diagnostics" Section

Create a separate area (or drawer) for technical details:
- backend status
- API availability
- contract version
- runtime config values
- request IDs / debug info (optional)

This keeps trust/auditability available without cluttering user workflows.

Suggested nav label:
- `System` or `Diagnostics`

Do not put this in the main demo path.

---

## 5) Demo-Path Pages Should Be Outcome-First

For the 5-minute demo path, prioritize:

1. Home (outcome snapshot)
2. Data Sources (what was ingested)
3. Field Matching (AI evidence + route result)
4. Data Health (quality + alerts)
5. Review & Fix (human-in-loop action)

Each page should show:
- one clear outcome metric,
- one user action,
- one short explanation ("why this matters").

---

## 6) Keep Existing Feedback Aligned (Do Not Drop)

While simplifying text, keep previous required features:
- validation mode/lane visibility,
- identity/linking issue visibility,
- linking strategy explanation,
- epaAC dictionary context placeholders,
- AI evidence visibility (`hypotheses`, `confidence`, `ai-assist`, `route`),
- SQL conformance result card.

So: simplify language, not capability.

---

## 7) Quick Implementation Checklist for Frontend Developer

- [ ] Replace core labels using copy map above.
- [ ] Refactor Overview into outcome-first layout.
- [ ] Move API/contract/runtime technical details into new `System/Diagnostics` section.
- [ ] Keep demo path pages free of low-level backend jargon.
- [ ] Add helper tooltips for unavoidable terms (e.g., "field match").
- [ ] Keep all existing endpoint wiring and intelligence evidence visible.

---

## 8) Example Non-Technical Hero Text

Use this on Home page:

"ClinIQ helps you combine healthcare files into one consistent format.  
It highlights risky matches, explains why they were flagged, and guides you to fix them quickly."

