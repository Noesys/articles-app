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
  a.created_at,
  a.month_year,
  a.retry_count,
  a.ai_feedback,
  a.suggested_title,
  a.admin_edited_at
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
  article_type_id: string;
  article_type_name: string;
  author_name: string;
  submitted_at: string;
};

export type ArticleTypeOption = {
  id: string;
  name: string;
};

/**
 * Blog-style browse across ALL users — read-only fields only, and only
 * articles that are (a) accepted and (b) the article's current/live row —
 * article_history is never queried here, so older versions never surface.
 * Never selects ai_score / ai_feedback / suggested_title so scores cannot
 * leak through this endpoint, and never selects content for the list (kept
 * for detail only) to avoid paying for every row's full body on every page.
 */
export async function browseArticles(
  db: D1Database,
  opts: { typeId?: string; q?: string; page?: number; limit?: number },
): Promise<{
  articles: BrowseArticleItem[];
  pagination: ArticlePagination;
  typeOptions: ArticleTypeOption[];
}> {
  const page = Math.max(1, Math.floor(opts.page || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(opts.limit || 9)));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["a.status = 'approved'"];
  const params: unknown[] = [];
  if (opts.typeId) {
    conditions.push("a.article_type_id = ?");
    params.push(opts.typeId);
  }
  const q = opts.q?.trim();
  if (q) {
    conditions.push(
      "(a.title LIKE ? ESCAPE '\\' OR COALESCE(u.name, ue.name, a.employee_email) LIKE ? ESCAPE '\\')",
    );
    const escaped = q.replace(/[\\%_]/g, (m) => `\\${m}`);
    params.push(`%${escaped}%`, `%${escaped}%`);
  }
  const where = `WHERE ${conditions.join(" AND ")}`;

  // Author resolution shared by both the count and the page query, so a
  // search match against author name can't disagree with what's displayed.
  const joins = `
    FROM articles a
    INNER JOIN article_types at ON at.id = a.article_type_id
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN users ue
      ON a.employee_email IS NOT NULL
      AND lower(ue.email) = lower(a.employee_email)
  `;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS total ${joins} ${where}`)
    .bind(...params)
    .first<{ total: number }>();
  const total = countRow?.total ?? 0;

  const rows = (
    await db
      .prepare(
        `
        SELECT a.id, a.title, a.article_type_id,
               at.name AS article_type_name,
               COALESCE(u.name, ue.name, a.employee_email, 'Unknown') AS author_name,
               a.submitted_at
        ${joins}
        ${where}
        ORDER BY a.submitted_at DESC, a.id DESC
        LIMIT ? OFFSET ?
      `,
      )
      .bind(...params, limit, offset)
      .all<BrowseArticleItem>()
  ).results;

  // Every type with at least one qualifying article — deliberately not
  // scoped to article_types.is_active, so a type that's since been
  // deactivated doesn't disappear from the filter while it still has
  // accepted articles sitting under it.
  const typeOptions = (
    await db
      .prepare(
        `
        SELECT DISTINCT at.id, at.name
        FROM articles a
        INNER JOIN article_types at ON at.id = a.article_type_id
        WHERE a.status = 'approved'
        ORDER BY at.name ASC
      `,
      )
      .all<ArticleTypeOption>()
  ).results;

  return {
    articles: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    typeOptions,
  };
}

/**
 * Single-article read view — title/content/meta only, no scoring fields.
 * Enforces the exact same visibility rule as the listing (status='approved')
 * so a direct/guessed URL can't reach a pending, rejected, or failed
 * article, or expose an older version — article_history is never consulted.
 */
export async function getBrowseArticleById(db: D1Database, articleId: string) {
  return db
    .prepare(
      `
      SELECT a.id, a.title, a.content, a.article_type_id,
             at.name AS article_type_name,
             COALESCE(u.name, ue.name, a.employee_email, 'Unknown') AS author_name,
             a.submitted_at
      FROM articles a
      INNER JOIN article_types at ON at.id = a.article_type_id
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN users ue
        ON a.employee_email IS NOT NULL
        AND lower(ue.email) = lower(a.employee_email)
      WHERE a.id = ?
        AND a.status = 'approved'
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
          created_at,
          month_year,
          retry_count
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      // isStuckPending() (utils/evaluationTiming.ts) relies on updated_at marking
      // when this pending period started — must be set on every write that puts
      // the article into pending, not just admin re-evaluate/change-type.
      article.submitted_at,
      // created_at is set once, here, and never touched again by any rewrite /
      // re-evaluate / type-change / apply-suggestions path — it's the article's
      // fixed "Created" date, distinct from submitted_at/updated_at which move
      // with every resubmission or admin action ("Edited").
      article.submitted_at,
      article.month_year,
      article.retry_count,
    )
    .run();
}

export async function updateArticleStatus(db: D1Database, articleId: string, status: string) {
  await db.prepare(`UPDATE articles SET status = ? WHERE id = ?`).bind(status, articleId).run();
}
