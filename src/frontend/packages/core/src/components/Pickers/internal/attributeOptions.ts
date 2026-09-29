import type { TypedAttribute, ValueType } from "@ocelescope/api-base";
import type { PickerGroup, PickerOption } from "./options";

/**
 * Attributes as options: one per name, with its value types as description
 * and its distinct values as count.
 *
 * Without a type filter the endpoints return an attribute once per event or
 * object type that carries it, so "status" on two object types is merged.
 */
export const attributeOptions = <T>(
  attributes: readonly TypedAttribute[] | undefined,
  valueTypes: readonly ValueType[] | undefined,
  toValue: (name: string) => T,
  group?: PickerGroup,
): PickerOption<T>[] => {
  const merged = new Map<string, { types: Set<string>; count: number }>();
  for (const attribute of attributes ?? []) {
    if (valueTypes && !valueTypes.includes(attribute.type)) continue;
    const entry = merged.get(attribute.name) ?? { types: new Set(), count: 0 };
    entry.types.add(attribute.type);
    entry.count = Math.max(entry.count, attribute.distinct_values);
    merged.set(attribute.name, entry);
  }
  return [...merged].map(([name, { types, count }]) => ({
    value: toValue(name),
    label: name,
    description: [...types].join(", "),
    count,
    group,
  }));
};

/** Distinct values say how varied an attribute is, not how often it occurs,
 * so by default they neither sort the choices nor draw bars. */
export const attributeDefaults = {
  sort: "name",
  bars: false,
  counts: false,
} as const;
