import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { tokenStore } from "../auth/authStore";

/**
 * Set this in Vercel (and optionally in local frontend/.env):
 * VITE_API_URL=https://smart-asset-backend.onrender.com
 *
 * If your backend is mounted under /api already, DO NOT add /api here.
 * Your calls already include /api/... like "/api/auth/refresh/".
 */
function normalizeBaseURL(url: string) {
  // remove trailing slashes to avoid double slashes when calling "/api/.."
  return url.replace(/\/+$/, "");
}

const baseURL = normalizeBaseURL(
  (import.meta.env.VITE_API_URL as string | undefined) || "http://127.0.0.1:8000"
);

export const api = axios.create({
  baseURL,
  // optional but nice: avoid hanging forever
  timeout: 30000,
});

// Separate client without interceptors for refresh
const raw = axios.create({
  baseURL,
  timeout: 30000,
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// If your backend expects "JWT <token>" instead of "Bearer <token>",
// change Bearer to JWT here.
const AUTH_SCHEME = "Bearer";

function setAuthHeader(config: InternalAxiosRequestConfig, accessToken: string) {
  const value = `${AUTH_SCHEME} ${accessToken}`;

  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }

  if (config.headers instanceof AxiosHeaders) {
    config.headers.set("Authorization", value);
    return;
  }

  (config.headers as Record<string, string>)["Authorization"] = value;
}

api.interceptors.request.use((config) => {
  const tokens = tokenStore.get();
  if (tokens?.access) setAuthHeader(config, tokens.access);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<unknown>) => {
    const cfg = error.config as RetryConfig | undefined;
    if (!cfg) return Promise.reject(error);

    if (error.response?.status === 401 && !cfg._retry) {
      cfg._retry = true;

      const tokens = tokenStore.get();
      const refresh = tokens?.refresh;

      if (refresh) {
        try {
          // Your backend refresh endpoint already includes /api in the path
          const r = await raw.post("/api/auth/refresh/", { refresh });
          const newAccess = (r.data as { access?: string }).access;

          if (newAccess) {
            tokenStore.set({ access: newAccess, refresh });
            setAuthHeader(cfg, newAccess);
            return api.request(cfg);
          }
        } catch {
          // refresh failed, fall through to logout
        }
      }

      tokenStore.clear();
      window.location.assign("/login");
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
