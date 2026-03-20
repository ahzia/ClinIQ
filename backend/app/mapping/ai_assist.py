from __future__ import annotations

from app.core.settings import settings
from app.ai.provider import ai_provider
from app.mapping.canonical_model import get_canonical_model
from app.mapping.confidence import score_mapping_confidence
from app.mapping.hypothesis import generate_column_hypotheses

AUTO_THRESHOLD = 0.75
WARNING_THRESHOLD = 0.65


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
    # Pattern-first policy: high-confidence deterministic matches are accepted
    # directly and do not require AI.
    if deterministic_score >= AUTO_THRESHOLD:
        return "auto"

    if ai_score is None:
        if deterministic_score >= WARNING_THRESHOLD:
            return "warning"
        return "manual_review"

    if not conflict and final_score >= AUTO_THRESHOLD:
        return "auto"
    if final_score >= WARNING_THRESHOLD or deterministic_score >= WARNING_THRESHOLD:
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

    # Call AI only for unresolved / low-confidence deterministic outcomes.
    ai_candidate_fields: list[str] = [
        item["source_field"]
        for item in det.get("results", [])
        if float(item.get("final_score", 0.0)) < AUTO_THRESHOLD
    ]
    ai_hints_subset = {k: v for k, v in deterministic_hints.items() if k in set(ai_candidate_fields)}

    provider_ok, provider_reason = ai_provider.available()
    ai_notes: list[str] = []
    ai_suggestions = []
    if not ai_candidate_fields:
        ai_notes.append(
            "No AI request needed for this file because all deterministic scores are already >= 0.75."
        )
    elif not provider_ok:
        ai_notes.append(provider_reason)
    else:
        ai_suggestions, provider_notes = ai_provider.suggest_column_mappings(
            source_id=source_id,
            columns=ai_candidate_fields,
            sample_rows=rows[:8],
            canonical_targets=_canonical_targets(),
            deterministic_hints=ai_hints_subset,
        )
        ai_notes.extend(provider_notes)
    ai_by_source = {s.source_field: s for s in ai_suggestions}

    results: list[dict] = []
    route_summary = {"auto": 0, "warning": 0, "manual_review": 0}
    ai_available = provider_ok and (not ai_candidate_fields or len(ai_suggestions) > 0)

    for item in det.get("results", []):
        source_field = item["source_field"]
        det_target = item.get("target_field")
        det_score = float(item.get("final_score", 0.0))
        ai = ai_by_source.get(source_field)
        ai_target = ai.target_field if ai else None
        ai_score = ai.confidence if ai else None
        conflict = bool(ai_target and det_target and ai_target != det_target)
        ai_used = det_score < AUTO_THRESHOLD and ai_score is not None

        if det_score >= AUTO_THRESHOLD:
            final_target = det_target
            final_score = det_score
            rationale = (
                "Pattern-based deterministic score is already high enough for auto route; "
                "AI not required."
            )
        elif ai_score is None:
            final_target = det_target
            final_score = det_score
            rationale = "AI unavailable or not needed for this field; using deterministic baseline."
        else:
            if conflict:
                # Conflict penalty keeps routes conservative.
                final_target = det_target
                final_score = round(max(0.0, 0.45 * det_score + 0.55 * ai_score - 0.20), 4)
                rationale = (
                    "Deterministic and AI targets conflict; applying conservative penalty and review-first routing."
                )
            else:
                final_target = ai_target or det_target
                final_score = round(0.45 * det_score + 0.55 * ai_score, 4)
                rationale = (
                    "AI used as second opinion for non-auto deterministic field; "
                    "combined score may promote warning/manual to auto."
                )

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
                "ai_used": ai_used,
                "final_target": final_target,
                "final_score": round(final_score, 4),
                "route": route,
                "deterministic_reason": item.get("reason", ""),
                "ai_reason": ai.rationale if ai else "No AI suggestion available.",
                "final_reason": rationale,
            }
        )

    notes = [
        "Pattern-first routing: deterministic auto when score >= 0.75.",
        "AI is only requested for fields with deterministic score < 0.75.",
        "Routing thresholds: auto>=0.75, warning>=0.65, else manual_review.",
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

