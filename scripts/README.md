# Noesys Article Platform — Seeding

Monorepo: `article-app/` (React) + `article-api/` (Cloudflare Workers + D1 `noesys-articles` `acc066a7-2084-4d5e-89b0-90c20c4ceb6c` from `article-api/wrangler.toml:8-9`). Auth is Microsoft Entra — seeding does not create OTP users.

## Credentials (production)

All seed scripts now target this project's DB (swapped from previous project's DB):

* `database_name = "noesys-articles"` / `database_id = "acc066a7-2084-4d5e-89b0-90c20c4ceb6c"` (`article-api/wrangler.toml:8-9`)
* Local: seed directly via `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` (auto-discovered, override with `SEED_DB=/path/to.sqlite`)
* Production: `npx wrangler d1 execute noesys-articles --remote --command "SELECT ..."` or `npx wrangler d1 migrations apply --remote` (same `database_name`/`database_id`)

File paths fixed for this repo: `ROOT` resolved from `scripts/` location (`path.resolve(.../..)`), `Article_folder/` at repo root, `scripts/article_primary_purpose_mapping.xlsx`, `scripts/Articles_By_Employee.md`, `article-api/src/migrations/`. No functionality changed — only credentials/paths.

## How to run (order matters)

From repo root `articles-app/`:

```powershell
# 1. Apply migrations locally (or --remote for production)
npx wrangler d1 migrations apply --local
# npx wrangler d1 migrations apply --remote  # production

# 2. Phase 1 — article types + prompts/parameters (must run first)
node scripts/seed-phase1.mjs            # --dry-run for preview
# Creates 9 article_types (8 evaluatable + Not suitable is_evaluatable=0), 8 prompts, 48 parameters

# 3. Phase 2 — articles (depends on phase 1 types)
node scripts/seed-phase2.mjs            # --dry-run / --verbose

# 4. Optional — make admin
node scripts/make_admin.mjs vishal@noesyssoftware.com
```

**Run order: phase1 then phase2** — phase2 deletes prior `employee_email IS NOT NULL` articles and requires `Not suitable` type. Re-running is idempotent.

## What changed

* `scripts/seed-phase1.mjs`, `seed-phase2.mjs`, `make_admin.mjs` — swapped DB credentials to `noesys-articles`/`acc066a7...`, fixed `ROOT`/`Article_folder`/xlsx paths, added `DB_NAME`/`DB_ID` constants.
* `scripts/package.json` — added `xlsx` (used by phase2 for `article_primary_purpose_mapping.xlsx`).
* `article-api/src/migrations/0009_evaluatable_flag_employee_linkage.sql` — added for `article_types.is_evaluatable`, `articles.emp_id/employee_email` + indexes; applied automatically by both phase scripts (alongside `0007_article_types_is_active.sql`, `0008_unique_index.sql`). See Migrations below.
* Other code changed for this seeding feature (prior work, unchanged now):
  * `article-api/src/services/user/articleTypes.ts:14` — hides `Not suitable` from users (`is_active=1 AND is_evaluatable=1`)
  * `article-api/src/services/user/articles.ts:32-40` — resolves by `user_id OR employee_email`
  * `article-api/src/services/admin/articles.service.ts:66,89` — `LEFT JOIN users` + `COALESCE` so 133 seeded articles appear in admin
  * `article-app/src/admin/components/articles/ArticlesTableContent.tsx:61,189` — null-safe initials/status

## Migrations (apply in order)

Wrangler applies from `article-api/src/migrations/`:
1. `0001_initial-schema.sql` … 6. `0006_add_missing_status_columns.sql`
2. `0007_article_types_is_active.sql`
3. `0008_unique_index.sql`
4. `0009_evaluatable_flag_employee_linkage.sql` — **required for this seeding** (is_evaluatable, emp_id/employee_email)
5. `001_add_otp_codes.sql` (legacy)

Ensure `0009` applied before seeding; phase scripts re-apply `0007-0009` idempotently and log `duplicate column` if already applied.

## Files in `scripts/`

| File | Purpose |
|------|---------|
| `seed-phase1.mjs` | Types/prompts/parameters |
| `seed-phase2.mjs` | Articles from `Article_folder` via `Articles_By_Employee.md` + xlsx |
| `make_admin.mjs` | Sets `auth_role=admin` |
| `article_scoring_prompts.md` / `parameter_prompts.md` / `Articles_By_Employee.md` / `article_primary_purpose_mapping.xlsx` | Sources |
