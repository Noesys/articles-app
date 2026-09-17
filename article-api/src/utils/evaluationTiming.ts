/**
 * How long an article can sit at status "pending"/"processing" before we
 * treat it as stuck (e.g. the AI call hung, or the Worker running it was
 * killed mid-flight) rather than genuinely in-flight.
 *
 * Checked lazily — on the next rewrite/re-evaluate attempt for that article
 * — rather than via a background sweep, so recovery happens exactly when
 * someone acts on the article, with no scheduled job or extra table scans.
 * Matches the frontend's polling timeout (ArticleDetail/AdminArticleDetail/
 * MyArticles MAX_POLL_DURATION) so polling gives up right around when the
 * article actually becomes eligible for a fresh attempt.
 */
export const STUCK_EVALUATION_THRESHOLD_MS = 2 * 60 * 1000;

/** True once `updatedAt` is older than STUCK_EVALUATION_THRESHOLD_MS (or missing/unparseable — treated as stale). */
export function isStuckPending(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > STUCK_EVALUATION_THRESHOLD_MS;
}
