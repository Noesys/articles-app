import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
// Credentials from article-api/wrangler.toml [[d1_databases]]
const DB_NAME = "noesys-articles";
const DB_ID = "acc066a7-2084-4d5e-89b0-90c20c4ceb6c";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const p = path.join(
  ROOT,
  "article-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);
const DB = fs
  .readdirSync(p)
  .filter((f) => f.endsWith(".sqlite") && !f.includes("metadata"))
  .map((f) => path.join(p, f))[0];
const db = new DatabaseSync(DB);
const email = "vishal@noesyssoftware.com";
const ex = db.prepare("SELECT * FROM users WHERE email=?").get(email);
if (ex) {
  db.prepare("UPDATE users SET auth_role=?, job_role=? WHERE email=?").run(
    "admin",
    "Admin",
    email,
  );
  console.log("updated", ex.id);
} else {
  const id = "usr_" + crypto.randomUUID();
  db.prepare(
    "INSERT INTO users(id,email,name,auth_role,job_role,created_at,is_active)VALUES(?,?,?,?,?,?,?)",
  ).run(id, email, "vishal", "admin", "Admin", new Date().toISOString(), 1);
  console.log("created", id);
}
console.log(db.prepare("SELECT * FROM users WHERE email=?").get(email));
