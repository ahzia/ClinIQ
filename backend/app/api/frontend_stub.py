from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.fixtures import load_fixture
from app.core.settings import settings
from app.core.stub_store import stub_store
from app.ingest.preview_parser import parse_file_preview
from app.mapping.canonical_model import get_canonical_model
from app.mapping.ai_assist import run_ai_assisted_mapping
from app.mapping.confidence import score_mapping_confidence
from app.mapping.config_mapping import apply_mapping_rules, list_mapping_rule_files, load_mapping_rules
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
    NormalizePreviewResponse,
    RuntimeConfigResponse,
    StorageSqlLoadRequest,
    StorageSqlLoadResponse,
    QualityBySourceResponse,
    QualitySummaryResponse,
    SourcesResponse,
)
from app.storage.sql_conformance import validate_and_persist_auto_mapped_rows

router = APIRouter(tags=["frontend-stub"])


def _compute_quality_payloads() -> tuple[dict, dict, dict]:
    files_payload = stub_store.list_files()
    by_source: dict[str, list[dict]] = {}
    all_results: list[dict] = []
    alerts: list[dict] = []

    for f in files_payload.get("files", []):
        file_id = f.get("id")
        if not file_id:
            continue
        source_id = f.get("source_id", "unknown")
        path = stub_store.get_file_path(file_id)
        if not path:
            continue
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


# ---- Sources / categories ----
@router.get("/sources", response_model=SourcesResponse)
def list_sources() -> SourcesResponse:
    return load_fixture("sources.json")


# ---- Files / ingestion overview ----
@router.get("/files", response_model=FilesResponse)
def list_files() -> FilesResponse:
    return stub_store.list_files()


@router.get("/files/{file_id}", response_model=FileDetailsResponse)
def get_file(file_id: str) -> FileDetailsResponse:
    return stub_store.get_file_details(file_id)


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
def mapping_summary() -> MappingSummaryResponse:
    return load_fixture("mapping_summary.json")


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


@router.post("/storage/sql-load/{file_id}", response_model=StorageSqlLoadResponse)
def storage_sql_load(file_id: str, payload: StorageSqlLoadRequest) -> StorageSqlLoadResponse:
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
                    "message": "SQL load currently supports table-like files only.",
                }
            ],
            "notes": ["No SQL load attempted for non-table preview kind."],
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
        clear_table_before_insert=payload.clear_table_before_insert,
        persist=payload.persist,
    )
    return result


@router.get("/mapping/alerts", response_model=MappingAlertsResponse)
def mapping_alerts() -> MappingAlertsResponse:
    _, _, alerts_payload = _compute_quality_payloads()
    return alerts_payload


# ---- Quality insights ----
@router.get("/quality/summary", response_model=QualitySummaryResponse)
def quality_summary() -> QualitySummaryResponse:
    summary_payload, _, _ = _compute_quality_payloads()
    return summary_payload


@router.get("/quality/by-source", response_model=QualityBySourceResponse)
def quality_by_source() -> QualityBySourceResponse:
    _, by_source_payload, _ = _compute_quality_payloads()
    return by_source_payload


# ---- Manual correction queue ----
@router.get("/corrections/queue", response_model=CorrectionsQueueResponse)
def corrections_queue() -> CorrectionsQueueResponse:
    return stub_store.get_corrections()


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
        "contract_version": "2026-03-19.5",
        "stability": "locked",
        "breaking_change_policy": "No breaking changes in /api/v1; use /api/v2 for contract-breaking updates.",
    }

