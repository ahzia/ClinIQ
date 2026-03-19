# Organizer Q/A Clarifications (Project-Impact Notes)

Source: participant-organizer chat clarifications shared by team.  
Purpose: convert discussion into implementation and testing decisions.

## 1) High-Value Clarifications

## Data folder intent
- **`Endtestdaten_mit_Fehlern...`**:
  - for testing cleaning/error detection capabilities.
- **`Endtestdaten_ohne_Fehler...`**:
  - mostly correct data baseline.
- **`split_data_pat_case_altered`**:
  - specifically for mapping challenges.

Project impact:
- keep separate test lanes:
  - mapping robustness lane (`split_data...`)
  - quality detection lane (`mit_Fehlern`)
  - baseline correctness lane (`ohne_Fehler`)

## Validation target
- Organizers uploaded **`Checkdata.zip`** then **`Checkdata-final.zip`** for validation.
- `Checkdata-final.zip` is the latest reference.
- Sample DB (`Hack2026.bak`) shows expected import result shape.

Project impact:
- use `Checkdata-final.zip` as default QA reference.
- compare imports against table structure and expected shape from DB.

## epaAC mapping support
- Organizer uploaded `IID-SID-ITEM.csv` specifically for assigning AC import data.

Project impact:
- treat `IID-SID-ITEM.csv` as required reference dictionary for epaAC mapping and UI labeling.

## ID mapping guidance
- Same `patient_id` across sources is expected to represent same patient.
- If conflicting patient attributes occur, it may be intentional error data.
- If ambiguity remains, acceptable handling:
  - flag as import/mapping error, or
  - use source-prefix strategy to preserve uniqueness with provenance.
- Case-centric mapping can use patient ID + datetime when direct case ID is missing.

Project impact:
- implement fallback linking logic:
  1) direct `case_id` if present,
  2) `patient_id` + date window if case missing,
  3) unresolved -> correction queue.
- add explicit "ID conflict" alert class.

## Scope clarification
- No need to perform medical/condition analysis.
- Focus is data harmonization/mapping/validation quality.

Project impact:
- prioritize ingestion, mapping, quality, correction UX over clinical inference features.

## Filename assumptions
- Real world file names may be arbitrary.
- For challenge, names are readable but adaptability by content is preferred.

Project impact:
- do not rely solely on file name routing.
- keep content-based source detection in backend roadmap.

## Pitch guidance
- Free format; focus on:
  - initial problem
  - solution
  - tools/libraries
  - innovation
  - real-world use
  - market/cost rationale
  - why your solution should win

Project impact:
- align demo narrative with "trustworthy intelligent mapping system", not only ETL mechanics.

## 2) Immediate Implementation Adjustments

1. Add official "validation mode" test suite using `Checkdata-final.zip`.
2. Add conflict rule:
   - same normalized patient ID + incompatible demographics -> `high` alert.
3. Add unresolved join rule:
   - missing `case_id` and low-confidence `patient_id+time` link -> manual correction queue.
4. Add epaAC dictionary loader (`IID-SID-ITEM.csv`) to mapping module.
5. Add dashboard counters:
   - ID conflicts
   - unresolved case links
   - dictionary coverage for epaAC fields

## 3) Decision Log (to avoid team confusion)

- Use `Checkdata-final.zip`, not `Checkdata.zip`, as default validation package.
- `epaAC-Data-3.csv` is now included in final validation dataset and should be handled.
- Error folder findings should be surfaced, not silently "fixed away."
- Ambiguous identity joins should be explainable and reviewable.

