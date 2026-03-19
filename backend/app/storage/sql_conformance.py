from __future__ import annotations

import sqlite3
from functools import lru_cache
from pathlib import Path


SOURCE_TO_TABLE = {
    "device_motion": "tbImportDeviceMotionData",
    "labs": "tbImportLabsData",
    "medication": "tbImportMedicationInpatientData",
    "nursing_reports": "tbImportNursingDailyReportsData",
    "diagnoses_icd_ops": "tbImportIcd10Data",
    "assessments_epaAC": "tbImportAcData",
}

TARGET_TO_SQL_COLUMN = {
    "device_motion": {
        "case_id": "coCaseId",
        "patient_id": "coPatient_id",
        "device_id": "coDevice_id",
        "timestamp": "coTimestamp",
        "movement_index_0_100": "coMovement_index_0_100",
        "micro_movements_count": "coMicro_movements_count",
        "fall_event_0_1": "coFall_event_0_1",
        "impact_magnitude_g": "coImpact_magnitude_g",
    },
    "labs": {
        "case_id": "coCaseId",
        "patient_id": "coPatientId",
        "specimen_datetime": "coSpecimen_datetime",
        "ward": "coWard",
    },
    "medication": {
        "case_id": "coCaseId",
        "patient_id": "coPatient_id",
        "record_type": "coRecord_type",
        "encounter_id": "coEncounter_id",
        "medication_code": "coMedication_code_atc",
        "medication_name": "coMedication_name",
        "route": "coRoute",
        "dose": "coDose",
        "dose_unit": "coDose_unit",
        "frequency": "coFrequency",
        "administration_datetime": "administration_datetime",
        "administration_status": "administration_status",
        "ward": "coWard",
    },
    "nursing_reports": {
        "case_id": "coCaseId",
        "patient_id": "coPatient_id",
        "ward": "coWard",
        "report_date": "coReport_date",
        "shift": "coShift",
        "nursing_note_free_text": "coNursing_note_free_text",
    },
    "diagnoses_icd_ops": {
        "case_id": "coCaseId",
        "ward": "coWard",
        "admission_date": "coAdmission_date",
        "discharge_date": "coDischarge_date",
        "primary_icd10_code": "coPrimary_icd10_code",
        "ops_codes": "coOps_codes",
    },
    "assessments_epaAC": {
        "case_id": "coCaseId",
        "patient_id": "coE2I222",
        "assessment_datetime": "coE2I225",
    },
}


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _schema_path() -> Path:
    return _project_root() / "epaCC-START-Hack-2026" / "DB" / "CreateImportTables.sql"


@lru_cache(maxsize=1)
def parse_sql_schema_tables() -> dict[str, list[str]]:
    lines = _schema_path().read_text(encoding="utf-8", errors="replace").splitlines()
    tables: dict[str, list[str]] = {}
    active_table: str | None = None
    active_columns: list[str] = []

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        lower = line.lower()

        if lower.startswith("create table "):
            if active_table and active_columns:
                tables[active_table] = active_columns
            active_table = line.split()[2]
            active_columns = []
            continue

        if active_table:
            if line.startswith(")"):
                tables[active_table] = active_columns
                active_table = None
                active_columns = []
                continue
            if lower.startswith("constraint "):
                continue
            token = line.split()[0].rstrip(",")
            if token:
                active_columns.append(token)

    if active_table and active_columns:
        tables[active_table] = active_columns
    return tables


def _sqlite_db_path(processed_db_path: str) -> Path:
    p = Path(processed_db_path)
    if not p.is_absolute():
        p = _project_root() / p
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def _ensure_sqlite_table(conn: sqlite3.Connection, table: str, columns: list[str]) -> None:
    cols_sql = ", ".join([f'"{c}" TEXT' for c in columns])
    conn.execute(f'CREATE TABLE IF NOT EXISTS "{table}" ({cols_sql})')


