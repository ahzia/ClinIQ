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


class EpaacDictionaryItem(BaseModel):
    iid: str
    sid: str
    label_de: str
    label_en: str


class EpaacDictionaryResponse(BaseModel):
    items: list[EpaacDictionaryItem]
    total_loaded: int


class EpaacCoverageExample(BaseModel):
    code: str
    iid: str
    sid: str
    label_en: str


class EpaacCoverageResponse(BaseModel):
    file_id: str
    source_id: str
    total_dictionary_items: int
    unique_codes_seen: int
    matched_codes: int
    coverage_percent: int
    examples: list[EpaacCoverageExample]
    notes: list[str]


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


class QualityByFileItem(BaseModel):
    file_id: str
    file_name: str
    source_id: str
    clean_percent: int
    missing_percent: int
    incorrect_percent: int
    parse_status: Literal["ok", "failed"]


class QualityByFileResponse(BaseModel):
    items: list[QualityByFileItem]


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


class RuntimeConfigResponse(BaseModel):
    case_link_window_hours: int
    identity_conflict_high_threshold: int
    processed_db_path: str
    ai_enabled: bool
    ai_provider: str
    ai_model: str


class CanonicalEntity(BaseModel):
    id: str
    label: str
    key_fields: list[str]
    fields: list[str]


class CanonicalModelResponse(BaseModel):
    entities: list[CanonicalEntity]


class NormalizationStatsResponse(BaseModel):
    rows_processed: int
    case_id_normalized: int
    patient_id_normalized: int
    nulls_normalized: int
    datetimes_normalized: int
    case_id_source_column: str | None = None
    patient_id_source_column: str | None = None


class NormalizePreviewResponse(BaseModel):
    file_id: str
    kind: str
    columns: list[str]
    rows: list[dict]
    stats: NormalizationStatsResponse
    notes: list[str]


class MappingRuleItem(BaseModel):
    source: str
    target: str


class MappingRuleResponse(BaseModel):
    source_id: str
    description: str
    rules: list[MappingRuleItem]


class MappingRuleListResponse(BaseModel):
    files: list[str]


class MappedPreviewStats(BaseModel):
    mapped_fields: int
    unmapped_fields: int
    rule_count: int


class MappedPreviewResponse(BaseModel):
    file_id: str
    source_id: str
    kind: str
    rows: list[dict]
    stats: MappedPreviewStats
    notes: list[str]


class HypothesisCandidate(BaseModel):
    target_field: str
    score: float
    reason: str
    signal: str


class ColumnHypothesis(BaseModel):
    source_field: str
    candidates: list[HypothesisCandidate]


class MappingHypothesisResponse(BaseModel):
    file_id: str
    source_id: str
    target_catalog_size: int
    columns_analyzed: int
    results: list[ColumnHypothesis]
    notes: list[str]


class ConfidenceSignals(BaseModel):
    semantic_name_similarity: float
    value_pattern_match: float
    cross_field_consistency: float
    history_prior: float


class ConfidenceItem(BaseModel):
    source_field: str
    target_field: str | None = None
    final_score: float
    route: Literal["auto", "warning", "manual_review"]
    signals: ConfidenceSignals
    reason: str


class RouteSummary(BaseModel):
    auto: int
    warning: int
    manual_review: int


class MappingConfidenceResponse(BaseModel):
    file_id: str
    source_id: str
    columns_analyzed: int
    results: list[ConfidenceItem]
    route_summary: RouteSummary
    notes: list[str]


class MappingRouteRequest(BaseModel):
    include_warnings_in_queue: bool = True


class MappingRouteResponse(BaseModel):
    file_id: str
    source_id: str
    auto_count: int
    warning_count: int
    manual_review_count: int
    queued_items_added: int
    notes: list[str]


class AiAssistItem(BaseModel):
    source_field: str
    deterministic_target: str | None = None
    deterministic_score: float
    ai_target: str | None = None
    ai_score: float | None = None
    conflict: bool
    final_target: str | None = None
    final_score: float
    route: Literal["auto", "warning", "manual_review"]
    deterministic_reason: str
    ai_reason: str
    final_reason: str


class AiAssistResponse(BaseModel):
    file_id: str
    source_id: str
    ai_provider: str
    ai_model: str
    ai_available: bool
    columns_analyzed: int
    results: list[AiAssistItem]
    route_summary: RouteSummary
    notes: list[str]


class StorageSqlLoadRequest(BaseModel):
    persist: bool = True
    clear_table_before_insert: bool = False


class StorageValidationIssue(BaseModel):
    severity: Literal["high", "medium", "low"]
    code: str
    message: str


class StorageSqlLoadResponse(BaseModel):
    file_id: str
    source_id: str
    target_table: str | None = None
    auto_fields_seen: int
    auto_fields_sql_mapped: int
    schema_conformance_percent: int
    rows_attempted: int
    rows_inserted: int
    rows_failed: int
    db_path: str | None = None
    persisted: bool
    issues: list[StorageValidationIssue]
    notes: list[str]


class ExportNormalizedResponse(BaseModel):
    file_id: str
    source_id: str
    kind: str
    rows_count: int
    columns: list[str]
    rows: list[dict]
    notes: list[str]


class DatabaseMoveCandidate(BaseModel):
    file_id: str
    file_name: str
    source_id: str
    quality_status: str
    mapping_status: str
    rows_attempted: int
    rows_inserted: int
    schema_conformance_percent: int
    high_issues: int
    medium_issues: int
    low_issues: int
    ready_for_database_move: bool
    reason: str
    target_table: str | None = None
    issues: list[StorageValidationIssue]


class DatabaseMoveCandidatesResponse(BaseModel):
    total_files_checked: int
    ready_count: int
    review_needed_count: int
    moved_count: int
    failed_move_count: int
    auto_move_enabled: bool
    candidates: list[DatabaseMoveCandidate]
    notes: list[str]


class DatabaseMoveRequest(BaseModel):
    file_ids: list[str] = Field(default_factory=list)
    move_all_ready: bool = False
    clear_table_before_insert: bool = False


class DatabaseMoveResultItem(BaseModel):
    file_id: str
    moved: bool
    rows_inserted: int
    reason: str


class DatabaseMoveResponse(BaseModel):
    requested_file_ids: list[str]
    moved_count: int
    failed_move_count: int
    results: list[DatabaseMoveResultItem]
    notes: list[str]
