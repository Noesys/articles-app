-- 0009: evaluatable flag + employee email linkage (no user creation at seed time)
ALTER TABLE article_types ADD COLUMN is_evaluatable INTEGER NOT NULL DEFAULT 1;
UPDATE article_types SET is_evaluatable=0 WHERE lower(name)='not suitable';
ALTER TABLE articles ADD COLUMN emp_id TEXT;
ALTER TABLE articles ADD COLUMN employee_email TEXT;
CREATE INDEX IF NOT EXISTS idx_articles_employee_email ON articles(employee_email);
CREATE INDEX IF NOT EXISTS idx_articles_emp_id ON articles(emp_id);
