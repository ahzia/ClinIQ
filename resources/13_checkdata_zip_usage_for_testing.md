# Checkdata ZIP Usage for Backend Testing

This note turns the newly added ZIP content into an actionable backend test strategy.

Reference archive to use:
- `backend/epaCC-START-Hack-2026/Checkdata-final.zip`

Official clarification:
- `Checkdata-final.zip` supersedes earlier `Checkdata.zip`.

## 1) Why This Dataset Is Good for Testing

- Small files (quick loops)
- Multi-domain coverage (labs, meds, nursing, device, ICD/OPS, epaAC)
- Includes malformed values and delimiter variation
- Represents the same domain categories used in the challenge

## 2) Minimal Test Matrix

## A) Ingestion tests
- Upload each CSV file type from `Checkdata-final`
- Expect:
  - accepted file type
  - file registration visible in `/files`
  - details retrievable from `/files/{id}`

## B) Preview parser tests
- CSV comma files:
  - `Icd10_Check_Ops_cases.csv`
  - `medication_raw_inpatient_check.csv`
- CSV semicolon files:
  - `Labs_Check_cases.csv`
  - `epaAC-Data-1.csv`
  - `epaAC-Data-2.csv`
  - `epaAC-Data-3.csv`
- Expect:
  - correct delimiter detection
  - correct column extraction
  - non-empty row preview

## C) Normalization readiness tests (next phase)
- Use `Labs_Check_cases.csv` to validate:
  - null handling
  - date parsing fallback
  - invalid value detection

## D) epaAC mapping tests
- Use:
  - `IID-SID-ITEM.csv` + `epaAC-Data-1/2/3.csv`
- Expect:
  - ability to resolve item labels from IDs
  - clearer mapping explanations and alerts

## 3) Suggested Test Order (Fastest Feedback)

1. `Icd10_Check_Ops_cases.csv`
2. `synthetic_nursing_daily_reports_check.csv`
3. `device_motion_fall_Check_data.csv`
4. `medication_raw_inpatient_check.csv`
5. `Labs_Check_cases.csv`
6. `epaAC-Data-1.csv`
7. `epaAC-Data-2.csv`
8. `epaAC-Data-3.csv`

This order starts simple and ends with hardest schema class (epaAC wide formats).

## 4) Immediate Automation Suggestion

Create a backend script (next implementation step) that:
- extracts ZIP if needed
- uploads all check files to backend
- calls preview endpoint per file
- outputs pass/fail summary in JSON

This will give repeatable progress tracking as backend moves from `REAL+MEM` and `FIXTURE` to fully `REAL`.

## 5) Important Note for Team

Use `Checkdata-final.zip` as canonical QA snapshot because it includes:
- expanded `epaAC-Data-3.csv` compared to the earlier ZIP variant.

## 6) Official Validation/Scope Rules (from organizer Q/A)

- Folder with errors is for testing if app detects/handles errors.
- Resulting data standard should conform to DB structure from:
  - `DB/CreateImportTables.sql`
- No need to analyze patient medical condition.
- Mapping should be adaptable and not depend only on file names.
- For case-centric linking when direct case id is missing:
  - use patient ID + datetime heuristics,
  - and flag low-confidence links for manual correction.


