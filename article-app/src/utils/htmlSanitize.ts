import DOMPurify from "dompurify";

const ALLOWED = [
  "h1",
  "h2",
  "h3",
  "b",
  "i",
  "u",
  "p",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "img",
  "br",
  "hr",
  "strong",
  "em",
];

/**
 * Sanitize pasted HTML for the editor.
 * Intentionally omits `style` — inline CSS is an XSS vector (expression/url/behavior).
 * Structural tags + href/src/alt are enough; TipTap marks carry formatting.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED,
    ALLOWED_ATTR: ["href", "src", "alt", "colspan", "rowspan", "width", "height", "title"],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    KEEP_CONTENT: true,
  });
}
