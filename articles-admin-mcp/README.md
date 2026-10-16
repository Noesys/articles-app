# Articles Admin MCP (read-only)

Lets an admin ask Claude about people, articles, scores, insights, and scoring rubrics on the Noesys Article Platform — without giving Claude write access.

This is an npm workspace of the `articles-app` monorepo (`articles-admin-mcp`), sitting next to `article-api` and `article-app`.

## What it is

An **MCP server** (Model Context Protocol) that Claude Desktop starts as a local Node process. Claude talks to it over **stdio** (stdin/stdout JSON-RPC). The server exposes **tools**; Claude picks tools from their names and descriptions and calls them. Each tool is a thin HTTP client that calls the existing **admin API** (`/api/admin/...`). The MCP has **no database and no login of its own** — auth and permissions stay on the API.

```
Admin asks Claude
       │
       ▼
Claude Desktop (MCP host)
       │  stdio JSON-RPC
       ▼
articles-admin-mcp (this package)
       │  HTTP GET + auth headers
       ▼
article-api (wrangler / Workers) ──► D1 + R2
```

## Features (tools)

All tools are **read-only**. None create, edit, score, approve, or apply suggestions.

### Person + article deep-dive

| Tool | What it does |
|------|----------------|
| `get_person_overview` | **Primary tool.** Name/email/ID → profile + latest article (full Markdown, scores, feedback, inline images). Disambiguates when several people match. |
| `find_person` | Search people by name/email/ID; returns matches only (no articles). |
| `get_person` | One profile by exact `user_id`. |
| `get_latest_article` | Short summary of a person's newest article. |
| `get_article_details` | Full article by `article_id` (body, scores, history, images). |

### Lists & dashboard

| Tool | What it does |
|------|----------------|
| `list_articles` | Global paginated list; filters: `month`, `status`, `type`, `author`. |
| `list_person_articles` | One person's articles (not only latest); same filters except author. |
| `get_article_stats` | Counts: total / approved / pending / rewrite_required / failed. |

### Insights & config

| Tool | What it does |
|------|----------------|
| `get_insights_summary` | Score analytics by article type/parameter over a YYYY-MM range. |
| `get_employee_submissions` | Per-person submission counts by month over a range. |
| `list_article_types` | Scoring rubrics: types, thresholds, parameters. |
| `get_article_suggestions` | Stored AI rewrite suggestions for an article (does not generate or apply). |

Tool descriptions tell Claude **when to use** each tool and **when not to**, so it prefers `get_person_overview` for "tell me about Priya" instead of chaining four smaller calls.

## How it is built

| File | Role |
|------|------|
| `src/index.ts` | Entry: load config → auth → API client → register tools → connect stdio. Logs to **stderr** only (stdout is the protocol). |
| `src/config.ts` | Env: `ARTICLE_API_URL`, `MCP_AUTH_MODE`, image limits. |
| `src/auth.ts` | Auth headers only. `dev` = none; `access` = Cloudflare Access service-token headers. |
| `src/api.ts` | Read-only HTTP client. Unwraps `{ data }` / pagination. Blocks unsafe paths (no `..`, only `/api/...`; binaries only `/api/images/...`). |
| `src/schemas.ts` | Shared Zod inputs (`YYYY-MM`, status enums, pagination). |
| `src/tools.ts` | Registers all tools + descriptions. |
| `src/people.ts` | Person search / latest-article helpers. |
| `src/articles.ts` | List/stats/suggestions formatters. |
| `src/insights.ts` | Insights + article-type formatters. |
| `src/overview.ts` | Markdown overview + inline images from `/api/images/...`. |
| `scripts/client-test.mjs` | Smoke test: starts the built server and calls every tool. |

Stack: Node 20+, TypeScript (`module: NodeNext`), `@modelcontextprotocol/sdk`, Zod.

## Auth

Auth is isolated in `auth.ts`. The MCP never decides admin vs user — the API's `requireRole("admin")` does.

