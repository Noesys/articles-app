import {
  ArticleHistoryEntry,
  ArticleListRawRow,
  ArticleListResult,
  ArticleParameterResult,
} from "../../types/admin-types";

export async function getArticles(
  db: D1Database,
  month?: string,
  status?: string,
  type?: string,
  page = 1,
  limit = 10,
): Promise<{ data: ArticleListResult[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      a.id,
      a.title,
      a.status,
      a.ai_score,
      a.version,
      a.submitted_at,

      COALESCE(u.id, ue.id, 'emp_' || a.emp_id) AS user_id,
      COALESCE(u.name, ue.name, a.employee_email) AS author_name,
      COALESCE(u.email, ue.email, a.employee_email) AS author_email,
      COALESCE(u.job_role, ue.job_role) AS job_role,

      at.id AS article_type_id,
      at.name AS article_type_name,

      json_group_array(
        CASE
          WHEN p.id IS NOT NULL THEN
            json_object(
              'parameterId', p.id,
              'parameterName', p.name,
              'scopeType', p.scope_type,
              'value', apr.value
            )
        END
      ) AS parameters

    FROM articles a

    LEFT JOIN users u
      ON u.id = a.user_id

    LEFT JOIN users ue
      ON a.employee_email IS NOT NULL
      AND lower(ue.email) = lower(a.employee_email)

    JOIN article_types at
      ON at.id = a.article_type_id

    LEFT JOIN article_parameter_results apr
      ON apr.article_id = a.id
      AND apr.version = a.version

    LEFT JOIN parameters p
      ON p.id = apr.parameter_id

    ${whereClause}

    GROUP BY
      a.id,
      u.id,
      ue.id,
      at.id,
      a.employee_email,
      a.emp_id,
      u.job_role,
      ue.job_role

    ORDER BY a.submitted_at DESC
  `;

  const countSql = `SELECT COUNT(DISTINCT a.id) as total FROM articles a JOIN article_types at ON at.id=a.article_type_id ${whereClause}`;
  const totalRow = await db
    .prepare(countSql)
    .bind(...params)
    .first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  const offset = (page - 1) * limit;
  const pagedSql = sql + ` LIMIT ? OFFSET ?`;
  const result = await db
    .prepare(pagedSql)
    .bind(...params, limit, offset)
    .all<ArticleListRawRow>();
  const data = result.results.map((row): ArticleListResult => ({
    ...row,
    parameters: row.parameters
      ? (JSON.parse(row.parameters) as (ArticleParameterResult | null)[]).filter(
          (p): p is ArticleParameterResult => p !== null,
        )
      : [],
  }));
  return { data, total };
}

export interface ArticleDetail {
  ai_feedback: string;
  id: string;
  title: string;
  content: string;
  status: string;
  ai_score: number | null;
  version: number;
  month_year: string;
  user_id: string;
  article_type_id: string;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  article_type_name: string;
  author_name: string;
  author_email: string;
  job_role: string;
  suggested_title: string | null;
}

export async function getArticleById(db: D1Database, id: string): Promise<ArticleDetail | null> {
  return db
    .prepare(
      `
      SELECT
  a.*,
  at.name AS article_type_name,
  COALESCE(u.name, ue.name, a.employee_email) AS author_name,
  COALESCE(u.email, ue.email, a.employee_email) AS author_email,
  COALESCE(u.job_role, ue.job_role) AS job_role
FROM articles a
LEFT JOIN users u
  ON u.id = a.user_id
LEFT JOIN users ue
  ON a.employee_email IS NOT NULL
  AND lower(ue.email) = lower(a.employee_email)
INNER JOIN article_types at
  ON at.id = a.article_type_id
WHERE a.id = ?
      `,
    )
    .bind(id)
    .first<ArticleDetail>();
}

export async function getArticleHistory(
  db: D1Database,
  articleId: string,
): Promise<ArticleHistoryEntry[]> {
  const result = await db
    .prepare(
      `
      SELECT
        id,
        article_id,
        version,
        title,
        content,
        ai_score,
        ai_feedback,
        status,
        submitted_at,
        scored_at,
        snapshotted_at
      FROM article_history
      WHERE article_id = ?
      ORDER BY version ASC
      `,
    )
    .bind(articleId)
    .all<ArticleHistoryEntry>();

  return result.results;
}

const MAX_TITLE_BYTES = 500;

/** Title-only update — does not bump version or trigger evaluation. */
export async function updateArticleTitle(
  db: D1Database,
  articleId: string,
  title: string,
): Promise<ArticleDetail | null> {
  const trimmed = title.replace(/\s+/g, " ").trim();
  if (!trimmed) {
    throw new Error("Title is required");
  }
  if (new TextEncoder().encode(trimmed).length > MAX_TITLE_BYTES) {
    throw new Error("Title too long");
  }

  const existing = await getArticleById(db, articleId);
  if (!existing) return null;

  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE articles
       SET title = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(trimmed, now, articleId)
    .run();

  return getArticleById(db, articleId);
}

function currentMonthYear(): string {
  return new Date().toISOString().slice(0, 7);
}

// ---------- getArticleStats ----------

export interface ArticleStats {
  total_articles: number;
  approved: number;
  rewrite_required: number;
  pending: number;
  average_score: number | null;
}

export async function getArticleStats(
  db: D1Database,
  month?: string,
): Promise<ArticleStats | null> {
  const targetMonth = month || currentMonthYear();

  const sql = `
    SELECT

      COUNT(*) AS total_articles,

      SUM(
        CASE
          WHEN status = 'approved'
          THEN 1
          ELSE 0
        END
      ) AS approved,

      SUM(
        CASE
          WHEN status = 'rewrite_required'
          THEN 1
          ELSE 0
        END
      ) AS rewrite_required,

      SUM(
        CASE
          WHEN status = 'pending'
          THEN 1
          ELSE 0
        END
      ) AS pending,

      ROUND(AVG(ai_score), 2) AS average_score

    FROM articles

    WHERE month_year = ?
  `;

  const result = await db.prepare(sql).bind(targetMonth).first<ArticleStats>();

  return result;
}

/** Look up type flags for admin type-change / re-evaluate. */
export async function getArticleTypeMeta(
  db: D1Database,
  articleTypeId: string,
): Promise<{ id: string; name: string; is_evaluatable: number; is_active: number } | null> {
  return db
    .prepare(`SELECT id, name, is_evaluatable, is_active FROM article_types WHERE id = ? LIMIT 1`)
    .bind(articleTypeId)
    .first();
}

/**
 * Change article type, clear prior scores, optionally prepare for re-evaluation.
 * Snapshots current version into history when scores/feedback exist.
 */
export async function changeArticleType(
  db: D1Database,
  articleId: string,
  articleTypeId: string,
): Promise<{ version: number; title: string; content: string; evaluatable: boolean } | null> {
  const article = await getArticleById(db, articleId);
  if (!article) return null;

  const typeMeta = await getArticleTypeMeta(db, articleTypeId);
  if (!typeMeta || !typeMeta.is_active) {
    throw new Error("Article type not found or inactive");
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  if (article.ai_score != null || article.ai_feedback || article.status !== "pending") {
    const historyId = "hist_" + crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO article_history (id, article_id, article_type_id, title, ai_feedback, content, ai_score, pass_threshold, status, version, submitted_at, scored_at, snapshotted_at)
           SELECT ?, id, article_type_id, title, COALESCE(ai_feedback,''), content, ai_score, pass_threshold, status, version, submitted_at, scored_at, ?
           FROM articles WHERE id = ?`,
        )
        .bind(historyId, now, articleId),
    );
  }

  const nextVersion =
    article.ai_score != null || article.ai_feedback || article.status !== "pending"
      ? article.version + 1
      : article.version;

  const evaluatable = Number(typeMeta.is_evaluatable) === 1;
  statements.push(
    db
      .prepare(
        `UPDATE articles
         SET article_type_id = ?,
             version = ?,
             status = 'pending',
             ai_score = NULL,
             ai_feedback = NULL,
             suggested_title = NULL,
             pass_threshold = NULL,
             scored_at = NULL,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(articleTypeId, nextVersion, now, articleId),
  );

  statements.push(
    db
      .prepare(`DELETE FROM article_parameter_results WHERE article_id = ? AND version = ?`)
      .bind(articleId, nextVersion),
  );

  await db.batch(statements);

  return {
    version: nextVersion,
    title: article.title,
    content: article.content,
    evaluatable,
  };
}

/** Reset scores for re-evaluate without changing type (snapshot if needed). */
export async function prepareArticleReevaluate(
  db: D1Database,
  articleId: string,
): Promise<{
  version: number;
  title: string;
  content: string;
  article_type_id: string;
  evaluatable: boolean;
} | null> {
  const article = await getArticleById(db, articleId);
  if (!article) return null;

  const typeMeta = await getArticleTypeMeta(db, article.article_type_id);
  if (!typeMeta || !typeMeta.is_active) {
    throw new Error("Article type not found or inactive");
  }

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];

  if (article.ai_score != null || article.ai_feedback || article.status !== "pending") {
    const historyId = "hist_" + crypto.randomUUID();
    statements.push(
      db
        .prepare(
          `INSERT INTO article_history (id, article_id, article_type_id, title, ai_feedback, content, ai_score, pass_threshold, status, version, submitted_at, scored_at, snapshotted_at)
           SELECT ?, id, article_type_id, title, COALESCE(ai_feedback,''), content, ai_score, pass_threshold, status, version, submitted_at, scored_at, ?
           FROM articles WHERE id = ?`,
        )
        .bind(historyId, now, articleId),
    );
  }

  const nextVersion =
    article.ai_score != null || article.ai_feedback || article.status !== "pending"
      ? article.version + 1
      : article.version;

  statements.push(
    db
      .prepare(
        `UPDATE articles
         SET version = ?,
             status = 'pending',
             ai_score = NULL,
             ai_feedback = NULL,
             suggested_title = NULL,
             pass_threshold = NULL,
             scored_at = NULL,
             updated_at = ?
         WHERE id = ?`,
      )
      .bind(nextVersion, now, articleId),
  );

  statements.push(
    db
      .prepare(`DELETE FROM article_parameter_results WHERE article_id = ? AND version = ?`)
      .bind(articleId, nextVersion),
  );

  await db.batch(statements);

  return {
    version: nextVersion,
    title: article.title,
    content: article.content,
    article_type_id: article.article_type_id,
    evaluatable: Number(typeMeta.is_evaluatable) === 1,
  };
}
