import type { ReactNode } from "react";

/**
 * Non-intrusive helper for unavoidable terms — uses native tooltip (title).
 */
export function HelpHint({
  label,
  hint,
  className = "",
}: {
  label: ReactNode;
  hint: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{label}</span>
      <span
        className="inline-flex h-4 min-w-[1rem] cursor-help items-center justify-center rounded-full bg-white/10 px-0.5 text-[10px] font-bold leading-none text-zinc-400 ring-1 ring-white/15"
        title={hint}
        aria-label={hint}
        role="img"
      >
        ?
      </span>
    </span>
  );
}
