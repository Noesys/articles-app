# Noesys Article Platform

Monorepo for the article platform with user and admin applications. Auth is Microsoft Entra (no OTP); users are created on first login.

## Seeding (local D1)

Two-phase seeding. No users are created by seeding — articles link via `employee_email`/`emp_id` and resolve on Entra login. Only required DB row is `seed_bot_001` (created_by).

### Files in `scripts/` (only these are kept)

| File | Purpose |
|------|---------|
| `seed-phase1.mjs` | Phase 1: article types + prompts/parameters |
| `seed-phase2.mjs` | Phase 2: articles from `Article_folder` mapped via `Articles_By_Employee.md` |
| `article_scoring_prompts.md` | 8 evaluatable type scoring prompts (source for phase 1) |
| `parameter_prompts.md` | 6 params × 8 types (source for phase 1) |
| `Articles_By_Employee.md` | Employee → articles → month mapping (source for phase 2, heading month wins) |
| `make_admin.mjs` | Optional: `node scripts/make_admin.mjs vishal@noesyssoftware.com` sets `auth_role=admin` |
| `package.json` / `package-lock.json` | `mammoth`, `csv-parse`, `gray-matter` for seed-phase2 |

### Phase 1 — Types / Prompts / Parameters

```
node scripts/seed-phase1.mjs            # --dry-run for preview
```

* Creates 9 `article_types` (8 evaluatable + `Not suitable` with `is_evaluatable=0`, `Not suitable` has no prompts/params).
* Parses `article_scoring_prompts.md` → `prompts` table + mirrors to `article_types.score_prompt`.
* Parses `parameter_prompts.md` → 6 `parameters` per evaluatable type (48 total).
* Idempotent (updates if exists). Runs migration `0007_add_evaluatable_and_employee_link.sql` if needed.

### Phase 2 — Articles

```
node scripts/seed-phase2.mjs            # --dry-run / --verbose
```

* Parses `Articles_By_Employee.md` (`## … -- E####`, `*Email:*`, `### Apr/May…26`, `- file.docx`) → `Map<filename, {empId,email,monthYear}>`. Month from heading wins; year defaults to 26.
* Joins `article_type_mapping.csv` (`Filename` → `Primary Purpose`) → `article_type_id` (fallback `Not suitable`).
* Reads `Article_folder/<file>` (.md/.mdx via `gray-matter`, .docx via `mammoth`).
* Inserts into `articles` with `submitted_at = monthYear-01T09:00:00.000Z` (so `substr(submitted_at,1,7)==month_year`, shown as Created at in Admin), `emp_id`, `employee_email`, `user_id = empId` (legacy), status `not_suitable` or `pending`.

Run order: **phase1 then phase2**. Re-running phase2 deletes prior `employee_email IS NOT NULL` articles first.

### Optional — Make admin

```
node scripts/make_admin.mjs vishal@noesyssoftware.com
```

Sets `users.auth_role='admin'` (creates stub row if needed). Login still via Entra.

---

## Files changed for this seeding feature

* `article-api/src/migrations/0007_add_evaluatable_and_employee_link.sql` — `article_types.is_evaluatable`, `articles.emp_id/employee_email` + indexes.
* `article-api/src/migrations/0008_fix_is_active.sql` — placeholder for `article_types.is_active` backfill (commented, already in 0001 for fresh DBs).
* `article-api/src/services/user/articleTypes.ts:14` — user `GET /article-types` now `WHERE is_active=1 AND is_evaluatable=1` (hides `Not suitable` from user dropdown; admin still sees it).
* `article-api/src/services/user/articles.ts:32-40` — `getArticlesByUser` resolves `myEmail` and filters `a.user_id=? OR lower(a.employee_email)=lower(?)` so seeded articles appear after Entra login.
* `article-api/src/services/admin/articles.service.ts:66,89,136` — admin list/detail use `LEFT JOIN users` + `COALESCE(u.name, a.employee_email)` and count without `JOIN users`, so all 133 seeded articles show in `/admin/articles`.
* `article-app/src/admin/components/articles/ArticlesTableContent.tsx:61,189` — null-safe `getNameInitials`, `STATUS_CONFIG[status] ?? unknown` (fixes blank page when status=`not_suitable`).
* `scripts/seed-phase1.mjs:149` — split regex `^[ \t]*# \d+\.` handles leading space before `# 1.` (fixes truncated Use case blog params).
* `scripts/seed-phase2.mjs:195` — `submitted_at` aligned to `month_year` 1st day.
* `scripts/` cleanup — removed unused `article_mapping_complete.csv`, `article_primary_purpose_mapping.xlsx`, `article_type_mapping.csv`, `seed.mjs`, `scripts/README.md`; kept only files above.

---

## Migrations to apply (in order)

Wrangler applies from `article-api/src/migrations/` on `wrangler d1 migrations apply`:

1. `0001_initial-schema.sql`
2. `0002_add_ai_feedback_to_articles.sql`
3. `0003_restructure_scoring_system.sql`
4. `0004_allow_null_ai_feedback.sql`
5. `0005_complete_evaluation_schema.sql`
6. `0006_add_missing_status_columns.sql`
7. `0007_add_evaluatable_and_employee_link.sql` — **required for this feature**
8. `0008_fix_is_active.sql` — idempotent/no-op on fresh DBs
9. `001_add_otp_codes.sql` (legacy OTP, unused under Entra)

Ensure `0007` is applied before seeding. If local D1 already had `is_evaluatable`/`employee_email`, `seed-phase1/2` will log `duplicate column name` and continue.

---

## Project Structure

- `article-app/` — React app (user + admin)
- `article-api/` — Cloudflare Workers API (Hono + D1)
- `Article_folder/` — source article files (not committed large binaries)
- `scripts/` — seeding only (see above)

## DBML

```dbml
Table users {
  id text [pk]
  email text [unique, not null]
  name text [not null]
  auth_role text [not null, note: 'super_admin | admin | user']
  job_role text [not null]
  created_at text [not null]
  is_active int [not null, default: 1]
  entra_id text [unique]
}

Table article_types {
  id text [pk]
  name text [unique, not null]
  description text
  is_active int [not null, default: 1]
  is_evaluatable int [not null, default: 1, note: '0 = Not suitable, hidden from users']
  pass_threshold real [not null]
  score_prompt text [not null]
  score_min real [not null, default: 0]
  score_max real [not null, default: 10]
  created_by text [not null, ref: > users.id]
  created_at text [not null]
  updated_at text [not null]
}

Table parameters {
  id text [pk]
  article_type_id text [not null, ref: > article_types.id]
  name text [not null]
  prompt text [not null]
  scope_type text [not null, note: 'numeric | option']
  min_value real
  max_value real
  is_active int [not null, default: 1]
  sort_order int [not null, default: 0]
  created_by text [not null, ref: > users.id]
  created_at text [not null]
  updated_at text [not null]
  indexes { (article_type_id, name) [unique] }
}

Table articles {
  id text [pk]
  user_id text [not null, ref: > users.id, note: 'legacy EmpId for seeded rows']
  emp_id text [note: 'E#### from Articles_By_Employee.md']
  employee_email text [note: 'resolved on Entra login']
  article_type_id text [not null, ref: > article_types.id]
  title text [not null]
  content text [not null]
  status text [not null, note: 'approved | rewrite_required | pending | not_suitable']
  ai_score real
  version int [not null, default: 1]
  submitted_at text [not null, note: 'aligned to month_year-01']
  scored_at text
  month_year text [not null, note: 'YYYY-MM from heading']
  retry_count int [not null, default: 0]
  ai_feedback text
}
```
