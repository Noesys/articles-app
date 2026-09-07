-- Migration number: 0001 	 2026-08-18T06:47:16.289Z
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    auth_role TEXT NOT NULL,
    job_role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    created_by TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS article_types (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    article_type_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    ai_score REAL,
    version INTEGER NOT NULL DEFAULT 1,
    submitted_at TEXT NOT NULL,
    scored_at TEXT,
    month_year TEXT NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (article_type_id) REFERENCES article_types(id)
);

CREATE TABLE IF NOT EXISTS article_history (
    id TEXT PRIMARY KEY,
    article_id TEXT NOT NULL,
    article_type_id TEXT NOT NULL,
    title TEXT NOT NULL,
    ai_feedback TEXT NOT NULL,
    content TEXT NOT NULL,
    ai_score REAL,
    version INTEGER NOT NULL,
    submitted_at TEXT NOT NULL,
    scored_at TEXT,
    snapshotted_at TEXT NOT NULL,
    FOREIGN KEY (article_id) REFERENCES articles(id),
    FOREIGN KEY (article_type_id) REFERENCES article_types(id)
);

CREATE TABLE IF NOT EXISTS prompts (
    id TEXT PRIMARY KEY,
    article_type_id TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (article_type_id) REFERENCES article_types(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT
);