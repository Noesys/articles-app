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
  a.month_year,
  a.retry_count,
  a.ai_feedback
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
          month_year,
          retry_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      article.month_year,
      article.retry_count,
    )
    .run();
}

export async function updateArticleStatus(
  db: D1Database,
  articleId: string,
  status: string,
) {
  await db
    .prepare(`UPDATE articles SET status = ? WHERE id = ?`)
    .bind(status, articleId)
    .run();
}
