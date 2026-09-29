import type { PickerProps, Selection } from "../types";

/** A heading that options are shown together under. */
export interface PickerGroup {
  label: string;
  color?: string;
  /** Muted text beside the heading, e.g. "event attributes". */
  caption?: string;
}

/** One choice of a picker. */
export interface PickerOption<T> {
  value: T;
  /** What the reader sees. Unique within the option's group. */
  label: string;
  /** Muted text beside the label in the dropdown, e.g. a value type. */
  description?: string;
  count?: number;
  color?: string;
  group?: PickerGroup;
}

/** Everything the presentational pickers need, beyond the options. */
export type OptionPickerProps<T> = PickerProps &
  Selection<T> & {
    options: readonly PickerOption<T>[];
    /** Stable identity of a value. Defaults to the value itself for strings,
     * else its JSON. */
    idOf?: (value: T) => string;
    /** Label of a picked value that is not among the options, as with ids a
     * search no longer turns up. Defaults to its id. */
    labelOf?: (value: T) => string;
    loading?: boolean;
    error?: unknown;
    /** Set when a choice has to be made elsewhere first, and says which. */
    missing?: string;
    /** Server-side search: the options are what `search` turns up, and the
     * picker only reports what the reader types. */
    search?: string;
    onSearch?: (search: string) => void;
  };

export const defaultIdOf = (value: unknown) =>
  typeof value === "string" ? value : JSON.stringify(value);

/** The picked values, however the caller holds them. */
export const pickedValues = <T>(selection: Selection<T>): T[] =>
  selection.multiple
    ? [...selection.value]
    : selection.value == null
      ? []
      : [selection.value];

/** Report values back as the one value, or the list, the caller asked for. */
export const report = <T>(selection: Selection<T>, values: T[]) => {
  if (selection.multiple) selection.onChange(values);
  else selection.onChange(values[0]);
};

/** Options in groups, in first-seen order. Ungrouped options form one group. */
export const groupOptions = <T>(options: readonly PickerOption<T>[]) => {
  const groups = new Map<
    string,
    { group?: PickerGroup; options: PickerOption<T>[] }
  >();
  for (const option of options) {
    const key = option.group?.label ?? "";
    const entry = groups.get(key) ?? { group: option.group, options: [] };
    entry.options.push(option);
    groups.set(key, entry);
  }
  return [...groups.values()];
};

export const sortOptions = <T>(
  options: readonly PickerOption<T>[],
  sort: "count" | "name",
) =>
  [...options].sort((a, b) =>
    sort === "name"
      ? a.label.localeCompare(b.label)
      : (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label),
  );
