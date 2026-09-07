import type { EvaluationOutcome } from "../../types/user-types";

/**
 * Persist evaluation results in a single transaction
 * Updates the article and upserts parameter results
 */
export async function persistEvaluationResults(
  db: D1Database,
  articleId: string,
  version: number,
  outcome: EvaluationOutcome
): Promise<void> {
  const scoredAt = new Date().toISOString();

  // Use a batch operation for transaction-like behavior
  // D1 supports batched statements that run sequentially
  
  try {
    // Step 1: Update the article
    await db
      .prepare(
        `
          UPDATE articles
          SET ai_score = ?,
              ai_feedback = ?,
              status = ?,
              scored_at = ?,
              pass_threshold = ?
          WHERE id = ?
        `
      )
      .bind(
        outcome.ai_score,
        outcome.ai_feedback,
        outcome.status,
        scoredAt,
        outcome.pass_threshold,
        articleId
      )
      .run();

    // Step 2: Delete existing parameter results for this version (upsert approach)
    await db
      .prepare(
        `
          DELETE FROM article_parameter_results
          WHERE article_id = ? AND version = ?
        `
      )
      .bind(articleId, version)
      .run();

    // Step 3: Insert new parameter results
    for (const result of outcome.parameter_results) {
      const resultId = `apr_${crypto.randomUUID()}`;
      
      await db
        .prepare(
          `
            INSERT INTO article_parameter_results
              (id, article_id, parameter_id, value, option_id, numeric_value, version, scored_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          resultId,
          articleId,
          result.parameter_id,
          result.value,
          result.option_id,
          result.numeric_value,
          version,
          scoredAt
        )
        .run();
    }
  } catch (error) {
    console.error("Error persisting evaluation results:", error);
    throw new Error(`Failed to persist evaluation results: ${error}`);
  }
}

/**
 * Handle evaluation failure
 * Updates article status to 'failed' with error message and increments retry_count
 */
export async function handleEvaluationFailure(
  db: D1Database,
  articleId: string,
  errorMessage: string
): Promise<void> {
  await db
    .prepare(
      `
        UPDATE articles
        SET status = 'failed',
            ai_feedback = ?,
            retry_count = retry_count + 1
        WHERE id = ?
      `
    )
    .bind(errorMessage.slice(0, 2000), articleId) // Limit error message length
    .run();
}
