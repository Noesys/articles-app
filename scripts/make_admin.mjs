import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import crypto from "crypto";
const ROOT = process.cwd();
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
