import { Hono } from "hono";
import { cors } from "hono/cors";

/* USER ROUTES IMPORTS */
import authRoutes from "./routes/user/auth";
import articleRoutes from "./routes/user/articles";
import imageRoutes from "./routes/user/images";

// user service
import { getArticleTypes } from "./services/user/articleTypes";

import type { AppEnv } from "./types/shared-types";

/* ADMIN ROUTES IMPORTS */

import usersRoute from "./routes/admin/users";
import articlesRoute from "./routes/admin/articles";
import articleTypesRoute from "./routes/admin/articleTypes";
import parametersRoute from "./routes/admin/parameters";
import insightsRoute from "./routes/admin/insights";

import { AppError } from "./utils/errors";
import { accessAuth } from "./middleware/accessAuth";
import { requireRole } from "./middleware/requireRole";

import { secureHeaders } from "hono/secure-headers";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { authorizeApp } from "./mcp/authorize";
import { contiqMcpApiHandler } from "./mcp/server";
import type { Bindings } from "./types/shared-types";

// Workflow classes must be exported from the Worker entry point for the binding to find them.
export { EvaluateArticleWorkflow } from "./workflows/evaluateArticle.workflow";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders(), async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      if (!origin) return "";

      if (
        origin === "http://localhost:5173" ||
        origin === "http://localhost:5174" ||
        origin === c.env.FRONTEND_URL
      ) {
        return origin;
      }

      return "";
    },
    credentials: true,
  });

  return corsMiddleware(c, next);
});

// Health under /api so SPA assets can own "/"
app.get("/api/health", (c) => {
  return c.json({
    success: true,
    message: "API is running",
  });
});

// user routes (all under /api - matches frontend API_BASE=/api and vite proxy without rewrite)
app.route("/api/auth", authRoutes);
app.route("/api/articles", articleRoutes);
app.route("/api/images", imageRoutes);

app.get("/api/article-types", accessAuth, async (c) => {
  const db = c.env.DB;
  const types = await getArticleTypes(db);
  return c.json({
    message: "Article types fetched successfully",
    data: types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      general_instructions: (t as { general_instructions?: string | null }).general_instructions ?? null,
      min_words: (t as { min_words?: number }).min_words ?? null,
    })),
  });
});

// admin routes

// user routes - for admin to fetch user data
app.route("/api/admin/users", usersRoute);

// article routes (distinct from user /api/articles)
app.route("/api/admin/articles", articlesRoute);

// article types + parameters share this prefix. Auth runs once here: when each router
// carried its own requireRole, every parameter request ran the identity check twice.
app.use("/api/admin/article-types/*", requireRole("admin"));

// article types route
app.route("/api/admin/article-types", articleTypesRoute);

// parameter route
app.route("/api/admin/article-types", parametersRoute);

// summary
app.route("/api/admin/insights", insightsRoute);

// SPA / static assets (run_worker_first = true)
app.all("*", async (c) => {
  if (!c.env.ASSETS) {
    return c.json({ success: false, message: "Assets binding missing" }, 500);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  // Correlation id so we can match a support report / log line to this
  // specific failure without ever exposing internals to the client.
  const errorId = crypto.randomUUID();

  if (err instanceof AppError) {
    // Deliberately thrown, safe-to-show message (validation, not-found, etc).
    if (err.status >= 500) {
      console.error(`[user-api] ${errorId}:`, err);
    }
    return c.json({ success: false, message: err.message, errorId }, err.status as any);
  }

  // Anything else (D1 errors, network failures, bugs) is unexpected —
  // log it fully server-side, but never forward err.message to the client.
  console.error(`[user-api] ${errorId} unhandled error:`, err);
  return c.json(
    {
      success: false,
      message: "Something went wrong. Please try again.",
      errorId,
    },
    500,
  );
});

const CONTIQ_ORIGIN = "https://contiq.noesyssoftware.com";

/**
 * Contiq MCP (OAuth + Streamable HTTP) wraps the existing Hono API/SPA Worker.
 * - /mcp — bearer-token MCP tools (role-filtered)
 * - /authorize — CF Access identity + consent
 * - /oauth/* — token + dynamic client registration (library)
 * Everything else falls through to the Contiq Hono app.
 */
export default new OAuthProvider<Bindings>({
  apiRoute: "/mcp",
  apiHandler: contiqMcpApiHandler,
  defaultHandler: {
    async fetch(request, env, ctx) {
      const path = new URL(request.url).pathname;
      if (path === "/authorize") {
        return authorizeApp.fetch(request, env, ctx);
      }
      return app.fetch(request, env, ctx);
    },
  },
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/oauth/token",
  clientRegistrationEndpoint: "/oauth/register",
  scopesSupported: ["contiq"],
  requiredScopes: ["contiq"],
  resourceMetadata: {
    resource: `${CONTIQ_ORIGIN}/mcp`,
    authorization_servers: [CONTIQ_ORIGIN],
  },
  // Cursor / Claude Desktop native clients often use private-use redirect URIs.
  allowPrivateUseRedirectUris: true,
});
