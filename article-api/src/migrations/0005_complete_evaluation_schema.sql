-- Migration: 0005_complete_evaluation_schema.sql
-- This migration completes the evaluation schema according to the implementation guide
PRAGMA foreign_keys = OFF;

-- Recreate parameters table with proper structure
DROP TABLE IF EXISTS parameters;
CREATE TABLE parameters (
    id TEXT PRIMARY KEY,
    article_type_id TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    scope_type TEXT NOT NULL CHECK(scope_type IN ('numeric', 'option')),
    min_value REAL,
    max_value REAL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (article_type_id) REFERENCES article_types(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_parameters_article_type ON parameters(article_type_id);

-- Create parameter_options table
CREATE TABLE IF NOT EXISTS parameter_options (
    id TEXT PRIMARY KEY,
    parameter_id TEXT NOT NULL,
    label TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (parameter_id) REFERENCES parameters(id)
);

CREATE INDEX IF NOT EXISTS idx_parameter_options_parameter ON parameter_options(parameter_id);

-- Recreate article_parameter_results table with proper structure
DROP TABLE IF EXISTS article_parameter_results;
CREATE TABLE article_parameter_results (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    parameter_id TEXT NOT NULL,
    value TEXT NOT NULL,
    option_id TEXT,
    numeric_value REAL,
    version INTEGER NOT NULL,
    scored_at TEXT NOT NULL,
    UNIQUE(article_id, parameter_id, version),
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (parameter_id) REFERENCES parameters(id),
    FOREIGN KEY (option_id) REFERENCES parameter_options(id)
);

CREATE INDEX IF NOT EXISTS idx_article_parameter_results_article ON article_parameter_results(article_id);

PRAGMA foreign_keys = ON;
