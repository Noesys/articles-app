import { ApiResponse } from "./utils/types";

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  constructor(m: string, s: number) {
    super(m);
    this.name = "ApiError";
    this.status = s;
  }
}

async function fetchWithAuth<T>(
  path: string,
  options: RequestInit,
  full: true,
): Promise<ApiResponse<T>>;

async function fetchWithAuth<T>(path: string, options: RequestInit, full: false): Promise<T>;

async function fetchWithAuth<T>(
  path: string,
  options: RequestInit,
  full: boolean,
): Promise<T | ApiResponse<T>> {
  const headers = new Headers(options.headers as HeadersInit | undefined);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("Network error. Please check your connection.", 0);
  }

  // 401 before body parsing — ensure soft logout without hard reload
  if (res.status === 401) {
    let msg = "Session expired.";
    try {
      const errBody = (await res.clone().json()) as { message?: string };
      if (errBody?.message) msg = errBody.message;
    } catch {}
    throw new ApiError(msg, 401);
  }

  if (res.status === 204) {
    return (
      full ? { success: true, data: undefined as unknown as T } : (undefined as unknown as T)
    ) as T | ApiResponse<T>;
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text().catch(() => "");
    throw new ApiError(text || `Unexpected response (${res.status})`, res.status);
  }
  const body = (await res.json()) as ApiResponse<T> & { message?: string };
  if (!res.ok) {
    throw new ApiError(body?.message || `Request failed (${res.status})`, res.status);
  }
  return full ? (body as ApiResponse<T>) : (body as ApiResponse<T>).data;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  return fetchWithAuth<T>(path, options, false);
}

export async function apiFull<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  return fetchWithAuth<T>(path, options, true);
}

export { API_BASE };
