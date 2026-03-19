"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Server } from "lucide-react";

import GlassCard from "../ui/GlassCard";
import { apiGet } from "@/lib/api";

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

type RuntimeConfigResponse = {
  case_link_window_hours: number;
  identity_conflict_high_threshold: number;
  processed_db_path: string;
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "/api/v1";

export default function SystemDiagnosticsPanel({
  health,
  contractVersion,
  apiError,
  overviewError,
}: {
  health: HealthResponse | null;
  contractVersion: ContractVersionResponse | null;
  apiError: string | null;
  overviewError: string | null;
}) {
  const [runtime, setRuntime] = useState<RuntimeConfigResponse | null>(null);
  const [runtimeErr, setRuntimeErr] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    apiGet<RuntimeConfigResponse>("/meta/runtime-config")
      .then((r) => {
        if (m) {
          setRuntime(r);
          setRuntimeErr(null);
        }
      })
      .catch((e) => {
        if (m) {
          setRuntime(null);
          setRuntimeErr(
            e instanceof Error ? e.message : "Could not load runtime config."
          );
        }
      });
    return () => {
      m = false;
    };
  }, []);

  const online = !apiError && health?.status === "ok";

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-semibold text-zinc-100">System</div>

      <GlassCard className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-100">
              API &amp; backend
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              {apiError ? apiError : "Connected"}
            </div>
            {overviewError ? (
              <div className="mt-3 text-xs font-semibold text-rose-200">
                Overview KPI load: {overviewError}
              </div>
            ) : null}
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
          >
            <div
              className={`h-2.5 w-2.5 rounded-full shadow-[0_0_18px_rgba(52,211,153,0.45)] ${
                online ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
            <div className="text-sm font-semibold text-zinc-100">
              {online ? "Online" : "Offline"}
            </div>
          </motion.div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-xs text-zinc-400">Service</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">
              {health?.service ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-xs text-zinc-400">Version / environment</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">
              {health ? `${health.version} · ${health.env}` : "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-xs text-zinc-400">Contract version</div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">
              {contractVersion?.contract_version ?? "—"}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
            <div className="text-xs text-zinc-400">API base (browser)</div>
            <div className="mt-1 break-all text-sm font-semibold text-zinc-100">
              {API_BASE_URL}
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-cyan-200" />
          <div className="text-sm font-semibold text-zinc-100">
            Runtime configuration
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Values returned by <code className="text-zinc-300">/meta/runtime-config</code>.
          Useful when explaining linking windows, AI toggles, and storage paths.
        </p>
        {runtimeErr ? (
          <div className="mt-4 text-xs text-amber-200">{runtimeErr}</div>
        ) : runtime ? (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs text-zinc-400">Case link window</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                {runtime.case_link_window_hours} hours
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs text-zinc-400">Identity conflict threshold</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                {runtime.identity_conflict_high_threshold}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs text-zinc-400">AI</div>
              <div className="mt-1 text-sm font-semibold text-zinc-100">
                {runtime.ai_enabled
                  ? `${runtime.ai_provider} · ${runtime.ai_model}`
                  : "Disabled"}
              </div>
            </div>
            <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
              <div className="text-xs text-zinc-400">Processed DB path</div>
              <div className="mt-1 break-all text-xs font-semibold text-zinc-200">
                {runtime.processed_db_path}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 text-sm text-zinc-500">Loading…</div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
            <Server className="h-4 w-4 text-zinc-300" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100">Request IDs</div>
            <div className="mt-1 text-xs text-zinc-400">
              Check <code className="text-zinc-300">X-Request-ID</code> on API responses
              (DevTools → Network).
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
