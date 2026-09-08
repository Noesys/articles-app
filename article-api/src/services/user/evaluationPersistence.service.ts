import type { EvaluationOutcome } from "../../types/user-types";

function sanitizeErrorMessage(raw: unknown, maxLen = 500): string {
  // Strip anything that looks like a stack trace, file path, API key, or
  // SQL fragment before persisting to ai_feedback (which is shown to users).
  let msg = "";
  if (raw instanceof Error) {
    msg = raw.message || raw.name || "Unknown error";
  } else if (typeof raw === "string") {
    msg = raw;
  } else {
    try {
      msg = JSON.stringify(raw);
    } catch {
      msg = String(raw);
    }
  }
  // Drop everything after the first newline (usually the start of a stack
  // trace) and remove any obvious secret-shaped substrings.
  msg = msg.split(/\r?\n/, 1)[0];
  msg = msg.replace(
    /\b(sk-[A-Za-z0-9_-]{8,}|AIza[0-9A-Za-z_-]{8,}|Bearer\s+[A-Za-z0-9._-]{8,})\b/g,
    "[redacted]",
  );
  if (msg.length > maxLen) {
    // Truncate at a UTF-8 character boundary to avoid corrupting multi-byte chars
    let cut = maxLen;
    while (cut > 0 && (msg.charCodeAt(cut - 1) & 0xc0) === 0x80) {
      cut--;
    }
    msg = msg.slice(0, cut) + "...";
  }
  return msg || "Evaluation failed";
}

/**
 * Persist evaluation results atomically in a single batched transaction.
 * Updates the article and upserts parameter results.
 * Uses version guard to prevent overwriting newer rewrite scores.
 */
export async function persistEvaluationResults(
  db: D1Database,
  articleId: string,
  version: number,
  outcome: EvaluationOutcome
): Promise<void> {
  const scoredAt = new Date().toISOString();

  // D1's db.batch() runs statements sequentially and atomically — either
  // all of the article update + result rewrites commit, or none do.
  const statements: D1PreparedStatement[] = [];

  // Step 1: Update the article — version guard prevents stale writes
  statements.push(
    db
      .prepare(
        `
          UPDATE articles
          SET ai_score = ?,
              ai_feedback = ?,
              status = ?,
              scored_at = ?,
              pass_threshold = ?
          WHERE id = ? AND version = ?
        `
      )
      .bind(
        outcome.ai_score,
        outcome.ai_feedback,
        outcome.status,
        scoredAt,
        outcome.pass_threshold,
        articleId,
        version,
      ),
  );

  // Step 2: Delete existing parameter results for this version (upsert approach)
  statements.push(
    db
      .prepare(
        `
          DELETE FROM article_parameter_results
          WHERE article_id = ? AND version = ?
        `
      )
      .bind(articleId, version),
  );

  // Step 3: Insert new parameter results
  for (const result of outcome.parameter_results) {
    const resultId = `apr_${crypto.randomUUID()}`;
    statements.push(
      db
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
          scoredAt,
        ),
    );
  }

  await db.batch(statements);
}

/**
 * Handle evaluation failure
 * Updates article status to 'failed' with a sanitized error message and
 * Does NOT increment retry_count (handled in articleHistory.ts rewrite path).
 * Uses version guard to prevent overwriting newer rewrite status.
 */
export async function handleEvaluationFailure(
  db: D1Database,
  articleId: string,
  version: number,
  errorMessage: string
): Promise<void> {
  const safe = sanitizeErrorMessage(errorMessage);
  await db
    .prepare(
      `
        UPDATE articles
        SET status = 'failed',
            ai_feedback = ?
        WHERE id = ? AND version = ?
      `
    )
    .bind(safe, articleId, version)
    .run();
}
