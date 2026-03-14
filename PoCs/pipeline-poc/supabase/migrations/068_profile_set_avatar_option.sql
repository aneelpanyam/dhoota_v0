-- ============================================
-- 068: Dedicated profile.set_avatar option
-- Avatar-only option that shows current avatar when editing
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'profile.set_avatar',
  'Set Profile Picture',
  'Update your profile picture. Your current picture is shown so you can replace it.',
  'profile',
  'Image',
  ARRAY['profile picture', 'avatar', 'set avatar', 'change photo', 'profile photo'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY[]::text[],
  false,
  99,
  false,
  '{"type":"object","properties":{"avatar_keys":{"type":"array"}}}'::jsonb,
  'Profile picture updated.',
  ARRAY['profile.view', 'profile.edit'],
  true,
  'text_response',
  true,
  true,
  'user',
  'sql'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  follow_up_option_ids = EXCLUDED.follow_up_option_ids;

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable)
SELECT 'profile.set_avatar', 'Upload a new profile picture', 'avatar_keys', 0, false, 'file_upload', '{"accept": "image/*", "multiple": false, "uploadContext": "profile"}'::jsonb, true
WHERE NOT EXISTS (SELECT 1 FROM option_questions WHERE option_id = 'profile.set_avatar' AND question_key = 'avatar_keys');

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type)
SELECT 'profile.set_avatar', 'update_avatar',
'UPDATE users SET avatar_url = COALESCE($3, avatar_url), updated_at = now() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL RETURNING id, display_name, avatar_url',
'{"$1": "context.userId", "$2": "context.tenantId", "$3": "params.avatar_url"}'::jsonb,
0, 'write'
WHERE NOT EXISTS (SELECT 1 FROM sql_templates WHERE option_id = 'profile.set_avatar' AND name = 'update_avatar');

-- Add to profile.view follow-ups and available options
UPDATE option_definitions SET
  follow_up_option_ids = array_append(follow_up_option_ids, 'profile.set_avatar')
WHERE id = 'profile.view' AND NOT ('profile.set_avatar' = ANY(follow_up_option_ids));

UPDATE user_type_configs SET
  available_option_ids = array_append(available_option_ids, 'profile.set_avatar')
WHERE user_type IN ('worker', 'candidate', 'representative') AND NOT ('profile.set_avatar' = ANY(available_option_ids));
