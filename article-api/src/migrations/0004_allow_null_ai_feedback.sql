-- Migration number: 0004 	 2026-08-26T00:00:00.000Z
PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS article_history_new (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    article_type_id TEXT NOT NULL,
    title TEXT NOT NULL,
    ai_feedback TEXT, -- Nullable now
    content TEXT NOT NULL,
    ai_score REAL,
    version INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    scored_at TEXT,
    snapshotted_at TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (article_type_id) REFERENCES article_types(id)
);

INSERT INTO article_history_new (
    id, article_id, article_type_id, title, ai_feedback, 
    content, ai_score, version, submitted_at, scored_at, snapshotted_at
)
SELECT 
    id, article_id, article_type_id, title, ai_feedback, 
    content, ai_score, version, submitted_at, scored_at, snapshotted_at 
FROM article_history;

DROP TABLE article_history;

ALTER TABLE article_history_new RENAME TO article_history;

PRAGMA foreign_keys = ON;
