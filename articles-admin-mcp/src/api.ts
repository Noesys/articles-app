import type { Config } from "./config.js";
import type { AuthProvider } from "./auth.js";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  data: T;
  pagination?: Pagination;
  message?: string;
}

/** Relative /api/... only — no schemes, no encoded dots, no `..`. */
const SAFE_API_PATH = /^\/api\/[A-Za-z0-9/_.-]+$/;

/** Matches article-api image route: USER_ID_RE + FILENAME_RE. */
const SAFE_IMAGE_PATH =
  /^\/api\/images\/[A-Za-z0-9_-]{1,64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

/** Thin read-only client for the article API. Every call goes through the API's own auth and role checks. */
export class ArticleApi {
  constructor(private readonly config: Config, private readonly auth: AuthProvider) {}

  /** Decode and validate a relative API path; reject traversal / absolute URLs. */
  private normalizePath(path: string): string {
    const raw = typeof path === "string" ? path.trim() : "";
    if (!raw.startsWith("/") || raw.includes("://") || /^[A-Za-z][A-Za-z0-9+.-]*:/i.test(raw)) {
      throw new ApiError(400, `Refusing unsafe API path: ${String(path).slice(0, 120)}`);
    }
    // Reject encoded dots before decode (`%2e%2e` → `..` after URL resolution).
    if (/%2e/i.test(raw) || raw.includes("..") || raw.includes("%") || raw.includes("\\")) {
      throw new ApiError(400, `Refusing unsafe API path: ${raw.slice(0, 120)}`);
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      throw new ApiError(400, `Refusing malformed API path: ${raw.slice(0, 120)}`);
    }
    if (decoded !== raw || decoded.includes("..") || !SAFE_API_PATH.test(decoded)) {
      throw new ApiError(400, `Refusing unsafe API path: ${raw.slice(0, 120)}`);
    }
    return decoded;
  }

  private url(path: string, query?: Record<string, string | number | undefined>): string {
    const safe = this.normalizePath(path);
    const base = this.config.apiBaseUrl.replace(/\/$/, "");
    const u = new URL(base + safe);
    // After URL resolution, pathname must still be under /api/ on the configured host.
    if (!u.pathname.startsWith("/api/") || u.pathname.includes("..")) {
      throw new ApiError(400, `Refusing resolved path outside /api/: ${u.pathname.slice(0, 120)}`);
    }
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  async getJson<T = unknown>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    const env = await this.getEnvelope<T>(path, query);
    return env.data;
  }

  /** Like getJson, but keeps pagination when the admin list endpoints return it. */
  async getEnvelope<T = unknown>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<ApiEnvelope<T>> {
    const res = await fetch(this.url(path, query), {
      headers: { Accept: "application/json", ...this.auth.headers() },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ApiError(res.status, `API ${res.status} on ${path}: ${text.slice(0, 300)}`);
    }
    let body: { data?: T; pagination?: Pagination; message?: string };
    try {
      body = JSON.parse(text) as { data?: T; pagination?: Pagination; message?: string };
    } catch {
      throw new ApiError(502, `API returned non-JSON on ${path}`);
    }
    return {
      data: body.data !== undefined ? body.data : (body as unknown as T),
      pagination: body.pagination,
      message: body.message,
    };
  }

  /** Fetches a binary image through the same auth. Strict path allowlist only. */
  async getBinary(path: string): Promise<{ data: Buffer; mimeType: string }> {
    const safe = this.normalizePath(path);
    if (!SAFE_IMAGE_PATH.test(safe)) {
      throw new ApiError(400, "getBinary only allows /api/images/<userId>/<uuid>.<ext>");
    }
    const res = await fetch(this.url(safe), { headers: this.auth.headers() });
    if (!res.ok) throw new ApiError(res.status, `Asset ${res.status} on ${safe}`);
    const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
    if (!mimeType.startsWith("image/")) {
      throw new ApiError(415, `Expected image, got ${mimeType}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { data: buf, mimeType };
  }
}
