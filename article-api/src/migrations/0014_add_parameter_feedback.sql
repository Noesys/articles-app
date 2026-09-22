-- Migration number: 0014 	2026-09-18T00:00:00.000Z
-- Per-parameter AI feedback (markdown) shown in the parameter results table.
PRAGMA foreign_keys = OFF;

ALTER TABLE article_parameter_results ADD COLUMN feedback TEXT;

PRAGMA foreign_keys = ON;
