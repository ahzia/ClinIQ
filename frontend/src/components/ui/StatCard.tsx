import type { ReactNode } from "react";

import GlassCard from "./GlassCard";

export default function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <GlassCard className="p-5">
      <div className="flex items-start gap-3">
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-sky-300 ring-1 ring-white/10">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium text-zinc-200">{label}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-3xl font-semibold tracking-tight text-white">
              {value}
            </div>
          </div>
          {hint ? (
            <div className="mt-1 text-sm text-zinc-300">{hint}</div>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}

