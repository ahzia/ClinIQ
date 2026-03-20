"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Search,
  Sparkles,
  Database,
  ListChecks,
  Code2,
} from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet, apiPost } from "@/lib/api";

type Source = {
  id: string;
  label: string;
  file_count: number;
  formats: string[];
  notes?: string;
};

type SourcesResponse = {
  sources: Source[];
  totals?: {
    files_seen: number;
    csv: number;
    xlsx: number;
    pdf: number;
    docs: number;
  };
};

type FileItem = {
  id: string;
  name: string;
  source_id: string;
  format: string;
  status: "imported" | "processing" | "failed";
  mapping_status:
    | "mapped"
    | "mapped_with_warnings"
    | "needs_review"
    | "failed";
  quality_status: "clean" | "mixed" | "unknown";
  rows_estimate: number;
};

type FilesResponse = {
  files: FileItem[];
  summary: {
    imported_files: number;
    successful_mappings: number;
    mappings_with_warnings: number;
    failed_mappings: number;
    needs_review: number;
  };
};

type DemoLoadResponse = {
  loaded_files: number;
  missing_directories: string[];
  notes: string[];
};

type FileDetailsResponse = {
  file: {
    id: string;
    name: string;
    path: string;
    format: string;
    source_id: string;
    imported_at: string;
    status: string;
  };
  inference: {
    delimiter: string;
    encoding: string;
    header_confidence: number;
    detected_schema_variant: string;
  };
  mapping: {
    status: string;
    auto_mapped_fields: number;
    needs_review_fields: number;
    confidence_overview: { high: number; medium: number; low: number };
  };
  quality: {
    status: string;
    missing_required_keys: number;
    anomalies: number;
    notes: string[];
  };
};

type FilePreviewResponse = {
  file_id: string;
  kind: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  notes: string[];
};

function formatFormats(formats: string[]) {
  return formats.map((f) => f.toUpperCase()).join(" · ");
}

function statusTone(status: string) {
  if (status === "mapped" || status === "clean") return "good";
  if (status === "mapped_with_warnings" || status === "mixed") return "warn";
  if (status === "needs_review") return "neutral";
  if (status === "failed") return "bad";
  return "neutral";
}

function TonePill({ tone, text }: { tone: string; text: string }) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/20"
      : tone === "bad"
      ? "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/20"
      : "bg-white/5 text-zinc-200 ring-1 ring-white/10";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>
      {text}
    </span>
  );
}

/** Heuristic validation / data-lane tag for demo narrative (no backend field required). */
function inferDataLane(fileName: string): { label: string; tone: string } | null {
  const n = fileName.toLowerCase();
  if (n.includes("checkdata") || n.includes("validation")) {
    return { label: "Validation lane", tone: "good" };
  }
  if (n.includes("ohne") || n.includes("ohne_fehler")) {
    return { label: "Baseline", tone: "good" };
  }
  if (n.includes("mit_fehl") || n.includes("fehlern") || n.includes("error")) {
    return { label: "Error test", tone: "bad" };
  }
  if (n.includes("split")) {
    return { label: "Mapping test", tone: "warn" };
  }
  return null;
}

function getSourceRisk(files: FileItem[] | null, sourceId: string) {
  const list = (files ?? []).filter((f) => f.source_id === sourceId);
  const anyFailed = list.some((f) => f.mapping_status === "failed");
  if (anyFailed) return { tone: "bad", text: "High risk" };
  const anyReview = list.some((f) => f.mapping_status === "needs_review");
  if (anyReview) return { tone: "neutral", text: "Needs review" };
  const anyWarn = list.some((f) => f.mapping_status === "mapped_with_warnings");
  if (anyWarn) return { tone: "warn", text: "Warnings" };
  return { tone: "good", text: "Low risk" };
}

