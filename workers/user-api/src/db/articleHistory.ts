import { ArticleHistory } from "../types";

export async function getArticleHistory(
  db: D1Database,
  articleId: string,
  userId?: string
): Promise<ArticleHistory[]> {
  // Defense-in-depth: when a userId is provided, only return history rows
  // whose article belongs to that user. Route layer should already enforce
  // ownership, but this prevents any future code path from leaking data.
  const result = await db
    .prepare(
      `
        SELECT
          h.id,
          h.article_id,
          h.article_type_id,
          h.title,
          h.ai_feedback,
          h.content,
          h.ai_score,
          h.status,
          h.version,
          h.submitted_at,
          h.scored_at,
          h.snapshotted_at
        FROM article_history h
        ${userId ? "JOIN articles a ON a.id = h.article_id" : ""}
        WHERE h.article_id = ?
        ${userId ? "AND a.user_id = ?" : ""}
        ORDER BY h.version ASC
      `
    )
    .bind(...(userId ? [articleId, userId] : [articleId]))
    .all<ArticleHistory>();

  return result.results;
}

export async function snapshotArticle(
  db: D1Database,
  articleId: string,
  historyId: string,
  snapshottedAt: string,
  userId?: string
): Promise<void> {
  // When userId is provided, the snapshot is a no-op if the article does
  // not belong to the user (defense-in-depth — never insert a snapshot
  // row for someone else's article).
  if (userId) {
    const owns = await db
      .prepare(`SELECT 1 FROM articles WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(articleId, userId)
      .first();
    if (!owns) return;
  }
  await db
    .prepare(
      `
        INSERT INTO article_history (
          id,
          article_id,
          article_type_id,
          title,
          ai_feedback,
          content,
          ai_score,
          pass_threshold,
          status,
          version,
          submitted_at,
          scored_at,
          snapshotted_at
        )
        SELECT
          ?,
          id,
          article_type_id,
          title,
          ai_feedback,
          content,
          ai_score,
          pass_threshold,
          status,
          version,
          submitted_at,
          scored_at,
          ?
        FROM articles
        WHERE id = ?
      `
    )
    .bind(historyId, snapshottedAt, articleId)
    .run();
}

export async function updateArticleForRewrite(
  db: D1Database,
  articleId: string,
  title: string,
  content: string,
  monthYear: string,
  userId?: string
): Promise<void> {
  // Defense-in-depth: when userId is provided, the UPDATE matches no rows
  // if the article does not belong to the user.
  await db
    .prepare(
      `
        UPDATE articles
        SET
          title = ?,
          content = ?,
          version = version + 1,
          status = 'pending',
          ai_score = NULL,
          ai_feedback = NULL,
          pass_threshold = NULL,
          submitted_at = CURRENT_TIMESTAMP,
          scored_at = NULL,
          month_year = ?,
          retry_count = retry_count + 1
        WHERE id = ?
        ${userId ? "AND user_id = ?" : ""}
      `
    )
    .bind(...(userId ? [title, content, monthYear, articleId, userId] : [title, content, monthYear, articleId]))
    .run();
}
