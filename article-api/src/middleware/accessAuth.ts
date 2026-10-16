// middleware/accessAuth.ts
import type { Context, Next } from "hono";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv, Bindings, ResolveResult } from "../types/shared-types";
import { findUserByEmail, createUser } from "../services/user/users";

// createRemoteJWKSet caches the downloaded keys inside the object it returns, so it must
// outlive a single request. Building one per request re-downloaded Cloudflare's signing
// keys on every API call. These are public keys shared by all users, so reuse is safe;
// jose re-fetches on its own if Cloudflare rotates them.
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJwksUrl = "";

function getJwks(teamDomain: string) {
  const url = `${teamDomain}/cdn-cgi/access/certs`;
  if (!cachedJwks || cachedJwksUrl !== url) {
    cachedJwks = createRemoteJWKSet(new URL(url));
    cachedJwksUrl = url;
  }
  return cachedJwks;
}

function nameFromEmail(email: string): string {
  return email.split("@")[0] || "User";
}

type AccessIdentity = {
  email: string;
  name: string | null;
  jobTitle: string | null;
};

/**
 * Resolve email, name, and job_role from Cloudflare Access.
 * Prefer ctx.access (Worker Access without static-asset router gap).
 * Fall back to Cf-Access-Jwt-Assertion — required when Static Assets sit
 * behind Cloudflare's internal router, which does not forward ctx.access.
 */
async function resolveAccessIdentity(
  request: Request,
  env: Bindings,
  executionCtx: ExecutionContext,
): Promise<AccessIdentity | null> {
  if (executionCtx.access) {
    const identity = await executionCtx.access.getIdentity();
    if (identity?.email) {
      const oidc = (identity as { oidc_fields?: { job_title?: unknown } })?.oidc_fields;
      return {
        email: identity.email.trim().toLowerCase(),
        name: identity.name?.trim() || null,
        jobTitle: typeof oidc?.job_title === "string" ? oidc.job_title.trim() || null : null,
      };
    }
  }

  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  const teamDomain = (env.CF_ACCESS_TEAM_DOMAIN ?? "").replace(/\/$/, "");
  const aud = env.CF_ACCESS_AUD;

  if (assertion && teamDomain && aud) {
    try {
      const JWKS = getJwks(teamDomain);
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

  const headerEmail = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (headerEmail && assertion) {
    return {
      email: headerEmail.trim().toLowerCase(),
      name: null,
      jobTitle: null,
    };
  }

  if (env.ENVIRONMENT === "development" && env.DEV_USER_MAIL) {
    return {
      email: env.DEV_USER_MAIL.trim().toLowerCase(),
      name: null,
      jobTitle: null,
    };
  }

  return null;
}

/** Resolve Contiq user from Access identity (Hono or raw Request). */
export async function resolveAccessUserFromRequest(
  request: Request,
  env: Bindings,
  executionCtx: ExecutionContext,
): Promise<ResolveResult> {
  const hasAccessContext = Boolean(executionCtx.access);
  const hasAssertion = Boolean(request.headers.get("Cf-Access-Jwt-Assertion"));

  if (!hasAccessContext && !hasAssertion) {
    if (!(env.ENVIRONMENT === "development" && env.DEV_USER_MAIL)) {
      return { ok: false, status: 403, message: "Access required" };
    }
  }

  const identity = await resolveAccessIdentity(request, env, executionCtx);
  if (!identity?.email) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: No Access identity",
    };
  }
  const { email, name, jobTitle } = identity;

  let user = await findUserByEmail(env.DB, email);

  if (!user) {
    const allowedDomain = env.ALLOWED_EMAIL_DOMAIN;
    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      return {
        ok: false,
        status: 403,
        message: "Forbidden: Domain not allowlisted",
      };
    }
    await createUser(env.DB, {
      id: "usr_" + crypto.randomUUID(),
      email,
      name: name || nameFromEmail(email),
      auth_role: "user",
      job_role: jobTitle || "",
      created_at: new Date().toISOString(),
      created_by: null,
      is_active: 1,
    });
    user = await findUserByEmail(env.DB, email);
  }

  if (user) {
    const resolvedName = name?.trim();
    const resolvedJobTitle = jobTitle?.trim();

    const shouldUpdateName =
      resolvedName && (!user.name || user.name === nameFromEmail(user.email));

    const shouldUpdateJobRole =
      resolvedJobTitle && (!user.job_role || user.job_role.trim() === "");

    if (shouldUpdateName || shouldUpdateJobRole) {
      await env.DB.prepare(
        `
        UPDATE users
        SET
          name = COALESCE(?, name),
          job_role = COALESCE(?, job_role)
        WHERE id = ?
      `,
      )
        .bind(
          shouldUpdateName ? resolvedName : null,
          shouldUpdateJobRole ? resolvedJobTitle : null,
          user.id,
        )
        .run();

      user = await findUserByEmail(env.DB, email);
    }
  }

  if (!user || user.is_active !== 1) {
    return { ok: false, status: 403, message: "Forbidden: Account inactive" };
  }

  if ((user.auth_role as string) === "super_admin") {
    await env.DB.prepare(`UPDATE users SET auth_role = 'admin' WHERE id = ?`).bind(user.id).run();
    user = { ...user, auth_role: "admin" };
  }

  if (user.auth_role !== "admin" && user.auth_role !== "user") {
    return { ok: false, status: 403, message: "Forbidden: Invalid role" };
  }

  return { ok: true, user };
}

export async function resolveAccessUser(c: Context<AppEnv>): Promise<ResolveResult> {
  return resolveAccessUserFromRequest(c.req.raw, c.env, c.executionCtx);
}

export async function accessAuth(c: Context<AppEnv>, next: Next) {
  const result = await resolveAccessUser(c);
  if (!result.ok) {
    return c.json({ success: false, message: result.message }, result.status);
  }
  c.set("user", result.user);
  return await next();
}
