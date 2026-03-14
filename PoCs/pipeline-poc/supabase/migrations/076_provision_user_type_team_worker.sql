-- ============================================
-- 076: Add team_worker to provision user_type allowed values
-- The DB enum includes team_worker, but input_schema only allowed worker/candidate/representative.
-- ConfirmationCardWidget shows "Team Worker" as an option, causing validation to fail.
-- ============================================

-- admin.user.provision: add team_worker to input_schema enum
UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"tenant_id":{"type":"string"},"email":{"type":"string","format":"email"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative","team_worker"]},"access_code":{"type":"string"}},"required":["tenant_id","email","display_name","user_type"]}'::jsonb
WHERE id = 'admin.user.provision';

-- admin.user.provision: add team_worker to user_type question options
UPDATE option_questions SET
  widget_config = '{"options": ["worker", "candidate", "representative", "team_worker"]}'::jsonb
WHERE option_id = 'admin.user.provision' AND question_key = 'user_type';

-- admin.user.provision_bulk: add team_worker to users.items.properties.user_type enum
UPDATE option_definitions SET
  input_schema = jsonb_set(
    input_schema,
    '{properties,users,items,properties,user_type,enum}',
    '["worker", "candidate", "representative", "team_worker"]'::jsonb
  )
WHERE id = 'admin.user.provision_bulk';

-- admin.user.provision_bulk: add options to table column for user_type
UPDATE option_questions SET
  widget_config = '{"columns": [{"key": "email", "label": "Email", "required": true, "format": "email"}, {"key": "display_name", "label": "Display Name", "required": true}, {"key": "user_type", "label": "User Type", "required": true, "options": ["worker", "candidate", "representative", "team_worker"]}]}'::jsonb
WHERE option_id = 'admin.user.provision_bulk' AND question_key = 'users';

-- admin.user.edit: add team_worker to input_schema and user_type question (for consistency)
UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"user_id":{"type":"string"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative","team_worker"]},"access_code":{"type":"string"},"deactivate":{"type":"boolean"},"avatar_keys":{"type":"array"}},"required":["user_id"]}'::jsonb
WHERE id = 'admin.user.edit';

UPDATE option_questions SET
  widget_config = '{"options":["worker","candidate","representative","team_worker"],"placeholder":"Keep current"}'::jsonb
WHERE option_id = 'admin.user.edit' AND question_key = 'user_type';
