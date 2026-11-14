import axios from "axios";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
});

const TOKEN_KEY = "job-lifecycle.token";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setStoredToken(null);
      // The TV board is public and must never bounce to /login — a stale
      // token left on that kiosk browser shouldn't be able to kick it off.
      const publicPath = ["/login", "/board"].some((p) => window.location.pathname.startsWith(p));
      if (!publicPath) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** The error message the API sent back (`{ error }`), or `fallback` when there isn't one. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return axios.isAxiosError<{ error?: string }>(err) ? err.response?.data?.error ?? fallback : fallback;
}
