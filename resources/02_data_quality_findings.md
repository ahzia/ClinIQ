# epaCC START Hack 2026 - Data Quality Findings

Scope: all files in `epaCC-START-Hack-2026/`, with detailed checks on CSV/PDF/SQL/docs and schema-risk review for binary files.

## High-Level Findings

- Data is intentionally heterogeneous across source systems and export styles.
- Delimiters are mixed (`;` and `,`), and field naming is highly inconsistent.
- Several files are "clean canonical" reference sets; others intentionally contain mapping/quality errors.
- The altered clinic split data introduces realistic integration breakpoints (renamed columns, missing headers, generic headers, modality switch to PDF).

## File Type Summary

- CSV: 43
- XLSX: 12
- PDF: 1
- SQL/CMD: 2
- Markdown: 2
- PPTX: 2
- BAK: 1

## Non-CSV Review

- `Challenge.md`: defines business goal (healthcare data harmonization + mapping transparency + quality dashboard).
- `Hack2026_README.md`: provides expected dataset semantics, missing-value rules, and epaAC variants.
- `DB/CreateImportTables.sql`: target SQL Server staging schema for case/ePA/labs/icd/ops/device/medication/nursing imports.
- `DB/CreateDatabase.cmd`: SQLCMD wrapper to create DB and run table script.
- `clinic_4_nursing.pdf`: nursing notes with explicit Patient ID, Case ID, ward, shift, free-text content.
- `.xlsx`, `.pptx`, `.bak`: binary assets; exist and are relevant to context, but schema inspection is done via CSV siblings or metadata implications.

## CSV Findings by Dataset Group

## 1) "Mit Fehlern" (error-injected) set

### `synth_cases_icd10_ops.csv`
- Missing IDs (`CaseID`, `PatientID`) present.
- Mixed ID formatting (`CASE-...`, numeric-like, prefixed variants).
- Mixed date formats and null tokens (`NULL`, `N/A`, blanks).
- Duplicate key candidates exist.

### `synth_device_motion_fall.csv`
- Missing `patient_id` entries.
- Duplicate time-series keys (`patient_id` + `timestamp`) appear.
- Mixed timestamp formats/null tokens.

### `synth_device_raw_1hz_motion_fall.csv`
- Missing `PatientID` values.
- Mixed timestamp formats.
- Null-like and malformed values in sensor-related fields.

### `synth_labs.csv`
- Missing case/patient identifiers.
- Non-standard flags (e.g., `unknown`, extreme marker variants).
- Date and null token inconsistency.

### `synth_medication_raw_inpatient.csv`
- Non-canonical column names (`pat_id`, `enc_id`, etc.).
- Mixed date styles and malformed dose/text values.
- Significant null token presence.

### `synth_nursing_daily_reports.csv`
- Missing `CaseID`/`PatientID`.
- Inconsistent identifier patterns and date formats.

### `epaAC-Data-3.csv` (error set)
- Very wide, semicolon-delimited epaAC structure.
- Inconsistent field formatting and placeholder-style values in date-like columns.

## 2) "Ohne Fehler" (clean reference) set

### Strong canonical files
- `synthetic_cases_icd10_ops.csv`
- `synthetic_device_motion_fall_data.csv`
- `synthetic_device_raw_1hz_motion_fall.csv`
- `synthetic_medication_raw_inpatient.csv`
- `synthetic_nursing_daily_reports_en.csv`
- `synth_labs_1000_cases.csv`

These mostly use stable names (`case_id`, `patient_id`, etc.) and cleaner typing/value consistency.

### epaAC variants (clean folder)
- `epaAC-Data-1.csv`: compact shape (~9 columns).
- `epaAC-Data-2.csv`: very wide coded shape (~433 columns).
- `epaAC-Data-3.csv`: very wide semantic shape (~588 columns).
- `epaAC-Data-5.csv`: obfuscated/non-self-describing headers.

Implication: epaAC cannot be treated as one single schema.

## 3) Split altered clinic data (major integration stress test)

### Clinic 1
- Mostly canonical schema with altered ID values (e.g., `ID_...`, `pt_...`).
- Good for ID-normalization validation.

### Clinic 2
- Systematic rename/reorder across files (`ID_PAT`, `dat`, `id_dev`, etc.).
- Some missing key values in first-column identifiers.
- Good for dictionary-based column mapping tests.

### Clinic 3
- Multiple files have header rows replaced by data rows (critical ingest risk).
- One ICD/OPS file effectively has no data rows after malformed header handling.
- Good for header-recovery heuristics.

### Clinic 4
- Generic headers (`col1`, `col2`, ...) and reduced/reordered schemas.
- Nursing input delivered as PDF instead of CSV.
- Good for schema inference + unstructured extraction tests.

## Cross-File Consistency Risks

- No universal key naming for case/patient identifiers.
- ID formats vary dramatically (dash, underscore, prefixes, numeric strings).
- Date formats are mixed across multiple datasets.
- epaAC files use domain-specific join fields and multiple incompatible shapes.
- Duplicate IDs may be expected in event/time-series data; dedup must use composite business keys.

## Important Notes for Mapping

- Always detect delimiter and encoding before parsing.
- Build normalization rules for IDs and null tokens before joins.
- Use per-file schema mapping dictionaries (especially clinic 2/3/4 and epaAC variants).
- Add header validation checks to detect "data-as-header" files.
- Keep source lineage metadata (file + row + parser status) for auditability.
