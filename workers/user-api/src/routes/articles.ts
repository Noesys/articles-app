import { Hono } from "hono";
import {
  getArticlesByUser,
  getArticleById,
  createArticle,
  updateArticleStatus,
} from "../db/articles";
import {
  getArticleHistory,
  snapshotArticle,
  updateArticleForRewrite,
} from "../db/articleHistory";
import { getArticleTypes } from "../db/articleTypes";
import type { AppEnv } from "../types";
import { evaluateArticle } from "../db/evaluateArticle.service";
import { authMiddleware } from "../middleware/auth";

const articleRoutes = new Hono<AppEnv>();

articleRoutes.use("*", authMiddleware);

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
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

// Background evaluation with safe retry (does not affect request flow)
async function backgroundEvaluateArticle(
  db: D1Database,
  env: { GOOGLE_GENERATIVE_AI_API_KEY: string },
  articleId: string,
  articleTypeId: string,
  title: string,
  content: string,
  version: number,
) {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await evaluateArticle(
        db,
        env.GOOGLE_GENERATIVE_AI_API_KEY,
        articleId,
        articleTypeId,
        title,
        content,
        version,
      );
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Background evaluation attempt ${attempt} failed:`, msg, err);
      if (attempt === maxAttempts) return;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
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
    limit = limitRaw
      ? Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 10))
      : 10;
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

  const isPending =
    article.status === "pending" || article.status === "processing";
  const currentFeedback = isPending
    ? ""
    : article.ai_feedback ||
      (history.length > 0 ? history[history.length - 1].ai_feedback || "" : "");

  // parameter results for current version
  const paramRows: {
    parameter_name: string;
    scope_type: string;
    numeric_value: number | null;
    option_id: string | null;
    option_label: string | null;
  }[] = (
    await db
      .prepare(
        `SELECT p.name as parameter_name, p.scope_type, r.numeric_value, r.option_id, po.label as option_label FROM article_parameter_results r JOIN parameters p ON p.id=r.parameter_id LEFT JOIN parameter_options po ON po.id=r.option_id WHERE r.article_id=? AND r.version=? ORDER BY p.sort_order`,
      )
      .bind(articleId, article.version)
      .all()
  ).results as {
    parameter_name: string;
    scope_type: string;
    numeric_value: number | null;
    option_id: string | null;
    option_label: string | null;
  }[];
  const parameter_results = paramRows.map(
    (r: {
      parameter_name: string;
      scope_type: string;
      numeric_value: number | null;
      option_label: string | null;
    }) => ({
      parameter_name: r.parameter_name,
      scope_type: r.scope_type,
      value: r.scope_type === "option" ? r.option_label : r.numeric_value,
    }),
  );
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
        };
      }),
    },
  });
});

articleRoutes.post("/", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;

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

  const { id: requestedId, article_type_id, title, content } = body;

  if (!article_type_id || !title || !content) {
    return c.json(
      {
        success: false,
        message: "Missing required fields: article_type_id, title, content",
      },
      400,
    );
  }

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

    const historyId = "hist_" + crypto.randomUUID();
    const rewriteMonth = now.slice(0, 7);

    // Atomic snapshot + rewrite; if either fails neither partially persists as orphan
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO article_history (id, article_id, article_type_id, title, ai_feedback, content, ai_score, pass_threshold, status, version, submitted_at, scored_at, snapshotted_at) SELECT ?, id, article_type_id, title, ai_feedback, content, ai_score, pass_threshold, status, version, submitted_at, scored_at, ? FROM articles WHERE id = ?`
          )
          .bind(historyId, now, requestedId),
        db
          .prepare(
            `UPDATE articles SET title=?, content=?, version=version+1, status='pending', ai_score=NULL, ai_feedback=NULL, pass_threshold=NULL, submitted_at=CURRENT_TIMESTAMP, scored_at=NULL, month_year=?, retry_count=retry_count+1 WHERE id=?`
          )
          .bind(title, content, rewriteMonth, requestedId),
      ]);
    } catch {
      // Fallback to sequential if batch not supported in local D1
      await snapshotArticle(db, requestedId, historyId, now, user.id);
      await updateArticleForRewrite(db, requestedId, title, content, rewriteMonth, user.id);
    }

    articleId = requestedId;

    const nextVersion = existingArticle.version + 1;

    // ❌ REMOVED: Synchronous evaluation (was blocking)
    // ✅ ADDED: Background evaluation via waitUntil
    const currentVersion = existingArticle.version;
    c.executionCtx.waitUntil(
      backgroundEvaluateArticle(
        db,
        c.env,
        articleId,
        article_type_id,
        title,
        content,
        nextVersion,
      ),
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
        c.env,
        articleId,
        article_type_id,
        title,
        content,
        1, // New articles start at version 1
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
  if (!article)
    return c.json({ success: false, message: "Article not found" }, 404);
  // Map internal status to spec status: pending / accepted / rejected
  let status: string = article.status;
  if (article.ai_score !== null) {
    status =
      article.status === "approved"
        ? "accepted"
        : article.status === "failed"
          ? "rejected"
          : article.status === "rewrite_required"
            ? "rejected"
            : status;
    // normalize approved/rewrite_required to accepted/rejected for spec compatibility
    if (status === "approved") status = "accepted";
    if (status === "rewrite_required") status = "rejected";
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

articleRoutes.get("/article-types", async (c) => {
  const db = c.env.DB;

  const types = await getArticleTypes(db);

  return c.json({
    message: "Article types fetched successfully",
    data: types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
    })),
  });
});

export default articleRoutes;
