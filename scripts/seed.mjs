import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { parse } from "csv-parse/sync";
import mammoth from "mammoth";
import matter from "gray-matter";

const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const FOLDER = process.env.SEED_FOLDER ?? path.join(ROOT, "Article_folder");
const CSV =
  process.env.SEED_CSV ?? path.join(ROOT, "scripts/article_type_mapping.csv");
import { globSync } from "fs";
const _dbGlob = globSync(
  path.join(ROOT, "article-api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite"),
).find((f) => !f.includes("metadata"));
const DB = process.env.SEED_DB ?? _dbGlob ?? null;

function monToNum(s) {
  const m = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    sept: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };
  let x = s.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s\-]*(\d{2,4})$/i,
  );
  if (x) {
    let y = x[2];
    if (y.length === 2) y = "20" + y;
    return y + "-" + m[x[1].toLowerCase()];
  }
  return null;
}
function parseFilename(fn) {
  const b = fn.replace(/\.(docx|md|mdx)$/i, "").trim();
  let m = b.match(
    /^E\d+\s*[_-]\s*([A-Za-z]+\s*\d{2,4})\s*[-_]\s*([A-Za-z][A-Za-z\s.'-]*?)\s*[-_]\s*(.+)$/,
  );
  if (m)
    return {
      monthYear: monToNum(m[1]),
      author: m[2].trim(),
      title: m[3].replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(),
    };
  m = b.match(
    /^([A-Za-z]+\s*\d{2,4})\s*[-\u2013]\s*([A-Za-z][A-Za-z\s.'-]*?)\s*[-\u2013]\s*(.+)$/,
  );
  if (m)
    return {
      monthYear: monToNum(m[1]),
      author: m[2].trim(),
      title: m[3].replace(/[_-]+/g, " ").trim(),
    };
  return {
    monthYear: null,
    author: null,
    title: b.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim(),
  };
}

if (!DB || !fs.existsSync(DB)) {
  console.error(
    DB ? `DB not found at ${DB}` : "DB not found via glob. Run: npx wrangler d1 migrations apply --local (in article-api) or set SEED_DB env",
  );
  process.exit(1);
}
if (!fs.existsSync(FOLDER)) {
  console.error("Folder not found", FOLDER);
  process.exit(1);
}

let raw = fs.readFileSync(CSV, "utf8");
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const lines = raw.split(/\r?\n/);
const hi = lines.findIndex(
  (l) =>
    l.toLowerCase().includes("filename") &&
    l.toLowerCase().includes("primary purpose"),
);
const recs = parse(lines.slice(hi).join("\n"), {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: true,
});
const map = new Map();
const monthMap = new Map();
recs.forEach((r) => {
  const fn = (r.Filename || "").trim();
  const p = (r["Primary Purpose"] || "").trim();
  const m = (r.Month || r.month || "").trim();
  if (fn && p) map.set(fn.toLowerCase(), p);
  if (fn && m) monthMap.set(fn.toLowerCase(), m);
});
console.log(`CSV: ${map.size} mapped, ${new Set(map.values()).size} types`);

const db = new DatabaseSync(DB);
const vishal = db
  .prepare(
    "SELECT email,auth_role FROM users WHERE email='vishal@noesyssoftware.com'",
  )
  .get();
console.log(
  "vishal@noesyssoftware.com:",
  vishal ?? "not found (already set via DB, not hardcoded)",
);
if (!db.prepare("SELECT id FROM users WHERE id='seed_bot_001'").get()) {
  db.prepare(
    "INSERT INTO users (id,email,name,auth_role,job_role,created_at,created_by,is_active) VALUES (?,?,?,?,?,?,?,?)",
  ).run(
    "seed_bot_001",
    "seed-bot@noesys.local",
    "Seeder Bot",
    "user",
    "Seeder",
    new Date().toISOString(),
    null,
    1,
  );
}

// ensure types from CSV (exact strings)
const distinct = [...new Set(map.values())];
for (const name of distinct) {
  let row = db
    .prepare("SELECT id FROM article_types WHERE lower(name)=lower(?)")
    .get(name);
  if (row) continue;
  const id = "at_" + crypto.randomUUID();
  db.prepare(
    "INSERT INTO article_types (id,name,created_by,created_at,updated_at,pass_threshold,score_prompt,score_min,score_max) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    name,
    "seed_bot_001",
    new Date().toISOString(),
    new Date().toISOString(),
    5,
    "",
    0,
    10,
  );
  console.log(`Created type "${name}"`);
}
const typeRows = db.prepare("SELECT id,name FROM article_types").all();
const typeMap = new Map(typeRows.map((r) => [r.name.toLowerCase(), r.id]));

const files = fs.readdirSync(FOLDER).filter((f) => /\.(docx|md|mdx)$/i.test(f));
console.log(`Files: ${files.length}`);
// clear previous seeded articles to avoid duplicates and ensure month fix
db.prepare(
  "DELETE FROM article_history WHERE article_id IN (SELECT id FROM articles WHERE user_id='seed_bot_001')",
).run();
db.prepare("DELETE FROM articles WHERE user_id='seed_bot_001'").run();
let inserted = 0,
  skipped = 0;
for (const file of files) {
  let purpose = map.get(file.toLowerCase());
  // for missing CSV rows, fallback to Not suitable type and still import (covers remaining 30)
  if (!purpose) purpose = "Not suitable";
  const typeId = typeMap.get(purpose.toLowerCase());
  if (!typeId) {
    skipped++;
    continue;
  }
  let { monthYear, author, title } = parseFilename(file);
  // prefer CSV Month column over filename parse
  const csvMonth = monthMap.get(file.toLowerCase());
  if (csvMonth) {
    const parsed = monToNum(csvMonth);
    if (parsed) monthYear = parsed;
    else if (/^\d{4}-\d{2}$/.test(csvMonth.trim())) monthYear = csvMonth.trim();
  }
  // ensure title has no E prefix left
  title = title.replace(/^E\d+\s*[-_]\s*/i, "").trim();
  let content = "";
  if (/\.mdx?$/i.test(file)) {
    const t = fs.readFileSync(path.join(FOLDER, file), "utf8");
    try {
      const fm = matter(t);
      content = (fm.content || "").trim();
    } catch {
      content = t.trim();
    }
  } else {
    const buf = fs.readFileSync(path.join(FOLDER, file));
    const r = await mammoth.convertToHtml({ buffer: buf });
    content = r.value.trim();
    if (!content) content = "(empty)";
  }
  const seeded = `<!-- author_name: ${(author || "Unknown Author").replace(/-->/g, "")} -->\n${content}`;
  const id = "art_" + crypto.randomUUID();
  const my = monthYear || new Date().toISOString().slice(0, 7);
  try {
    db.prepare(
      "INSERT INTO articles (id,user_id,article_type_id,title,content,status,ai_score,version,submitted_at,scored_at,month_year,retry_count,ai_feedback) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      "seed_bot_001",
      typeId,
      title.slice(0, 500),
      seeded,
      "pending",
      null,
      1,
      new Date().toISOString(),
      null,
      my,
      0,
      null,
    );
    inserted++;
  } catch (e) {
    console.error(file, e.message.slice(0, 200));
  }
}
console.log(`Done: inserted=${inserted} skipped=${skipped} (no CSV row)`);
console.log(
  "counts",
  db.prepare("SELECT count(*) as c FROM articles").get(),
  db.prepare("SELECT count(*) as c FROM article_types").get(),
  db
    .prepare(
      "SELECT email,auth_role FROM users WHERE email='vishal@noesyssoftware.com'",
    )
    .get(),
);


