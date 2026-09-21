-- 0018: set when an admin applies AI content suggestions; cleared when the author rewrites.
ALTER TABLE articles ADD COLUMN admin_edited_at TEXT;
