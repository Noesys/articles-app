import { z } from "zod";

/** Shared Zod schemas for tool inputs. Keep enums aligned with the admin API. */
export const monthYear = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM")
  .describe("Calendar month as YYYY-MM (e.g. 2026-09)");

export const articleStatus = z
  .enum(["pending", "approved", "rewrite_required", "failed"])
  .describe("Article status filter");

export const page = z
  .number()
  .int()
  .min(1)
  .default(1)
  .describe("Page number (1-based)");

export const limit = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .describe("Rows per page (max 100)");

export const userId = z.string().min(1).describe("User ID (e.g. usr_demo_priya)");

export const articleId = z.string().min(1).describe("Article ID (e.g. art_priya_latest)");

export const personQuery = z
  .string()
  .min(1)
  .describe("Person name, email, or user ID. Prefer email or ID when names collide.");
