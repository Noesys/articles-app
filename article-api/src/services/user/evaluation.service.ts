import { ArticleTypeConfig, ParameterConfig, ParameterOption } from "../../types/user-types";

/**
 * Fetch article type by ID with scoring configuration
 */
export async function getArticleTypeConfig(
  db: D1Database,
  articleTypeId: string
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
      `
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
  articleTypeId: string
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
      `
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
        `
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
      options: param.scope_type === "option" ? (optionsMap[param.id] || []) : [],
    });
  }

  return parameterConfigs;
}

/**
 * Fetch active options for a specific parameter, ordered by sort_order
 */
export async function getActiveOptionsForParameter(
  db: D1Database,
  parameterId: string
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
      `
    )
    .bind(parameterId)
    .all<ParameterOption>();

  return result.results;
}
