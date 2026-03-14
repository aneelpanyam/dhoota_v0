-- 079: Fix NULLIF empty string in insert_cost template
-- The empty string literal in SQL requires '' (two quotes). Inside a string we need '''' (four quotes).
-- Fixes "syntax error at or near" when recording system costs.
-- Use dollar-quoting to avoid quote escaping: wrong has 1 quote, correct has '' (empty string)
UPDATE sql_templates
SET sql = REPLACE(sql, $$NULLIF(trim($5), ')$$, $$NULLIF(trim($5), '')$$)
WHERE option_id = 'admin.costs.record' AND name = 'insert_cost';
