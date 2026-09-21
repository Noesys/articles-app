import { z } from "zod";
import { sanitizeHtmlServer } from "../../utils/sanitize";
import {
  splitContentBlocks,
  hashText,
  countWordsHtml,
} from "../../utils/contentBlocks";
import { countWordsServer } from "../../routes/user/articles";
import { evaluateSuggestions } from "./ai.service";
import type { Bindings } from "../../types/shared-types";

export interface ContentSuggestion {
  id: string;
  article_id: string;
  version: number;
  title: string;
  reason: string;
  parameter_name: string | null;
  target_block_index: number;
  old_text: string;
  new_text: string;
  applied: number;
  stale?: boolean;
}

export interface RawSuggestion {
  title: string;
  reason: string;
  parameter_name?: string | null;
  target_block_index: number;
  new_text: string;
}

const suggestionItemSchema = z.object({
  title: z.string().min(1).max(200),
  reason: z.string().min(1).max(1000),
  parameter_name: z.string().max(200).nullish(),
  target_block_index: z.number().int().min(0),
  new_text: z.string().min(1).max(20000),
});

const suggestionsSchema = z.object({
  suggestions: z.array(suggestionItemSchema).max(40),
});

export function buildSuggestionsPrompt(
  blocks: { index: number; text: string }[],
  minWords: number,
): string {
  const numbered = blocks
    .map((b) => `[block ${b.index}]\n${b.text.slice(0, 2000)}`)
    .join("\n\n");
  return `
An article has been evaluated. Suggest targeted block-level rewrites an admin can apply verbatim.

Rules:
- Return ONLY replace operations on the numbered text blocks below. No inserts, no deletes, no reordering.
- Each suggestion targets exactly one block via target_block_index.
- new_text must be a full replacement for that block as an HTML paragraph (e.g. <p>...</p>). Keep it the same topic and roughly the same length or longer — NEVER shorten the article below ${minWords} total words.
- Prefer blocks with weak clarity, repetition, or thin evidence. Skip image-only blocks.
- Keep language simple and direct.
- Do not repeat the same block unless the fixes are distinct.

Blocks:
${numbered}
`.trim();
}

