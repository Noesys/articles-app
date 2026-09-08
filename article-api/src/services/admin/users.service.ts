import {
  ALLOWED_AUTH_ROLES,
  ALLOWED_SUBMISSION_STATUSES,
  ArticleByUser,
  AssignableAuthRole,
  SubmissionStatus,
  UserListItem,
  UserProfile,
} from "../../types/admin-types";
import { badRequest, forbidden } from "../../utils/errors";

export async function getUsers(
  db: D1Database,
  month_year?: string,
  submissionStatus?: string,
): Promise<UserListItem[]> {
  if (month_year && !/^\d{4}-\d{2}$/.test(month_year)) {
    throw badRequest("Invalid month format. Expected YYYY-MM");
  }

  if (
    submissionStatus &&
    !ALLOWED_SUBMISSION_STATUSES.includes(submissionStatus as SubmissionStatus)
  ) {
    throw badRequest("Invalid submission_status");
  }

  let stmt: D1PreparedStatement;

  // GET /users?month=2026-08&submission_status=submitted
  if (month_year && submissionStatus === "submitted") {
    stmt = db
      .prepare(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.job_role,
          u.is_active,
          u.auth_role
        FROM users u
        WHERE u.is_active = 1
          AND EXISTS (
            SELECT 1
            FROM articles a
            WHERE a.user_id = u.id
              AND a.month_year = ?
          )
        ORDER BY u.name ASC
      `,
      )
      .bind(month_year);
  }

  // GET /users?month=2026-08&submission_status=not_submitted
  else if (month_year && submissionStatus === "not_submitted") {
    stmt = db
      .prepare(
        `
        SELECT
          u.id,
          u.name,
          u.email,
          u.job_role,
          u.is_active,
          u.auth_role
        FROM users u
        WHERE u.is_active = 1
          AND NOT EXISTS (
            SELECT 1
            FROM articles a
            WHERE a.user_id = u.id
              AND a.month_year = ?
          )
        ORDER BY u.name ASC
      `,
      )
      .bind(month_year);
  }

  // GET /users
  else {
    stmt = db.prepare(`
      SELECT
        id,
        name,
        email,
        job_role,
        is_active,
        auth_role
      FROM users
      WHERE is_active = 1
      ORDER BY name ASC
    `);
  }

  const result = await stmt.all<UserListItem>();

  return result.results;
}

export async function getUserById(
  db: D1Database,
  id: string,
): Promise<UserProfile | null> {
  const user = await db
    .prepare(
      `
      SELECT
        id,
        name,
        email,
        auth_role,
        job_role,
        is_active,
        created_at,
        created_by
      FROM users
      WHERE id = ?
    `,
    )
    .bind(id)
    .first<UserProfile>();

  return user;
}

export async function updateUser(
  db: D1Database,
  id: string,
  name: string,
  jobRole: string,
  isActive: boolean,
): Promise<void> {
  await db
    .prepare(
      `
      UPDATE users
      SET
        name = ?,
        job_role = ?,
        is_active = ?
      WHERE id = ?
    `,
    )
    .bind(name, jobRole, isActive, id)
    .run();
}

export async function updateUserAuthRole(
  db: D1Database,
  id: string,
  role: string,
): Promise<void> {
  if (!ALLOWED_AUTH_ROLES.includes(role as AssignableAuthRole)) {
    throw badRequest("Invalid role");
  }

  if (role === "super_admin") {
    throw forbidden("Cannot change super_admin role");
  }

  const result = await db
    .prepare(
      `
      UPDATE users
      SET auth_role = ?
      WHERE id = ?
    `,
    )
    .bind(role, id)
    .run();

  if (!result) {
    throw new Error("Some error occurred. Couldn't update the user's role.");
  }
}

export async function getArticlesByUser(
  db: D1Database,
  userId: string,
  month?: string,
  status?: string,
  type?: string,
  page = 1,
  limit = 10,
): Promise<{ data: ArticleByUser[]; total: number }> {
  const conditions = ["a.user_id = ?"];
  const params: unknown[] = [userId];

  if (month) {
    conditions.push("a.month_year = ?");
    params.push(month);
  }

  if (status) {
    conditions.push("a.status = ?");
    params.push(status);
  }

  if (type) {
    conditions.push("a.article_type_id = ?");
    params.push(type);
  }

  const sql = `
    SELECT
      a.id,
      a.title,
      a.status,
      a.ai_score,
      a.version,
      a.submitted_at,

      a.user_id,

      u.name AS author_name,

      at.id AS article_type_id,
      at.name AS article_type_name

    FROM articles a

    JOIN users u
      ON u.id = a.user_id

    JOIN article_types at
      ON at.id = a.article_type_id

    WHERE ${conditions.join(" AND ")}

    ORDER BY a.submitted_at DESC
  `;

  type ArticleRow = Omit<ArticleByUser, "parameters">;

  const countSql = `SELECT COUNT(*) as total FROM articles a JOIN users u ON u.id=a.user_id JOIN article_types at ON at.id=a.article_type_id WHERE ${conditions.join(" AND ")}`;
  const totalRow = await db.prepare(countSql).bind(...params).first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  const offset = (page - 1) * limit;
  const pagedSql = sql + ` LIMIT ? OFFSET ?`;
  const results = (await db.prepare(pagedSql).bind(...params, limit, offset).all<ArticleRow>()).results;
  const data = results.map((article): ArticleByUser => ({ ...article, parameters: [] }));
  return { data, total };
}

export async function updateUserStatus(
  db: D1Database,
  id: string,
  isActive: boolean,
): Promise<D1Result> {
  return db
    .prepare(
      `
      UPDATE users
      SET is_active = ?
      WHERE id = ?
    `,
    )
    .bind(isActive ? 1 : 0, id)
    .run();
}
