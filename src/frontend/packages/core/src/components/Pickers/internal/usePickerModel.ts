import { useMemo } from "react";
import {
  defaultIdOf,
  groupOptions,
  type OptionPickerProps,
  type PickerOption,
  pickedValues,
  report,
  sortOptions,
} from "./options";

export interface PickedValue<T> {
  id: string;
  value: T;
  label: string;
  color?: string;
}

/** What both variants share: the options in order, and what is picked. */
export interface PickerModel<T> {
  options: PickerOption<T>[];
  idOf: (value: T) => string;
  multiple: boolean;
  picked: PickedValue<T>[];
  pickedIds: Set<string>;
  /** Replace the whole selection. */
  set: (values: T[]) => void;
  remove: (id: string) => void;
}

export const usePickerModel = <T>(
  props: OptionPickerProps<T>,
): PickerModel<T> => {
  const {
    options,
    sort = "count",
    idOf = defaultIdOf as (value: T) => string,
    labelOf,
  } = props;

  // Groups stay in the order they are given; options are sorted within them.
  const sorted = useMemo(
    () =>
      groupOptions(options).flatMap((group) =>
        sortOptions(group.options, sort),
      ),
    [options, sort],
  );
  const byId = useMemo(
    () => new Map(sorted.map((option) => [idOf(option.value), option])),
    [sorted, idOf],
  );

  const picked = pickedValues(props).map((value) => {
    const id = idOf(value);
    const option = byId.get(id);
    // A label need only be unique within its group, so a picked value names
    // its group too, as in "price (orders)".
    const label = option?.label ?? labelOf?.(value) ?? id;
    return {
      id,
      value,
      label: option?.group ? `${label} (${option.group.label})` : label,
      color: option?.color ?? option?.group?.color,
    };
  });
  const pickedIds = new Set(picked.map(({ id }) => id));

  const set = (values: T[]) => report(props, values);

  return {
    options: sorted,
    idOf,
    multiple: props.multiple === true,
    picked,
    pickedIds,
    set,
    remove: (id) =>
      set(picked.filter((entry) => entry.id !== id).map((p) => p.value)),
  };
};
