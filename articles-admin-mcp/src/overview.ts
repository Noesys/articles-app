import type { ArticleApi } from "./api.js";
import type { Config } from "./config.js";
import type { AdminUser, ArticleBundle, ArticleSummary, ParameterResult } from "./types.js";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

const IMAGE_PATH = /(?:https?:\/\/[^\s)"'<>]+)?(\/api\/images\/[A-Za-z0-9_-]+\/[^\s)"'<>]+)/g;

function paramName(p: ParameterResult): string {
  return String(p.parameterName ?? p.name ?? "Parameter");
}

function paramScore(p: ParameterResult): string {
  const v = p.score ?? p.value;
  return v === null || v === undefined || v === "" ? "—" : String(v);
}

function paramFeedback(p: ParameterResult): string {
  const f = p.feedback ?? p["ai_feedback"] ?? p["reason"];
  return typeof f === "string" && f.trim() ? f.trim() : "";
}

function yesNo(v: unknown): string {
  return v === 1 || v === true ? "Yes" : v === 0 || v === false ? "No" : "—";
}

interface OverviewOptions {
  /**
   * The person's article summary (from their article list). The admin
   * article-detail endpoint does not return `submitted_at`, so when we have the
   * summary we use it to show a real submission date. Optional.
   */
  summary?: ArticleSummary | null;
  /** When false, skip the person profile header and render an article-only view. */
  includeProfile?: boolean;
}

/** Builds the admin overview: profile, latest article, scores, feedback, and full Markdown body. */
export async function buildOverview(
  api: ArticleApi,
  config: Config,
  person: AdminUser,
  bundle: ArticleBundle | null,
  opts: OverviewOptions = {},
): Promise<ContentBlock[]> {
  const blocks: ContentBlock[] = [];
  const lines: string[] = [];
  const includeProfile = opts.includeProfile !== false;

  if (includeProfile) {
    lines.push(`# ${person.name}`);
    lines.push("");
    lines.push(`- **Email:** ${person.email}`);
    lines.push(`- **Job role:** ${person.job_role || "—"}`);
    lines.push(`- **Auth role:** ${person.auth_role || "—"}`);
    lines.push(`- **Active:** ${yesNo(person.is_active)}`);
    lines.push(`- **User ID:** ${person.id}`);
    lines.push("");
  }

  if (!bundle) {
    if (!includeProfile) {
      blocks.push({ type: "text", text: "No article found." });
      return blocks;
    }
    lines.push("## Latest article");
    lines.push("");
    lines.push("This person has no articles yet.");
    blocks.push({ type: "text", text: lines.join("\n") });
    return blocks;
  }

  const a = bundle.article;
  lines.push(`## ${includeProfile ? "Latest article: " : ""}${a.title || "Untitled"}`);
  lines.push("");
  lines.push(`- **Article ID:** ${a.id}`);
  // Article-only view (no profile header) still shows who wrote it, using the
  // author fields this endpoint does return.
  if (!includeProfile && person.name) {
    lines.push(`- **Author:** ${person.name}${person.email && person.email !== "—" ? ` <${person.email}>` : ""}`);
  }
  if (a.article_type_name) lines.push(`- **Type:** ${a.article_type_name}`);
  lines.push(`- **Status:** ${a.status || "—"}`);
  lines.push(`- **Version:** ${a.version ?? "—"}`);

  // The admin article-detail endpoint omits submitted_at / scored_at /
  // pass_threshold (known gap — tracked as a future feature). Show them only
  // when a value is actually available, instead of rendering a bare "—".
  const submitted = a.submitted_at ?? opts.summary?.submitted_at ?? null;
  if (submitted) lines.push(`- **Submitted:** ${submitted}`);
  if (a.scored_at) lines.push(`- **Scored:** ${a.scored_at}`);
  lines.push("");

  lines.push("### Scores");
  lines.push("");
  lines.push(`- **Overall AI score:** ${a.ai_score ?? "not scored yet"}${
    a.pass_threshold != null ? ` (pass threshold ${a.pass_threshold})` : ""
  }`);
  lines.push("");

  if (bundle.parameter_results?.length) {
    lines.push("| Parameter | Score | Feedback |");
    lines.push("|---|---|---|");
    for (const p of bundle.parameter_results) {
      const fb = paramFeedback(p).replace(/\|/g, "\\|").replace(/\n+/g, " ");
      lines.push(`| ${paramName(p)} | ${paramScore(p)} | ${fb || "—"} |`);
    }
    lines.push("");
  }

  lines.push("### Overall feedback");
  lines.push("");
  lines.push(a.ai_feedback?.trim() || "_No feedback yet._");
  lines.push("");

  if (a.suggested_title) {
    lines.push(`**Suggested title:** ${a.suggested_title}`);
    lines.push("");
  }

  const body = typeof a.content === "string" ? a.content : "";

  if (bundle.history?.length) {
    lines.push("### Version history");
    lines.push("");
    lines.push("| Version | Status | Score | Submitted | Title |");
    lines.push("|---|---|---|---|---|");
    const sorted = [...bundle.history].sort(
      (x, y) => (Number(y.version) || 0) - (Number(x.version) || 0),
    );
    for (const h of sorted) {
      const title = String(h.title ?? "")
        .replace(/\|/g, "\\|")
        .replace(/\n+/g, " ")
        .slice(0, 80);
      lines.push(
        `| ${h.version ?? "—"} | ${h.status || "—"} | ${h.score ?? "—"} | ${h.submitted_at || "—"} | ${title || "—"} |`,
      );
    }
    lines.push("");
  }

  lines.push("### Full article (Markdown, as stored)");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(body || "_Empty article body._");
  lines.push("");
  lines.push("---");

  blocks.push({ type: "text", text: lines.join("\n") });

  // Inline the article's images so Claude can see them, within size and count limits.
  const paths = [...new Set([...body.matchAll(IMAGE_PATH)].map((m) => m[1]))];
  const skipped: string[] = [];
  for (const [i, path] of paths.entries()) {
    if (i >= config.maxInlineImages) {
      skipped.push(path);
      continue;
    }
    try {
      const { data, mimeType } = await api.getBinary(path);
      if (data.byteLength > config.maxImageBytes) {
        skipped.push(`${path} (too large: ${data.byteLength} bytes)`);
        continue;
      }
      blocks.push({ type: "image", data: data.toString("base64"), mimeType });
    } catch (err) {
      skipped.push(`${path} (failed: ${(err as Error).message})`);
    }
  }
  if (skipped.length) {
    blocks.push({
      type: "text",
      text: `Images not shown inline:\n${skipped.map((s) => `- ${s}`).join("\n")}`,
    });
  }

  return blocks;
}
