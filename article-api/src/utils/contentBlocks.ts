/**
 * Articles are stored as Markdown (the editor's HTML is converted client-side
 * before submit), so a "block" is a blank-line-separated chunk: paragraph,
 * heading, list, table, fenced code. Blocks carry exact offsets into the
 * original string so a replacement leaves every other byte untouched.
 */
export interface ContentBlock {
  index: number;
  /** Exact source slice for this block (no surrounding blank lines). */
  raw: string;
  /** Offsets into the original content: content.slice(start, end) === raw. */
  start: number;
  end: number;
  /** Raw with the stored HTML entity escaping undone — what the AI reads. */
  text: string;
  imageOnly: boolean;
  isCode: boolean;
  isRule: boolean;
}

export function decodeBasicEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");
}

/** Same algorithm the submit endpoint uses to enforce an article type's minimum words. */
export function countWords(content: string): number {
  if (!content || content.trim() === "" || content.trim() === "<p></p>") return 0;
  const text = content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 0;
  return text.split(" ").filter(Boolean).length;
}

const IMAGE_LINE = /^\s*(!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>)\s*$/i;
const FENCE = /^\s*(```|~~~)/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export function splitContentBlocks(content: string): ContentBlock[] {
  const src = content ?? "";
  const blocks: ContentBlock[] = [];

  let blockStart = -1;
  let blockEnd = -1;
  let inFence = false;

  const flush = () => {
    if (blockStart < 0) return;
    const raw = src.slice(blockStart, blockEnd);
    const lines = raw.split(/\r?\n/);
    blocks.push({
      index: blocks.length,
      raw,
      start: blockStart,
      end: blockEnd,
      text: decodeBasicEntities(raw).trim(),
      imageOnly: lines.every((l) => IMAGE_LINE.test(l)),
      isCode: FENCE.test(lines[0] ?? ""),
      isRule: lines.length === 1 && RULE.test(lines[0]),
    });
    blockStart = -1;
  };

  let pos = 0;
  while (pos <= src.length) {
    let nl = src.indexOf("\n", pos);
    if (nl === -1) nl = src.length;
    const line = src.slice(pos, nl);
    const isBlank = line.trim() === "";

    if (FENCE.test(line)) {
      if (blockStart < 0) blockStart = pos;
      inFence = !inFence;
      blockEnd = pos + line.replace(/\s+$/, "").length;
    } else if (inFence) {
      blockEnd = pos + line.replace(/\r$/, "").length;
    } else if (isBlank) {
      flush();
    } else {
      if (blockStart < 0) blockStart = pos;
      blockEnd = pos + line.replace(/\s+$/, "").length;
    }

    if (nl >= src.length) break;
    pos = nl + 1;
  }
  flush();
  return blocks;
}

/** Blocks worth sending to the AI: real prose, not images/code/rules/one-liners. */
export function isSuggestableBlock(b: ContentBlock): boolean {
  return !b.imageOnly && !b.isCode && !b.isRule && countWords(b.text) >= 6;
}

export function replaceBlock(content: string, block: ContentBlock, replacement: string): string {
  return content.slice(0, block.start) + replacement + content.slice(block.end);
}

export async function hashText(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
