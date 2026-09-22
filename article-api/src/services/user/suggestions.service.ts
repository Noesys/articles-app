import { z } from "zod";
import { sanitizeHtmlServer } from "../../utils/sanitize";
import {
  splitContentBlocks,
  isSuggestableBlock,
  replaceBlock,
  hashText,
  countWords,
  decodeBasicEntities,
  type ContentBlock,
} from "../../utils/contentBlocks";
import { isStuckPending } from "../../utils/evaluationTiming";
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
  /** Unapplied and its target text no longer exists in the article. */
  stale?: boolean;
}

interface RawSuggestion {
  title: string;
  reason: string;
  parameter_name?: string | null;
  target_block_index: number;
  new_text: string;
}

// Longer blocks are left alone rather than truncated: the AI rewrites the
// whole block, so a truncated view would silently drop the rest of it.
const MAX_BLOCK_CHARS = 3000;

const suggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      title: z.string().min(1).max(200),
      reason: z.string().min(1).max(1000),
      parameter_name: z.string().max(200).nullish(),
      target_block_index: z.number().int().min(0),
      new_text: z.string().min(1).max(8000),
    }),
  ),
});

function isSeoParameter(name: string): boolean {
  return /seo/i.test(name);
}

function buildSuggestionsPrompt(
  blocks: ContentBlock[],
  minWords: number,
  feedback: string | null,
  parameterNotes: { name: string; feedback: string }[],
): string {
  const numbered = blocks.map((b) => `[block ${b.index}]\n${b.text}`).join("\n\n");
  const seoNotes = parameterNotes.filter((p) => isSeoParameter(p.name));
  const otherNotes = parameterNotes.filter((p) => !isSeoParameter(p.name));
  const formatNotes = (list: { name: string; feedback: string }[]) =>
    list.map((p) => `- ${p.name}: ${p.feedback.replace(/\s+/g, " ").slice(0, 400)}`).join("\n");

  return `
An article was just evaluated. Suggest targeted rewrites of individual blocks that fix the problems the evaluation found, so an admin can apply them one by one. Suggest as many blocks as genuinely need a change — there is no cap on the number of suggestions.

Evaluation feedback:
${feedback ? feedback.slice(0, 3000) : "(none)"}
${otherNotes.length ? `\nPer-parameter feedback:\n${formatNotes(otherNotes)}` : ""}
${seoNotes.length ? `\nSEO parameter feedback (mandatory — see rules below):\n${formatNotes(seoNotes)}` : ""}

Rules:
- The article is Markdown, split into numbered blocks (blank-line separated). Only REPLACE whole blocks. No inserts, deletes or reordering.
- Each suggestion targets exactly one block via target_block_index and must use one of the block numbers listed below.
- new_text is the full replacement for that block, in Markdown, keeping the block's formatting (keep "##" on a heading, keep list markers, etc.). Do not add HTML.
- Keep the same meaning and voice. Each replacement should be about as long as the original or longer; never make the article shorter than ${minWords} total words.
- "reason" says in one sentence what is wrong with the original and how the rewrite fixes it.
- "parameter_name" is the evaluation parameter the change addresses, or null.
- For every non-SEO parameter, only suggest changes that clearly improve the block; if a block is fine, skip it.${
    seoNotes.length
      ? ` For EVERY SEO parameter listed above, you MUST include at least one suggestion that addresses it — pick the block(s) most relevant to that feedback and improve them, even if the fix is small. Do not skip an SEO parameter.`
      : ""
  }
- Do not target the same block twice.
- Keep language simple and direct.

Blocks:
${numbered}
`.trim();
}

/**
 * Best-effort suggestion pass — never throws. Skips if this version already
 * has suggestions (so the post-evaluation pass and a manual "generate" can't
 * duplicate each other).
 */
