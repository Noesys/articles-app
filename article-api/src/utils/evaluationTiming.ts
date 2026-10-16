// Evaluation time budget. Keep this ordering: each limit must fire before the next,
// so a slow run always ends as a recorded "failed" before the article becomes
// eligible for re-evaluate, and never finishes after the UI gave up on it.
//   AI call abort  <  workflow step cap  <  stuck threshold  =  frontend poll limit
// The frontend constants (MAX_POLL_DURATION in AdminArticleDetail / ArticleDetail /
// MyArticles, ROW_TIMEOUT_MS in AllArticles) must equal STUCK_EVALUATION_THRESHOLD_MS.

/** How long the model call may run before we abort it (evaluation only). */
export const EVALUATION_AI_TIMEOUT_MS = 4 * 60 * 1000;

/** Hard cap on the whole workflow step: the AI call plus DB reads/writes. */
export const EVALUATION_STEP_TIMEOUT_MS = EVALUATION_AI_TIMEOUT_MS + 30 * 1000;

// How long an article can sit at pending/processing before a rewrite or
// re-evaluate is allowed to supersede it. Matches the frontend's polling
// timeout (MAX_POLL_DURATION).
export const STUCK_EVALUATION_THRESHOLD_MS = 5 * 60 * 1000;

/** updatedAt must be an ISO string (has a timezone) — a bare CURRENT_TIMESTAMP value parses as local time and breaks this. */
export function isStuckPending(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > STUCK_EVALUATION_THRESHOLD_MS;
}

/**
 * True only when a scoring job may actually be running.
 * `pending` on a non-evaluatable type (e.g. Not suitable) is a seed/UI leftover —
 * no workflow is started for those rows, so type-change and re-evaluate must not
 * wait for isStuckPending.
 */
export function isEvaluationInFlight(
  status: string | null | undefined,
  updatedAt: string | null | undefined,
  isEvaluatable: boolean,
): boolean {
  if (!isEvaluatable) return false;
  if (status !== "pending" && status !== "processing") return false;
  return !isStuckPending(updatedAt);
}
