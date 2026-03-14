-- ============================================
-- 058: Social media post generation option
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, refinement_prompt, follow_up_option_ids, child_item_option_ids, is_active, metadata, tenant_id, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'activity.social_post',
  'Generate Social Post',
  'Generate a social media post for this activity, with suggested images.',
  'activity',
  'Share2',
  ARRAY['social', 'post', 'twitter', 'linkedin', 'share'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY[]::text[],
  false,
  85,
  false,
  '{"type":"object","properties":{"activity_id":{"type":"string"},"platform":{"type":"string"},"tone":{"type":"string"}},"required":["activity_id"]}'::jsonb,
  'Social post generated.',
  NULL,
  ARRAY['activity.view', 'activity.edit', 'activity.list'],
  ARRAY[]::text[],
  true,
  '{}'::jsonb,
  NULL,
  'text_response',
  false,
  true,
  'activity',
  'social_post'
);

INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.social_post', 'Which platform?', 'platform', 0, false, 'select', '{"options": ["Twitter", "LinkedIn", "Facebook", "Instagram"], "placeholder": "Twitter"}'::jsonb, true),
('activity.social_post', 'Tone?', 'tone', 1, false, 'select', '{"options": ["professional", "casual", "enthusiastic", "informative"], "placeholder": "professional"}'::jsonb, true);

UPDATE option_definitions SET child_item_option_ids = array_append(child_item_option_ids, 'activity.social_post')
WHERE id IN ('activity.list', 'analysis.activities', 'activity.view', 'activity.create', 'activity.edit', 'analysis.specific_activity')
AND NOT ('activity.social_post' = ANY(child_item_option_ids));

UPDATE user_type_configs
SET available_option_ids = array_append(available_option_ids, 'activity.social_post')
WHERE user_type IN ('worker', 'candidate', 'representative') AND NOT ('activity.social_post' = ANY(available_option_ids));
