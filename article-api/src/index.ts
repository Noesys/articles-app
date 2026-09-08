import { Hono } from "hono";
import { cors } from "hono/cors";

/* USER ROUTES IMPORTS */
import authRoutes from "./routes/user/auth";
import articleRoutes from "./routes/user/articles";

// user service
import { getArticleTypes } from "./services/user/articleTypes";

import type { AppEnv } from "./types/shared-types";

/* ADMIN ROUTES IMPORTS */

import usersRoute from "./routes/admin/users";
import articlesRoute from "./routes/admin/articles";
import articleTypesRoute from "./routes/admin/articleTypes";
import parametersRoute from "./routes/admin/parameters";
import insightsRoute from "./routes/admin/insights";

import { AppError } from "../src/utils/errors";
import { accessAuth } from "./middleware/accessAuth";

const app = new Hono<AppEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "";
      if (
        origin === "http://localhost:5173" ||
        origin === "http://localhost:5174" ||
        origin === "https://noesys-article-platform.pages.dev" ||
        origin.endsWith("noesys-article-platform-admin.pages.dev")
      ) {
        return origin;
      }
      return "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    exposeHeaders: ["Set-Cookie"],
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.json({
    success: true,
    message: "API is running",
  });
});

// user routes
app.route("/auth", authRoutes);
app.route("/articles", articleRoutes);

app.get("/article-types", accessAuth, async (c) => {
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

// admin routes

// user routes - for admin to fetch user data
app.route("/api/users", usersRoute);

// article routes
app.route("/api/articles", articlesRoute);

// article types route
app.route("/api/article-types", articleTypesRoute);

// parameter route
app.route("/api/article-types", parametersRoute);

// summary
app.route("/api/insights", insightsRoute);

app.onError((err, c) => {
  // Correlation id so we can match a support report / log line to this
  // specific failure without ever exposing internals to the client.
  const errorId = crypto.randomUUID();

  if (err instanceof AppError) {
    // Deliberately thrown, safe-to-show message (validation, not-found, etc).
    if (err.status >= 500) {
      console.error(`[user-api] ${errorId}:`, err);
    }
    return c.json(
      { success: false, message: err.message, errorId },
      err.status as any,
    );
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

export default app;
