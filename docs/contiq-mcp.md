# Contiq remote MCP (`contiq-mcp`)

Remote Model Context Protocol server hosted on Contiq so Claude Desktop, Cursor, and other agents can call Contiq tools over HTTPS with OAuth 2.1.

## Endpoint

**Production:** `https://contiq.noesyssoftware.com/mcp`

Also deployed on the Worker preview host (`article-api.infoveave.workers.dev`); use the Contiq custom domain for clients.

## Who can connect

Any **active Contiq user** (admin or user) who can sign in via **Cloudflare Access**.

- OAuth issues a token for every successful Contiq login.
- **Tools are role-filtered:**
  - **admin** — 12 read-only admin tools + 4 user tools
  - **user** — only the 4 user tools (own articles)

## Cloudflare Access path policy (required)

Edge Access must **not** block machine clients that only have an OAuth bearer token.

Allowlist (bypass Access / service auth) for:

- `/mcp`
- `/oauth/*`
- `/.well-known/*`

Keep **`/authorize`** behind Access so the browser login step is Access + Contiq consent.

Without this, agents receive Access HTML challenges instead of MCP/OAuth responses.

## Connect (Claude Desktop / Cursor)

1. Add a remote MCP server pointing at `https://contiq.noesyssoftware.com/mcp`.
2. Complete the OAuth flow in the browser (Access login → Contiq “Allow” consent).
3. Call tools with the issued bearer token (the client does this automatically).

## User tools (user + admin)

| Tool | Purpose |
|------|---------|
| `list_my_articles` | List articles owned by the signed-in user |
| `get_my_article_feedback` | Scores + AI/parameter feedback for an owned article |
| `submit_new_article` | Create article + start evaluation (min-words / validation match web UI) |
| `submit_my_article_revision` | Rewrite owned article + start evaluation |

## Admin tools (admin only)

Person lookup/overview, global article list, pipeline stats, insights, article types, AI suggestions, full article details — see tool descriptions in the MCP `tools/list` response (names are verbose on purpose for agents).

## Security notes

- Article bodies and AI feedback returned to agents are **untrusted model input** (prompt-injection risk). Treat writer content carefully in agent prompts.
- User write tools only mutate the **signed-in user’s** articles.
- No admin mutate tools (approve / change type / re-eval) in v1.
- Local stdio bridge (`articles-admin-mcp`) was removed; do not reintroduce Access service-token bridges that forward secrets on redirects.

## Local development

```bash
cd article-api
npx wrangler dev
# Authorize uses [access.dev] / DEV_USER_MAIL when ENVIRONMENT=development
```

Ensure `OAUTH_KV` is bound (see `wrangler.toml`).
