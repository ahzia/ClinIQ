import type { PropsWithChildren } from "react";

import { cn } from "@/lib/cn";

export default function GlassCard({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("glass rounded-2xl", className)}>{children}</div>;
}

