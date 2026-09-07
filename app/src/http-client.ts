import { ApiResponse } from "./utils/types";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

const TOKEN_KEY = "auth:token";
const ROLE_KEY = "auth:role";

function decodePayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    // JWT is base64url — normalize before atob
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeRole(token: string): string | null {
  const p = decodePayload(token);
  const role = p?.["role"];
  return typeof role === "string" ? role : null;
}

function isExpired(token: string): boolean {
  const p = decodePayload(token);
  if (!p) return true;
  const exp = p["exp"];
  if (typeof exp !== "number") return true;
  return exp * 1000 <= Date.now();
}

export const tokenManager = {
  set: (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
    const r = decodeRole(token);
    if (r) localStorage.setItem(ROLE_KEY, r);
  },
  get: (): string | null => {
    // Single source of truth — legacy "token" fallback contained here
    // so callers never need `?? localStorage.getItem("token")`.
    return localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("token");
  },
  getRole: (): string | null => localStorage.getItem(ROLE_KEY),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem("token");
  },
  isExpired: (): boolean => {
    const t = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem("token");
    return !t || isExpired(t);
  },
};
// backward compat
export const tokenStorage = tokenManager;

export class ApiError extends Error {
  status: number;
  constructor(m: string, s: number) {
    super(m);
    this.name = "ApiError";
    this.status = s;
  }
}


function redirectToLogin(path: string) {
  tokenManager.clear();
  // Auth endpoints (otp/me) return 401 as part of normal unauthenticated flow
  // — must not trigger a navigation side-effect.
  const isAuthEndpoint =
    path.startsWith("/auth/otp") || path.startsWith("/auth/me");
  if (isAuthEndpoint) return;
  // Avoid hard reload (window.location.assign) which breaks SPA state and
  // causes infinite reload loops on mount. Soft-replace URL and let React
  // Router guards handle the redirect; dispatch popstate for listeners.
  if (window.location.pathname !== "/login") {
    window.history.replaceState(null, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}


async function fetchWithAuth<T>(
  path: string,
  options: RequestInit,
  full: true,
): Promise<ApiResponse<T>>;

async function fetchWithAuth<T>(
  path: string,
  options: RequestInit,
  full: false,
): Promise<T>;

async function fetchWithAuth<T>(
  path: string,
  options: RequestInit,
  full: boolean,
): Promise<T | ApiResponse<T>> {
  const token = tokenManager.get();
  const headers = new Headers(options.headers as HeadersInit | undefined);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Network error. Please check your connection.", 0);
  }
  // 401 before body parsing — ensure soft logout without hard reload
  if (res.status === 401) {
    let msg = "Session expired.";
    try {
      const errBody = (await res.clone().json()) as { message?: string };
      if (errBody?.message) msg = errBody.message;
    } catch {
      // non-JSON 401 body — keep default message
    }
    redirectToLogin(path);
    throw new ApiError(msg, 401);
  }
  if (res.status === 204) {
    return (
      full
        ? { success: true, data: undefined as unknown as T }
        : (undefined as unknown as T)
    ) as T | ApiResponse<T>;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      text || `Unexpected response (${res.status})`,
      res.status,
    );
  }
  const body = (await res.json()) as ApiResponse<T> & { message?: string };
  if (!res.ok) {
    throw new ApiError(
      body?.message || `Request failed (${res.status})`,
      res.status,
    );
  }
  return full ? (body as ApiResponse<T>) : (body as ApiResponse<T>).data;
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return fetchWithAuth<T>(path, options, false);
}
export async function apiFull<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  return fetchWithAuth<T>(path, options, true);
}
export { API_BASE };
export type { ApiResponse };
