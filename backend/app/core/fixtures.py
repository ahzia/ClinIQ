import json
from pathlib import Path
from typing import Any


FIXTURES_DIR = Path(__file__).resolve().parents[2] / "configs" / "fixtures"


def load_fixture(name: str) -> Any:
    """
    Load a JSON fixture by filename (e.g. 'sources.json').
    This is intentionally simple: frontend can build against stable API contracts
    while backend logic is implemented incrementally behind the same endpoints.
    """
    path = FIXTURES_DIR / name
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

