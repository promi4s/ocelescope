import { CloseButton, Paper } from "@mantine/core";
import type { ReactNode } from "react";

export interface HistogramDrillDownPanelProps {
  children: ReactNode;
  onClose: () => void;
}

/**
 * Generic container the standard Histogram wraps around consumer-provided
 * drill-down content. Owns the close affordance and outer Paper chrome so the
 * lifecycle and look stay consistent across consumers.
 */
export function HistogramDrillDownPanel({
  children,
  onClose,
}: HistogramDrillDownPanelProps) {
  return (
    <Paper withBorder p="md" radius="md" pos="relative">
      <CloseButton
        onClick={onClose}
        size="sm"
        pos="absolute"
        top={8}
        right={8}
        aria-label="Close drill-down"
        style={{ zIndex: 1 }}
      />
      {children}
    </Paper>
  );
}
