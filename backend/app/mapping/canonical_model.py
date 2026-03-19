from __future__ import annotations


def get_canonical_model() -> dict:
    return {
        "entities": [
            {
                "id": "patient",
                "label": "Patient",
                "key_fields": ["patient_id"],
                "fields": ["patient_id", "sex", "age_years", "date_of_birth"],
            },
            {
                "id": "case",
                "label": "Case / Encounter",
                "key_fields": ["case_id", "patient_id"],
                "fields": [
                    "case_id",
                    "patient_id",
                    "ward",
                    "admission_date",
                    "discharge_date",
                    "length_of_stay_days",
                ],
            },
            {
                "id": "assessment",
                "label": "Assessment (epaAC)",
                "key_fields": ["case_id", "assessment_datetime"],
                "fields": ["case_id", "patient_id", "assessment_datetime", "assessment_type", "item_id", "item_value"],
            },
            {
                "id": "labs",
                "label": "Laboratory",
                "key_fields": ["case_id", "specimen_datetime"],
                "fields": [
                    "case_id",
                    "patient_id",
                    "specimen_datetime",
                    "lab_name",
                    "lab_value",
                    "lab_unit",
                    "flag",
                    "ref_low",
                    "ref_high",
                ],
            },
            {
                "id": "medication",
                "label": "Medication",
                "key_fields": ["encounter_id", "order_id", "record_type"],
                "fields": [
                    "patient_id",
                    "encounter_id",
                    "record_type",
                    "medication_code",
                    "medication_name",
                    "route",
                    "dose",
                    "dose_unit",
                    "frequency",
                    "administration_datetime",
                    "administration_status",
                ],
            },
            {
                "id": "device",
                "label": "Device / Motion",
                "key_fields": ["patient_id", "timestamp"],
                "fields": [
                    "patient_id",
                    "device_id",
                    "timestamp",
                    "movement_index_0_100",
                    "micro_movements_count",
                    "fall_event_0_1",
                    "impact_magnitude_g",
                ],
            },
            {
                "id": "nursing",
                "label": "Nursing Report",
                "key_fields": ["case_id", "report_date", "shift"],
                "fields": ["case_id", "patient_id", "ward", "report_date", "shift", "nursing_note_free_text"],
            },
            {
                "id": "diagnosis_procedure",
                "label": "Diagnosis & Procedure",
                "key_fields": ["case_id"],
                "fields": [
                    "case_id",
                    "patient_id",
                    "primary_icd10_code",
                    "primary_icd10_description",
                    "secondary_icd10_codes",
                    "ops_codes",
                    "ops_descriptions",
                ],
            },
        ]
    }
