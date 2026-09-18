import { Hono } from "hono";
import { getArticlesByUser, getArticleById, createArticle } from "../../services/user/articles";
import {
  getArticleHistory,
  snapshotArticle,
  updateArticleForRewrite,
} from "../../services/user/articleHistory";
import type { AppEnv, Bindings } from "../../types/shared-types";
import { evaluateArticle } from "../../services/user/evaluateArticle.service";
import { AppError } from "../../utils/errors";
import { sanitizeHtmlServer } from "../../utils/sanitize";
import { accessAuth } from "../../middleware/accessAuth";
import { isStuckPending } from "../../utils/evaluationTiming";

const articleRoutes = new Hono<AppEnv>();

articleRoutes.use("*", accessAuth);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function validateArticleSize(title: string, content: string): void {
  const MAX_TITLE_BYTES = 500;
  const MAX_CONTENT_BYTES = 500_000;
  if (new TextEncoder().encode(title).length > MAX_TITLE_BYTES)
    throw new AppError("Title too long", 400);
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES)
    throw new AppError("Content too long", 400);
}

function articleToListItem(article: {
  id: string;
  title: string;
  article_type_name: string;
  version: number;
  ai_score: number | null;
  status: string;
  submitted_at: string;
  authorName: string;
  authorId: string;
}) {
  return {
    article: {
      id: article.id,
      title: article.title,
      type: article.article_type_name,
      version: article.version,
      ai_score: article.ai_score,
      status: article.status,
      created: article.submitted_at,
    },
    author: {
      id: article.authorId,
      name: article.authorName,
    },
  };
}

// Background evaluation - single attempt via waitUntil; durable retry via Queue/cron
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
    console.error("Background evaluation failed:", msg, err);
  }
}

articleRoutes.get("/mine", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  const viewAllRaw = c.req.query("viewAll");
  const viewAll = viewAllRaw === "true" || viewAllRaw === "1";

  const month = c.req.query("month");

  if (month && !/^\d{4}-\d{2}$/.test(month)) {
    return c.json(
      {
        success: false,
        message: "Invalid month format. Expected YYYY-MM.",
      },
      400,
    );
  }

  const pageRaw = c.req.query("page");
  const limitRaw = c.req.query("limit");

  let page: number | undefined;
  let limit: number | undefined;

  if (viewAll) {
    page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;
    limit = limitRaw ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 10)) : 10;
  }

  const { articles, pagination } = await getArticlesByUser(
    db,
    user.id,
    viewAll ? undefined : month || currentMonth(),
    viewAll,
    page,
    limit,
  );

  const data = articles.map((article) =>
    articleToListItem({
      id: article.id,
      title: article.title,
      article_type_name: article.article_type_name,
      version: article.version,
      ai_score: article.ai_score,
      status: article.status,
      submitted_at: article.submitted_at,
      authorName: user.name,
      authorId: user.id,
    }),
  );

  return c.json({
    success: true,
    data,
    ...(pagination ? { pagination } : {}),
  });
});

