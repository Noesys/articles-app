# Code Review — `contiq-publish-feat` pull

**Reviewed range:** `git diff main...HEAD` (commits `9883ba1` + `1756933`, 24 files, +682/−91)
**Review standard:** `code-review-and-quality` skill (five axes: correctness, readability, architecture, security, performance)
**Date:** 2026-10-10

Working-tree changes not part of the pull (`AllArticles.tsx` / `MyArticles.tsx` button labels) are out of scope.

---

## Issues found

### R1 — Malformed request body silently deletes the published link
- **Commit:** `1756933` *feat/ added publish url feature*
- **File:** `article-api/src/routes/admin/articles.ts` (`PUT /:id/published-url`)
- **Axis:** Correctness / Security
- **Severity:** Required
- **Detail:** `await c.req.json().catch(() => ({}))` turns a body that fails to parse into `{}`,
  which `normalizePublishedUrl(undefined)` maps to `null` → the row is updated and the stored
  link is cleared. Verified against the local server: body `{"url":` returned
  `200 "Published link removed"` and nulled the column. Invalid input must not mutate state.
- **Suggested fix:** Distinguish parse failure from a real body (400 on unparseable /
  non-object body), and require the `url` key to be present — `null` still means "clear",
  a missing key means "bad request".

### R2 — "Last evaluated at" column is backed by `updated_at`
- **Commit:** `9883ba1` *fix/ UI issues and table height fixed* (header rename),
  `1756933` (column carried forward)
- **Files:** `article-app/src/admin/components/articles/ArticlesTableContent.tsx`,
  `article-app/src/screens/MyArticles.tsx`
- **Axis:** Correctness
- **Severity:** Required
- **Detail:** `updated_at` moves on article creation, user rewrite (before scoring), admin title
  rename, type change and apply-suggestions — not only on evaluation. A freshly submitted,
  never-scored article displays an "Last evaluated at" date. `scored_at` is the field that
  means what the header says.
- **Suggested fix:** Select `scored_at` in the admin list query, map it through to
  `ArticleSummary`, and bind the column to `scored_at` (show `—` when null). Do the same on the
  user list via `articleToListItem`.

### R3 — Date-normalization helper fixed one table, not the ones the pull touched
- **Commit:** `9883ba1`
- **Files:** `article-app/src/admin/components/articles/ScoringHistoryTable.tsx` (helper lives
  here), `article-app/src/screens/MyArticles.tsx`, `article-app/src/admin/utils/date.ts`
- **Axis:** Correctness / Architecture
- **Severity:** Required
- **Detail:** `parseHistoryDate` correctly handles both date shapes the README documents (ISO
  with zone vs SQLite `CURRENT_TIMESTAMP` without). The columns this same pull renamed still
  parse with raw `dayjs()` / `new Date()`, which read a zone-less value as local time — the same
  instant renders differently in two views.
- **Suggested fix:** Move the parser to `admin/utils/date.ts` as the canonical helper, have
  `formatDateToUSLocale` use it, and use it from the touched date cells.

### R4 — `fitRowsHeight` call sites pass the defaults back as positional arguments
- **Commit:** `9883ba1`
- **Files:** `MyArticles.tsx`, `ArticlesTableContent.tsx`, `data-grid-virtual-scroll-area.tsx`
- **Axis:** Readability
- **Severity:** Consider
- **Detail:** `fitRowsHeight(n, "57vh", 45, 44, 96, "30vh")` — three of the six arguments are the
  function's own defaults, repeated at both call sites purely to reach `minHeight`.
- **Suggested fix:** Replace the trailing defaulted parameters with a single options object:
  `fitRowsHeight(n, "57vh", { minHeight: "30vh" })`.

### R5 — `getSafePublishedUrl(article.published_url)` evaluated four times in one JSX block
- **Commit:** `1756933`
- **File:** `article-app/src/screens/ExploreArticles.tsx` (`ExploreArticleView`)
- **Axis:** Readability
- **Severity:** Consider
- **Detail:** condition, `href`, `title` and host each re-run the parse. The list view above it
  already extracts a `const` first.
