import { create } from "zustand";

const STORAGE_KEY = "haybu-auth";

function readPersistedAuth() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function writePersistedAuth(value) {
  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export const useAuthStore = create((set, get) => ({
  accessToken: "",
  refreshToken: "",
  user: null,
  hydrated: false,
  hydrating: false,
  setSession: (session) => {
    const next = {
      accessToken: session.accessToken || "",
      refreshToken: session.refreshToken || "",
      user: session.user || null
    };
    writePersistedAuth(next);
    set(next);
  },
  clearSession: () => {
    writePersistedAuth(null);
    set({ accessToken: "", refreshToken: "", user: null });
  },
  hydrateSession: () => {
    const persisted = readPersistedAuth();
    set({
      accessToken: persisted?.accessToken || "",
      refreshToken: persisted?.refreshToken || "",
      user: persisted?.user || null,
      hydrated: true
    });
  },
  setHydrating: (hydating) => set({ hydrating: hydating }),
  markHydrated: () => set({ hydrated: true, hydrating: false }),
  updateUser: (user) => {
    const current = get();
    const next = {
      accessToken: current.accessToken,
      refreshToken: current.refreshToken,
      user
    };
    writePersistedAuth(next);
    set({ user });
  }
}));
