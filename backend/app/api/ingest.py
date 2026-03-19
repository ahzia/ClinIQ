from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas.contracts import UploadResponse

router = APIRouter(tags=["ingest"])

ALLOWED_SUFFIXES = {".csv", ".xlsx", ".pdf", ".txt"}
RAW_DATA_DIR = (
    Path(__file__).resolve().parents[2] / "data" / "raw"
)  # Project/code/backend/data/raw


@router.post("/ingest/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)) -> UploadResponse:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid4())
    target_path = RAW_DATA_DIR / f"{file_id}_{file.filename}"

    content = await file.read()
    target_path.write_bytes(content)

    return {
        "file_id": file_id,
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(content),
        "stored_path": str(target_path),
    }
