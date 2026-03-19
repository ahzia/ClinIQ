"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, AlertTriangle, Database, Sparkles } from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet, apiPost } from "@/lib/api";

type MappingSummaryCounts = {
  total_fields_seen: number;
  auto_mapped: number;
  mapped_with_warning: number;
  needs_review: number;
  failed: number;
};

type MappingBySourceItem = {
  source_id: string;
  auto_mapped: number;
  needs_review: number;
  failed: number;
};

type MappingSummaryResponse = {
  summary: MappingSummaryCounts;
  by_source: MappingBySourceItem[];
};

type MappingAlertItem = {
  id: string;
  severity: "high" | "medium" | "low";
  file_id: string;
  source_id: string;
  type: string;
  message: string;
  action: string;
};

type MappingAlertsResponse = {
  alerts: MappingAlertItem[];
};

type MappingRerunRequest = {
  scope: "all" | "file" | "source";
  file_id: string | null;
  source_id: string | null;
};

type MappingRerunResponse = {
  job_id: string;
  status: "queued";
  queued_at: string;
  scope: "all" | "file" | "source";
  file_id: string | null;
  source_id: string | null;
};

type CanonicalEntity = {
  id: string;
  label: string;
  key_fields: string[];
  fields: string[];
};

type CanonicalModelResponse = {
  entities: CanonicalEntity[];
};

function severityTone(sev: MappingAlertItem["severity"]) {
  if (sev === "high") return "bad";
  if (sev === "medium") return "warn";
  return "neutral";
}

function StatusPill({ tone, text }: { tone: string; text: string }) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20"
      : tone === "bad"
      ? "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/20"
      : "bg-white/5 text-zinc-200 ring-1 ring-white/10";
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}
    >
      {text}
    </span>
  );
}

function ProgressBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const bar =
    tone === "good"
      ? "bg-emerald-400/80"
      : tone === "warn"
      ? "bg-amber-400/80"
      : tone === "bad"
      ? "bg-rose-400/75"
      : "bg-white/10";

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-zinc-400">{label}</div>
        <div className="text-xs font-semibold text-zinc-100">{pct}%</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full ${bar}`}
        />
      </div>
    </div>
  );
}

export default function MappingPanel({
  selectedSourceId,
  selectedFileId,
}: {
  selectedSourceId: string | null;
  selectedFileId: string | null;
}) {
  const [summary, setSummary] = useState<MappingSummaryResponse | null>(null);
  const [alerts, setAlerts] = useState<MappingAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<MappingRerunRequest["scope"]>("all");
  const [rerunLoading, setRerunLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const [canonical, setCanonical] = useState<CanonicalModelResponse | null>(null);
  const [canonicalLoading, setCanonicalLoading] = useState(true);
  const [canonicalError, setCanonicalError] = useState<string | null>(null);
  const [canonicalQuery, setCanonicalQuery] = useState("");
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string | null>(null);
  const [canonicalExpanded, setCanonicalExpanded] = useState(false);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const [alertFilter, setAlertFilter] = useState<
    "all" | "high" | "needs_review" | "identity"
  >("all");

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [s, a] = await Promise.all([
          apiGet<MappingSummaryResponse>("/mapping/summary"),
          apiGet<MappingAlertsResponse>("/mapping/alerts"),
        ]);
        if (!mounted) return;
        setSummary(s);
        setAlerts(a);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load mapping data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function run() {
      setCanonicalLoading(true);
      setCanonicalError(null);
      try {
        const res = await apiGet<CanonicalModelResponse>("/mapping/canonical-model");
        if (!mounted) return;
        setCanonical(res);
        setSelectedCanonicalId((prev) => prev ?? (res.entities?.[0]?.id ?? null));
      } catch (e) {
        if (!mounted) return;
        setCanonicalError(e instanceof Error ? e.message : "Failed to load canonical model.");
      } finally {
        if (mounted) setCanonicalLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const canRerun = useMemo(() => {
    if (scope === "all") return true;
    if (scope === "file") return Boolean(selectedFileId);
    if (scope === "source") return Boolean(selectedSourceId);
    return true;
  }, [scope, selectedFileId, selectedSourceId]);

  const filteredEntities = useMemo(() => {
    const q = canonicalQuery.trim().toLowerCase();
    const list = canonical?.entities ?? [];
    if (!q) return list;
    return list.filter((e) => {
      return (
        e.id.toLowerCase().includes(q) ||
        e.label.toLowerCase().includes(q) ||
        e.key_fields.join(" ").toLowerCase().includes(q) ||
        e.fields.join(" ").toLowerCase().includes(q)
      );
    });
  }, [canonical, canonicalQuery]);

  const selectedEntity = useMemo(() => {
    if (!selectedCanonicalId) return null;
    return canonical?.entities.find((e) => e.id === selectedCanonicalId) ?? null;
  }, [canonical, selectedCanonicalId]);

  async function onRerun() {
    if (!canRerun) return;
    setRerunLoading(true);
    setJobError(null);
    setJobId(null);

    try {
      const payload: MappingRerunRequest = {
        scope,
        file_id: scope === "file" ? selectedFileId : null,
        source_id: scope === "source" ? selectedSourceId : null,
      };
      const res = await apiPost<MappingRerunResponse, MappingRerunRequest>(
        "/mapping/rerun",
        payload
      );
      setJobId(res.job_id);
    } catch (e) {
      setJobError(e instanceof Error ? e.message : "Rerun failed.");
    } finally {
      setRerunLoading(false);
    }
  }

  const max = summary?.summary.total_fields_seen ?? 0;
  const allAlerts = alerts?.alerts ?? [];

  const prioritizedAlerts = useMemo(() => {
    const sevRank: Record<MappingAlertItem["severity"], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };
    return [...allAlerts].sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
  }, [allAlerts]);

  const filteredAlerts = useMemo(() => {
    if (alertFilter === "high") {
      return prioritizedAlerts.filter((a) => a.severity === "high");
    }
    if (alertFilter === "needs_review") {
      return prioritizedAlerts.filter((a) =>
        `${a.type} ${a.message} ${a.action}`.toLowerCase().includes("review")
      );
    }
    if (alertFilter === "identity") {
      return prioritizedAlerts.filter((a) => {
        const hay = `${a.type} ${a.message}`.toLowerCase();
        return hay.includes("id_conflict") || hay.includes("unresolved_case_link");
      });
    }
    return prioritizedAlerts;
  }, [prioritizedAlerts, alertFilter]);

  const visibleAlerts = alertsExpanded ? filteredAlerts : filteredAlerts.slice(0, 4);
  const showAlertsToggle = allAlerts.length > 4;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            Mapping Control
          </div>
          <div className="mt-2 text-sm text-zinc-400">
            Trust-first mapping insights and rerun orchestration.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <div className="text-xs text-zinc-400">Auto-rerun</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">
              Manual mode
            </div>
          </div>
        </div>
      </div>

      <GlassCard className="p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/20">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                    <Sparkles className="h-5 w-5 text-cyan-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-100">
                      Field confidence breakdown
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      {summary?.summary.total_fields_seen ?? 0} total fields
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    tone="neutral"
                    text={
                      jobId
                        ? `Queued: ${jobId}`
                        : canRerun
                        ? "Ready"
                        : "Select a file/source"
                    }
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <ProgressBar
                  label="Auto-mapped"
                  value={summary?.summary.auto_mapped ?? 0}
                  max={max}
                  tone="good"
                />
                <ProgressBar
                  label="Mapped with warnings"
                  value={summary?.summary.mapped_with_warning ?? 0}
                  max={max}
                  tone="warn"
                />
                <ProgressBar
                  label="Needs review"
                  value={summary?.summary.needs_review ?? 0}
                  max={max}
                  tone="neutral"
                />
                <ProgressBar
                  label="Failed"
                  value={summary?.summary.failed ?? 0}
                  max={max}
                  tone="bad"
                />
              </div>

              <div className="mt-6 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-zinc-100">
                  By source
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {summary?.by_source.map((s, idx) => (
                    <motion.div
                      key={s.source_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                      className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-100">
                            {s.source_id}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            Auto: {s.auto_mapped} · Review: {s.needs_review} · Failed:{" "}
                            {s.failed}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill tone="good" text={`${s.auto_mapped}`} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-white/5 p-5 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                      <Database className="h-5 w-5 text-cyan-200" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        Rerun mapping
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        Queue a background mapping job (stub).
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3">
                  <div className="flex flex-col">
                    <label className="text-xs text-zinc-400">Scope</label>
                    <select
                      value={scope}
                      onChange={(e) =>
                        setScope(e.target.value as MappingRerunRequest["scope"])
                      }
                      className="select-premium mt-2 p-3 text-sm text-zinc-100"
                    >
                      <option value="all">All data</option>
                      <option value="file">Selected file</option>
                      <option value="source">Selected source</option>
                    </select>
                  </div>

                  <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <div className="text-xs text-zinc-400">Selection</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">
                      {scope === "all"
                        ? "All files/sources"
                        : scope === "file"
                        ? selectedFileId ?? "No file selected"
                        : selectedSourceId ?? "No source selected"}
                    </div>
                  </div>

                  {jobError ? (
                    <div className="rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-rose-400/20">
                      {jobError}
                    </div>
                  ) : null}

                  <motion.button
                    type="button"
                    onClick={onRerun}
                    disabled={!canRerun || rerunLoading}
                    whileTap={{ scale: 0.98 }}
                    className="mt-1 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500/80 via-sky-500/80 to-indigo-500/80 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {rerunLoading ? "Queuing..." : "Queue rerun"}
                  </motion.button>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-100">
                    Mapping alerts
                  </div>
                  <button
                    type="button"
                    onClick={() => setAlertFilter("all")}
                    className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Reset filter
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusPill
                    tone="bad"
                    text={`High ${allAlerts.filter((a) => a.severity === "high").length}`}
                  />
                  <StatusPill
                    tone="warn"
                    text={`Medium ${allAlerts.filter((a) => a.severity === "medium").length}`}
                  />
                  <StatusPill
                    tone="neutral"
                    text={`Low ${allAlerts.filter((a) => a.severity === "low").length}`}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { id: "all", label: `All (${allAlerts.length})` },
                    {
                      id: "high",
                      label: `High (${allAlerts.filter((a) => a.severity === "high").length})`,
                    },
                    {
                      id: "needs_review",
                      label: "Needs review",
                    },
                    {
                      id: "identity",
                      label: "Identity/linking",
                    },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setAlertFilter(
                          f.id as "all" | "high" | "needs_review" | "identity"
                        )
                      }
                      className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                        alertFilter === f.id
                          ? "bg-white/10 text-zinc-100 ring-white/20"
                          : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-3">
                  {filteredAlerts.length ? (
                    visibleAlerts.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                        className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-amber-200" />
                              <div className="truncate text-sm font-semibold text-zinc-100">
                                {a.type}
                              </div>
                            </div>
                            <div className="mt-2 text-xs text-zinc-400">
                              {a.message}
                            </div>
                            <div className="mt-2 text-xs text-cyan-200">
                              Action: {a.action}
                            </div>
                            <div className="mt-2 text-[11px] text-zinc-500">
                              file: {a.file_id} · source: {a.source_id}
                            </div>
                          </div>
                          <StatusPill
                            tone={
                              severityTone(a.severity) === "bad"
                                ? "bad"
                                : severityTone(a.severity) === "warn"
                                ? "warn"
                                : "neutral"
                            }
                            text={a.severity.toUpperCase()}
                          />
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                      No alerts for this filter.
                    </div>
                  )}

                  {showAlertsToggle && filteredAlerts.length > 4 ? (
                    <motion.button
                      type="button"
                      onClick={() => setAlertsExpanded((v) => !v)}
                      whileTap={{ scale: 0.98 }}
                      className="w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                    >
                      {alertsExpanded ? "Show less" : "Show all alerts"}
                    </motion.button>
                  ) : null}
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-zinc-100">
                    Linking strategy
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Primary link uses <span className="font-semibold text-zinc-200">case_id</span>.
                    Fallback uses <span className="font-semibold text-zinc-200">patient_id + datetime window</span>.
                    Low-confidence links should go to manual review.
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-zinc-100">
                    Canonical model
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-zinc-400">
                      {canonical?.entities?.length ?? 0} entities
                    </div>
                    <motion.button
                      type="button"
                      onClick={() => setCanonicalExpanded((v) => !v)}
                      whileTap={{ scale: 0.98 }}
                      className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                    >
                      {canonicalExpanded ? "Compact" : "Browse"}
                    </motion.button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                  <input
                    value={canonicalQuery}
                    onChange={(e) => setCanonicalQuery(e.target.value)}
                    placeholder="Search entities..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3">
                  {canonicalLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-14 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                        />
                      ))}
                    </div>
                  ) : canonicalError ? (
                    <div className="rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-200 ring-1 ring-amber-400/20">
                      {canonicalError}
                    </div>
                  ) : filteredEntities.length ? (
                    <>
                      {canonicalExpanded ? (
                        <div className="max-h-[220px] overflow-y-auto pr-1 grid grid-cols-1 gap-2">
                          {filteredEntities.map((e, idx) => {
                            const isActive = e.id === selectedCanonicalId;
                            return (
                              <motion.button
                                key={e.id}
                                type="button"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, delay: idx * 0.02 }}
                                onClick={() => setSelectedCanonicalId(e.id)}
                                className={`rounded-2xl p-4 text-left ring-1 ring-white/10 transition ${
                                  isActive
                                    ? "bg-white/10 ring-white/20"
                                    : "bg-white/5 hover:bg-white/7 hover:ring-white/20"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-zinc-100">
                                      {e.label}
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-400">
                                      Keys: {e.key_fields.join(", ")}
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-xs text-cyan-200">
                                    {e.fields.length} fields
                                  </div>
                                </div>
                              </motion.button>
                            );
                          })}
                        </div>
                      ) : (
                        <select
                          value={selectedCanonicalId ?? ""}
                          onChange={(e) => setSelectedCanonicalId(e.target.value)}
                          className="select-premium w-full px-4 py-3 text-sm text-zinc-100"
                        >
                          {filteredEntities.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.label}
                            </option>
                          ))}
                        </select>
                      )}

                      {selectedEntity ? (
                        <div className="mt-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-zinc-100">
                                {selectedEntity.label}
                              </div>
                              <div className="mt-1 text-xs text-zinc-400">
                                Entity id: {selectedEntity.id}
                              </div>
                            </div>
                            <StatusPill
                              tone="neutral"
                              text="Canonical"
                            />
                          </div>

                          <div className="mt-3">
                            <div className="text-xs text-zinc-400">
                              Key fields
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedEntity.key_fields.map((k) => (
                                <span
                                  key={k}
                                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-200 ring-1 ring-white/10"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="text-xs text-zinc-400">
                              Fields
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedEntity.fields.slice(0, 16).map((f) => (
                                <span
                                  key={f}
                                  className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-300 ring-1 ring-white/10"
                                >
                                  {f}
                                </span>
                              ))}
                              {selectedEntity.fields.length > 16 ? (
                                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-zinc-400 ring-1 ring-white/10">
                                  +{selectedEntity.fields.length - 16} more
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                      No entities match your search.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

