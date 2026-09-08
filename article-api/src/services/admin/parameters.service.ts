import { badRequest, conflict, notFound } from "../../utils/errors";
import { ParameterInput, Resolved } from "../../types/admin-types"

function validateScope(input: ParameterInput): string | null {
  if (input.scopeType === "numeric") {
    if (
      typeof input.minValue !== "number" ||
      typeof input.maxValue !== "number"
    ) {
      return "minValue and maxValue are required for numeric parameters";
    }
    if (input.maxValue <= input.minValue) {
      return "maxValue must be greater than minValue";
    }
  } else if (input.scopeType === "option") {
    if (!input.options || input.options.length === 0) {
      return "At least one option is required for option parameters";
    }
  } else {
    return "scopeType must be 'numeric' or 'option'";
  }
  return null;
}

export async function getParametersByArticleType(
  db: D1Database,
  articleTypeId?: string,
) {
  if (articleTypeId?.trim() === "" || !articleTypeId) {
    throw badRequest("article type ID is invalid");
  }
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
        is_active
      FROM parameters
      WHERE article_type_id = ?
        AND is_active = 1
      ORDER BY sort_order, created_at
    `,
    )
    .bind(articleTypeId)
    .all();

  const results = [];

  for (const parameter of parameters.results ?? []) {
    let options: unknown[] = [];

    if (parameter.scope_type === "option") {
      const optionResult = await db
        .prepare(
          `
          SELECT
            id,
            label,
            sort_order
          FROM parameter_options
          WHERE parameter_id = ?
            AND is_active = 1
          ORDER BY sort_order
        `,
        )
        .bind(parameter.id)
        .all();

      options = optionResult.results ?? [];
    }

    results.push({
      ...parameter,
      options,
    });
  }

  return results;
}

export async function getParameterById(db: D1Database, parameterId: string) {
  const parameter = await db
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
        options,
        is_active
      FROM parameters
      WHERE id = ?
        AND is_active = 1
    `,
    )
    .bind(parameterId)
    .first();

  if (!parameter) {
    throw notFound("Parameter");
  }

  return parameter;
}

