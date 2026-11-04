import type { UseView } from "@ocelescope/core";
import { keepPreviousData } from "@tanstack/react-query";
import { useRegisterView } from "../api/base";
import type { NativeFilter } from "../components/FilterViews";

export const useFilterView: UseView<NativeFilter> = (ocelId, steps) =>
  useRegisterView(ocelId, steps, undefined, {
    query: { placeholderData: keepPreviousData, staleTime: Infinity },
  }).data;
