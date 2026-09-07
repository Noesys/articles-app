# Decision Log 

## Architecture

### 1. Monorepo with Cloudflare Workers

**Decision:** Organized codebase as npm monorepo with separate frontend (`article-app`) and backend (`article-api`) workspaces, each deployed independently.

**Why:** Enables code sharing (type definitions, utilities) without duplication while maintaining independent deployment pipelines. Cloudflare Workers require fine-grained control over worker boundaries for cost optimization, and the team needed access to Cloudflare-specific features (D1, Workers AI, KV).

**Alternatives Rejected:** Separate repos with API contracts (OpenAPI/GraphQL) would require constant package synchronization; Next.js or similar fullstack frameworks don't provide the same level of Cloudflare feature access and cost control.

**Trade-offs:** Increased tooling complexity (multiple tsconfig.json, package.json workspaces, wrangler configs) offset by reduced context switching during development. Single shared D1 database (`noesys-dev`, `83331df4-d437-4c67-92e4-313065a15762`) is bound to the single worker; no per-worker isolation needed after consolidation.

---

### 2. Single-Worker Architecture

**Decision:** Consolidated from dual-worker (user-api + admin-api) to single-worker with unified user and admin routes under one Hono application.

**Why:** Both workers shared nearly identical D1 schema, types, and migrations, making the overhead of maintaining two separate Workers unjustified. Single-worker eliminates coordination complexity, cross-worker API calls, and simplifies deployment to one wrangler command.

**Challenges:** Fitting both user and admin logic within 1MB deployment package limit and resolving route conflicts (admin routes under `/api/*` — `article-api/src/index.ts:73-85`, user routes under `/auth`, `/articles`, `/article-types` without `/api` prefix — `article-api/src/index.ts:54-68`).

**Trade-offs:** Neutral or slightly positive performance (fewer cold starts) with minor cost savings from one less Worker runtime invocation. Requires careful migration planning since any schema change affects both user and admin contexts simultaneously.

---

### 3. Hono Framework

**Decision:** Selected Hono as the web framework for both backend Workers and frontend development server proxying.

**Why:** Built specifically for Cloudflare Workers Runtime with native Web Standard APIs (Fetch, Response, Request) support. Using same framework on both ends eliminates middleware/parameter/response mismatches during development. Note: current `article-api/wrangler.toml:4` does enable `compatibility_flags = ["nodejs_compat"]` for `ai`/`@ai-sdk/google` dependencies, so a small startup overhead remains.

