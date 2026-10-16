import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArticleApi } from "./api.js";
import type { Config } from "./config.js";
import { findPeople, getLatestArticle, getPerson } from "./people.js";
import { buildOverview, type ContentBlock } from "./overview.js";
import {
  formatArticleStats,
  formatSuggestions,
  listArticles,
  listPersonArticles,
} from "./articles.js";
import {
  formatArticleTypes,
  formatEmployeeSubmissions,
  formatInsightsSummary,
} from "./insights.js";
import {
  articleId,
  articleStatus,
  limit,
  monthYear,
  page,
  personQuery,
  userId,
} from "./schemas.js";
import type { AdminUser, ArticleBundle } from "./types.js";

type ToolResult = { content: ContentBlock[]; isError?: boolean };

const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: t }], isError: true });

function describePeople(people: AdminUser[]): string {
  return people
    .map((p) => `- ${p.name} <${p.email}> (id: ${p.id}, ${p.job_role || "no job role"})`)
    .join("\n");
}

async function loadBundle(api: ArticleApi, id: string): Promise<ArticleBundle> {
  const bundle = await api.getJson<ArticleBundle>(`/api/admin/articles/${encodeURIComponent(id)}`);
  return {
    article: bundle.article,
    parameter_results: bundle.parameter_results ?? [],
    history: bundle.history ?? [],
  };
}

