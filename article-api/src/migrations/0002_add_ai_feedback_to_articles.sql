-- Migration number: 0002 	 2026-08-25T00:00:00.000Z
PRAGMA foreign_keys = ON;

ALTER TABLE articles ADD COLUMN ai_feedback TEXT;
