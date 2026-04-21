import { create } from "zustand";

const persisted = JSON.parse(window.localStorage.getItem("heartbeat-auth") || "null");

export const useAuthStore = create((set) => ({
  accessToken: persisted?.accessToken || "",
  refreshToken: persisted?.refreshToken || "",
  user: persisted?.user || null,
  setSession: (session) => {
    const next = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user
    };
    window.localStorage.setItem("heartbeat-auth", JSON.stringify(next));
    set(next);
  },
  clearSession: () => {
    window.localStorage.removeItem("heartbeat-auth");
    set({ accessToken: "", refreshToken: "", user: null });
  }
}));