**Specific Benefits:** Built-in type safety (TypeScript's Hono<AppEnv>()), first-class CORS with origin validation, automatic OpenAPI route typing, and smaller bundle sizes than Express ecosystem.

**Trade-offs:** Fewer middleware options than Express; some Express-specific features (session middleware, cookie utilities) require custom implementation. Initially required code restructuring but resulted in more explicit and testable API definitions.

---

### 4. D1 (SQLite) Database

**Decision:** Chose Cloudflare's native serverless SQLite (D1) over PostgreSQL, MySQL, or other hosted databases.

**Why:** Zero-latency reads/writes from Workers in same data center, critical for real-time scoring feedback and OTP verification. SQL needed for complex queries with joins, ordering, and pagination; KV would require denormalizing or multiple round-trips.

**Alternatives Rejected:** PlanetScale (MySQL) or Supabase (PostgreSQL) add cost, setup complexity, and network latency outside Cloudflare edge.

**Concurrency Handling:** WAL (Write-Ahead Logging) mode and per-worker connection pooling; db.batch() for atomic transactions on concurrent writes; evaluation service uses batched UPDATE+DELETE+INSERT pattern.

**Known Limitations:** Query complexity constraints (limited FULLTEXT search, some window function restrictions), 10-row optimization limits addressed via careful schema design. Cost favorable: generous free tier (100GB storage, 1M queries/month) covers expected load; managed PostgreSQL would cost monthly regardless of scale.



### 5. Asynchronous AI Evaluation

**Decision:** Implemented background AI evaluation using Cloudflare Workers' waitUntil, returning immediate HTTP 200 response while Gemini API scoring continues asynchronously.

**Why:** Synchronous evaluation blocks requests for 10-30 seconds, risking Cloudflare timeouts (30s limit) and poor UX. waitUntil allows Worker to continue processing after HTTP response, enabling immediate user feedback without manual polling during submission.

**How It Works:** Frontend returns "pending" status immediately; user sees success toast and redirects home. useMyArticles hook then polls GET /articles/mine/:id every 2.5 seconds until ai_score is non-null. Evaluation runs up to 5 minutes with 2 automatic retries (exponential backoff) before marking as failed.

**Failure Handling:** Failed evaluations set status = "failed" with sanitized error messages and increment retry_count. Users see the error and can manually resubmit to trigger another background attempt.

---

### 6. Parameter-Driven Scoring

**Decision:** Externalized scoring rules to database; each article type defines its own parameters (numeric ranges or option-based selections) without code changes.

**Why:** Different article types need different evaluation criteria (technical docs need accuracy/completeness; marketing copy needs engagement/clarity). Hardcoded logic would be inflexible and unmaintainable.

**Zod Validation Role:** Generates dynamic schemas at runtime based on parameter configurations. Ensures AI responses fit parameter bounds (numeric within min/max, options match enum values), preventing invalid output with strict parsing errors.

**Per-Type Configuration:** Parameters table uses article_type_id foreign key to associate each parameter set. sort_order field maintains correct indexing (p0, p1, p2...) so evaluation results match criteria by position.

**Edge Cases:** Article types with no parameters are handled gracefully; evaluation prompt includes "(no additional parameters configured)" so AI knows scoring is based purely on overall quality score.

---

### 7. Article Versioning with Immutable Snapshots

**Decision:** Each rewrite creates new row in article_history via atomic INSERT...SELECT, capturing complete article state before update while main articles table tracks only current version.

**Why:** Preserve audit trails, enable rollbacks, and prevent accidental data loss. Simply updating records destroys previous content permanently; snapshots preserve exact state at each submission.

**Version vs. Rewrite:** A version is a row in article_history representing point-in-time snapshot; a rewrite is the act of submitting new content that increments version counter and creates new history record.

**Data Loss Prevention:** History table captures exact state before any changes, providing complete audit trail. If rewrite fails or user wants comparison, history preserves all previous versions.

**Limitation:** System doesn't preserve intermediate draft states or edit sessions—only snapshots taken at rewrites. Full draft history would require draft tables or real-time collaboration cursors, which isn't currently implemented.

---

### 8. Tiptap Rich Text Editor

**Decision:** Selected Tiptap over ContentEditable or basic textarea for rich text editing with formatting, tables, code blocks, and live preview.

**Why:** Simple fields couldn't provide feature-rich experience needed for technical/marketing content without building entire markdown pipeline from scratch. Tiptap offers modular plugin architecture with built-in extensions (tables, syntax highlighting, placeholders, character counting).

**Live Preview Benefit:** Users see rendered markdown/HTML in real-time during editing, reducing "submit and hope" cycles. Editor/Preview toggle gives confidence that complex formatting (tables, code blocks, links) render correctly before submission.

**Content Flow:** Tiptap stores as HTML -> POST converts to markdown (via toMarkdown) -> API stores markdown in D1 -> GET retrieves markdown -> ArticleViewer renders via React Markdown. Turndown library handles pasted HTML-to-markdown conversion for complex tables.

**Trade-offs:** Larger bundle size than plain text (~50-100KB depending on extensions), ProseMirror's learning curve for customization, and complexity of HTML-to-markdown conversion pipeline.


---

### 9. Data Flow via Shared Database

**Decision:** article-api worker communicates with all parts of the system (user management, article operations, admin functions) through D1 database; no direct API calls between separate services.

**Why:** Single worker accessing shared D1 eliminates network hops, failure points, and inter-service authentication layers. Avoids distributed transaction problems, inconsistent states during partial failures, and overhead of managing service-to-service contracts.

**Alternatives Rejected:** Direct HTTP calls between services add latency (~1-5ms plus processing) and failure complexity; Cloudflare KV rejected because it lacks strong consistency and complex querying needed for article relationships and user data.

**Consistency & Race Conditions:** Database-level transactions (db.batch() for snapshot+update) and foreign key constraints ensure referential integrity. D1 handles concurrency at storage layer; no application-level locking needed. WAL (Write-Ahead Logging) mitigates database contention under high write loads.

**Performance:** Same-data-center D1 reads/writes typically sub-10ms, optimal since all service logic runs in single worker with no inter-service communication overhead.

---

### 10. Centralized Error Responses

**Decision:** Standardized all API responses to {success: boolean, message: string, data: any} format with dedicated sanitization function stripping sensitive information.

**Why:** Inconsistent error handling made frontend unpredictable (raw exceptions, status codes only, varying formats). Standardization ensures actionable user feedback without leaking sensitive data.

**Error Sanitization:** Dedicated function strips stack traces, redacts API keys/tokens, truncates long messages, and removes SQL fragments before exposing errors to users.

**Retry Strategy:** Background evaluation retries use exponential backoff (2s then 4s) to handle transient Gemini API rate limits or temporary network issues without overwhelming the API. Non-retriable errors (invalid article type, malformed prompts) fail fast and mark status = "failed" with user-safe message; users can manually resubmit after fixing input.

**Trade-offs:** Slightly larger payloads; requires consistent helper usage in route handlers to avoid bypassing sanitization.

---

### 11. No Explicit Caching Layer

**Decision:** Relies on D1 direct reads (~10ms for indexed queries) instead of implementing KV caching or HTTP caching strategies.

**Why:** D1 read performance and platform's global distribution make caching unnecessary for current scale. Caching would introduce consistency complexity (especially for article types that change infrequently but need immediate consistency).

**Alternatives Rejected:** KV caching for article types rejected due to immediate consistency requirements when types update; HTTP Cache-Control rejected because responses contain user-specific data (auth status).

**Frontend Stale-While-Revalidate:** useMyArticles shows cached data immediately while silently refreshing in background; useArticle polls for scoring without blocking UI. Achieves perceived performance benefits of caching without infrastructure complexity.

**Known Trade-offs:** Slightly higher database read volume (mitigated by D1 indexing and low cost). No protection against thundering herd on popular articles, but internal tool usage patterns keep database load within D1 free tier limits. Heavy reporting queries might eventually benefit from materialized views or summary tables.

---

### 12. Environment-Specific Secrets Management

**Decision:** Uses Wrangler's [vars] for defaults, [env.*] sections for environment overrides, and wrangler secrets for truly sensitive values never checked into version control.

**Why:** Securely manages different secrets (JWT keys, SendGrid, Google AI) across dev/prod without risking cross-environment leakage or complicating local development.

**Preventing Leakage:** Each environment gets isolated bindings—dev workers point to dev D1 database with dev-only API keys; prod uses completely separate credentials. D1 database IDs differ between environments (visible in wrangler.toml), ensuring dev writes never affect prod data.

**Alternatives Rejected:** Centralized secrets manager (AWS Secrets Manager, HashiCorp Vault) rejected as overkill for this scale; encrypting secrets in repo rejected due to key management complexity and runtime decryption overhead.

**Secret Rotation:** Manual rotation via Wrangler CLI and redeploy. No automatic rotation, but low-frequency rotation schedule (JWT quarterly, API keys as needed) makes manual process acceptable.

**Trade-offs:** Requires wrangler secret put per environment during setup; risk of accidentally committing .wrangler files mitigated by .gitignore rules. Performance negligible since secret retrieval happens once per worker cold start.

---

### 13. Frontend Polling Instead of WebSockets

**Decision:** Implemented polling via useMyArticles and useArticle hooks hitting GET /articles/mine/:id every 2.5 seconds until ai_score is non-null or 5-minute timeout, instead of WebSocket connections.

**Why:** Cloudflare Workers are stateless request handlers without native WebSocket support (Durable Objects would be overkill). Evaluation frequency is low enough that polling doesn't create excessive load. Fits Cloudflare's serverless model perfectly—no connection state, sticky sessions, or custom scaling needed.

**Trade-offs:** Up to 2.5s latency on updates and wasted requests when articles already scored (mitigated by early stop when score populated). Potential thundering herd if many users poll simultaneously, but Cloudflare's edge network absorbs this load easily.

**Performance:** Minimal impact given low user concurrency and 2.5s interval. Simplicity of HTTP polling outweighs slightly delayed feedback for this use case.

---

### 14. Validation in Worker Only (No Client-Side)

**Decision:** Validates exclusively on backend via Zod schemas and route handler checks (email regex, OTP length, article type existence, score bounds); no client-side validation library or form validation in React.

**Why:** Prevents users bypassing validation through frontend manipulation. Critical since dynamic AI evaluation schema (built by buildEvaluationSchema) must match exactly what Gemini returns; backend Zod parsing catches model hallucinations or schema drift that frontend validation wouldn't.

**Alternatives Rejected:** Mirrored client-side Zod validation risks drift and adds bundle size; TypeScript compile-time validation doesn't enforce runtime constraints on user input.

**Trade-offs:** Slower error feedback (users submit then see errors rather than preventing invalid input upfront). Mitigated by clear, inline error display (e.g., "Invalid or expired code" for OTP). Security benefit: prevents injection attacks and ensures no invalid data reaches AI prompt pipeline.

---

### 15. CORS with Origin Whitelisting

**Decision:** Implements CORS middleware in `article-api/src/index.ts:24-44` with explicit origin whitelisting instead of allowing all origins; checks `Origin` header against hardcoded allowlist in code (not `wrangler.toml`).

**Why:** Prevents CSRF-like attacks and unauthorized API consumption from arbitrary websites. Critical because API uses credentials in requests and internal-use nature justifies explicit access control.

**Whitelisted Origins:** `article-api/src/index.ts:29-33` allows `http://localhost:5173`, `http://localhost:5174`, `https://noesys-article-platform.pages.dev`, and any `*.noesys-article-platform-admin.pages.dev` via `origin.endsWith(...)`, reflecting deployed and development environments.

**Trade-offs:** Friction when adding new frontend deployments (requires updating code in `article-api/src/index.ts:27`). Inability to use API from unknown origins during testing acceptable given platform's internal use. Whitelist maintained manually in code with `endsWith()` pattern for `*.pages.dev` subdomains. Performance negligible since CORS checks happen once per request during middleware.

---

### 16. Database Write Batching (db.batch)

**Decision:** Uses D1's db.batch() API for multi-statement writes, executing statements sequentially within a transaction so all operations commit together or none do.

**Why:** Ensures atomicity for critical operations where partial failure would corrupt data—article rewrites (INSERT history + UPDATE article) and evaluation persistence (UPDATE article + DELETE old results + INSERT new results).

**Required Operations:** Rewrite flow must snapshot history and update article simultaneously; evaluation must atomically update score, delete old parameters, and insert new ones. Sequential individual queries risk orphan records and inconsistent state.

**Alternatives Rejected:** Manual rollback logic error-prone and doesn't guarantee atomicity; single-statement UPDATEs can't handle operations requiring multiple statements.

**Trade-offs:** 100-statement batch size limit in D1 and inability to read results mid-batch, but code stays within constraints (3-5 statements max per batch). Performance positive: reduces database round-trips and ensures consistent reads without additional locking.

## UX Decisions

### 1. Fire-and-Forget Article Submission

**Decision:** Article submissions return immediately with "Article submitted! Scoring in progress..." toast and redirect home while Gemini evaluation runs asynchronously in background.

**Why:** Synchronous evaluation blocks HTTP response for 10-30 seconds, risking Cloudflare timeouts and poor UX with spinning loaders. Immediate feedback preserves Worker responsiveness and lets users navigate without feeling stalled.

**User Mental Model:** Users assume platform is "thinking" or processing in background—they don't need technical details, just confirmation submission succeeded and scoring happens separately.

**Perceived vs Actual Performance:** Instant success feedback dramatically improves perceived performance while actual evaluation time remains unchanged. Trade-off: users may not realize evaluation still happening if they leave the page, but acceptable since backend continues via waitUntil and results stored persistently in D1 for later checks.

---

### 2. Polling for Async AI Completion

**Decision:** Frontend polls GET /articles/mine/:id every 2.5 seconds checking if ai_score is non-null, stopping on completion or after 5-minute timeout.

**Why:** Cloudflare Workers don't natively support WebSockets. 2.5-second interval chosen as balance: frequent enough to feel responsive (updates within seconds) while avoiding excessive API calls that inflate D1 costs or trigger rate limits.

**5-Minute Timeout:** If scoring takes longer, polling stops and sessionStorage.toastError shows "Scoring timed out" on MyArticles page.

**User Visibility:** Silent background refresh—no progress bar or percentage, just disappearance of "Scoring..." spinner and appearance of actual score/feedback. Trade-off: users might not notice completion if not actively watching page, but updated results visible on next visit.

---

### 3. Scoring Timeout and Error Handling

**Decision:** After 5-minute polling timeout, system shows red toast "Scoring timed out" on MyArticles dashboard; users can retry by navigating back and resubmitting article.

**Why:** Clear communication of evaluation failures without alarm. No permanent lock—just temporal window. Users can re-trigger evaluation by submitting again; retry_count tracks attempts in database.

**Error Visibility:** Red toast has distinct style from green success toasts, but depends on user attention. If users ignore notifications, they might miss timeout. Platform provides clear "Submit Rewrite" or "New Article" path to re-trigger evaluation.

**User Understanding:** Most understand they can resubmit since UI returns them to creation flow after timeout, though some may perceive article as "broken" if they don't check status regularly.

---

### 4. Edit Lock During Scoring

**Decision:** Prevents edits while scoring in progress by showing yellow banner "Scoring — edits disabled" and disabling Rewrite button on ArticleDetail page.

**Why:** Prevents concurrent edits conflicting with ongoing AI evaluation. If user edited pending article while Gemini scored it, versioning would become ambiguous—which version did AI evaluate? Cognitive load of explaining version-state interactions outweighs convenience of continued editing.

**User Awareness:** Persistent yellow banner and disabled "Rewrite Article" button make edit lock clear. No forced edit mechanism—users must wait for completion or navigate away and return later.

**Trade-off:** Reduced flexibility during potentially long scoring wait, but ensures AI evaluation always references exact version user submitted, maintaining data integrity.

### 5. Role-Based Post-Login Redirect

**Decision:** After login, users redirected to "/" while admins (auth_role = "admin" or "super_admin") redirected to "/admin/articles" based on JWT token claims.

**Why:** Regular users and admins need substantially different experiences (user dashboard vs article type/parameter management). Role-based redirect more efficient than unified dashboard with visibility toggles—prevents admin clutter and provides immediate contextual relevance.

**Access Control:** Manual navigation to /admin/articles by non-admin triggers auth checks that redirect to appropriate user dashboard. Prevents users from seeing irrelevant administrative options.

**Trade-offs:** Potential confusion if users expect one destination but redirected based on role. Mitigated by clear role-based access logic and auth checks on protected routes. User experience includes clean separation of concerns and immediate dashboard relevance, though requires users understand their landing page depends on assigned role.

---

### 6. Toast Notifications via sessionStorage

**Decision:** Transient feedback messages (success/error toasts) passed between page navigations via sessionStorage with 3-second auto-dismiss and color coding (green success, red error).

**Why:** sessionStorage provides automatic cleanup on tab close, survives page navigation, minimal implementation overhead, and avoids XSS security concerns of cookies. Needed for messages like "Article submitted! Scoring in progress..." to appear on next page after redirect.

**Alternatives Rejected:** Redux/context state overkill for ephemeral messages; URL query parameters ugly, size-limited, potentially expose sensitive info; cookies pose XSS risks and unnecessary persistence.

**3-Second Timing:** Tuned to balance readability (long enough to read) with non-intrusiveness (short enough not to obscure content). Assumes users actively viewing dashboard when toast appears.

**Trade-offs:** Messages lost if users manually clear sessionStorage, open in new tab, or experience page reload. Ephemeral nature requires users looking at right place at right time—less reliable for critical info but appropriate for transient operational feedback.

---

### 7. Article Editor with Live Preview Toggle

**Decision:** Two-view toggle (Editor/Preview) instead of split-pane, inline preview, or markdown-only mode.

**Why:** Reduces "submit and hope it looks right" anxiety by validating complex elements (tables, code blocks, links, formatting) before AI evaluation. Split-pane wastes screen real estate, especially on smaller monitors; inline previews cause distracting layout shifts and re-rendering overhead; markdown-only frustrates users unfamiliar with markup syntax.

**User Confidence:** Live preview shows exactly how tables align, code blocks highlight, and links appear—critical before triggering AI scoring. Addresses user anxiety about complex formatting validation.

**Trade-offs:** Temporary loss of editor focus when toggling views and manual preview initiation prevent cognitive overload from simultaneously viewing markup and rendered output. Allows concentrated focus on either writing or reviewing, matching natural review behavior.

**Workflow Impact:** Adds extra step compared to always-on preview, slightly inefficient for power users but significantly reduces submission hesitation—especially for users less familiar with markdown. Increases confidence in content presentation with clear composition/validation mode separation.

### 8. Client-Side Filtering with URL State Persistence

**Decision:** All filter state (month, year, viewAll, type, status, page) stored in URL search parameters using React Router's useSearchParams hook with synchronous updates via setSearchParams.

**Why:** Enables persistence across refreshes, shareable via URL, and maintains state during navigation. Component state would reset on navigation; localStorage session-specific and harder to share; URL hash parameters lack standard tooling.

**URL Benefits:** Immediate shareability—users bookmark or send filtered view links. Back/forward buttons naturally navigate through filter history. Filters persist after closing tabs.

**Validation & Edge Cases:** Search params validated during parsing (month format ^\d{4}-\d{2}$); invalid values default to current month. Rapid filter changes create many history entries, mitigated by using replace: true for temporary changes.

**Trade-offs:** Some users might not realize filters are URL-persisted and be surprised when they persist after closing tabs. Clear mental model requires understanding URL behavior.

---

### 9. Article Versioning with Immutable Snapshots (UX Perspective)

**Decision:** MyArticles table displays Version column (v1, v2, etc.); specific versions accessible via ?version=N URL parameter with amber "Version N Snapshot" badge. Versions immutable and undeletable.

**Why:** Users understand rewrites create versions through visible version counter increments. ScoringHistoryTable lists all historical submissions with scores/timestamps. Immutable snapshots prevent accidental data loss—no deletion affordance.

**Why Not Diffs:** Diff view rejected because meaningful diffs for HTML/markdown content complex to implement. Full snapshots more valuable for compliance/audit than partial diffs.

**User Awareness:** Clear version awareness through visible counters and preserved historical scores. Users confident past work preserved and can reference historical submissions.

**Trade-offs:** Version viewing feature may not be discovered without guidance—accessed via URL parameter rather than prominent UI button. Requires explicit navigation to explore version history.

---

### 10. Optimistic UI Updates with Silent Background Refresh

**Decision:** No loading spinner during polling—only subtle "Processing your submission — auto-refreshing..." indicator when articles pending. Silent failures logged to console only.

**Why:** Provides real-time updates without interrupting workflow with spinners that create anxiety or imply something broken. Optimistic updates rejected (score doesn't exist until AI provides it). Persistent spinners create user anxiety and perceived instability.

**User Awareness:** Data freshness conveyed through absence of amber "Scoring..." indicators. When polling stops and score/feedback appear, users understand evaluation completed.

**Silent Failures:** Failures assumed transient and logged only, not surfaced as user errors. Next poll expected to succeed. Trade-off: users might not notice extended downtime, but simplifies error handling.

**Perceived Performance:** Removing spinners significantly improves perception—continuous stable data rather than flickering loaders creates professional, less alarming experience even during 30+ second evaluation windows.

---

### 11. Smart Navigation Patterns (Back Button, Rewrite Flow, Login Redirect)

**Decision:** navigateBackOrToArticles checks window.history.length to choose between navigate(-1) and navigate("/"); rewrite redirects to "/" not back to detail page; login redirects based on role.

**Why:** Creates contextually appropriate navigation rather than mechanically correct—back navigates to previous page if available (MyArticles list) or defaults to home. Always using navigate(-1) fails on direct links; always going home disorienting when deep-linking.

**Rewrite Redirect Logic:** After successful rewrite, redirect to home (showing updated list with toast) prevents confusing stale article detail while new version scores in background. Users see submission's updated status immediately.

**Navigation Away During Submission:** Users can navigate away during rewrite submission without interrupting evaluation—HTTP response already returned, so navigation doesn't affect background operation via waitUntil.

**Trade-offs:** Context-aware patterns might confuse users expecting consistent behavior, but contextual appropriateness outweighs minor disorientation. Designed to match natural user thinking about navigation rather than browser mechanics.
