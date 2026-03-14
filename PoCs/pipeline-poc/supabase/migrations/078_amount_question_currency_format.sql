-- 078: Add format: currency to amount question for numeric input validation/restriction
-- Ensures amount field uses decimal input mode and rejects non-numeric characters
UPDATE option_questions
SET widget_config = jsonb_set(
  COALESCE(widget_config, '{}'::jsonb),
  '{format}',
  '"currency"'
)
WHERE option_id = 'admin.costs.record' AND question_key = 'amount';
