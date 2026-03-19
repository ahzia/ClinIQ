from __future__ import annotations

from typing import Any

from app.mapping.hypothesis import generate_column_hypotheses


EXPECTED_KIND_BY_TARGET: dict[str, str] = {
    "case_id": "id",
    "patient_id": "id",
    "encounter_id": "id",
    "item_id": "id",
    "assessment_datetime": "datetime",
    "specimen_datetime": "datetime",
    "timestamp": "datetime",
    "report_date": "datetime",
    "admission_date": "datetime",
    "discharge_date": "datetime",
    "fall_event_0_1": "binary",
    "is_prn_0_1": "binary",
    "movement_index_0_100": "numeric",
    "micro_movements_count": "numeric",
    "impact_magnitude_g": "numeric",
    "dose": "numeric",
    "lab_value": "numeric",
}


def _looks_numeric(v: Any) -> bool:
    if v is None:
        return False
    try:
        float(str(v).replace(",", "."))
        return True
    except ValueError:
        return False


def _looks_binary(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip().lower()
    return s in {"0", "1", "true", "false"}


def _looks_datetime(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip()
    if len(s) < 8:
        return False
    # lightweight heuristic for common date/time formats
    has_sep = any(sep in s for sep in ["-", ".", "/"])
    has_year = any(str(y) in s for y in ("2024", "2025", "2026"))
    return has_sep and has_year


def _looks_id(v: Any) -> bool:
    if v is None:
        return False
    s = str(v).strip().upper()
    if not s:
        return False
    return any(token in s for token in ("CASE", "PAT", "ENC", "ID")) or s.isdigit()


def _value_pattern_score(values: list[Any], target: str) -> float:
    non_null = [v for v in values if v not in (None, "")]
    if not non_null:
        return 0.2

    expected = EXPECTED_KIND_BY_TARGET.get(target, "text")
    if expected == "numeric":
        matches = sum(1 for v in non_null if _looks_numeric(v))
    elif expected == "binary":
        matches = sum(1 for v in non_null if _looks_binary(v))
    elif expected == "datetime":
        matches = sum(1 for v in non_null if _looks_datetime(v))
    elif expected == "id":
        matches = sum(1 for v in non_null if _looks_id(v))
    else:
        return 0.6

    return round(matches / len(non_null), 4)


def _cross_field_score(source_columns: list[str], target: str) -> float:
    cols = {c.strip().lower().replace("-", "_").replace(" ", "_") for c in source_columns}
    has_case = any(c in cols for c in ("case_id", "caseid", "fallid", "fallnr", "id_cas"))
    has_patient = any(c in cols for c in ("patient_id", "patientid", "pid", "pat_id", "id_pat", "id"))
    has_time = any("date" in c or "time" in c or "timestamp" in c for c in cols)

    if target in {"case_id", "patient_id"} and has_case and has_patient:
        return 0.9
    if target in {"assessment_datetime", "timestamp", "report_date"} and has_time:
        return 0.85
    return 0.55


def _history_score(target: str, accepted_targets: dict[str, int]) -> float:
    count = accepted_targets.get(target, 0)
    if count <= 0:
        return 0.45
    if count == 1:
        return 0.7
    if count == 2:
        return 0.82
    return 0.9


def _route(score: float) -> str:
    if score >= 0.85:
        return "auto"
    if score >= 0.60:
        return "warning"
    return "manual_review"


def score_mapping_confidence(
    *,
    source_id: str,
    columns: list[str],
    rows: list[dict],
    accepted_targets: dict[str, int],
    correction_memory: dict[str, str] | None = None,
) -> dict:
    hyp = generate_column_hypotheses(
        source_id=source_id,
        columns=columns,
        correction_memory=correction_memory,
    )
    col_values: dict[str, list[Any]] = {c: [r.get(c) for r in rows] for c in columns}
    results = []

    for item in hyp["results"]:
        source_field = item["source_field"]
        candidates = item["candidates"]
        if not candidates:
            results.append(
                {
                    "source_field": source_field,
                    "target_field": None,
                    "final_score": 0.0,
                    "route": "manual_review",
                    "signals": {
                        "semantic_name_similarity": 0.0,
                        "value_pattern_match": 0.0,
                        "cross_field_consistency": 0.0,
                        "history_prior": 0.0,
                    },
                    "reason": "No viable target candidate found.",
                }
            )
            continue

        top = candidates[0]
        target = top["target_field"]
        semantic = float(top["score"])
        value_score = _value_pattern_score(col_values.get(source_field, []), target)
        cross_score = _cross_field_score(columns, target)
        history = _history_score(target, accepted_targets)

        final_score = round(
            0.35 * semantic + 0.30 * value_score + 0.20 * cross_score + 0.15 * history,
            4,
        )

        results.append(
            {
                "source_field": source_field,
                "target_field": target,
                "final_score": final_score,
                "route": _route(final_score),
                "signals": {
                    "semantic_name_similarity": round(semantic, 4),
                    "value_pattern_match": round(value_score, 4),
                    "cross_field_consistency": round(cross_score, 4),
                    "history_prior": round(history, 4),
                },
                "reason": f"Top candidate from {top['signal']} with weighted confidence scoring.",
            }
        )

    route_counts = {"auto": 0, "warning": 0, "manual_review": 0}
    for r in results:
        route_counts[r["route"]] += 1

    return {
        "source_id": source_id,
        "columns_analyzed": len(columns),
        "results": results,
        "route_summary": route_counts,
        "notes": [
            "Final score weights: semantic=0.35, value=0.30, cross=0.20, history=0.15.",
            "Thresholds: auto>=0.85, warning>=0.60, else manual_review.",
        ],
    }