articleRoutes.get("/mine/:id", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const articleId = c.req.param("id");

  const article = await getArticleById(db, articleId, user.id);

  if (!article) {
    return c.json(
      {
        success: false,
        message: "Article not found",
      },
      404,
    );
  }

  const history = await getArticleHistory(db, articleId, user.id);

  if (history.length > 0) {
    history.sort((a, b) => a.version - b.version);
  }

  const isPending = article.status === "pending" || article.status === "processing";
  const currentFeedback = isPending
    ? ""
    : article.ai_feedback ||
      (history.length > 0 ? history[history.length - 1].ai_feedback || "" : "");

  // parameter results for current version
  type ParamRow = {
    parameter_name: string;
    parameter_description: string | null;
    scope_type: string;
    max_value: number | null;
    numeric_value: number | null;
    option_id: string | null;
    option_label: string | null;
  };
  const paramRows: ParamRow[] = (
    await db
      .prepare(
        `SELECT p.name as parameter_name, p.description as parameter_description, p.scope_type, p.max_value, r.numeric_value, r.option_id, po.label as option_label FROM article_parameter_results r JOIN parameters p ON p.id=r.parameter_id LEFT JOIN parameter_options po ON po.id=r.option_id WHERE r.article_id=? AND r.version=? ORDER BY p.sort_order`,
      )
      .bind(articleId, article.version)
      .all()
  ).results as ParamRow[];
  const parameter_results = paramRows.map((r) => ({
    parameter_name: r.parameter_name,
    parameter_description: r.parameter_description,
    scope_type: r.scope_type,
    max_value: r.max_value,
    value: r.scope_type === "option" ? r.option_label : r.numeric_value,
  }));
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
      },
      current_feedback: currentFeedback,
      current_score: article.ai_score,
      parameter_results,
      history: history.map((item) => {
        return {
          article_id: item.article_id,
          version: item.version,
          title: item.title ?? "",
          content: item.content ?? "",
          score: item.ai_score,
          feedback: item.ai_feedback || null,
          status: item.status ?? "pending",
          submitted_at: item.submitted_at,
          snapshotted_at: item.snapshotted_at,
          article_type_id: item.article_type_id,
          article_type_name: item.article_type_name,
        };
      }),
    },
  });
});

