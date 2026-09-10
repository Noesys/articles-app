import {
  ArticleTypeDetail,
  ArticleTypeInput,
  ArticleTypeListItem,
  ArticleTypeListRow,
  ArticleTypeRow,
  CreateArticleTypeResult,
  ParameterRow,
} from "../../types/admin-types";

export async function getArticleTypes(db: D1Database): Promise<ArticleTypeListItem[]> {
  const sql = `
    SELECT
  at.id,
  at.name,
  at.description,
  at.is_active,
  at.pass_threshold,
  at.score_prompt,
  at.score_min,
  at.score_max,
  at.created_by,
  at.created_at,
  at.updated_at,

  COALESCE(
    json_group_array(
      CASE
        WHEN p.id IS NOT NULL THEN json_object(
          'id', p.id,
          'name', p.name,
          'prompt', p.prompt,
          'scopeType', p.scope_type,
          'minValue', p.min_value,
          'maxValue', p.max_value,
          'options',
          (
            SELECT COALESCE(
              json_group_array(
                json_object(
                  'id', po.id,
                  'label', po.label,
                  'sortOrder', po.sort_order
                )
              ),
              '[]'
            )
            FROM parameter_options po
            WHERE po.parameter_id = p.id
              AND po.is_active = 1
          )
        )
      END
        ),
        '[]'
      ) AS parameters,

      COUNT(p.id) AS parameter_count

    FROM article_types at

    LEFT JOIN parameters p
      ON p.article_type_id = at.id
      AND p.is_active = 1

    WHERE at.is_active = 1

    GROUP BY at.id

    ORDER BY at.name ASC;
  `;

  const result = await db.prepare(sql).all<ArticleTypeListRow>();

  return result.results.map((row): ArticleTypeListItem => {
    const parsedParameters: ParameterRow[] =
      typeof row.parameters === "string"
        ? (JSON.parse(row.parameters) as (ParameterRow | null)[]).filter(
            (p): p is ParameterRow => p !== null,
          )
        : [];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      is_active: row.is_active,
      pass_threshold: row.pass_threshold,
      score_prompt: row.score_prompt,
      score_min: row.score_min,
      score_max: row.score_max,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      parameters: parsedParameters,
      parameter_count: Number(row.parameter_count),
    };
  });
}

export async function getArticleTypeById(
  db: D1Database,
  articleTypeId: string,
): Promise<ArticleTypeDetail> {
  const articleType = await db
    .prepare(
      `
      SELECT
        id,
        name,
        description,
        pass_threshold,
        score_prompt,
        score_min,
        score_max,
        is_active
      FROM article_types
      WHERE id = ?
        AND is_active = 1
    `,
    )
    .bind(articleTypeId)
    .first<ArticleTypeRow>();

  if (!articleType) {
    throw new Error("Article type not found");
  }

  return articleType;
}

export async function createArticleType(
  db: D1Database,
  input: ArticleTypeInput,
  createdBy: string,
): Promise<CreateArticleTypeResult> {
  const existing = await db
    .prepare(
      `
      SELECT id
      FROM article_types
      WHERE LOWER(name) = LOWER(?)
        AND is_active = 1
    `,
    )
    .bind(input.name)
    .first<{ id: string }>();

  if (existing) {
    throw new Error("Article type already exists");
  }

  if (input.scoreMax <= input.scoreMin) {
    throw new Error("score_max must be greater than score_min");
  }
  if (input.passThreshold < input.scoreMin || input.passThreshold > input.scoreMax) {
    throw new Error("pass_threshold must fall within score_min and score_max");
  }

  const articleTypeId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `
        INSERT INTO article_types (
          id,
          name,
          description,
          pass_threshold,
          score_prompt,
          score_min,
          score_max,
          created_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        articleTypeId,
        input.name,
        input.description ?? null,
        input.passThreshold,
        input.scorePrompt,
        input.scoreMin,
        input.scoreMax,
        createdBy,
        now,
        now,
      )
      .run();
  } catch (err) {
    console.error("INSERT article_types failed:", err);
    throw err;
  }

  return { id: articleTypeId };
}

export async function updateArticleType(
  db: D1Database,
  articleTypeId: string,
  input: Partial<ArticleTypeInput>,
): Promise<void> {
  const existing = await db
    .prepare(
      `
      SELECT id, name, description, pass_threshold, score_prompt, score_min, score_max
      FROM article_types
      WHERE id = ?
        AND is_active = 1
    `,
    )
    .bind(articleTypeId)
    .first<ArticleTypeRow>();

  if (!existing) {
    throw new Error("Article type not found");
  }

  if (input.name !== undefined && input.name !== existing.name) {
    const duplicate = await db
      .prepare(
        `
        SELECT id
        FROM article_types
        WHERE LOWER(name) = LOWER(?)
          AND id != ?
          AND is_active = 1
      `,
      )
      .bind(input.name, articleTypeId)
      .first<{ id: string }>();

    if (duplicate) {
      throw new Error("Article type already exists");
    }
  }

  const name = input.name ?? existing.name;
  const description = input.description !== undefined ? input.description : existing.description;
  const passThreshold = input.passThreshold ?? existing.pass_threshold;
  const scorePrompt = input.scorePrompt ?? existing.score_prompt;
  const scoreMin = input.scoreMin ?? existing.score_min;
  const scoreMax = input.scoreMax ?? existing.score_max;

  if (scoreMax <= scoreMin) {
    throw new Error("score_max must be greater than score_min");
  }
  if (passThreshold < scoreMin || passThreshold > scoreMax) {
    throw new Error("pass_threshold must fall within score_min and score_max");
  }

  const now = new Date().toISOString();

  await db
    .prepare(
      `
      UPDATE article_types
      SET
        name = ?,
        description = ?,
        pass_threshold = ?,
        score_prompt = ?,
        score_min = ?,
        score_max = ?,
        updated_at = ?
      WHERE id = ?
    `,
    )
    .bind(
      name,
      description ?? null,
      passThreshold,
      scorePrompt,
      scoreMin,
      scoreMax,
      now,
      articleTypeId,
    )
    .run();
}

export async function deactivateArticleType(db: D1Database, articleTypeId: string): Promise<void> {
  const existing = await db
    .prepare(
      `
      SELECT id
      FROM article_types
      WHERE id = ?
        AND is_active = 1
    `,
    )
    .bind(articleTypeId)
    .first<{ id: string }>();

  if (!existing) {
    throw new Error("Article type not found");
  }

  await db
    .prepare(
      `
      UPDATE article_types
      SET
        is_active = 0,
        updated_at = ?
      WHERE id = ?
    `,
    )
    .bind(new Date().toISOString(), articleTypeId)
    .run();
}
