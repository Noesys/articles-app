# Noesys Article Platform — Seeding

Monorepo: `article-app/` (React) + `article-api/` (Cloudflare Workers + D1 `noesys-articles` / `acc066a7-2084-4d5e-89b0-90c20c4ceb6c`).

Seeding is **remote-only**. Scripts call `wrangler d1 execute --remote` / `migrations apply --remote` using your **existing wrangler login** (no re-auth if already logged in). Local sqlite is not used.

## Prerequisites

```bash
cd article-api && npx wrangler whoami   # must show your Cloudflare account
# If not logged in (once): npx wrangler login
cd ../scripts && npm install            # mammoth, gray-matter, xlsx
```

Put article files in repo-root `Article_folder/` before phase2.

## How to run (order matters)

From repo root `articles-app/`:

```bash
# 1. Phase 1 — types + prompts + parameters (also applies pending remote migrations)
node scripts/seed-phase1.mjs
# Preview only:
node scripts/seed-phase1.mjs --dry-run

# 2. Phase 2 — stub users (id = E…) + articles linked by emp_id / employee_email
node scripts/seed-phase2.mjs
# Optional: --dry-run / --verbose
```

**Do not run `make_admin.mjs`** — admins already exist in production (Access / prior seed).

Phase2 deletes prior rows with `employee_email IS NOT NULL`, then re-inserts. Intended as a **one-time** production seed.

## Emp IDs

Employee ids are `E…` (e.g. `E001`). Stub `users.id`, `articles.user_id`, and `articles.emp_id` all use that value so admin/`user_id` joins stay consistent. Author fallback also joins on `employee_email` when the Access user id differs.

## What the app changes expect

* `article_types.is_evaluatable` — hides **Not suitable** from users
* Admin list/detail: `users` via `user_id` **or** `employee_email`
* User article list: `user_id` **or** matching `employee_email`

## Migrations

Applied remotely by the seed helper (`wrangler d1 migrations apply --remote`), including:

* `0009_evaluatable_flag_employee_linkage.sql` — `is_evaluatable`, `emp_id`, `employee_email`

## Files

| File | Purpose |
|------|---------|
| `d1-remote.mjs` | Shared remote wrangler D1 helper |
| `seed-phase1.mjs` | Types / prompts / parameters |
| `seed-phase2.mjs` | Users (E…) + articles from `Article_folder` |
| `Articles_By_Employee.md` / `article_primary_purpose_mapping.xlsx` / prompt markdowns | Sources |
