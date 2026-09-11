// middleware/accessAuth.ts
import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv, ResolveResult } from "../types/shared-types";
import { findUserByEmail, createUser } from "../services/user/users";

function nameFromEmail(email: string): string {
  return email.split("@")[0] || "User";
}

/**
 * Resolve email, name, and job_role from Cloudflare Access.
 * Prefer ctx.access (Worker Access without static-asset router gap).
 * Fall back to Cf-Access-Jwt-Assertion — required when Static Assets sit
 * behind Cloudflare's internal router, which does not forward ctx.access.
 */
type AccessIdentity = {
  email: string;
  name: string | null;
  jobTitle: string | null;
};

async function resolveAccessIdentity(c: Context<AppEnv>): Promise<AccessIdentity | null> {
  if (c.executionCtx.access) {
    const identity = await c.executionCtx.access.getIdentity();
    if (identity?.email) {
      const oidc = (identity as any)?.oidc_fields;
      return {
        email: identity.email.trim().toLowerCase(),
        name: identity.name?.trim() || null,
        jobTitle: typeof oidc?.job_title === "string" ? oidc.job_title.trim() || null : null,
      };
    }
  }

  const assertion = c.req.header("Cf-Access-Jwt-Assertion");
  const teamDomain = (c.env.CF_ACCESS_TEAM_DOMAIN ?? "").replace(/\/$/, "");
  const aud = c.env.CF_ACCESS_AUD;

  if (assertion && teamDomain && aud) {
    try {
      const JWKS = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
      const { payload } = await jwtVerify(assertion, JWKS, {
        issuer: teamDomain,
        audience: aud,
      });
      if (typeof payload.email === "string" && payload.email) {
        const p = payload as Record<string, unknown>;
        const name =
          (typeof p.name === "string" && p.name) ||
          [p.given_name, p.family_name]
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .join(" ") ||
          null;
        const oidc = p.oidc_fields as Record<string, unknown> | undefined;
        const jobTitle = typeof oidc?.job_title === "string" ? oidc.job_title.trim() || null : null;

        return {
          email: payload.email.trim().toLowerCase(),
          name: name?.trim() || null,
          jobTitle,
        };
      }
    } catch (err) {
      console.error("[accessAuth] JWT verification failed:", err);
    }
  }

  const headerEmail = c.req.header("Cf-Access-Authenticated-User-Email");
  if (headerEmail && assertion) {
    return {
      email: headerEmail.trim().toLowerCase(),
      name: null,
      jobTitle: null,
    };
  }

  if (c.env.ENVIRONMENT === "development" && c.env.DEV_USER_MAIL) {
    return {
      email: c.env.DEV_USER_MAIL.trim().toLowerCase(),
      name: null,
      jobTitle: null,
    };
  }

  return null;
}

export async function resolveAccessUser(c: Context<AppEnv>): Promise<ResolveResult> {
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

  const identity = await resolveAccessIdentity(c);
  if (!identity) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: No Access identity",
    };
  }
  const { email, name, jobTitle } = identity;

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
      name: name || nameFromEmail(email),
      auth_role: "user",
      job_role: jobTitle || "",
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
