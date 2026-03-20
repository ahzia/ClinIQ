import csv
from io import StringIO
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from app.core.settings import settings
from app.core.stub_store import stub_store
from app.ingest.preview_parser import parse_file_preview
from app.mapping.canonical_model import get_canonical_model
from app.mapping.ai_assist import run_ai_assisted_mapping
from app.mapping.confidence import score_mapping_confidence
from app.mapping.config_mapping import apply_mapping_rules, list_mapping_rule_files, load_mapping_rules
from app.mapping.epaac_dictionary import epaac_coverage, query_epaac_dictionary
from app.mapping.hypothesis import generate_column_hypotheses
from app.mapping.normalization import normalize_rows
from app.quality.engine import evaluate_file_quality
from app.schemas.contracts import (
    AiAssistResponse,
    MappingConfidenceResponse,
    MappingRouteRequest,
    MappingRouteResponse,
    MappingHypothesisResponse,
    CanonicalModelResponse,
    MappedPreviewResponse,
    MappingRuleListResponse,
    MappingRuleResponse,
    ContractVersionResponse,
    CorrectionActionRequest,
    CorrectionActionResponse,
    CorrectionsQueueResponse,
    EnumsResponse,
    FileDetailsResponse,
    FilePreviewResponse,
    FilesResponse,
    MappingAlertsResponse,
    MappingRerunRequest,
    MappingRerunResponse,
    MappingSummaryResponse,
    DatabaseMoveCandidate,
    DatabaseMoveCandidatesResponse,
    DatabaseMoveRequest,
    DatabaseMoveResponse,
    EpaacDictionaryResponse,
    EpaacCoverageResponse,
    NormalizePreviewResponse,
    RuntimeConfigResponse,
    ExportNormalizedResponse,
    StorageSqlLoadRequest,
    StorageSqlLoadResponse,
    QualityBySourceResponse,
    QualityByFileResponse,
    QualitySummaryResponse,
    SourcesResponse,
)
from app.storage.sql_conformance import validate_and_persist_auto_mapped_rows

router = APIRouter(tags=["frontend-stub"])

_SOURCE_LABELS = {
    "assessments_epaAC": "Care Assessments (epaAC)",
    "diagnoses_icd_ops": "Diagnoses & Procedures (ICD10/OPS)",
    "labs": "Lab Parameters",
    "medication": "Medication Plans (Inpatient)",
    "device_motion": "Sensor Motion / Fall",
    "device_motion_1hz": "Sensor Motion / Fall (1Hz)",
    "nursing_reports": "Nursing Reports",
}

_SOURCE_NOTES = {
    "assessments_epaAC": "Multiple epaAC schema variants with code-based columns.",
    "diagnoses_icd_ops": "ICD-10 and OPS codes, including altered source variants.",
    "labs": "Lab panel exports with flags and reference ranges.",
    "medication": "ORDER/CHANGE/ADMIN record types with timeline values.",
    "device_motion": "Hourly + 1Hz motion/fall exports with drift variants.",
    "device_motion_1hz": "High-frequency 1Hz motion/fall exports.",
    "nursing_reports": "Structured and free-text nursing reports.",
}

_DATABASE_MOVE_MIN_CONFORMANCE = 90


def _normalize_demo_lane(demo_lane: str | None) -> str | None:
    if demo_lane is None:
        return None
    lane = demo_lane.strip().lower()
    if lane in {"all", ""}:
        return None
    if lane in {"expected_pass", "expected", "clean"}:
        return "expected_pass"
    if lane in {"error_heavy", "error", "errors"}:
        return "error_heavy"
    return None


def _file_matches_demo_lane(file_item: dict, demo_lane: str | None) -> bool:
    lane = _normalize_demo_lane(demo_lane)
    if lane is None:
        return True
    name = str(file_item.get("name", "")).lower()
    if lane == "expected_pass":
        return name.startswith("expected__")
    if lane == "error_heavy":
        return name.startswith("error__")
    return True


def _filtered_files(demo_lane: str | None) -> list[dict]:
    payload = stub_store.list_files()
    files = payload.get("files", [])
    lane = _normalize_demo_lane(demo_lane)
    if lane is None:
        # Demo default: once curated lane files exist, hide legacy fixture rows
        # so "all data" means "all demo lanes".
        has_demo_lane_files = any(
            str(f.get("name", "")).lower().startswith(("expected__", "error__")) for f in files
        )
        if has_demo_lane_files:
            return [
                f
                for f in files
                if str(f.get("name", "")).lower().startswith(("expected__", "error__"))
            ]
        return files
    return [f for f in files if _file_matches_demo_lane(f, lane)]


