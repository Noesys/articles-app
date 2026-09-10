import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import mammoth from "mammoth";
import matter from "gray-matter";
import XLSX from "xlsx";
// Credentials from article-api/wrangler.toml [[d1_databases]]
const DB_NAME = "noesys-articles";
const DB_ID = "acc066a7-2084-4d5e-89b0-90c20c4ceb6c";
const ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
  "..",
);
const FOLDER = path.join(ROOT, "Article_folder");
const DRY = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");
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
function norm(s) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}
// parse Articles_By_Employee.md
const md = fs.readFileSync(
  path.join(ROOT, "scripts/Articles_By_Employee.md"),
  "utf8",
);
const map = new Map(); // lower filename -> {empId,email,monthYear}
let curEmp = null,
  curEmail = null,
  curMonth = null;
for (const line of md.split(/\r?\n/)) {
  let m = line.match(/^##\s+.+--\s*(E\d+)/i);
  if (m) {
    curEmp = m[1].toUpperCase();
    continue;
  }
  m = line.match(/\*Email:\s*([^\*]+)\*/i);
  if (m) {
    curEmail = m[1].trim().toLowerCase();
    continue;
  }
  m = line.match(
    /^###\s+(Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec).*?(\d{2,4})?/i,
  );
  if (m) {
    let s = m[1];
    let y = m[2] || "26";
    curMonth = monToNum(s + " " + y) || monToNum(s + "-26");
    continue;
  }
  m = line.match(/^\s*-\s+(.+\.(docx|md|mdx))\s*$/i);
  if (m && curEmp && curEmail && curMonth) {
    map.set(m[1].trim().toLowerCase(), {
      empId: curEmp,
      email: curEmail,
      monthYear: curMonth,
    });
  }
}
console.log(`MD parsed: ${map.size} articles`);
// load Primary Purpose mapping (xlsx — full 133 including Aug)
const xlsxPath = path.join(
  ROOT,
  "scripts/article_primary_purpose_mapping.xlsx",
);
const wb = XLSX.readFile(xlsxPath);
const sh = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: "" });
const purposeMap = new Map();
for (const r of rows.slice(1)) {
  const fn = String(r[0] || "")
    .trim()
    .toLowerCase();
  const p = String(r[1] || "").trim();
  if (fn && p) purposeMap.set(fn, p);
}
const db = new DatabaseSync(DB);
db.exec("PRAGMA foreign_keys=OFF");
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
  } catch {}
}
const typeRows = db.prepare("SELECT id,name FROM article_types").all();
const typeMap = new Map(typeRows.map((r) => [r.name.toLowerCase(), r.id]));
if (!typeMap.has("not suitable")) {
  console.error("Run phase1 first");
  process.exit(1);
}
// ensure stub users for admin Author column (so LEFT JOIN on email resolves to name, not email)
if (!DRY) {
  const empRows = [
    ...md.matchAll(
      /\|\s*(E\d+)\s*\|\s*([^|]+?)\s*\|\s*([^\s|]+@[^\s|]+)\s*\|/g,
    ),
  ].map((m) => [m[1], m[2].trim(), m[3].trim().toLowerCase()]);
  for (const [empId, name, email] of empRows) {
    const ex = db
      .prepare("select id from users where lower(email)=lower(?)")
      .get(email);
    if (!ex)
      try {
        db.prepare(
          "insert into users(id,email,name,auth_role,job_role,created_at,is_active)values(?,?,?,?,?,?,?)",
        ).run(
          "usr_" + empId.toLowerCase(),
          email,
          name,
          "user",
          "Employee",
          new Date().toISOString(),
          1,
        );
      } catch {}
    else
      db.prepare("update users set name=? where lower(email)=lower(?)").run(
        name,
        email,
      );
  }
  db.prepare(
    "DELETE FROM article_history WHERE article_id IN (SELECT id FROM articles WHERE employee_email IS NOT NULL)",
  ).run();
  db.prepare("DELETE FROM articles WHERE employee_email IS NOT NULL").run();
}
let ins = 0,
  skip = 0;
for (const [low, info] of map) {
  const purpose = purposeMap.get(low) || "Not suitable";
  const tid =
    typeMap.get((purpose || "Not suitable").toLowerCase()) ||
    typeMap.get("not suitable");
  const fileExists = [...fs.readdirSync(FOLDER)].find(
    (f) => f.toLowerCase() === low,
  );
  const fname = fileExists || low;
  const fp = fileExists ? path.join(FOLDER, fileExists) : null;
  let title = fname
    .replace(/\.(docx|md|mdx)$/i, "")
    .replace(/^E\d+\s*[-_]\s*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
  let content = "";
  if (fp && fs.existsSync(fp)) {
    if (/\.mdx?$/i.test(fname)) {
      const t = fs.readFileSync(fp, "utf8");
      try {
        content = matter(t).content.trim();
      } catch {
        content = t.trim();
      }
    } else {
      const buf = fs.readFileSync(fp);
      const r = await mammoth.convertToHtml({ buffer: buf });
      content = r.value.trim() || "(empty)";
    }
  } else {
    content = "(file not found: " + fname + ")";
    if (VERBOSE) console.warn("missing " + fname);
  }
  const id = "art_" + crypto.randomUUID();
  const status =
    purpose.toLowerCase() === "not suitable" ? "not_suitable" : "pending";
  if (DRY) {
    ins++;
    continue;
  }
  try {
    db.prepare(
      "INSERT INTO articles(id,user_id,article_type_id,title,content,status,ai_score,version,submitted_at,scored_at,month_year,retry_count,ai_feedback,emp_id,employee_email)VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      info.empId,
      tid,
      title,
      content,
      status,
      null,
      1,
      `${info.monthYear}-01T09:00:00.000Z`,
      null,
      info.monthYear,
      0,
      null,
      info.empId,
      info.email,
    );
    ins++;
  } catch (e) {
    console.error(fname, e.message.slice(0, 120));
    skip++;
  }
}
console.log(
  `phase2 done inserted=${ins} skipped=${skip} ${DRY ? "(dry)" : ""}`,
);
// report
console.log(
  db.prepare("SELECT count(*) c FROM articles").get(),
  db.prepare("SELECT count(*) c FROM article_types").get(),
);
