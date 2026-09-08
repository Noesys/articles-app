import { Hono } from "hono";
import type { AppEnv } from "../../types/shared-types";
import { getUserById } from "../../services/user/users";
import { accessAuth } from "../../middleware/accessAuth";

const authRoutes = new Hono<AppEnv>();

/* Removed local sendOtpEmail */

authRoutes.get("/me", accessAuth, async (c) => {
  const user = c.get("user");

  const dbUser = await getUserById(c.env.DB, user.id);

  return c.json({
    success: true,
    message: "User authenticated successfully",
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      job_role: dbUser?.job_role ?? user.job_role,
      auth_role: dbUser?.auth_role ?? user.auth_role,
      is_active: dbUser ? dbUser.is_active === 1 : true,
    },
  });
});

export default authRoutes;
