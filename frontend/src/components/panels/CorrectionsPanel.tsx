"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ShieldX,
  PencilLine,
  AlertTriangle,
  X,
} from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type CorrectionItem = {
  id: string;
  file_id: string;
  source_id: string;
  source_field: string;
  suggested_target: string;
  confidence: number;
  status: "pending_review" | "accepted" | "rejected" | "edited";
  reason: string;
};

type CorrectionsQueueResponse = {
  queue: CorrectionItem[];
  summary: {
    pending_review: number;
    accepted_today: number;
    rejected_today: number;
  };
};

type CorrectionActionRequest = {
  comment: string | null;
  apply_as_rule?: boolean;
  target_override?: string | null;
};

type CorrectionActionResponse = {
  id: string;
  status: "pending_review" | "accepted" | "rejected" | "edited";
  updated_at: string;
  message: string;
};

function StatusPill({ tone, text }: { tone: string; text: string }) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/20"
      : tone === "warn"
      ? "bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-400/20"
      : tone === "bad"
      ? "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/20"
      : "bg-white/5 text-zinc-200 ring-1 ring-white/10";

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs ${cls}`}>
      {text}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 0.8 * 100 ? "good" : pct >= 0.6 * 100 ? "warn" : "bad";

  const bar =
    tone === "good"
      ? "bg-emerald-400/80"
      : tone === "warn"
      ? "bg-amber-400/80"
      : "bg-rose-400/75";

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-zinc-400">Confidence</div>
        <div className="text-[11px] font-semibold text-zinc-100">{pct}%</div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full ${bar}`}
        />
      </div>
    </div>
  );
}

type DialogState =
  | null
  | {
      mode: "approve";
      item: CorrectionItem;
    }
  | {
      mode: "reject";
      item: CorrectionItem;
    }
  | {
      mode: "edit";
      item: CorrectionItem;
    };

