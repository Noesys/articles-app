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
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ALLOWED,
    ALLOWED_ATTR: ["href", "src", "alt", "colspan", "rowspan"],
    KEEP_CONTENT: true,
  });
}
