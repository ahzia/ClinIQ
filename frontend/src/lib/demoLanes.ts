/**
 * Demo narrative: classify files into validation "lanes" for overview (no backend field).
 * Aligns with hackathon demo files (German names, checkdata, etc.).
 */
export type DemoLaneKey =
  | "baseline"
  | "error_detection"
  | "mapping_robustness"
  | "validation_package";

/** `description` is tooltip-only in the UI to save space. */
export const DEMO_LANE_LABELS: Record<
  DemoLaneKey,
  { title: string; description: string }
> = {
  baseline: { title: "Baseline", description: "Clean reference uploads" },
  error_detection: {
    title: "Error detection",
    description: "Files with known test issues",
  },
  mapping_robustness: {
    title: "Mapping stress",
    description: "Tricky structures for matching",
  },
  validation_package: {
    title: "Validation",
    description: "Checkdata / validation scenarios",
  },
};

export function inferDemoLaneFromFileName(fileName: string): DemoLaneKey | null {
  const n = fileName.toLowerCase();
  if (n.includes("checkdata") || n.includes("validation")) {
    return "validation_package";
  }
  if (n.includes("ohne") || n.includes("ohne_fehler")) {
    return "baseline";
  }
  if (
    n.includes("mit_fehl") ||
    n.includes("fehlern") ||
    n.includes("error")
  ) {
    return "error_detection";
  }
  if (n.includes("split")) {
    return "mapping_robustness";
  }
  return null;
}

export function countFilesByDemoLane(
  files: { name: string }[]
): Record<DemoLaneKey, number> {
  const counts: Record<DemoLaneKey, number> = {
    baseline: 0,
    error_detection: 0,
    mapping_robustness: 0,
    validation_package: 0,
  };
  for (const f of files) {
    const lane = inferDemoLaneFromFileName(f.name);
    if (lane) counts[lane] += 1;
  }
  return counts;
}
