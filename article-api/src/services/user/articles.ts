import { Article, ArticlePagination } from "../../types/user-types";

const ARTICLE_COLUMNS = `
  a.id,
  a.user_id,
  a.article_type_id,
  at.name AS article_type_name,
  a.title,
  a.content,
  a.status,
  a.ai_score,
  a.version,
  a.submitted_at,
  a.scored_at,
  a.updated_at,
  a.month_year,
  a.retry_count,
  a.ai_feedback,
  a.suggested_title
`;

export async function getArticlesByUser(
  db: D1Database,
  userId: string,
  month?: string,
  viewAll?: boolean,
  page?: number,
  limit?: number,
): Promise<{
  articles: Article[];
  pagination?: ArticlePagination;
}> {
  const fromClause = `
    FROM articles a
    INNER JOIN article_types at ON at.id = a.article_type_id
  `;

  // resolve current user's email for seeded-articles linkage (seed phase2 stores employee_email/emp_id, no user rows)
  const me = await db
    .prepare(`SELECT email FROM users WHERE id=?`)
    .bind(userId)
    .first<{ email: string }>();
  const myEmail = me?.email?.toLowerCase() ?? "";
  const byUserOrEmail = `(a.user_id = ? OR lower(a.employee_email) = ?)`;
  if (viewAll) {
    const safePage = Math.max(1, Math.floor(page || 1));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 10)));
    const offset = (safePage - 1) * safeLimit;

    const countResult = await db
      .prepare(
        `
          SELECT COUNT(*) AS total
          ${fromClause}
          WHERE ${byUserOrEmail}
        `,
      )
      .bind(userId, myEmail)
      .first<{ total: number }>();

    const result = await db
      .prepare(
        `
          SELECT ${ARTICLE_COLUMNS}
          ${fromClause}
          WHERE ${byUserOrEmail}
          ORDER BY a.submitted_at DESC
          LIMIT ? OFFSET ?
        `,
      )
      .bind(userId, myEmail, safeLimit, offset)
      .all<Article>();

    const total = countResult?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      articles: result.results,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  const result = await db
    .prepare(
      `
        SELECT ${ARTICLE_COLUMNS}
        ${fromClause}
        WHERE ${byUserOrEmail}
          AND a.month_year = ?
        ORDER BY a.submitted_at DESC
        LIMIT 100
      `,
    )
    .bind(userId, myEmail, month || new Date().toISOString().slice(0, 7))
    .all<Article>();

  return {
    articles: result.results,
  };
}

export type BrowseArticleItem = {
  id: string;
  title: string;
  excerpt: string;
  article_type_id: string;
  article_type_name: string;
  author_name: string;
  month_year: string;
  submitted_at: string;
};

export type ArticleTypeCount = {
  id: string;
  name: string;
  count: number;
};

/** Strip tags for a list-view excerpt; full content is served on detail. */
function toExcerpt(content: string, maxLen = 220): string {
  const text = content
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
}

/**
 * Blog-style browse across ALL users — read-only fields only.
 * Never selects ai_score / ai_feedback / suggested_title so scores
 * cannot leak through this endpoint.
 */
export async function browseArticles(
  db: D1Database,
  opts: { typeId?: string; sort?: "latest" | "earliest"; page?: number; limit?: number },
): Promise<{
  articles: BrowseArticleItem[];
  pagination: ArticlePagination;
  typeCounts: ArticleTypeCount[];
}> {
  const sort = opts.sort === "earliest" ? "ASC" : "DESC";
  const page = Math.max(1, Math.floor(opts.page || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(opts.limit || 9)));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (opts.typeId) {
    conditions.push("a.article_type_id = ?");
    params.push(opts.typeId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total FROM articles a ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = (
    await db
      .prepare(
        `
        SELECT a.id, a.title, a.content, a.article_type_id,
               at.name AS article_type_name,
               COALESCE(u.name, a.employee_email, 'Unknown') AS author_name,
               a.month_year, a.submitted_at
        FROM articles a
        INNER JOIN article_types at ON at.id = a.article_type_id
        LEFT JOIN users u ON u.id = a.user_id
        ${where}
        ORDER BY a.submitted_at ${sort}
        LIMIT ? OFFSET ?
      `,
      )
      .bind(...params, limit, offset)
      .all<{
        id: string;
        title: string;
        content: string;
        article_type_id: string;
        article_type_name: string;
        author_name: string;
        month_year: string;
        submitted_at: string;
      }>()
  ).results;

  const typeCounts = (
    await db
      .prepare(
        `
        SELECT at.id, at.name, COUNT(a.id) AS count
        FROM article_types at
        LEFT JOIN articles a ON a.article_type_id = at.id
        WHERE at.is_active = 1
        GROUP BY at.id, at.name
        ORDER BY at.name ASC
      `,
      )
      .all<{ id: string; name: string; count: number }>()
  ).results;

  return {
    articles: rows.map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: toExcerpt(r.content ?? ""),
      article_type_id: r.article_type_id,
      article_type_name: r.article_type_name,
      author_name: r.author_name,
      month_year: r.month_year,
      submitted_at: r.submitted_at,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    typeCounts,
  };
}

/** Single-article read view — title/content/meta only, no scoring fields. */
export async function getBrowseArticleById(db: D1Database, articleId: string) {
  return db
    .prepare(
      `
      SELECT a.id, a.title, a.content, a.article_type_id,
             at.name AS article_type_name,
             COALESCE(u.name, a.employee_email, 'Unknown') AS author_name,
             a.month_year, a.submitted_at
      FROM articles a
      INNER JOIN article_types at ON at.id = a.article_type_id
      LEFT JOIN users u ON u.id = a.user_id
      WHERE a.id = ?
      LIMIT 1
    `,
    )
    .bind(articleId)
    .first<{
      id: string;
      title: string;
      content: string;
      article_type_id: string;
      article_type_name: string;
      author_name: string;
      month_year: string;
      submitted_at: string;
    }>();
}

export async function getArticleById(
  db: D1Database,
  articleId: string,
  userId: string,
): Promise<Article | null> {
  return db
    .prepare(
      `
        SELECT ${ARTICLE_COLUMNS}
        FROM articles a
        INNER JOIN article_types at ON at.id = a.article_type_id
        WHERE a.id = ?
          AND a.user_id = ?
        LIMIT 1
      `,
    )
    .bind(articleId, userId)
    .first<Article>();
}

export async function createArticle(
  db: D1Database,
  article: {
    id: string;
    user_id: string;
    article_type_id: string;
    title: string;
    content: string;
    status: string;
    version: number;
    submitted_at: string;
    month_year: string;
    retry_count: number;
  },
): Promise<void> {
  await db
    .prepare(
      `
        INSERT INTO articles (
          id,
          user_id,
          article_type_id,
          title,
          content,
          status,
          version,
          submitted_at,
          updated_at,
          month_year,
          retry_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      article.id,
      article.user_id,
      article.article_type_id,
      article.title,
      article.content,
      article.status,
      article.version,
      article.submitted_at,
      // sweepStuckEvaluations relies on updated_at marking when this pending
      // period started — must be set on every write that puts the article
      // into pending, not just admin re-evaluate/change-type.
      article.submitted_at,
      article.month_year,
      article.retry_count,
    )
    .run();
}

export async function updateArticleStatus(db: D1Database, articleId: string, status: string) {
  await db.prepare(`UPDATE articles SET status = ? WHERE id = ?`).bind(status, articleId).run();
}
