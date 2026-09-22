import {
  ArticleTypeConfig,
  ParameterConfig,
  ParameterOption,
  PreviousVersionContext,
} from "../../types/user-types";

const normalizeForCompare = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Most recent earlier version worth sending as context. Walking back from the
 * newest history row: stop (null) at the first row under a DIFFERENT article
 * type — its feedback came from another rubric — and skip rows that are both
 * unscored and unchanged (a failed re-evaluation adds nothing).
 * Re-evaluations keep the same content; those are flagged `content_unchanged`
 * so the prompt can send just the earlier score/feedback, not the article twice.
 */
export async function getPreviousVersionContext(
  db: D1Database,
  articleId: string,
  currentVersion: number,
  articleTypeId: string,
  currentContent: string,
): Promise<PreviousVersionContext | null> {
  const rows = await db
    .prepare(
      `
        SELECT version, article_type_id, title, content, ai_score, ai_feedback, status
        FROM article_history
        WHERE article_id = ?
          AND version < ?
        ORDER BY version DESC
        LIMIT 10
      `,
    )
    .bind(articleId, currentVersion)
    .all<{
      version: number;
      article_type_id: string;
      title: string;
      content: string;
      ai_score: number | null;
      ai_feedback: string | null;
      status: string | null;
    }>();

  const current = normalizeForCompare(currentContent);
  for (const prev of rows.results ?? []) {
    if (prev.article_type_id !== articleTypeId) return null;

    const scored =
      (prev.status === "approved" || prev.status === "rewrite_required") && prev.ai_score !== null;
    const unchanged = normalizeForCompare(prev.content) === current;
    if (!scored && unchanged) continue;

    return {
      version: prev.version,
      title: prev.title,
      content: prev.content,
      content_unchanged: unchanged,
      ai_score: scored ? prev.ai_score : null,
      ai_feedback: scored ? prev.ai_feedback?.trim() || null : null,
    };
  }
  return null;
}

/**
 * Fetch article type by ID with scoring configuration
 */
export async function getArticleTypeConfig(
  db: D1Database,
  articleTypeId: string,
): Promise<ArticleTypeConfig | null> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          name,
          description,
          score_prompt,
          score_min,
          score_max,
          pass_threshold,
          is_active
        FROM article_types
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `,
    )
    .bind(articleTypeId)
    .first<ArticleTypeConfig>();

  return result || null;
}

/**
 * Fetch active parameters for an article type, ordered by sort_order
 */
export async function getActiveParameters(
  db: D1Database,
  articleTypeId: string,
): Promise<ParameterConfig[]> {
  const parameters = await db
    .prepare(
      `
        SELECT
          id,
          article_type_id,
          name,
          prompt,
          scope_type,
          min_value,
          max_value,
          is_active,
          sort_order
        FROM parameters
        WHERE article_type_id = ?
          AND is_active = 1
        ORDER BY sort_order ASC
      `,
    )
    .bind(articleTypeId)
    .all<Omit<ParameterConfig, "options">>();

  const parameterConfigs: ParameterConfig[] = [];

  // Collect option-scope parameter IDs
  const optionScopeParameterIds = parameters.results
    .filter((p) => p.scope_type === "option")
    .map((p) => p.id);

  // Fetch all options for option-scope parameters in one query
  let optionsMap: Record<string, ParameterOption[]> = {};
  if (optionScopeParameterIds.length > 0) {
    const placeholders = optionScopeParameterIds.map(() => "?").join(",");
    const options = await db
      .prepare(
        `
          SELECT
            id,
            parameter_id,
            label,
            is_active,
            sort_order
          FROM parameter_options
          WHERE parameter_id IN (${placeholders})
            AND is_active = 1
          ORDER BY parameter_id, sort_order ASC
        `,
      )
      .bind(...optionScopeParameterIds)
      .all<ParameterOption>();

    // Group options by parameter_id
    for (const option of options.results) {
      if (!optionsMap[option.parameter_id]) {
        optionsMap[option.parameter_id] = [];
      }
      optionsMap[option.parameter_id].push(option);
    }
  }

  // Build parameter configs with options
  for (const param of parameters.results) {
    parameterConfigs.push({
      ...param,
      scope_type: param.scope_type as "numeric" | "option",
      options: param.scope_type === "option" ? optionsMap[param.id] || [] : [],
    });
  }

  return parameterConfigs;
}

/**
 * Fetch active options for a specific parameter, ordered by sort_order
 */
export async function getActiveOptionsForParameter(
  db: D1Database,
  parameterId: string,
): Promise<ParameterOption[]> {
  const result = await db
    .prepare(
      `
        SELECT
          id,
          parameter_id,
          label,
          is_active,
          sort_order
        FROM parameter_options
        WHERE parameter_id = ?
          AND is_active = 1
        ORDER BY sort_order ASC
      `,
    )
    .bind(parameterId)
    .all<ParameterOption>();

  return result.results;
}