articleRoutes.post("/", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

  // Must stay comfortably above MAX_CONTENT_BYTES (500,000) plus title/JSON overhead.
  const MAX_BODY_BYTES = 600 * 1024;

  const contentLength = c.req.header("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return c.json({ success: false, message: "Request body too large" }, 413);
  }

  type CreateArticleBody = {
    id?: string;
    article_type_id?: string;
    title?: string;
    content?: string;
  };

  let body: CreateArticleBody;

  try {
    body = await c.req.json<CreateArticleBody>();
  } catch {
    return c.json(
      {
        success: false,
        message: "Invalid JSON body",
      },
      400,
    );
  }

  let { id: requestedId, article_type_id, title, content } = body;

  if (!article_type_id || !title || !content) {
    return c.json(
      {
        success: false,
        message: "Missing required fields: article_type_id, title, content",
      },
      400,
    );
  }

  validateArticleSize(title, content);

  const articleType = await db
    .prepare(`SELECT id FROM article_types WHERE id = ? AND is_active = 1 AND is_evaluatable = 1`)
    .bind(article_type_id)
    .first();
  if (!articleType) {
    return c.json({ success: false, message: "Invalid or unavailable article type" }, 400);
  }

  title = sanitizeHtmlServer(title);
  content = sanitizeHtmlServer(content);

  const now = new Date().toISOString();
  const month_year = now.slice(0, 7);

  let articleId: string;

  if (requestedId) {
    // ==================== REWRITE ATTEMPT ====================
    const existingArticle = await getArticleById(db, requestedId, user.id);

    if (!existingArticle) {
      return c.json(
        {
          success: false,
          message: "Article not found or does not belong to user",
        },
        404,
      );
    }

    // Already pending/processing and not stuck (< threshold old) — reject.
    if (
      (existingArticle.status === "pending" || existingArticle.status === "processing") &&
      !isStuckPending(existingArticle.updated_at)
    ) {
      return c.json(
        {
          success: false,
          message: "Article is currently being evaluated; please wait for it to finish before resubmitting",
        },
        409,
      );
    }

    const historyId = "hist_" + crypto.randomUUID();
    const rewriteMonth = now.slice(0, 7);

    let nextVersion: number | null;

    // Atomic snapshot + rewrite; if either fails neither partially persists as orphan
    try {
      const [, updateResult] = await db.batch<{ version: number }>([
        db
          .prepare(
            // A row still "pending"/"processing" at snapshot time was never
            // actually resolved (stuck evaluation being superseded — see
            // isStuckPending above) — record it as failed, not a frozen
            // "pending" that looks like it's still running.
            `INSERT INTO article_history (id, article_id, article_type_id, title, ai_feedback, content, ai_score, pass_threshold, status, version, submitted_at, scored_at, snapshotted_at)
             SELECT ?, id, article_type_id, title,
               CASE WHEN status IN ('pending','processing') THEN 'Evaluation timed out. Please try again.' ELSE ai_feedback END,
               content, ai_score, pass_threshold,
               CASE WHEN status IN ('pending','processing') THEN 'failed' ELSE status END,
               version, submitted_at, scored_at, ?
             FROM articles WHERE id = ?`,
          )
          .bind(historyId, now, requestedId),
        db
          .prepare(
            `UPDATE articles SET title=?, content=?, article_type_id=?, version=version+1, status='pending', ai_score=NULL, ai_feedback=NULL, pass_threshold=NULL, submitted_at=CURRENT_TIMESTAMP, updated_at=?, scored_at=NULL, month_year=?, retry_count=retry_count+1 WHERE id=? RETURNING version`,
          )
          .bind(title, content, article_type_id, now, rewriteMonth, requestedId),
      ]);
      nextVersion = updateResult.results[0]?.version ?? null;
    } catch {
      // Fallback to sequential if batch not supported in local D1
      await snapshotArticle(db, requestedId, historyId, now, user.id);
      nextVersion = await updateArticleForRewrite(
        db,
        requestedId,
        title,
        content,
        article_type_id,
        rewriteMonth,
        now,
        user.id,
      );
    }

    if (nextVersion == null) {
      return c.json(
        {
          success: false,
          message: "Article not found or does not belong to user",
        },
        404,
      );
    }

    articleId = requestedId;

    // ❌ REMOVED: Synchronous evaluation (was blocking)
    // ✅ ADDED: Background evaluation via waitUntil
    c.executionCtx.waitUntil(
      backgroundEvaluateArticle(db, articleId, article_type_id, title, content, nextVersion, c.env),
    );

    // Return immediately with pending status
    return c.json({
      message: "Article rewrite submitted",
      data: {
        id: articleId,
        status: "pending",
        ai_score: null,
        ai_feedback: null,
      },
    });
  } else {
    // ==================== NEW ARTICLE ====================
    const newId = "art_" + crypto.randomUUID();

    await createArticle(db, {
      id: newId,
      user_id: user.id,
      article_type_id,
      title,
      content,
      status: "pending",
      version: 1,
      submitted_at: now,
      month_year,
      retry_count: 0,
    });

    articleId = newId;

    // ❌ REMOVED: Synchronous evaluation (was blocking 10-30s)
    // ✅ ADDED: Background evaluation via waitUntil
    c.executionCtx.waitUntil(
      backgroundEvaluateArticle(
        db,
        articleId,
        article_type_id,
        title,
        content,
        1, // New articles start at version 1
        c.env,
      ),
    );

    // Return immediately with pending status (don't wait for AI)
    return c.json({
      message: "Article submitted",
      data: {
        id: articleId,
        status: "pending",
        ai_score: null,
        ai_feedback: null,
      },
    });
  }
});

articleRoutes.get("/:id/status", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const articleId = c.req.param("id");
  const article = await getArticleById(db, articleId, user.id);
  if (!article) return c.json({ success: false, message: "Article not found" }, 404);
  // Map internal status to spec status: pending / accepted / rejected
  // "failed" must be checked before the ai_score check below — a failed
  // evaluation never sets ai_score, so it would otherwise fall through to
  // the "pending" branch and be reported as pending forever.
  let status: string = article.status;
  if (article.status === "failed") {
    status = "rejected";
  } else if (article.ai_score !== null) {
    status =
      article.status === "approved"
        ? "accepted"
        : article.status === "rewrite_required"
          ? "rejected"
          : status;
  } else {
    status = "pending";
  }
  return c.json({
    success: true,
    data: {
      id: article.id,
      status,
      ai_score: article.ai_score,
      ai_feedback: article.ai_feedback || null,
      version: article.version,
    },
  });
});

export default articleRoutes;
