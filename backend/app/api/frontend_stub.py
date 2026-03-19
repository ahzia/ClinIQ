from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.core.fixtures import load_fixture
from app.core.stub_store import stub_store
from app.ingest.preview_parser import parse_file_preview
from app.mapping.canonical_model import get_canonical_model
from app.schemas.contracts import (
    CanonicalModelResponse,
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
    QualityBySourceResponse,
    QualitySummaryResponse,
    SourcesResponse,
)

router = APIRouter(tags=["frontend-stub"])


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


@router.get("/mapping/alerts", response_model=MappingAlertsResponse)
def mapping_alerts() -> MappingAlertsResponse:
    return load_fixture("mapping_alerts.json")


# ---- Quality insights ----
@router.get("/quality/summary", response_model=QualitySummaryResponse)
def quality_summary() -> QualitySummaryResponse:
    return load_fixture("quality_summary.json")


@router.get("/quality/by-source", response_model=QualityBySourceResponse)
def quality_by_source() -> QualityBySourceResponse:
    return load_fixture("quality_by_source.json")


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


@router.get("/contracts/version", response_model=ContractVersionResponse)
def contract_version() -> ContractVersionResponse:
    return {
        "api_version": "v1",
        "contract_version": "2026-03-19.1",
        "stability": "locked",
        "breaking_change_policy": "No breaking changes in /api/v1; use /api/v2 for contract-breaking updates.",
    }