/** Best-effort suggestion pass — never throws; failures only log. */
export async function generateAndStoreSuggestions(
  db: D1Database,
  articleId: string,
  version: number,
  content: string,
  bindings: Bindings,
): Promise<void> {
  try {
    const blocks = splitContentBlocks(content).filter((b) => !b.imageOnly && b.text);
    if (blocks.length === 0) return;

    const typeRow = await db
      .prepare(
        `SELECT a.article_type_id, COALESCE(at.min_words, 1000) AS min_words
         FROM articles a LEFT JOIN article_types at ON at.id = a.article_type_id
         WHERE a.id = ? LIMIT 1`,
      )
      .bind(articleId)
      .first<{ article_type_id: string; min_words: number }>();
    const minWords = Number(typeRow?.min_words ?? 1000) || 1000;
    const totalWords = countWordsServer(content);

    console.log(
      `suggestions: ${blocks.length} eligible blocks, ${totalWords} total words, min=${minWords}`,
    );
    const prompt = buildSuggestionsPrompt(
      blocks.map((b) => ({ index: b.index, text: b.text })),
      minWords,
    );
    const result = await evaluateSuggestions(prompt, suggestionsSchema, bindings);
    if (result && typeof result === "object" && "__error" in (result as Record<string, unknown>)) {
      console.warn("suggestions: AI returned error:", (result as Record<string, unknown>).__error);
      return;
    }
    const raw = (result as unknown as { suggestions: RawSuggestion[] }).suggestions ?? [];
    if (!Array.isArray(raw) || raw.length === 0) {
      console.log("suggestions: AI returned no suggestions");
      return;
    }
    console.log(`suggestions: AI returned ${raw.length} candidates`);

    const now = new Date().toISOString();
    const seen = new Set<number>();
    for (const s of raw) {
      const idx = Number(s.target_block_index);
      if (!Number.isInteger(idx)) continue;
      const block = blocks.find((b) => b.index === idx);
      if (!block) continue;
      const clean = sanitizeHtmlServer(String(s.new_text ?? "")).trim();
      if (!clean) continue;
      // Min-words guard at creation: discard suggestions that would breach it.
      const projected = totalWords - countWordsHtml(block.html) + countWordsHtml(clean);
      if (projected < minWords) {
        console.warn(`suggestions: discarding block ${idx} (would drop below min_words)`);
        continue;
      }
      const id = `sug_${crypto.randomUUID()}`;
      const hash = await hashText(block.text);
      await db
        .prepare(
          `INSERT INTO article_suggestions
            (id, article_id, version, title, reason, parameter_name, target_block_index, old_text, old_text_hash, new_text, applied, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          id,
          articleId,
          version,
          String(s.title ?? "Suggested rewrite").slice(0, 200),
          String(s.reason ?? "").slice(0, 1000),
          s.parameter_name ? String(s.parameter_name).slice(0, 200) : null,
          idx,
          block.text.slice(0, 8000),
          hash,
          clean.slice(0, 20000),
          now,
          now,
        )
        .run();
      seen.add(idx);
      void seen;
    }
  } catch (err) {
    console.error("Suggestion pass failed (non-fatal):", err instanceof Error ? err.message : err);
  }
}

export async function listSuggestions(
  db: D1Database,
  articleId: string,
  version?: number,
): Promise<ContentSuggestion[]> {
  const rows = version === undefined
    ? await db
        .prepare(
          `SELECT id, article_id, version, title, reason, parameter_name, target_block_index, old_text, new_text, applied
           FROM article_suggestions WHERE article_id = ? ORDER BY target_block_index ASC, created_at ASC`,
        )
        .bind(articleId)
        .all<ContentSuggestion>()
    : await db
        .prepare(
          `SELECT id, article_id, version, title, reason, parameter_name, target_block_index, old_text, new_text, applied
           FROM article_suggestions WHERE article_id = ? AND version = ? ORDER BY target_block_index ASC, created_at ASC`,
        )
        .bind(articleId, version)
        .all<ContentSuggestion>();
  return rows.results ?? [];
}

/** Apply selected suggestions in block-index order. Returns per-id results. */
export async function applySuggestions(
  db: D1Database,
  articleId: string,
  suggestionIds: string[],
): Promise<{ applied: string[]; failed: { id: string; reason: string }[]; content: string }> {
  const article = await db
    .prepare(
      `SELECT a.content, a.version, COALESCE(at.min_words, 1000) AS min_words
       FROM articles a LEFT JOIN article_types at ON at.id = a.article_type_id
       WHERE a.id = ? LIMIT 1`,
    )
    .bind(articleId)
    .first<{ content: string; version: number; min_words: number }>();
  if (!article) throw new Error("Article not found");
  const minWords = Number(article.min_words ?? 1000) || 1000;

  const placeholders = suggestionIds.map(() => "?").join(",");
  if (!placeholders) return { applied: [], failed: [], content: article.content };
  const rows = await db
    .prepare(
      `SELECT id, version, target_block_index, old_text_hash, new_text, applied
       FROM article_suggestions WHERE article_id = ? AND id IN (${placeholders})`,
    )
    .bind(articleId, ...suggestionIds)
    .all<{
      id: string;
      version: number;
      target_block_index: number;
      old_text_hash: string;
      new_text: string;
      applied: number;
    }>();
  const byId = new Map((rows.results ?? []).map((r) => [r.id, r]));
  const ordered = [...suggestionIds]
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.target_block_index - b.target_block_index);

  let blocks = splitContentBlocks(article.content);
  const applied: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  const now = new Date().toISOString();

  for (const s of ordered) {
    if (s.applied) {
      failed.push({ id: s.id, reason: "Already applied" });
      continue;
    }
    if (s.version !== article.version) {
      failed.push({ id: s.id, reason: "Suggestion is from an older version" });
      continue;
    }
    const block = blocks.find((b) => b.index === s.target_block_index);
    if (!block) {
      failed.push({ id: s.id, reason: "Target block no longer exists" });
      continue;
    }
    const currentHash = await hashText(block.text);
    if (currentHash !== s.old_text_hash) {
      await db
        .prepare(`UPDATE article_suggestions SET updated_at = ? WHERE id = ?`)
        .bind(now, s.id)
        .run();
      failed.push({ id: s.id, reason: "Content changed since suggestion was generated" });
      continue;
    }
    const totalBefore = blocks.reduce((n, b) => n + countWordsHtml(b.html), 0);
    const projected = totalBefore - countWordsHtml(block.html) + countWordsHtml(s.new_text);
    if (projected < minWords) {
      failed.push({
        id: s.id,
        reason: `Applying this would drop the article below the required minimum of ${minWords} words`,
      });
      continue;
    }
    blocks = blocks.map((b) =>
      b.index === s.target_block_index ? { ...b, html: s.new_text, text: block.text } : b,
    );
    // Recompute text for the replaced block
    const fresh = splitContentBlocks(blocks.map((b) => b.html).join(""));
    blocks = fresh;
    applied.push(s.id);
  }

  if (applied.length > 0) {
    const nextContent = blocks.map((b) => b.html).join("");
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(`UPDATE articles SET content = ?, updated_at = ? WHERE id = ?`)
        .bind(nextContent, now, articleId),
    ];
    for (const id of applied) {
      stmts.push(
        db.prepare(`UPDATE article_suggestions SET applied = 1, updated_at = ? WHERE id = ?`).bind(now, id),
      );
    }
    await db.batch(stmts);
    // Clear stale-suggestion cache: re-derive hashes for remaining unapplied ones is done lazily on next apply.
    const updated = await db
      .prepare(`SELECT content FROM articles WHERE id = ? LIMIT 1`)
      .bind(articleId)
      .first<{ content: string }>();
    return { applied, failed, content: updated?.content ?? nextContent };
  }

  return { applied, failed, content: article.content };
}
