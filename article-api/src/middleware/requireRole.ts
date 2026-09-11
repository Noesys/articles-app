import type { Context, Next } from "hono";
import type { AppEnv } from "../types/shared-types";
import { resolveAccessUser } from "./accessAuth";

export function requireRole(...allowedRoles: ("admin" | "super_admin")[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const result = await resolveAccessUser(c);
    if (!result.ok) {
      return c.json({ success: false, message: result.message }, result.status);
    }
    if (allowedRoles.length && !allowedRoles.includes(result.user.auth_role as any)) {
      return c.json({ success: false, message: "Forbidden: Insufficient permissions" }, 403);
    }
    c.set("user", result.user);
    return await next();
  };
}
