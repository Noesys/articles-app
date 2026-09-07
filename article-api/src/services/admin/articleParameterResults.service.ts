import {
  ParameterResultRow,
  StoreParameterResultInput,
  StoreParameterResultsResult,
} from "../../types/admin-types";

export async function getParameterResults(
  db: D1Database,
  articleId: string,
  version?: number,
): Promise<ParameterResultRow[]> {
  const conditions: string[] = ["r.article_id = ?"];
  const params: unknown[] = [articleId];

  if (version !== undefined && version !== null) {
    conditions.push("r.version = ?");
    params.push(version);
  }

  const sql = `
    SELECT r.id, r.parameter_id, p.name, r.value, r.version, r.scored_at
    FROM article_parameter_results r
    JOIN parameters p ON p.id = r.parameter_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY r.version DESC, p.name ASC
  `;
  const data = await db
    .prepare(sql)
    .bind(...params)
    .all<ParameterResultRow>();
  return data.results;
}

export async function storeParameterResults(
  db: D1Database,
  articleId: string,
  results: StoreParameterResultInput[],
  aiScore?: number | null,
  aiFeedback?: string | null,
): Promise<StoreParameterResultsResult> {
  const article = await db
    .prepare(`SELECT version FROM articles WHERE id = ?`)
    .bind(articleId)
    .first<{ version: number }>();

  if (!article) throw new Error("Article not found");

  const version = article.version;
  const now = new Date().toISOString();

  const batch: D1PreparedStatement[] = results.map((r) =>
    db
      .prepare(
        `INSERT INTO article_parameter_results (id, article_id, parameter_id, value, version, scored_at) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        articleId,
        r.parameter_id,
        r.value,
        version,
        now,
      ),
  );

  // Also update articles ai_score/feedback if provided
  if (aiScore !== undefined || aiFeedback !== undefined) {
    batch.push(
      db
        .prepare(
          `UPDATE articles SET ai_score = COALESCE(?, ai_score), ai_feedback = COALESCE(?, ai_feedback), scored_at = ? WHERE id = ?`,
        )
        .bind(aiScore ?? null, aiFeedback ?? null, now, articleId),
    );
  }

  await db.batch(batch);

  return { article_id: articleId, version, scored_at: now };
}
