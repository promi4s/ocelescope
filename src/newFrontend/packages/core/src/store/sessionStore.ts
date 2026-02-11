import { create } from "zustand";
import { persist } from "zustand/middleware";
import { env } from "../lib/env";

type SessionState = {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
};

const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      setSessionId: (id) => set({ sessionId: id }),
    }),
    { name: env.session_id },
  ),
);

export default useSessionStore;
