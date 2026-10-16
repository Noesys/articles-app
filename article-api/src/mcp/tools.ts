import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { getArticles, getArticleById as getAdminArticleById, getArticleStats } from "../services/admin/articles.service";
import { getUsers, getUserById, getArticlesByUser as getAdminArticlesByUser } from "../services/admin/users.service";
import { getArticleTypes } from "../services/admin/articleTypes.service";
import { getSummary, getEmployeeSubmissions } from "../services/admin/insights.service";
import { listSuggestions } from "../services/user/suggestions.service";
import {
  getArticlesByUser,
  getArticleById as getUserArticleById,
  createArticle,
} from "../services/user/articles";
import {
  snapshotArticle,
  updateArticleForRewrite,
} from "../services/user/articleHistory";
import { getParameterResults } from "../services/admin/articleParameterResults.service";
import { startEvaluation } from "../services/user/startEvaluation.service";
import { sanitizeHtmlServer } from "../utils/sanitize";
import { isEvaluationInFlight } from "../utils/evaluationTiming";
import { countWordsServer } from "../routes/user/articles";
import type { Bindings, ContiqMcpProps } from "../types/shared-types";
import { requireMcpProps, requireRole, type ContiqRole } from "./auth-context";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

const text = (t: string): ToolResult => ({ content: [{ type: "text", text: t }] });
const fail = (t: string): ToolResult => ({ content: [{ type: "text", text: t }], isError: true });

const monthYear = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Use YYYY-MM")
  .describe("Calendar month as YYYY-MM (example: 2026-10)");

const articleStatus = z
  .enum(["pending", "approved", "rewrite_required", "failed", "processing"])
  .describe("Article evaluation status");

function safeTool<T extends Record<string, unknown>>(
  handler: (args: T, props: ContiqMcpProps, env: Bindings) => Promise<ToolResult>,
  env: Bindings,
  roles: ContiqRole[],
): (args: T) => Promise<ToolResult> {
  return async (args) => {
    try {
      const props = requireMcpProps();
      requireRole(props, roles);
      return await handler(args, props, env);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  };
}

async function findPeople(db: D1Database, query: string) {
  const q = query.trim().toLowerCase();
  const users = await getUsers(db);
  return users.filter(
    (u) =>
      u.id.toLowerCase() === q ||
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q),
  );
}

