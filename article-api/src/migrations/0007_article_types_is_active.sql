-- Migration 0007: article_types.is_active expected by app queries but never added
-- 0003 comment claimed it already existed; 0001 never created it.
ALTER TABLE article_types ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