- **Suggested fix:** Extract `const publishedUrl = getSafePublishedUrl(article.published_url)`
  once and branch on it.

### R6 — Client-side URL rule duplicates the server rule
- **Commit:** `1756933`
- **File:** `article-app/src/admin/components/articles/PublishedLinkDialogs.tsx`
- **Axis:** Readability / Architecture
- **Severity:** Nit
- **Detail:** `/^https?:\/\//i` in `handleSave` mirrors `normalizePublishedUrl` and will drift
  (the client does not enforce the 2000-char cap, for example). The 400 message from the server
  is already user-presentable.
- **Suggested fix:** Drop the client regex; keep only the empty-input check and render the
  server's error.

### R7 — Optional `published_url` types paper over an invariant
- **Commit:** `1756933`
- **Files:** `admin/utils/types.ts`, `utils/types.ts`, `ExploreArticles.tsx`
- **Axis:** Architecture
- **Severity:** Nit
- **Detail:** Every list/detail endpoint that now returns `published_url` always returns it, but
  the front-end types declare `published_url?: string | null`.
- **Suggested fix:** Make the field required (`string | null`) on the list/detail types.

### R8 — Dead code left by the removed "All records loaded" row
- **Commit:** `9883ba1`
- **Files:** `data-grid.tsx`, `data-grid-i18n.tsx`
- **Axis:** Readability
- **Severity:** FYI / clean-up
- **Detail:** `allRowsLoadedMessage` (prop, `data-grid.tsx:771`) and `labels.allRowsLoaded`
  (`data-grid-i18n.tsx:26,70`) have no remaining references.
- **Suggested fix:** Delete both after confirming zero references.

### R9 — README block has no trailing newline
- **Commit:** `9883ba1`
- **File:** `README.md`
- **Axis:** Readability
- **Severity:** Nit
- **Suggested fix:** Terminate the file with a newline.

---

## Verification (round 1)

| Check | Result |
| --- | --- |
| `tsc --noEmit` (article-api) | pass |
| `tsc && vite build` (article-app) | pass |
| `PUT` with `javascript:` | 400 ✓ |
| `PUT` with non-string `url` | 400 ✓ |
| `PUT` on unknown id | 404 ✓ |
| No user-facing setter for `published_url` | ✓ |
| `PUT` leaves `updated_at` / `version` / `status` untouched | ✓ (SQL check) |
| `PUT` with malformed JSON body | **200 + link cleared ✗** (R1) |
| Automated tests | none exist in the repo — mutation check not runnable |

## Verdict (round 1)

**Request changes** — R1 and R2 before merge; R3 in the same pass.

---

## Fixes applied

| ID | Status | Change |
| --- | --- | --- |
| R1 | **Fixed** | `PUT /:id/published-url` now rejects a body that fails to parse, a non-object body (400 `Invalid JSON body`) and a missing `url` key (400 `Missing 'url' field`). `null` / `""` still clear the link on purpose. |
| R2 | **Fixed** | Admin list SQL selects `a.scored_at`; `ArticleListRawRow` / `ArticleListResult` / `ArticleSummary` carry it; both "Last evaluated at" columns are bound to `scored_at` and render `—` when null. On the user side `articleToListItem` returns `evaluated: scored_at` instead of `edited: updated_at`, and `ArticleListItem.evaluated: string \| null`. |
| R3 | **Fixed** | `parseUtcDate()` is exported from `admin/utils/date.ts` and used by `formatDateToUSLocale`, `ScoringHistoryTable` and both `MyArticles` date cells; the file-local `parseHistoryDate` is gone. |
| R4 | **Fixed** | `fitRowsHeight(rowCount, maxHeight, { minHeight })` — options object replaces the four positional parameters; both call sites simplified. |
| R5 | **Fixed** | `const publishedUrl = getSafePublishedUrl(article?.published_url)` extracted once in `ExploreArticleView`. |
| R6 | **Fixed** | Client regex removed; only the empty-input check remains and the server's 400 message is rendered. |
| R7 | **Fixed** | `published_url: string \| null` is now required on `ArticleSummary`, `ArticleListItem`, `BrowseItem`, `BrowseDetail` and `TargetArticle`. |
| R8 | **Fixed** | Deleted `allRowsLoadedMessage` (`DataGridProps`) and `labels.allRowsLoaded`; also removed the `hasMore` prop orphaned on `DataGridTableVirtualBody` by `9883ba1` (oxlint was flagging it) and unused imports in two pull-touched files (`RefreshCw`, `useEffect`, `Button`, `Table`). |
| R9 | **Fixed** | `README.md` terminated with a newline. |

