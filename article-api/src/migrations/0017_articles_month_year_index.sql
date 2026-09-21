-- 0016: Insights queries filter articles by month_year range;
CREATE INDEX IF NOT EXISTS idx_articles_month_year ON articles(month_year);
