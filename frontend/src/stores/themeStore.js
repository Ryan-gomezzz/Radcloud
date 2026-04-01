import { create } from "zustand";

const STORAGE_KEY = "radcloud_theme";

function applyTheme(mode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
}

export const useThemeStore = create((set, get) => ({
  theme: "dark",

  hydrate: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        applyTheme(stored);
        set({ theme: stored });
        return;
      }
    } catch {
      /* ignore */
    }
    applyTheme("dark");
    set({ theme: "dark" });
  },

  setTheme: (mode) => {
    if (mode !== "light" && mode !== "dark") return;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
    applyTheme(mode);
    set({ theme: mode });
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));
