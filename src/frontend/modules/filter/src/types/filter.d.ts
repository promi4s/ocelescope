import type { ComponentType } from "react";
import type { getFilter } from "../api/base";

export type NativeFilter = NonNullable<
  Awaited<ReturnType<typeof getFilter>>
>[number];

export type FilterKey = NonNullable<NativeFilter["type"]>;

export type FilterOf<T extends FilterKey> = Extract<NativeFilter, { type: T }>;

export type Pipeline = { steps: NativeFilter[] };

export type FilterPanel<T extends FilterKey> = ComponentType<{
  ocelId: string;
  filter: FilterOf<T>;
  onChange: (filter: FilterOf<T>) => void;
  /** The complete steps before this one: the panel shows the log as they leave it. */
  before: NativeFilter[];
}>;

export type FilterKind<T extends FilterKey> = {
  title: string;
  description: string;
  Panel: FilterPanel<T>;
  create: () => FilterOf<T>;
  summary: (filter: FilterOf<T>) => string;
  isComplete: (filter: FilterOf<T>) => boolean;
};
