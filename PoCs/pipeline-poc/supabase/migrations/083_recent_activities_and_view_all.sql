-- ============================================
-- 083: Recent Activities + View All Activities
-- - Add activity.recent (10 activities) for worker, candidate, representative
-- - Add public.recent_activities (10 activities) for citizen/public
-- - Rename activity.list to "View All Activities"
-- - Rename public.activities to "View All Activities"
-- ============================================

-- 1. Rename activity.list to "View All Activities" and set list_summary_template
UPDATE option_definitions SET
  name = 'View All Activities',
  list_summary_template = 'Here are your {{count}} activities.'
WHERE id = 'activity.list';

-- 2. Rename public.activities to "View All Activities" and set list_summary_template
UPDATE option_definitions SET
  name = 'View All Activities',
  list_summary_template = 'Here''s what I''ve been up to'
WHERE id = 'public.activities';

-- 3. Create activity.recent option (Recent Activities - last 10)
INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt,
  follow_up_option_ids, child_item_option_ids, is_active, target_widget,
  requires_confirmation, skip_refinement, entity_type, list_summary_template
) VALUES (
  'activity.recent',
  'Recent Activities',
  'Show your 10 most recent activities. Use View All Activities to see more.',
  'activity',
  'List',
  ARRAY['recent', 'activities', 'latest', 'last 10', 'my activities'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY[]::text[],
  true,
  15,
  false,
  '{"type":"object","properties":{}}'::jsonb,
  'List of recent activities.',
  ARRAY['activity.list', 'activity.create', 'view.stats'],
  ARRAY['activity.view', 'activity.edit', 'activity.add_note', 'activity.add_media'],
  true,
  'data_list',
  false,
  true,
  'activity',
  'Here are your most recent activities'
);

-- 4. SQL template for activity.recent (same shape as list_activities, LIMIT 10, scope=all, visibility=all)
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('activity.recent', 'list_recent_activities',
'SELECT a.*, array_agg(DISTINCT jsonb_build_object(''id'', t.id, ''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT an.id) as note_count, count(DISTINCT am.id) as media_count, array_agg(DISTINCT jsonb_build_object(''id'', am.id, ''s3_key'', am.s3_key, ''mime_type'', am.mime_type, ''original_filename'', am.original_filename)) FILTER (WHERE am.id IS NOT NULL) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON t.id = at2.tag_id LEFT JOIN activity_notes an ON a.id = an.activity_id AND an.deleted_at IS NULL LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.deleted_at IS NULL GROUP BY a.id ORDER BY a.activity_date DESC LIMIT 10',
'{"$1": "context.tenantId"}'::jsonb,
0, 'read');

-- 5. Create public.recent_activities option for citizen
INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt,
  follow_up_option_ids, child_item_option_ids, is_active, target_widget,
  requires_confirmation, skip_refinement, entity_type, list_summary_template
) VALUES (
  'public.recent_activities',
  'Recent Activities',
  'Browse the 10 most recent public activities. Use View All Activities to see more.',
  'public',
  'List',
  ARRAY['recent', 'activities', 'latest', 'last 10', 'what did'],
  ARRAY['citizen'],
  ARRAY[]::text[],
  true,
  5,
  false,
  '{"type":"object","properties":{}}'::jsonb,
  'List of recent public activities.',
  ARRAY['public.activities', 'public.stats'],
  ARRAY[]::text[],
  true,
  'data_list',
  false,
  true,
  'activity',
  'Here''s my most recent public activities'
);

-- 6. SQL template for public.recent_activities (same as list_public_activities but LIMIT 10)
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('public.recent_activities', 'list_recent_public_activities',
'SELECT a.id, a.title, a.description, a.activity_date, a.location, a.ai_summary, array_agg(DISTINCT jsonb_build_object(''name'', t.name, ''color'', t.color)) FILTER (WHERE t.id IS NOT NULL) as tags, count(DISTINCT am.id) as media_count, (SELECT COALESCE(jsonb_agg(jsonb_build_object(''id'', sub.id, ''s3_key'', sub.s3_key, ''mime_type'', sub.mime_type, ''original_filename'', sub.original_filename)), ''[]''::jsonb) FROM (SELECT am.id, am.s3_key, am.mime_type, am.original_filename FROM activity_media am WHERE am.activity_id = a.id AND am.mime_type LIKE ''image/%'' ORDER BY am.created_at ASC LIMIT 1) sub) as media FROM activities a LEFT JOIN activity_tags at2 ON a.id = at2.activity_id LEFT JOIN tags t ON at2.tag_id = t.id LEFT JOIN activity_media am ON a.id = am.activity_id WHERE a.tenant_id = $1 AND a.created_by = $2 AND a.visibility = ''public'' AND a.deleted_at IS NULL GROUP BY a.id ORDER BY a.activity_date DESC LIMIT 10',
'{"$1": "context.tenantId", "$2": "context.scopedUserId"}'::jsonb,
0, 'read');

-- 7. Add pinnable for new options
UPDATE option_definitions SET pinnable_items = true, pinnable_collection = true
WHERE id IN ('activity.recent', 'public.recent_activities');

-- 8. Update user_type_configs: worker, candidate, representative
--    init: activity.recent first (replaces activity.list), then view.stats
--    default: add activity.recent at start, keep activity.list
--    available: add activity.recent
UPDATE user_type_configs
SET init_option_ids = ARRAY['activity.recent', 'view.stats'],
    default_option_ids = CASE
      WHEN NOT ('activity.recent' = ANY(default_option_ids)) THEN array_prepend('activity.recent', default_option_ids)
      ELSE default_option_ids
    END,
    available_option_ids = CASE
      WHEN NOT ('activity.recent' = ANY(available_option_ids)) THEN array_prepend('activity.recent', available_option_ids)
      ELSE available_option_ids
    END
WHERE user_type IN ('worker', 'candidate', 'representative');

-- 9. Update user_type_configs: citizen
--    init: public.recent_activities first (replaces public.activities), then public.stats
--    default: add public.recent_activities at start
--    available: add public.recent_activities
UPDATE user_type_configs
SET init_option_ids = array_replace(init_option_ids, 'public.activities', 'public.recent_activities'),
    available_option_ids = CASE
      WHEN NOT ('public.recent_activities' = ANY(available_option_ids)) THEN array_prepend('public.recent_activities', available_option_ids)
      ELSE available_option_ids
    END
WHERE user_type = 'citizen';
