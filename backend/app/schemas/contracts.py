from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    env: str


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    content_type: str | None = None
    size_bytes: int
    stored_path: str


class SourceItem(BaseModel):
    id: str
    label: str
    file_count: int
    formats: list[str]
    notes: str


class SourcesTotals(BaseModel):
    files_seen: int
    csv: int
    xlsx: int
    pdf: int
    docs: int


class SourcesResponse(BaseModel):
    sources: list[SourceItem]
    totals: SourcesTotals


class FileItem(BaseModel):
    id: str
    name: str
    source_id: str
    format: str
    status: Literal["imported", "processing", "failed"]
    mapping_status: Literal["mapped", "mapped_with_warnings", "needs_review", "failed"]
    quality_status: Literal["clean", "mixed", "unknown"]
    rows_estimate: int


class FilesSummary(BaseModel):
    imported_files: int
    successful_mappings: int
    mappings_with_warnings: int
    failed_mappings: int
    needs_review: int


class FilesResponse(BaseModel):
    files: list[FileItem]
    summary: FilesSummary


class FileDetailsMeta(BaseModel):
    id: str
    name: str
    path: str
    format: str
    source_id: str
    imported_at: str
    status: str


class InferenceBlock(BaseModel):
    delimiter: str
    encoding: str
    header_confidence: float
    detected_schema_variant: str


class ConfidenceOverview(BaseModel):
    high: int
    medium: int
    low: int


class MappingBlock(BaseModel):
    status: str
    auto_mapped_fields: int
    needs_review_fields: int
    confidence_overview: ConfidenceOverview


class QualityBlock(BaseModel):
    status: str
    missing_required_keys: int
    anomalies: int
    notes: list[str]


class FileDetailsResponse(BaseModel):
    file: FileDetailsMeta
    inference: InferenceBlock
    mapping: MappingBlock
    quality: QualityBlock


class FilePreviewResponse(BaseModel):
    file_id: str
    kind: str
    columns: list[str]
    rows: list[dict]
    notes: list[str]


class MappingBySourceItem(BaseModel):
    source_id: str
    auto_mapped: int
    needs_review: int
    failed: int


class MappingSummaryCounts(BaseModel):
    total_fields_seen: int
    auto_mapped: int
    mapped_with_warning: int
    needs_review: int
    failed: int


class MappingSummaryResponse(BaseModel):
    summary: MappingSummaryCounts
    by_source: list[MappingBySourceItem]


class MappingAlertItem(BaseModel):
    id: str
    severity: Literal["high", "medium", "low"]
    file_id: str
    source_id: str
    type: str
    message: str
    action: str


class MappingAlertsResponse(BaseModel):
    alerts: list[MappingAlertItem]


class QualitySummaryBlock(BaseModel):
    overall_quality_score: int
    clean_percent: int
    missing_percent: int
    incorrect_percent: int


class QualityKpiBlock(BaseModel):
    files_with_missing_required_ids: int
    files_with_schema_drift: int
    files_with_value_anomalies: int


class QualitySummaryResponse(BaseModel):
    summary: QualitySummaryBlock
    kpis: QualityKpiBlock


class QualityBySourceItem(BaseModel):
    source_id: str
    clean_percent: int
    missing_percent: int
    incorrect_percent: int


class QualityBySourceResponse(BaseModel):
    items: list[QualityBySourceItem]


class CorrectionItem(BaseModel):
    id: str
    file_id: str
    source_id: str
    source_field: str
    suggested_target: str
    confidence: float
    status: Literal["pending_review", "accepted", "rejected", "edited"]
    reason: str


class CorrectionsSummary(BaseModel):
    pending_review: int
    accepted_today: int
    rejected_today: int


class CorrectionsQueueResponse(BaseModel):
    queue: list[CorrectionItem]
    summary: CorrectionsSummary


class CorrectionActionRequest(BaseModel):
    comment: str | None = None
    apply_as_rule: bool = False
    target_override: str | None = None


class CorrectionActionResponse(BaseModel):
    id: str
    status: Literal["pending_review", "accepted", "rejected", "edited"]
    updated_at: datetime
    message: str


class MappingRerunRequest(BaseModel):
    scope: Literal["all", "file", "source"] = "all"
    file_id: str | None = None
    source_id: str | None = None


class MappingRerunResponse(BaseModel):
    job_id: str
    status: Literal["queued"]
    queued_at: datetime
    scope: Literal["all", "file", "source"]
    file_id: str | None = None
    source_id: str | None = None


class EnumsResponse(BaseModel):
    file_status: list[str] = Field(default_factory=list)
    mapping_status: list[str] = Field(default_factory=list)
    quality_status: list[str] = Field(default_factory=list)
    alert_severity: list[str] = Field(default_factory=list)
    correction_status: list[str] = Field(default_factory=list)


class ContractVersionResponse(BaseModel):
    api_version: str
    contract_version: str
    stability: Literal["locked"]
    breaking_change_policy: str


class CanonicalEntity(BaseModel):
    id: str
    label: str
    key_fields: list[str]
    fields: list[str]


class CanonicalModelResponse(BaseModel):
    entities: list[CanonicalEntity]
