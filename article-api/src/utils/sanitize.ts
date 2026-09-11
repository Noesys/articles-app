import { Parser } from "htmlparser2";

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

const VOID_TAGS = new Set(["br", "hr", "img"]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height", "style", "data-align"]),
  th: new Set(["colspan", "rowspan"]),
  td: new Set(["colspan", "rowspan"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
};

const SAFE_URL = /^(https?:\/\/|\/|#|mailto:)/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function sanitizeHtmlServer(html: string): string {
  let out = "";
  // Stack to track whether we're inside a stripped tag (script/style) so we drop its text
  const skipStack: string[] = [];

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();
        // Always drop script/style and their content
        if (tag === "script" || tag === "style") {
          skipStack.push(tag);
          return;
        }
        if (skipStack.length > 0) return;

        if (!ALLOWED_TAGS.has(tag)) return;

        let attrs = "";
        const allowed = ALLOWED_ATTRS[tag];
        if (allowed) {
          for (const [rawName, rawValue] of Object.entries(attribs)) {
            const attrName = rawName.toLowerCase();
            if (attrName.startsWith("on") || attrName === "xmlns") continue;
            if (attrName === "style" && tag !== "img") continue;
            if (!allowed.has(attrName)) continue;
            let v = rawValue ?? "";
            if (attrName === "style" && tag === "img") {
              const allowed = v.match(/display\s*:\s*block|margin-(left|right)\s*:\s*auto|margin\s*:[^;]+|width\s*:\s*[^;]+/gi);
              if (!allowed) continue;
              v = allowed.join("; ");
            }
            if (
              (attrName === "href" || attrName === "src") &&
              /^\s*(javascript|data|vbscript):/i.test(v)
            )
              continue;
            if ((attrName === "href" || attrName === "src") && v && !SAFE_URL.test(v.trim()))
              continue;
            attrs += ` ${attrName}="${escapeAttr(v)}"`;
          }
          if (tag === "a" && attrs.includes("href=") && !attrs.includes("rel=")) {
            attrs += ' rel="noopener noreferrer"';
          }
        }
        // htmlparser2 treats all tags as not self-closing except via explicit `/`; void tags never need closing
        out += `<${tag}${attrs}>`;
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (tag === "script" || tag === "style") {
          if (skipStack[skipStack.length - 1] === tag) skipStack.pop();
          return;
        }
        if (skipStack.length > 0) return;
        if (!ALLOWED_TAGS.has(tag)) return;
        if (VOID_TAGS.has(tag)) return;
        out += `</${tag}>`;
      },
      ontext(text) {
        if (skipStack.length > 0) return;
        out += escapeHtml(text);
      },
      oncomment() {
        // strip comments entirely
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true },
  );

  parser.write(html);
  parser.end();
  return out;
}
