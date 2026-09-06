-- Migration 0006: add columns expected by app code but missing in local D1
-- Safe idempotent adds for both local and remote
ALTER TABLE article_history ADD COLUMN status TEXT;
ALTER TABLE article_history ADD COLUMN pass_threshold REAL;
ALTER TABLE articles ADD COLUMN pass_threshold REAL;
ALTER TABLE articles ADD COLUMN updated_at TEXT;
ALTER TABLE articles ADD COLUMN created_at TEXT;
