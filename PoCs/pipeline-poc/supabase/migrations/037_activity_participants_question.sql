-- ============================================
-- 037: Activity participants table question
-- Add participants question to activity.create
-- and update insert to store in metadata.
-- ============================================

-- Add participants question
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.create', 'Who were the participants? (optional)', 'participants', 5, false, 'table',
'{"columns": [{"key": "name", "label": "Name", "required": true}, {"key": "role", "label": "Role", "required": false}, {"key": "contact", "label": "Contact", "required": false}]}'::jsonb,
false);

-- Update activity insert to include metadata with participants
UPDATE sql_templates SET
  sql = 'INSERT INTO activities (tenant_id, created_by, title, description, status, visibility, activity_date, location, metadata) VALUES ($1, $2, $3, $4, COALESCE($5, ''completed'')::activity_status, COALESCE($6, ''private'')::activity_visibility, COALESCE($7::timestamptz, now()), $8, jsonb_build_object(''participants'', COALESCE($9::jsonb, ''[]''::jsonb))) RETURNING *',
  param_mapping = '{"$1": "context.tenantId", "$2": "context.userId", "$3": "params.title", "$4": "params.description", "$5": "params.status", "$6": "params.visibility", "$7": "params.activity_date", "$8": "params.location", "$9": "params.participants"}'::jsonb
WHERE option_id = 'activity.create' AND name = 'insert_activity';
