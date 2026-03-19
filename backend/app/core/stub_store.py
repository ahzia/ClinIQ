from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path

from app.core.fixtures import load_fixture


class StubStore:
    """
    In-memory mutable state for fixture-backed endpoints.
    This keeps frontend interactions realistic (approve/reject/edit)
    without introducing database persistence yet.
    """

    def __init__(self) -> None:
        self._corrections = deepcopy(load_fixture("corrections_queue.json"))
        self._files_payload = deepcopy(load_fixture("files.json"))
        self._file_details_template = deepcopy(load_fixture("file_details.json"))
        self._uploads: dict[str, dict] = {}
        self._project_root = Path(__file__).resolve().parents[2]
        self._challenge_root = self._project_root / "epaCC-START-Hack-2026"
        self._known_fixture_paths = {
            "f_clean_icd_ops": str(
                self._challenge_root
                / "Endtestdaten_ohne_Fehler_ einheitliche ID"
                / "synthetic_cases_icd10_ops.csv"
            ),
            "f_clean_labs": str(
                self._challenge_root / "Endtestdaten_ohne_Fehler_ einheitliche ID" / "synth_labs_1000_cases.csv"
            ),
            "f_epaac_1": str(
                self._challenge_root / "Endtestdaten_ohne_Fehler_ einheitliche ID" / "epaAC-Data-1.csv"
            ),
            "f_clinic2_device": str(
                self._challenge_root
                / "Endtestdaten_ohne_Fehler_ einheitliche ID"
                / "split_data_pat_case_altered"
                / "split_data_pat_case_altered"
                / "clinic_2_device.csv"
            ),
            "f_clinic3_header_broken": str(
                self._challenge_root
                / "Endtestdaten_ohne_Fehler_ einheitliche ID"
                / "split_data_pat_case_altered"
                / "split_data_pat_case_altered"
                / "clinic_3_labs.csv"
            ),
            "f_pdf_nursing": str(
                self._challenge_root
                / "Endtestdaten_ohne_Fehler_ einheitliche ID"
                / "split_data_pat_case_altered"
                / "split_data_pat_case_altered"
                / "clinic_4_nursing.pdf"
            ),
        }

    def get_corrections(self) -> dict:
        return self._corrections

    def list_files(self) -> dict:
        payload = deepcopy(self._files_payload)
        payload["files"].extend(self._uploads.values())
        payload["summary"]["imported_files"] = len(payload["files"])
        return payload

    def get_file_details(self, file_id: str) -> dict:
        if file_id in self._uploads:
            upload = self._uploads[file_id]
            detail = {
                "file": {
                    "id": upload["id"],
                    "name": upload["name"],
                    "path": upload["path"],
                    "format": upload["format"],
                    "source_id": upload["source_id"],
                    "imported_at": upload["imported_at"],
                    "status": upload["status"],
                },
                "inference": {
                    "delimiter": upload.get("delimiter", "unknown"),
                    "encoding": upload.get("encoding", "unknown"),
                    "header_confidence": 0.75,
                    "detected_schema_variant": "uploaded",
                },
                "mapping": {
                    "status": upload["mapping_status"],
                    "auto_mapped_fields": 0,
                    "needs_review_fields": 0,
                    "confidence_overview": {"high": 0, "medium": 0, "low": 0},
                },
                "quality": {"status": upload["quality_status"], "missing_required_keys": 0, "anomalies": 0, "notes": []},
            }
            return detail

        detail = deepcopy(self._file_details_template)
        detail["file"]["id"] = file_id
        if file_id in self._known_fixture_paths:
            detail["file"]["path"] = self._known_fixture_paths[file_id]
        return detail

    def get_file_path(self, file_id: str) -> str | None:
        if file_id in self._uploads:
            return self._uploads[file_id]["path"]
        return self._known_fixture_paths.get(file_id)

    def register_upload(
        self,
        *,
        file_id: str,
        filename: str,
        stored_path: str,
        content_type: str | None,
        size_bytes: int,
    ) -> None:
        suffix = Path(filename).suffix.lower()
        source_id = _infer_source_id(filename)
        self._uploads[file_id] = {
            "id": file_id,
            "name": filename,
            "source_id": source_id,
            "format": suffix.replace(".", ""),
            "status": "imported",
            "mapping_status": "needs_review",
            "quality_status": "unknown",
            "rows_estimate": 0,
            "path": stored_path,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }

    def _find_correction(self, correction_id: str) -> dict | None:
        for item in self._corrections["queue"]:
            if item["id"] == correction_id:
                return item
        return None

    def _recompute_summary(self) -> None:
        queue = self._corrections["queue"]
        pending = sum(1 for item in queue if item["status"] == "pending_review")
        accepted = sum(1 for item in queue if item["status"] == "accepted")
        rejected = sum(1 for item in queue if item["status"] == "rejected")
        self._corrections["summary"]["pending_review"] = pending
        self._corrections["summary"]["accepted_today"] = accepted
        self._corrections["summary"]["rejected_today"] = rejected

    def approve(self, correction_id: str, comment: str | None = None) -> dict | None:
        item = self._find_correction(correction_id)
        if not item:
            return None
        item["status"] = "accepted"
        if comment:
            item["reason"] = f'{item["reason"]} | reviewer_note: {comment}'
        self._recompute_summary()
        return {
            "id": correction_id,
            "status": "accepted",
            "updated_at": datetime.now(timezone.utc),
            "message": "Correction approved.",
        }

    def reject(self, correction_id: str, comment: str | None = None) -> dict | None:
        item = self._find_correction(correction_id)
        if not item:
            return None
        item["status"] = "rejected"
        if comment:
            item["reason"] = f'{item["reason"]} | reviewer_note: {comment}'
        self._recompute_summary()
        return {
            "id": correction_id,
            "status": "rejected",
            "updated_at": datetime.now(timezone.utc),
            "message": "Correction rejected.",
        }

    def edit(
        self, correction_id: str, target_override: str | None = None, comment: str | None = None
    ) -> dict | None:
        item = self._find_correction(correction_id)
        if not item:
            return None
        if target_override:
            item["suggested_target"] = target_override
        if comment:
            item["reason"] = f'{item["reason"]} | reviewer_note: {comment}'
        item["status"] = "edited"
        self._recompute_summary()
        return {
            "id": correction_id,
            "status": "edited",
            "updated_at": datetime.now(timezone.utc),
            "message": "Correction updated.",
        }


stub_store = StubStore()


def _infer_source_id(filename: str) -> str:
    f = filename.lower()
    if "nursing" in f:
        return "nursing_reports"
    if "medication" in f:
        return "medication"
    if "lab" in f:
        return "labs"
    if "device" in f or "motion" in f:
        return "device_motion"
    if "icd" in f or "ops" in f:
        return "diagnoses_icd_ops"
    if "epa" in f:
        return "assessments_epaAC"
    return "assessments_epaAC"
