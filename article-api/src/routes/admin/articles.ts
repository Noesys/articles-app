import { Hono } from "hono";
import { ArticleHistoryEntry } from "../../types/admin-types";
import {
  changeArticleType,
  getArticleById,
  getArticleHistory,
  getArticles,
  getArticleStats,
  prepareArticleReevaluate,
  updateArticleTitle,
} from "../../services/admin/articles.service";
import {
  getParameterResults,
  storeParameterResults,
} from "../../services/admin/articleParameterResults.service";
import { AppEnv, Bindings } from "../../types/shared-types";
import { requireRole } from "../../middleware/requireRole";
import { evaluateArticle } from "../../services/user/evaluateArticle.service";
import { sanitizeHtmlServer } from "../../utils/sanitize";

const articlesRoute = new Hono<AppEnv>();
articlesRoute.use("*", requireRole("admin", "super_admin"));

async function backgroundEvaluateArticle(
  db: D1Database,
  articleId: string,
  articleTypeId: string,
  title: string,
  content: string,
  version: number,
  bindings: Bindings,
) {
  try {
    await evaluateArticle(db, articleId, articleTypeId, title, content, version, bindings);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Admin background evaluation failed:", msg, err);
  }
}

articlesRoute.get("/", async (c) => {
  const month = c.req.query("month");
  const status = c.req.query("status");
  const type = c.req.query("type");
  const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") || "10", 10) || 10));
  const { data, total } = await getArticles(c.env.DB, month, status, type, page, limit);
  return c.json({
    message: "Articles fetched successfully",
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// for dashboard stats
articlesRoute.get("/stats", async (c) => {
  const month = c.req.query("month");

  const data = await getArticleStats(c.env.DB, month);

  return c.json({
    message: "Stats fetched successfully",
    data,
  });
});

articlesRoute.get("/:id", async (c) => {
  const articleId = c.req.param("id");
  const db = c.env.DB;

  const article = await getArticleById(db, articleId);

  if (!article) {
    return c.json(
      {
        success: false,
        message: "Article not found",
      },
      404,
    );
  }

  const history = await getArticleHistory(db, articleId);

  const currentFeedback =
    article.ai_feedback ||
    (history.length > 0 ? history[history.length - 1].ai_feedback || "" : "");

  const parameter_results = await getParameterResults(db, articleId, article.version);

  return c.json({
    message: "Article fetched successfully",
    data: {
      article: {
        id: article.id,
        title: article.title,
        content: article.content,
        article_type_id: article.article_type_id,
        article_type_name: article.article_type_name,
        status: article.status,
        version: article.version,
        ai_score: article.ai_score,
        ai_feedback: article.ai_feedback || null,
        suggested_title: article.suggested_title || null,
        author_name: article.author_name,
        author_email: article.author_email,
        job_role: article.job_role,
      },
      current_feedback: currentFeedback,
      current_score: article.ai_score,
      parameter_results,
      history: history.map((item: ArticleHistoryEntry) => {
        return {
          article_id: item.article_id,
          version: item.version,
          title: item.title ?? "",
          content: item.content ?? "",
          score: item.ai_score,
          feedback: item.ai_feedback || null,
          status: item.status ?? "pending",
          submitted_at: item.submitted_at ?? "",
          snapshotted_at: item.snapshotted_at,
        };
      }),
    },
  });
});

/** Title-only update — does not bump version or re-run evaluation. */
articlesRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { title?: unknown };

  if (typeof body.title !== "string") {
    return c.json({ success: false, message: "title is required" }, 400);
  }

  const title = sanitizeHtmlServer(body.title).replace(/\s+/g, " ").trim();
  if (!title) {
    return c.json({ success: false, message: "title is required" }, 400);
  }

  let article;
  try {
    article = await updateArticleTitle(c.env.DB, id, title);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, message: msg }, 400);
  }

  if (!article) {
    return c.json({ success: false, message: "Article not found" }, 404);
  }

  return c.json({
    message: "Article title updated",
    data: {
      article: {
        id: article.id,
        title: article.title,
        suggested_title: article.suggested_title || null,
        version: article.version,
        updated_at: article.updated_at,
      },
    },
  });
});

articlesRoute.get("/:id/parameter-results", async (c) => {
  const id = c.req.param("id");
  const versionQuery = c.req.query("version");
  const version = versionQuery ? parseInt(versionQuery, 10) : undefined;
  const data = await getParameterResults(c.env.DB, id, isNaN(version!) ? undefined : version);
  return c.json({ message: "Parameter results fetched", data });
});

articlesRoute.post("/:id/parameter-results", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  if (!Array.isArray(body.results)) return c.json({ message: "results array required" }, 400);
  const data = await storeParameterResults(
    c.env.DB,
    id,
    body.results,
    body.ai_score,
    body.ai_feedback,
  );
  return c.json({ message: "Parameter results stored", data }, 201);
});

/**
 * Change article type. With reevaluate=true (default when type is evaluatable),
 * clears scores and runs AI scoring in the background.
 */
articlesRoute.patch("/:id/type", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as {
    article_type_id?: string;
    reevaluate?: boolean;
  };

  if (!body.article_type_id) {
    return c.json({ success: false, message: "article_type_id is required" }, 400);
  }

  let result;
  try {
    result = await changeArticleType(c.env.DB, id, body.article_type_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, message: msg }, 400);
  }

  if (!result) {
    return c.json({ success: false, message: "Article not found" }, 404);
  }

  const shouldReevaluate = body.reevaluate !== false && result.evaluatable;
  if (shouldReevaluate) {
    c.executionCtx.waitUntil(
      backgroundEvaluateArticle(
        c.env.DB,
        id,
        body.article_type_id,
        result.title,
        result.content,
        result.version,
        c.env,
      ),
    );
  }

  const article = await getArticleById(c.env.DB, id);
  return c.json({
    message: shouldReevaluate
      ? "Article type updated; re-evaluation started"
      : "Article type updated",
    data: {
      article,
      reevaluate: shouldReevaluate,
      evaluatable: result.evaluatable,
    },
  });
});

/** Re-evaluate with the current article type (snapshots prior score if any). */
articlesRoute.post("/:id/reevaluate", async (c) => {
  const id = c.req.param("id");

  let result;
  try {
    result = await prepareArticleReevaluate(c.env.DB, id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, message: msg }, 400);
  }

  if (!result) {
    return c.json({ success: false, message: "Article not found" }, 404);
  }

  if (!result.evaluatable) {
    return c.json(
      {
        success: false,
        message: "Article type is not evaluatable (e.g. Not suitable). Change type first.",
      },
      400,
    );
  }

  c.executionCtx.waitUntil(
    backgroundEvaluateArticle(
      c.env.DB,
      id,
      result.article_type_id,
      result.title,
      result.content,
      result.version,
      c.env,
    ),
  );

  const article = await getArticleById(c.env.DB, id);
  return c.json({
    message: "Re-evaluation started",
    data: { article, reevaluate: true },
  });
});

export default articlesRoute;
