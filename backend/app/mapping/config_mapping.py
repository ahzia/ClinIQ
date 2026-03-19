from __future__ import annotations

import json
from pathlib import Path


RULES_DIR = Path(__file__).resolve().parents[2] / "configs" / "mapping_rules"


def list_mapping_rule_files() -> list[str]:
    if not RULES_DIR.exists():
        return []
    return sorted(p.name for p in RULES_DIR.glob("*.json"))


def _normalize_key(name: str) -> str:
    return name.strip().lower().replace("-", "_").replace(" ", "_")


def load_mapping_rules(source_id: str) -> dict:
    candidates = [f"{source_id}.json"]

    # Backward-compatible aliases for filenames
    if source_id == "assessments_epaAC":
        candidates.append("assessments_epaac.json")

    for candidate in candidates:
        path = RULES_DIR / candidate
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)

    raise FileNotFoundError(f"No mapping rule file found for source_id={source_id}")


def apply_mapping_rules(rows: list[dict], rules_payload: dict) -> tuple[list[dict], dict]:
    rules = rules_payload.get("rules", [])
    mapping = {_normalize_key(r["source"]): r["target"] for r in rules if "source" in r and "target" in r}

    mapped_rows: list[dict] = []
    mapped_fields = 0
    unmapped_fields = 0

    for row in rows:
        out = {}
        for key, value in row.items():
            n_key = _normalize_key(key)
            target = mapping.get(n_key)
            if target:
                out[target] = value
                mapped_fields += 1
            else:
                out[key] = value
                unmapped_fields += 1
        mapped_rows.append(out)

    stats = {
        "mapped_fields": mapped_fields,
        "unmapped_fields": unmapped_fields,
        "rule_count": len(rules),
    }
    return mapped_rows, stats
