import type { ArticleApi } from "./api.js";
import { paginationLine } from "./format.js";
import type { ArticleSummary } from "./types.js";

export interface ArticleListFilters {
  month?: string;
  status?: string;
  type?: string;
  author?: string;
  page?: number;
  limit?: number;
}

export interface ArticleListItem extends ArticleSummary {
  author_name?: string | null;
  author_email?: string | null;
  article_type_id?: string | null;
  scored_at?: string | null;
  published_url?: string | null;
}

export async function listArticles(
  api: ArticleApi,
  filters: ArticleListFilters,
): Promise<string> {
  const { data, pagination } = await api.getEnvelope<ArticleListItem[]>("/api/admin/articles", {
    month: filters.month,
    status: filters.status,
    type: filters.type,
    author: filters.author,
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
  });

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return `No articles match the filters.${paginationLine(pagination)}`;
  }

  const lines = [
    `# Articles (${rows.length} on this page)`,
    "",
    ...rows.map((a) => {
      const bits = [
        `**${a.title || "Untitled"}**`,
        `id: ${a.id}`,
        a.author_name ? `author: ${a.author_name}` : null,
        a.status ? `status: ${a.status}` : null,
        a.ai_score != null ? `score: ${a.ai_score}` : "score: —",
        a.submitted_at ? `submitted: ${a.submitted_at}` : null,
        a.article_type_name ? `type: ${a.article_type_name}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" · ")}`;
    }),
    paginationLine(pagination),
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export async function listPersonArticles(
  api: ArticleApi,
  userId: string,
  filters: Omit<ArticleListFilters, "author">,
): Promise<string> {
  const { data, pagination } = await api.getEnvelope<ArticleListItem[]>(
    `/api/admin/users/${encodeURIComponent(userId)}/articles`,
    {
      month: filters.month,
      status: filters.status,
      type: filters.type,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    },
  );

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return `No articles for this person with the given filters.${paginationLine(pagination)}`;
  }

  const lines = [
    `# Articles for ${userId} (${rows.length} on this page)`,
    "",
    ...rows.map((a) => {
      const bits = [
        `**${a.title || "Untitled"}**`,
        `id: ${a.id}`,
        a.status ? `status: ${a.status}` : null,
        a.ai_score != null ? `score: ${a.ai_score}` : "score: —",
        a.submitted_at ? `submitted: ${a.submitted_at}` : null,
        a.article_type_name ? `type: ${a.article_type_name}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" · ")}`;
    }),
    paginationLine(pagination),
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export async function formatArticleStats(
  api: ArticleApi,
  filters: Pick<ArticleListFilters, "month" | "status" | "type">,
): Promise<string> {
  const stats = await api.getJson<{
    total: number;
    approved: number;
    pending: number;
    rewrite_required: number;
    failed: number;
  }>("/api/admin/articles/stats", {
    month: filters.month,
    status: filters.status,
    type: filters.type,
  });

  const scope = [
    filters.month ? `month=${filters.month}` : null,
    filters.status ? `status=${filters.status}` : null,
    filters.type ? `type=${filters.type}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return [
    `# Article stats${scope ? ` (${scope})` : " (all)"}`,
    "",
    `- **Total:** ${stats.total}`,
    `- **Approved:** ${stats.approved}`,
    `- **Pending:** ${stats.pending}`,
    `- **Rewrite required:** ${stats.rewrite_required}`,
    `- **Failed:** ${stats.failed}`,
  ].join("\n");
}

export interface ContentSuggestion {
  id: string;
  article_id?: string;
  version?: number;
  title?: string | null;
  reason?: string | null;
  parameter_name?: string | null;
  target_block_index?: number | null;
  old_text?: string | null;
  new_text?: string | null;
  applied?: boolean | number | null;
  stale?: boolean | null;
}

export async function formatSuggestions(
  api: ArticleApi,
  articleId: string,
  version?: number,
): Promise<string> {
  const payload = await api.getJson<{ suggestions: ContentSuggestion[] }>(
    `/api/admin/articles/${encodeURIComponent(articleId)}/suggestions`,
    version !== undefined ? { version } : undefined,
  );
  const list = payload.suggestions ?? [];
  if (!list.length) {
    return `No AI suggestions stored for article ${articleId}${version != null ? ` version ${version}` : ""}.`;
  }

  const lines = [`# Suggestions for ${articleId} (${list.length})`, ""];
  for (const s of list) {
    lines.push(`## ${s.title || s.id}`);
    lines.push(`- **ID:** ${s.id}`);
    if (s.parameter_name) lines.push(`- **Parameter:** ${s.parameter_name}`);
    if (s.version != null) lines.push(`- **Version:** ${s.version}`);
    lines.push(`- **Applied:** ${s.applied ? "yes" : "no"}`);
    if (s.stale) lines.push(`- **Stale:** yes (target text no longer matches)`);
    if (s.reason) lines.push(`- **Reason:** ${s.reason}`);
    if (s.old_text) {
      lines.push("");
      lines.push("**Old:**");
      lines.push("```");
      lines.push(String(s.old_text).slice(0, 1500));
      lines.push("```");
    }
    if (s.new_text) {
      lines.push("**New:**");
      lines.push("```");
      lines.push(String(s.new_text).slice(0, 1500));
      lines.push("```");
    }
    lines.push("");
  }
  return lines.join("\n");
}
