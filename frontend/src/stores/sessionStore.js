import { create } from "zustand";
import { API_BASE, authHeaders } from "../api";

/**
 * Session lifecycle for cloud credential calls and pipeline actions.
 */
export const useSessionStore = create((set, get) => ({
  sessionId: null,
  planId: null,
  sessionPhase: "chat",

  setPlanId: (planId) => set({ planId }),
  updatePhase: (sessionPhase) => set({ sessionPhase }),

  createSession: async () => {
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const sid = data.session_id;
      if (sid) set({ sessionId: sid });
      return sid;
    } catch {
      return null;
    }
  },

  /** Ensure a session exists when the user is authenticated (JWT in localStorage). */
  ensureSession: async () => {
    const existing = get().sessionId;
    if (existing) return existing;
    const token =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("radcloud_token")
        : null;
    if (!token) return null;
    return get().createSession();
  },

  reset: () =>
    set({ sessionId: null, planId: null, sessionPhase: "chat" }),
}));
