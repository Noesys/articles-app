import { Parser } from "htmlparser2";

export interface ContentBlock {
  index: number;
  html: string;
  text: string;
  imageOnly: boolean;
}

const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "blockquote",
  "pre",
  "table",
  "hr",
]);

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWordsText(text: string): number {
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

export function countWordsHtml(html: string): number {
  return countWordsText(textOf(html));
}

/** Split sanitized article HTML into top-level blocks. Stable order, index-based. */
export function splitContentBlocks(html: string): ContentBlock[] {
  const blocks: string[] = [];
  let depth = 0;
  let current = "";
  let inBlock = false;
  let blockTag = "";

  const parser = new Parser(
    {
      onopentag(name) {
        const tag = name.toLowerCase();
        if (depth === 0 && BLOCK_TAGS.has(tag)) {
          inBlock = true;
          blockTag = tag;
          current = `<${tag}>`;
          if (tag === "hr") {
            blocks.push(current);
            inBlock = false;
            current = "";
          }
          depth = 1;
          return;
        }
        if (inBlock) {
          depth++;
          current += `<${tag}>`;
        }
      },
      ontext(text) {
        if (inBlock) current += text;
        else if (text.trim()) {
          // Loose text outside blocks becomes its own paragraph block
          blocks.push(`<p>${text.trim()}</p>`);
        }
      },
      onclosetag(name) {
        const tag = name.toLowerCase();
        if (inBlock) {
          if (tag !== "hr") current += `</${tag}>`;
          depth--;
          if (depth <= 0) {
            blocks.push(current);
            current = "";
            inBlock = false;
            depth = 0;
          }
        }
      },
    },
    { decodeEntities: false, lowerCaseTags: true },
  );

  parser.write(html ?? "");
  parser.end();
  if (inBlock && current) blocks.push(current);

  const out: ContentBlock[] = [];
  for (const b of blocks) {
    const text = textOf(b);
    const hasImg = /<img[\s>]/i.test(b);
    out.push({
      index: out.length,
      html: b,
      text,
      imageOnly: hasImg && !text,
    });
  }
  return out;
}

export async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { countWordsText };
