import type { ComponentType } from "react";
import type { getFilter } from "../api/base";

type NativeFilter = NonNullable<Awaited<ReturnType<typeof getFilter>>>[number];

type FilterKey = NonNullable<NativeFilter["type"]>;

type GroupedFilter = { [T in FilterKey]: Extract<NativeFilter, { type: T }>[] };

type FilterPairs = {
  [K in FilterKey]: [K, GroupedFilter[K]];
}[FilterKey];

export type FilterView<T extends FilterKey> = ComponentType<{
  ocelId: string;
  control: Control<GroupedFilter>;
}>;

export type FilterViewType<T extends FilterKey> = {
  title: string;
  ViewComponent: FilterView<T>;
  generateDefault: () => GroupedFilter[T];
  cleanUpFilters?: (filter: GroupedFilter[T]) => GroupedFilter[T];
};
