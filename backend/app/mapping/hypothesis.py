from __future__ import annotations

from difflib import SequenceMatcher
import re

from app.mapping.canonical_model import get_canonical_model
from app.mapping.config_mapping import load_mapping_rules


def _norm(s: str) -> str:
    base = re.sub(r"\(.*?\)", "", s).strip().lower()
    base = base.replace("-", "_").replace(" ", "_").replace("/", "_")
    base = re.sub(r"[^a-z0-9_]+", "", base)
    base = re.sub(r"_+", "_", base).strip("_")
    return base


def _ratio(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _canonical_targets() -> list[str]:
    payload = get_canonical_model()
    targets: list[str] = []
    for entity in payload["entities"]:
        targets.extend(entity.get("fields", []))
    # preserve order and uniqueness
    return list(dict.fromkeys(targets))


def _config_alias_map(source_id: str) -> dict[str, str]:
    try:
        rules = load_mapping_rules(source_id).get("rules", [])
    except FileNotFoundError:
        return {}
    return {_norm(rule["source"]): rule["target"] for rule in rules if "source" in rule and "target" in rule}


def _candidate_scores(
    source_col: str,
    targets: list[str],
    alias_map: dict[str, str],
    memory_map: dict[str, str] | None = None,
) -> list[dict]:
    source_norm = _norm(source_col)
    candidates: list[dict] = []

    # Strong prior: learned correction memory exact match
    if memory_map and source_norm in memory_map:
        candidates.append(
            {
                "target_field": memory_map[source_norm],
                "score": 0.995,
                "reason": "Exact source-column match in accepted correction memory.",
                "signal": "correction_memory",
            }
        )

    # Strong prior: configured alias exact match
    if source_norm in alias_map:
        target = alias_map[source_norm]
        candidates.append(
            {
                "target_field": target,
                "score": 0.98,
                "reason": "Exact source-column match in mapping config.",
                "signal": "config_exact",
            }
        )

    # Fuzzy semantic-ish match on canonical field names
    for target in targets:
        target_norm = _norm(target)
        score = _ratio(source_norm, target_norm)

        # tiny boosts for token containment
        if source_norm in target_norm or target_norm in source_norm:
            score += 0.08
        if source_norm.startswith("id") and "patient_id" == target_norm:
            score += 0.05

        score = min(score, 0.95)
        if score >= 0.45:
            candidates.append(
                {
                    "target_field": target,
                    "score": round(score, 4),
                    "reason": "Fuzzy lexical similarity against canonical fields.",
                    "signal": "fuzzy",
                }
            )

    # deduplicate by target keeping highest score
    best_by_target: dict[str, dict] = {}
    for c in candidates:
        tgt = c["target_field"]
        if tgt not in best_by_target or c["score"] > best_by_target[tgt]["score"]:
            best_by_target[tgt] = c

    ranked = sorted(best_by_target.values(), key=lambda x: x["score"], reverse=True)
    return ranked[:5]


def generate_column_hypotheses(
    source_id: str, columns: list[str], correction_memory: dict[str, str] | None = None
) -> dict:
    targets = _canonical_targets()
    alias_map = _config_alias_map(source_id)

    results = []
    for col in columns:
        cands = _candidate_scores(col, targets, alias_map, memory_map=correction_memory)
        results.append(
            {
                "source_field": col,
                "candidates": cands,
            }
        )

    return {
        "source_id": source_id,
        "target_catalog_size": len(targets),
        "columns_analyzed": len(columns),
        "results": results,
        "notes": [
            "Hypotheses generated using config aliases + lexical similarity.",
            "Use with confidence/routing logic in next step.",
        ],
    }
