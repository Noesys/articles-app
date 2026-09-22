-- 0016: AI content suggestions (block-level replace, admin apply)
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
