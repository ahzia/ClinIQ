"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Database,
  GitBranch,
  LineChart,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet, apiPost } from "@/lib/api";

type RuntimeConfigResponse = {
  case_link_window_hours: number;
  identity_conflict_high_threshold: number;
  processed_db_path: string;
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
};

type FileRow = { id: string; name: string; source_id: string };
type FilesListResponse = { files: FileRow[] };

type HypothesisCandidate = {
  target_field: string;
  score: number;
  reason: string;
  signal: string;
};

type ColumnHypothesis = {
  source_field: string;
  candidates: HypothesisCandidate[];
};

type MappingHypothesisResponse = {
  file_id: string;
  source_id: string;
  target_catalog_size: number;
  columns_analyzed: number;
  results: ColumnHypothesis[];
  notes: string[];
};

type ConfidenceSignals = {
  semantic_name_similarity: number;
  value_pattern_match: number;
  cross_field_consistency: number;
  history_prior: number;
};

type ConfidenceItem = {
  source_field: string;
  target_field: string | null;
  final_score: number;
  route: "auto" | "warning" | "manual_review";
  signals: ConfidenceSignals;
  reason: string;
};

type MappingConfidenceResponse = {
  file_id: string;
  source_id: string;
  columns_analyzed: number;
  results: ConfidenceItem[];
  route_summary: { auto: number; warning: number; manual_review: number };
  notes: string[];
};

type AiAssistItem = {
  source_field: string;
  deterministic_target: string | null;
  deterministic_score: number;
  ai_target: string | null;
  ai_score: number | null;
  conflict: boolean;
  final_target: string | null;
  final_score: number;
  route: "auto" | "warning" | "manual_review";
  deterministic_reason: string;
  ai_reason: string;
  final_reason: string;
};

type AiAssistResponse = {
  file_id: string;
  source_id: string;
  ai_provider: string;
  ai_model: string;
  ai_available: boolean;
  columns_analyzed: number;
  results: AiAssistItem[];
  route_summary: { auto: number; warning: number; manual_review: number };
  notes: string[];
};

type MappingRouteResponse = {
  file_id: string;
  source_id: string;
  auto_count: number;
  warning_count: number;
  manual_review_count: number;
  queued_items_added: number;
  notes: string[];
};

type StorageSqlLoadResponse = {
  file_id: string;
  source_id: string;
  target_table: string | null;
  auto_fields_seen: number;
  auto_fields_sql_mapped: number;
  schema_conformance_percent: number;
  rows_attempted: number;
  rows_inserted: number;
  rows_failed: number;
  db_path: string | null;
  persisted: boolean;
  issues: { severity: string; code: string; message: string }[];
  notes: string[];
};

