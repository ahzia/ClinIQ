# Ready for Database Move Tab (Frontend Handoff)

This tab is the final review step before data is written to the target database.

## Goal

Show users a clear "review before move" checkpoint:
- what can be moved now,
- what still needs attention,
- one-click actions for selected items or all-ready items.

## UI Naming (Non-Technical)

Use these labels in demo UI:
- Tab: `Ready for Database Move`
- Actions: `Move selected`, `Move all ready`
- Toggle: `Auto move when ready`
- Status chips: `Ready`, `Needs review`

Avoid "SQL" wording in this tab.

## Endpoints

- `GET /api/v1/storage/database-move/candidates?auto_move=false`
  - returns review list
  - if `auto_move=true`, backend will move all currently ready files in same call
- `POST /api/v1/storage/database-move`
  - move selected files (`file_ids`) or all-ready (`move_all_ready=true`)

## Minimum Table Columns

- File
- Source
- Rows to move (`rows_attempted`)
- Conformance (`schema_conformance_percent`)
- Issues (`high_issues`, `medium_issues`, `low_issues`)
- Status (`ready_for_database_move`)
- Reason (`reason`)

## Frontend Behavior

1. On tab load, call candidates endpoint with `auto_move=false`.
2. Enable row selection only for items with `ready_for_database_move=true`.
3. `Move selected` -> call POST `/storage/database-move` with selected `file_ids`.
4. `Move all ready` -> call POST `/storage/database-move` with `move_all_ready=true`.
5. If toggle `Auto move when ready` is enabled:
   - call candidates endpoint with `auto_move=true`,
   - refresh table after response.
6. After any move call:
   - refresh candidates query,
   - refresh files summary query,
   - show success/error toast with moved vs failed count.

## Query Keys (TanStack)

- `["database-move-candidates", { autoMove: boolean }]`
- `["database-move-last-result"]` (optional local state)

Invalidate after move:
- `["database-move-candidates", { autoMove: false }]`
- `["files"]`
- `["mapping-summary"]`
- `["quality-summary"]`

## Demo Script Insert (30-45 seconds)

- Open `Ready for Database Move` tab.
- Explain: "This is our final human checkpoint before writing data."
- Show a blocked row and the reason.
- Click `Move all ready`.
- Show success count and remaining review-needed items.

