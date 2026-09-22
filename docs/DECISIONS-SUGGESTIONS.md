# Decision Log – AI Suggestion & Apply Feature (as built)

## Scope & Constraints

- Articles are stored as **Markdown** (the editor's HTML is converted client-side before submit). Suggestions are **block-level** replacements, where a block is a blank-line-separated Markdown chunk (paragraph, heading, list, table, fenced code).
- AI is **not trusted** for `old_text`; the server derives it from the current content with the shared splitter in `article-api/src/utils/contentBlocks.ts` and stores a SHA-256 hash of the block. Blocks carry exact offsets, so applying one suggestion leaves every other byte of the article untouched, and the target is located by hash (not index) so earlier applies can't shift it.
- Only **replace** operations (no inserts/deletes) so block indices stay stable.
- Suggestions are scoped to `(article_id, version)`; a re-evaluate/type-change bumps the version and old suggestions stop applying (version guard).
- Feature is **admin-only** (routes behind `requireRole("admin")`; panel rendered only on admin views).
- Applying is an **in-place edit**: `articles.content` updated, no version bump, no auto re-evaluation. UI shows an "edited since evaluation" notice until the admin re-evaluates.
- **History stays truthful**: the first apply stores the text that was actually scored in `articles.pre_edit_content` (migration 0019). Every history snapshot (rewrite, re-evaluate, type change) stores that scored text instead of the edited text, then clears it as the version changes, so a history row's content always matches its score/feedback and the previous-version AI context reports the change correctly.
- AI suggestions are generated **only when an admin clicks "Generate suggestions"** (never as part of evaluation, never on page open) so token spend scales with admin use, not article volume. Opening an article only reads suggestions already stored.
- `new_text` is Markdown, sanitized with `sanitizeHtmlServer` (same as submitted content) before storage.
- **Min-words guard twice**: discards violating suggestions at creation, and blocks violating applies with an inline error naming the required minimum.
- At most 8 suggestions per version, one per block. The panel is a table (suggestion / word-level diff / Apply) with Apply all.
- Generation is `POST /admin/articles/:id/suggestions/generate` (idempotent per version: returns stored suggestions without another AI call).

## Data Model

Migration `article-api/src/migrations/0016_article_suggestions.sql`:

```sql
CREATE TABLE IF NOT EXISTS article_suggestions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  parameter_name TEXT,
  target_block_index INTEGER NOT NULL,
  old_text TEXT NOT NULL,
  old_text_hash TEXT NOT NULL,
  new_text TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_suggestions_article_version
  ON article_suggestions(article_id, version, applied);
```

## API Changes (`article-api/src/routes/admin/articles.ts`)

- `GET /admin/articles/:id/suggestions?version=N` → all suggestions for the article (optionally filtered by version).
- `POST /admin/articles/:id/suggestions/apply` with `{ suggestionIds: string[] }` (1–40) → hash-checked, min-words-checked, applied in block-index order. Returns `{ applied, failed, content }`.
- `POST /admin/articles/:id/suggestions/apply-all` → applies every unapplied suggestion for the current version via the same path.

## Backend services

- `article-api/src/utils/contentBlocks.ts` — `splitContentBlocks`, `hashText` (SHA-256), `countWordsHtml`. Single splitter used for numbering, hashing, and rebuilding content.
- `article-api/src/services/user/suggestions.service.ts` — prompt builder, `generateAndStoreSuggestions` (best-effort, never throws), `listSuggestions`, `applySuggestions`.

## Frontend

- New `article-app/src/admin/components/articles/SuggestionsPanel.tsx`: collapsible panel, per-card diff (`−` old / `+` new as plain text), Apply per card, Apply-all, inline per-suggestion errors, applied counter, "edited since evaluation" notice.
- Wired into `AdminArticleDetail.tsx` (after `ParameterResultsBox`, hidden for version snapshots) and the admin branch of `screens/ArticleDetail.tsx`; both refresh displayed content from the apply response via `onContentUpdated`.

## Behavior notes

- **Save without re-evaluate**: allowed and expected. Content updates immediately (user sees it on next read); score/feedback stay from the prior evaluation until the admin presses Re-evaluate. The panel notice plus existing score UI make the staleness explicit.
- **User visibility**: applying sets `articles.admin_edited_at` (migration 0018); an "Edited by admin" badge shows next to the article-type badge on the article page. It is cleared when the author rewrites, and kept through re-evaluate / type change.
- **Edge cases handled**:
  - Stale block (hash mismatch) → apply rejected: "Content changed since suggestion was generated".
  - Same-block double apply → second one fails the hash check after the rebuild.
  - Older-version suggestions → rejected by version guard.
  - Image-only blocks → excluded from generation.
  - Min-words breach → discarded at creation (logged) or rejected at apply with the required minimum named.
  - Already-applied ids → reported as failures, not re-applied.
