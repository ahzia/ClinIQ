#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

db_path = Path("data/processed/harmonized.sqlite")
if db_path.exists():
    db_path.unlink()
    print(f"Removed existing DB: {db_path}")

client = TestClient(app)
seed_files = [
    "f_clean_icd_ops",
    "f_clean_labs",
    "f_epaac_1",
    "f_clinic2_device",
]

for idx, file_id in enumerate(seed_files):
    payload = {"persist": True, "clear_table_before_insert": idx == 0}
    res = client.post(f"/api/v1/storage/sql-load/{file_id}", json=payload)
    print(f"seed {file_id} -> {res.status_code}")
    if res.status_code >= 400:
        print(res.text)
        raise SystemExit(1)
    body = res.json()
    print(
        "  rows_inserted=", body.get("rows_inserted"),
        " schema_conformance_percent=", body.get("schema_conformance_percent"),
        " issues=", len(body.get("issues", [])),
    )

print("Demo seed/reset complete.")
PY

