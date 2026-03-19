# ClinIQ Pitch Deck Plan (Problem -> Demo -> Technical)

This is a practical slide-by-slide plan for a short hackathon pitch with your required flow:
1) Problem
2) Live demo
3) Technical implementation (background processing/mapping)

Use this as a speaker guide + deck content checklist.

## Recommended total structure

- Target duration: 5-7 minutes
- Total slides: 9-11
- Suggested split:
  - Problem + value: 2-3 slides
  - Demo: 3-4 slides
  - Technical implementation: 3-4 slides
  - Close: 1 slide

---

## Slide 1 - Title + One-liner

**Goal**  
Introduce the product clearly in one sentence.

**Content**
- Product name: `ClinIQ`
- Tagline: "Clinical Intelligence Querying"
- One-liner: "We transform messy multi-source healthcare files into trusted, reviewable database-ready records."
- Team members + roles (small footer)

**Suggested visual**
- Clean hero screen mock (Overview dashboard screenshot)
- 3 badges under title: `AI-assisted`, `Human-in-the-loop`, `Database-ready`

---

## Slide 2 - Problem

**Goal**  
Show pain clearly and why current workflows fail.

**Content**
- Hospitals receive mixed input: CSV, XLSX, PDF, free text
- Same concept appears with different column names/abbreviations/languages
- Manual mapping is slow and error-prone
- Blind auto-import is risky for healthcare data trust

**Suggested visual**
- "Before" diagram:
  - left: many messy source files
  - middle: red warning icon "manual chaos"
  - right: target database with question marks

**Speaker line**
- "The challenge is not only importing data, it is importing it safely and explainably."

---

## Slide 3 - Our approach (Trust Layer)

**Goal**  
Position your unique value before demo starts.

**Content**
- ClinIQ adds a trust layer between raw files and database
- Combines deterministic mapping + AI-assisted mapping
- Scores confidence, flags uncertainty, and requests human review when needed
- Adds final checkpoint: `Ready for Database Move`

**Suggested visual**
- Pipeline strip:
  `Ingest -> Normalize -> Map -> Score -> Review -> Move to Database`

---

## Slide 4 - Demo start (what you will show)

**Goal**  
Set audience expectation and make demo easy to follow.

**Content**
- "In this demo, we will show:"
  1. Imported files and source categories
  2. Mapping + quality trust signals
  3. Final review and move-to-database action

**Suggested visual**
- Simple agenda with 3 numbered blocks matching the 3 demo steps

---

## Slide 5 - Demo step 1: Data intake and visibility

**Goal**  
Show system understands incoming data.

**Content (live)**
- Open file/source dashboard
- Show counts by category and ingestion status
- Show that different source families are handled in one workflow

**What to say**
- "First, ClinIQ ingests heterogeneous files and groups them by source type for transparent tracking."

**Suggested visual**
- Live UI screenshot backup with highlighted source cards

---

## Slide 6 - Demo step 2: Mapping + quality + AI trust signals

**Goal**  
Demonstrate "intelligent + safe" behavior.

**Content (live)**
- Show mapping outcomes (auto / warning / manual review)
- Show quality insights and alerts
- Show AI-assisted evidence for difficult fields (if available in UI)

**What to say**
- "We do not just map automatically; we classify confidence and explain uncertainty."

**Suggested visual**
- Split screen:
  - left: mapping status chart
  - right: quality/alerts card

---

## Slide 7 - Demo step 3: Ready for Database Move (final review gate)

**Goal**  
Show human control before persistence.

**Content (live)**
- Open `Ready for Database Move` tab
- Show ready vs needs-review items + reasons
- Click `Move all ready` (or `Move selected`)
- Show moved count and remaining blocked items

**What to say**
- "This final checkpoint ensures only trusted records are moved. Users stay in control."

**Suggested visual**
- Table mock with green `Ready` and amber `Needs review` rows

---

## Slide 8 - Technical implementation (high-level architecture)

**Goal**  
Explain what happens in background without too much code detail.

**Content**
- Frontend: Next.js dashboard
- Backend: FastAPI services
- Core engines:
  - Ingest/preview parser
  - Deterministic normalization + source mapping configs
  - Confidence routing + correction memory
  - AI provider abstraction (dual scoring)
  - Quality engine + database move validator
- Persistence target: SQLite demo path (schema-conform process)

**Suggested visual**
- Architecture blocks with arrows:
  `Frontend -> API -> Engines -> Review gate -> DB`

---

## Slide 9 - Technical processing/mapping steps (detailed sequence)

**Goal**  
Show processing order and reliability controls.

**Content**
1. Parse file preview and detect table/text kind
2. Normalize identifiers and datetime/null formats
3. Generate mapping hypotheses
4. Score deterministic confidence
5. Optionally enrich with AI-assisted suggestions
6. Route each field (`auto`, `warning`, `manual_review`)
7. Run quality checks (IDs, drift, anomalies, identity conflicts)
8. Build database-move candidates with conformance + issue severity
9. Move only ready items after explicit user confirmation (or auto mode)

**Suggested visual**
- Numbered vertical flow with decision diamonds at route/review points

---

## Slide 10 - Why this matters (innovation + real-world fit)

**Goal**  
Map your value to judging criteria.

**Content**
- Innovation: trust-layer + dual scoring + explainability
- Practicality: handles realistic noisy files
- Safety: human review before persistence
- Scalability: provider abstraction and configurable policies
- Adoption: non-technical, outcome-focused UI

**Suggested visual**
- 5 icons with one-liner each (innovation, reliability, usability, scalability, impact)

---

## Slide 11 - Closing + next steps

**Goal**  
End with confidence and clear roadmap.

**Content**
- "ClinIQ turns fragmented healthcare imports into trusted, reviewable, database-ready outputs."
- Immediate next steps:
  - expand frontend review actions
  - improve conformance for all source families
  - productionize full-file processing and deployment

**Suggested visual**
- Final pipeline image with green check at "Database Move"

---

## Presenter checklist (quick)

- Keep vocabulary non-technical on demo screens (`Ready for Database Move`, not SQL wording)
- Emphasize "AI assists decisions; humans keep control"
- Always show one blocked item and explain why it is blocked
- End with measurable result (moved count + remaining review count)
- Keep backup screenshots in case live demo has lag

