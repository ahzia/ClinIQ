from copy import deepcopy
from datetime import datetime, timezone

from app.core.fixtures import load_fixture


class StubStore:
    """
    In-memory mutable state for fixture-backed endpoints.
    This keeps frontend interactions realistic (approve/reject/edit)
    without introducing database persistence yet.
    """

    def __init__(self) -> None:
        self._corrections = deepcopy(load_fixture("corrections_queue.json"))

    def get_corrections(self) -> dict:
        return self._corrections

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
