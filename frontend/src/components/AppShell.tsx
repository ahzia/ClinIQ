"use client";

import type { ReactNode } from "react";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  LayoutDashboard,
  Info,
  Settings2,
  ShieldCheck,
  Sparkles,
  Activity,
} from "lucide-react";

import AnimatedBackground from "./AnimatedBackground";
import GlassCard from "./ui/GlassCard";
import StatCard from "./ui/StatCard";
import SourcesPanel from "./panels/SourcesPanel";
import MappingPanel from "./panels/MappingPanel";
import QualityPanel from "./panels/QualityPanel";
import CorrectionsPanel from "./panels/CorrectionsPanel";
import SystemDiagnosticsPanel from "./panels/SystemDiagnosticsPanel";
import {
  DEMO_LANE_LABELS,
  countFilesByDemoLane,
  type DemoLaneKey,
} from "@/lib/demoLanes";

const OVERVIEW_LANE_ORDER: DemoLaneKey[] = [
  "baseline",
  "error_detection",
  "mapping_robustness",
  "validation_package",
];

type HealthResponse = {
  status: string;
  service: string;
  version: string;
  env: string;
};

type ContractVersionResponse = {
  api_version?: string;
  contract_version?: string;
  stability?: string;
  breaking_change_policy?: string;
};

type FilesSummary = {
  imported_files: number;
  successful_mappings: number;
  mappings_with_warnings: number;
  failed_mappings: number;
  needs_review: number;
};

type OverviewFileRow = { name: string };

type FilesResponse = {
  files: OverviewFileRow[];
  summary: FilesSummary;
};

type MappingSummaryCounts = {
  total_fields_seen: number;
  auto_mapped: number;
  mapped_with_warning: number;
  needs_review: number;
  failed: number;
};

