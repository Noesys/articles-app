-- 0015: configurable minimum word count per article type
ALTER TABLE article_types ADD COLUMN min_words INTEGER NOT NULL DEFAULT 1000;