export async function generateAndStoreSuggestions(
  db: D1Database,
  articleId: string,
  version: number,
  content: string,
  bindings: Bindings,
): Promise<{ created: number; note?: string }> {
  try {
    const existing = await db
      .prepare(`SELECT COUNT(*) AS n FROM article_suggestions WHERE article_id = ? AND version = ?`)
      .bind(articleId, version)
      .first<{ n: number }>();
    if ((existing?.n ?? 0) > 0) return { created: 0, note: "Suggestions already exist" };

    const allBlocks = splitContentBlocks(content);
    const blocks = allBlocks.filter((b) => isSuggestableBlock(b) && b.text.length <= MAX_BLOCK_CHARS);
    if (blocks.length === 0) return { created: 0, note: "No editable text blocks found" };

    const meta = await db
      .prepare(
        `SELECT a.ai_feedback, COALESCE(at.min_words, 1000) AS min_words
         FROM articles a LEFT JOIN article_types at ON at.id = a.article_type_id
         WHERE a.id = ? LIMIT 1`,
      )
      .bind(articleId)
      .first<{ ai_feedback: string | null; min_words: number }>();
    const minWords = Number(meta?.min_words ?? 1000) || 1000;

    const paramRows = await db
      .prepare(
        `SELECT p.name, r.feedback
         FROM article_parameter_results r JOIN parameters p ON p.id = r.parameter_id
         WHERE r.article_id = ? AND r.version = ? AND r.feedback IS NOT NULL
         ORDER BY p.sort_order, p.name`,
      )
      .bind(articleId, version)
      .all<{ name: string; feedback: string }>();

    const prompt = buildSuggestionsPrompt(
      blocks,
      minWords,
      meta?.ai_feedback ?? null,
      paramRows.results ?? [],
    );
    const result = await evaluateSuggestions(prompt, suggestionsSchema, bindings);
    if (result && typeof result === "object" && "__error" in (result as Record<string, unknown>)) {
      console.warn("suggestions: AI error:", (result as Record<string, unknown>).__error);
      return { created: 0, note: "The AI could not produce suggestions this time" };
    }
    const raw = (result as { suggestions?: RawSuggestion[] })?.suggestions ?? [];

    const currentWords = countWords(content);
    const now = new Date().toISOString();
    const usedBlocks = new Set<number>();
    const statements: D1PreparedStatement[] = [];

    for (const s of raw) {
      const block = blocks.find((b) => b.index === Number(s.target_block_index));
      if (!block || usedBlocks.has(block.index)) continue;

      const clean = sanitizeHtmlServer(String(s.new_text ?? "")).trim();
      if (!clean) continue;
      if (decodeBasicEntities(clean).trim() === block.text) continue;

      const projected = currentWords - countWords(block.raw) + countWords(clean);
      if (projected < minWords && projected < currentWords) continue;

      usedBlocks.add(block.index);
      statements.push(
        db
          .prepare(
            `INSERT INTO article_suggestions
              (id, article_id, version, title, reason, parameter_name, target_block_index, old_text, old_text_hash, new_text, applied, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          )
          .bind(
            `sug_${crypto.randomUUID()}`,
            articleId,
            version,
            String(s.title ?? "Suggested rewrite").slice(0, 200),
            String(s.reason ?? "").slice(0, 1000),
            s.parameter_name ? String(s.parameter_name).slice(0, 200) : null,
            block.index,
            block.text,
            await hashText(block.raw),
            clean,
            now,
            now,
          ),
      );
    }

    if (statements.length === 0) {
      return { created: 0, note: "The AI found nothing worth changing" };
    }
    await db.batch(statements);
    return { created: statements.length };
  } catch (err) {
    console.error("Suggestion pass failed (non-fatal):", err instanceof Error ? err.message : err);
    return { created: 0, note: "Suggestion generation failed" };
  }
}

export async function listSuggestions(
  db: D1Database,
  articleId: string,
  version?: number,
): Promise<ContentSuggestion[]> {
  const rows = await db
    .prepare(
      `SELECT id, article_id, version, title, reason, parameter_name, target_block_index, old_text, old_text_hash, new_text, applied
       FROM article_suggestions
       WHERE article_id = ? ${version === undefined ? "" : "AND version = ?"}
       ORDER BY target_block_index ASC, created_at ASC`,
    )
    .bind(...(version === undefined ? [articleId] : [articleId, version]))
    .all<ContentSuggestion & { old_text_hash: string }>();
  const list = rows.results ?? [];

  // Flag unapplied suggestions whose target text is gone from the article.
  let hashes: Set<string> | null = null;
  if (list.some((s) => !s.applied)) {
    const article = await db
      .prepare(`SELECT content FROM articles WHERE id = ? LIMIT 1`)
      .bind(articleId)
      .first<{ content: string }>();
    hashes = new Set();
    for (const b of splitContentBlocks(article?.content ?? "")) hashes.add(await hashText(b.raw));
  }

  return list.map(({ old_text_hash, ...s }) => ({
    ...s,
    stale: !s.applied && hashes ? !hashes.has(old_text_hash) : false,
  }));
}

/** Apply selected suggestions in block order. Returns per-id results. */
export async function applySuggestions(
  db: D1Database,
  articleId: string,
  suggestionIds: string[],
): Promise<{ applied: string[]; failed: { id: string; reason: string }[]; content: string }> {
  const article = await db
    .prepare(
      `SELECT a.content, a.version, a.status, a.updated_at, COALESCE(at.min_words, 1000) AS min_words
       FROM articles a LEFT JOIN article_types at ON at.id = a.article_type_id
       WHERE a.id = ? LIMIT 1`,
    )
    .bind(articleId)
    .first<{
      content: string;
      version: number;
      status: string;
      updated_at: string | null;
      min_words: number;
    }>();
  if (!article) throw new Error("Article not found");

  // An evaluation in flight will write its result for the OLD text.
  if (
    (article.status === "pending" || article.status === "processing") &&
    !isStuckPending(article.updated_at)
  ) {
    throw new Error("Article is currently being evaluated; please wait for it to finish");
  }
  const minWords = Number(article.min_words ?? 1000) || 1000;

  if (suggestionIds.length === 0) return { applied: [], failed: [], content: article.content };
  const placeholders = suggestionIds.map(() => "?").join(",");
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
  const ordered = suggestionIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .sort((a, b) => a.target_block_index - b.target_block_index);

  let content = article.content;
  const applied: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const s of ordered) {
    if (s.applied) {
      failed.push({ id: s.id, reason: "Already applied" });
      continue;
    }
    if (s.version !== article.version) {
      failed.push({ id: s.id, reason: "Suggestion is from an older version" });
      continue;
    }

    // Find the target by content hash, not index: applying an earlier
    // suggestion can add/remove blocks and shift the numbering.
    const matches: ContentBlock[] = [];
    for (const b of splitContentBlocks(content)) {
      if ((await hashText(b.raw)) === s.old_text_hash) matches.push(b);
    }
    const block = matches.find((b) => b.index === s.target_block_index) ?? (matches.length === 1 ? matches[0] : undefined);
    if (!block) {
      failed.push({ id: s.id, reason: "Content changed since this suggestion was generated" });
      continue;
    }

    const next = replaceBlock(content, block, s.new_text);
    const before = countWords(content);
    const after = countWords(next);
    if (after < minWords && after < before) {
      failed.push({
        id: s.id,
        reason: `Applying this would drop the article below the required minimum of ${minWords} words`,
      });
      continue;
    }
    content = next;
    applied.push(s.id);
  }

  if (applied.length === 0) return { applied, failed, content: article.content };

  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [
    // The version guard keeps this from overwriting a concurrent rewrite.
    db
      .prepare(
        `UPDATE articles SET content = ?, admin_edited_at = ?, updated_at = ?,
           pre_edit_content = COALESCE(pre_edit_content, ?)
         WHERE id = ? AND version = ?`,
      )
      // article.content is what the current score/feedback describe; keep the
      // first such text so history snapshots stay consistent with their scores.
      .bind(content, now, now, article.content, articleId, article.version),
    ...applied.map((id) =>
      db.prepare(`UPDATE article_suggestions SET applied = 1, updated_at = ? WHERE id = ?`).bind(now, id),
    ),
  ];
  await db.batch(statements);
  return { applied, failed, content };
}