export default function CorrectionsPanel({
  selectedSourceId,
  selectedDemoLane,
}: {
  selectedSourceId: string | null;
  selectedDemoLane: "all" | "error_heavy" | "expected_pass";
}) {
  const [queue, setQueue] = useState<CorrectionsQueueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [queueFilter, setQueueFilter] = useState<
    "all" | "pending_review" | "low_confidence" | "accepted" | "rejected"
  >("all");

  const [dialog, setDialog] = useState<DialogState>(null);
  const [comment, setComment] = useState("");
  const [applyAsRule, setApplyAsRule] = useState(true);
  const [targetOverride, setTargetOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (selectedSourceId) query.set("source_id", selectedSourceId);
      if (selectedDemoLane !== "all") query.set("demo_lane", selectedDemoLane);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const res = await apiGet<CorrectionsQueueResponse>(`/corrections/queue${suffix}`);
      setQueue(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load corrections.");
    } finally {
      setLoading(false);
    }
  }, [selectedSourceId, selectedDemoLane]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pending = queue?.summary.pending_review ?? 0;

  const allQueue = queue?.queue ?? [];
  const prioritizedQueue = [...allQueue].sort((a, b) => {
    return b.confidence - a.confidence;
  });
  const filteredQueue = prioritizedQueue.filter((item) => {
    if (queueFilter === "pending_review") return item.status === "pending_review";
    if (queueFilter === "accepted") return item.status === "accepted";
    if (queueFilter === "rejected") return item.status === "rejected";
    if (queueFilter === "low_confidence") return item.confidence < 0.6;
    return true;
  });
  const visibleQueue = queueExpanded ? filteredQueue : filteredQueue.slice(0, 5);
  const showQueueToggle = filteredQueue.length > 5;

  function openApprove(item: CorrectionItem) {
    setComment("");
    setApplyAsRule(true);
    setTargetOverride("");
    setSubmitError(null);
    setDialog({ mode: "approve", item });
  }

  function openReject(item: CorrectionItem) {
    setComment("");
    setApplyAsRule(false);
    setTargetOverride("");
    setSubmitError(null);
    setDialog({ mode: "reject", item });
  }

  function openEdit(item: CorrectionItem) {
    setComment("");
    setApplyAsRule(false);
    setTargetOverride(item.suggested_target);
    setSubmitError(null);
    setDialog({ mode: "edit", item });
  }

  async function submit() {
    if (!dialog) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const c = comment.trim();
      const body: CorrectionActionRequest = {
        comment: c ? c : null,
        apply_as_rule: dialog.mode === "approve" ? applyAsRule : undefined,
        target_override: dialog.mode === "edit" ? targetOverride.trim() : undefined,
      };

      if (dialog.mode === "approve") {
        await apiPost<CorrectionActionResponse, CorrectionActionRequest>(
          `/corrections/${dialog.item.id}/approve`,
          body
        );
      } else if (dialog.mode === "reject") {
        await apiPost<CorrectionActionResponse, CorrectionActionRequest>(
          `/corrections/${dialog.item.id}/reject`,
          body
        );
      } else {
        await apiPatch<CorrectionActionResponse, CorrectionActionRequest>(
          `/corrections/${dialog.item.id}`,
          body
        );
      }

      setDialog(null);
      setSubmitting(false);
      await refresh();
    } catch (e) {
      setSubmitting(false);
      setSubmitError(e instanceof Error ? e.message : "Action failed.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-100">
            Review &amp; fix
          </div>
        </div>
        <StatusPill tone="warn" text={`${pending} pending review`} />
      </div>

      <GlassCard className="p-4">
        <div className="text-sm font-semibold text-zinc-100">epaAC dictionary context</div>
        <div className="mt-2 text-xs text-zinc-400">
          Reserved for IID/SID → human-readable labels and dictionary coverage when the API adds
          optional fields. Reviewer flow stays unchanged; no backend changes required for this
          placeholder.
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 w-full animate-pulse rounded-2xl bg-white/5 ring-1 ring-white/10"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/20">
            {error}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-100">
                  Items waiting for review
                </div>
                <button
                  type="button"
                  onClick={() => setQueueFilter("all")}
                  className="rounded-2xl bg-white/5 px-3 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                >
                  Reset filter
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { id: "all", label: `All (${allQueue.length})` },
                  {
                    id: "pending_review",
                    label: `Pending (${allQueue.filter((i) => i.status === "pending_review").length})`,
                  },
                  {
                    id: "low_confidence",
                    label: `Low confidence (${allQueue.filter((i) => i.confidence < 0.6).length})`,
                  },
                  {
                    id: "accepted",
                    label: `Accepted (${allQueue.filter((i) => i.status === "accepted").length})`,
                  },
                  {
                    id: "rejected",
                    label: `Rejected (${allQueue.filter((i) => i.status === "rejected").length})`,
                  },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() =>
                      setQueueFilter(
                        f.id as
                          | "all"
                          | "pending_review"
                          | "low_confidence"
                          | "accepted"
                          | "rejected"
                      )
                    }
                    className={`rounded-2xl px-3 py-2 text-xs font-semibold ring-1 transition ${
                      queueFilter === f.id
                        ? "bg-white/10 text-zinc-100 ring-white/20"
                        : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div
                className={`mt-3 space-y-3 ${
                  queueExpanded ? "max-h-[520px] overflow-y-auto pr-1" : ""
                }`}
              >
                {filteredQueue.length ? (
                  visibleQueue.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: idx * 0.03 }}
                      className={`rounded-2xl bg-white/5 p-4 ring-1 ${
                        item.confidence < 0.6
                          ? "ring-amber-400/35"
                          : "ring-white/10"
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusPill
                                tone={
                                  item.status === "pending_review"
                                    ? "neutral"
                                    : item.status === "accepted"
                                    ? "good"
                                    : item.status === "rejected"
                                    ? "bad"
                                    : "warn"
                                }
                                text={item.status.replace(/_/g, " ")}
                              />
                              <span className="text-[11px] text-zinc-500">
                                id: {item.id}
                              </span>
                            </div>
                            <div className="mt-2 text-sm font-semibold text-zinc-100">
                              {item.source_field} {" > "} {item.suggested_target}
                            </div>
                            <div className="mt-1 text-xs text-zinc-400">
                              file: {item.file_id} · source: {item.source_id}
                            </div>
                            <div className="mt-2 text-xs text-zinc-400">
                              {item.reason}
                            </div>
                          </div>
                        </div>

                        <ConfidenceBar value={item.confidence} />

                        <div className="flex flex-wrap items-center gap-2">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => openApprove(item)}
                            className="rounded-2xl bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 ring-1 ring-emerald-400/20 hover:bg-emerald-500/25"
                          >
                            <CheckCircle2 className="mr-2 inline h-4 w-4" />
                            Approve
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => openReject(item)}
                            className="rounded-2xl bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-200 ring-1 ring-rose-400/20 hover:bg-rose-500/25"
                          >
                            <ShieldX className="mr-2 inline h-4 w-4" />
                            Reject
                          </motion.button>
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.98 }}
                            onClick={() => openEdit(item)}
                            className="rounded-2xl bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-400/20 hover:bg-cyan-500/25"
                          >
                            <PencilLine className="mr-2 inline h-4 w-4" />
                            Edit
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-white/5 p-4 text-sm text-zinc-400 ring-1 ring-white/10">
                    No corrections for this filter.
                  </div>
                )}
              </div>

              {showQueueToggle ? (
                <div className="mt-3">
                  <motion.button
                    type="button"
                    onClick={() => setQueueExpanded((v) => !v)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-2xl bg-white/5 px-4 py-2 text-xs font-semibold text-cyan-200 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    {queueExpanded ? "Show less" : `Show all (${filteredQueue.length})`}
                  </motion.button>
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-5">
              <div className="text-sm font-semibold text-zinc-100">
                Today summary
              </div>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-zinc-400">Pending review</div>
                  <div className="mt-2 text-xl font-semibold text-zinc-100">
                    {queue?.summary.pending_review ?? 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-zinc-400">Accepted today</div>
                  <div className="mt-2 text-xl font-semibold text-emerald-200">
                    {queue?.summary.accepted_today ?? 0}
                  </div>
                </div>
                <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <div className="text-xs text-zinc-400">Rejected today</div>
                  <div className="mt-2 text-xl font-semibold text-rose-200">
                    {queue?.summary.rejected_today ?? 0}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-400 ring-1 ring-white/10">
                <AlertTriangle className="mr-2 inline h-3.5 w-3.5 text-amber-200" />
                Approvals can be saved as reusable rules.
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      <AnimatePresence>
        {dialog ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-lg rounded-3xl bg-zinc-950 p-5 ring-1 ring-white/10 glass"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">
                    {dialog.mode === "approve"
                      ? "Approve suggestion"
                      : dialog.mode === "reject"
                      ? "Reject suggestion"
                      : "Choose a better field match"}
                  </div>
                  <div className="mt-2 text-xs text-zinc-400">
                    id: {dialog.item.id} · confidence:{" "}
                    {Math.round(dialog.item.confidence * 100)}%
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="rounded-2xl p-2 text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {dialog.mode === "edit" ? (
                  <div>
                    <div className="text-xs text-zinc-400">Preferred target field</div>
                    <input
                      value={targetOverride}
                      onChange={(e) => setTargetOverride(e.target.value)}
                      className="mt-2 w-full rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none"
                      placeholder="Enter standard field name"
                    />
                  </div>
                ) : null}

                <div>
                  <div className="text-xs text-zinc-400">
                    Reviewer comment (optional)
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="mt-2 w-full resize-none rounded-2xl bg-white/5 px-4 py-3 text-sm ring-1 ring-white/10 outline-none"
                    rows={3}
                    placeholder="e.g. Looks correct; apply as rule"
                  />
                </div>

                {dialog.mode === "approve" ? (
                  <label className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                    <span className="text-sm font-semibold text-zinc-100">
                      Use this fix for similar files
                    </span>
                    <input
                      type="checkbox"
                      checked={applyAsRule}
                      onChange={(e) => setApplyAsRule(e.target.checked)}
                    />
                  </label>
                ) : null}

                {submitError ? (
                  <div className="rounded-2xl bg-rose-500/10 p-3 text-xs text-rose-200 ring-1 ring-rose-400/20">
                    {submitError}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setDialog(null)}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 rounded-2xl bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-100 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    whileTap={{ scale: 0.98 }}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500/80 via-sky-500/80 to-indigo-500/80 px-4 py-3 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : "Confirm"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

