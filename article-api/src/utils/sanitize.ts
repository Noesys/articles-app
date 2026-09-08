const ALLOWED_TAGS = new Set([
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
]);
export function sanitizeHtmlServer(html: string): string {
  // strip script/style and event handlers, keep allowlist tags
  let out = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  out = out.replace(/ on\w+="[^"]*"/gi, "").replace(/ on\w+='[^']*'/gi, "");
  out = out.replace(/javascript:/gi, "");
  // strip disallowed tags but keep content
  out = out.replace(/<\/?([a-z0-9]+)[^>]*>/gi, (m, tag) =>
    ALLOWED_TAGS.has(tag.toLowerCase()) ? m : "",
  );
  return out;
}