def validate_and_persist_auto_mapped_rows(
    *,
    file_id: str,
    source_id: str,
    rows: list[dict],
    confidence_results: list[dict],
    processed_db_path: str,
    clear_table_before_insert: bool = False,
    persist: bool = True,
) -> dict:
    issues: list[dict] = []
    target_table = SOURCE_TO_TABLE.get(source_id)
    if not target_table:
        return {
            "file_id": file_id,
            "source_id": source_id,
            "target_table": None,
            "auto_fields_seen": 0,
            "auto_fields_sql_mapped": 0,
            "schema_conformance_percent": 0,
            "rows_attempted": 0,
            "rows_inserted": 0,
            "rows_failed": 0,
            "db_path": None,
            "persisted": False,
            "issues": [{"severity": "high", "code": "no_source_table", "message": f"No SQL table mapping for source_id={source_id}."}],
            "notes": ["Add source-to-table mapping before persistence validation."],
        }

    schema_tables = parse_sql_schema_tables()
    schema_columns = schema_tables.get(target_table, [])
    if not schema_columns:
        return {
            "file_id": file_id,
            "source_id": source_id,
            "target_table": target_table,
            "auto_fields_seen": 0,
            "auto_fields_sql_mapped": 0,
            "schema_conformance_percent": 0,
            "rows_attempted": 0,
            "rows_inserted": 0,
            "rows_failed": 0,
            "db_path": None,
            "persisted": False,
            "issues": [{"severity": "high", "code": "schema_table_missing", "message": f"Table {target_table} not found in CreateImportTables.sql"}],
            "notes": ["Check schema parser and source table selection."],
        }

    mapper = TARGET_TO_SQL_COLUMN.get(source_id, {})
    auto_items = [i for i in confidence_results if i.get("route") == "auto" and i.get("target_field")]
    auto_fields_seen = len(auto_items)

    sql_column_by_source: dict[str, str] = {}
    for item in auto_items:
        source_field = item.get("source_field")
        target_field = item.get("target_field")
        sql_col = mapper.get(target_field)
        if not sql_col:
            issues.append(
                {
                    "severity": "medium",
                    "code": "target_not_mapped_to_sql_column",
                    "message": f"Auto target '{target_field}' has no SQL-column mapping for source {source_id}.",
                }
            )
            continue
        if sql_col not in schema_columns:
            issues.append(
                {
                    "severity": "high",
                    "code": "sql_column_not_in_schema",
                    "message": f"Mapped SQL column '{sql_col}' not present in table {target_table}.",
                }
            )
            continue
        sql_column_by_source[str(source_field)] = sql_col

    auto_fields_sql_mapped = len(sql_column_by_source)
    conformance = round((auto_fields_sql_mapped / max(1, auto_fields_seen)) * 100)

    prepared_rows: list[dict] = []
    for row in rows:
        out: dict[str, str] = {}
        for source_field, sql_col in sql_column_by_source.items():
            if source_field in row:
                value = row.get(source_field)
                out[sql_col] = "" if value is None else str(value)
        if out:
            prepared_rows.append(out)

    rows_attempted = len(prepared_rows)
    rows_inserted = 0
    rows_failed = 0
    db_path = None

    if persist and prepared_rows:
        sqlite_path = _sqlite_db_path(processed_db_path)
        db_path = str(sqlite_path)
        conn = sqlite3.connect(sqlite_path)
        try:
            _ensure_sqlite_table(conn, target_table, schema_columns)
            if clear_table_before_insert:
                conn.execute(f'DELETE FROM "{target_table}"')
            for row in prepared_rows:
                cols = list(row.keys())
                placeholders = ", ".join(["?"] * len(cols))
                quoted_cols = ", ".join([f'"{c}"' for c in cols])
                try:
                    conn.execute(
                        f'INSERT INTO "{target_table}" ({quoted_cols}) VALUES ({placeholders})',
                        [row[c] for c in cols],
                    )
                    rows_inserted += 1
                except Exception:
                    rows_failed += 1
            conn.commit()
        finally:
            conn.close()
    else:
        rows_inserted = rows_attempted if rows_attempted else 0

    notes = [
        f"SQL table selected: {target_table}",
        "Validation currently runs on preview sample rows.",
    ]
    if persist:
        notes.append("Rows were written to sqlite DB using CreateImportTables.sql-derived table columns.")
    else:
        notes.append("Validation-only mode: no DB writes performed.")

    return {
        "file_id": file_id,
        "source_id": source_id,
        "target_table": target_table,
        "auto_fields_seen": auto_fields_seen,
        "auto_fields_sql_mapped": auto_fields_sql_mapped,
        "schema_conformance_percent": conformance,
        "rows_attempted": rows_attempted,
        "rows_inserted": rows_inserted,
        "rows_failed": rows_failed,
        "db_path": db_path,
        "persisted": bool(persist),
        "issues": issues,
        "notes": notes,
    }