**Contract change to be aware of:** `GET /api/articles/mine` no longer returns `article.edited`
(replaced by `article.evaluated`). `MyArticles` was the only consumer of `edited`.

## Re-review (round 2)

**Range:** `main...HEAD` plus the remediation diff (19 files, +99/−63).

### Correctness
- [x] R1 verified by experiment: malformed body → `400 {"message":"Invalid JSON body"}` and the
      stored link is **unchanged** (set `https://example.com/a`, sent `{bad`, re-read the row —
      still `https://example.com/a`). Missing key → 400, non-object body → 400,
      `javascript:` → 400, `{"url":null}` → 200 + cleared, unknown id → 404.
- [x] R2: admin list returns `scored_at`, user list returns `evaluated`; both verified live.
      `updated_at` / `version` / `status` still untouched by the PUT.
- [x] R3: one canonical parser; no remaining `dayjs(raw)` / `new Date(raw)` on article dates in
      the touched columns.
- [x] Edge cases: `parseUtcDate` guards empty/non-string input → `Invalid Date` → caller's
      existing fallback (raw string) still applies.

### Readability / Architecture
- [x] No duplicated conditionals on the same shape left: URL validation exists once (server),
      date normalization once (`admin/utils/date.ts`), height calculation reads as
      `fitRowsHeight(n, "57vh", { minHeight: "30vh" })`.
- [x] Types are explicit: `string | null` instead of optional, `evaluated` named for what it is.
- [x] Dead code: zero references left for anything removed (`allRowsLoaded*`, `hasMore` on the
      virtual body, unused imports).

### Security
- [x] Unchanged good properties: admin-only route, parameterized SQL, http(s)-only URL with
      2000-char cap on write, render-time `getSafePublishedUrl` backstop, `rel="noopener noreferrer"`.
- [x] New: invalid input can no longer mutate state.

### Performance
- [x] No new queries (one extra column in an existing SELECT), no N+1, no extra renders.

### Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` (article-api) | pass |
| `tsc --noEmit` (article-app) | pass |
| `tsc && vite build` (article-app) | pass |
| `oxlint` on files touched by this pull | clean (only pre-existing errors elsewhere remain) |
| Live PUT matrix (6 cases, listed above) | pass |
| Local D1 test rows | seeded, asserted, removed — local DB left clean |

### Pre-existing, out of scope (verified present on `main`)
- `oxlint .` is not green on `main` either (`data-grid.tsx:1066,1070`
  `no-useless-fallback-in-spread`, `data-grid-table.tsx` unused vars, and others) — unrelated
  lines, not introduced by this pull, left alone to keep the change focused.
- Still no test suite anywhere in the repo, so the skill's mutation check cannot be run.
  Next step worth taking: a minimal test runner covering the two pure helpers this feature
  added — `normalizePublishedUrl` and `parseUtcDate`.

### Verdict (round 2)

**Approve.** All Required findings (R1–R3) and the Consider/Nit items are resolved, the fixes
were re-verified by typecheck, build, lint and live HTTP tests, and no new issues were
introduced by the remediation.
