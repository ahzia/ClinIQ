#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
checks = [
    ("GET", "/api/v1/health", None),
    ("GET", "/api/v1/contracts/version", None),
    ("GET", "/api/v1/sources", None),
    ("GET", "/api/v1/files", None),
    ("GET", "/api/v1/mapping/summary", None),
    ("GET", "/api/v1/mapping/ai-assist/f_clinic2_device", None),
    ("GET", "/api/v1/mapping/epaac-coverage/f_epaac_1", None),
    ("GET", "/api/v1/quality/summary", None),
    ("POST", "/api/v1/storage/sql-load/f_clean_labs", {"persist": False}),
    ("GET", "/api/v1/export/normalized/f_clean_labs", None),
]

failed = []
for method, path, body in checks:
    if method == "GET":
        r = client.get(path)
    else:
        r = client.post(path, json=body)
    print(f"{method} {path} -> {r.status_code}")
    if r.status_code >= 400:
        failed.append((method, path, r.status_code))

if failed:
    print("Smoke failed:", failed)
    raise SystemExit(1)

print("Smoke OK")
PY

