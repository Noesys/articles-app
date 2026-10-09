const MAX_PUBLISHED_URL_LENGTH = 2000;

export class InvalidPublishedUrlError extends Error {}

/**
 * Normalizes an admin-supplied "published link". Returns null for an empty
 * value (which clears the link) and throws InvalidPublishedUrlError for
 * anything that isn't a plain http(s) URL — the value is later rendered as an
 * href, so schemes like javascript: must never get through.
 */
export function normalizePublishedUrl(input: unknown): string | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== "string") {
    throw new InvalidPublishedUrlError("Published link must be a string");
  }

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.length > MAX_PUBLISHED_URL_LENGTH) {
    throw new InvalidPublishedUrlError("Published link is too long");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidPublishedUrlError("Published link must be a valid URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidPublishedUrlError("Published link must start with http:// or https://");
  }

  return parsed.toString();
}
