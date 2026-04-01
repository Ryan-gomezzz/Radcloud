import { create } from "zustand";

const STORAGE_KEY = "radcloud_user";

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        set({ user, isAuthenticated: true });
      }
    } catch {
      /* ignore */
    }
  },

  login: (email) => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = JSON.parse(stored);
      set({ user, isAuthenticated: true });
    } else {
      const user = {
        name: "Demo User",
        email,
        company: "Demo Company",
        id: crypto.randomUUID(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      set({ user, isAuthenticated: true });
    }
  },

  signup: (name, email, _password, company) => {
    const user = {
      name,
      email,
      company: company || "Company",
      id: crypto.randomUUID(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
