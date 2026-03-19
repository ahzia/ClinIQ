# UI/UX Best Practices for Smart Health Data Mapping

Goal: make the product feel modern, trustworthy, and efficient for data/clinical operations users.

## 1) UX Principles for This Product

1. Clarity over decoration
- Users need to make mapping and data-quality decisions quickly.
- Keep information hierarchy obvious and consistent.

2. Explainability by default
- Always show why a mapping or alert exists.
- Confidence and rationale are first-class UI elements.

3. Progressive disclosure
- Start with summary KPIs.
- Let users drill down to file -> field -> record-level details.

4. Fast feedback loops
- Every action should feel immediate (loading skeletons, optimistic UI where safe).

5. Trust and auditability
- Show lineage, timestamps, and status changes.
- Avoid "black-box only" interactions.

## 2) Recommended Information Architecture

Top navigation:
- Dashboard
- Sources
- Files
- Alerts
- Corrections
- Settings

Dashboard sections:
- KPI row
- source distribution cards
- mapping outcome chart
- data quality by category chart
- recent high-severity alerts

## 3) Core Components to Build

- KPI cards with trend chips
- source category cards
- file table with filter/search/sort
- status badges
- confidence bar component
- severity pill (`high`, `medium`, `low`)
- alert card with suggested action
- correction queue table with row actions
- detail drawer/panel for file and alert context

## 4) Visual Language (Modern and Practical)

- Typography:
  - readable, neutral sans-serif
  - use 3 text levels max per screen

- Color:
  - neutral base + semantic colors only for states
  - success/clean: green
  - warning/review: amber
  - danger/fail: red
  - info/mapped: blue

- Spacing:
  - consistent spacing scale (e.g. 4, 8, 12, 16, 24)
  - avoid cramped table rows

- Density:
  - give option for compact table density for power users

## 5) Dashboard UX Guidelines

- Always include these top KPIs:
  - imported files
  - successful mappings
  - mapping alerts
  - overall quality score

- For quality charts:
  - use stacked bars for clean/missing/incorrect
  - keep category order stable

- For alerts:
  - default sort by severity then recency
  - quick filter chips: `all`, `high`, `needs review`

## 6) Manual Correction UX

- Correction row should show:
  - source field
  - suggested target
  - confidence score
  - reason text
  - quick actions: approve/reject/edit

- Add "Apply as reusable rule" toggle on approve.
- Show impact preview:
  - how many future fields/files this rule can affect.

## 7) Table and Data Grid Best Practices

- Sticky header
- column resize optional
- persistent filters in URL query params
- server/client pagination abstraction ready
- export visible rows option (CSV)

## 8) Error, Loading, and Empty States

- Loading:
  - use skeletons, not spinners only

- Empty:
  - explain what to do next ("Upload files to begin mapping")

- Error:
  - show concise technical message + retry button
  - provide correlation/request ID if available

## 9) Accessibility and Usability

- Keyboard navigation in tables/forms
- sufficient color contrast
- do not use color as only signal; pair with icon/text
- all interactive elements need visible focus states
- semantic HTML and ARIA labels for dynamic widgets

## 10) Suggested UX Copy Tone

- concise and action-oriented
- avoid jargon when possible
- examples:
  - "Needs review" instead of "low confidence mapping unresolved"
  - "Apply correction" instead of "commit transformation override"

## 11) Smart UX Features (High Value)

1. Confidence-first interface
- Visual confidence bars with thresholds.

2. Explain panel
- "Why this mapping?" drawer with semantic and value hints.

3. One-click triage
- Buttons:
  - Accept all high-confidence
  - Show only low-confidence
  - Create rule from current correction

4. Audit timeline
- Show import -> map -> validate -> correction events.

## 12) Anti-Patterns to Avoid

- Overloading one page with every metric
- Too many chart types at once
- Hidden critical errors behind deep clicks
- Unclear status naming across pages
- Hard-to-read small text in dense tables

## 13) Definition of "Good UX" for This Hackathon

A judge should be able to:
1. understand data coverage in 10 seconds,
2. see mapping quality and alerts in 20 seconds,
3. resolve one mapping issue in under 1 minute,
4. trust the result because rationale and lineage are visible.

If your UI supports this flow, you are in a strong position for design/usability and presentation criteria.

