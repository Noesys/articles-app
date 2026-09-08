// middleware/accessAuth.ts
import type { Context, Next } from "hono";
import type { AppEnv, ResolveResult } from "../types/shared-types";
import { findUserByEmail, createUser } from "../services/user/users";

function nameFromEmail(email: string): string {
  return email.split("@")[0] || "User";
}

export async function resolveAccessUser(
  c: Context<AppEnv>,
): Promise<ResolveResult> {

  if (!c.executionCtx.access) {
    return { ok: false, status: 403, message: "Access required" };
  }

  const identity = await c.executionCtx.access.getIdentity();

  if (!identity?.email) {
    return {
      ok: false,
      status: 401,
      message: "Unauthorized: No Access identity",
    };
  }

  let email = identity.email.trim().toLowerCase();

  // below commented code was testing purpose

  // let email = undefined;

  if (!email && c.env.ENVIRONMENT === "development" && c.env.DEV_USER_MAIL) {
    email = c.env.DEV_USER_MAIL.trim().toLowerCase();
  }

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
      name: nameFromEmail(email),
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
