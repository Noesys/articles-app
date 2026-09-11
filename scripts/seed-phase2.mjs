import fs from "fs";
import path from "path";
import crypto from "crypto";
import mammoth from "mammoth";
import matter from "gray-matter";
import XLSX from "xlsx";
import os from "os";
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
  ALLOWED_MIMES,
  MAX_BYTES,
  mimeToExt,
  r2PutRemote,
} from "./d1-remote.mjs";

// Prefer scripts/Article_folder, fall back to repo-root Article_folder
const FOLDER =
  [
    path.join(ROOT, "scripts", "Article_folder"),
    path.join(ROOT, "Article_folder"),
  ].find((p) => fs.existsSync(p)) ?? path.join(ROOT, "scripts", "Article_folder");
const DRY = process.argv.includes("--dry-run");
const VERBOSE = process.argv.includes("--verbose");

console.log(`seed-phase2 → remote D1 ${DB_NAME} (${DB_ID})${DRY ? " (DRY — reads remote, no writes)" : ""}`);
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

function stripEmbeddedImages(htmlOrMd) {
  // Remove base64 / data-URI images without truncating text content
  return htmlOrMd
    .replace(/<img\b[^>]*\bsrc\s*=\s*["']data:[^"']*["'][^>]*>/gi, "")
    .replace(/!\[[^\]]*\]\(data:[^)]+\)/g, "")
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/gi, "");
}
function stripEmpPrefix(name) {
  return String(name)
    .toLowerCase()
    .replace(/^e\d+[\s_\-]*/i, "")
    .trim();
}

function resolveFolderFile(listedLower, folderFiles) {
  const exact = folderFiles.find((f) => f.toLowerCase() === listedLower);
  if (exact) return { file: exact, how: "exact" };
  const target = stripEmpPrefix(listedLower);
  const fuzzy = folderFiles.find((f) => {
    const fl = f.toLowerCase();
    if (fl.startsWith(".")) return false;
    if (fl === "completed") return false;
    return stripEmpPrefix(fl) === target || fl === target;
  });
  if (fuzzy) return { file: fuzzy, how: "fuzzy" };
  return { file: null, how: "missing" };
}

/**
 * Map xlsx "Primary Purpose" → article_types.name.
 * "General" is not a DB type — treat like Not suitable (same as score_prompt-style gap).
 */
function resolvePurpose(rawPurpose, typeMap) {
  const raw = (rawPurpose || "").trim();
  if (!raw) {
    return { purpose: "Not suitable", tid: typeMap.get("not suitable"), note: "missing-xlsx" };
  }
  const key = raw.toLowerCase();
  if (key === "general") {
    return {
      purpose: "Not suitable",
      tid: typeMap.get("not suitable"),
      note: "general→not suitable",
    };
  }
  const tid = typeMap.get(key);
  if (tid) return { purpose: raw, tid, note: "ok" };
  return {
    purpose: "Not suitable",
    tid: typeMap.get("not suitable"),
    note: `unknown-purpose:${raw}`,
  };
}

const md = fs.readFileSync(
  path.join(ROOT, "scripts/Articles_By_Employee.md"),
  "utf8",
);
const map = new Map(); // lower filename -> {empId,email,monthYear,listed}
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
      listed: m[1].trim(),
    });
  }
}
console.log(`MD parsed: ${map.size} articles`);
console.log(`Article_folder: ${FOLDER}`);

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

// Always read remote (dry-run only skips writes) — same class of bug as empty score_prompt
const typeRows = d1Query(`SELECT id, name FROM article_types`);
const typeMap = new Map(
  typeRows.map((r) => [String(r.name).toLowerCase(), r.id]),
);
console.log(
  `Remote article_types (${typeRows.length}):`,
  typeRows.map((r) => r.name).join(", ") || "(none)",
);
if (!typeMap.has("not suitable")) {
  console.error("Run phase1 first (Not suitable type missing on remote)");
  process.exit(1);
}

const now = new Date().toISOString();
const userStmts = [];

