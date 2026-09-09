// middleware/accessAuth.ts
import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv, ResolveResult } from "../types/shared-types";
import { findUserByEmail, createUser } from "../services/user/users";

function nameFromEmail(email: string): string {
  return email.split("@")[0] || "User";
}

/* resolve name from cloudflare access */
async function resolveAccessName(c: Context<AppEnv>): Promise<string | null> {
  if (c.executionCtx.access) {
    const identity = await c.executionCtx.access.getIdentity();
    if (identity?.name) {
      return identity.name.trim();
    }
  }

  const assertion = c.req.header("Cf-Access-Jwt-Assertion");
  const teamDomain = (c.env.CF_ACCESS_TEAM_DOMAIN ?? "").replace(/\/$/, "");
  const aud = c.env.CF_ACCESS_AUD;

  if (assertion && teamDomain && aud) {
    try {
      const JWKS = createRemoteJWKSet(
        new URL(`${teamDomain}/cdn-cgi/access/certs`),
      );
      const { payload } = await jwtVerify(assertion, JWKS, {
        issuer: teamDomain,
        audience: aud,
      });
      const p = payload as Record<string, unknown>;
      if (typeof p.name === "string" && p.name.trim()) return p.name.trim();
      const given = typeof p.given_name === "string" ? p.given_name : "";
      const family = typeof p.family_name === "string" ? p.family_name : "";
      if (given || family) return `${given} ${family}`.trim();
    } catch {
      // ignore — fall through to null
    }
  }

  return null;
}

/**
 * Resolve email from Cloudflare Access.
 * Prefer ctx.access (Worker Access without static-asset router gap).
 * Fall back to Cf-Access-Jwt-Assertion — required when Static Assets sit
 * behind Cloudflare's internal router, which does not forward ctx.access.
 */
async function resolveAccessEmail(c: Context<AppEnv>): Promise<string | null> {
  if (c.executionCtx.access) {
    const identity = await c.executionCtx.access.getIdentity();
    if (identity?.email) {
      return identity.email.trim().toLowerCase();
    }
  }

  const assertion = c.req.header("Cf-Access-Jwt-Assertion");
  const teamDomain = (c.env.CF_ACCESS_TEAM_DOMAIN ?? "").replace(/\/$/, "");
  const aud = c.env.CF_ACCESS_AUD;

  if (assertion && teamDomain && aud) {
    try {
      const JWKS = createRemoteJWKSet(
        new URL(`${teamDomain}/cdn-cgi/access/certs`),
      );
      const { payload } = await jwtVerify(assertion, JWKS, {
        issuer: teamDomain,
        audience: aud,
      });
      if (typeof payload.email === "string" && payload.email) {
        return payload.email.trim().toLowerCase();
      }
    } catch (err) {
      console.error("[accessAuth] JWT verification failed:", err);
      // fall through to header / other paths
    }
  }

  // Cloudflare strips client-sent Cf-Access-* headers and sets them at the edge.
  // Safe to use when an Access JWT assertion is also present on the request.
  const headerEmail = c.req.header("Cf-Access-Authenticated-User-Email");
  if (headerEmail && assertion) {
    return headerEmail.trim().toLowerCase();
  }

  if (c.env.ENVIRONMENT === "development" && c.env.DEV_USER_MAIL) {
    return c.env.DEV_USER_MAIL.trim().toLowerCase();
  }

  return null;
}

export async function resolveAccessUser(
  c: Context<AppEnv>,
): Promise<ResolveResult> {
  const hasAccessContext = Boolean(c.executionCtx.access);
  const hasAssertion = Boolean(c.req.header("Cf-Access-Jwt-Assertion"));

  if (!hasAccessContext && !hasAssertion) {
    // Local wrangler access.dev injects ctx.access; without it and without JWT → deny
    if (c.env.ENVIRONMENT === "development" && c.env.DEV_USER_MAIL) {
      // allow resolveAccessEmail to use DEV_USER_MAIL below
    } else {
      return { ok: false, status: 403, message: "Access required" };
    }
  }

  const email = await resolveAccessEmail(c);

  if (!email) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: No Access identity",
    };
  }

  let user = await findUserByEmail(c.env.DB, email);

  if (!user) {
    const allowedDomain = c.env.ALLOWED_EMAIL_DOMAIN;
    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      return {
        ok: false,
        status: 403,
        message: "Forbidden: Domain not allowlisted",
      };
    }
    await createUser(c.env.DB, {
      id: "usr_" + crypto.randomUUID(),
      email,
      name: (await resolveAccessName(c)) || nameFromEmail(email),
      auth_role: "user",
      job_role: "",
      created_at: new Date().toISOString(),
      created_by: null,
      is_active: 1,
    });
    user = await findUserByEmail(c.env.DB, email);
  }

  if (!user || user.is_active !== 1) {
    return { ok: false, status: 403, message: "Forbidden: Account inactive" };
  }

  return { ok: true, user };
}

export async function accessAuth(c: Context<AppEnv>, next: Next) {
  const result = await resolveAccessUser(c);
  if (!result.ok) {
    return c.json({ success: false, message: result.message }, result.status);
  }
  c.set("user", result.user);
  return await next();
}
