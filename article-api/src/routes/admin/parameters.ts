import { Hono } from "hono";
import { ParameterInput } from "../../types/admin-types";
import {
  createParameter,
  deactivateParameter,
  getParameterById,
  getParametersByArticleType,
  updateParameter,
} from "../../services/admin/parameters.service";
import { authMiddleware } from "../../middleware/adminAuth";
import { AppEnv } from "../../types/shared-types";

const parametersRoute = new Hono<AppEnv>();
parametersRoute.use("*", authMiddleware("admin", "super_admin"));

function parseParameterBody(body: unknown): ParameterInput | { error: string } {
  const b = body as Record<string, unknown>;
  const name = b.name as string | undefined;
  const prompt = b.prompt as string | undefined;
  const scopeType = b.scopeType as string | undefined;

  if (!name?.trim()) return { error: "Parameter name is required" };
  if (!prompt?.trim()) return { error: "Parameter prompt is required" };
  if (scopeType !== "numeric" && scopeType !== "option") {
    return { error: "scopeType must be 'numeric' or 'option'" };
  }

  return {
    name: name.trim(),
    prompt: prompt.trim(),
    scopeType,
    minValue: b.minValue as number | undefined,
    maxValue: b.maxValue as number | undefined,
    options: b.options as ParameterInput["options"],
  };
}

parametersRoute.get("/:articleTypeId/parameters", async (c) => {
  const articleTypeId = c.req.param("articleTypeId");
  const result = await getParametersByArticleType(c.env.DB, articleTypeId);
  return c.json({
    message: "Parameters fetched successfully",
    data: result,
  });
});

parametersRoute.get("/:articleTypeId/parameters/:id", async (c) => {
  const id = c.req.param("id");
  const data = await getParameterById(c.env.DB, id);
  return c.json({
    message: "Parameter fetched successfully",
    data,
  });
});

parametersRoute.post("/:articleTypeId/parameters", async (c) => {
  const articleTypeId = c.req.param("articleTypeId");

  const body = await c.req.json();
  const parsed = parseParameterBody(body);

  if ("error" in parsed) {
    return c.json({ message: parsed.error }, 400);
  }

  const data = await createParameter(
    c.env.DB,
    parsed,
    c.get("user").id,
    articleTypeId,
  );

  return c.json({ message: "Parameter created successfully.", data }, 201);
});

parametersRoute.patch("/:articleTypeId/parameters/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = parseParameterBody(body);

    if ("error" in parsed) {
      return c.json({ message: parsed.error }, 400);
    }
    await updateParameter(c.env.DB, id, parsed);

    return c.json({ message: "Parameter updated successfully" });
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      400,
    );
  }
});

parametersRoute.delete("/:articleTypeId/parameters/:id", async (c) => {
  const id = c.req.param("id");
  await deactivateParameter(c.env.DB, id);
  return c.json({ message: "Parameter deleted successfully" });
});

export default parametersRoute;