const empRows = [
  ...md.matchAll(
    /\|\s*(E\d+)\s*\|\s*([^|]+?)\s*\|\s*([^\s|]+@[^\s|]+)\s*\|/g,
  ),
].map((m) => [m[1].toUpperCase(), m[2].trim(), m[3].trim().toLowerCase()]);

const existingUsers = d1Query(`SELECT id, email FROM users`);
const byEmail = new Map(
  existingUsers.map((u) => [String(u.email).toLowerCase(), u.id]),
);

let usersCreate = 0,
  usersUpdate = 0;
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
    usersCreate++;
  } else {
    userStmts.push(
      `UPDATE users SET name=${sqlStr(name)} WHERE lower(email)=lower(${sqlStr(email)})`,
    );
    usersUpdate++;
  }
}

console.log(
  `Users: ${usersCreate} create (id=E…), ${usersUpdate} update-by-email (keep existing id)`,
);

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
const stats = {
  purposeOk: 0,
  generalFallback: 0,
  missingXlsx: 0,
  unknownPurpose: 0,
  fileExact: 0,
  fileFuzzy: 0,
  fileMissing: 0,
  byType: {},
  byStatus: {},
  byMonth: {},
  imagesUploaded: 0,
  imagesSkippedType: 0,
  imagesSkippedSize: 0,
  imagesFailed: 0,
  r2Errors: [],
};

