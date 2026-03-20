from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

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
        self._fixture_files_by_id = {item["id"]: item for item in self._files_payload.get("files", [])}
        self._uploads: dict[str, dict] = {}
        self._auto_routes: dict[str, list[dict]] = {}
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

    def accepted_target_counts(self) -> dict[str, int]:
        counts: dict[str, int] = {}
        for item in self._corrections.get("queue", []):
            if item.get("status") in {"accepted", "edited"}:
                target = item.get("suggested_target")
                if target:
                    counts[target] = counts.get(target, 0) + 1
        return counts

    def correction_memory_for_source(self, source_id: str) -> dict[str, str]:
        memory: dict[str, str] = {}
        for item in self._corrections.get("queue", []):
            if item.get("status") in {"accepted", "edited"} and item.get("source_id") == source_id:
                source_field = str(item.get("source_field", "")).strip().lower().replace("-", "_").replace(" ", "_")
                target = item.get("suggested_target")
                if source_field and target:
                    memory[source_field] = target
        return memory

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
        if file_id in self._fixture_files_by_id:
            item = self._fixture_files_by_id[file_id]
            detail["file"]["name"] = item["name"]
            detail["file"]["format"] = item["format"]
            detail["file"]["source_id"] = item["source_id"]
            detail["file"]["status"] = item["status"]
            detail["mapping"]["status"] = item["mapping_status"]
            detail["quality"]["status"] = item["quality_status"]
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
        mapping_status, quality_status = _infer_demo_status(filename)
        self._uploads[file_id] = {
            "id": file_id,
            "name": filename,
            "source_id": source_id,
            "format": suffix.replace(".", ""),
            "status": "imported",
            "mapping_status": mapping_status,
            "quality_status": quality_status,
            "rows_estimate": 0,
            "path": stored_path,
            "content_type": content_type,
            "size_bytes": size_bytes,
            "imported_at": datetime.now(timezone.utc).isoformat(),
        }

    def clear_uploads(self) -> int:
        removed = len(self._uploads)
        self._uploads = {}
        self._auto_routes = {}
        return removed

    def _find_correction(self, correction_id: str) -> dict | None:
        for item in self._corrections["queue"]:
            if item["id"] == correction_id:
                return item
        return None

    def _remove_generated_queue_items_for_file(self, file_id: str) -> None:
        self._corrections["queue"] = [
            item
            for item in self._corrections["queue"]
            if not (item.get("file_id") == file_id and item.get("generated_by") == "routing_engine")
        ]
        self._recompute_summary()

    def route_confidence_results(
        self,
        *,
        file_id: str,
        source_id: str,
        confidence_results: list[dict],
        include_warnings_in_queue: bool = True,
    ) -> dict:
        self._remove_generated_queue_items_for_file(file_id)
        self._auto_routes[file_id] = []

        added_to_queue = 0
        auto_count = 0
        warning_count = 0
        manual_count = 0

        for item in confidence_results:
            route = item.get("route")
            source_field = item.get("source_field")
            target_field = item.get("target_field")
            score = float(item.get("final_score", 0.0))
            reason = item.get("reason", "")

            if route == "auto":
                auto_count += 1
                self._auto_routes[file_id].append(
                    {
                        "source_field": source_field,
                        "target_field": target_field,
                        "score": score,
                        "reason": reason,
                    }
                )
                continue

            if route == "warning":
                warning_count += 1
                if not include_warnings_in_queue:
                    continue

            if route == "manual_review":
                manual_count += 1

            correction_item = {
                "id": f"rt_{uuid4().hex[:10]}",
                "file_id": file_id,
                "source_id": source_id,
                "source_field": source_field,
                "suggested_target": target_field or "unresolved",
                "confidence": round(score, 4),
                "status": "pending_review",
                "reason": reason,
                "generated_by": "routing_engine",
            }
            self._corrections["queue"].append(correction_item)
            added_to_queue += 1

        self._recompute_summary()
        return {
            "file_id": file_id,
            "source_id": source_id,
            "auto_count": auto_count,
            "warning_count": warning_count,
            "manual_review_count": manual_count,
            "queued_items_added": added_to_queue,
        }

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
    if "1hz" in f:
        return "device_motion_1hz"
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


def _infer_demo_status(filename: str) -> tuple[str, str]:
    f = filename.lower()
    if f.startswith("expected__"):
        if "epaac-data-3" in f:
            return "needs_review", "mixed"
        if "labs" in f or "1hz" in f:
            return "mapped_with_warnings", "mixed"
        return "mapped", "clean"
    if f.startswith("error__"):
        if "synth_labs" in f or "device_motion" in f:
            return "failed", "mixed"
        return "needs_review", "mixed"
    return "needs_review", "unknown"
