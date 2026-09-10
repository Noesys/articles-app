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

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      a.id,
      a.title,
      a.status,
      a.ai_score,
      a.version,
      a.submitted_at,

      COALESCE(u.id, 'emp_' || a.emp_id) AS user_id,
      COALESCE(u.name, a.employee_email) AS author_name,
      COALESCE(u.email, a.employee_email) AS author_email,
      u.job_role AS job_role,

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
      ON lower(u.email) = lower(a.employee_email)

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
      at.id,
      a.employee_email,
      a.emp_id,
      u.job_role

    ORDER BY a.submitted_at DESC
  `;

  const countSql = `SELECT COUNT(DISTINCT a.id) as total FROM articles a JOIN article_types at ON at.id=a.article_type_id ${whereClause}`;
  const totalRow = await db.prepare(countSql).bind(...params).first<{ total: number }>();
  const total = totalRow?.total ?? 0;
  const offset = (page - 1) * limit;
  const pagedSql = sql + ` LIMIT ? OFFSET ?`;
  const result = await db.prepare(pagedSql).bind(...params, limit, offset).all<ArticleListRawRow>();
  const data = result.results.map((row): ArticleListResult => ({
    ...row,
    parameters: row.parameters ? (JSON.parse(row.parameters) as (ArticleParameterResult | null)[]).filter((p): p is ArticleParameterResult => p !== null) : [],
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
}

export async function getArticleById(
  db: D1Database,
  id: string,
): Promise<ArticleDetail | null> {
  return db
    .prepare(
      `
      SELECT
  a.*,
  at.name AS article_type_name,
  COALESCE(u.name, a.employee_email) AS author_name,
  COALESCE(u.email, a.employee_email) AS author_email,
  u.job_role
FROM articles a
LEFT JOIN users u
  ON lower(u.email) = lower(a.employee_email)
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
