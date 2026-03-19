from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path


def _dict_path() -> Path:
    return Path(__file__).resolve().parents[2] / "epaCC-START-Hack-2026" / "IID-SID-ITEM.csv"


@lru_cache(maxsize=1)
def load_epaac_dictionary() -> list[dict[str, str]]:
    path = _dict_path()
    if not path.exists():
        return []
    rows: list[dict[str, str]] = []
    with path.open("r", encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            rows.append(
                {
                    "iid": str(row.get("ItmIID", "")).strip(),
                    "sid": str(row.get("ItmSID", "")).strip(),
                    "label_de": str(row.get("ItmName255_DE", "")).strip(),
                    "label_en": str(row.get("ItmName255_EN", "")).strip(),
                }
            )
    return rows


def query_epaac_dictionary(*, iid: str | None = None, sid: str | None = None, limit: int = 50) -> dict:
    items = load_epaac_dictionary()
    iid_q = (iid or "").strip().lower()
    sid_q = (sid or "").strip().lower()
    out: list[dict] = []
    for item in items:
        iid_ok = True
        sid_ok = True
        if iid_q:
            iid_ok = iid_q in item["iid"].lower()
        if sid_q:
            sid_ok = sid_q in item["sid"].lower()
        if iid_ok and sid_ok:
            out.append(item)
        if len(out) >= max(1, limit):
            break
    return {"items": out, "total_loaded": len(items)}


def epaac_coverage(columns: list[str], rows: list[dict]) -> dict:
    items = load_epaac_dictionary()
    if not items:
        return {
            "total_dictionary_items": 0,
            "unique_codes_seen": 0,
            "matched_codes": 0,
            "coverage_percent": 0,
            "examples": [],
        }
    by_iid = {i["iid"].lower(): i for i in items if i["iid"]}
    by_sid = {i["sid"].lower(): i for i in items if i["sid"]}

    seen_codes: set[str] = set()
    for c in columns:
        s = str(c).strip()
        if s:
            seen_codes.add(s)
    for row in rows[:100]:
        for key in ("SID", "ItmSID", "item_id"):
            val = row.get(key)
            if val is not None and str(val).strip():
                seen_codes.add(str(val).strip())

    matched: list[dict] = []
    for code in sorted(seen_codes):
        lookup = code.lower()
        item = by_iid.get(lookup) or by_sid.get(lookup)
        if item:
            matched.append(
                {
                    "code": code,
                    "iid": item["iid"],
                    "sid": item["sid"],
                    "label_en": item["label_en"],
                }
            )

    coverage = round((len(matched) / max(1, len(seen_codes))) * 100)
    return {
        "total_dictionary_items": len(items),
        "unique_codes_seen": len(seen_codes),
        "matched_codes": len(matched),
        "coverage_percent": coverage,
        "examples": matched[:10],
    }