type MappingSummaryResponse = {
  summary: MappingSummaryCounts;
  by_source: unknown[];
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

type QualitySummaryResponse = {
  summary: {
    overall_quality_score: number;
    clean_percent: number;
    missing_percent: number;
    incorrect_percent: number;
  };
  kpis: {
    files_with_missing_required_ids: number;
    files_with_schema_drift: number;
    files_with_value_anomalies: number;
  };
};

type CorrectionsQueueResponse = {
  queue: unknown[];
  summary: {
    pending_review: number;
    accepted_today: number;
    rejected_today: number;
  };
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api/v1";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

function Pill({
  tone,
  children,
}: {
  tone: "good" | "warn" | "neutral";
  children: ReactNode;
}) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20"
      : "bg-white/5 text-zinc-200 ring-1 ring-white/10";
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>{children}</span>;
}

type NavId =
  | "overview"
  | "sources"
  | "mapping"
  | "quality"
  | "corrections"
  | "system";

export default function AppShell() {
  const navItems = useMemo(
    () =>
      [
        { id: "overview" as const, label: "Overview", icon: LayoutDashboard },
        { id: "sources" as const, label: "Data Sources", icon: FileText },
        { id: "mapping" as const, label: "Field Matching", icon: Sparkles },
        { id: "quality" as const, label: "Quality", icon: Database },
        { id: "corrections" as const, label: "Review & Fix", icon: ShieldCheck },
        { id: "system" as const, label: "System", icon: Settings2 },
      ] as const,
    []
  );

  const [activeNav, setActiveNav] = useState<NavId>("overview");

  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(
    null
  );
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [contractVersion, setContractVersion] =
    useState<ContractVersionResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewFilesSummary, setOverviewFilesSummary] =
    useState<FilesSummary | null>(null);
  const [overviewMappingSummary, setOverviewMappingSummary] =
    useState<MappingSummaryCounts | null>(null);
  const [overviewMappingAlerts, setOverviewMappingAlerts] =
    useState<MappingAlertItem[] | null>(null);
  const [overviewQualitySummary, setOverviewQualitySummary] =
    useState<QualitySummaryResponse | null>(null);
  const [overviewCorrectionsSummary, setOverviewCorrectionsSummary] =
    useState<CorrectionsQueueResponse["summary"] | null>(null);
  const [overviewFiles, setOverviewFiles] = useState<OverviewFileRow[]>([]);

  const [activeOverviewAlertId, setActiveOverviewAlertId] = useState<
    string | null
  >(null);

  /** Demo-friendly default file/source so Mapping intelligence is one click away. */
  useEffect(() => {
    let mounted = true;
    async function seedDemoSelection() {
      try {
        const r = await fetchJson<{ files: { id: string; source_id: string }[] }>(
          `${API_BASE_URL}/files`
        );
        if (!mounted || !r.files?.length) return;
        const preferred = ["f_clinic2_device", "f_epaac_1", "f_clinic3_header_broken"];
        const found =
          preferred.map((id) => r.files.find((f) => f.id === id)).find(Boolean) ??
          r.files[0];
        if (!found) return;
        setSelectedFileId(found.id);
        setSelectedSourceId(found.source_id);
      } catch {
        /* manual selection still works */
      }
    }
    seedDemoSelection();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!API_BASE_URL) {
        if (mounted) setApiError("API base URL is not configured.");
        return;
      }

      try {
        const [h, c] = await Promise.all([
          fetchJson<HealthResponse>(`${API_BASE_URL}/health`),
          fetchJson<ContractVersionResponse>(`${API_BASE_URL}/contracts/version`),
        ]);

        if (!mounted) return;
        setHealth(h);
        setContractVersion(c);
        setApiError(null);
      } catch (e) {
        if (!mounted) return;
        setApiError(e instanceof Error ? e.message : "Failed to fetch backend.");
        setHealth(null);
        setContractVersion(null);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!overviewMappingAlerts?.length) {
      setActiveOverviewAlertId(null);
      return;
    }
    const stillValid = activeOverviewAlertId
      ? overviewMappingAlerts.some((a) => a.id === activeOverviewAlertId)
      : false;
    if (stillValid) return;
    setActiveOverviewAlertId(overviewMappingAlerts[0].id);
  }, [overviewMappingAlerts, activeOverviewAlertId]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!API_BASE_URL) {
        if (mounted) {
          setOverviewError("API base URL is not configured.");
          setOverviewLoading(false);
        }
        return;
      }

      setOverviewLoading(true);
      setOverviewError(null);

      try {
        const [filesRes, mappingRes, alertsRes, qualityRes, corrRes] =
          await Promise.all([
            fetchJson<FilesResponse>(`${API_BASE_URL}/files`),
            fetchJson<MappingSummaryResponse>(`${API_BASE_URL}/mapping/summary`),
            fetchJson<MappingAlertsResponse>(`${API_BASE_URL}/mapping/alerts`),
            fetchJson<QualitySummaryResponse>(`${API_BASE_URL}/quality/summary`),
            fetchJson<CorrectionsQueueResponse>(
              `${API_BASE_URL}/corrections/queue`
            ),
          ]);

        if (!mounted) return;
        setOverviewFilesSummary(filesRes.summary);
        setOverviewMappingSummary(mappingRes.summary);
        setOverviewMappingAlerts(alertsRes.alerts);
        setOverviewQualitySummary(qualityRes);
        setOverviewCorrectionsSummary(corrRes.summary);
        setOverviewFiles(filesRes.files ?? []);
      } catch (e) {
        if (!mounted) return;
        setOverviewError(
          e instanceof Error ? e.message : "Failed to load overview KPIs."
        );
      } finally {
        if (mounted) setOverviewLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  const trustConfidencePct = useMemo(() => {
    const t = overviewMappingSummary?.total_fields_seen ?? 0;
    const a = overviewMappingSummary?.auto_mapped ?? 0;
    if (!t) return 0;
    return Math.max(0, Math.min(100, Math.round((a / t) * 100)));
  }, [overviewMappingSummary]);

  const trustAnomalyPct = useMemo(() => {
    const missing = overviewQualitySummary?.summary.missing_percent ?? 0;
    const incorrect = overviewQualitySummary?.summary.incorrect_percent ?? 0;
    // missing + incorrect represent "non-clean" signals; average keeps it intuitive.
    const avg = (missing + incorrect) / 2;
    return Math.max(0, Math.min(100, Math.round(avg)));
  }, [overviewQualitySummary]);

  const laneCounts = useMemo(
    () => countFilesByDemoLane(overviewFiles),
    [overviewFiles]
  );

  const highAlertCount = useMemo(
    () =>
      overviewMappingAlerts?.filter((a) => a.severity === "high").length ?? 0,
    [overviewMappingAlerts]
  );

  const validationNeedsAttention = useMemo(() => {
    const q = overviewQualitySummary?.summary.overall_quality_score;
    const qBad =
      typeof q === "number"
        ? q <= 10
          ? q < 6.5
          : q < 65
        : false;
    return highAlertCount > 0 || qBad;
  }, [highAlertCount, overviewQualitySummary]);

  const itemsNeedingReview = useMemo(() => {
    const corr = overviewCorrectionsSummary?.pending_review ?? 0;
    const map = overviewMappingSummary?.needs_review ?? 0;
    return corr + map;
  }, [overviewCorrectionsSummary, overviewMappingSummary]);

  const confidenceTone: "good" | "warn" | "neutral" =
    trustConfidencePct >= 70 ? "good" : trustConfidencePct >= 55 ? "warn" : "neutral";

  const activeOverviewAlert = useMemo(() => {
    if (!overviewMappingAlerts?.length) return null;
    return (
      (activeOverviewAlertId
        ? overviewMappingAlerts.find((a) => a.id === activeOverviewAlertId)
        : null) ?? overviewMappingAlerts[0]
    );
  }, [overviewMappingAlerts, activeOverviewAlertId]);

  function severityAccent(sev: MappingAlertItem["severity"]) {
    if (sev === "high")
      return {
        pill:
          "bg-amber-500/10 text-amber-200 ring-amber-400/20",
        iconClass: "text-amber-200",
        bg: "bg-amber-500/10 ring-amber-400/20",
      };
    if (sev === "medium")
      return {
        pill:
          "bg-cyan-500/10 text-cyan-200 ring-cyan-400/20",
        iconClass: "text-cyan-200",
        bg: "bg-cyan-500/10 ring-cyan-400/20",
      };
    return {
      pill:
        "bg-emerald-500/10 text-emerald-200 ring-emerald-400/20",
      iconClass: "text-emerald-200",
      bg: "bg-emerald-500/10 ring-emerald-400/20",
    };
  }

  const activeNavLabel =
    navItems.find((n) => n.id === activeNav)?.label ?? "Overview";

  const healthScoreLabel = useMemo(() => {
    const q = overviewQualitySummary?.summary.overall_quality_score;
    if (q === undefined || q === null) return "—";
    if (q <= 10) return `${q.toFixed(1)} / 10`;
    return `${Math.round(q)}%`;
  }, [overviewQualitySummary]);

  return (
    <div className="relative h-screen overflow-hidden overflow-x-hidden bg-zinc-950 text-white">
      <AnimatedBackground />

      <div className="relative mx-auto flex h-screen w-full max-w-[1280px]">
        <aside className="hidden w-72 flex-shrink-0 flex-col overflow-hidden border-r border-white/10 bg-white/2/0 px-6 py-8 md:flex">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/20 via-indigo-500/20 to-purple-500/20 ring-1 ring-white/10">
              <motion.div
                className="h-4 w-4 rounded-full bg-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.35)]"
                animate={{ scale: [1, 1.18, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-wide text-zinc-100">
                ClinIQ
              </div>
              <div className="truncate text-xs text-zinc-400">
                Trust layer for mapping
              </div>
            </div>
          </motion.div>

          <div className="mt-8 flex flex-1 flex-col overflow-y-auto pr-1">
            <nav className="flex flex-col gap-2">
              {navItems.map((item, idx) => {
                const Icon = item.icon;
                const isActive = item.id === activeNav;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.25 }}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ring-1 transition
                    ${
                      isActive
                        ? "bg-white/10 ring-white/20"
                        : "bg-transparent ring-transparent hover:bg-white/5 hover:ring-white/10"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
                      <Icon className="h-4 w-4 text-cyan-200" />
                    </span>
                    <span className="font-medium text-zinc-100">{item.label}</span>
                  </motion.button>
                );
              })}
            </nav>

            <div className="mt-6">
              <GlassCard className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                    <ShieldCheck className="h-4 w-4 text-cyan-200" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-100">
                      Quick tip
                    </div>
                    <div className="mt-1 text-xs text-zinc-400">
                      Uncertain matches →{" "}
                      <span className="text-zinc-200">Review &amp; Fix</span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          </div>
        </aside>

        <main className="min-h-0 flex-1 scroll-smooth overflow-y-auto overflow-x-hidden px-6 py-8 md:px-10">
          <motion.header
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  ClinIQ Workspace
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                  ClinIQ helps you combine healthcare files into one consistent format.
                  It highlights risky matches, explains why they were flagged, and
                  guides you to fix them quickly.
                </p>
                <div className="mt-3">
                  <Pill tone="neutral">View: {activeNavLabel}</Pill>
                </div>
              </div>
            </div>
          </motion.header>

          <div className="mt-5 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-semibold ring-1 transition ${
                      isActive
                        ? "bg-white/10 text-zinc-100 ring-white/20"
                        : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.section
              key={activeNav}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="mt-6"
            >
              {activeNav === "overview" ? (
                <div className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                      label="Files imported"
                      value={
                        overviewFilesSummary
                          ? `${overviewFilesSummary.imported_files} files`
                          : "Loading..."
                      }
                      hint={
                        overviewFilesSummary
                          ? `${overviewFilesSummary.failed_mappings} failed · ${overviewFilesSummary.needs_review} flagged`
                          : undefined
                      }
                      icon={<Database className="h-4 w-4 text-cyan-200" />}
                    />
                    <StatCard
                      label="Fields matched (auto)"
                      value={
                        overviewMappingSummary
                          ? `${overviewMappingSummary.auto_mapped}`
                          : "Loading..."
                      }
                      hint={
                        overviewMappingSummary
                          ? `of ${overviewMappingSummary.total_fields_seen} columns · ${overviewMappingSummary.needs_review} need your review`
                          : "How many columns were matched automatically"
                      }
                      icon={<Sparkles className="h-4 w-4 text-cyan-200" />}
                    />
                    <StatCard
                      label="Needs review"
                      value={
                        overviewLoading
                          ? "Loading..."
                          : `${itemsNeedingReview}`
                      }
                      hint={`Queue ${overviewCorrectionsSummary?.pending_review ?? 0} · uncertain ${overviewMappingSummary?.needs_review ?? 0}`}
                      icon={<ShieldCheck className="h-4 w-4 text-cyan-200" />}
                    />
                    <StatCard
                      label="Overall data health"
                      value={overviewLoading ? "Loading..." : healthScoreLabel}
                      hint="Combined quality score from your uploads (higher is better)."
                      icon={<Activity className="h-4 w-4 text-cyan-200" />}
                    />
                  </div>

                  {overviewError ? (
                    <div className="rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-rose-400/20">
                      {overviewError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <GlassCard className="p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-zinc-100">
                            Validation status
                          </div>
                          <div className="mt-2 text-xs text-zinc-500">
                            High severity:{" "}
                            <span className="font-semibold text-zinc-300">
                              {highAlertCount}
                            </span>
                          </div>
                        </div>
                        <Pill tone={validationNeedsAttention ? "warn" : "good"}>
                          {validationNeedsAttention
                            ? "Needs attention"
                            : "Looking good"}
                        </Pill>
                      </div>
                    </GlassCard>

                    <GlassCard className="p-6">
                      <div className="text-sm font-semibold text-zinc-100">
                        Demo file groups
                      </div>
                      <div className="mt-3 space-y-2">
                        {OVERVIEW_LANE_ORDER.map((key) => {
                          const meta = DEMO_LANE_LABELS[key];
                          const n = laneCounts[key];
                          return (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-zinc-100">
                                  {meta.title}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {meta.description}
                                </div>
                              </div>
                              <Pill tone={n > 0 ? "good" : "neutral"}>
                                {n} file{n === 1 ? "" : "s"}
                              </Pill>
                            </div>
                          );
                        })}
                      </div>
                    </GlassCard>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-1">
                    <GlassCard className="p-6">
                      <div className="text-sm font-semibold text-zinc-100">
                        Confidence &amp; risk
                      </div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-zinc-400">Auto-match confidence</div>
                            <div
                              className={`text-xs font-semibold ${
                                confidenceTone === "good"
                                  ? "text-emerald-200"
                                  : confidenceTone === "warn"
                                  ? "text-amber-200"
                                  : "text-zinc-200"
                              }`}
                            >
                              {overviewMappingSummary?.total_fields_seen
                                ? `${trustConfidencePct}%`
                                : "—"}
                            </div>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${trustConfidencePct}%` }}
                              transition={{ duration: 0.9, ease: "easeOut" }}
                              className="h-full rounded-full bg-gradient-to-r from-cyan-400/80 to-indigo-400/80"
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-zinc-400">Potential data issues</div>
                            <div
                              className={`text-xs font-semibold ${
                                trustAnomalyPct <= 20
                                  ? "text-emerald-200"
                                  : trustAnomalyPct <= 35
                                  ? "text-amber-200"
                                  : "text-rose-200"
                              }`}
                            >
                              {overviewQualitySummary?.summary
                                ? `${trustAnomalyPct}%`
                                : "—"}
                            </div>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${trustAnomalyPct}%` }}
                              transition={{ duration: 0.9, ease: "easeOut" }}
                              className="h-full rounded-full bg-gradient-to-r from-amber-400/75 to-rose-400/70"
                            />
                          </div>
                        </div>
                      </div>

                    </GlassCard>

                    <GlassCard className="p-6">
                      <div className="text-sm font-semibold text-zinc-100">
                        Important issues
                      </div>
                      <div className="mt-3 grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          {overviewLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                              <div
                                key={i}
                                className="h-20 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                              />
                            ))
                          ) : overviewMappingAlerts?.length ? (
                            overviewMappingAlerts.slice(0, 3).map((a, i) => {
                              const isActive = a.id === activeOverviewAlertId;
                              const acc = severityAccent(a.severity);
                              return (
                                <motion.div
                                  key={a.id}
                                  initial={{ opacity: 0, y: 8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: i * 0.05, duration: 0.25 }}
                                  onClick={() =>
                                    setActiveOverviewAlertId(a.id)
                                  }
                                  role="button"
                                  tabIndex={0}
                                  className={`cursor-pointer rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:-translate-y-[1px] hover:ring-white/20 ${
                                    isActive
                                      ? `ring-2 ${acc.bg}`
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className={`mt-1 h-10 w-10 shrink-0 rounded-2xl ring-1 ${acc.bg}`}
                                    >
                                      <div className="flex h-full w-full items-center justify-center">
                                        {a.severity === "high" ? (
                                          <AlertTriangle className={`h-5 w-5 ${acc.iconClass}`} />
                                        ) : a.severity === "medium" ? (
                                          <Info className={`h-5 w-5 ${acc.iconClass}`} />
                                        ) : (
                                          <CheckCircle2
                                            className={`h-5 w-5 ${acc.iconClass}`}
                                          />
                                        )}
                                      </div>
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="text-sm font-semibold text-zinc-100">
                                          {a.type}
                                        </div>
                                        <span
                                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ${acc.pill}`}
                                        >
                                          {a.severity.toUpperCase()}
                                        </span>
                                      </div>

                                      <div className="mt-2 text-xs text-zinc-400">
                                        {a.message}
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          ) : (
                            <div className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                              No important issues right now.
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 min-w-0">
                          {overviewLoading ? (
                            <div className="space-y-3">
                              <div className="h-4 w-1/2 animate-pulse rounded bg-white/10" />
                              <div className="h-4 w-full animate-pulse rounded bg-white/10" />
                              <div className="h-4 w-4/5 animate-pulse rounded bg-white/10" />
                              <div className="h-24 w-full animate-pulse rounded bg-white/10" />
                            </div>
                          ) : activeOverviewAlert ? (
                            (() => {
                              const acc = severityAccent(
                                activeOverviewAlert.severity
                              );
                              return (
                                <div>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-xs text-zinc-400">
                                        Severity
                                      </div>
                                      <div className="mt-1 flex flex-wrap items-center gap-2">
                                        <span
                                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs ring-1 ${acc.pill}`}
                                        >
                                          {activeOverviewAlert.severity.toUpperCase()}
                                        </span>
                                        <div className="text-sm font-semibold text-zinc-100">
                                          {activeOverviewAlert.type}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl ring-1 bg-white/5 ring-white/10">
                                      {activeOverviewAlert.severity ===
                                      "high" ? (
                                        <AlertTriangle
                                          className={`h-5 w-5 ${acc.iconClass}`}
                                        />
                                      ) : activeOverviewAlert.severity ===
                                        "medium" ? (
                                        <Info
                                          className={`h-5 w-5 ${acc.iconClass}`}
                                        />
                                      ) : (
                                        <CheckCircle2
                                          className={`h-5 w-5 ${acc.iconClass}`}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <div className="text-xs text-zinc-400">
                                      Summary
                                    </div>
                                    <div className="mt-1 text-sm text-zinc-100">
                                      {activeOverviewAlert.message}
                                    </div>
                                  </div>

                                  <div className="mt-4">
                                    <div className="text-xs text-zinc-400">
                                      Recommended action
                                    </div>
                                    <div className="mt-1 text-sm font-semibold text-cyan-200">
                                      {activeOverviewAlert.action}
                                    </div>
                                  </div>

                                  <div className="mt-4 rounded-2xl bg-black/20 p-3 ring-1 ring-white/10">
                                    <div className="text-xs text-zinc-400">
                                      Context
                                    </div>
                                    <div className="mt-1 text-xs text-zinc-200">
                                      file: {activeOverviewAlert.file_id} · source:{" "}
                                      {activeOverviewAlert.source_id}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="text-sm text-zinc-400">
                              Select an alert to see details.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveNav("corrections")}
                          className="rounded-2xl bg-gradient-to-r from-cyan-500/80 via-sky-500/80 to-indigo-500/80 px-5 py-3 text-sm font-semibold text-black ring-1 ring-white/10"
                        >
                          Open Review &amp; Fix
                        </motion.button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setActiveNav("mapping")}
                          className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-semibold text-zinc-100 ring-1 ring-white/20 hover:bg-white/15"
                        >
                          Open Field Matching
                        </motion.button>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              ) : activeNav === "sources" ? (
                <div className="mt-2">
                  <SourcesPanel
                    selectedSourceId={selectedSourceId}
                    selectedFileId={selectedFileId}
                    onSelectSource={setSelectedSourceId}
                    onSelectFile={setSelectedFileId}
                  />
                </div>
              ) : activeNav === "mapping" ? (
                <div className="mt-2">
                  <MappingPanel
                    selectedSourceId={selectedSourceId}
                    selectedFileId={selectedFileId}
                  />
                </div>
              ) : activeNav === "quality" ? (
                <div className="mt-2">
                  <QualityPanel selectedSourceId={selectedSourceId} />
                </div>
              ) : activeNav === "corrections" ? (
                <div className="mt-2">
                  <CorrectionsPanel />
                </div>
              ) : activeNav === "system" ? (
                <div className="mt-2">
                  <SystemDiagnosticsPanel
                    health={health}
                    contractVersion={contractVersion}
                    apiError={apiError}
                    overviewError={overviewError}
                  />
                </div>
              ) : null}
            </motion.section>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

