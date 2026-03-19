from __future__ import annotations

import re
from datetime import datetime


NULL_TOKENS = {
    "",
    "null",
    "n/a",
    "na",
    "nan",
    "missing",
    "unknow",
    "unknown",
    "none",
}

CASE_ID_ALIASES = {
    "case_id",
    "caseid",
    "fallid",
    "fallnr",
    "id_cas",
    "cas",
    "case",
}

PATIENT_ID_ALIASES = {
    "patient_id",
    "patientid",
    "pid",
    "pat_id",
    "id_pat",
    "pat",
    "patient",
    "id",
}

DATE_HINTS = (
    "date",
    "datetime",
    "timestamp",
    "zeit",
    "dat",
    "admission",
    "discharge",
    "report",
    "specimen",
    "aufn",
    "entlass",
    "einsch",
)

DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%d.%m.%Y",
    "%d.%m.%Y %H:%M",
    "%d.%m.%Y %H:%M:%S",
    "%d/%m/%Y",
    "%d/%m/%Y %H:%M:%S",
    "%m/%d/%Y",
    "%m/%d/%Y %H:%M:%S",
)


def _clean_token(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def normalize_null(value: object) -> object:
    s = _clean_token(value)
    if s.lower() in NULL_TOKENS:
        return None
    return value


def normalize_case_id(value: object) -> str | None:
    value = normalize_null(value)
    if value is None:
        return None
    s = _clean_token(value)
    digits = "".join(re.findall(r"\d+", s))
    if not digits:
        return s.upper() or None
    return f"CASE-{digits.zfill(4)}"


def normalize_patient_id(value: object) -> str | None:
    value = normalize_null(value)
    if value is None:
        return None
    s = _clean_token(value)
    digits = "".join(re.findall(r"\d+", s))
    if not digits:
        return s.upper() or None
    return f"PAT-{digits.zfill(4)}"


def normalize_datetime_value(value: object) -> str | None:
    value = normalize_null(value)
    if value is None:
        return None
    s = _clean_token(value)
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(s, fmt)
            if dt.time().hour == 0 and dt.time().minute == 0 and dt.time().second == 0 and " " not in s:
                return dt.strftime("%Y-%m-%d")
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue
    return s


def _norm_col(col: str) -> str:
    return col.strip().lower().replace("-", "_").replace(" ", "_")


def detect_key_columns(columns: list[str]) -> tuple[str | None, str | None]:
    case_col = None
    patient_col = None

    for col in columns:
        n = _norm_col(col)
        if case_col is None and n in CASE_ID_ALIASES:
            case_col = col
        if patient_col is None and n in PATIENT_ID_ALIASES:
            patient_col = col

    return case_col, patient_col


def _is_date_like_column(column_name: str) -> bool:
    n = _norm_col(column_name)
    return any(h in n for h in DATE_HINTS)


def normalize_rows(rows: list[dict], columns: list[str]) -> tuple[list[dict], dict]:
    case_col, patient_col = detect_key_columns(columns)

    stats = {
        "rows_processed": len(rows),
        "case_id_normalized": 0,
        "patient_id_normalized": 0,
        "nulls_normalized": 0,
        "datetimes_normalized": 0,
        "case_id_source_column": case_col,
        "patient_id_source_column": patient_col,
    }

    normalized_rows: list[dict] = []
    for row in rows:
        out = {}
        null_count_before = 0
        null_count_after = 0
        for key, val in row.items():
            before = val
            after = normalize_null(before)
            if before is None or _clean_token(before).lower() in NULL_TOKENS:
                null_count_before += 1
            if after is None:
                null_count_after += 1

            if _is_date_like_column(key):
                new_val = normalize_datetime_value(after)
                if new_val != after:
                    stats["datetimes_normalized"] += 1
                out[key] = new_val
            else:
                out[key] = after

        stats["nulls_normalized"] += max(null_count_after - null_count_before, 0)

        out["normalized_case_id"] = normalize_case_id(row.get(case_col)) if case_col else None
        out["normalized_patient_id"] = normalize_patient_id(row.get(patient_col)) if patient_col else None

        if out["normalized_case_id"] is not None:
            stats["case_id_normalized"] += 1
        if out["normalized_patient_id"] is not None:
            stats["patient_id_normalized"] += 1

        normalized_rows.append(out)

    return normalized_rows, stats
