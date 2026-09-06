export type User = {
  id: string;
  email: string;
  name: string;
  auth_role: string;
  job_role: string;
  created_at: string;
  created_by: string | null;
  is_active: number;
};

export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<User | null> {
  return db
    .prepare(
      `
        SELECT
          id,
          email,
          name,
          auth_role,
          job_role,
          created_at,
          created_by,
          is_active
        FROM users
        WHERE email = ?
        LIMIT 1
      `
    )
    .bind(email)
    .first<User>();
}

export async function createUser(
  db: D1Database,
  user: {
    id: string;
    email: string;
    name: string;
    auth_role: string;
    job_role: string;
    created_at: string;
    created_by?: string | null;
    is_active?: number;
  }
): Promise<void> {
  // Defensive: auth_role is caller-supplied; enforce an allowlist so a future
  // code-path that accidentally passes a privileged role has no effect.
  const ALLOWED_ROLES = new Set(["user", "admin", "super_admin"]);
  if (!ALLOWED_ROLES.has(user.auth_role)) {
    throw new Error(`Invalid auth_role: ${user.auth_role}`);
  }
  await db
    .prepare(
      `
        INSERT INTO users (
          id,
          email,
          name,
          auth_role,
          job_role,
          created_at,
          created_by,
          is_active
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    )
    .bind(
      user.id,
      user.email,
      user.name,
      user.auth_role,
      user.job_role,
      user.created_at,
      user.created_by ?? null,
      user.is_active ?? 1
    )
    .run();
}

export async function getUserById(
  db: D1Database,
  userId: string
): Promise<User | null> {
  return db
    .prepare(
      `
        SELECT
          id,
          email,
          name,
          auth_role,
          job_role,
          created_at,
          created_by,
          is_active
        FROM users
        WHERE id = ?
        LIMIT 1
      `
    )
    .bind(userId)
    .first<User>();
}

export async function updateUserStatus(
  db: D1Database,
  userId: string,
  isActive: number
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE users
        SET is_active = ?
        WHERE id = ?
      `
    )
    .bind(isActive, userId)
    .run();
}

export async function updateUser(
  db: D1Database,
  userId: string,
  updates: {
    name?: string;
    job_role?: string;
  }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }

  if (updates.job_role !== undefined) {
    fields.push("job_role = ?");
    values.push(updates.job_role);
  }

  if (fields.length === 0) {
    return;
  }

  values.push(userId);

  await db
    .prepare(
      `
        UPDATE users
        SET ${fields.join(", ")}
        WHERE id = ?
      `
    )
    .bind(...values)
    .run();
}