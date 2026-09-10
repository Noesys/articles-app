import fs from "fs";
import path from "path";
import crypto from "crypto";
import mammoth from "mammoth";
import matter from "gray-matter";
import XLSX from "xlsx";
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

const FOLDER = path.join(ROOT, "Article_folder");
const DRY = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

console.log(`seed-phase2 → remote D1 ${DB_NAME} (${DB_ID})`);
assertWranglerLoggedIn();
if (!DRY) applyRemoteMigrations();

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
  const x = s.match(
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s\-]*(\d{2,4})$/i,
  );
  if (x) {
    let y = x[2];
    if (y.length === 2) y = "20" + y;
    return y + "-" + m[x[1].toLowerCase()];
  }
  return null;
}

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
    const s = m[1];
    const y = m[2] || "26";
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

const typeRows = d1Query(`SELECT id, name FROM article_types`, { dry: DRY });
const typeMap = new Map(typeRows.map((r) => [String(r.name).toLowerCase(), r.id]));
if (!DRY && !typeMap.has("not suitable")) {
  console.error("Run phase1 first (Not suitable type missing on remote)");
  process.exit(1);
}

const now = new Date().toISOString();
const userStmts = [];

// Stub users: id = emp id (E…), so articles.user_id / emp_id stay aligned
const empRows = [
  ...md.matchAll(
    /\|\s*(E\d+)\s*\|\s*([^|]+?)\s*\|\s*([^\s|]+@[^\s|]+)\s*\|/g,
  ),
].map((m) => [m[1].toUpperCase(), m[2].trim(), m[3].trim().toLowerCase()]);

const existingUsers = d1Query(`SELECT id, email FROM users`, { dry: DRY });
const byEmail = new Map(
  existingUsers.map((u) => [String(u.email).toLowerCase(), u.id]),
);

for (const [empId, name, email] of empRows) {
  const exId = byEmail.get(email);
  if (!exId) {
    userStmts.push(
      `INSERT INTO users(id,email,name,auth_role,job_role,created_at,is_active)VALUES(${[
        sqlStr(empId),
        sqlStr(email),
        sqlStr(name),
        sqlStr("user"),
        sqlStr("Employee"),
        sqlStr(now),
        sqlNum(1),
      ].join(",")})`,
    );
    byEmail.set(email, empId);
  } else {
    userStmts.push(
      `UPDATE users SET name=${sqlStr(name)} WHERE lower(email)=lower(${sqlStr(email)})`,
    );
  }
}

d1ExecBatched(userStmts, { dry: DRY, chunkSize: 40, label: "phase2-users" });

if (!DRY) {
  d1Exec(
    [
      `DELETE FROM article_history WHERE article_id IN (SELECT id FROM articles WHERE employee_email IS NOT NULL)`,
      `DELETE FROM articles WHERE employee_email IS NOT NULL`,
    ].join(";\n"),
    { label: "phase2-clear-seeded" },
  );
}

let folderFiles = [];
try {
  folderFiles = fs.readdirSync(FOLDER);
} catch {
  console.warn(`Article_folder missing at ${FOLDER} — inserts will use placeholders`);
}

let ins = 0,
  skip = 0;
const articleStmts = [];

for (const [low, info] of map) {
  const purpose = purposeMap.get(low) || "Not suitable";
  const tid =
    typeMap.get((purpose || "Not suitable").toLowerCase()) ||
    typeMap.get("not suitable");
  if (!tid && !DRY) {
    console.error("missing type for", purpose);
    skip++;
    continue;
  }
  const fileExists = folderFiles.find((f) => f.toLowerCase() === low);
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
  // user_id + emp_id both use E… emp ids
  articleStmts.push(
    `INSERT INTO articles(id,user_id,article_type_id,title,content,status,ai_score,version,submitted_at,scored_at,month_year,retry_count,ai_feedback,emp_id,employee_email)VALUES(${[
      sqlStr(id),
      sqlStr(info.empId),
      sqlStr(tid),
      sqlStr(title),
      sqlStr(content),
      sqlStr(status),
      "NULL",
      sqlNum(1),
      sqlStr(`${info.monthYear}-01T09:00:00.000Z`),
      "NULL",
      sqlStr(info.monthYear),
      sqlNum(0),
      "NULL",
      sqlStr(info.empId),
      sqlStr(info.email),
    ].join(",")})`,
  );
  ins++;
}

// smaller chunks — article HTML bodies are large
d1ExecBatched(articleStmts, { dry: DRY, chunkSize: 3, label: "phase2-articles" });

console.log(
  `phase2 done inserted=${ins} skipped=${skip} ${DRY ? "(dry)" : ""}`,
);

if (!DRY) {
  const counts = d1Query(
    `SELECT
      (SELECT COUNT(*) FROM articles) AS articles,
      (SELECT COUNT(*) FROM article_types) AS types,
      (SELECT COUNT(*) FROM users) AS users`,
  );
  console.log(counts[0] || {});
}
