"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, ShieldCheck } from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet, apiPost } from "@/lib/api";

type MoveIssue = {
  severity: "high" | "medium" | "low";
  code: string;
  message: string;
};

type MoveCandidate = {
  file_id: string;
  file_name: string;
  source_id: string;
  quality_status: string;
  mapping_status: string;
  rows_attempted: number;
  rows_inserted: number;
  schema_conformance_percent: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
  ready_for_database_move: boolean;
  reason: string;
  target_table: string | null;
  issues: MoveIssue[];
};

type MoveCandidatesResponse = {
  total_files_checked: number;
  ready_count: number;
  review_needed_count: number;
  moved_count: number;
  failed_move_count: number;
  auto_move_enabled: boolean;
  candidates: MoveCandidate[];
  notes: string[];
};

type MoveResultItem = {
  file_id: string;
  moved: boolean;
  rows_inserted: number;
  reason: string;
};

type MoveResponse = {
  requested_file_ids: string[];
  moved_count: number;
  failed_move_count: number;
  results: MoveResultItem[];
  notes: string[];
};

export default function DatabaseMovePanel({
  selectedSourceId,
  selectedDemoLane,
}: {
  selectedSourceId: string | null;
  selectedDemoLane: "all" | "error_heavy" | "expected_pass";
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoMove, setAutoMove] = useState(false);
  const [candidates, setCandidates] = useState<MoveCandidatesResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [moveLoading, setMoveLoading] = useState(false);
  const [lastMove, setLastMove] = useState<MoveResponse | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<MoveCandidatesResponse>(
        `/storage/database-move/candidates?auto_move=${autoMove ? "true" : "false"}`
      );
      setCandidates(res);
      setSelected({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load database-move candidates.");
      setCandidates(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMove]);

  const filteredCandidates = useMemo(() => {
    const all = candidates?.candidates ?? [];
    const lanePrefix =
      selectedDemoLane === "all"
        ? null
        : selectedDemoLane === "error_heavy"
        ? "error__"
        : "expected__";
    return all.filter((c) => {
      if (selectedSourceId && c.source_id !== selectedSourceId) return false;
      if (lanePrefix && !c.file_name.toLowerCase().startsWith(lanePrefix)) return false;
      return true;
    });
  }, [candidates, selectedSourceId, selectedDemoLane]);

  const selectedIds = useMemo(
    () =>
      filteredCandidates
        .filter((c) => c.ready_for_database_move && selected[c.file_id])
        .map((c) => c.file_id),
    [filteredCandidates, selected]
  );

  async function moveSelected() {
    if (!selectedIds.length) return;
    setMoveLoading(true);
    try {
      const res = await apiPost<MoveResponse, { file_ids: string[]; move_all_ready: boolean }>(
        "/storage/database-move",
        { file_ids: selectedIds, move_all_ready: false }
      );
      setLastMove(res);
      await load();
    } finally {
      setMoveLoading(false);
    }
  }

  async function moveAllReady() {
    setMoveLoading(true);
    try {
      const res = await apiPost<MoveResponse, { file_ids: string[]; move_all_ready: boolean }>(
        "/storage/database-move",
        { file_ids: [], move_all_ready: true }
      );
      setLastMove(res);
      await load();
    } finally {
      setMoveLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-semibold text-zinc-100">Ready for Database Move</div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={autoMove}
            onChange={(e) => setAutoMove(e.target.checked)}
          />
          Auto move when ready
        </label>
      </div>

      <GlassCard className="p-6">
        {loading ? (
          <div className="text-sm text-zinc-400">Loading candidates…</div>
        ) : error ? (
          <div className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-400/20">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-white/5 px-3 py-1 ring-1 ring-white/10">
                Total: {filteredCandidates.length}
              </span>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-200 ring-1 ring-emerald-400/20">
                Ready: {filteredCandidates.filter((c) => c.ready_for_database_move).length}
              </span>
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-200 ring-1 ring-amber-400/20">
                Needs review: {filteredCandidates.filter((c) => !c.ready_for_database_move).length}
              </span>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-2xl ring-1 ring-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-3 py-2">Pick</th>
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Rows</th>
                    <th className="px-3 py-2">Conformance</th>
                    <th className="px-3 py-2">Issues</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((c) => (
                    <tr key={c.file_id} className="border-t border-white/10">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!c.ready_for_database_move}
                          checked={!!selected[c.file_id]}
                          onChange={(e) =>
                            setSelected((prev) => ({ ...prev, [c.file_id]: e.target.checked }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">{c.file_name}</td>
                      <td className="px-3 py-2">{c.source_id}</td>
                      <td className="px-3 py-2">{c.rows_attempted}</td>
                      <td className="px-3 py-2">{c.schema_conformance_percent}%</td>
                      <td className="px-3 py-2">
                        H:{c.high_issues} M:{c.medium_issues} L:{c.low_issues}
                      </td>
                      <td className="px-3 py-2">
                        {c.ready_for_database_move ? (
                          <span className="inline-flex items-center gap-1 text-emerald-200">
                            <ShieldCheck className="h-4 w-4" /> Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-200">
                            <Database className="h-4 w-4" /> Needs review
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-300">{c.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={moveLoading || selectedIds.length === 0}
                onClick={moveSelected}
                className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold ring-1 ring-white/20 disabled:opacity-50"
              >
                Move selected
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                disabled={moveLoading}
                onClick={moveAllReady}
                className="rounded-2xl bg-gradient-to-r from-cyan-500/80 to-indigo-500/80 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              >
                Move all ready
              </motion.button>
            </div>

            {lastMove ? (
              <div className="rounded-2xl bg-white/5 p-3 text-sm text-zinc-200 ring-1 ring-white/10">
                Last move: moved {lastMove.moved_count}, failed {lastMove.failed_move_count}
              </div>
            ) : null}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