async function decodeAndPrepareImage(imageBuffer, contentType, userId) {
  const normalizedMime = contentType.toLowerCase().replace("image/x-", "image/");
  if (!ALLOWED_MIMES.has(normalizedMime)) {
    stats.imagesSkippedType++;
    return null;
  }
  if (imageBuffer.length > MAX_BYTES) {
    stats.imagesSkippedSize++;
    if (VERBOSE) console.warn(`[seed] image ${normalizedMime} ${imageBuffer.length}B exceeds 2MB skip`);
    return null;
  }
  const ext = mimeToExt(normalizedMime);
  if (!ext) {
    stats.imagesSkippedType++;
    return null;
  }
  if (DRY) {
    const id = crypto.randomUUID();
    return { url: `/api/images/${userId}/${id}.${ext}`, key: `articles/${userId}/${id}.${ext}` };
  }
  const id = crypto.randomUUID();
  const key = `articles/${userId}/${id}.${ext}`;
  const url = `/api/images/${userId}/${id}.${ext}`;
  const tmpFile = path.join(os.tmpdir(), `seed-img-${id}.${ext}`);
  try {
    fs.writeFileSync(tmpFile, imageBuffer);
    r2PutRemote(key, tmpFile, normalizedMime);
    stats.imagesUploaded++;
    return { url, key };
  } catch (err) {
    stats.imagesFailed++;
    stats.r2Errors.push(err.message.slice(0, 200));
    if (VERBOSE) console.error(`[seed] R2 upload failed ${key}: ${err.message.slice(0, 300)}`);
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

for (const [low, info] of map) {
  const rawPurpose = purposeMap.get(low);
  const { purpose, tid, note } = resolvePurpose(rawPurpose, typeMap);
  if (!tid) {
    console.error("missing type for", purpose);
    skip++;
    continue;
  }
  if (note === "ok") stats.purposeOk++;
  else if (note === "general→not suitable") stats.generalFallback++;
  else if (note === "missing-xlsx") stats.missingXlsx++;
  else stats.unknownPurpose++;

  const resolved = resolveFolderFile(low, folderFiles);
  if (resolved.how === "exact") stats.fileExact++;
  else if (resolved.how === "fuzzy") {
    stats.fileFuzzy++;
    if (VERBOSE) console.warn(`fuzzy match: ${info.listed} → ${resolved.file}`);
  } else {
    stats.fileMissing++;
    if (VERBOSE) console.warn(`missing ${info.listed}`);
  }

  const fname = resolved.file || info.listed;
  const fp = resolved.file ? path.join(FOLDER, resolved.file) : null;
  let title = fname
    .replace(/\.(docx|md|mdx)$/i, "")
    .replace(/^E\d+\s*[-_]\s*/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  let content = "";
  if (!DRY) {
    if (fp && fs.existsSync(fp)) {
      if (/\.mdx?$/i.test(fname)) {
        const t = fs.readFileSync(fp, "utf8");
        try {
          content = matter(t).content.trim();
        } catch {
          content = t.trim();
        }
        content = stripEmbeddedImages(content);
      } else {
        const buf = fs.readFileSync(fp);
        const r = await mammoth.convertToHtml(
          { buffer: buf },
          {
            convertImage: mammoth.images.imgElement(async (image) => {
              const ct = (image.contentType || "").toLowerCase();
              let imageBuffer;
              try {
                const b64 = await image.read("base64");
                imageBuffer = Buffer.from(b64, "base64");
              } catch {
                try {
                  const v = await image.read();
                  imageBuffer = Buffer.isBuffer(v) ? v : Buffer.from(String(v), "base64");
                } catch {
                  return { src: "", alt: "[image omitted]" };
                }
              }
              const res = await decodeAndPrepareImage(imageBuffer, ct, byEmail.get(info.email) || info.empId);
              if (res) return { src: res.url };
              return { src: "" };
            }),
          },
        );
        content = (r.value.trim() || "(empty)");
        if (content.includes("data:image")) {
          content = content.replace(/src="data:[^"]*"/gi, 'src=""');
        }
        if (new TextEncoder().encode(content).length > 50_000) {
          console.error(`[seed] content ${fname} exceeds 50KB skip`);
          skip++;
          continue;
        }
      }
    } else {
      content = "(file not found: " + fname + ")";
    }
  }

  const id = "art_" + crypto.randomUUID();
  // UI only understands pending/approved/rewrite_required/failed — not "not_suitable"
  const status = "pending";
  const userId = byEmail.get(info.email) || info.empId;

  stats.byType[purpose] = (stats.byType[purpose] || 0) + 1;
  stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
  stats.byMonth[info.monthYear] = (stats.byMonth[info.monthYear] || 0) + 1;

  if (DRY) {
    ins++;
    continue;
  }

  const stmt = `INSERT INTO articles(id,user_id,article_type_id,title,content,status,ai_score,version,submitted_at,scored_at,month_year,retry_count,ai_feedback,emp_id,employee_email,created_at,updated_at)VALUES(${[
    sqlStr(id),
    sqlStr(userId),
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
    sqlStr(now),
    sqlStr(now),
  ].join(",")})`;

  try {
    d1Exec(stmt, { label: `article ${ins + 1}/${map.size}` });
    ins++;
    if (ins % 10 === 0) console.log(`… inserted ${ins}/${map.size}`);
  } catch (e) {
    console.error(fname, (e.message || String(e)).slice(0, 200));
    skip++;
  }
}

console.log("\n=== phase2 summary ===");
console.log(
  `articles: ${ins} would-insert, skipped=${skip} ${DRY ? "(dry)" : ""}`,
);
console.log("files:", {
  exact: stats.fileExact,
  fuzzy: stats.fileFuzzy,
  missing: stats.fileMissing,
});
console.log("purpose mapping:", {
  ok: stats.purposeOk,
  generalToNotSuitable: stats.generalFallback,
  missingXlsx: stats.missingXlsx,
  unknownPurpose: stats.unknownPurpose,
});
console.log("by type (after mapping):", stats.byType);
console.log("by month:", stats.byMonth);
console.log("by status:", stats.byStatus);
console.log("images:", {
  uploaded: stats.imagesUploaded,
  skippedType: stats.imagesSkippedType,
  skippedSize: stats.imagesSkippedSize,
  failed: stats.imagesFailed,
});
if (stats.r2Errors.length) console.log("r2Errors:", stats.r2Errors.slice(0, 5));

if (!DRY) {
  const counts = d1Query(
    `SELECT
      (SELECT COUNT(*) FROM articles) AS articles,
      (SELECT COUNT(*) FROM article_types) AS types,
      (SELECT COUNT(*) FROM users) AS users`,
  );
  console.log(counts[0] || {});
}
