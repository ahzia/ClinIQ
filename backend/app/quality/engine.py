from __future__ import annotations

import re
from dataclasses import dataclass

import pandas as pd

NULL_TOKENS = {"", "null", "none", "nan", "n/a", "na", "missing", "unknow", "unknown"}
GENERIC_HEADER_RE = re.compile(r"^(col\d+|unnamed(:\s*\d+)?)$", re.IGNORECASE)
NUMERIC_HEADER_RE = re.compile(r"^\d+([._-]\d+)*$")

CASE_ID_ALIASES = {
    "case_id",
    "fallid",
    "fallnr",
    "encounter_id",
    "enc_id",
    "coe2i222",
}
PATIENT_ID_ALIASES = {
    "patient_id",
    "pid",
    "id_pat",
    "pat_id",
    "co_patient_id",
    "coPatientId",
}
DATETIME_ALIASES = {
    "timestamp",
    "date",
    "report_date",
    "specimen_datetime",
    "admission_datetime",
    "discharge_datetime",
    "admission_date",
    "discharge_date",
    "aufnahme",
    "entlassung",
    "einschätzung",
}
GENDER_ALIASES = {"sex", "gender", "geschlecht"}


def _norm_key(v: str) -> str:
    return v.strip().lower().replace("-", "_").replace(" ", "_")


def _norm_value(v: object) -> str:
    if v is None:
        return ""
    s = str(v).strip()
    if not s:
        return ""
    return s


def _is_missing(v: object) -> bool:
    return _norm_value(v).lower() in NULL_TOKENS


def _find_first_alias(columns: list[str], aliases: set[str]) -> str | None:
    lookup = {_norm_key(c): c for c in columns}
    for a in aliases:
        if a in lookup:
            return lookup[a]
    return None


def _find_datetime_columns(columns: list[str]) -> list[str]:
    out: list[str] = []
    for c in columns:
        n = _norm_key(c)
        if n in DATETIME_ALIASES or "date" in n or "time" in n:
            out.append(c)
    return out


def _find_binary_columns(columns: list[str]) -> list[str]:
    out: list[str] = []
    for c in columns:
        n = _norm_key(c)
        if "_0_1" in n or n.endswith("_0_1") or "fall" in n or "bed_exit" in n:
            out.append(c)
    return out


@dataclass
class FileQualityResult:
    file_id: str
    source_id: str
    clean_percent: int
    missing_percent: int
    incorrect_percent: int
    missing_required_ids: bool
    schema_drift: bool
    value_anomalies: bool
    identity_conflicts: int
    alerts: list[dict]


