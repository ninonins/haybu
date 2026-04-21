import { useAuthStore } from "../store/auth.js";

export const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

let refreshPromise = null;

async function refreshSession() {
  const { refreshToken, setSession, clearSession } = useAuthStore.getState();
  if (!refreshToken) {
    clearSession();
    throw new Error("Session expired");
  }

  if (!refreshPromise) {
    refreshPromise = fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ refreshToken })
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || "Session expired");
        }
        return response.json();
      })
      .then((session) => {
        setSession(session);
        return session;
      })
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiFetch(path, options = {}) {
  const token = useAuthStore.getState().accessToken;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && token && path !== "/auth/login" && path !== "/auth/refresh") {
    await refreshSession();
    const retryToken = useAuthStore.getState().accessToken;
    const retryHeaders = {
      ...headers,
      ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {})
    };
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: retryHeaders
    });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }

  if (response.headers.get("content-type")?.includes("text/csv")) {
    return response.text();
  }

  return response.json();
}

export async function bootstrapSession() {
  const { hydrateSession, markHydrated, accessToken, user, updateUser, clearSession } = useAuthStore.getState();
  hydrateSession();
  const state = useAuthStore.getState();

  if (!state.accessToken && !state.refreshToken) {
    markHydrated();
    return;
  }

  try {
    if (state.accessToken) {
      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          Authorization: `Bearer ${state.accessToken}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.user) {
          updateUser(data.user);
        }
        markHydrated();
        return;
      }
    }

    const session = await refreshSession();
    if (session?.user) {
      updateUser(session.user);
    }
  } catch {
    clearSession();
  } finally {
    markHydrated();
  }
}
