import { Hono } from "hono";
import { ArticleTypeInput } from "../../types/admin-types";
import {
  createArticleType,
  deactivateArticleType,
  getArticleTypeById,
  updateArticleType,
  getArticleTypes,
} from "../../services/admin/articleTypes.service";
import { authMiddleware } from "../../middleware/adminAuth";
import { AppEnv } from "../../types/shared-types";

const articleTypesRoute = new Hono<AppEnv>();
articleTypesRoute.use("*", authMiddleware("admin", "super_admin"));

function parseArticleTypeBody(
  body: unknown,
  isUpdate = false,
): Partial<ArticleTypeInput> | { error: string } {
  if (!body || typeof body !== "object")
    return { error: "Invalid request body" };
  const b = body as Record<string, unknown>;
  const name = b.name as string | undefined;
  const description = b.description as string | undefined;
  const passThreshold = b.passThreshold as unknown;
  const scorePrompt = b.scorePrompt as string | undefined;
  const scoreMin =
    b.scoreMin !== undefined ? b.scoreMin : isUpdate ? undefined : 0;
  const scoreMax =
    b.scoreMax !== undefined ? b.scoreMax : isUpdate ? undefined : 10;

  if (!isUpdate) {
    if (!name?.trim()) return { error: "Article type name is required" };
    if (!scorePrompt?.trim()) return { error: "Score prompt is required" };
    if (typeof passThreshold !== "number" || isNaN(passThreshold)) {
      return { error: "passThreshold must be a valid numeric value" };
    }
  } else {
    if (
      passThreshold !== undefined &&
      (typeof passThreshold !== "number" || isNaN(passThreshold))
    ) {
      return { error: "passThreshold must be a valid numeric value" };
    }
  }

  return {
    ...(name !== undefined ? { name: name.trim() } : {}),
    ...(description !== undefined
      ? { description: description.trim() || undefined }
      : {}),
    ...(passThreshold !== undefined
      ? { passThreshold: passThreshold as number }
      : {}),
    ...(scorePrompt !== undefined ? { scorePrompt: scorePrompt.trim() } : {}),
    ...(scoreMin !== undefined ? { scoreMin: Number(scoreMin) } : {}),
    ...(scoreMax !== undefined ? { scoreMax: Number(scoreMax) } : {}),
  };
}

articleTypesRoute.get("/", async (c) => {
  const result = await getArticleTypes(c.env.DB);
  return c.json({
    message: "Article types fetched successfully",
    data: result,
  });
});

articleTypesRoute.get("/:id", async (c) => {
  const id = c.req.param("id");

  if (!id?.trim()) {
    return c.json({ message: "Article type id is required" }, 400);
  }

  const data = await getArticleTypeById(c.env.DB, id);

  return c.json({
    message: "Article type fetched successfully",
    data,
  });
});

articleTypesRoute.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = parseArticleTypeBody(body, false);

  if ("error" in parsed) {
    return c.json({ message: parsed.error }, 400);
  }

  try {
    const data = await createArticleType(
      c.env.DB,
      parsed as ArticleTypeInput,
      c.get("user").id,
    );

    return c.json(
      {
        message: "Article type created successfully.",
        data,
      },
      201,
    );
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to create article type" },
      400,
    );
  }
});

articleTypesRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");

  if (!id?.trim()) {
    return c.json({ message: "Article type id is required" }, 400);
  }

  const body = await c.req.json();
  const parsed = parseArticleTypeBody(body, true);

  if ("error" in parsed) {
    return c.json({ message: parsed.error }, 400);
  }

  try {
    await updateArticleType(c.env.DB, id, parsed);
    return c.json({ message: "Article type updated successfully" });
  } catch (err: any) {
    return c.json(
      { message: err.message || "Failed to update article type" },
      400,
    );
  }
});

articleTypesRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");

  if (!id?.trim()) {
    return c.json({ message: "Article type id is required" }, 400);
  }

  await deactivateArticleType(c.env.DB, id);

  return c.json({ message: "Article type deleted successfully" });
});

export default articleTypesRoute;
