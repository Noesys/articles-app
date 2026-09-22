// How long an article can sit at pending/processing before a rewrite or
// re-evaluate is allowed to supersede it. Matches the frontend's polling
// timeout (MAX_POLL_DURATION).
export const STUCK_EVALUATION_THRESHOLD_MS = 2 * 60 * 1000;

/** updatedAt must be an ISO string (has a timezone) — a bare CURRENT_TIMESTAMP value parses as local time and breaks this. */
export function isStuckPending(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;
  const ts = new Date(updatedAt).getTime();
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts > STUCK_EVALUATION_THRESHOLD_MS;
}
