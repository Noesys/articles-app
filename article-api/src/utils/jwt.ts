import type { Bindings } from "../types";

const encoder = new TextEncoder();

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

function base64UrlToBytes(str: string): Uint8Array {
  const binary = base64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
};

async function getJwtKey(env: Bindings): Promise<CryptoKey> {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signJwt(
  env: Bindings,
  payload: Omit<JwtPayload, "iat" | "exp">
): Promise<string> {
  const key = await getJwtKey(env);
  const now = Math.floor(Date.now() / 1000);
  const body: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + 60 * 60 * 24 * 7,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadEncoded = base64UrlEncode(JSON.stringify(body));
  const data = `${headerEncoded}.${payloadEncoded}`;

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));

  return `${data}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJwt(
  env: Bindings,
  token: string
): Promise<JwtPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const key = await getJwtKey(env);
    const data = `${headerEncoded}.${payloadEncoded}`;

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signatureEncoded),
      encoder.encode(data)
    );

    if (!valid) {
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(payloadEncoded)) as JwtPayload;

    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}