# Live UI Questions - Plain Answers + Demo Simplification Plan

Date: 2026-03-19  
Scope: explain current numbers/behavior in plain language, identify confusion points, and define what to simplify next.

---

## 1) Why "Files imported = 6"?

Because the current backend `/files` list is seeded with exactly 6 demo files (fixture + in-memory state).

Current files are:

1. `f_clean_icd_ops` -> `synthetic_cases_icd10_ops.csv`
2. `f_clean_labs` -> `synth_labs_1000_cases.csv`
3. `f_epaac_1` -> `epaAC-Data-1.csv`
4. `f_clinic2_device` -> `clinic_2_device.csv`
5. `f_clinic3_header_broken` -> `clinic_3_labs.csv`
6. `f_pdf_nursing` -> `clinic_4_nursing.pdf`

So this is not "all files from dataset folder". It is the currently tracked demo file set.

---

## 2) Why "1 failed · 2 flagged"?

This line comes from `/files.summary`:

- `failed_mappings = 1` -> one file currently marked failed (`f_clinic3_header_broken`)
- `needs_review = 2` -> two files currently marked needs_review (`f_epaac_1`, `f_pdf_nursing`)

It is a high-level workflow status, not a full quality audit.

---

## 3) Why is "Fields matched (auto)" low now?

Current value is from runtime `/mapping/summary` (not old static fixture numbers).

Current live result:
- total fields seen: `161`
- auto: `7`
- warning: `56`
- manual review: `98`

Why low:
- scoring/routing is now stricter and safety-first
- altered/stress files are included (`clinic_3_labs`, device, epaAC variants)
- unknown/drifted headers are intentionally routed to warning/manual review instead of unsafe auto

So the drop is expected after switching from optimistic fixture summary to real runtime scoring.

---

## 4) Why "Needs review = 101"?

Overview currently computes:

- `Queue 3` (from `/corrections/queue.summary.pending_review`)
- `uncertain 98` (from `/mapping/summary.summary.needs_review`)
- total shown = `101`

This mixes:
- field-level uncertainty count (98)
- queue-item count (3)

This is mathematically valid but confusing because they are different units.  
Recommendation: show them as two separate cards, not a single summed number.

---

## 5) "Overall data health = 49%" - is this realistic?

It is a real runtime average from `/quality/summary`, based on sampled rows from the selected file set.

Current result:
- clean: 49
- missing: 41
- incorrect: 15
- overall score shown as clean average (49)

Why low:
- at least 2 files have missing required IDs
- 1 file has schema drift
- anomalies exist in sampled rows

So yes, with this current demo mix, 49% is realistic.

---

## 6) "Validation status - High severity: 3" means what?

This is the count of high-severity alerts from `/mapping/alerts`.

Current high alerts:
1. `missing_required_ids` on `f_clinic2_device`
2. `missing_required_ids` on `f_clinic3_header_broken`
3. `schema_drift` on `f_clinic3_header_broken`

Why it feels empty now:
- the card mostly shows one number + pill
- not enough context inline

Recommendation: replace with:
- "Files blocked: N"
- top 1-2 reasons (e.g., missing IDs, schema drift)
- CTA: "Open Ready for Database Move"

---

## 7) "Demo file groups" - what is it and why all 0?

This is a frontend heuristic (filename keyword matching), not backend truth.

It tries to infer lanes from words in file names:
- baseline -> contains `ohne`
- error -> contains `fehler/error`
- mapping stress -> contains `split`
- validation -> contains `checkdata/validation`

Current displayed file names do not include these keywords, so all buckets become 0.

Conclusion:
- current card is low value and confusing in this state
- either remove for demo, or compute lanes from backend metadata (preferred)

---

## 8) "Confidence & risk of what?"

Current meaning:
- "Auto-match confidence" = `auto_mapped / total_fields_seen`
- "Potential data issues" = average of missing% and incorrect%

Why it looks low:
- auto is low (`7/161`)
- missing/incorrect signals are high on current file set

Confusion point:
- card does not clearly say it is "across currently loaded demo files"

Recommendation: rename and split:
- "Auto-match rate (current files)"
- "Data issue rate (current files)"

---

## 9) Why is `f_clinic2_device` auto-selected?

Frontend intentionally preselects demo-friendly files in this order:

1. `f_clinic2_device`
2. `f_epaac_1`
3. `f_clinic3_header_broken`

So selection is automatic by design for quick demo startup.

---

## 10) "Your files: why only three?"

Two places can show "three":

1. **Demo preset chips** in Mapping Intelligence: fixed to 3 focus files by design.
2. **Filtered file list** per selected source: if one source is selected, list shows only that source's files.

So this is UI scoping behavior, not missing data.

---

## 11) Why the UI feels complicated

Main reasons:
- many concepts on one screen (mapping + quality + route + SQL + alerts + model)
- mixed levels (business + technical + debugging)
- mixed units in same KPI card
- placeholder/demo-only widgets (e.g., lane heuristic) shown as primary signals

---

## 12) Recommended Simplified Demo UX (strongly suggested)

## A) Keep only 4 main demo tabs

1. `Overview`
2. `Field Matching`
3. `Review & Fix`
4. `Ready for Database Move`

Move `System` and deep diagnostics out of demo path.

## B) Overview should show only outcome cards

- Files tracked
- Auto-match rate
- Items needing review (queue only)
- Ready for Database Move (ready vs blocked)

Remove:
- demo file groups (until backend lanes exist)
- dense dual "confidence & risk" block

## C) Replace technical SQL action in main path

Use:
- final review tab with:
  - candidate list
  - reasons
  - `Move selected` / `Move all ready`
  - optional `Auto move when ready`

Avoid SQL wording in primary UI.

## D) Clarify units

Never sum unlike units:
- keep "fields needing review" separate from "queue items pending review"

## E) Add one "What does this mean?" helper text per panel

One plain sentence only; avoid long paragraphs.

---

## 13) Backend + Frontend improvements to do next

## Backend (small but high-value)
- Add explicit lane metadata in `/files` instead of filename heuristics.
- Add one compact overview endpoint with already business-safe metrics:
  - files_tracked
  - auto_match_rate
  - pending_queue_items
  - ready_for_database_move_count
  - blocked_count

## Frontend (demo-critical)
- Add `Ready for Database Move` tab (already documented in `11_ready_for_database_move_tab.md`).
- Use new endpoints:
  - `GET /storage/database-move/candidates`
  - `POST /storage/database-move`
- Remove/relocate "SQL proof" from the main Mapping demo area.
- Clean Overview to 4 KPI cards + one clear CTA.

---

## 14) Short presenter-safe explanation

"These numbers are based on the 6 files currently loaded in our demo state.  
Our mapping is now stricter than before, so low-confidence fields are intentionally routed to review instead of auto-accepted.  
The goal is safe automation: automate what is trusted, and show clear reasons for what still needs human review."

