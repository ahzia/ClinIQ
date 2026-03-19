# API Verification Report (Contract + Data Correctness)

Date: 2026-03-19  
Scope: existing backend APIs at `http://localhost:8000/api/v1`

## Summary

- Total checks executed: **36**
- Passed: **36**
- Failed: **0**

## Verification Method

Two layers were tested:

1. **Contract/API shape checks**
- endpoint availability
- expected response keys and enums
- route behavior for mapping/preview/quality/corrections contract

2. **Manual data correctness checks**
- compared API output against actual source files from:
  - `backend/epaCC-START-Hack-2026/...`
- validated specific row/column values (not just shape)

## Endpoints Verified

- `GET /health`
- `GET /contracts/version`
- `GET /meta/enums`
- `GET /sources`
- `GET /files`
- `GET /files/{file_id}`
- `GET /files/{file_id}/preview`
- `GET /mapping/normalize-preview/{file_id}`
- `GET /mapping/configs`
- `GET /mapping/configs/{source_id}`
- `GET /mapping/mapped-preview/{file_id}`
- `GET /mapping/hypotheses/{file_id}`
- `GET /mapping/summary`
- `GET /mapping/alerts`
- `GET /quality/summary`

## Manual Data Cross-Checks Performed

## A) `f_clinic2_device` preview
- File compared:
  - `.../split_data_pat_case_altered/.../clinic_2_device.csv`
- Verified:
  - first row `date` matches source CSV
  - first row `id` matches source CSV
  - first row `fall` matches source CSV
  - preview column order starts as expected

## B) `f_epaac_1` preview
- File compared:
  - `.../Endtestdaten_ohne_Fehler_ einheitliche ID/epaAC-Data-1.csv`
- Verified:
  - semicolon parsing behavior is correct
  - first row `PID` and `SID` match source data
  - empty source values represented as null where applicable

## C) Mapped preview correctness
- `GET /mapping/mapped-preview/f_clinic2_device`
  - verified `date -> timestamp`
  - verified `id -> patient_id`
  - verified presence of mapped movement field (`movement_index_0_100`)

## D) Normalization correctness
- `GET /mapping/normalize-preview/f_epaac_1`
  - verified normalized ID fields are added
  - verified normalized patient format starts with `PAT-`
  - verified normalization stats present

## E) Hypothesis quality sanity
- `GET /mapping/hypotheses/f_clinic2_device`
  - verified `date` hypothesis exists
  - top candidate for `date` is `timestamp`

## Result

Current backend APIs are responding correctly for tested cases and key responses align with source data where manually validated.

## Notes / Limits

- Some endpoints are still fixture-backed by design (`/sources`, `/mapping/summary`, `/mapping/alerts`, `/quality/*`).
- Verified behavior is correct relative to current architecture (`REAL`, `REAL+MEM`, `FIXTURE`) documented in:
  - `resources/09_backend_step_by_step_plan.md`