export default function SourcesPanel({
  selectedDemoLane,
  onChangeDemoLane,
  selectedSourceId,
  selectedFileId,
  onSelectSource,
  onSelectFile,
}: {
  selectedDemoLane: "all" | "error_heavy" | "expected_pass";
  onChangeDemoLane: (lane: "all" | "error_heavy" | "expected_pass") => void;
  selectedSourceId: string | null;
  selectedFileId: string | null;
  onSelectSource: (id: string) => void;
  onSelectFile: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<SourcesResponse | null>(null);
  const [files, setFiles] = useState<FilesResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fileDetails, setFileDetails] = useState<FileDetailsResponse | null>(null);
  const [preview, setPreview] = useState<FilePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [previewRowLimit, setPreviewRowLimit] = useState(5);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  const [rightTab, setRightTab] = useState<"preview" | "schema">("preview");

  const [showAllFiles, setShowAllFiles] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        let [s, f] = await Promise.all([
          apiGet<SourcesResponse>(
            selectedDemoLane === "all"
              ? "/sources"
              : `/sources?demo_lane=${selectedDemoLane}`
          ),
          apiGet<FilesResponse>(
            selectedDemoLane === "all"
              ? "/files"
              : `/files?demo_lane=${selectedDemoLane}`
          ),
        ]);
        if (
          selectedDemoLane !== "all" &&
          (f.files?.length ?? 0) === 0 &&
          mounted
        ) {
          await apiPost<DemoLoadResponse, Record<string, never>>(
            "/demo/load-two-sources",
            {}
          );
          [s, f] = await Promise.all([
            apiGet<SourcesResponse>(`/sources?demo_lane=${selectedDemoLane}`),
            apiGet<FilesResponse>(`/files?demo_lane=${selectedDemoLane}`),
          ]);
        }
        if (!mounted) return;
        setSources(s);
        setFiles(f);
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load sources/files.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [selectedDemoLane]);

  // Keep selected source valid for current lane/filter.
  useEffect(() => {
    if (!sources?.sources?.length) return;
    const exists = selectedSourceId
      ? sources.sources.some((s) => s.id === selectedSourceId)
      : false;
    if (!exists) {
      onSelectSource(sources.sources[0].id);
    }
  }, [sources, selectedSourceId, onSelectSource]);

  const filteredSources = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sources?.sources ?? [];
    if (!q) return list;
    return list.filter((s) => {
      return (
        s.label.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q) ||
        formatFormats(s.formats).toLowerCase().includes(q)
      );
    });
  }, [sources, query]);

  const filesForSelectedSource = useMemo(() => {
    const all = files?.files ?? [];
    if (!selectedSourceId) return all;
    return all.filter((f) => f.source_id === selectedSourceId);
  }, [files, selectedSourceId]);

  // Ensure selected file belongs to selected source
  useEffect(() => {
    if (!selectedSourceId) return;
    const all = files?.files ?? [];
    if (!all.length) return;

    const selectedFile =
      selectedFileId ? all.find((f) => f.id === selectedFileId) ?? null : null;
    if (!selectedFile) {
      const first = all.find((f) => f.source_id === selectedSourceId) ?? null;
      if (first) onSelectFile(first.id);
      return;
    }
    if (selectedFile.source_id !== selectedSourceId) {
      const first = all.find((f) => f.source_id === selectedSourceId) ?? null;
      if (first) onSelectFile(first.id);
    }
  }, [files, selectedSourceId, selectedFileId, onSelectSource, onSelectFile]);

  // Preview/details for selected file
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!selectedFileId) {
        setFileDetails(null);
        setPreview(null);
        setPreviewError(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewRowLimit(5);
      setShowAllRows(false);
      setShowAllNotes(false);
      try {
        const [details, p] = await Promise.all([
          apiGet<FileDetailsResponse>(`/files/${selectedFileId}`),
          apiGet<FilePreviewResponse>(`/files/${selectedFileId}/preview`),
        ]);
        if (!mounted) return;
        setFileDetails(details);
        setPreview(p);
        setPreviewError(null);
      } catch (e) {
        if (!mounted) return;
        setFileDetails(null);
        setPreview(null);
        setPreviewError(
          e instanceof Error ? e.message : "Failed to load file details or preview."
        );
      } finally {
        if (mounted) setPreviewLoading(false);
      }
    }
    run();
    return () => {
      mounted = false;
    };
  }, [selectedFileId]);

  const shownRows = useMemo(() => {
    if (!preview) return [];
    if (showAllRows) return preview.rows;
    return preview.rows.slice(0, previewRowLimit);
  }, [preview, showAllRows, previewRowLimit]);

  const shownFiles = useMemo(() => {
    if (showAllFiles) return filesForSelectedSource;
    return filesForSelectedSource.slice(0, 5);
  }, [filesForSelectedSource, showAllFiles]);

  const filesCanExpand = filesForSelectedSource.length > 5;

  const selectedRisk =
    selectedSourceId && files?.files
      ? getSourceRisk(files.files, selectedSourceId)
      : { tone: "neutral", text: "—" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-base font-semibold text-zinc-100">
            Browse your data
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <TonePill
              tone="neutral"
              text={`Sources: ${sources?.sources?.length ?? 0}`}
            />
            <TonePill
              tone="neutral"
              text={`Files: ${files?.files?.length ?? 0}`}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
            <label className="text-xs text-zinc-400">Dataset</label>
            <select
              value={selectedDemoLane}
              onChange={(e) =>
                onChangeDemoLane(e.target.value as "all" | "error_heavy" | "expected_pass")
              }
              className="ml-2 bg-transparent text-sm text-zinc-100"
            >
              <option value="all">All demo data</option>
              <option value="error_heavy">Error-heavy dataset</option>
              <option value="expected_pass">Expected-pass dataset</option>
            </select>
          </div>
          {selectedSourceId ? (
            <TonePill tone={selectedRisk.tone} text={selectedRisk.text} />
          ) : null}
          <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-cyan-200" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search data sources..."
              className="w-52 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="min-w-0 flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* Left: files for selected source */}
          <div className="lg:w-[380px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-200" />
                <div className="text-sm font-semibold text-zinc-100">Files</div>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs text-zinc-400">Data source</label>
              <select
                value={selectedSourceId ?? ""}
                onChange={(e) => onSelectSource(e.target.value)}
                className="select-premium mt-2 w-full px-4 py-3 text-sm text-zinc-100"
              >
                {filteredSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/20">
                  {error}
                </div>
              ) : (
                <div
                  className={`pr-1 ${
                    showAllFiles
                      ? "max-h-[520px] overflow-y-auto"
                      : "max-h-[360px] overflow-y-hidden"
                  }`}
                >
                  {shownFiles.length ? (
                    <div className="flex flex-col gap-2">
                      {shownFiles.map((f) => {
                        const isActive = f.id === selectedFileId;
                        const mappingTone = statusTone(f.mapping_status);
                        const qualityTone = statusTone(f.quality_status);
                        const lane = inferDataLane(f.name);
                        return (
                          <motion.button
                            key={f.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => onSelectFile(f.id)}
                            className={`rounded-2xl bg-white/5 p-4 text-left ring-1 transition ${
                              isActive
                                ? "ring-white/20 bg-white/10"
                                : "ring-white/10 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-zinc-100">
                                  {f.name}
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                  {f.format.toUpperCase()} · ~{f.rows_estimate} rows
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {lane ? (
                                <TonePill tone={lane.tone} text={lane.label} />
                              ) : null}
                              <TonePill
                                tone={mappingTone}
                                text={f.mapping_status.replace(/_/g, " ")}
                              />
                              <TonePill
                                tone={qualityTone}
                                text={f.quality_status}
                              />
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                      No files for this source.
                    </div>
                  )}
                </div>
              )}
              {filesCanExpand ? (
                <div className="mt-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAllFiles((v) => !v)}
                    className="w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    {showAllFiles ? "Show less" : "Show more"}
                  </motion.button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: preview + schema */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                <div className="text-sm font-semibold text-zinc-100">
                  File details
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRightTab("preview")}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                    rightTab === "preview"
                      ? "bg-white/10 ring-white/20 text-zinc-100"
                      : "bg-white/5 ring-white/10 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setRightTab("schema")}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                    rightTab === "schema"
                      ? "bg-white/10 ring-white/20 text-zinc-100"
                      : "bg-white/5 ring-white/10 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Structure
                </button>
              </div>
            </div>

            {!selectedFileId ? (
              <div className="mt-4 rounded-2xl bg-white/5 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
                Select a file to inspect.
              </div>
            ) : previewError && !previewLoading ? (
              <div className="mt-4 space-y-3 rounded-2xl bg-rose-500/10 p-4 ring-1 ring-rose-400/25">
                <div className="text-sm font-semibold text-rose-100">
                  Could not load file preview
                </div>
                <div className="text-xs text-rose-200/90">{previewError}</div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!selectedFileId) return;
                    setPreviewError(null);
                    setPreviewLoading(true);
                    Promise.all([
                      apiGet<FileDetailsResponse>(`/files/${selectedFileId}`),
                      apiGet<FilePreviewResponse>(`/files/${selectedFileId}/preview`),
                    ])
                      .then(([details, p]) => {
                        setFileDetails(details);
                        setPreview(p);
                        setPreviewError(null);
                      })
                      .catch((e) => {
                        setPreviewError(
                          e instanceof Error ? e.message : "Retry failed."
                        );
                        setFileDetails(null);
                        setPreview(null);
                      })
                      .finally(() => setPreviewLoading(false));
                  }}
                  className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-semibold text-zinc-100 ring-1 ring-white/20 hover:bg-white/15"
                >
                  Retry load
                </motion.button>
              </div>
            ) : rightTab === "schema" ? (
              <div className="mt-4 space-y-4">
                {previewLoading || !fileDetails ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    <GlassCard className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-400">Detected format</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {fileDetails.inference.detected_schema_variant}
                          </div>
                          <div className="mt-2 text-xs text-zinc-400">
                            Header confidence:{" "}
                            <span className="font-semibold text-zinc-100">
                              {Math.round(fileDetails.inference.header_confidence * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                            <div className="text-[11px] text-zinc-400">Delimiter</div>
                            <div className="mt-1 text-sm font-semibold text-cyan-200">
                              {fileDetails.inference.delimiter === " "
                                ? "space"
                                : fileDetails.inference.delimiter}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                            <div className="text-[11px] text-zinc-400">Encoding</div>
                            <div className="mt-1 text-sm font-semibold text-cyan-200">
                              {fileDetails.inference.encoding}
                            </div>
                          </div>
                        </div>
                      </div>
                    </GlassCard>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <GlassCard className="p-4">
                        <div className="flex items-center gap-2">
                          <ListChecks className="h-4 w-4 text-cyan-200" />
                          <div className="text-sm font-semibold text-zinc-100">Match quality</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <TonePill
                            tone="good"
                            text={`Auto-mapped: ${fileDetails.mapping.auto_mapped_fields}`}
                          />
                          <TonePill
                            tone={
                              fileDetails.mapping.needs_review_fields ? "warn" : "good"
                            }
                            text={`Needs review: ${fileDetails.mapping.needs_review_fields}`}
                          />
                        </div>
                        <div className="mt-3 text-xs text-zinc-400">
                          Status:{" "}
                          <span className="font-semibold text-zinc-100">
                            {fileDetails.mapping.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </GlassCard>

                      <GlassCard className="p-4">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-cyan-200" />
                          <div className="text-sm font-semibold text-zinc-100">Data health checks</div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <TonePill
                            tone={fileDetails.quality.missing_required_keys ? "warn" : "good"}
                            text={`Missing keys: ${fileDetails.quality.missing_required_keys}`}
                          />
                          <TonePill
                            tone={fileDetails.quality.anomalies ? "warn" : "good"}
                            text={`Anomalies: ${fileDetails.quality.anomalies}`}
                          />
                        </div>
                        <div className="mt-3 text-xs text-zinc-400">
                          Notes:{" "}
                          <span className="font-semibold text-zinc-100">
                            {fileDetails.quality.notes.length}
                          </span>
                        </div>
                      </GlassCard>
                    </div>

                    {fileDetails.quality.notes.length ? (
                      <GlassCard className="p-4">
                        <div className="flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-cyan-200" />
                          <div className="text-sm font-semibold text-zinc-100">Quality notes</div>
                        </div>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-300">
                          {fileDetails.quality.notes.slice(0, 6).map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </GlassCard>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {previewLoading || !preview ? (
                  <div className="space-y-3">
                    <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
                    <div className="h-[220px] animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
                    <div className="h-16 animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10" />
                  </div>
                ) : (
                  <>
                    <GlassCard className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-400">Data type</div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {preview.kind}
                          </div>
                          <div className="mt-1 text-xs text-zinc-400">
                            Columns: {preview.columns.length}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <TonePill
                            tone="neutral"
                            text={showAllRows ? "All rows" : `${previewRowLimit} rows`}
                          />
                        </div>
                      </div>
                    </GlassCard>

                    <div className="min-w-0 rounded-2xl ring-1 ring-white/10">
                      <div
                        className={`max-h-[420px] w-full max-w-full overflow-x-auto overflow-y-auto ${
                          showAllRows ? "" : "overflow-y-hidden"
                        }`}
                      >
                        <table className="min-w-max border-separate border-spacing-0">
                          <thead className="bg-white/5">
                            <tr>
                              {preview.columns.map((c) => (
                                <th
                                  key={c}
                                  className="sticky top-0 z-10 border-b border-white/10 px-3 py-3 text-left text-xs font-semibold text-zinc-200 whitespace-nowrap"
                                >
                                  {c}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {shownRows.map((row, i) => (
                              <tr
                                key={i}
                                className={`${
                                  i % 2 === 0 ? "bg-white/0" : "bg-white/3"
                                } hover:bg-white/7 transition-colors`}
                              >
                                {preview.columns.map((c) => (
                                  <td
                                    key={c}
                                    className="border-b border-white/10 px-3 py-2 text-xs text-zinc-300 whitespace-nowrap"
                                  >
                                    {String((row as Record<string, unknown>)[c] ?? "—")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {preview.rows.length > previewRowLimit ? (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setShowAllRows((v) => !v)}
                          className="rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                        >
                          {showAllRows ? "Show less" : "Show more"}
                        </motion.button>
                      ) : null}

                      <div className="text-xs text-zinc-400">
                        {showAllRows
                          ? `Showing all ${preview.rows.length} rows`
                          : `Showing first ${previewRowLimit} rows`}
                      </div>
                    </div>

                    {preview.notes.length ? (
                      <GlassCard className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs text-zinc-400">Notes</div>
                            <div className="mt-1 text-sm font-semibold text-zinc-100">
                              Dataset context
                            </div>
                          </div>
                          {preview.notes.length > 3 ? (
                            <button
                              type="button"
                              onClick={() => setShowAllNotes((v) => !v)}
                              className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                            >
                              {showAllNotes ? "Show less" : "Show all notes"}
                            </button>
                          ) : null}
                        </div>
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-300">
                          {(showAllNotes ? preview.notes : preview.notes.slice(0, 3)).map(
                            (n, i) => (
                              <li key={i}>{n}</li>
                            )
                          )}
                        </ul>
                      </GlassCard>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

