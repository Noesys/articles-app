-- Migration: 0003_restructure_scoring_system.sql
PRAGMA foreign_keys = ON;

-- Add only the NEW columns (is_active already exists)
ALTER TABLE article_types ADD COLUMN pass_threshold REAL NOT NULL DEFAULT 5.0;
ALTER TABLE article_types ADD COLUMN score_prompt TEXT NOT NULL DEFAULT '';
ALTER TABLE article_types ADD COLUMN score_min REAL NOT NULL DEFAULT 0;
ALTER TABLE article_types ADD COLUMN score_max REAL NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS parameters (
    id TEXT PRIMARY KEY,
    article_type_id TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scope_type TEXT NOT NULL CHECK(scope_type IN ('numeric', 'option')),
    min_value REAL,
    max_value REAL,
    options TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (article_type_id) REFERENCES article_types(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS article_parameter_results (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    parameter_id TEXT NOT NULL,
    value TEXT NOT NULL,
    version INTEGER NOT NULL,
    scored_at TEXT NOT NULL,
    UNIQUE(article_id, parameter_id, version),
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (parameter_id) REFERENCES parameters(id)
);

CREATE INDEX IF NOT EXISTS idx_parameters_article_type ON parameters(article_type_id);
CREATE INDEX IF NOT EXISTS idx_article_parameter_results_article ON article_parameter_results(article_id);