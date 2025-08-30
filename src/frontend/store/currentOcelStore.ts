import { create } from "zustand";
import { persist } from "zustand/middleware";

type CurrentOcelStore = {
  ocelId: string | null;
  setOcel: (id: string) => void;
  clearOcel: () => void;
};

const useCurrentOcelStore = create<CurrentOcelStore>()(
  persist(
    (set) => ({
      ocelId: null,
      setOcel: (id) => set({ ocelId: id }),
      clearOcel: () => set({ ocelId: null }),
    }),
    { name: "current-ocel-id" },
  ),
);

export default useCurrentOcelStore;
