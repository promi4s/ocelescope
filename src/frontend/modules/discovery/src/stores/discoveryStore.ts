import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FilterEntry } from "../types";

type OcelFormState = {
  selectedMethodId: string | null;
  formDataByMethod: Partial<Record<string, Record<string, unknown>>>;
  filters: FilterEntry[];
};

const EMPTY: OcelFormState = {
  selectedMethodId: null,
  formDataByMethod: {},
  filters: [],
};

type DiscoveryState = {
  byOcel: Record<string, OcelFormState>;
  setSelectedMethodId: (ocelId: string, methodId: string | null) => void;
  setFormData: (
    ocelId: string,
    methodId: string,
    data: Record<string, unknown>,
  ) => void;
  setFilters: (ocelId: string, filters: FilterEntry[]) => void;
};

const updateOcel = (
  state: DiscoveryState,
  ocelId: string,
  patch: Partial<OcelFormState>,
): Pick<DiscoveryState, "byOcel"> => ({
  byOcel: {
    ...state.byOcel,
    [ocelId]: { ...(state.byOcel[ocelId] ?? EMPTY), ...patch },
  },
});

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set) => ({
      byOcel: {},
      setSelectedMethodId: (ocelId, methodId) =>
        set((s) => updateOcel(s, ocelId, { selectedMethodId: methodId })),
      setFormData: (ocelId, methodId, data) =>
        set((s) => {
          const current = s.byOcel[ocelId] ?? EMPTY;
          return updateOcel(s, ocelId, {
            formDataByMethod: { ...current.formDataByMethod, [methodId]: data },
          });
        }),
      setFilters: (ocelId, filters) =>
        set((s) => updateOcel(s, ocelId, { filters })),
    }),
    { name: "ocelescope:discovery" },
  ),
);

export const selectOcelFormState =
  (ocelId: string) =>
  (s: DiscoveryState): OcelFormState =>
    s.byOcel[ocelId] ?? EMPTY;
