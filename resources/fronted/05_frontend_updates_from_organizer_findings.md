# Frontend Updates Needed (Based on Organizer Findings)

Yes, frontend plans should be updated based on latest organizer clarifications and new validation data.

This file lists concrete UI/UX and workflow changes to apply now.

## 1) Add Validation Mode Concept to UI

Organizer confirmed:
- `Checkdata-final.zip` is the validation reference package.

Frontend update:
- Add a visible badge/filter for **Validation Run**.
- In file list and dashboard, show whether files belong to:
  - baseline (`ohne_Fehler`)
  - error test (`mit_Fehlern`)
  - mapping test (`split_data...`)
  - validation set (`Checkdata-final`)

Why:
- Helps judges quickly see your system supports official validation workflow.

## 2) Add "Data Lane" Segmentation in Dashboard

New cards/filters:
- `Baseline Correctness`
- `Error Detection`
- `Mapping Robustness`
- `Validation Package`

Use existing APIs now:
- `/sources`
- `/files`
- `/mapping/summary`
- `/quality/summary`

Why:
- This directly mirrors organizer intent for each folder type.

## 3) Add Explicit Identity Conflict UX

Organizer guidance allows:
- source-prefixed uniqueness strategy, and/or
- surfacing conflicts as dashboard errors.

Frontend update:
- Reserve alert type and visual treatment for:
  - `id_conflict`
  - `unresolved_case_link`
- Add dedicated section in Alerts page:
  - "Identity and Linking Issues"

Why:
- This is likely to appear in error datasets and should be explainable.

## 4) Add "Linking Strategy" Explanation Panel

Organizer guidance:
- case-centric linking can use patient ID + datetime when case ID missing.

Frontend update:
- In file details and correction views, add info box:
  - `Primary link: case_id`
  - `Fallback: patient_id + datetime window`
  - `Low confidence -> manual review`

Why:
- Makes your decision logic transparent for judges and mentors.

## 5) Add epaAC Dictionary Context in Mapping UI

New file `IID-SID-ITEM.csv` was added for epaAC assignment.

Frontend update:
- Prepare UI space for:
  - Item label lookup (IID/SID -> human-readable DE/EN)
  - dictionary coverage metrics (later from backend)
- In correction drawer, show:
  - source item code
  - resolved dictionary label (when available)

Why:
- Significantly improves trust and usability for epaAC mapping.

## 6) Update Success Criteria on Dashboard

Organizer note:
- check data should be mostly error-free and not trigger major errors.

Frontend update:
- Add a compact "Validation Status" widget:
  - files processed
  - major errors count
  - pass/fail indicator for validation run

Why:
- Gives judges a fast view of whether solution meets expected import quality.

## 7) Minor Copy Adjustments (Important)

Use wording aligned with organizer expectations:
- "Data Harmonization and Mapping"
- "Quality and Completeness"
- "Alerts and Corrections"
- avoid implying clinical diagnosis/condition analysis

Why:
- Keeps pitch and UI language aligned with official scope.

## 8) No API Contract Break Needed

Good news:
- These frontend updates can be implemented mostly with existing `/api/v1` contract.
- For full support later, backend may add optional fields/endpoints for:
  - validation run tagging
  - dictionary coverage
  - identity conflict counters

But current UI improvements can start immediately without waiting.

## 9) Priority Order for Frontend Team

1. Add validation mode badges/filters
2. Add identity conflict alert section
3. Add linking strategy panel in details/corrections
4. Add validation status widget
5. Prepare epaAC dictionary UI placeholders

