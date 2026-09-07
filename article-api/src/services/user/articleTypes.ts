import { ArticleType } from "../../types/user-types";

export async function getArticleTypes(db: D1Database): Promise<ArticleType[]> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          name,
          description,
          created_by,
          created_at,
          updated_at
        FROM article_types WHERE is_active=1
        ORDER BY name ASC
      `,
    )
    .all<ArticleType>();

  return result.results;
}

export async function getArticleTypeById(
  db: D1Database,
  articleTypeId: string,
): Promise<ArticleType | null> {
  return db
    .prepare(
      `
        SELECT
          id,
          name,
          description,
          created_by,
          created_at,
          updated_at
        FROM article_types
        WHERE id = ?
        LIMIT 1
      `,
    )
    .bind(articleTypeId)
    .first<ArticleType>();
}

// after AI scoring
export async function updateArticleEvaluation(
  db: D1Database,
  articleId: string,
  score: number,
  feedback: string,
  status: string,
) {
  if (!articleId?.trim()) {
    throw new Error("Article id is required");
  }

  if (
    typeof score !== "number" ||
    Number.isNaN(score) ||
    score < 0 ||
    score > 10
  ) {
    throw new Error("Score must be between 0 and 10");
  }

  if (!feedback?.trim()) {
    throw new Error("Feedback is required");
  }

  const allowedStatuses = ["approved", "rewrite_required"];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid article status");
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM articles
      WHERE id = ?
    `,
    )
    .bind(articleId)
    .first();

  if (!existing) {
    throw new Error("Article not found");
  }

  await db
    .prepare(
      `
      UPDATE articles
      SET
        ai_score = ?,
        ai_feedback = ?,
        status = ?,
        scored_at = ?
      WHERE id = ?
    `,
    )
    .bind(score, feedback.trim(), status, new Date().toISOString(), articleId)
    .run();
}