def _compute_quality_payloads(demo_lane: str | None = None) -> tuple[dict, dict, dict]:
    files = _filtered_files(demo_lane)
    by_source: dict[str, list[dict]] = {}
    all_results: list[dict] = []
    alerts: list[dict] = []

    for f in files:
        file_id = f.get("id")
        if not file_id:
            continue
        source_id = f.get("source_id", "unknown")
        path = stub_store.get_file_path(file_id)
        if not path:
            continue
        try:
            kind, columns, rows, _ = parse_file_preview(path)
            if kind != "table":
                continue

            result = evaluate_file_quality(
                file_id=file_id,
                source_id=source_id,
                columns=columns,
                rows=rows,
                case_link_window_hours=settings.case_link_window_hours,
                identity_conflict_high_threshold=settings.identity_conflict_high_threshold,
            )
        except Exception as exc:
            # Keep dashboard resilient on malformed CSVs: treat parse failure as
            # a high-severity quality problem rather than crashing the whole page.
            all_results.append(
                {
                    "missing_required_ids": True,
                    "schema_drift": True,
                    "value_anomalies": True,
                    "clean_percent": 0,
                    "missing_percent": 50,
                    "incorrect_percent": 50,
                }
            )
            by_source.setdefault(source_id, []).append(
                {"clean_percent": 0, "missing_percent": 50, "incorrect_percent": 50}
            )
            alerts.append(
                {
                    "id": f"a_{file_id}_parse",
                    "severity": "high",
                    "file_id": file_id,
                    "source_id": source_id,
                    "type": "parse_failure",
                    "message": f"File could not be parsed for quality checks: {exc}",
                    "action": "Check delimiter/quoting and correct malformed rows before import.",
                }
            )
            continue
        by_source.setdefault(source_id, []).append(
            {
                "clean_percent": result.clean_percent,
                "missing_percent": result.missing_percent,
                "incorrect_percent": result.incorrect_percent,
            }
        )
        all_results.append(
            {
                "missing_required_ids": result.missing_required_ids,
                "schema_drift": result.schema_drift,
                "value_anomalies": result.value_anomalies,
                "clean_percent": result.clean_percent,
                "missing_percent": result.missing_percent,
                "incorrect_percent": result.incorrect_percent,
            }
        )
        for idx, alert in enumerate(result.alerts, start=1):
            alerts.append(
                {
                    "id": f"a_{file_id}_{idx}",
                    "severity": alert["severity"],
                    "file_id": file_id,
                    "source_id": source_id,
                    "type": alert["type"],
                    "message": alert["message"],
                    "action": alert["action"],
                }
            )

    if not all_results:
        summary_payload = {
            "summary": {
                "overall_quality_score": 100,
                "clean_percent": 100,
                "missing_percent": 0,
                "incorrect_percent": 0,
            },
            "kpis": {
                "files_with_missing_required_ids": 0,
                "files_with_schema_drift": 0,
                "files_with_value_anomalies": 0,
            },
        }
        by_source_payload = {"items": []}
        alerts_payload = {"alerts": []}
        return summary_payload, by_source_payload, alerts_payload

    clean_avg = round(sum(r["clean_percent"] for r in all_results) / len(all_results))
    missing_avg = round(sum(r["missing_percent"] for r in all_results) / len(all_results))
    incorrect_avg = round(sum(r["incorrect_percent"] for r in all_results) / len(all_results))
    summary_payload = {
        "summary": {
            "overall_quality_score": max(0, min(100, clean_avg)),
            "clean_percent": clean_avg,
            "missing_percent": missing_avg,
            "incorrect_percent": incorrect_avg,
        },
        "kpis": {
            "files_with_missing_required_ids": sum(1 for r in all_results if r["missing_required_ids"]),
            "files_with_schema_drift": sum(1 for r in all_results if r["schema_drift"]),
            "files_with_value_anomalies": sum(1 for r in all_results if r["value_anomalies"]),
        },
    }

    by_source_items = []
    for source_id, rows in by_source.items():
        by_source_items.append(
            {
                "source_id": source_id,
                "clean_percent": round(sum(r["clean_percent"] for r in rows) / len(rows)),
                "missing_percent": round(sum(r["missing_percent"] for r in rows) / len(rows)),
                "incorrect_percent": round(sum(r["incorrect_percent"] for r in rows) / len(rows)),
            }
        )
    by_source_payload = {"items": sorted(by_source_items, key=lambda x: x["source_id"])}
    alerts_payload = {"alerts": alerts}
    return summary_payload, by_source_payload, alerts_payload


def _compute_quality_by_file_payload(
    demo_lane: str | None = None, source_id: str | None = None
) -> dict:
    files = _filtered_files(demo_lane)
    items: list[dict] = []
    for f in files:
        file_id = str(f.get("id", ""))
        src = str(f.get("source_id", "unknown"))
        if source_id and src != source_id:
            continue
        path = stub_store.get_file_path(file_id)
        if not path:
            continue
        file_name = str(f.get("name", file_id))
        try:
            kind, columns, rows, _ = parse_file_preview(path)
            if kind != "table":
                continue
            result = evaluate_file_quality(
                file_id=file_id,
                source_id=src,
                columns=columns,
                rows=rows,
                case_link_window_hours=settings.case_link_window_hours,
                identity_conflict_high_threshold=settings.identity_conflict_high_threshold,
            )
            items.append(
                {
                    "file_id": file_id,
                    "file_name": file_name,
                    "source_id": src,
                    "clean_percent": result.clean_percent,
                    "missing_percent": result.missing_percent,
                    "incorrect_percent": result.incorrect_percent,
                    "parse_status": "ok",
                }
            )
        except Exception:
            items.append(
                {
                    "file_id": file_id,
                    "file_name": file_name,
                    "source_id": src,
                    "clean_percent": 0,
                    "missing_percent": 50,
                    "incorrect_percent": 50,
                    "parse_status": "failed",
                }
            )
    return {"items": items}


