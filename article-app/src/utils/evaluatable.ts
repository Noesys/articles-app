const NOT_SUITABLE_NAME = "not suitable";

export function isNotSuitableTypeName(name: string | null | undefined): boolean {
  return typeof name === "string" && name.trim().toLowerCase() === NOT_SUITABLE_NAME;
}

/**
 * Whether this article's current type can be AI-scored.
 * Seeded "Not suitable" rows are identified by type name even when the
 * is_evaluatable flag is missing from the payload (legacy GET shape).
 * A missing flag on any other type fails closed (treat as scorable) so we
 * never unlock type-change under a real in-flight evaluation.
 */
export function isArticleEvaluatable(
  flag?: number | boolean | null,
  typeName?: string | null,
): boolean {
  if (isNotSuitableTypeName(typeName)) return false;
  if (flag === undefined || flag === null) return true;
  return Number(flag) === 1;
}

/** Type dropdown / scoring banner should lock only for a real evaluation. */
export function isAdminTypeChangeLocked(opts: {
  scoringInFlight?: boolean;
  isPendingStatus?: boolean;
  score: number | null;
  is_evaluatable?: number | boolean | null;
  article_type_name?: string | null;
}): boolean {
  if (!isArticleEvaluatable(opts.is_evaluatable, opts.article_type_name)) {
    return false;
  }
  if (opts.scoringInFlight) return true;
  if (opts.isPendingStatus && opts.score === null) return true;
  return false;
}
