import type { Context, Next } from "hono";
import type { AppEnv } from "../types/shared-types";
import { verifyJwt } from "../utils/jwt";
import { getUserById } from "../services/user/users";

export async function authMiddleware(
  c: Context<AppEnv>,
  next: Next
) {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        message: "Unauthorized: Missing token",
      },
      401
    );
  }

  const token = header.slice("Bearer ".length).trim();
  const payload = await verifyJwt(c.env, token);

  if (!payload) {
    return c.json(
      {
        success: false,
        message: "Unauthorized: Invalid or expired token",
      },
      401
    );
  }

  const user = await getUserById(c.env.DB, payload.sub);
  if (!user) {
    return c.json(
      {
        success: false,
        message: "Unauthorized: User not found",
      },
      401
    );
  }

  if (user.is_active !== 1) {
    return c.json(
      {
        success: false,
        message: "Forbidden: Account is inactive",
      },
      403
    );
  }

  c.set("user", {
    id: user.id,
    email: user.email,
    name: user.name,
    job_role: user.job_role,
    auth_role: user.auth_role,
    is_active: user.is_active,
  });

  return await next();
}