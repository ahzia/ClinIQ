# Mentor Questions (Priority First) + Simple Explanations

Purpose: a short list of the most important questions to ask mentors before we continue implementation.
Context sources reviewed: challenge docs, organizer Q/A notes, backend plan, API contract docs, data quality findings, upstream findings, and DB target schema notes.

## Update: Answers We Already Have (From Organizer Chat + Team Insight)

These items are now considered answered enough to proceed:

1. AI is in scope and should be used (not manual mapping only), especially for unknown headers, multilingual names, and abbreviations.
2. Auto-accepted/final mapped data should conform to `DB/CreateImportTables.sql`; writing into a DB with the same schema is expected as proof.
3. Missing `case_id` linking can use `patient_id` + datetime heuristics, and the date-window policy can be configurable (safe default first).
4. Conflicting attributes (example: same case or patient with contradictory sex values) must be surfaced as alerts; route depends on conflict severity.
5. Organizer clarification thread also confirms:
   - `Checkdata-final.zip` is the latest validation package.
   - `IID-SID-ITEM.csv` is provided for AC/epaAC assignment support.
   - error-folder data is for testing detection/handling, not for pretending all data is clean.

Still partially open:
- final judging acceptance details (exact value-level comparison rules),
- exact expected date-window defaults for linking.

## Quick Conclusions First (Ask these first if time is short)

1. We are aligned on core scope: ingest -> map -> validate -> dashboard -> manual correction, on-prem, with AI-assisted mapping included.
2. Biggest remaining risks are not coding risks, but **interpretation risks**:
   - what "correct" mapping means for judging,
   - how strict DB-schema conformance must be,
   - how identity linking should behave when `case_id` is missing or conflicting.
3. epaAC is the highest uncertainty area (multiple shapes + dictionary usage + duplicate handling).
4. We should lock remaining acceptance details now, otherwise we may optimize for the wrong validation behavior.

---

## Must-Ask Questions (Highest Priority)

### 1) What exactly defines a "correct mapping" for judging?
- Why this matters:
  - We can map many fields, but judges may score based on strict expected outputs.
- Ask mentors:
  - "For scoring, what is the acceptance rule: exact target column mapping only, or also value-level correctness and join correctness?"
- Simple meaning:
  - "Do we pass if names look right, or only if the final records are truly correct?"

### 2) How strict must we follow `DB/CreateImportTables.sql`?
- Why this matters:
  - We currently use canonical mapping + API previews; persistent DB export is next.
- Ask mentors:
  - "Must our final output match this SQL schema exactly (field names + data types), or is logical equivalence acceptable during demo?"
- Simple meaning:
  - "Do they want exact DB columns, or just same meaning?"

### 3) Identity linking rule when `case_id` is missing: what date-window policy is acceptable?
- Why this matters:
  - Organizer notes allow `patient_id + datetime` heuristics, but no exact tolerance is specified.
- Ask mentors:
  - "If case ID is missing, what time window should we use for patient/date linking (same day, +/- 24h, etc.)?"
  - "When ambiguous, should we always route to manual review?"
- Simple meaning:
  - "How aggressive can we be when guessing case links?"

### 4) For conflicting patient identity data, what is preferred behavior?
- Why this matters:
  - Error datasets intentionally contain conflicts.
- Ask mentors:
  - "When same patient ID appears with conflicting attributes, should we block import, keep both with alert, or auto-create source-prefixed IDs?"
- Simple meaning:
  - "When data disagrees, should we stop, warn, or split?"

### 5) epaAC handling expectations (especially Data-1/2/3 differences)
- Why this matters:
  - epaAC has different structures and is critical for challenge realism.
- Ask mentors:
  - "Should `IID-SID-ITEM.csv` be treated as authoritative dictionary for item semantics?"
  - "For `epaAC-Data-1` duplicates, should we always keep the latest row as final?"
  - "Is partial mapping with explainable warnings acceptable for very wide epaAC files?"
- Simple meaning:
  - "How exact must we be for epaAC, and what is okay to leave for review?"

---

## Important Questions (Ask after top 5)

### 6) What is the minimum acceptable anomaly detection for the demo?
- Why this matters:
  - Requirement says anomaly detection, but could mean simple rule checks or advanced statistical detection.
- Ask mentors:
  - "For hackathon judging, is rule-based anomaly detection enough (missing IDs, invalid ranges, schema drift), or do you expect model-based anomaly detection?"
- Simple meaning:
  - "Do simple smart checks count as anomaly detection?"

### 7) Should warning items be auto-queued for manual review by default?
- Why this matters:
  - We now route `warning`/`manual_review` to queue by default.
- Ask mentors:
  - "Do you prefer warning-level mappings to remain applied-with-warning, or always appear in correction queue?"
- Simple meaning:
  - "Should medium-confidence items interrupt users or just be flagged?"

### 8) What level of explainability is expected in UI for unresolved mappings?
- Why this matters:
  - We plan explicit reason codes and dual-score explainability.
- Ask mentors:
  - "For unresolved fields, what explanation depth is expected in judging: short reason text, top candidates with scores, and recommended next action?"
- Simple meaning:
  - "How much 'why' should we show when mapping fails?"

### 9) Is FHIR export expected for score impact, or optional bonus only?
- Why this matters:
  - Earlier decision: FHIR as optional export layer, not MVP storage core.
- Ask mentors:
  - "Will a small FHIR subset export materially improve score, or is robust DB-aligned harmonization enough for this challenge?"
- Simple meaning:
  - "Should we spend precious time on FHIR now or not?"

### 10) Validation package truth source: should we compare against `Hack2026.bak` outputs?
- Why this matters:
  - `Checkdata-final.zip` contains CSVs plus DB backup.
- Ask mentors:
  - "For final validation, should we benchmark only against schema/logic, or also compare against expected loaded DB state in `Hack2026.bak`?"
- Simple meaning:
  - "Do we need exact DB-result matching, not just schema matching?"

---

## Nice-to-Ask (If time permits)

### 11) Language requirement for labels and UI (German vs English)
- Why this matters:
  - Dictionary has DE/EN names; frontend messaging currently English-first.
- Ask mentors:
  - "Should demo UI and mapped labels prioritize German, English, or bilingual display?"

### 12) Correction-memory governance expectations
- Why this matters:
  - We now learn from accepted/edited corrections.
- Ask mentors:
  - "Should learned correction memory be source-specific only, global across sources, or require approval workflow before reuse?"

### 13) "No cloud-only" interpretation for optional AI-assist
- Why this matters:
  - Future plan includes safe AI-assist for warning/manual cases.
- Ask mentors:
  - "Is optional local-only AI-assist acceptable in demo if fully offline deploy remains possible?"

---

## Suggested 60-Second Ask Order (if mentor time is very limited)

1. Mapping acceptance definition (#1)
2. DB schema strictness (#2)
3. Missing-case identity linking policy (#3)
4. Conflict handling behavior (#4)
5. epaAC expectations + duplicate rule (#5)

If these 5 are answered, we can safely lock next implementation phases with minimal rework risk.