def evaluate_file_quality(
    *,
    file_id: str,
    source_id: str,
    columns: list[str],
    rows: list[dict],
    case_link_window_hours: int,
    identity_conflict_high_threshold: int,
) -> FileQualityResult:
    alerts: list[dict] = []
    if not rows or not columns:
        return FileQualityResult(
            file_id=file_id,
            source_id=source_id,
            clean_percent=100,
            missing_percent=0,
            incorrect_percent=0,
            missing_required_ids=False,
            schema_drift=False,
            value_anomalies=False,
            identity_conflicts=0,
            alerts=[],
        )

    patient_col = _find_first_alias(columns, PATIENT_ID_ALIASES)
    case_col = _find_first_alias(columns, CASE_ID_ALIASES)
    gender_col = _find_first_alias(columns, GENDER_ALIASES)
    datetime_cols = _find_datetime_columns(columns)
    binary_cols = _find_binary_columns(columns)

    required_cols_present = int(patient_col is not None) + int(case_col is not None)
    missing_required_ids = required_cols_present == 0
    missing_cells = 0
    if required_cols_present == 0:
        missing_ratio = 1.0
    else:
        for row in rows:
            if patient_col and _is_missing(row.get(patient_col)):
                missing_cells += 1
            if case_col and _is_missing(row.get(case_col)):
                missing_cells += 1
        missing_ratio = missing_cells / max(1, len(rows) * required_cols_present)

    if missing_required_ids:
        alerts.append(
            {
                "severity": "high",
                "type": "missing_required_ids",
                "message": "Neither case_id nor patient_id style columns were detected.",
                "action": "Send to manual review and configure source mapping aliases.",
            }
        )

    # schema drift
    generic_headers = 0
    numeric_headers = 0
    for c in columns:
        n = _norm_key(c)
        if GENERIC_HEADER_RE.match(n):
            generic_headers += 1
        if NUMERIC_HEADER_RE.match(n):
            numeric_headers += 1

    generic_ratio = generic_headers / max(1, len(columns))
    numeric_ratio = numeric_headers / max(1, len(columns))
    schema_drift = generic_ratio >= 0.4 or numeric_ratio >= 0.5
    if schema_drift:
        alerts.append(
            {
                "severity": "high" if numeric_ratio >= 0.5 else "medium",
                "type": "schema_drift",
                "message": "Detected generic or data-like headers; source schema appears drifted.",
                "action": "Route to mapping review and apply header recovery/alias config.",
            }
        )

    invalid_binary = 0
    binary_total = 0
    for row in rows:
        for c in binary_cols:
            v = _norm_value(row.get(c))
            if not v:
                continue
            binary_total += 1
            if v.lower() not in {"0", "1", "true", "false"}:
                invalid_binary += 1

    invalid_dates = 0
    date_total = 0
    for row in rows:
        for c in datetime_cols:
            v = _norm_value(row.get(c))
            if not v:
                continue
            date_total += 1
            parsed = pd.to_datetime(v, errors="coerce")
            if pd.isna(parsed):
                invalid_dates += 1

    # duplicate composite keys (patient_id + first datetime-like column)
    duplicate_composite = 0
    if patient_col and datetime_cols:
        seen: set[tuple[str, str]] = set()
        dt_col = datetime_cols[0]
        for row in rows:
            p = _norm_value(row.get(patient_col))
            d = _norm_value(row.get(dt_col))
            if not p or not d:
                continue
            key = (p, d)
            if key in seen:
                duplicate_composite += 1
            seen.add(key)
        if duplicate_composite > 0:
            alerts.append(
                {
                    "severity": "medium",
                    "type": "duplicate_composite_key",
                    "message": f"Detected {duplicate_composite} duplicate patient+datetime composite keys.",
                    "action": "Flag duplicates for review before auto-accepting mapped records.",
                }
            )

    invalid_ratio = (invalid_binary + invalid_dates + duplicate_composite) / max(
        1, binary_total + date_total + len(rows)
    )

    # identity conflicts
    identity_conflicts = 0
    if gender_col and (patient_col or case_col):
        by_key: dict[str, set[str]] = {}
        for row in rows:
            g = _norm_value(row.get(gender_col)).lower()
            if g in {"", "nan", "null"}:
                continue
            key = None
            if case_col:
                c = _norm_value(row.get(case_col))
                if c:
                    key = f"case::{c}"
            if key is None and patient_col:
                p = _norm_value(row.get(patient_col))
                if p:
                    key = f"pat::{p}"
            if key is None:
                continue
            if key not in by_key:
                by_key[key] = set()
            by_key[key].add(g)
        identity_conflicts = sum(1 for values in by_key.values() if len(values) > 1)
        if identity_conflicts:
            alerts.append(
                {
                    "severity": "high" if identity_conflicts >= identity_conflict_high_threshold else "medium",
                    "type": "identity_conflict",
                    "message": f"Found {identity_conflicts} conflicting identity attribute groups.",
                    "action": "Flag for review; keep provenance and avoid auto-merge.",
                }
            )

    # missing case linking advisory
    if case_col is None and patient_col and datetime_cols:
        alerts.append(
            {
                "severity": "medium",
                "type": "case_link_config_required",
                "message": "Case ID is missing; linking falls back to patient_id + datetime heuristic.",
                "action": f"Use configured link window (default {case_link_window_hours}h) and route ambiguous joins to review.",
            }
        )

    value_anomalies = invalid_ratio > 0.0 or identity_conflicts > 0
    if invalid_ratio > 0:
        alerts.append(
            {
                "severity": "medium",
                "type": "value_pattern_anomaly",
                "message": "Detected invalid date/binary value patterns in sampled rows.",
                "action": "Normalize values and route unresolved rows to manual review.",
            }
        )

    missing_percent = round(min(100.0, max(0.0, missing_ratio * 100)))
    incorrect_score = min(100.0, invalid_ratio * 100 + (25 if schema_drift else 0) + (30 if identity_conflicts else 0))
    incorrect_percent = round(incorrect_score)
    clean_percent = max(0, 100 - missing_percent - incorrect_percent)

    return FileQualityResult(
        file_id=file_id,
        source_id=source_id,
        clean_percent=clean_percent,
        missing_percent=missing_percent,
        incorrect_percent=incorrect_percent,
        missing_required_ids=missing_required_ids,
        schema_drift=schema_drift,
        value_anomalies=value_anomalies,
        identity_conflicts=identity_conflicts,
        alerts=alerts,
    )