def _build_live_review_queue(
    *, demo_lane: str | None = None, source_id: str | None = None, max_items: int = 400
) -> list[dict]:
    files = _filtered_files(demo_lane)
    items: list[dict] = []
    for f in files:
        if len(items) >= max_items:
            break
        file_id = str(f.get("id", ""))
        src = str(f.get("source_id", "unknown"))
        if source_id and src != source_id:
            continue
        path = stub_store.get_file_path(file_id)
        if not path:
            continue
        try:
            kind, columns, rows, _ = parse_file_preview(path)
            if kind != "table":
                continue
            conf = score_mapping_confidence(
                source_id=src,
                columns=columns,
                rows=rows,
                accepted_targets=stub_store.accepted_target_counts(),
                correction_memory=stub_store.correction_memory_for_source(src),
            )
            for r in conf.get("results", []):
                route = r.get("route")
                if route == "auto":
                    continue
                items.append(
                    {
                        "id": f"live_{file_id}_{str(r.get('source_field', 'x'))}",
                        "file_id": file_id,
                        "source_id": src,
                        "source_field": str(r.get("source_field", "")),
                        "suggested_target": str(r.get("target_field") or "unresolved"),
                        "confidence": float(r.get("final_score", 0.0)),
                        "status": "pending_review",
                        "reason": str(r.get("reason", "Needs review based on confidence score.")),
                    }
                )
                if len(items) >= max_items:
                    break
        except Exception:
            continue
    return items


def _compute_sources_payload(demo_lane: str | None = None) -> dict:
    files = _filtered_files(demo_lane)
    by_source: dict[str, dict] = {}
    totals = {"files_seen": len(files), "csv": 0, "xlsx": 0, "pdf": 0, "docs": 0}
    for file in files:
        source_id = file.get("source_id", "unknown")
        fmt = str(file.get("format", "")).lower()
        if source_id not in by_source:
            by_source[source_id] = {
                "id": source_id,
                "label": _SOURCE_LABELS.get(source_id, source_id.replace("_", " ").title()),
                "file_count": 0,
                "formats": set(),
                "notes": _SOURCE_NOTES.get(source_id, "Source category discovered from imported files."),
            }
        by_source[source_id]["file_count"] += 1
        if fmt:
            by_source[source_id]["formats"].add(fmt)
        if fmt in {"csv", "xlsx", "pdf"}:
            totals[fmt] += 1
        else:
            totals["docs"] += 1

    sources = []
    for source_id, item in sorted(by_source.items(), key=lambda x: x[0]):
        sources.append(
            {
                "id": item["id"],
                "label": item["label"],
                "file_count": item["file_count"],
                "formats": sorted(item["formats"]) if item["formats"] else ["unknown"],
                "notes": item["notes"],
            }
        )
    return {"sources": sources, "totals": totals}


def _compute_mapping_summary_payload(demo_lane: str | None = None) -> dict:
    files = _filtered_files(demo_lane)
    summary = {
        "total_fields_seen": 0,
        "auto_mapped": 0,
        "mapped_with_warning": 0,
        "needs_review": 0,
        "failed": 0,
    }
    by_source: dict[str, dict] = {}

    for file in files:
        file_id = file.get("id")
        source_id = file.get("source_id", "unknown")
        if source_id not in by_source:
            by_source[source_id] = {"source_id": source_id, "auto_mapped": 0, "needs_review": 0, "failed": 0}
        if not file_id:
            continue
        path = stub_store.get_file_path(file_id)
        if not path:
            continue
        try:
            kind, columns, rows, _ = parse_file_preview(path)
            if kind != "table":
                fields = max(1, len(columns))
                summary["total_fields_seen"] += fields
                summary["needs_review"] += fields
                by_source[source_id]["needs_review"] += fields
                continue
            payload = score_mapping_confidence(
                source_id=source_id,
                columns=columns,
                rows=rows,
                accepted_targets=stub_store.accepted_target_counts(),
                correction_memory=stub_store.correction_memory_for_source(source_id),
            )
            rs = payload.get("route_summary", {})
            summary["total_fields_seen"] += payload.get("columns_analyzed", 0)
            summary["auto_mapped"] += rs.get("auto", 0)
            summary["mapped_with_warning"] += rs.get("warning", 0)
            summary["needs_review"] += rs.get("manual_review", 0)
            by_source[source_id]["auto_mapped"] += rs.get("auto", 0)
            by_source[source_id]["needs_review"] += rs.get("warning", 0) + rs.get("manual_review", 0)
        except Exception:
            summary["failed"] += 1
            by_source[source_id]["failed"] += 1

    return {"summary": summary, "by_source": [by_source[k] for k in sorted(by_source.keys())]}


def _build_normalized_export(file_id: str) -> dict:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")
    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    kind, columns, rows, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "kind": kind,
            "rows_count": len(rows),
            "columns": columns,
            "rows": rows,
            "notes": notes + ["Export returns raw preview rows for non-table sources."],
        }

    normalized_rows, _ = normalize_rows(rows, columns)
    out_rows = normalized_rows
    out_notes = notes + ["Deterministic normalization applied."]
    try:
        rules_payload = load_mapping_rules(source_id)
        mapped_rows, _ = apply_mapping_rules(normalized_rows, rules_payload)
        out_rows = mapped_rows
        out_notes.append(f"Applied source mapping rules for {source_id}.")
    except FileNotFoundError:
        out_notes.append(f"No mapping rules found for {source_id}; returning normalized rows.")

    export_columns: list[str] = []
    if out_rows:
        export_columns = list(out_rows[0].keys())
    return {
        "file_id": file_id,
        "source_id": source_id,
        "kind": "table",
        "rows_count": len(out_rows),
        "columns": export_columns,
        "rows": out_rows,
        "notes": out_notes,
    }


