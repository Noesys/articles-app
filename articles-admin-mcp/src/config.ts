
export type AuthMode = "dev" | "access";

export interface Config {
  apiBaseUrl: string;
  authMode: AuthMode;
  maxInlineImages: number;
  maxImageBytes: number;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function loadConfig(): Config {
  const mode = (process.env.MCP_AUTH_MODE ?? "dev") as AuthMode;
  if (mode !== "dev" && mode !== "access") {
    throw new Error(`MCP_AUTH_MODE must be "dev" or "access", got "${mode}"`);
  }

  return {
    apiBaseUrl: (process.env.ARTICLE_API_URL ?? "http://localhost:8787").replace(/\/$/, ""),
    authMode: mode,
    maxInlineImages: num(process.env.MAX_INLINE_IMAGES, 5),
    maxImageBytes: num(process.env.MAX_IMAGE_BYTES, 2_000_000),
  };
}