- **`MCP_AUTH_MODE=dev` (local demo):** send no credentials. `wrangler.toml` `[access.dev]` injects a local admin identity (`naresh@noesyssoftware.com`) on every request.
- **`MCP_AUTH_MODE=access`:** send `CF-Access-Client-Id` / `CF-Access-Client-Secret`. Before production use, confirm the API's `resolveAccessUser` accepts service-token requests and maps them to an admin (service-token JWTs often have no email today).

## Local demo (no Cloudflare account needed)

1. **Start the API** from `article-api/`:

   ```bash
   npx wrangler dev --local --port 8787 --persist-to .wrangler/state
   ```

   `--local` disables remote bindings. Without it, wrangler tries to log in to Cloudflare for the `AI` binding. The MCP is read-only and never uses AI.

   **Important:** run at the top level, **not** with `--env development`. In this `wrangler.toml`, `env.development` does not inherit D1/R2 bindings.

2. **Seed (first time)** from `article-api/`:

   ```bash
   node make-png.mjs
   npx wrangler d1 execute noesys-articles --local --file=seed-demo-local.sql
   npx wrangler r2 object put contiq-article-images/articles/usr_demo_priya/3f2a9c1e-7b4d-4e8a-9c2f-1d5e6a7b8c9d.png --file=demo-chart-rack.png --content-type image/png --local
   npx wrangler r2 object put contiq-article-images/articles/usr_demo_priyanka/8b1d4f6a-2c3e-4a5b-9d7e-0f1a2b3c4d5e.png --file=demo-chart-funnel.png --content-type image/png --local
   ```

   Demo people: **Priya Shah**, **Priyanka Rao** (name ambiguity), **Arjun Mehta** (`rewrite_required`), **Meera Iyer** (no articles). Demo articles are in **2026-08 / 2026-09** — if the UI defaults to the current month, switch month or turn on "View all".

3. **Build & smoke-test** from `articles-admin-mcp/`:

   ```bash
   npm install
   npm run build
   npm test
   ```

## Connect to Claude Desktop

Add under `mcpServers` (use the **built** `dist/index.js`):

```json
{
  "mcpServers": {
    "articles-admin": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\YOU\\Desktop\\articles-app\\articles-admin-mcp\\dist\\index.js"
      ],
      "env": {
        "ARTICLE_API_URL": "http://localhost:8787",
        "MCP_AUTH_MODE": "dev"
      }
    }
  }
}
```

If Claude Desktop was installed from the **Microsoft Store**, it ignores `%APPDATA%\Claude\claude_desktop_config.json` and reads:

`%LOCALAPPDATA%\Packages\Claude_<id>\LocalCache\Roaming\Claude\claude_desktop_config.json`

Merge the `mcpServers` block into **that** file. Fully quit Claude (including tray) after editing.

Keep `wrangler dev` running, then ask e.g. "Get Priya's details and her latest article" or "How many pending articles in 2026-09?"

## Security notes (this package)

- Read-only: no POST/PUT/PATCH/DELETE tools.
- HTTP client only allows relative `/api/...` paths; rejects `..`, `%`-encoding tricks (e.g. `%2e%2e`), backslashes, and absolute URLs. Resolved URL pathname must stay under `/api/`.
- Image fetch limited to `/api/images/<userId>/<uuid>.<ext>` (same rules as the API) and `image/*` Content-Type; count/size caps via env.
- API remains the permission boundary (`requireRole("admin")`).
- Do not commit service-token secrets; pass them only via Claude config `env` or a local `.env` you never commit.

## Known gaps

- Admin `GET /api/admin/articles/:id` still omits `submitted_at` / `scored_at` / `pass_threshold` on the article object. Overview fills submission date from the person's article list when available.
- No write tools (reevaluate, apply suggestions, edit types). Add only after reads are solid and auth for production is settled.
- Person search loads the full admin user list and filters in-process (fine for demo-sized teams).

## Not included yet

- Streamable HTTP / remote MCP hosting for teammates.
- Per-user OAuth against Cloudflare Access (replacing shared service token or local `[access.dev]`).
- Dedicated user-search API endpoint (would replace client-side filtering).
