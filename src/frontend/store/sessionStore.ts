import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionState {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),
    }),
    { name: "ocelescope-session-id" },
  ),
);

export default useSessionStore;
