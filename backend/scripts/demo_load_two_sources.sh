#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://127.0.0.1:8000/api/v1}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAW_DIR="${ROOT_DIR}/data/raw"
EXPECTED_DIR="${ROOT_DIR}/data/demo_sources/expected_pass"
ERROR_DIR="${ROOT_DIR}/data/demo_sources/error_heavy"

echo "[demo-load] Resetting uploaded demo files..."
curl -sS -X POST "${API_BASE}/demo/reset-uploads" >/dev/null

echo "[demo-load] Clearing raw upload directory..."
mkdir -p "${RAW_DIR}"
rm -f "${RAW_DIR}"/*

upload_dir() {
  local dir="$1"
  local label="$2"
  for f in "${dir}"/*.csv; do
    [ -e "${f}" ] || continue
    echo "[demo-load] Uploading ${label}: $(basename "${f}")"
    curl -sS -X POST "${API_BASE}/ingest/upload" -F "file=@${f}" >/dev/null
  done
}

upload_dir "${EXPECTED_DIR}" "expected-pass"
upload_dir "${ERROR_DIR}" "error-heavy"

echo "[demo-load] Done."
echo "[demo-load] Open frontend and use lane selector:"
echo "            - Overview: error-heavy data"
echo "            - Overview: expected-pass data"
