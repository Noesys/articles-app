/**
 * Auth is isolated behind one interface so the Cloudflare Access setup can be
 * added later without touching the tools.
 *
 * Local dev: the API (wrangler dev, ENVIRONMENT=development or wrangler's
 * [access.dev] identity) trusts the local session, so no credentials are sent.
 *
 * Production: Cloudflare Access sits in front of the API. Requests need either a
 * service token (CF-Access-Client-Id / CF-Access-Client-Secret) or an Access JWT.
 * The API's resolveAccessUser still has to accept whichever one is used, so verify
 * that before relying on it.
 */
import type { Config } from "./config.js";

export interface AuthProvider {
  readonly name: string;
  headers(): Record<string, string>;
}

export class DevAuthProvider implements AuthProvider {
  readonly name = "dev";
  headers(): Record<string, string> {
    return {};
  }
}

export class CloudflareAccessAuthProvider implements AuthProvider {
  readonly name = "access";

  constructor(private readonly clientId: string, private readonly clientSecret: string) {}

  headers(): Record<string, string> {
    return {
      "CF-Access-Client-Id": this.clientId,
      "CF-Access-Client-Secret": this.clientSecret,
    };
  }
}

export function createAuthProvider(config: Config): AuthProvider {
  if (config.authMode === "dev") return new DevAuthProvider();

  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("MCP_AUTH_MODE=access requires CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET");
  }
  return new CloudflareAccessAuthProvider(id, secret);
}
