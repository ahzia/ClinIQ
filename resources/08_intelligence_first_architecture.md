# Intelligence-First Architecture (What Makes This Actually Smart)

You are correct: if the system is only manual Python transforms, it is not a strong "intelligent application."

This document defines the **actual intelligence layer** that should sit on top of deterministic parsing.

## 1) Core Principle

Use a **hybrid autonomous mapper**:
- deterministic ingestion/cleaning for reliability,
- model-driven semantic inference for unknown schemas,
- confidence-based decision engine,
- feedback loop that learns from human corrections.

This is materially different from static ETL scripts.

## 2) What "Intelligent" Means in Your Product

For each unseen source file, system should autonomously:

1. **Detect source type and schema pattern**
   - table, PDF, free text, wide epaAC variant, broken headers

2. **Generate mapping hypotheses**
   - candidate target fields per source field
   - multiple candidates, not one hardcoded answer

3. **Score confidence using multiple signals**
   - semantic similarity (name/context)
   - value pattern fit (numeric range/date/code style)
   - cross-field consistency (e.g., case/patient link plausibility)
   - historical acceptance rate of similar mappings

4. **Autonomously decide route**
   - high confidence -> auto-apply
   - medium confidence -> apply with warning
   - low confidence -> send to manual queue

5. **Learn from corrections**
   - accepted/rejected mappings become reusable rules
   - future files get better without hardcoding each file

## 3) Intelligence Components (Concrete)

## A) Schema Intelligence Engine
- Inputs: source headers, sample rows, metadata, file category
- Outputs: ranked mapping candidates with confidence + rationale

Implementation options:
- LLM prompt + structured JSON output
- embedding similarity + rule scoring
- hybrid weighted ensemble (best option)

## B) Value Semantics Profiler
- Infers likely meaning from values:
  - blood-pressure-like ranges,
  - ICD/OPS-like code patterns,
  - datetime signatures,
  - binary event signals

This prevents name-only mapping errors.

## C) Self-Validation Agent
- Runs post-mapping plausibility checks:
  - impossible value checks,
  - join integrity checks,
  - missingness spikes after mapping
- Can downgrade confidence or open alert automatically.

## D) Correction Memory
- Stores manual corrections as:
  - synonym rules,
  - transformation templates,
  - source-specific overrides
- Reuses them on future imports.

This creates adaptive behavior (core intelligence signal for judges).

## 4) Suggested Stack to Implement This

Keep your prior stack, but add explicit intelligence modules:

- Frontend: Next.js
- Backend: FastAPI
- Data: pandas, pyarrow
- Storage: Postgres
- AI orchestration: lightweight LangChain or direct LLM wrapper
- Similarity: sentence-transformers (or provider embeddings)
- Rules/weights: configurable YAML/JSON policy

Key point: intelligence sits in **modular decision engine**, not random one-off prompts.

## 5) Decision Policy (Simple but Powerful)

Example thresholds:
- confidence >= 0.85 -> auto map
- 0.60 to 0.84 -> map with warning
- < 0.60 -> manual review required

Confidence formula example:

`final = 0.35*semantic + 0.30*value_pattern + 0.20*cross_field + 0.15*history`

Make weights configurable in admin UI (great for business applicability points).

## 6) Why This Scores Better

Compared to "manual Python mapping," this architecture improves:

- **Creativity & Innovation (15%)**
  - autonomous hypothesis + learning loop

- **Complexity & Technical Sophistication (20%)**
  - multi-signal scoring + self-validation

- **Viability (25%)**
  - controlled automation with auditability and governance

- **Feasibility (20%)**
  - still realistic in 24h if scoped to 2-3 high-value categories

## 7) 24h Realistic Scope for Intelligence

Do not overbuild. Implement:

1. Mapping hypothesis generator (LLM + structured output)
2. Confidence scorer (3-4 signals)
3. Auto vs review routing
4. Manual correction persistence + reuse
5. Dashboard counters:
   - auto-mapped fields
   - flagged fields
   - correction reuse rate

That is enough to prove intelligence credibly.

## 8) Final Position

Your concern is valid.

The project becomes truly intelligent only when it can:
- handle unseen schemas,
- explain its decisions,
- self-check quality,
- and improve from human feedback.

That is the version you should build and pitch.
