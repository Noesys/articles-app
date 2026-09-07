import { ArticleHistory } from "../../types/user-types";

export async function getArticleHistory(
  db: D1Database,
  articleId: string
): Promise<ArticleHistory[]> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          article_id,
          article_type_id,
          title,
          ai_feedback,
          content,
          ai_score,
          status,
          version,
          submitted_at,
          scored_at,
          snapshotted_at
        FROM article_history
        WHERE article_id = ?
        ORDER BY version ASC
      `
    )
    .bind(articleId)
    .all<ArticleHistory>();

  return result.results;
}

export async function snapshotArticle(
  db: D1Database,
  articleId: string,
  historyId: string,
  snapshottedAt: string
): Promise<void> {
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
  monthYear: string
): Promise<void> {
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
      `
    )
    .bind(title, content, monthYear, articleId)
    .run();
}
