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
import { apiGet } from "@/lib/api";

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
  selectedSourceId,
  selectedFileId,
  onSelectSource,
  onSelectFile,
}: {
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

  const [previewRowLimit, setPreviewRowLimit] = useState(5);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  const [leftTab, setLeftTab] = useState<"sources" | "files">("sources");
  const [rightTab, setRightTab] = useState<"preview" | "schema">("preview");

  const [showAllSources, setShowAllSources] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [s, f] = await Promise.all([
          apiGet<SourcesResponse>("/sources"),
          apiGet<FilesResponse>("/files"),
        ]);
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
  }, []);

  // Default selection once loaded
  useEffect(() => {
    if (!sources?.sources?.length) return;
    if (!selectedSourceId) {
      onSelectSource(sources.sources[0].id);
      setLeftTab("files");
    }
  }, [sources, selectedSourceId, onSelectSource]);

  useEffect(() => {
    // Reset "show more" states when switching between sources/files panels.
    setShowAllSources(false);
    setShowAllFiles(false);
  }, [leftTab]);

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
      onSelectSource(selectedFile.source_id);
    }
  }, [files, selectedSourceId, selectedFileId, onSelectSource, onSelectFile]);

  // Preview/details for selected file
  useEffect(() => {
    let mounted = true;
    async function run() {
      if (!selectedFileId) {
        setFileDetails(null);
        setPreview(null);
        return;
      }

      setPreviewLoading(true);
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
      } catch {
        if (!mounted) return;
        setFileDetails(null);
        setPreview(null);
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

  const shownSources = useMemo(() => {
    if (showAllSources) return filteredSources;
    return filteredSources.slice(0, 5);
  }, [filteredSources, showAllSources]);

  const shownFiles = useMemo(() => {
    if (showAllFiles) return filesForSelectedSource;
    return filesForSelectedSource.slice(0, 5);
  }, [filesForSelectedSource, showAllFiles]);

  const sourcesCanExpand = filteredSources.length > 5;
  const filesCanExpand = filesForSelectedSource.length > 5;

  const selectedRisk =
    selectedSourceId && files?.files
      ? getSourceRisk(files.files, selectedSourceId)
      : { tone: "neutral", text: "—" };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            Source Explorer
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            Select a source and file to inspect inferred schema, mapping trust,
            and previewed canonical fields.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <TonePill
              tone="neutral"
              text={`Sources: ${sources?.sources?.length ?? 0}`}
            />
            <TonePill
              tone="neutral"
              text={`Files: ${files?.files?.length ?? 0}`}
            />
            {selectedFileId ? (
              <TonePill tone="good" text={`Selected file: ${selectedFileId}`} />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedSourceId ? (
            <TonePill tone={selectedRisk.tone} text={selectedRisk.text} />
          ) : null}
          <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <Search className="h-4 w-4 text-cyan-200" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search sources..."
              className="w-52 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <GlassCard className="p-5">
        <div className="min-w-0 flex flex-col gap-4 lg:flex-row lg:items-stretch">
          {/* Left: sources/files */}
          <div className="lg:w-[380px]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-200" />
                <div className="text-sm font-semibold text-zinc-100">Library</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLeftTab("sources")}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                    leftTab === "sources"
                      ? "bg-white/10 ring-white/20 text-zinc-100"
                      : "bg-white/5 ring-white/10 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Sources
                </button>
                <button
                  type="button"
                  onClick={() => setLeftTab("files")}
                  className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                    leftTab === "files"
                      ? "bg-white/10 ring-white/20 text-zinc-100"
                      : "bg-white/5 ring-white/10 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Files
                </button>
              </div>
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
              ) : leftTab === "sources" ? (
                <div
                  className={`pr-1 ${
                    showAllSources
                      ? "max-h-[520px] overflow-y-auto"
                      : "max-h-[360px] overflow-y-hidden"
                  }`}
                >
                  {shownSources.length ? (
                    <div className="flex flex-col gap-2">
                      {shownSources.map((s, idx) => {
                        const isActive = s.id === selectedSourceId;
                        const risk = getSourceRisk(files?.files ?? null, s.id);
                        return (
                          <motion.button
                            key={s.id}
                            type="button"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25, delay: idx * 0.02 }}
                            onClick={() => {
                              onSelectSource(s.id);
                              setLeftTab("files");
                            }}
                            className={`rounded-2xl p-4 text-left ring-1 transition ${
                              isActive
                                ? "bg-white/10 ring-white/20"
                                : "bg-white/5 ring-white/10 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-zinc-100">
                                  {s.label}
                                </div>
                                <div className="mt-1 text-xs text-zinc-400">
                                  {s.notes ?? "—"}
                                </div>
                              </div>
                              <div className="shrink-0">
                                <TonePill tone={risk.tone} text={risk.text} />
                                <div className="mt-2 text-center text-[11px] text-zinc-400">
                                  {s.file_count} files
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 text-xs font-medium text-cyan-200">
                              {formatFormats(s.formats)}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                      No sources match your search.
                    </div>
                  )}
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

              {leftTab === "sources" && sourcesCanExpand ? (
                <div className="mt-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowAllSources((v) => !v)}
                    className="w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    {showAllSources ? "Show less" : "Show more"}
                  </motion.button>
                </div>
              ) : null}

              {leftTab === "files" && filesCanExpand ? (
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
                  File inspection
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
                  Schema
                </button>
              </div>
            </div>

            {!selectedFileId ? (
              <div className="mt-4 rounded-2xl bg-white/5 p-6 text-sm text-zinc-400 ring-1 ring-white/10">
                Select a file to inspect.
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
                          <div className="text-xs text-zinc-400">Schema inference</div>
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
                          <div className="text-sm font-semibold text-zinc-100">Mapping trust</div>
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
                          <div className="text-sm font-semibold text-zinc-100">Quality signals</div>
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
                          <div className="text-xs text-zinc-400">Preview kind</div>
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

