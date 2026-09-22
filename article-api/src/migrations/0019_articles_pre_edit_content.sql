-- 0019: text that was actually scored, kept while an admin's applied suggestions
-- edit the article in place. History snapshots store this instead of the edited
-- text so each history row's content matches its score/feedback. Cleared whenever
-- the version changes (rewrite / re-evaluate / type change).
ALTER TABLE articles ADD COLUMN pre_edit_content TEXT;
