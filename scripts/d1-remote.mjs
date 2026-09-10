/**
 * Remote-only D1 helper via already-logged-in wrangler OAuth.
 * Uses article-api/wrangler.toml (noesys-articles). Never touches local sqlite.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "..");
export const API_DIR = path.join(ROOT, "article-api");
export const DB_NAME = "noesys-articles";
export const DB_ID = "acc066a7-2084-4d5e-89b0-90c20c4ceb6c";

export function sqlStr(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlNum(value) {
  if (value === null || value === undefined) return "NULL";
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid number: ${value}`);
  return String(n);
}

function runWrangler(args) {
  const out = execFileSync("npx", ["wrangler", ...args], {
    cwd: API_DIR,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out;
}

/** Confirm wrangler session is already authenticated (no login prompt). */
export function assertWranglerLoggedIn() {
  try {
    const who = runWrangler(["whoami"]);
    if (/not authenticated|log in|login/i.test(who)) {
      throw new Error("wrangler not authenticated");
    }
    console.log("wrangler auth ok (using existing login)");
  } catch (e) {
    console.error(
      "Wrangler is not logged in. Run once: cd article-api && npx wrangler login",
    );
    throw e;
  }
}

/** Apply pending D1 migrations on remote (idempotent). */
export function applyRemoteMigrations() {
  console.log(`Applying remote migrations on ${DB_NAME}...`);
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "migrations", "apply", DB_NAME, "--remote"],
    {
      cwd: API_DIR,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" }, // non-interactive yes
    },
  );
  console.log(out.trim() || "migrations apply done");
}

/**
 * Run one or more SQL statements against remote D1.
 * Prefer batches via temp --file (handles large prompt/article bodies).
 */
export function d1Exec(sql, { dry = false, label = "exec" } = {}) {
  const body = Array.isArray(sql) ? sql.filter(Boolean).join("\n") : sql;
  if (!body.trim()) return null;
  if (dry) {
    console.log(`[dry] ${label}: ${body.slice(0, 180).replace(/\s+/g, " ")}…`);
    return null;
  }
  const tmp = path.join(
    os.tmpdir(),
    `d1-seed-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sql`,
  );
  fs.writeFileSync(tmp, body.endsWith(";\n") || body.endsWith(";") ? body : `${body};\n`);
  try {
    const out = runWrangler([
      "d1",
      "execute",
      DB_NAME,
      "--remote",
      "--json",
      "--file",
      tmp,
    ]);
    // wrangler may print non-JSON warnings before JSON array
    const start = out.indexOf("[");
    if (start === -1) return out;
    return JSON.parse(out.slice(start));
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {}
  }
}

/** SELECT helper — returns rows array from first result set. */
export function d1Query(sql, { dry = false } = {}) {
  if (dry) {
    console.log(`[dry] query: ${sql}`);
    return [];
  }
  const parsed = d1Exec(sql);
  if (!parsed || !Array.isArray(parsed)) return [];
  return parsed[0]?.results ?? [];
}

/** Flush a growing statement list in chunks to stay under CLI limits. */
export function d1ExecBatched(statements, { dry = false, chunkSize = 25, label = "batch" } = {}) {
  const stmts = statements.filter(Boolean);
  for (let i = 0; i < stmts.length; i += chunkSize) {
    const chunk = stmts.slice(i, i + chunkSize);
    d1Exec(chunk.map((s) => (s.trim().endsWith(";") ? s : `${s};`)).join("\n"), {
      dry,
      label: `${label} ${i / chunkSize + 1}`,
    });
  }
}
