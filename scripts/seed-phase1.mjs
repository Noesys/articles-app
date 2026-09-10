import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
// Credentials from article-api/wrangler.toml [[d1_databases]]
const DB_NAME = "noesys-articles";
const DB_ID = "acc066a7-2084-4d5e-89b0-90c20c4ceb6c";
const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
  "..",
);
function findDB() {
  const p = path.join(
    ROOT,
    "article-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject",
  );
  if (!fs.existsSync(p)) return null;
  return (
    fs
      .readdirSync(p)
      .filter((f) => f.endsWith(".sqlite") && !f.includes("metadata"))
      .map((f) => path.join(p, f))[0] ?? null
  );
}
const DB = process.env.SEED_DB ?? findDB();
if (!DB && !process.env.SEED_REMOTE)
  console.warn(
    `Local D1 not found. Run with SEED_REMOTE=1 to target production ${DB_NAME} (${DB_ID}) via wrangler d1 execute --remote, or set SEED_DB=<path>.`,
  );
const DRY = process.argv.includes("--dry-run");
const db = new DatabaseSync(DB);
// Apply migrations required for this project (noesys-articles) - order matters, idempotent
for (const mig of [
  "0007_article_types_is_active.sql",
  "0008_unique_index.sql",
  "0009_evaluatable_flag_employee_linkage.sql",
]) {
  try {
    db.exec(
      fs.readFileSync(
        path.join(ROOT, `article-api/src/migrations/${mig}`),
        "utf8",
      ),
    );
  } catch (e) {
    console.log(`migration ${mig}:`, e.message.slice(0, 120));
  }
}
if (!DRY && !db.prepare("SELECT id FROM users WHERE id='seed_bot_001'").get())
  db.prepare(
    "INSERT INTO users(id,email,name,auth_role,job_role,created_at,is_active)VALUES(?,?,?,?,?,?,?)",
  ).run(
    "seed_bot_001",
    "seed-bot@noesys.local",
    "Seeder Bot",
    "user",
    "Seeder",
    new Date().toISOString(),
    1,
  );
const types = [
  "Use case blog",
  "Platform hub content",
  "Industry hub content",
  "KPI/metrics content",
  "Technical blog",
  "Guide or framework",
  "Success story",
  "Offline marketing content",
  "Not suitable",
];
for (const n of types) {
  let r = db
    .prepare("SELECT id FROM article_types WHERE lower(name)=lower(?)")
    .get(n);
  if (r) continue;
  const id = "at_" + crypto.randomUUID();
  if (!DRY)
    db.prepare(
      "INSERT INTO article_types(id,name,created_by,created_at,updated_at,pass_threshold,score_prompt,score_min,score_max,is_evaluatable)VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      n,
      "seed_bot_001",
      new Date().toISOString(),
      new Date().toISOString(),
      5,
      "",
      0,
      10,
      n === "Not suitable" ? 0 : 1,
    );
  console.log((DRY ? "[dry] " : "") + "type " + n);
}
// ensure evaluatable flag correct
if (!DRY) {
  try {
    db.prepare(
      "UPDATE article_types SET is_evaluatable=0 WHERE lower(name)='not suitable'",
    ).run();
    db.prepare(
      "UPDATE article_types SET is_evaluatable=1 WHERE lower(name)!='not suitable'",
    ).run();
  } catch {}
}
const typeRows = db.prepare("SELECT id,name FROM article_types").all();
const typeMap = new Map(typeRows.map((r) => [r.name.toLowerCase(), r.id]));
// prompts
const raw = fs.readFileSync(
  path.join(ROOT, "scripts/article_scoring_prompts.md"),
  "utf8",
);
const parts = raw.split(/^# \d+\.\s+/m).slice(1);
const headingToName = {
  "USE CASE BLOG": "Use case blog",
  "PLATFORM HUB CONTENT": "Platform hub content",
  "INDUSTRY HUB CONTENT": "Industry hub content",
  "KPI / METRICS CONTENT": "KPI/metrics content",
  "TECHNICAL BLOG": "Technical blog",
  "GUIDE OR FRAMEWORK": "Guide or framework",
  "GUIDE / FRAMEWORK": "Guide or framework",
  "SUCCESS STORY": "Success story",
  "OFFLINE MARKETING CONTENT": "Offline marketing content",
};
for (const p of parts) {
  const nl = p.indexOf("\n");
  const head = p.slice(0, nl).replace(/—.*$/, "").trim().toUpperCase();
  const tName = headingToName[head];
  if (!tName) continue;
  const content = p.slice(nl).trim();
  const tid = typeMap.get(tName.toLowerCase());
  if (!tid) continue;
  const ex = db
    .prepare("SELECT id FROM prompts WHERE article_type_id=?")
    .get(tid);
  if (ex) {
    if (!DRY)
      db.prepare("UPDATE prompts SET content=?,updated_at=? WHERE id=?").run(
        content,
        new Date().toISOString(),
        ex.id,
      );
    console.log("updated prompt " + tName);
    continue;
  }
  if (!DRY)
    db.prepare(
      "INSERT INTO prompts(id,article_type_id,content,created_by,created_at,updated_at)VALUES(?,?,?,?,?,?)",
    ).run(
      "pr_" + crypto.randomUUID(),
      tid,
      content,
      "seed_bot_001",
      new Date().toISOString(),
      new Date().toISOString(),
    );
  console.log("prompt " + tName);
}
// parameters from parameter_prompts.md (6 per type)
const praw = fs.readFileSync(
  path.join(ROOT, "scripts/parameter_prompts.md"),
  "utf8",
);
const pParts = praw.split(/^[ \t]*# \d+\.\s+/m).slice(1);
for (const pp of pParts) {
  const nl = pp.indexOf("\n");
  const head = pp.slice(0, nl).replace(/—.*$/, "").trim().toUpperCase();
  const tName = headingToName[head];
  if (!tName) continue;
  const tid = typeMap.get(tName.toLowerCase());
  if (!tid) continue;
  let names = [
    "Authenticity",
    "Practitioner Depth",
    "Original Insight",
    "Writing Voice",
    "Learning Evidence",
    "AI Fluff",
  ];
  for (let i = 0; i < names.length; i++) {
    const nm = names[i];
    let q = `### ${i + 1}. ${nm}`;
    let idx = pp.indexOf(`### ${i + 1}.`);
    if (idx === -1) idx = pp.indexOf(nm);
    let prompt = pp
      .slice(
        idx,
        pp.indexOf("### " + (i + 2) + ".", idx + 1) === -1
          ? undefined
          : pp.indexOf("### " + (i + 2) + ".", idx + 1),
      )
      .trim()
      .slice(0, 2000);
    const ex = db
      .prepare(
        "SELECT id FROM parameters WHERE article_type_id=? AND lower(name)=lower(?)",
      )
      .get(tid, nm);
    if (ex) {
      if (!DRY)
        db.prepare(
          "UPDATE parameters SET prompt=?,updated_at=? WHERE id=?",
        ).run(prompt, new Date().toISOString(), ex.id);
      continue;
    }
    if (!DRY)
      db.prepare(
        "INSERT INTO parameters(id,article_type_id,name,prompt,scope_type,min_value,max_value,is_active,sort_order,created_by,created_at,updated_at)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      ).run(
        "prm_" + crypto.randomUUID(),
        tid,
        nm,
        prompt,
        "numeric",
        1,
        10,
        1,
        i + 1,
        "seed_bot_001",
        new Date().toISOString(),
        new Date().toISOString(),
      );
  }
  console.log("params " + tName);
}
console.log("phase1 done", DRY ? "(dry)" : "");
