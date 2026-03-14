-- ============================================
-- 056: Tagging - tag questions for create/edit, activity.manage_tags option
-- ============================================

-- Add tag_select question to activity.create (after visibility, order 5)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.create', 'Add tags to categorize this activity?', 'tags', 5, false, 'tag_select', '{"source": "tags"}'::jsonb, true);

-- Add tag_select question to activity.edit (after visibility, order 6)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.edit', 'Update tags for this activity?', 'tags', 6, false, 'tag_select', '{"source": "tags"}'::jsonb, true);

-- Create activity.manage_tags option (per-item action like add_note, add_media)
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, refinement_prompt, follow_up_option_ids, child_item_option_ids, is_active, metadata, tenant_id, target_widget, requires_confirmation, skip_refinement, entity_type)
VALUES (
  'activity.manage_tags',
  'Manage Tags',
  'Add or remove tags for this activity.',
  'activity',
  'Tags',
  ARRAY['tag', 'tags', 'label', 'categorize'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY[]::text[],
  false,
  90,
  false,
  '{"type":"object","properties":{"activity_id":{"type":"string"},"tags":{"type":"array","items":{"type":"string"}}},"required":["activity_id"]}'::jsonb,
  'Tags updated.',
  NULL,
  ARRAY['activity.view', 'activity.edit', 'activity.list'],
  ARRAY[]::text[],
  true,
  '{}'::jsonb,
  NULL,
  'activity_card',
  true,
  true,
  'activity'
);

-- activity.manage_tags question (tag_select)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('activity.manage_tags', 'Select tags for this activity', 'tags', 0, false, 'tag_select', '{"source": "tags"}'::jsonb, true);

-- activity.manage_tags: read-only template to fetch activity for formatting; tags saved in pipeline
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.manage_tags', 'get_activity',
'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id WHERE a.id = $1 AND a.tenant_id = $2 AND a.deleted_at IS NULL GROUP BY a.id',
'{"$1": "params.activity_id", "$2": "context.tenantId"}'::jsonb,
0, 'read');

-- Add activity.manage_tags to child_item_option_ids for options that show activity lists/cards
UPDATE option_definitions SET child_item_option_ids = array_append(child_item_option_ids, 'activity.manage_tags')
WHERE id IN ('activity.list', 'analysis.activities') AND NOT ('activity.manage_tags' = ANY(child_item_option_ids));

UPDATE option_definitions SET child_item_option_ids = array_append(child_item_option_ids, 'activity.manage_tags')
WHERE id IN ('activity.view', 'activity.create', 'activity.edit', 'analysis.specific_activity') AND NOT ('activity.manage_tags' = ANY(child_item_option_ids));

-- Add activity.manage_tags to available_option_ids for worker, candidate, representative
UPDATE user_type_configs
SET available_option_ids = array_append(available_option_ids, 'activity.manage_tags')
WHERE user_type IN ('worker', 'candidate', 'representative') AND NOT ('activity.manage_tags' = ANY(available_option_ids));
