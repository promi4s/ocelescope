import { NumberInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useState } from "react";

export interface HistogramSettingsProps {
  bins: number | null;
  onBinsChange: (bins: number | null) => void;
  /** Number of bins the autosizer picked, for placeholder. */
  autoBins: number | null;
}

const DEBOUNCE_MS = 400;

export function HistogramSettings({
  bins,
  onBinsChange,
  autoBins,
}: HistogramSettingsProps) {
  const [pending, setPending] = useState<number | null>(bins);
  const [debounced] = useDebouncedValue(pending, DEBOUNCE_MS);

  // Sync local pending with controlled bins when the parent changes them.
  useEffect(() => {
    setPending(bins);
  }, [bins]);

  // Commit debounced value back up.
  useEffect(() => {
    if (debounced === bins) return;
    onBinsChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const placeholder = autoBins != null ? `Auto (${autoBins})` : "Auto";

  return (
    <NumberInput
      label="Bins"
      description="Leave empty to auto-pick (Freedman-Diaconis)."
      size="xs"
      placeholder={placeholder}
      min={1}
      max={500}
      w={200}
      value={pending ?? ""}
      onChange={(v) => setPending(v === "" ? null : Number(v))}
    />
  );
}
