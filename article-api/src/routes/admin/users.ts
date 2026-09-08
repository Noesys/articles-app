import { Hono } from "hono";
import {
  getArticlesByUser,
  getUserById,
  getUsers,
  updateUser,
  updateUserAuthRole,
  updateUserStatus,
} from "../../services/admin/users.service";
import {
  ALLOWED_ROLES,
  UpdateUserBody,
  UpdateUserRoleBody,
  UpdateUserStatusBody,
} from "../../types/admin-types";
import { requireAdminRoles } from "../../middleware/adminAuth";
import { AppEnv } from "../../types/shared-types";

const usersRoute = new Hono<AppEnv>();
usersRoute.use("*", requireAdminRoles("admin", "super_admin"));

function parseUpdateUserBody(
  body: unknown,
): { success: true; data: UpdateUserBody } | { success: false } {
  if (typeof body !== "object" || body === null) {
    return { success: false };
  }

  const raw = body as Record<string, unknown>;

  if (!raw.name || !raw.job_role || raw.is_active === undefined) {
    return { success: false };
  }

  return {
    success: true,
    data: {
      name: raw.name as string,
      job_role: raw.job_role as string,
      is_active: raw.is_active as boolean,
    },
  };
}

// get users based on submission_status and month_year
usersRoute.get("/", async (c) => {
  const db = c.env.DB;
  const month_year = c.req.query("month");
  const submissionStatus = c.req.query("submission_status");

  const users = await getUsers(db, month_year, submissionStatus);

  return c.json({
    message: "Users fetched successfully",
    data: users,
  });
});

// return article of a specific user GET /users/:id/articles
usersRoute.get("/:id/articles", async (c) => {
  const userId = c.req.param("id");

  const month = c.req.query("month");
  const status = c.req.query("status");
  const type = c.req.query("type");

  const data = await getArticlesByUser(c.env.DB, userId, month, status, type);

  return c.json({
    message: "User articles fetched successfully",
    data,
  });
});

// update a specific user's role
usersRoute.patch("/:id/role", async (c) => {
  const id = c.req.param("id");
  if (!id || id.trim() === "") {
    return c.json({ message: "Invalid id" }, 400);
  }

  const body = await c.req.json<UpdateUserRoleBody>();
  if (
    !body.role ||
    !ALLOWED_ROLES.includes(body.role as (typeof ALLOWED_ROLES)[number])
  ) {
    return c.json({ message: "Invalid role" }, 400);
  }

  await updateUserAuthRole(c.env.DB, id, body.role);
  return c.json({ message: "User role updated successfully" });
});

// get a particular user's profile
usersRoute.get("/:id", async (c) => {
  const db = c.env.DB;
  const id = c.req.param("id");

  if (!id || id.trim() === "") {
    return c.json({ message: "Invalid id" }, 400);
  }

  const user = await getUserById(db, id);

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json({
    message: "User fetched successfully",
    data: user,
  });
});

// update a specific user's data
usersRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body: unknown = await c.req.json();

  if (!id || id.trim() === "") {
    return c.json({ message: "Invalid id" }, 400);
  }

  const parsed = parseUpdateUserBody(body);
  if (!parsed.success) {
    return c.json({ message: "Invalid role" }, 400); // kept original (misleading) message
  }

  const { name, job_role, is_active } = parsed.data;
  await updateUser(c.env.DB, id, name, job_role, is_active);

  return c.json({
    message: "User updated successfully",
  });
});

usersRoute.patch("/:id/status", async (c) => {
  const id = c.req.param("id");

  const body = await c.req.json<UpdateUserStatusBody>();

  await updateUserStatus(c.env.DB, id, body.is_active);

  return c.json({
    message: "User status updated successfully",
  });
});

export default usersRoute;