def _storage_validation_for_file(file_id: str, *, persist: bool, clear_table_before_insert: bool) -> dict:
    path = stub_store.get_file_path(file_id)
    if not path:
        return {
            "file_id": file_id,
            "source_id": "unknown",
            "target_table": None,
            "auto_fields_seen": 0,
            "auto_fields_sql_mapped": 0,
            "schema_conformance_percent": 0,
            "rows_attempted": 0,
            "rows_inserted": 0,
            "rows_failed": 0,
            "db_path": None,
            "persisted": False,
            "issues": [{"severity": "high", "code": "file_not_found", "message": "File not found"}],
            "notes": ["No validation possible."],
        }

    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    try:
        kind, columns, rows, _ = parse_file_preview(path)
    except Exception as exc:
        return {
            "file_id": file_id,
            "source_id": source_id,
            "target_table": None,
            "auto_fields_seen": 0,
            "auto_fields_sql_mapped": 0,
            "schema_conformance_percent": 0,
            "rows_attempted": 0,
            "rows_inserted": 0,
            "rows_failed": 0,
            "db_path": None,
            "persisted": False,
            "issues": [
                {
                    "severity": "high",
                    "code": "parse_failure",
                    "message": f"File parsing failed before database move checks: {exc}",
                }
            ],
            "notes": ["No database move attempted because preview parsing failed."],
        }
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "target_table": None,
            "auto_fields_seen": 0,
            "auto_fields_sql_mapped": 0,
            "schema_conformance_percent": 0,
            "rows_attempted": 0,
            "rows_inserted": 0,
            "rows_failed": 0,
            "db_path": None,
            "persisted": False,
            "issues": [
                {
                    "severity": "high",
                    "code": "unsupported_kind",
                    "message": "Database move supports table-like files only.",
                }
            ],
            "notes": ["No database move attempted for non-table file."],
        }

    conf = score_mapping_confidence(
        source_id=source_id,
        columns=columns,
        rows=rows,
        accepted_targets=stub_store.accepted_target_counts(),
        correction_memory=stub_store.correction_memory_for_source(source_id),
    )
    result = validate_and_persist_auto_mapped_rows(
        file_id=file_id,
        source_id=source_id,
        rows=rows,
        confidence_results=conf["results"],
        processed_db_path=settings.processed_db_path,
        clear_table_before_insert=clear_table_before_insert,
        persist=persist,
        include_warning_candidates=settings.db_move_include_warnings,
        warning_score_threshold=settings.db_move_warning_score_threshold,
    )
    if (
        (result.get("rows_attempted", 0) == 0 or result.get("schema_conformance_percent", 0) < 60)
        and settings.ai_enabled
    ):
        ai = run_ai_assisted_mapping(
            source_id=source_id,
            columns=columns,
            rows=rows,
            accepted_targets=stub_store.accepted_target_counts(),
            correction_memory=stub_store.correction_memory_for_source(source_id),
        )
        if ai.get("ai_available"):
            ai_confidence_results = [
                {
                    "source_field": item.get("source_field"),
                    "target_field": item.get("final_target"),
                    "final_score": item.get("final_score", 0.0),
                    "route": item.get("route", "manual_review"),
                }
                for item in ai.get("results", [])
            ]
            ai_result = validate_and_persist_auto_mapped_rows(
                file_id=file_id,
                source_id=source_id,
                rows=rows,
                confidence_results=ai_confidence_results,
                processed_db_path=settings.processed_db_path,
                clear_table_before_insert=clear_table_before_insert,
                persist=persist,
                include_warning_candidates=settings.db_move_include_warnings,
                warning_score_threshold=settings.db_move_warning_score_threshold,
            )
            if ai_result.get("rows_attempted", 0) > result.get("rows_attempted", 0):
                ai_result["notes"].append(
                    "AI-assisted fallback applied because deterministic mapping produced low persistence coverage."
                )
                return ai_result
            result["notes"].append(
                "AI-assisted fallback evaluated but did not improve persistence coverage."
            )
        else:
            result["notes"].append("AI-assisted fallback unavailable (provider not configured or disabled).")
    return result


def _build_database_move_candidate(file_item: dict, *, persist: bool, clear_table_before_insert: bool) -> tuple[dict, bool]:
    file_id = str(file_item.get("id", ""))
    result = _storage_validation_for_file(
        file_id, persist=persist, clear_table_before_insert=clear_table_before_insert
    )
    issues = result.get("issues", [])
    high_issues = sum(1 for i in issues if i.get("severity") == "high")
    medium_issues = sum(1 for i in issues if i.get("severity") == "medium")
    low_issues = sum(1 for i in issues if i.get("severity") == "low")
    conformance = int(result.get("schema_conformance_percent", 0))
    rows_attempted = int(result.get("rows_attempted", 0))

    ready = rows_attempted > 0 and high_issues == 0 and conformance >= _DATABASE_MOVE_MIN_CONFORMANCE
    if ready:
        reason = "Ready for database move."
    elif rows_attempted == 0:
        reason = "No movable rows detected yet."
    elif high_issues > 0:
        reason = "High-severity issues must be resolved before database move."
    else:
        reason = (
            f"Schema conformance {conformance}% is below required "
            f"{_DATABASE_MOVE_MIN_CONFORMANCE}% threshold."
        )

    candidate = {
        "file_id": file_id,
        "file_name": str(file_item.get("name", "")),
        "source_id": str(file_item.get("source_id", "unknown")),
        "quality_status": str(file_item.get("quality_status", "unknown")),
        "mapping_status": str(file_item.get("mapping_status", "needs_review")),
        "rows_attempted": rows_attempted,
        "rows_inserted": int(result.get("rows_inserted", 0)) if persist else 0,
        "schema_conformance_percent": conformance,
        "high_issues": high_issues,
        "medium_issues": medium_issues,
        "low_issues": low_issues,
        "ready_for_database_move": ready,
        "reason": reason,
        "target_table": result.get("target_table"),
        "issues": issues,
    }
    return candidate, bool(result.get("persisted", False))


