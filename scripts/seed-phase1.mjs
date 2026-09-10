import fs from "fs";
import path from "path";
import crypto from "crypto";
import {
  ROOT,
  DB_NAME,
  DB_ID,
  assertWranglerLoggedIn,
  applyRemoteMigrations,
  d1Query,
  d1Exec,
  d1ExecBatched,
  sqlStr,
  sqlNum,
} from "./d1-remote.mjs";

const DRY = process.argv.includes("--dry-run");

console.log(`seed-phase1 → remote D1 ${DB_NAME} (${DB_ID})`);
assertWranglerLoggedIn();
if (!DRY) applyRemoteMigrations();

const now = new Date().toISOString();
const stmts = [];

const seedBot = d1Query(
  `SELECT id FROM users WHERE id=${sqlStr("seed_bot_001")} LIMIT 1`,
  { dry: DRY },
);
if (!seedBot.length) {
  stmts.push(
    `INSERT INTO users(id,email,name,auth_role,job_role,created_at,is_active)VALUES(${[
      sqlStr("seed_bot_001"),
      sqlStr("seed-bot@noesys.local"),
      sqlStr("Seeder Bot"),
      sqlStr("user"),
      sqlStr("Seeder"),
      sqlStr(now),
      sqlNum(1),
    ].join(",")})`,
  );
}

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

const existingTypes = d1Query(`SELECT id, name FROM article_types`, { dry: DRY });
const typeMap = new Map(
  existingTypes.map((r) => [String(r.name).toLowerCase(), r.id]),
);

for (const n of types) {
  if (typeMap.has(n.toLowerCase())) continue;
  const id = "at_" + crypto.randomUUID();
  typeMap.set(n.toLowerCase(), id);
  stmts.push(
    `INSERT INTO article_types(id,name,created_by,created_at,updated_at,pass_threshold,score_prompt,score_min,score_max,is_evaluatable)VALUES(${[
      sqlStr(id),
      sqlStr(n),
      sqlStr("seed_bot_001"),
      sqlStr(now),
      sqlStr(now),
      sqlNum(5),
      sqlStr(""),
      sqlNum(0),
      sqlNum(10),
      sqlNum(n === "Not suitable" ? 0 : 1),
    ].join(",")})`,
  );
  console.log((DRY ? "[dry] " : "") + "type " + n);
}

stmts.push(
  `UPDATE article_types SET is_evaluatable=0 WHERE lower(name)='not suitable'`,
);
stmts.push(
  `UPDATE article_types SET is_evaluatable=1 WHERE lower(name)!='not suitable'`,
);

d1ExecBatched(stmts, { dry: DRY, label: "phase1-types" });

// refresh type map from remote after inserts
const typeRows = d1Query(`SELECT id, name FROM article_types`, { dry: DRY });
for (const r of typeRows) typeMap.set(String(r.name).toLowerCase(), r.id);

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

const promptStmts = [];
const raw = fs.readFileSync(
  path.join(ROOT, "scripts/article_scoring_prompts.md"),
  "utf8",
);
const parts = raw.split(/^# \d+\.\s+/m).slice(1);
const existingPrompts = d1Query(
  `SELECT id, article_type_id FROM prompts`,
  { dry: DRY },
);
const promptByType = new Map(
  existingPrompts.map((r) => [r.article_type_id, r.id]),
);

for (const p of parts) {
  const nl = p.indexOf("\n");
  const head = p.slice(0, nl).replace(/—.*$/, "").trim().toUpperCase();
  const tName = headingToName[head];
  if (!tName) continue;
  const content = p.slice(nl).trim();
  const tid = typeMap.get(tName.toLowerCase());
  if (!tid) continue;
  const exId = promptByType.get(tid);
  if (exId) {
    promptStmts.push(
      `UPDATE prompts SET content=${sqlStr(content)},updated_at=${sqlStr(now)} WHERE id=${sqlStr(exId)}`,
    );
    console.log("updated prompt " + tName);
    continue;
  }
  const pid = "pr_" + crypto.randomUUID();
  promptByType.set(tid, pid);
  promptStmts.push(
    `INSERT INTO prompts(id,article_type_id,content,created_by,created_at,updated_at)VALUES(${[
      sqlStr(pid),
      sqlStr(tid),
      sqlStr(content),
      sqlStr("seed_bot_001"),
      sqlStr(now),
      sqlStr(now),
    ].join(",")})`,
  );
  console.log("prompt " + tName);
}

d1ExecBatched(promptStmts, { dry: DRY, chunkSize: 5, label: "phase1-prompts" });

const paramStmts = [];
const praw = fs.readFileSync(
  path.join(ROOT, "scripts/parameter_prompts.md"),
  "utf8",
);
const pParts = praw.split(/^[ \t]*# \d+\.\s+/m).slice(1);
const existingParams = d1Query(
  `SELECT id, article_type_id, name FROM parameters`,
  { dry: DRY },
);
const paramKey = (tid, name) => `${tid}::${String(name).toLowerCase()}`;
const paramByKey = new Map(
  existingParams.map((r) => [paramKey(r.article_type_id, r.name), r.id]),
);

for (const pp of pParts) {
  const nl = pp.indexOf("\n");
  const head = pp.slice(0, nl).replace(/—.*$/, "").trim().toUpperCase();
  const tName = headingToName[head];
  if (!tName) continue;
  const tid = typeMap.get(tName.toLowerCase());
  if (!tid) continue;
  const names = [
    "Authenticity",
    "Practitioner Depth",
    "Original Insight",
    "Writing Voice",
    "Learning Evidence",
    "AI Fluff",
  ];
  for (let i = 0; i < names.length; i++) {
    const nm = names[i];
    let idx = pp.indexOf(`### ${i + 1}.`);
    if (idx === -1) idx = pp.indexOf(nm);
    const prompt = pp
      .slice(
        idx,
        pp.indexOf("### " + (i + 2) + ".", idx + 1) === -1
          ? undefined
          : pp.indexOf("### " + (i + 2) + ".", idx + 1),
      )
      .trim()
      .slice(0, 2000);
    const key = paramKey(tid, nm);
    const exId = paramByKey.get(key);
    if (exId) {
      paramStmts.push(
        `UPDATE parameters SET prompt=${sqlStr(prompt)},updated_at=${sqlStr(now)} WHERE id=${sqlStr(exId)}`,
      );
      continue;
    }
    const id = "prm_" + crypto.randomUUID();
    paramByKey.set(key, id);
    paramStmts.push(
      `INSERT INTO parameters(id,article_type_id,name,prompt,scope_type,min_value,max_value,is_active,sort_order,created_by,created_at,updated_at)VALUES(${[
        sqlStr(id),
        sqlStr(tid),
        sqlStr(nm),
        sqlStr(prompt),
        sqlStr("numeric"),
        sqlNum(1),
        sqlNum(10),
        sqlNum(1),
        sqlNum(i + 1),
        sqlStr("seed_bot_001"),
        sqlStr(now),
        sqlStr(now),
      ].join(",")})`,
    );
  }
  console.log("params " + tName);
}

d1ExecBatched(paramStmts, { dry: DRY, chunkSize: 10, label: "phase1-params" });

if (!DRY) {
  const counts = d1Query(
    `SELECT
      (SELECT COUNT(*) FROM article_types) AS types,
      (SELECT COUNT(*) FROM prompts) AS prompts,
      (SELECT COUNT(*) FROM parameters) AS parameters`,
  );
  console.log("phase1 done", counts[0] || {});
} else {
  console.log("phase1 done (dry)");
}
