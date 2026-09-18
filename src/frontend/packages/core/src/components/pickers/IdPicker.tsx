import { MultiSelect, Select } from "@mantine/core";
import type { Selection } from "./types";

export interface IdPickerProps {
  /** The ids to offer. Usually a page of them, from a search. */
  ids: readonly string[];
  label?: string;
  placeholder?: string;
  /** What the reader has typed, when the caller searches for them. */
  search?: string;
  onSearch?: (search: string) => void;
  loading?: boolean;
  emptyText?: string;
  disabled?: boolean;
}

/**
 * Picking ids by typing.
 *
 * Presentational: a log holds far more events and objects than a list can
 * show, so the caller decides which ids a search turns up.
 */
export const IdPicker = ({
  ids,
  label,
  placeholder = "Search…",
  search,
  onSearch,
  loading = false,
  emptyText,
  disabled,
  ...selection
}: IdPickerProps & Selection) => {
  // Whatever is chosen stays in the list even when a search hides it.
  const picked = selection.multiple
    ? [...selection.value]
    : selection.value
      ? [selection.value]
      : [];
  const shared = {
    size: "xs" as const,
    label,
    placeholder,
    searchable: true,
    disabled,
    data: [...new Set([...ids, ...picked])],
    searchValue: search,
    onSearchChange: onSearch,
    nothingFoundMessage:
      emptyText ?? (loading ? "Searching…" : "Nothing found"),
  };

  return selection.multiple ? (
    <MultiSelect
      {...shared}
      value={picked}
      onChange={selection.onChange}
      clearable
    />
  ) : (
    <Select
      {...shared}
      value={picked[0] ?? null}
      onChange={(next) => selection.onChange(next ?? undefined)}
    />
  );
};
