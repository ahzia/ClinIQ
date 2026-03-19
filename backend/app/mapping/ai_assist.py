from __future__ import annotations

from app.core.settings import settings
from app.ai.provider import ai_provider
from app.mapping.canonical_model import get_canonical_model
from app.mapping.confidence import score_mapping_confidence
from app.mapping.hypothesis import generate_column_hypotheses


def _canonical_targets() -> list[str]:
    payload = get_canonical_model()
    targets: list[str] = []
    for entity in payload.get("entities", []):
        targets.extend(entity.get("fields", []))
    return list(dict.fromkeys(targets))


def _dual_route(
    *,
    deterministic_score: float,
    ai_score: float | None,
    conflict: bool,
    final_score: float,
) -> str:
    if ai_score is None:
        if deterministic_score >= 0.85:
            return "auto"
        if deterministic_score >= 0.60:
            return "warning"
        return "manual_review"

    if (
        not conflict
        and deterministic_score >= 0.85
        and ai_score >= 0.75
        and final_score >= 0.85
    ):
        return "auto"
    if final_score >= 0.60 or deterministic_score >= 0.70:
        return "warning"
    return "manual_review"


def run_ai_assisted_mapping(
    *,
    source_id: str,
    columns: list[str],
    rows: list[dict],
    accepted_targets: dict[str, int],
    correction_memory: dict[str, str] | None = None,
) -> dict:
    det = score_mapping_confidence(
        source_id=source_id,
        columns=columns,
        rows=rows,
        accepted_targets=accepted_targets,
        correction_memory=correction_memory,
    )
    hyp = generate_column_hypotheses(
        source_id=source_id,
        columns=columns,
        correction_memory=correction_memory,
    )
    deterministic_hints: dict[str, dict] = {}
    for row in hyp.get("results", []):
        cands = row.get("candidates", [])
        if cands:
            deterministic_hints[row["source_field"]] = cands[0]

    ai_suggestions, ai_notes = ai_provider.suggest_column_mappings(
        source_id=source_id,
        columns=columns,
        sample_rows=rows[:20],
        canonical_targets=_canonical_targets(),
        deterministic_hints=deterministic_hints,
    )
    ai_by_source = {s.source_field: s for s in ai_suggestions}

    results: list[dict] = []
    route_summary = {"auto": 0, "warning": 0, "manual_review": 0}
    ai_available = len(ai_suggestions) > 0

    for item in det.get("results", []):
        source_field = item["source_field"]
        det_target = item.get("target_field")
        det_score = float(item.get("final_score", 0.0))
        ai = ai_by_source.get(source_field)
        ai_target = ai.target_field if ai else None
        ai_score = ai.confidence if ai else None
        conflict = bool(ai_target and det_target and ai_target != det_target)

        if ai_score is None:
            final_target = det_target
            final_score = det_score
            rationale = "AI unavailable; using deterministic confidence baseline."
        else:
            if conflict:
                # Conflict penalty keeps routes conservative.
                final_target = det_target
                final_score = round(max(0.0, 0.6 * det_score + 0.4 * ai_score - 0.20), 4)
                rationale = (
                    "Deterministic and AI targets conflict; applying conservative penalty and review-first routing."
                )
            else:
                final_target = ai_target or det_target
                final_score = round(0.6 * det_score + 0.4 * ai_score, 4)
                rationale = "Deterministic and AI scores combined using dual-score policy."

        route = _dual_route(
            deterministic_score=det_score,
            ai_score=ai_score,
            conflict=conflict,
            final_score=final_score,
        )
        route_summary[route] += 1
        results.append(
            {
                "source_field": source_field,
                "deterministic_target": det_target,
                "deterministic_score": round(det_score, 4),
                "ai_target": ai_target,
                "ai_score": round(ai_score, 4) if ai_score is not None else None,
                "conflict": conflict,
                "final_target": final_target,
                "final_score": round(final_score, 4),
                "route": route,
                "deterministic_reason": item.get("reason", ""),
                "ai_reason": ai.rationale if ai else "No AI suggestion available.",
                "final_reason": rationale,
            }
        )

    notes = [
        "Dual-score policy: deterministic weight=0.6, AI weight=0.4.",
        "Auto route requires both deterministic and AI minimum thresholds without conflict.",
    ]
    notes.extend(ai_notes)
    return {
        "source_id": source_id,
        "ai_provider": "openai-compatible",
        "ai_model": settings.ai_model,
        "ai_available": ai_available,
        "columns_analyzed": len(columns),
        "results": results,
        "route_summary": route_summary,
        "notes": notes,
    }

