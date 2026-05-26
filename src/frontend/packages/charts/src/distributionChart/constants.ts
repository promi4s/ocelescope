import type { DistributionDisplayMode } from "./types";

export const MODE_OPTIONS: Array<{
  value: DistributionDisplayMode;
  label: string;
}> = [
  { value: "histogram", label: "Histogram" },
  { value: "kde", label: "KDE" },
  { value: "both", label: "Both" },
];
