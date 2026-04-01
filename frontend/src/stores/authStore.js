import { create } from "zustand";
import { API_BASE, authHeaders } from "../api";

const USER_KEY = "radcloud_user";
const TOKEN_KEY = "radcloud_token";

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  hydrate: async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { ...authHeaders() },
        });
        if (res.ok) {
          const user = await res.json();
          localStorage.setItem(USER_KEY, JSON.stringify(user));
          set({ user, isAuthenticated: true });
          return;
        }
      }
    } catch {
      /* fall through to local user */
    }
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) {
        const user = JSON.parse(raw);
        set({ user, isAuthenticated: true });
      }
    } catch {
      /* ignore */
    }
  },

  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Login failed (${res.status})`);
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    set({ user: data.user, isAuthenticated: true });
  },

  signup: async (name, email, password, company) => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        company: company || undefined,
        cloud_environments: [],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Signup failed (${res.status})`);
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    set({ user: data.user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null, isAuthenticated: false });
  },
}));
