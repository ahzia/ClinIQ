# Upstream Update Report - epaCC Dataset Sync

Date: 2026-03-19  
Source repo: `git@github.com:adriank71/epaCC-START-Hack-2026.git`  
Target folder: `backend/epaCC-START-Hack-2026`

## What Was Done

1. Cloned latest upstream snapshot to a temporary sync folder.
2. Compared local dataset folder against upstream snapshot (excluding `.git` internals).
3. Synced upstream changes into local folder with `rsync` (without deleting local-only files).
4. Kept local folder as normal files (no nested `.git` reintroduced in target folder).

## Change Summary (Before Sync)

- Local files: `61`
- Upstream files: `63`
- Added in upstream: `5`
- Modified in upstream: `1`
- Local-only files: `3`

## Newly Added from Upstream

- `Checkdata-final.zip`
- `Checkdata.zip`
- `IID-SID-ITEM.csv`
- `START Hack 2026_epaCC_fin.pptx`
- `Smart-Health-Data-Mapping.pptx`

## Modified in Upstream

- `Challenge.md` (size changed: local `4707` -> upstream `4634`)

## Local-only Files (Kept)

- `Endtestdaten_ohne_Fehler_ einheitliche ID/Smart-Health-Data-Mapping.txt`
- `START Hack 2026_epaCC_fin.txt`
- `Smart-Health-Data-Mapping.txt`

These remained because sync was non-destructive for local-only files.

## Important Notes

- The original repo connection was used only for update sync via temporary clone.
- Target folder remains suitable for your parent repo commits (no nested Git metadata).
- Since upstream changed `Challenge.md` and added new assets, downstream docs may need refresh:
  - `resources/01_file_inventory.md`
  - `resources/02_data_quality_findings.md`

## Recommended Next Actions

1. Re-run quick inventory to include new files in documentation.
2. Decide whether to keep or remove local-only `.txt` exports.
3. Commit sync changes in your repo with a message like:
   - `sync epaCC dataset with latest upstream snapshot`

