import { keepPreviousData } from "@tanstack/react-query";
import { useRegisterView } from "../api/base";
import type { NativeFilter } from "../types/filter";

export type ViewParams = { view_id: string } | { ocel_version: "original" };

const ORIGINAL: ViewParams = { ocel_version: "original" };

export const useView = (
  ocelId: string,
  steps: NativeFilter[],
): ViewParams | undefined => {
  const { data } = useRegisterView(ocelId, steps, undefined, {
    query: { placeholderData: keepPreviousData, staleTime: Infinity },
  });
  if (data === undefined) {
    return undefined;
  }
  return data === null ? ORIGINAL : { view_id: data };
};
