# API Contract Lock Matrix (Frontend v1)

This file is the compact contract matrix for frontend implementation.

Contract status: **LOCKED** for `/api/v1`.

## Base
- Base URL: `http://localhost:8000/api/v1`
- Contract version endpoint: `GET /contracts/version`

## Endpoint Matrix

| Area | Method | Path | Frontend usage |
|---|---|---|---|
| Health | GET | `/health` | Backend availability badge |
| Ingest | POST | `/ingest/upload` | Upload modal / drag-drop |
| Sources | GET | `/sources` | Source category cards |
| Files | GET | `/files` | Main files table + summary KPIs |
| Files | GET | `/files/{file_id}` | File detail drawer/page |
| Files | GET | `/files/{file_id}/preview` | Preview table |
| Mapping | GET | `/mapping/summary` | Mapping KPI/overview |
| Mapping | GET | `/mapping/canonical-model` | Canonical target entity/field catalog |
| Mapping | GET | `/mapping/alerts` | Alerts list |
| Mapping | POST | `/mapping/rerun` | Re-run actions |
| Quality | GET | `/quality/summary` | Overall quality cards |
| Quality | GET | `/quality/by-source` | Stacked quality chart |
| Corrections | GET | `/corrections/queue` | Review queue table |
| Corrections | POST | `/corrections/{correction_id}/approve` | Approve action |
| Corrections | POST | `/corrections/{correction_id}/reject` | Reject action |
| Corrections | PATCH | `/corrections/{correction_id}` | Edit/override action |
| Meta | GET | `/meta/enums` | Filters/badges enums |
| Meta | GET | `/contracts/version` | API contract check |

## Required Enums (from `/meta/enums`)

- `file_status`: `imported`, `processing`, `failed`
- `mapping_status`: `mapped`, `mapped_with_warnings`, `needs_review`, `failed`
- `quality_status`: `clean`, `mixed`, `unknown`
- `alert_severity`: `high`, `medium`, `low`
- `correction_status`: `pending_review`, `accepted`, `rejected`, `edited`

## Error Handling Contract

- 400: invalid request (e.g., missing `file_id` for `scope=file`)
- 404: unknown resource (e.g., correction ID not found)
- 422: request payload validation issue
- 500: unexpected backend failure

Frontend should show:
- concise message,
- retry action,
- non-blocking fallback where possible.

## Contract Stability Rules

1. No response-field removals or renames in `/api/v1`.
2. Additive changes only in `/api/v1` (new optional fields allowed).
3. Breaking changes require `/api/v2`.
4. Frontend should tolerate unknown additional fields.

## Pre-Integration Checklist

- [ ] Use `/contracts/version` on app startup (optional banner/log only).
- [ ] Wire query keys to all GET endpoints.
- [ ] Wire mutations for correction actions and rerun.
- [ ] Invalidate affected queries after mutations.
- [ ] Add badge rendering based on enum endpoints, not hardcoded strings.