function safeTool<T extends Record<string, unknown>>(
  handler: (args: T) => Promise<ToolResult>,
): (args: T) => Promise<ToolResult> {
  return async (args) => {
    try {
      return await handler(args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(msg);
    }
  };
}

export function registerTools(server: McpServer, api: ArticleApi, config: Config): void {
  // ── Person lookup ─────────────────────────────────────────────────────────

  server.registerTool(
    "find_person",
    {
      description:
        "Search active people by name, email, or user ID and return matching profiles (id, email, job role). " +
        "Use when you only need to resolve who someone is, or when a name may match several people. " +
        "Do NOT use this if the admin wants the person's latest article — call get_person_overview instead. " +
        "For an exact known user ID profile only, prefer get_person.",
      inputSchema: { query: personQuery },
    },
    safeTool(async ({ query }) => {
      const people = await findPeople(api, query);
      if (!people.length) return text(`No people match "${query}".`);
      return text(`Found ${people.length} match(es):\n${describePeople(people)}`);
    }),
  );

  server.registerTool(
    "get_person",
    {
      description:
        "Fetch one person's profile by exact user ID: name, email, job role, auth role, active flag. " +
        "Requires a user_id from find_person or a prior overview. " +
        "Do NOT use for article content — use get_person_overview or get_article_details.",
      inputSchema: { user_id: userId },
    },
    safeTool(async ({ user_id }) => {
      const p = await getPerson(api, user_id);
      return text(
        [
          `Name: ${p.name}`,
          `Email: ${p.email}`,
          `Job role: ${p.job_role || "—"}`,
          `Auth role: ${p.auth_role || "—"}`,
          `Active: ${p.is_active ? "yes" : "no"}`,
          `User ID: ${p.id}`,
        ].join("\n"),
      );
    }),
  );

  server.registerTool(
    "get_latest_article",
    {
      description:
        "Return a short summary (title, id, status, AI score, submitted_at) of one person's " +
        "most recently submitted article by user_id. " +
        "Use for a quick status check. For full body, scores, feedback, and images, use get_person_overview " +
        "or get_article_details. For older or filtered articles, use list_person_articles.",
      inputSchema: { user_id: userId },
    },
    safeTool(async ({ user_id }) => {
      const a = await getLatestArticle(api, user_id);
      if (!a) return text("This person has no articles yet.");
      return text(
        [
          `Title: ${a.title}`,
          `Article ID: ${a.id}`,
          `Status: ${a.status || "—"}`,
          `AI score: ${a.ai_score ?? "not scored yet"}`,
          `Submitted: ${a.submitted_at || "—"}`,
        ].join("\n"),
      );
    }),
  );

  server.registerTool(
    "get_article_details",
    {
      description:
        "Load one article by article_id: full Markdown body, parameter scores, overall feedback, " +
        "version history, and inline images. " +
        "Use when the admin already has an article ID (from list_articles, list_person_articles, or overview). " +
        "Prefer get_person_overview when starting from a person's name. " +
        "Note: submitted_at / scored_at may be missing on this endpoint; list tools include submission dates.",
      inputSchema: { article_id: articleId },
    },
    safeTool(async ({ article_id }) => {
      const bundle = await loadBundle(api, article_id);
      const blocks = await buildOverview(api, config, placeholderPerson(bundle), bundle, {
        includeProfile: false,
      });
      return { content: blocks };
    }),
  );

  server.registerTool(
    "get_person_overview",
    {
      description:
        "PRIMARY tool for 'tell me about X' / 'X's latest article' questions. " +
        "Given a name, email, or user ID: returns profile + latest article (full Markdown, scores, feedback, inline images). " +
        "If several people match the name, returns the list and asks which one — never guesses. " +
        "Prefer this over chaining find_person → get_person → get_latest_article → get_article_details. " +
        "Use list_person_articles when the admin wants older articles or filters (month/status), not only the latest.",
      inputSchema: { query: personQuery },
    },
    safeTool(async ({ query }) => {
      const matches = await findPeople(api, query);
      if (!matches.length) return text(`No people match "${query}".`);
      if (matches.length > 1) {
        return text(
          `"${query}" matches ${matches.length} people. Ask the admin which one they mean, then call again with the exact email or user ID:\n${describePeople(matches)}`,
        );
      }

      const person = matches[0];
      const latest = await getLatestArticle(api, person.id);
      if (!latest) {
        return { content: await buildOverview(api, config, person, null) };
      }

      try {
        const bundle = await loadBundle(api, latest.id);
        return {
          content: await buildOverview(api, config, person, bundle, { summary: latest }),
        };
      } catch (err) {
        return fail(
          `Found ${person.name}'s latest article "${latest.title}" but could not load it: ${(err as Error).message}`,
        );
      }
    }),
  );

  // ── Article lists & dashboard ─────────────────────────────────────────────

  server.registerTool(
    "list_articles",
    {
      description:
        "Paginated global article list for admins (same filters as the All Articles UI). " +
        "Filter by month (YYYY-MM), status (pending|approved|rewrite_required|failed), " +
        "article type ID, and/or author display name (exact match). " +
        "Use for 'show me this month's pending articles', 'articles by Priya Shah', etc. " +
        "Returns summaries only — call get_article_details for full body. " +
        "Default month is none (all months unless month is set). Prefer setting month when the admin means 'this month'.",
      inputSchema: {
        month: monthYear.optional(),
        status: articleStatus.optional(),
        type: z.string().min(1).optional().describe("Article type ID (from list_article_types)"),
        author: z
          .string()
          .min(1)
          .optional()
          .describe("Exact author display name as shown in the UI (e.g. Priya Shah)"),
        page,
        limit,
      },
    },
    safeTool(async (args) => text(await listArticles(api, args))),
  );

  server.registerTool(
    "list_person_articles",
    {
      description:
        "Paginated list of one person's articles by user_id, newest first. " +
        "Optional filters: month (YYYY-MM), status, article type ID. " +
        "Use when the admin wants more than the latest article, or a filtered history. " +
        "For full text of one row, take its article_id and call get_article_details.",
      inputSchema: {
        user_id: userId,
        month: monthYear.optional(),
        status: articleStatus.optional(),
        type: z.string().min(1).optional().describe("Article type ID"),
        page,
        limit,
      },
    },
    safeTool(async ({ user_id, ...filters }) =>
      text(await listPersonArticles(api, user_id, filters)),
    ),
  );

  server.registerTool(
    "get_article_stats",
    {
      description:
        "Dashboard counts of articles: total, approved, pending, rewrite_required, failed. " +
        "Optional filters: month (YYYY-MM), status, article type ID — same as the admin Articles page stats strip. " +
        "Use for 'how many pending this month?' or overall pipeline health. Not per-person (use list_person_articles for that).",
      inputSchema: {
        month: monthYear.optional(),
        status: articleStatus.optional(),
        type: z.string().min(1).optional().describe("Article type ID"),
      },
    },
    safeTool(async (args) => text(await formatArticleStats(api, args))),
  );

  // ── Insights ──────────────────────────────────────────────────────────────

  server.registerTool(
    "get_insights_summary",
    {
      description:
        "Analytics summary by article type and scoring parameter over an inclusive month range. " +
        "Requires start and end as YYYY-MM (end must be >= start). " +
        "Use for 'how are Technical Writing scores looking Sep–Oct?' or rubric health over time. " +
        "For who submitted how many articles, use get_employee_submissions instead.",
      inputSchema: {
        start: monthYear.describe("Range start YYYY-MM"),
        end: monthYear.describe("Range end YYYY-MM (inclusive)"),
      },
    },
    safeTool(async ({ start, end }) => {
      if (end < start) return fail("end must be >= start (both YYYY-MM).");
      return text(await formatInsightsSummary(api, start, end));
    }),
  );

  server.registerTool(
    "get_employee_submissions",
    {
      description:
        "Per-employee article submission counts by month over an inclusive YYYY-MM range. " +
        "Use for 'who hasn't submitted?', 'submission volume by person', or compliance-style rollups. " +
        "Pairs well with get_insights_summary (scores) vs this tool (counts).",
      inputSchema: {
        start: monthYear.describe("Range start YYYY-MM"),
        end: monthYear.describe("Range end YYYY-MM (inclusive)"),
      },
    },
    safeTool(async ({ start, end }) => {
      if (end < start) return fail("end must be >= start (both YYYY-MM).");
      return text(await formatEmployeeSubmissions(api, start, end));
    }),
  );

  // ── Scoring config & suggestions ──────────────────────────────────────────

  server.registerTool(
    "list_article_types",
    {
      description:
        "List configured article types (scoring rubrics): pass threshold, score range, min words, " +
        "score prompt snippet, and parameter names. " +
        "Use when the admin asks what types exist, how scoring works, or which type ID to pass to list_articles. " +
        "Read-only — does not change configuration.",
      inputSchema: {},
    },
    safeTool(async () => text(await formatArticleTypes(api))),
  );

  server.registerTool(
    "get_article_suggestions",
    {
      description:
        "List stored AI rewrite suggestions for an article (old/new text, reason, parameter, applied/stale flags). " +
        "Optional version filter. Read-only — does not generate or apply suggestions. " +
        "Use after get_article_details when the admin asks what the AI suggested changing.",
      inputSchema: {
        article_id: articleId,
        version: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Article version number; omit for all stored suggestions"),
      },
    },
    safeTool(async ({ article_id, version }) =>
      text(await formatSuggestions(api, article_id, version)),
    ),
  );
}

/** get_article_details has no user context, so build a minimal profile from the article's author fields. */
function placeholderPerson(bundle: ArticleBundle): AdminUser {
  const a = bundle.article;
  return {
    id: a.user_id ?? "unknown",
    email: a.author_email ?? "—",
    name: a.author_name ?? "Article author",
    job_role: a.job_role ?? null,
    auth_role: null,
    is_active: null,
  };
}
