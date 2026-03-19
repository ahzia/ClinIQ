"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Database, ShieldCheck } from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet } from "@/lib/api";

type QualitySummaryBlock = {
  overall_quality_score: number;
  clean_percent: number;
  missing_percent: number;
  incorrect_percent: number;
};

type QualityKpiBlock = {
  files_with_missing_required_ids: number;
  files_with_schema_drift: number;
  files_with_value_anomalies: number;
};

type QualitySummaryResponse = {
  summary: QualitySummaryBlock;
  kpis: QualityKpiBlock;
};

type QualityBySourceItem = {
  source_id: string;
  clean_percent: number;
  missing_percent: number;
  incorrect_percent: number;
};

type QualityBySourceResponse = {
  items: QualityBySourceItem[];
};

function TonePill({ tone, text }: { tone: string; text: string }) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20"
      : "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/20";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>
      {text}
    </span>
  );
}

function Progress({ value, tone }: { value: number; tone: "good" | "warn" | "bad" }) {
  const bar =
    tone === "good"
      ? "bg-emerald-400/80"
      : tone === "warn"
      ? "bg-amber-400/80"
      : "bg-rose-400/75";

  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value)}%` }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className={`h-full ${bar}`}
      />
    </div>
  );
}

export default function QualityPanel({
  selectedSourceId,
}: {
  selectedSourceId: string | null;
}) {
  const [summary, setSummary] = useState<QualitySummaryResponse | null>(null);
  const [bySource, setBySource] = useState<QualityBySourceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pickedSourceId, setPickedSourceId] = useState<string | null>(null);
  const [qualityFilter, setQualityFilter] = useState<
    "all" | "healthy" | "needs_attention" | "critical"
  >("all");

  useEffect(() => {
    let mounted = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [s, b] = await Promise.all([
          apiGet<QualitySummaryResponse>("/quality/summary"),
          apiGet<QualityBySourceResponse>("/quality/by-source"),
        ]);
        if (!mounted) return;
        setSummary(s);
        setBySource(b);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load quality.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const selected = useMemo(() => {
    if (!bySource?.items?.length || !selectedSourceId) return null;
    return bySource.items.find((i) => i.source_id === selectedSourceId) ?? null;
  }, [bySource, selectedSourceId]);

  useEffect(() => {
    if (!bySource?.items?.length) return;
    if (selectedSourceId) {
      setPickedSourceId(selectedSourceId);
      return;
    }
    setPickedSourceId(bySource.items[0]?.source_id ?? null);
  }, [bySource, selectedSourceId]);

  const picked = useMemo(() => {
    if (!bySource?.items?.length || !pickedSourceId) return null;
    return bySource.items.find((i) => i.source_id === pickedSourceId) ?? null;
  }, [bySource, pickedSourceId]);

  const filteredItems = useMemo(() => {
    const list = bySource?.items ?? [];
    if (qualityFilter === "healthy") {
      return list.filter((i) => i.clean_percent >= 75 && i.incorrect_percent <= 10);
    }
    if (qualityFilter === "needs_attention") {
      return list.filter(
        (i) =>
          (i.clean_percent >= 60 && i.clean_percent < 75) ||
          (i.missing_percent > 15 && i.missing_percent <= 25)
      );
    }
    if (qualityFilter === "critical") {
      return list.filter((i) => i.clean_percent < 60 || i.incorrect_percent > 20);
    }
    return list;
  }, [bySource, qualityFilter]);

  useEffect(() => {
    if (!filteredItems.length) return;
    const exists = pickedSourceId
      ? filteredItems.some((i) => i.source_id === pickedSourceId)
      : false;
    if (!exists) {
      setPickedSourceId(filteredItems[0].source_id);
    }
  }, [filteredItems, pickedSourceId]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-100">Quality Insights</div>
          <div className="mt-2 text-sm text-zinc-400">
            Understand data cleanliness, missing signals, and anomaly patterns across sources.
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
          <ShieldCheck className="h-4 w-4 text-emerald-200" />
          <span className="text-xs text-zinc-400">Trust score</span>
          <span className="text-sm font-semibold text-zinc-100">
            {summary?.summary.overall_quality_score ?? "—"}
          </span>
        </div>
      </div>

      <GlassCard className="p-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-12 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/20">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                  <Database className="h-5 w-5 text-cyan-200" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-zinc-100">Overview</div>
                  <div className="mt-1 text-xs text-zinc-400">
                    Clean, missing, and incorrect percentages.
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-400">Clean</div>
                  <TonePill tone="good" text={`${summary?.summary.clean_percent ?? 0}%`} />
                </div>
                <Progress value={summary?.summary.clean_percent ?? 0} tone="good" />
              </div>

              <div className="mt-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-400">Missing</div>
                  <TonePill tone="warn" text={`${summary?.summary.missing_percent ?? 0}%`} />
                </div>
                <Progress value={summary?.summary.missing_percent ?? 0} tone="warn" />
              </div>

              <div className="mt-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-400">Incorrect</div>
                  <TonePill tone="bad" text={`${summary?.summary.incorrect_percent ?? 0}%`} />
                </div>
                <Progress value={summary?.summary.incorrect_percent ?? 0} tone="bad" />
              </div>

              <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                <div className="text-sm font-semibold text-zinc-100">KPIs</div>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      Missing required IDs
                    </div>
                    <div className="text-xs font-semibold text-zinc-100">
                      {summary?.kpis.files_with_missing_required_ids ?? 0}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      Schema drift
                    </div>
                    <div className="text-xs font-semibold text-zinc-100">
                      {summary?.kpis.files_with_schema_drift ?? 0}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-zinc-400">
                      Value anomalies
                    </div>
                    <div className="text-xs font-semibold text-zinc-100">
                      {summary?.kpis.files_with_value_anomalies ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {selected ? (
                <div className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-zinc-100">
                    Selected source
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    {selected.source_id}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <TonePill tone="good" text={`Clean ${selected.clean_percent}%`} />
                    <TonePill tone="warn" text={`Missing ${selected.missing_percent}%`} />
                    <TonePill tone="bad" text={`Incorrect ${selected.incorrect_percent}%`} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">By source</div>
                  <div className="mt-2 text-xs text-zinc-400">
                    Clean/Missing/Incorrect distribution. Pick a source to focus.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQualityFilter("all")}
                  className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                >
                  Reset filter
                </button>
              </div>

              <div className="mt-4">
                <div className="mb-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-sm font-semibold text-zinc-100">
                    Quality interpretation
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    High clean % with low incorrect % is strongest signal. Missing values
                    usually indicate ingestion/schema gaps, while incorrect values indicate
                    mapping or validation issues requiring faster triage.
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {[
                    { id: "all", label: `All (${bySource?.items?.length ?? 0})` },
                    {
                      id: "healthy",
                      label: `Healthy (${(bySource?.items ?? []).filter((i) => i.clean_percent >= 75 && i.incorrect_percent <= 10).length})`,
                    },
                    { id: "needs_attention", label: "Needs attention" },
                    { id: "critical", label: "Critical" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() =>
                        setQualityFilter(
                          f.id as "all" | "healthy" | "needs_attention" | "critical"
                        )
                      }
                      className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                        qualityFilter === f.id
                          ? "bg-white/10 text-zinc-100 ring-white/20"
                          : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <label className="text-xs text-zinc-400">Source</label>
                <select
                  value={pickedSourceId ?? ""}
                  onChange={(e) => setPickedSourceId(e.target.value)}
                  disabled={!filteredItems.length}
                  className="select-premium mt-2 w-full px-4 py-3 text-sm text-zinc-100"
                >
                  {filteredItems.map((i) => (
                    <option key={i.source_id} value={i.source_id}>
                      {i.source_id}
                    </option>
                  ))}
                </select>
              </div>

              {picked ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="mt-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {picked.source_id}
                      </div>
                      <div className="mt-1 text-xs text-zinc-400">
                        Clean {picked.clean_percent}% · Missing {picked.missing_percent}% · Incorrect{" "}
                        {picked.incorrect_percent}%
                      </div>
                    </div>
                    <TonePill
                      tone={
                        picked.clean_percent >= 75
                          ? "good"
                          : picked.clean_percent >= 60
                          ? "warn"
                          : "bad"
                      }
                      text={`${picked.clean_percent}%`}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <Progress value={picked.clean_percent} tone="good" />
                    <Progress value={picked.missing_percent} tone="warn" />
                    <Progress value={picked.incorrect_percent} tone="bad" />
                  </div>
                </motion.div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                  Select a source to view distribution.
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