function MiniPill({ text, tone }: { text: string; tone: "good" | "warn" | "bad" | "neutral" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-200 ring-amber-400/20"
      : tone === "bad"
      ? "bg-rose-500/10 text-rose-200 ring-rose-400/20"
      : "bg-white/5 text-zinc-200 ring-white/10";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${cls}`}>
      {text}
    </span>
  );
}

const DEMO_FILE_IDS = ["f_clinic2_device", "f_epaac_1", "f_clinic3_header_broken"];

export default function MappingIntelligenceSection({
  selectedFileId,
}: {
  selectedFileId: string | null;
}) {
  const [runtime, setRuntime] = useState<RuntimeConfigResponse | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [localFileId, setLocalFileId] = useState<string>("");

  const [intelTab, setIntelTab] = useState<"ai" | "hypotheses" | "confidence" | "sql">("ai");

  const [hypotheses, setHypotheses] = useState<MappingHypothesisResponse | null>(null);
  const [confidence, setConfidence] = useState<MappingConfidenceResponse | null>(null);
  const [aiAssist, setAiAssist] = useState<AiAssistResponse | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  /** Set when only AI-assist fails (e.g. 404 on older API) so hypotheses/confidence still load. */
  const [aiAssistError, setAiAssistError] = useState<string | null>(null);

  const [routeResult, setRouteResult] = useState<MappingRouteResponse | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [includeWarnings, setIncludeWarnings] = useState(true);

  const [sqlResult, setSqlResult] = useState<StorageSqlLoadResponse | null>(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlPersist, setSqlPersist] = useState(true);
  const [sqlClear, setSqlClear] = useState(false);

  const [expandedExplain, setExpandedExplain] = useState<string | null>(null);

  const effectiveFileId = localFileId || selectedFileId || "";

  useEffect(() => {
    let m = true;
    apiGet<RuntimeConfigResponse>("/meta/runtime-config")
      .then((r) => {
        if (m) setRuntime(r);
      })
      .catch(() => {
        if (m) setRuntime(null);
      });
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    let m = true;
    apiGet<FilesListResponse>("/files")
      .then((r) => {
        if (!m) return;
        setFiles(r.files ?? []);
      })
      .catch(() => {
        if (m) setFiles([]);
      });
    return () => {
      m = false;
    };
  }, []);

  useEffect(() => {
    if (selectedFileId) {
      setLocalFileId(selectedFileId);
    }
  }, [selectedFileId]);

  const loadIntelligence = useCallback(async (fileId: string) => {
    if (!fileId) {
      setHypotheses(null);
      setConfidence(null);
      setAiAssist(null);
      setIntelError(null);
      setAiAssistError(null);
      return;
    }
    const enc = encodeURIComponent(fileId);

    async function fetchJson<T>(
      path: string
    ): Promise<{ ok: true; data: T } | { ok: false; message: string; notFound: boolean }> {
      try {
        const data = await apiGet<T>(path);
        return { ok: true, data };
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const notFound = /\b404\b/.test(message);
        return { ok: false, message, notFound };
      }
    }

    setIntelLoading(true);
    setIntelError(null);
    setAiAssistError(null);
    setRouteResult(null);
    setSqlResult(null);
    try {
      const [h, c, a] = await Promise.all([
        fetchJson<MappingHypothesisResponse>(`/mapping/hypotheses/${enc}`),
        fetchJson<MappingConfidenceResponse>(`/mapping/confidence/${enc}`),
        fetchJson<AiAssistResponse>(`/mapping/ai-assist/${enc}`),
      ]);

      setHypotheses(h.ok ? h.data : null);
      setConfidence(c.ok ? c.data : null);
      if (a.ok) {
        setAiAssist(a.data);
        setAiAssistError(null);
      } else {
        setAiAssist(null);
        setAiAssistError(
          a.notFound
            ? "AI-assisted endpoint not found (404). Pull the latest backend and restart the API (GET /api/v1/mapping/ai-assist/{file_id}). Hypotheses and Confidence tabs should still work."
            : a.message
        );
      }

      if (!h.ok && !c.ok) {
        setIntelError(
          `Could not load core mapping data. ${h.message} · ${c.message}`
        );
      } else {
        setIntelError(null);
      }
    } catch (e) {
      setIntelError(e instanceof Error ? e.message : "Failed to load mapping intelligence.");
      setHypotheses(null);
      setConfidence(null);
      setAiAssist(null);
      setAiAssistError(null);
    } finally {
      setIntelLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntelligence(effectiveFileId);
  }, [effectiveFileId, loadIntelligence]);

  async function applyRoute() {
    if (!effectiveFileId) return;
    setRouteLoading(true);
    try {
      const res = await apiPost<MappingRouteResponse, { include_warnings_in_queue: boolean }>(
        `/mapping/route/${encodeURIComponent(effectiveFileId)}`,
        { include_warnings_in_queue: includeWarnings }
      );
      setRouteResult(res);
    } catch (e) {
      setRouteResult(null);
      setIntelError(e instanceof Error ? e.message : "Route action failed.");
    } finally {
      setRouteLoading(false);
    }
  }

  async function runSqlLoad() {
    if (!effectiveFileId) return;
    setSqlLoading(true);
    try {
      const res = await apiPost<
        StorageSqlLoadResponse,
        { persist: boolean; clear_table_before_insert: boolean }
      >(`/storage/sql-load/${encodeURIComponent(effectiveFileId)}`, {
        persist: sqlPersist,
        clear_table_before_insert: sqlClear,
      });
      setSqlResult(res);
    } catch (e) {
      setSqlResult(null);
      setIntelError(e instanceof Error ? e.message : "SQL load failed.");
    } finally {
      setSqlLoading(false);
    }
  }

  function applyDemoPreset(id: string) {
    setLocalFileId(id);
  }

  const routeSummary = confidence?.route_summary ?? aiAssist?.route_summary;

  const tabs = useMemo(
    () =>
      [
        { id: "ai" as const, label: "AI-assisted", icon: Brain },
        { id: "hypotheses" as const, label: "Hypotheses", icon: Sparkles },
        { id: "confidence" as const, label: "Confidence", icon: LineChart },
        { id: "sql" as const, label: "SQL proof", icon: Database },
      ] as const,
    []
  );

  return (
    <GlassCard className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-cyan-200" />
            <div className="text-sm font-semibold text-zinc-100">
              Demo pipeline — mapping intelligence
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-400">
            Live hypotheses, confidence routing, optional LLM-assisted scoring, apply routing to
            the correction queue, and SQL schema conformance — all from the current backend
            contract.
          </div>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => loadIntelligence(effectiveFileId)}
          disabled={!effectiveFileId || intelLoading}
          className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${intelLoading ? "animate-spin" : ""}`} />
          Refresh data
        </motion.button>
      </div>

      {runtime ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <MiniPill
            tone="neutral"
            text={`Link window ${runtime.case_link_window_hours}h`}
          />
          <MiniPill
            tone="neutral"
            text={`Identity threshold ${runtime.identity_conflict_high_threshold}`}
          />
          <MiniPill
            tone={runtime.ai_enabled ? "good" : "warn"}
            text={runtime.ai_enabled ? "LLM path enabled" : "Deterministic baseline"}
          />
          <MiniPill tone="neutral" text="Vendor-neutral scoring" />
        </div>
      ) : (
        <div className="mt-4 text-xs text-zinc-500">Runtime config unavailable.</div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs text-zinc-400">File for pipeline</label>
          <select
            value={localFileId}
            onChange={(e) => setLocalFileId(e.target.value)}
            className="select-premium mt-2 w-full px-4 py-3 text-sm text-zinc-100"
          >
            <option value="">Select a file…</option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} — {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col justify-end gap-2">
          <div className="text-xs text-zinc-400">Demo presets</div>
          <div className="flex flex-wrap gap-2">
            {DEMO_FILE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                disabled={!files.some((f) => f.id === id)}
                onClick={() => applyDemoPreset(id)}
                className="rounded-2xl bg-white/5 px-3 py-2 text-[11px] font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {intelError ? (
        <div className="mt-4 rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-rose-400/20">
          {intelError}
        </div>
      ) : null}

      {routeSummary ? (
        <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-xs font-semibold text-zinc-300">Route summary (from confidence)</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniPill tone="good" text={`Auto ${routeSummary.auto}`} />
            <MiniPill tone="warn" text={`Warning ${routeSummary.warning}`} />
            <MiniPill tone="bad" text={`Manual review ${routeSummary.manual_review}`} />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={includeWarnings}
                onChange={(e) => setIncludeWarnings(e.target.checked)}
              />
              Include warnings in manual queue
            </label>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={applyRoute}
              disabled={!effectiveFileId || routeLoading}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500/70 to-indigo-500/70 px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            >
              <GitBranch className="h-3.5 w-3.5" />
              {routeLoading ? "Applying…" : "Apply routing to queue"}
            </motion.button>
          </div>
          {routeResult ? (
            <div className="mt-3 text-xs text-zinc-300">
              Queued +{routeResult.queued_items_added} · Auto {routeResult.auto_count} · Warning{" "}
              {routeResult.warning_count} · Manual {routeResult.manual_review_count}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = intelTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setIntelTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                active
                  ? "bg-white/10 text-zinc-100 ring-white/20"
                  : "bg-white/5 text-zinc-400 ring-white/10 hover:bg-white/10"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-[200px]">
        {intelLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
              />
            ))}
          </div>
        ) : !effectiveFileId ? (
          <div className="rounded-2xl bg-white/5 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
            Choose a file to load intelligence endpoints.
          </div>
        ) : intelTab === "ai" ? (
          <div className="space-y-4">
            {aiAssistError ? (
              <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-100 ring-1 ring-amber-400/25">
                <div className="font-semibold text-amber-50">AI-assisted tab</div>
                <div className="mt-2 text-xs leading-relaxed text-amber-100/90">{aiAssistError}</div>
                <div className="mt-3 text-[11px] text-amber-200/80">
                  Quick check: open{" "}
                  <code className="rounded bg-black/30 px-1 py-0.5 text-amber-100">
                    http://localhost:8000/api/v1/mapping/ai-assist/{effectiveFileId || "FILE_ID"}
                  </code>{" "}
                  in the browser or curl. If that 404s, the running server is missing this route —
                  restart from the current repo <code className="rounded bg-black/30 px-1">backend/</code>{" "}
                  code. Also confirm{" "}
                  <code className="rounded bg-black/30 px-1">BACKEND_API_BASE_URL</code> in{" "}
                  <code className="rounded bg-black/30 px-1">frontend/.env.local</code> ends with{" "}
                  <code className="rounded bg-black/30 px-1">/api/v1</code>.
                </div>
              </div>
            ) : null}
            {aiAssist ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <MiniPill
                    tone={aiAssist.ai_available ? "good" : "warn"}
                    text={
                      aiAssist.ai_available
                        ? "LLM-assisted layer active"
                        : "LLM unavailable — deterministic baseline"
                    }
                  />
                  <span className="text-xs text-zinc-500">
                    {aiAssist.columns_analyzed} columns analyzed
                  </span>
                </div>
                <div className="max-h-[360px] w-full max-w-full overflow-x-auto overflow-y-auto rounded-2xl ring-1 ring-white/10">
                  <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
                    <thead className="sticky top-0 bg-white/5">
                      <tr>
                        <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                          Source field
                        </th>
                        <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                          Final target
                        </th>
                        <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                          Route
                        </th>
                        <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                          Conflict
                        </th>
                        <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                          Explain
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiAssist.results.map((row) => (
                        <tr key={row.source_field} className="hover:bg-white/5">
                          <td className="border-b border-white/10 px-3 py-2 text-zinc-200 whitespace-nowrap">
                            {row.source_field}
                          </td>
                          <td className="border-b border-white/10 px-3 py-2 text-zinc-300 whitespace-nowrap">
                            {row.final_target ?? "—"}{" "}
                            <span className="text-zinc-500">
                              ({Math.round(row.final_score * 100)}%)
                            </span>
                          </td>
                          <td className="border-b border-white/10 px-3 py-2 whitespace-nowrap">
                            <MiniPill
                              tone={
                                row.route === "auto"
                                  ? "good"
                                  : row.route === "warning"
                                  ? "warn"
                                  : "bad"
                              }
                              text={row.route.replace(/_/g, " ")}
                            />
                          </td>
                          <td className="border-b border-white/10 px-3 py-2 whitespace-nowrap">
                            {row.conflict ? (
                              <span className="text-rose-200">Yes</span>
                            ) : (
                              <span className="text-zinc-500">No</span>
                            )}
                          </td>
                          <td className="border-b border-white/10 px-3 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedExplain((v) =>
                                  v === row.source_field ? null : row.source_field
                                )
                              }
                              className="text-cyan-200 hover:underline"
                            >
                              {expandedExplain === row.source_field ? "Hide" : "Why?"}
                            </button>
                            {expandedExplain === row.source_field ? (
                              <div className="mt-2 max-w-xl space-y-1 text-[11px] text-zinc-400">
                                <div>
                                  <span className="font-semibold text-zinc-300">Deterministic: </span>
                                  {row.deterministic_reason}
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-300">LLM: </span>
                                  {row.ai_reason}
                                </div>
                                <div>
                                  <span className="font-semibold text-zinc-300">Final: </span>
                                  {row.final_reason}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {aiAssist.notes?.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-500">
                    {aiAssist.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : !aiAssistError ? (
              <div className="text-sm text-zinc-400">No AI assist data.</div>
            ) : null}
          </div>
        ) : intelTab === "hypotheses" ? (
          <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
            {hypotheses?.results?.length ? (
              hypotheses.results.map((col) => {
                const top = col.candidates[0];
                return (
                  <div
                    key={col.source_field}
                    className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-zinc-100">{col.source_field}</div>
                      {top ? (
                        <MiniPill tone="good" text={`${top.target_field} · ${top.score.toFixed(2)}`} />
                      ) : null}
                    </div>
                    {top ? (
                      <div className="mt-2 text-xs text-zinc-400">
                        <span className="font-semibold text-zinc-300">Signal:</span> {top.signal} ·{" "}
                        {top.reason}
                      </div>
                    ) : null}
                    {col.candidates.length > 1 ? (
                      <div className="mt-2 text-[11px] text-zinc-500">
                        +{col.candidates.length - 1} alternate candidate(s)
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-zinc-400">No hypotheses for this file.</div>
            )}
          </div>
        ) : intelTab === "confidence" ? (
          <div className="max-h-[380px] w-full max-w-full overflow-x-auto overflow-y-auto rounded-2xl ring-1 ring-white/10">
            <table className="min-w-max border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 bg-white/5">
                <tr>
                  <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                    Field
                  </th>
                  <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                    Target
                  </th>
                  <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                    Score
                  </th>
                  <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200 whitespace-nowrap">
                    Route
                  </th>
                  <th className="border-b border-white/10 px-3 py-2 font-semibold text-zinc-200">
                    Why
                  </th>
                </tr>
              </thead>
              <tbody>
                {(confidence?.results ?? []).map((r) => (
                  <tr key={r.source_field} className="hover:bg-white/5">
                    <td className="border-b border-white/10 px-3 py-2 text-zinc-200 whitespace-nowrap">
                      {r.source_field}
                    </td>
                    <td className="border-b border-white/10 px-3 py-2 text-zinc-300 whitespace-nowrap">
                      {r.target_field ?? "—"}
                    </td>
                    <td className="border-b border-white/10 px-3 py-2 text-zinc-300 whitespace-nowrap">
                      {Math.round(r.final_score * 100)}%
                    </td>
                    <td className="border-b border-white/10 px-3 py-2 whitespace-nowrap">
                      <MiniPill
                        tone={
                          r.route === "auto" ? "good" : r.route === "warning" ? "warn" : "bad"
                        }
                        text={r.route.replace(/_/g, " ")}
                      />
                    </td>
                    <td className="border-b border-white/10 px-3 py-2 text-zinc-400">
                      {r.reason}
                      <div className="mt-1 text-[10px] text-zinc-500">
                        name {Math.round(r.signals.semantic_name_similarity * 100)}% · pattern{" "}
                        {Math.round(r.signals.value_pattern_match * 100)}% · consistency{" "}
                        {Math.round(r.signals.cross_field_consistency * 100)}% · history{" "}
                        {Math.round(r.signals.history_prior * 100)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sqlPersist}
                  onChange={(e) => setSqlPersist(e.target.checked)}
                />
                Persist to DB
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sqlClear}
                  onChange={(e) => setSqlClear(e.target.checked)}
                />
                Clear table before insert
              </label>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={runSqlLoad}
                disabled={!effectiveFileId || sqlLoading}
                className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-50"
              >
                {sqlLoading ? "Running…" : "Run SQL conformance load"}
              </motion.button>
            </div>
            {sqlResult ? (
              <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-zinc-400">Target table</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">
                      {sqlResult.target_table ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Schema conformance</div>
                    <div className="mt-1 text-sm font-semibold text-cyan-200">
                      {sqlResult.schema_conformance_percent}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Rows inserted / failed</div>
                    <div className="mt-1 text-sm text-zinc-200">
                      {sqlResult.rows_inserted} / {sqlResult.rows_failed}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-400">Issues</div>
                    <div className="mt-1 text-sm text-zinc-200">{sqlResult.issues.length}</div>
                  </div>
                </div>
                {sqlResult.notes?.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-500">
                    {sqlResult.notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="text-xs text-zinc-500">Run load to see conformance results.</div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
}
