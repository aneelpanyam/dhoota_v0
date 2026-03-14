-- ============================================
-- 066: Avatar upload for profile.edit and admin.user.edit
-- Adds file_upload question for avatar; stores S3 key in users.avatar_url
-- ============================================

-- admin.user.edit: add avatar_url question and SQL param
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES ('admin.user.edit', 'Profile picture? (optional)', 'avatar_keys', 5, false, 'file_upload', '{"accept": "image/*", "multiple": false, "uploadContext": "profile"}'::jsonb, true);

UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"user_id":{"type":"string"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative"]},"access_code":{"type":"string"},"deactivate":{"type":"boolean"},"avatar_keys":{"type":"array"}},"required":["user_id"]}'::jsonb
WHERE id = 'admin.user.edit';

UPDATE sql_templates SET
  sql = 'UPDATE users SET display_name = COALESCE($2, display_name), user_type = COALESCE($3::user_type, user_type), access_code = COALESCE($4, access_code), avatar_url = COALESCE($6, avatar_url), deleted_at = CASE WHEN $5::boolean = true THEN now() ELSE deleted_at END, updated_at = now() WHERE id = $1 RETURNING id, email, display_name, user_type, access_code, avatar_url, deleted_at',
  param_mapping = '{"$1": "params.user_id", "$2": "params.display_name", "$3": "params.user_type", "$4": "params.access_code", "$5": "params.deactivate", "$6": "params.avatar_url"}'::jsonb
WHERE option_id = 'admin.user.edit' AND name = 'update_user';

-- profile.edit: add avatar_url question and SQL param
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
VALUES ('profile.edit', 'Profile picture? (optional)', 'avatar_keys', 1, false, 'file_upload', '{"accept": "image/*", "multiple": false, "uploadContext": "profile"}'::jsonb, true);

UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"display_name":{"type":"string"},"avatar_keys":{"type":"array"}}}'::jsonb
WHERE id = 'profile.edit';

UPDATE sql_templates SET
  sql = 'UPDATE users SET display_name = COALESCE($3, display_name), avatar_url = COALESCE($4, avatar_url), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id, email, display_name, user_type, avatar_url',
  param_mapping = '{"$1": "context.userId", "$2": "context.tenantId", "$3": "params.display_name", "$4": "params.avatar_url"}'::jsonb
WHERE option_id = 'profile.edit' AND name = 'update_profile';