def _compute_database_move_candidates(*, auto_move: bool) -> dict:
    files = stub_store.list_files().get("files", [])
    candidates: list[dict] = []
    moved_count = 0
    failed_move_count = 0
    first_insert = True
    for file_item in files:
        candidate, _ = _build_database_move_candidate(
            file_item,
            persist=False,
            clear_table_before_insert=False,
        )
        if auto_move and candidate["ready_for_database_move"]:
            moved_candidate, persisted = _build_database_move_candidate(
                file_item,
                persist=True,
                clear_table_before_insert=False if not first_insert else False,
            )
            first_insert = False
            candidate = moved_candidate
            if persisted:
                moved_count += 1
            else:
                failed_move_count += 1
        candidates.append(candidate)

    ready_count = sum(1 for c in candidates if c["ready_for_database_move"])
    review_needed_count = len(candidates) - ready_count
    notes = [
        "Candidates are computed from validation checks over current preview rows.",
        f"Ready rule: conformance >= {_DATABASE_MOVE_MIN_CONFORMANCE}% and no high-severity issues.",
    ]
    if auto_move:
        notes.append("Auto move enabled: ready files were moved during this request.")
    return {
        "total_files_checked": len(candidates),
        "ready_count": ready_count,
        "review_needed_count": review_needed_count,
        "moved_count": moved_count,
        "failed_move_count": failed_move_count,
        "auto_move_enabled": auto_move,
        "candidates": candidates,
        "notes": notes,
    }


# ---- Sources / categories ----
@router.get("/sources", response_model=SourcesResponse)
def list_sources(
    demo_lane: str | None = Query(default=None),
) -> SourcesResponse:
    return _compute_sources_payload(demo_lane=demo_lane)


# ---- Files / ingestion overview ----
@router.get("/files", response_model=FilesResponse)
def list_files(
    demo_lane: str | None = Query(default=None),
) -> FilesResponse:
    payload = stub_store.list_files()
    files = _filtered_files(demo_lane)
    if len(files) == len(payload.get("files", [])):
        return payload
    summary = {
        "imported_files": len(files),
        "successful_mappings": sum(1 for f in files if f.get("mapping_status") == "mapped"),
        "mappings_with_warnings": sum(
            1 for f in files if f.get("mapping_status") == "mapped_with_warnings"
        ),
        "failed_mappings": sum(1 for f in files if f.get("mapping_status") == "failed"),
        "needs_review": sum(1 for f in files if f.get("mapping_status") == "needs_review"),
    }
    return {"files": files, "summary": summary}


@router.get("/files/{file_id}", response_model=FileDetailsResponse)
def get_file(file_id: str) -> FileDetailsResponse:
    return stub_store.get_file_details(file_id)


@router.post("/demo/reset-uploads")
def demo_reset_uploads() -> dict:
    removed = stub_store.clear_uploads()
    return {
        "removed_uploads": removed,
        "notes": ["In-memory uploaded files were cleared. Fixture files remain available."],
    }


@router.post("/demo/load-two-sources")
def demo_load_two_sources() -> dict:
    root = Path(__file__).resolve().parents[2]
    raw_dir = root / "data" / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    demo_dirs = [
        root / "data" / "demo_sources" / "expected_pass",
        root / "data" / "demo_sources" / "error_heavy",
    ]
    stub_store.clear_uploads()
    loaded = 0
    missing_dirs: list[str] = []
    for d in demo_dirs:
        if not d.exists():
            missing_dirs.append(str(d))
            continue
        for f in sorted(d.glob("*.csv")):
            file_id = str(uuid4())
            target = raw_dir / f"{file_id}_{f.name}"
            target.write_bytes(f.read_bytes())
            stub_store.register_upload(
                file_id=file_id,
                filename=f.name,
                stored_path=str(target),
                content_type="text/csv",
                size_bytes=target.stat().st_size,
            )
            loaded += 1
    return {
        "loaded_files": loaded,
        "missing_directories": missing_dirs,
        "notes": ["Loaded expected-pass and error-heavy demo datasets into upload store."],
    }


@router.get("/files/{file_id}/preview", response_model=FilePreviewResponse)
def preview_file(file_id: str) -> FilePreviewResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    kind, columns, rows, notes = parse_file_preview(path)
    return {
        "file_id": file_id,
        "kind": kind,
        "columns": columns,
        "rows": rows,
        "notes": notes,
    }


# ---- Mapping status ----
@router.get("/mapping/summary", response_model=MappingSummaryResponse)
def mapping_summary(
    demo_lane: str | None = Query(default=None),
) -> MappingSummaryResponse:
    return _compute_mapping_summary_payload(demo_lane=demo_lane)


