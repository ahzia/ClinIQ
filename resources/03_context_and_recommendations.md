# epaCC START Hack 2026 - Context and Recommendations

This file adds external context and practical recommendations for implementing robust data harmonization.

## External Context (Internet Research)

## 1) ICD-10-GM and OPS in Germany
- ICD-10-GM is the German modification of ICD-10 used for diagnosis coding.
- OPS is the German procedures/operations coding system.
- Both are officially maintained by BfArM and updated through formal processes.

Reference:
- [BfArM ICD-10-GM overview](https://www.bfarm.de/EN/Code-systems/Classifications/ICD/ICD-10-GM/_verteilerseite.html)
- [BfArM proposal procedure for ICD-10-GM/OPS](https://www.bfarm.de/EN/Code-systems/Classifications/Proposal-procedure/_artikel.html)

## 2) ePA context in Germany (2025+)
- The electronic patient record (ePA) context explains why fields and healthcare semantics can be broad and multi-source.
- Practical relevance: multi-provider data and documentation heterogeneity are expected, matching this challenge setup.

Reference (general info pages):
- [KBV ePA information sheet](https://www.kbv.de/media/sp/PraxisInfoSpezial_ePA.pdf)
- [MDR FAQ on ePA rollout](https://www.mdr.de/nachrichten/deutschland/panorama/elektronische-patientenakte-epa-start-faq-100.html)

## What Is Most Important in This Dataset

- The dataset intentionally mixes:
  - clean canonical files,
  - error-injected files,
  - and clinic-specific altered exports.
- epaAC appears in several incompatible structures; it needs variant-specific ingestion logic.
- Split clinic files are the core testbed for resilient mapping (not just cleaning one schema).

## Recommended Harmonization Pipeline

## Phase 1: Ingestion Guardrails
- Detect file type, delimiter, and encoding automatically.
- Add header sanity checks:
  - reject/flag generic headers (`col1`, `col2`) unless mapped,
  - detect "first row looks like data" header corruption.
- Store full source lineage (`source_file`, `row_number`, parse status).

## Phase 2: Canonicalization
- Map source-specific column names to canonical names using a mapping dictionary.
- Normalize IDs (`case_id`, `patient_id`) via deterministic rules:
  - remove prefixes/suffixes,
  - preserve source form in separate raw fields,
  - output normalized key + confidence.
- Normalize null tokens (`NULL`, `N/A`, blanks, `missing`, etc.) consistently.
- Standardize dates with parser priority and strict fallback flags.

## Phase 3: Domain Validation
- Enforce required IDs for entities that must be joinable.
- Distinguish expected duplicates (time series/admin events) from true key collisions.
- Validate value ranges for sensors and lab/reference consistency.
- Validate coded fields for ICD/OPS and epaAC dictionaries where available.

## Phase 4: Cross-Source Linking
- Join on normalized keys and date windows where direct IDs are insufficient.
- Keep unresolved records in a reconciliation queue.
- Provide explainable matching outputs (why a row matched/not matched).

## Minimum Deliverables for a Reliable Prototype

- Canonical target schema (entity-centric: case, patient, labs, meds, devices, nursing, epa).
- File-specific mapping config for all clinic/error variants.
- Validation report per file:
  - parse success,
  - missing key rates,
  - schema drift flags,
  - unresolved mappings.
- UI/dashboard slices for:
  - source coverage,
  - quality metrics,
  - anomaly alerts,
  - manual correction workflow.

## Suggested "First Wins"

- Start with clean canonical files to lock target schema.
- Add clinic 2 mapping dictionary (high value, structured drift).
- Add clinic 3 header-recovery logic (critical robustness gain).
- Add clinic 4 generic-header inference + PDF extraction adapter.
- Integrate epaAC variants progressively (1 -> 2 -> 3 -> 5).
