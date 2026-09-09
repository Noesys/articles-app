-- Migration number: 0008 	2026-09-09T00:00:00.000Z
PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parameters_type_name
    ON parameters(article_type_id, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parameter_options_parameter_label
    ON parameter_options(parameter_id, label);

CREATE INDEX IF NOT EXISTS idx_article_parameter_results_parameter_value
    ON article_parameter_results(parameter_id, value);