@router.get("/mapping/canonical-model", response_model=CanonicalModelResponse)
def mapping_canonical_model() -> CanonicalModelResponse:
    return get_canonical_model()


@router.get("/mapping/configs", response_model=MappingRuleListResponse)
def mapping_configs() -> MappingRuleListResponse:
    return {"files": list_mapping_rule_files()}


@router.get("/mapping/configs/{source_id}", response_model=MappingRuleResponse)
def mapping_config_by_source(source_id: str) -> MappingRuleResponse:
    try:
        return load_mapping_rules(source_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Mapping config not found")


@router.get("/mapping/epaac-dictionary", response_model=EpaacDictionaryResponse)
def mapping_epaac_dictionary(
    iid: str | None = Query(default=None),
    sid: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
) -> EpaacDictionaryResponse:
    return query_epaac_dictionary(iid=iid, sid=sid, limit=limit)


@router.get("/mapping/epaac-coverage/{file_id}", response_model=EpaacCoverageResponse)
def mapping_epaac_coverage(file_id: str) -> EpaacCoverageResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")
    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    kind, columns, rows, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "total_dictionary_items": 0,
            "unique_codes_seen": 0,
            "matched_codes": 0,
            "coverage_percent": 0,
            "examples": [],
            "notes": notes + ["Coverage currently supports table-like files only."],
        }
    payload = epaac_coverage(columns, rows)
    return {
        "file_id": file_id,
        "source_id": source_id,
        **payload,
        "notes": notes + ["Coverage compares seen IID/SID-style codes against IID-SID-ITEM.csv dictionary."],
    }


@router.get("/mapping/normalize-preview/{file_id}", response_model=NormalizePreviewResponse)
def normalize_preview(file_id: str) -> NormalizePreviewResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    kind, columns, rows, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "kind": kind,
            "columns": columns,
            "rows": rows,
            "stats": {
                "rows_processed": len(rows),
                "case_id_normalized": 0,
                "patient_id_normalized": 0,
                "nulls_normalized": 0,
                "datetimes_normalized": 0,
                "case_id_source_column": None,
                "patient_id_source_column": None,
            },
            "notes": notes + ["Normalization currently applies to table-like data only."],
        }

    normalized_rows, stats = normalize_rows(rows, columns)
    return {
        "file_id": file_id,
        "kind": kind,
        "columns": columns + ["normalized_case_id", "normalized_patient_id"],
        "rows": normalized_rows,
        "stats": stats,
        "notes": notes + ["Deterministic normalization applied (IDs/nulls/dates)."],
    }


@router.get("/mapping/mapped-preview/{file_id}", response_model=MappedPreviewResponse)
def mapped_preview(file_id: str) -> MappedPreviewResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]

    kind, columns, rows, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "kind": kind,
            "rows": rows,
            "stats": {"mapped_fields": 0, "unmapped_fields": 0, "rule_count": 0},
            "notes": notes + ["Config mapping currently applies to table-like data only."],
        }

    try:
        rules_payload = load_mapping_rules(source_id)
    except FileNotFoundError:
        return {
            "file_id": file_id,
            "source_id": source_id,
            "kind": kind,
            "rows": rows,
            "stats": {"mapped_fields": 0, "unmapped_fields": len(rows) * max(len(columns), 1), "rule_count": 0},
            "notes": notes + [f"No mapping config found for source_id={source_id}."],
        }

    mapped_rows, stats = apply_mapping_rules(rows, rules_payload)
    return {
        "file_id": file_id,
        "source_id": source_id,
        "kind": kind,
        "rows": mapped_rows,
        "stats": stats,
        "notes": notes + [f"Applied mapping config for source_id={source_id}."],
    }


@router.get("/mapping/hypotheses/{file_id}", response_model=MappingHypothesisResponse)
def mapping_hypotheses(file_id: str) -> MappingHypothesisResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    kind, columns, _, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "target_catalog_size": 0,
            "columns_analyzed": 0,
            "results": [],
            "notes": notes + ["Hypothesis generator currently supports table-like files only."],
        }

    payload = generate_column_hypotheses(
        source_id=source_id,
        columns=columns,
        correction_memory=stub_store.correction_memory_for_source(source_id),
    )
    return {
        "file_id": file_id,
        "source_id": source_id,
        "target_catalog_size": payload["target_catalog_size"],
        "columns_analyzed": payload["columns_analyzed"],
        "results": payload["results"],
        "notes": notes + payload["notes"],
    }


@router.get("/mapping/confidence/{file_id}", response_model=MappingConfidenceResponse)
def mapping_confidence(file_id: str) -> MappingConfidenceResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    kind, columns, rows, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "columns_analyzed": 0,
            "results": [],
            "route_summary": {"auto": 0, "warning": 0, "manual_review": 0},
            "notes": notes + ["Confidence scoring currently supports table-like files only."],
        }

    payload = score_mapping_confidence(
        source_id=source_id,
        columns=columns,
        rows=rows,
        accepted_targets=stub_store.accepted_target_counts(),
        correction_memory=stub_store.correction_memory_for_source(source_id),
    )
    return {
        "file_id": file_id,
        "source_id": source_id,
        "columns_analyzed": payload["columns_analyzed"],
        "results": payload["results"],
        "route_summary": payload["route_summary"],
        "notes": notes + payload["notes"],
    }