async function syncParameterOptions(
  db: D1Database,
  parameterId: string,
  options: { id?: string; label: string }[] | undefined,
  now: string,
): Promise<D1PreparedStatement[]> {
  const statements: D1PreparedStatement[] = [];
  const incoming = options ?? [];

  // --- 1. Validate incoming payload up front: reject duplicate labels in
  //     a single request with a clear error instead of letting them reach
  //     the DB and surface as a UNIQUE constraint failure. ---
  const seenLabels = new Set<string>();
  const normalized = incoming.map((o) => ({ ...o, label: o.label.trim() }));
  for (const opt of normalized) {
    if (!opt.label) {
      throw badRequest("Option label cannot be empty");
    }
    if (seenLabels.has(opt.label)) {
      throw conflict(`Duplicate option label "${opt.label}" in request`);
    }
    seenLabels.add(opt.label);
  }

  // --- 2. Load the FULL row set once — active AND inactive together.
  const existingResult = await db
    .prepare(
      `SELECT id, label, is_active FROM parameter_options WHERE parameter_id = ?`,
    )
    .bind(parameterId)
    .all<{ id: string; label: string; is_active: number }>();
  const existingRows = existingResult.results ?? [];

  const byId = new Map(existingRows.map((r) => [r.id, r]));
  const byLabel = new Map(existingRows.map((r) => [r.label, r]));

  // --- 3. Resolve every incoming option to a definite target row before
  //     generating any SQL. ---

  const resolved: Resolved[] = [];
  const usedExistingIds = new Set<string>();

  // ids explicitly present in this request.
  const incomingIdSet = new Set(
    normalized.map((o) => o.id).filter((id): id is string => Boolean(id)),
  );

  normalized.forEach((option, i) => {
    const sourceRow = option.id ? byId.get(option.id) : undefined;
    if (option.id && !sourceRow) {
      throw badRequest(`Option id ${option.id} does not belong to parameter ${parameterId}`);
    }

    const labelOwner = byLabel.get(option.label);

    const externalConflict =
      !!labelOwner &&
      labelOwner.id !== option.id &&
      !usedExistingIds.has(labelOwner.id) &&
      !incomingIdSet.has(labelOwner.id);

    if (externalConflict) {
      resolved.push({
        id: labelOwner!.id,
        label: option.label,
        sortOrder: i,
        isNew: false,
        oldLabel: labelOwner!.label,
      });
      usedExistingIds.add(labelOwner!.id);
      return;
    }

    if (sourceRow) {
      resolved.push({
        id: option.id!,
        label: option.label,
        sortOrder: i,
        isNew: false,
        oldLabel: sourceRow.label,
      });
      usedExistingIds.add(option.id!);
      return;
    }

    if (labelOwner && !usedExistingIds.has(labelOwner.id)) {
      // No id sent (freshly typed option) and an existing row — active or
      // not — already owns this label. Reuse it. This is the "add Auth,
      // remove it, add Auth again later, no id sent" case.
      resolved.push({
        id: labelOwner.id,
        label: option.label,
        sortOrder: i,
        isNew: false,
        oldLabel: labelOwner.label,
      });
      usedExistingIds.add(labelOwner.id);
      return;
    }

    resolved.push({
      id: crypto.randomUUID(),
      label: option.label,
      sortOrder: i,
      isNew: true,
      oldLabel: null,
    });
  });

  console.debug(
    "[syncParameterOptions] resolved:",
    resolved.map((r) =>
      r.isNew
        ? `INSERT ${r.id}:${r.label}`
        : `REUSE ${r.id}: ${r.oldLabel} -> ${r.label}`,
    ),
  );

  // --- 4. Deactivate existing rows that were active but are no longer
  //     represented in the incoming list at all. ---
  for (const row of existingRows) {
    if (row.is_active === 1 && !usedExistingIds.has(row.id)) {
      statements.push(
        db
          .prepare(
            `UPDATE parameter_options SET is_active = 0 WHERE id = ? AND parameter_id = ?`,
          )
          .bind(row.id, parameterId),
      );
    }
  }

  // --- 5. Phase 1: move every row whose label is CHANGING to a
  //     collision-proof placeholder first. This makes label swaps
  //     (e.g. "AI"+"A" -> "A"+"AI") safe: every row about to take over
  //     another row's old label first vacates its own old label. ---
  for (const r of resolved) {
    if (!r.isNew && r.oldLabel !== r.label) {
      statements.push(
        db
          .prepare(
            `UPDATE parameter_options SET label = ? WHERE id = ? AND parameter_id = ?`,
          )
          .bind(`__pending_relabel__${r.id}`, r.id, parameterId),
      );
    }
  }

  // --- 6. Phase 2: write final state. Every row needing a new label has
  //     already vacated its old one, so nothing here can collide. ---
  for (const r of resolved) {
    if (r.isNew) {
      statements.push(
        db
          .prepare(
            `INSERT INTO parameter_options (id, parameter_id, label, sort_order, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
          )
          .bind(r.id, parameterId, r.label, r.sortOrder, now),
      );
    } else {
      statements.push(
        db
          .prepare(
            `UPDATE parameter_options SET label = ?, sort_order = ?, is_active = 1 WHERE id = ? AND parameter_id = ?`,
          )
          .bind(r.label, r.sortOrder, r.id, parameterId),
      );
    }
  }

  return statements;
}

export async function createParameter(
  db: D1Database,
  input: ParameterInput,
  createdBy: string,
  articleTypeId?: string,
) {
  const scopeError = validateScope(input);
  if (scopeError) {
    throw badRequest(scopeError);
  }

  if (articleTypeId?.trim() === "" || !articleTypeId) {
    throw badRequest("article type ID is invalid");
  }

  const articleType = await db
    .prepare(`SELECT id FROM article_types WHERE id = ? AND is_active = 1`)
    .bind(articleTypeId)
    .first();

  if (!articleType) {
    throw notFound("Article type");
  }

  const existing = await db
    .prepare(
      `
      SELECT id
      FROM parameters
      WHERE article_type_id = ?
        AND LOWER(name) = LOWER(?)
        AND is_active = 1
    `,
    )
    .bind(articleTypeId, input.name)
    .first();

  if (existing) {
    throw conflict("Parameter with this name already exists for this article type");
  }

  const parameterId = crypto.randomUUID();
  const now = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `
        INSERT INTO parameters (
          id, article_type_id, name, prompt, scope_type,
          min_value, max_value, created_by, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .bind(
        parameterId,
        articleTypeId,
        input.name,
        input.prompt,
        input.scopeType,
        input.minValue ?? null,
        input.maxValue ?? null,
        createdBy,
        now,
        now,
      ),
  ];

  const optionStatements = await syncParameterOptions(
    db,
    parameterId,
    input.scopeType === "option" ? input.options : undefined,
    now,
  );
  statements.push(...optionStatements);

  await db.batch(statements);

  return { id: parameterId };
}

export async function updateParameter(
  db: D1Database,
  parameterId: string,
  input: ParameterInput,
) {
  const scopeError = validateScope(input);
  if (scopeError) {
    throw badRequest(scopeError);
  }
  const existing = await db
    .prepare(
      `SELECT article_type_id FROM parameters WHERE id = ? AND is_active = 1`,
    )
    .bind(parameterId)
    .first<{ article_type_id: string }>();

  if (!existing) {
    throw notFound("Parameter");
  }

  const duplicate = await db
    .prepare(
      `
      SELECT id
      FROM parameters
      WHERE article_type_id = ?
        AND LOWER(name) = LOWER(?)
        AND id != ?
        AND is_active = 1
    `,
    )
    .bind(existing.article_type_id, input.name, parameterId)
    .first();

  if (duplicate) {
    throw conflict("Parameter with this name already exists for this article type");
  }

  const now = new Date().toISOString();

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `
        UPDATE parameters
        SET name = ?, prompt = ?, scope_type = ?, min_value = ?, max_value = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .bind(
        input.name,
        input.prompt,
        input.scopeType,
        input.minValue ?? null,
        input.maxValue ?? null,
        now,
        parameterId,
      ),
  ];

  const optionStatements = await syncParameterOptions(
    db,
    parameterId,
    input.scopeType === "option" ? input.options : undefined,
    now,
  );
  statements.push(...optionStatements);

  await db.batch(statements);
}

export async function deactivateParameter(db: D1Database, parameterId: string) {
  const existing = await db
    .prepare(`SELECT id FROM parameters WHERE id = ? AND is_active = 1`)
    .bind(parameterId)
    .first();

  if (!existing) {
    throw notFound("Parameter");
  }

  await db
    .prepare(
      `
      UPDATE parameters
      SET
        is_active = 0,
        updated_at = ?
      WHERE id = ?
    `,
    )
    .bind(new Date().toISOString(), parameterId)
    .run();

  await db
    .prepare(
      `
    UPDATE parameter_options
    SET
      is_active = 0,
      updated_at = ?
    WHERE parameter_id = ?    
  `,
    )
    .bind(new Date().toISOString(), parameterId)
    .run();
}
