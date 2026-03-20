from __future__ import annotations

import csv
from pathlib import Path

import pandas as pd
import pdfplumber


CSV_CANDIDATE_ENCODINGS = ("utf-8", "utf-8-sig", "cp1252", "latin-1")


def _to_records(df: pd.DataFrame, limit: int = 20) -> list[dict]:
    preview_df = df.head(limit).copy()
    preview_df = preview_df.where(pd.notnull(preview_df), None)
    return preview_df.to_dict(orient="records")


def _parse_csv(path: Path) -> tuple[list[str], list[dict], list[str]]:
    raw = path.read_bytes()
    decoded = None
    used_encoding = None
    for enc in CSV_CANDIDATE_ENCODINGS:
        try:
            decoded = raw.decode(enc)
            used_encoding = enc
            break
        except UnicodeDecodeError:
            continue

    if decoded is None:
        raise ValueError("Could not decode CSV with supported encodings")

    sample = decoded[:10000]
    notes: list[str] = []
    delimiter = ","
    first_data_line = ""
    for line in decoded.splitlines():
        if line.strip():
            first_data_line = line
            break
    if first_data_line:
        candidates = [",", ";", "|", "\t"]
        counts = {d: first_data_line.count(d) for d in candidates}
        best = max(counts, key=counts.get)
        if counts[best] > 0:
            delimiter = best
        else:
            try:
                dialect = csv.Sniffer().sniff(sample, delimiters=",;|\t")
                delimiter = dialect.delimiter
            except csv.Error:
                notes.append("Delimiter sniffing failed; defaulted to comma.")
    else:
        notes.append("Empty CSV content; defaulted delimiter to comma.")

    df = pd.read_csv(path, encoding=used_encoding, sep=delimiter, nrows=200)
    columns = [str(c) for c in df.columns]
    rows = _to_records(df, limit=20)
    notes.append(f"CSV parsed with encoding={used_encoding}, delimiter='{delimiter}'.")
    return columns, rows, notes


def _parse_xlsx(path: Path) -> tuple[list[str], list[dict], list[str]]:
    df = pd.read_excel(path, nrows=200)
    columns = [str(c) for c in df.columns]
    rows = _to_records(df, limit=20)
    notes = ["XLSX parsed from first sheet."]
    return columns, rows, notes


def _parse_pdf(path: Path) -> tuple[list[str], list[dict], list[str]]:
    lines: list[str] = []
    with pdfplumber.open(path) as pdf:
        for page_idx, page in enumerate(pdf.pages[:3], start=1):
            text = page.extract_text() or ""
            for line in text.splitlines():
                clean = line.strip()
                if clean:
                    lines.append(f"[p{page_idx}] {clean}")

    rows = [{"line_no": i + 1, "text": line} for i, line in enumerate(lines[:40])]
    columns = ["line_no", "text"]
    notes = ["PDF preview shows extracted text lines (first up to 40 lines)."]
    return columns, rows, notes


def _parse_txt(path: Path) -> tuple[list[str], list[dict], list[str]]:
    content = path.read_text(encoding="utf-8", errors="replace").splitlines()
    rows = [{"line_no": i + 1, "text": line} for i, line in enumerate(content[:60])]
    columns = ["line_no", "text"]
    notes = ["TXT preview shows first up to 60 lines."]
    return columns, rows, notes


def parse_file_preview(path: str) -> tuple[str, list[str], list[dict], list[str]]:
    file_path = Path(path)
    suffix = file_path.suffix.lower()

    if suffix == ".csv":
        columns, rows, notes = _parse_csv(file_path)
        return "table", columns, rows, notes
    if suffix == ".xlsx":
        columns, rows, notes = _parse_xlsx(file_path)
        return "table", columns, rows, notes
    if suffix == ".pdf":
        columns, rows, notes = _parse_pdf(file_path)
        return "pdf_text", columns, rows, notes
    if suffix == ".txt":
        columns, rows, notes = _parse_txt(file_path)
        return "text", columns, rows, notes

    return "unknown", ["message"], [{"message": "Unsupported file type for preview"}], [
        "Unsupported preview type."
    ]
