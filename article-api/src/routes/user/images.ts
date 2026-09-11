import { Hono } from "hono";
import type { AppEnv } from "../../types/shared-types";
import { accessAuth } from "../../middleware/accessAuth";
import { AppError, badRequest, notFound } from "../../utils/errors";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILENAME_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|gif|webp)$/i;

const imageRoutes = new Hono<AppEnv>();

imageRoutes.post("/", accessAuth, async (c) => {
  const bucket = c.env.IMAGES;
  if (!bucket) throw new AppError("Image storage is not configured", 503);

  const user = c.get("user");
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw badRequest("Expected multipart form data");
  }

  const entry = form.get("file");
  if (!(entry instanceof File)) throw badRequest('Missing file field "file"');

  const contentType = (entry.type || "").toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    throw badRequest("Unsupported image type. Use JPEG, PNG, GIF, or WebP.");
  }
  if (entry.size <= 0) throw badRequest("Empty file");
  if (entry.size > MAX_BYTES) throw badRequest("Image exceeds 2MB limit");

  const ext = EXT_BY_TYPE[contentType];
  const id = crypto.randomUUID();
  const key = `articles/${user.id}/${id}.${ext}`;
  const bytes = await entry.arrayBuffer();

  await bucket.put(key, bytes, {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedBy: user.id,
      originalName: entry.name?.slice(0, 200) || "",
    },
  });

  const url = `/api/images/${user.id}/${id}.${ext}`;
  return c.json(
    {
      success: true,
      message: "Image uploaded",
      data: { key, url, contentType, size: entry.size },
    },
    201,
  );
});

imageRoutes.get("/:userId/:filename", async (c) => {
  const bucket = c.env.IMAGES;
  if (!bucket) throw new AppError("Image storage is not configured", 503);

  const userId = c.req.param("userId");
  const filename = c.req.param("filename");
  if (!USER_ID_RE.test(userId) || !FILENAME_RE.test(filename)) {
    throw notFound("Image");
  }

  const key = `articles/${userId}/${filename}`;
  const obj = await bucket.get(key);
  if (!obj) throw notFound("Image");

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }

  return new Response(obj.body, { status: 200, headers });
});

export default imageRoutes;