@router.get("/mapping/ai-assist/{file_id}", response_model=AiAssistResponse)
def mapping_ai_assist(file_id: str) -> AiAssistResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    kind, columns, rows, notes = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "ai_provider": "openai-compatible",
            "ai_model": settings.ai_model,
            "ai_available": False,
            "columns_analyzed": 0,
            "results": [],
            "route_summary": {"auto": 0, "warning": 0, "manual_review": 0},
            "notes": notes + ["AI-assisted mapping currently supports table-like files only."],
        }

    payload = run_ai_assisted_mapping(
        source_id=source_id,
        columns=columns,
        rows=rows,
        accepted_targets=stub_store.accepted_target_counts(),
        correction_memory=stub_store.correction_memory_for_source(source_id),
    )
    return {
        "file_id": file_id,
        "source_id": source_id,
        "ai_provider": payload["ai_provider"],
        "ai_model": payload["ai_model"],
        "ai_available": payload["ai_available"],
        "columns_analyzed": payload["columns_analyzed"],
        "results": payload["results"],
        "route_summary": payload["route_summary"],
        "notes": notes + payload["notes"],
    }


@router.post("/mapping/route/{file_id}", response_model=MappingRouteResponse)
def mapping_route(file_id: str, payload: MappingRouteRequest) -> MappingRouteResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")

    details = stub_store.get_file_details(file_id)
    source_id = details["file"]["source_id"]
    kind, columns, rows, _ = parse_file_preview(path)
    if kind != "table":
        return {
            "file_id": file_id,
            "source_id": source_id,
            "auto_count": 0,
            "warning_count": 0,
            "manual_review_count": 0,
            "queued_items_added": 0,
            "notes": ["Routing currently supports table-like files only."],
        }

    conf = score_mapping_confidence(
        source_id=source_id,
        columns=columns,
        rows=rows,
        accepted_targets=stub_store.accepted_target_counts(),
        correction_memory=stub_store.correction_memory_for_source(source_id),
    )
    routed = stub_store.route_confidence_results(
        file_id=file_id,
        source_id=source_id,
        confidence_results=conf["results"],
        include_warnings_in_queue=payload.include_warnings_in_queue,
    )
    return {
        **routed,
        "notes": [
            "Routing applied from confidence results.",
            "Auto items kept out of manual queue; warning/manual items added as pending review.",
        ],
    }


@router.get("/storage/database-move/candidates", response_model=DatabaseMoveCandidatesResponse)
def storage_database_move_candidates(
    auto_move: bool = Query(default=False),
) -> DatabaseMoveCandidatesResponse:
    return _compute_database_move_candidates(auto_move=auto_move)


@router.post("/storage/database-move", response_model=DatabaseMoveResponse)
def storage_database_move(payload: DatabaseMoveRequest) -> DatabaseMoveResponse:
    files = stub_store.list_files().get("files", [])
    by_id = {str(f.get("id")): f for f in files}

    requested_ids: list[str]
    if payload.move_all_ready:
        candidates = _compute_database_move_candidates(auto_move=False).get("candidates", [])
        requested_ids = [c["file_id"] for c in candidates if c.get("ready_for_database_move")]
    else:
        requested_ids = [str(i) for i in payload.file_ids]

    results: list[dict] = []
    moved_count = 0
    failed_count = 0
    first_insert = True

    for file_id in requested_ids:
        file_item = by_id.get(file_id)
        if not file_item:
            failed_count += 1
            results.append({"file_id": file_id, "moved": False, "rows_inserted": 0, "reason": "File not found."})
            continue

        candidate, _ = _build_database_move_candidate(
            file_item, persist=False, clear_table_before_insert=False
        )
        if not candidate["ready_for_database_move"]:
            failed_count += 1
            results.append(
                {
                    "file_id": file_id,
                    "moved": False,
                    "rows_inserted": 0,
                    "reason": candidate["reason"],
                }
            )
            continue

        moved_candidate, persisted = _build_database_move_candidate(
            file_item,
            persist=True,
            clear_table_before_insert=payload.clear_table_before_insert and first_insert,
        )
        first_insert = False
        if persisted:
            moved_count += 1
            results.append(
                {
                    "file_id": file_id,
                    "moved": True,
                    "rows_inserted": int(moved_candidate.get("rows_inserted", 0)),
                    "reason": "Moved to database.",
                }
            )
        else:
            failed_count += 1
            results.append(
                {
                    "file_id": file_id,
                    "moved": False,
                    "rows_inserted": 0,
                    "reason": "Move failed while writing to database.",
                }
            )

    return {
        "requested_file_ids": requested_ids,
        "moved_count": moved_count,
        "failed_move_count": failed_count,
        "results": results,
        "notes": [
            "Only files marked ready are moved.",
            "Use candidates endpoint first for final review in UI.",
        ],
    }


@router.post("/storage/sql-load/{file_id}", response_model=StorageSqlLoadResponse)
def storage_sql_load(file_id: str, payload: StorageSqlLoadRequest) -> StorageSqlLoadResponse:
    path = stub_store.get_file_path(file_id)
    if not path:
        raise HTTPException(status_code=404, detail="File not found")
    return _storage_validation_for_file(
        file_id,
        persist=payload.persist,
        clear_table_before_insert=payload.clear_table_before_insert,
    )


@router.get("/export/normalized/{file_id}", response_model=ExportNormalizedResponse)
def export_normalized_json(file_id: str) -> ExportNormalizedResponse:
    return _build_normalized_export(file_id)