function registerAdminTools(server: McpServer, env: Bindings): void {
  const roles: ContiqRole[] = ["admin"];

  server.registerTool(
    "find_contiq_person",
    {
      description:
        "Search Contiq people (writers/admins) by name, email, or exact user ID. " +
        "Returns matching profiles. Use when you need to resolve who someone is before loading their articles. " +
        "If several people match, ask which one — do not guess. Admin-only.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Name fragment, full email, or Contiq user id (usr_…)"),
      },
    },
    safeTool(async ({ query }) => {
      const people = await findPeople(env.DB, query);
      if (!people.length) return text(`No people match "${query}".`);
      return text(
        people
          .map((p) => `- ${p.name} <${p.email}> (id: ${p.id}, job: ${p.job_role || "—"})`)
          .join("\n"),
      );
    }, env, roles),
  );

  server.registerTool(
    "get_contiq_person_profile",
    {
      description:
        "Fetch one Contiq person's profile by exact user ID: name, email, job role, auth role, active flag. " +
        "Does not include article content. Admin-only.",
      inputSchema: {
        user_id: z.string().min(1).describe("Exact Contiq user id from find_contiq_person"),
      },
    },
    safeTool(async ({ user_id }) => {
      const p = await getUserById(env.DB, user_id);
      if (!p) return fail(`No user with id ${user_id}`);
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
    }, env, roles),
  );

  server.registerTool(
    "get_person_latest_article_summary",
    {
      description:
        "Return a short summary of one person's most recently submitted Contiq article " +
        "(title, id, status, AI score, submitted_at). For full body and feedback use get_article_full_details. Admin-only.",
      inputSchema: {
        user_id: z.string().min(1).describe("Contiq user id"),
      },
    },
    safeTool(async ({ user_id }) => {
      const { data } = await getAdminArticlesByUser(env.DB, user_id, undefined, undefined, undefined, 1, 1);
      const a = data[0];
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
    }, env, roles),
  );

  server.registerTool(
    "get_person_article_overview",
    {
      description:
        "PRIMARY admin tool for 'tell me about X' / 'X's latest article'. " +
        "Given a name, email, or user ID: returns profile plus latest article title/status/score and a content preview. " +
        "If several people match, returns the list and asks which one. Admin-only.",
      inputSchema: {
        query: z.string().min(1).describe("Name, email, or user id"),
      },
    },
    safeTool(async ({ query }) => {
      const matches = await findPeople(env.DB, query);
      if (!matches.length) return text(`No people match "${query}".`);
      if (matches.length > 1) {
        return text(
          `"${query}" matches ${matches.length} people. Ask which one, then call again with exact email or user id:\n` +
            matches.map((p) => `- ${p.name} <${p.email}> (${p.id})`).join("\n"),
        );
      }
      const person = matches[0];
      const { data } = await getAdminArticlesByUser(
        env.DB,
        person.id,
        undefined,
        undefined,
        undefined,
        1,
        1,
      );
      const latest = data[0];
      const header = `Profile: ${person.name} <${person.email}> (${person.id})\nJob: ${person.job_role || "—"}`;
      if (!latest) return text(`${header}\n\nNo articles yet.`);
      const detail = await getAdminArticleById(env.DB, latest.id);
      const preview = (detail?.content ?? "").replace(/<[^>]+>/g, " ").slice(0, 1200);
      return text(
        [
          header,
          "",
          `Latest article: ${latest.title} (${latest.id})`,
          `Status: ${latest.status}; AI score: ${latest.ai_score ?? "n/a"}; Submitted: ${latest.submitted_at}`,
          "",
          "Content preview (plain text, truncated):",
          preview || "(empty)",
          "",
          "For full Markdown/HTML body, parameter scores, and suggestions, call get_article_full_details with this article_id.",
        ].join("\n"),
      );
    }, env, roles),
  );

  server.registerTool(
    "get_article_full_details",
    {
      description:
        "Load one Contiq article by article_id for admins: metadata, HTML/Markdown body, overall AI feedback, " +
        "per-parameter scores, and version. Use when you already have an article id. Admin-only.",
      inputSchema: {
        article_id: z.string().min(1).describe("Contiq article id"),
      },
    },
    safeTool(async ({ article_id }) => {
      const article = await getAdminArticleById(env.DB, article_id);
      if (!article) return fail(`Article ${article_id} not found`);
      const params = await getParameterResults(env.DB, article_id, article.version);
      return text(
        [
          `Title: ${article.title}`,
          `ID: ${article.id}`,
          `Author: ${article.author_name ?? "—"} (${article.user_id ?? "—"})`,
          `Type: ${article.article_type_name ?? article.article_type_id}`,
          `Status: ${article.status}; version ${article.version}`,
          `AI score: ${article.ai_score ?? "n/a"}`,
          `Submitted: ${article.submitted_at}`,
          "",
          "Overall AI feedback:",
          article.ai_feedback || "(none)",
          "",
          "Parameter results:",
          params.length
            ? params.map((p) => `- ${p.name}: ${p.value ?? "—"}`).join("\n")
            : "(none)",
          "",
          "Body (HTML):",
          article.content || "(empty)",
        ].join("\n"),
      );
    }, env, roles),
  );

  server.registerTool(
    "list_all_articles",
    {
      description:
        "Paginated global Contiq article list for admins (All Articles UI). " +
        "Filter by month (YYYY-MM), status, article type ID, and/or exact author display name. " +
        "Returns summaries only — use get_article_full_details for the body. Admin-only.",
      inputSchema: {
        month: monthYear.optional(),
        status: articleStatus.optional(),
        type: z.string().min(1).optional().describe("Article type ID from list_article_types_and_rubrics"),
        author: z.string().min(1).optional().describe("Exact author display name as in the UI"),
        page: z.number().int().positive().optional().describe("Page number, default 1"),
        limit: z.number().int().min(1).max(100).optional().describe("Page size, default 20, max 100"),
      },
    },
    safeTool(async (args) => {
      const page = args.page ?? 1;
      const limit = args.limit ?? 20;
      const { data, total } = await getArticles(
        env.DB,
        args.month,
        args.status,
        args.type,
        page,
        limit,
        args.author,
      );
      const lines = data.map(
        (a) =>
          `- ${a.title} | id=${a.id} | ${a.author_name} | ${a.status} | score=${a.ai_score ?? "n/a"} | ${a.submitted_at}`,
      );
      return text(`Total ${total}. Page ${page} (limit ${limit}):\n${lines.join("\n") || "(none)"}`);
    }, env, roles),
  );

  server.registerTool(
    "list_person_articles",
    {
      description:
        "Paginated list of one person's Contiq articles by user_id, newest first. " +
        "Optional month/status filters. Admin-only.",
      inputSchema: {
        user_id: z.string().min(1).describe("Contiq user id"),
        month: monthYear.optional(),
        status: articleStatus.optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    safeTool(async ({ user_id, month, status, page, limit }) => {
      const { data, total } = await getAdminArticlesByUser(
        env.DB,
        user_id,
        month,
        status,
        undefined,
        page ?? 1,
        limit ?? 20,
      );
      return text(
        `Total ${total}. Showing ${data.length}:\n` +
          (data
            .map((a) => `- ${a.title} | ${a.id} | ${a.status} | score=${a.ai_score ?? "n/a"} | ${a.submitted_at}`)
            .join("\n") || "(none)"),
      );
    }, env, roles),
  );

  server.registerTool(
    "get_article_pipeline_stats",
    {
      description:
        "Dashboard counts of Contiq articles: total, approved, pending, rewrite_required, failed. " +
        "Optional month / status / type filters (same as admin Articles stats). Admin-only.",
      inputSchema: {
        month: monthYear.optional(),
        status: articleStatus.optional(),
        type: z.string().min(1).optional().describe("Article type ID"),
      },
    },
    safeTool(async (args) => {
      const stats = await getArticleStats(env.DB, args.month, args.status, args.type);
      return text(JSON.stringify(stats, null, 2));
    }, env, roles),
  );

  server.registerTool(
    "get_insights_score_summary",
    {
      description:
        "Analytics summary by article type and scoring parameter over an inclusive YYYY-MM range. " +
        "Use for rubric/score health over time. Admin-only.",
      inputSchema: {
        start: monthYear.describe("Range start YYYY-MM"),
        end: monthYear.describe("Range end YYYY-MM inclusive"),
      },
    },
    safeTool(async ({ start, end }) => {
      if (end < start) return fail("end must be >= start");
      const summary = await getSummary(env.DB, { start, end });
      return text(JSON.stringify(summary, null, 2));
    }, env, roles),
  );

  server.registerTool(
    "get_employee_submission_counts",
    {
      description:
        "Per-employee article submission counts by month over an inclusive YYYY-MM range. " +
        "Use for who submitted / who has not. Admin-only.",
      inputSchema: {
        start: monthYear.describe("Range start YYYY-MM"),
        end: monthYear.describe("Range end YYYY-MM inclusive"),
      },
    },
    safeTool(async ({ start, end }) => {
      if (end < start) return fail("end must be >= start");
      const rows = await getEmployeeSubmissions(env.DB, { start, end });
      return text(JSON.stringify(rows, null, 2));
    }, env, roles),
  );

  server.registerTool(
    "list_article_types_and_rubrics",
    {
      description:
        "List configured Contiq article types (scoring rubrics): id, name, pass threshold, min words, " +
        "and whether the type is evaluatable. Use to pick article_type_id for filters or submissions. Admin-only.",
      inputSchema: {},
    },
    safeTool(async () => {
      const types = await getArticleTypes(env.DB);
      return text(
        types
          .map(
            (t) =>
              `- ${t.name} | id=${t.id} | min_words=${(t as { min_words?: number }).min_words ?? "—"} | active=${t.is_active} | evaluatable=${t.is_evaluatable}`,
          )
          .join("\n") || "(none)",
      );
    }, env, roles),
  );

  server.registerTool(
    "list_article_ai_suggestions",
    {
      description:
        "List stored AI rewrite suggestions for an article (old/new text, reason, parameter, applied/stale). " +
        "Read-only — does not generate or apply suggestions. Admin-only.",
      inputSchema: {
        article_id: z.string().min(1).describe("Contiq article id"),
        version: z.number().int().positive().optional().describe("Article version; omit for all"),
      },
    },
    safeTool(async ({ article_id, version }) => {
      const suggestions = await listSuggestions(env.DB, article_id, version);
      return text(JSON.stringify(suggestions, null, 2));
    }, env, roles),
  );
}

function registerUserTools(server: McpServer, env: Bindings): void {
  const roles: ContiqRole[] = ["user", "admin"];

  server.registerTool(
    "list_my_articles",
    {
      description:
        "List Contiq articles owned by the signed-in user (the OAuth identity). " +
        "Optional month (YYYY-MM) filter; set view_all=true to ignore month and paginate. " +
        "Does not return other people's articles. Available to user and admin roles.",
      inputSchema: {
        month: monthYear.optional().describe("Limit to this month_year; ignored when view_all is true"),
        view_all: z
          .boolean()
          .optional()
          .describe("If true, list across months with pagination (default false = current or given month)"),
        page: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
    },
    safeTool(async (args, props) => {
      const viewAll = Boolean(args.view_all);
      const month = viewAll ? undefined : args.month ?? new Date().toISOString().slice(0, 7);
      const { articles, pagination } = await getArticlesByUser(
        env.DB,
        props.userId,
        month,
        viewAll,
        args.page ?? 1,
        args.limit ?? 20,
      );
      const lines = articles.map(
        (a) =>
          `- ${a.title} | id=${a.id} | ${a.status} | score=${a.ai_score ?? "n/a"} | type=${a.article_type_name} | submitted=${a.submitted_at}`,
      );
      const pageInfo = pagination
        ? `\nPagination: page ${pagination.page}, total ${pagination.total}`
        : "";
      return text(`Your articles (${articles.length}):\n${lines.join("\n") || "(none)"}${pageInfo}`);
    }, env, roles),
  );

  server.registerTool(
    "get_my_article_feedback",
    {
      description:
        "Get AI overall feedback, score, status, and per-parameter results for one article you own. " +
        "Pass the article_id from list_my_articles. Returns an error if the article is not yours " +
        "(admins acting as themselves still only see their own articles here — use admin tools for others). " +
        "Available to user and admin roles.",
      inputSchema: {
        article_id: z.string().min(1).describe("Article id you own"),
      },
    },
    safeTool(async ({ article_id }, props) => {
      const article = await getUserArticleById(env.DB, article_id, props.userId);
      if (!article) return fail("Article not found or not owned by the signed-in user.");
      const params = await getParameterResults(env.DB, article_id, article.version);
      return text(
        [
          `Title: ${article.title}`,
          `Status: ${article.status}; version ${article.version}`,
          `AI score: ${article.ai_score ?? "not scored yet"}`,
          `Type: ${article.article_type_name}`,
          "",
          "Overall AI feedback:",
          article.ai_feedback || "(none yet)",
          "",
          "Parameter results:",
          params.length
            ? params.map((p) => `- ${p.name}: ${p.value ?? "—"}`).join("\n")
            : "(none)",
        ].join("\n"),
      );
    }, env, roles),
  );

  server.registerTool(
    "submit_new_article",
    {
      description:
        "Create a new Contiq article for the signed-in user and start AI evaluation. " +
        "Requires article_type_id (from Contiq types), title, and HTML content. " +
        "Enforces the same min-word and size rules as the Contiq web UI. " +
        "Do NOT use this to revise an existing article — use submit_my_article_revision. " +
        "Available to user and admin roles (creates under the signed-in identity).",
      inputSchema: {
        article_type_id: z.string().min(1).describe("Active evaluatable article type id"),
        title: z.string().min(1).describe("Article title"),
        content: z
          .string()
          .min(1)
          .describe("Article body as HTML (same format TipTap saves in Contiq)"),
      },
    },
    safeTool(async ({ article_type_id, title, content }, props) => {
      const articleType = await env.DB.prepare(
        `SELECT id, COALESCE(min_words, 1000) AS min_words FROM article_types WHERE id = ? AND is_active = 1 AND is_evaluatable = 1`,
      )
        .bind(article_type_id)
        .first<{ id: string; min_words: number }>();
      if (!articleType) return fail("Invalid or unavailable article type");
      const minWords = articleType.min_words ?? 1000;
      if (countWordsServer(content) < minWords) {
        return fail(`Article must contain at least ${minWords} words (same rule as Contiq UI).`);
      }
      const cleanTitle = sanitizeHtmlServer(title);
      const cleanContent = sanitizeHtmlServer(content);
      const now = new Date().toISOString();
      const articleId = "art_" + crypto.randomUUID();
      await createArticle(env.DB, {
        id: articleId,
        user_id: props.userId,
        article_type_id,
        title: cleanTitle,
        content: cleanContent,
        status: "pending",
        version: 1,
        submitted_at: now,
        month_year: now.slice(0, 7),
        retry_count: 0,
      });
      await startEvaluation(env, { articleId, articleTypeId: article_type_id, version: 1 });
      return text(
        `Created article ${articleId} as pending and started evaluation.\nTitle: ${cleanTitle}\nType: ${article_type_id}`,
      );
    }, env, roles),
  );

  server.registerTool(
    "submit_my_article_revision",
    {
      description:
        "Resubmit/rewrite an existing Contiq article you own: updates title/content/type, bumps version, " +
        "snapshots history, and starts a new AI evaluation (same as Contiq rewrite flow). " +
        "Fails if the article is mid-evaluation or not yours. Available to user and admin roles.",
      inputSchema: {
        article_id: z.string().min(1).describe("Existing article id you own"),
        article_type_id: z.string().min(1).describe("Article type id for this revision"),
        title: z.string().min(1).describe("Revised title"),
        content: z.string().min(1).describe("Revised body HTML"),
      },
    },
    safeTool(async ({ article_id, article_type_id, title, content }, props) => {
      const existing = await getUserArticleById(env.DB, article_id, props.userId);
      if (!existing) return fail("Article not found or not owned by the signed-in user.");
      if (
        isEvaluationInFlight(
          existing.status,
          existing.updated_at,
          Number(existing.is_evaluatable) === 1,
        )
      ) {
        return fail("Article is currently being evaluated; wait for it to finish before resubmitting.");
      }
      const articleType = await env.DB.prepare(
        `SELECT id, COALESCE(min_words, 1000) AS min_words FROM article_types WHERE id = ? AND is_active = 1 AND is_evaluatable = 1`,
      )
        .bind(article_type_id)
        .first<{ id: string; min_words: number }>();
      if (!articleType) return fail("Invalid or unavailable article type");
      const minWords = articleType.min_words ?? 1000;
      if (countWordsServer(content) < minWords) {
        return fail(`Article must contain at least ${minWords} words.`);
      }
      const cleanTitle = sanitizeHtmlServer(title);
      const cleanContent = sanitizeHtmlServer(content);
      const now = new Date().toISOString();
      const historyId = "hist_" + crypto.randomUUID();
      await snapshotArticle(env.DB, article_id, historyId, now, props.userId);
      const nextVersion = await updateArticleForRewrite(
        env.DB,
        article_id,
        cleanTitle,
        cleanContent,
        article_type_id,
        now,
        props.userId,
      );
      if (nextVersion == null) return fail("Rewrite failed — article not found or not owned.");
      await startEvaluation(env, {
        articleId: article_id,
        articleTypeId: article_type_id,
        version: nextVersion,
      });
      return text(
        `Revision submitted for ${article_id}. Now version ${nextVersion}, status pending; evaluation started.`,
      );
    }, env, roles),
  );
}

/** Register role-filtered Contiq MCP tools on a fresh server instance. */
export function registerContiqTools(server: McpServer, env: Bindings, authRole: ContiqRole): void {
  // Always register only tools the role may call (tools/list stays accurate).
  if (authRole === "admin") {
    registerAdminTools(server, env);
  }
  registerUserTools(server, env);
}
