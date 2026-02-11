import { create } from "zustand";
import { persist } from "zustand/middleware";
import { env } from "../lib/env";

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
    // TODO: Get this from the enviroment varibales
    { name: env.current_ocel_id },
  ),
);

export default useCurrentOcelStore;
