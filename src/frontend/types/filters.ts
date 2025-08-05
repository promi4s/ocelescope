import { OCELFilter } from "@/api/fastapi-schemas";

export type Filter = OCELFilter;

export type FilterType = keyof OCELFilter;

export type FilterConfigByType<T extends FilterType> = Filter[T];
