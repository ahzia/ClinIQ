# epaCC START Hack 2026 - Unique Strategy + Stack (with Next.js Frontend)

Assumption locked: **Frontend = Next.js** (team decision).

Goal of this document: avoid a "generic ETL dashboard" and maximize score across judging criteria with a unique but realistic implementation path in <24h, using vibe-coding-friendly tools (Cursor + AI-assisted coding).

## 1) Differentiator Idea (What makes you unique)

Most teams will show:
- file upload
- mapping
- quality checks
- charts

Recommended unique angle:

**"Trust Layer for Healthcare Mapping"**
- Every mapping decision gets:
  - confidence score,
  - reason/explanation,
  - risk label,
  - human approval status,
  - audit trail.
- Include a **what-if simulator**: "If we accept this mapping, what changes in quality score and downstream joins?"
- Add a **human-in-the-loop correction memory**: user fixes today become rules tomorrow.

Why unique:
- Combines AI + governance + business reliability (not only technical parsing).
- Matches real hospital constraints: explainability, traceability, and controlled automation.

## 2) Judging-Criteria Strategy (where to win points)

- **Viability / business applicability (25%)**: biggest opportunity.
  - Show governance, explainability, and safe adoption path.
- **Feasibility / maturity (20%)**: second biggest opportunity.
  - Show practical architecture that can run on-prem and be piloted quickly.
- **Complexity & technical sophistication (20%)**:
  - Combine deterministic rules + AI suggestions + feedback loop.
- **Creativity & innovation (15%)**:
  - Trust scoring + what-if simulator + correction memory.
- **Design & usability (10%)**:
  - Make manual correction UX excellent in Next.js.

## 3) Recommended Stack (Backend + Tools with Next.js)

## Core choice (best balance for <24h)

- **Frontend:** Next.js (App Router) + Tailwind + shadcn/ui + React Query
- **Backend API:** FastAPI (Python)
- **Data engine:** pandas + pyarrow
- **Storage:** PostgreSQL (or SQLite fallback if setup time is constrained)
- **Validation:** Great Expectations (or lightweight custom rules if behind schedule)
- **Parsing:** openpyxl (xlsx), pdfplumber (pdf), python csv/sniffer (delimiter)
- **AI mapping assistant:** small LLM wrapper (OpenAI-compatible or local model endpoint)
- **Background jobs:** start synchronous; add Celery/Redis only if needed

This gives:
- strong UI polish (Next.js),
- fast data work (Python),
- realistic delivery speed,
- high vibe-coding compatibility.

## 4) Tool Decision Matrix (Use / Avoid / Alternative)

Scoring below is estimated "judging impact potential" if implemented well in hackathon scope.

### A) Strongly Use

1) **FastAPI + pandas**
- Use? **Yes**
- Why: fastest path for complex data normalization and schema mapping logic.
- Judging impact: **+8 to +12 points potential** (complexity + feasibility + viability).
- Difficulty: **Low-Medium**
- Vibe-coding fit (Cursor): **Excellent** (clear functions, rapid generation/refactor).
- Best alternative: Node backend with DuckDB/Arrow, but slower for healthcare data cleaning complexity.

2) **PostgreSQL (or SQLite fallback)**
- Use? **Yes**
- Why: business credibility + persistence + queryability for demo.
- Judging impact: **+4 to +7**
- Difficulty: **Low**
- Vibe-coding fit: **High**
- Best alternative: DuckDB for speed; less enterprise signaling than Postgres.

3) **Next.js + shadcn/ui**
- Use? **Yes** (already decided)
- Why: strongest path to design/usability points and polished demo.
- Judging impact: **+4 to +8**
- Difficulty: **Medium**
- Vibe-coding fit: **High** (component generation is fast with Cursor).
- Best alternative: Streamlit (faster) but lower custom UX ceiling.

4) **Lightweight LLM mapping assistant (not full platform)**
- Use? **Yes**
- Why: adds innovation via mapping suggestions + explanations + confidence.
- Judging impact: **+5 to +9**
- Difficulty: **Medium**
- Vibe-coding fit: **High** if scoped tightly.
- Best alternative: pure rule-based mapping; safer but less innovative.

