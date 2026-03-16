import type { OCELFilter } from "@ocelescope/api-base";

export type Filter = OCELFilter;

export type FilterType = keyof OCELFilter;

export type FilterConfigByType<T extends FilterType> = Filter[T];
