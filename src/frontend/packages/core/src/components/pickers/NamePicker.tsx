import { Stack, Text } from "@mantine/core";
import { FrequencyPicker } from "@r4pm/components";
import { chosen, report, type Selection } from "./types";

/** A name to pick, and how often it occurs. */
export interface NameItem {
  key: string;
  count: number;
}

export interface NamePickerProps {
  /** Name to count, or the same as a list. */
  items: Record<string, number> | readonly NameItem[];
  label?: string;
  /** A search box above the list. */
  searchable?: boolean;
  /** A bar behind each name, as long as its share of the largest count. */
  bars?: boolean;
  /** The count itself, beside each name. */
  counts?: boolean;
  /** The rail that drags a cut through the list, taking the top names. */
  cutoff?: boolean;
  sort?: "count" | "name";
  /** Colour scope, so a name keeps the colour the viewers give it. */
  scope?: string;
  loading?: boolean;
  emptyText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Picking names out of a list, with what is known about how often each occurs.
 *
 * Presentational: it is handed the names and reports back what was picked.
 * `ActivityPicker` and the others wrap it around an endpoint.
 */
export const NamePicker = ({
  items,
  label,
  searchable = true,
  bars = true,
  counts = true,
  cutoff = false,
  sort = "count",
  scope = "name",
  loading = false,
  emptyText,
  disabled = false,
  autoFocus,
  ...selection
}: NamePickerProps & Selection) => (
  <Stack gap={4}>
    {label && (
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    )}
    <FrequencyPicker
      items={items as Record<string, number> | NameItem[]}
      mode={selection.multiple ? "multi" : "single"}
      value={chosen(selection)}
      onChange={(next) => !disabled && report(selection, next)}
      searchable={searchable}
      showBars={bars}
      showCounts={counts}
      showCutoff={cutoff}
      sort={sort}
      scope={scope}
      autoFocus={autoFocus}
      emptyText={emptyText ?? (loading ? "Reading the OCEL…" : "Nothing here")}
    />
  </Stack>
);