### B) Use Only If Time Remains

5) **Great Expectations**
- Use? **Maybe**
- Why: strong data-quality story, but setup overhead can cost time.
- Judging impact: **+2 to +5**
- Difficulty: **Medium**
- Vibe-coding fit: **Medium**
- Best alternative: custom rule engine in pandas (faster to ship).

6) **AnythingLLM (or similar full platform)**
- Use? **Maybe, low priority**
- Why: can help with doc Q&A, but weak direct value unless tightly integrated into mapping workflow.
- Judging impact: **+1 to +4**
- Difficulty: **Medium**
- Vibe-coding fit: **Medium**
- Best alternative: minimal in-app "AI explain" endpoint.

7) **toFHIR (small export demo only)**
- Use? **Maybe, optional bonus**
- Why: strong interoperability story if you export 1-2 resources.
- Judging impact: **+3 to +6** (mostly viability)
- Difficulty: **Medium-High**
- Vibe-coding fit: **Medium**
- Best alternative: mention FHIR roadmap and export canonical JSON now.

### C) Avoid for 24h MVP

8) **HAPI FHIR full server**
- Use? **No (for MVP)**
- Why not: strong long-term value, but high setup/modeling overhead.
- Judging impact if incomplete: can become negative due to instability.
- Difficulty: **High**
- Vibe-coding fit: **Low-Medium** in short time window.
- Best alternative: thin FHIR export module + roadmap slide.

9) **MCP server setup**
- Use? **No (for product MVP)**
- Why not: helps dev orchestration more than product value.
- Judging impact: **near zero direct**
- Difficulty: **Medium**
- Vibe-coding fit: **Medium**, but low ROI for judging.
- Best alternative: keep architecture simple and demo-ready.

## 5) Best Backend Option Given Next.js Frontend

Recommended:
- **Next.js frontend**
- **FastAPI backend**
- **Postgres**
- **Python mapping engine**

Reason:
- Next.js handles UX and polish.
- Python handles messy healthcare data transformations faster than Node in hackathon conditions.
- This split is common, robust, and highly vibe-codeable with Cursor.

## 6) What to Build to Be Different (Feature List)

Build these 4 features; they create differentiation and scoring leverage:

1) **Mapping Confidence + Explainability Panel**
- For each mapped field show:
  - source column,
  - target field,
  - confidence,
  - rationale,
  - risk level.

2) **What-if Quality Simulator**
- Toggle mapping choice and instantly show:
  - join success rate change,
  - missingness change,
  - anomaly count change.

3) **Human Correction Memory**
- Save manual fixes as reusable rules.
- Reapply rules automatically on next file.

4) **Trust Report Export**
- One-click export with:
  - unresolved mappings,
  - high-risk fields,
  - quality score by source,
  - manual overrides list.

## 7) Vibe-Coding Feasibility (Cursor-specific realism)

What Cursor can accelerate very well:
- API scaffold + route handlers
- data normalization functions
- mapping dictionary generation/refactor
- UI components and forms in Next.js
- validation + test stubs

What still needs manual judgement:
- canonical healthcare field model choices
- scoring rubric/weights
- edge-case acceptance policies
- final UX flow decisions for judges

Recommended team split:
- Person A: Next.js UI + correction workflow
- Person B: FastAPI + parsing + normalization
- Person C: AI suggestion logic + scoring + demo narrative

## 8) Risk Control (to avoid demo failure)

- Freeze scope by hour 12.
- Prioritize stability over extra integrations.
- Keep fallback mode: if AI fails, deterministic mapping still works.
- Preload 3 demo scenarios:
  - clean file,
  - altered clinic file (broken headers),
  - PDF nursing note extraction.

## 9) Final Recommendation

With Next.js fixed, the most strategic and realistic path is:

**Next.js + FastAPI + pandas + Postgres + lightweight LLM helper**, centered on a **Trust Layer** (confidence, explainability, what-if, correction memory).

This is the best chance to be both:
- **different from other teams**, and
- **credible on judging criteria** within 24 hours.