@router.get("/export/normalized/{file_id}/csv", response_class=PlainTextResponse)
def export_normalized_csv(file_id: str) -> PlainTextResponse:
    payload = _build_normalized_export(file_id)
    rows = payload.get("rows", [])
    columns = payload.get("columns", [])
    if not rows or not columns:
        return PlainTextResponse("")
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    return PlainTextResponse(buffer.getvalue())


@router.get("/mapping/alerts", response_model=MappingAlertsResponse)
def mapping_alerts(
    demo_lane: str | None = Query(default=None),
) -> MappingAlertsResponse:
    _, _, alerts_payload = _compute_quality_payloads(demo_lane=demo_lane)
    return alerts_payload


# ---- Quality insights ----
@router.get("/quality/summary", response_model=QualitySummaryResponse)
def quality_summary(
    demo_lane: str | None = Query(default=None),
) -> QualitySummaryResponse:
    summary_payload, _, _ = _compute_quality_payloads(demo_lane=demo_lane)
    return summary_payload


@router.get("/quality/by-source", response_model=QualityBySourceResponse)
def quality_by_source(
    demo_lane: str | None = Query(default=None),
) -> QualityBySourceResponse:
    _, by_source_payload, _ = _compute_quality_payloads(demo_lane=demo_lane)
    return by_source_payload


@router.get("/quality/by-file", response_model=QualityByFileResponse)
def quality_by_file(
    demo_lane: str | None = Query(default=None),
    source_id: str | None = Query(default=None),
) -> QualityByFileResponse:
    return _compute_quality_by_file_payload(demo_lane=demo_lane, source_id=source_id)


# ---- Manual correction queue ----
@router.get("/corrections/queue", response_model=CorrectionsQueueResponse)
def corrections_queue(
    source_id: str | None = Query(default=None),
    demo_lane: str | None = Query(default=None),
) -> CorrectionsQueueResponse:
    # Demo mode: always derive review queue from current mapping output so the
    # screen reflects current lane/source state without requiring persisted queue state.
    live_queue = _build_live_review_queue(demo_lane=demo_lane, source_id=source_id)
    summary = {
        "pending_review": len(live_queue),
        "accepted_today": 0,
        "rejected_today": 0,
    }
    return {"queue": live_queue, "summary": summary}


@router.post(
    "/corrections/{correction_id}/approve",
    response_model=CorrectionActionResponse,
)
def approve_correction(
    correction_id: str, payload: CorrectionActionRequest
) -> CorrectionActionResponse:
    result = stub_store.approve(correction_id, comment=payload.comment)
    if not result:
        raise HTTPException(status_code=404, detail="Correction not found")
    return result


@router.post(
    "/corrections/{correction_id}/reject",
    response_model=CorrectionActionResponse,
)
def reject_correction(
    correction_id: str, payload: CorrectionActionRequest
) -> CorrectionActionResponse:
    result = stub_store.reject(correction_id, comment=payload.comment)
    if not result:
        raise HTTPException(status_code=404, detail="Correction not found")
    return result


@router.patch("/corrections/{correction_id}", response_model=CorrectionActionResponse)
def edit_correction(
    correction_id: str, payload: CorrectionActionRequest
) -> CorrectionActionResponse:
    result = stub_store.edit(
        correction_id,
        target_override=payload.target_override,
        comment=payload.comment,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Correction not found")
    return result


# ---- Mapping rerun control ----
@router.post("/mapping/rerun", response_model=MappingRerunResponse)
def rerun_mapping(payload: MappingRerunRequest) -> MappingRerunResponse:
    if payload.scope == "file" and not payload.file_id:
        raise HTTPException(status_code=400, detail="file_id is required for file scope")
    if payload.scope == "source" and not payload.source_id:
        raise HTTPException(status_code=400, detail="source_id is required for source scope")

    return {
        "job_id": f"job_{uuid4()}",
        "status": "queued",
        "queued_at": datetime.now(timezone.utc),
        "scope": payload.scope,
        "file_id": payload.file_id,
        "source_id": payload.source_id,
    }


# ---- Contract + enum helpers ----
@router.get("/meta/enums", response_model=EnumsResponse)
def get_enums() -> EnumsResponse:
    return {
        "file_status": ["imported", "processing", "failed"],
        "mapping_status": ["mapped", "mapped_with_warnings", "needs_review", "failed"],
        "quality_status": ["clean", "mixed", "unknown"],
        "alert_severity": ["high", "medium", "low"],
        "correction_status": ["pending_review", "accepted", "rejected", "edited"],
    }


@router.get("/meta/runtime-config", response_model=RuntimeConfigResponse)
def get_runtime_config() -> RuntimeConfigResponse:
    return {
        "case_link_window_hours": settings.case_link_window_hours,
        "identity_conflict_high_threshold": settings.identity_conflict_high_threshold,
        "processed_db_path": settings.processed_db_path,
        "ai_enabled": settings.ai_enabled,
        "ai_provider": settings.ai_provider,
        "ai_model": settings.ai_model,
    }


@router.get("/contracts/version", response_model=ContractVersionResponse)
def contract_version() -> ContractVersionResponse:
    return {
        "api_version": "v1",
        "contract_version": "2026-03-19.9",
        "stability": "locked",
        "breaking_change_policy": "No breaking changes in /api/v1; use /api/v2 for contract-breaking updates.",
    }

