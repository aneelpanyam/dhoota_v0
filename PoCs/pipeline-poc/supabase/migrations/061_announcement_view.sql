-- 061: announcement.view option and list→view→edit flow
-- Add announcement.view so clicking a list item opens view first, with edit as follow-up.

-- announcement.view option
INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt,
  follow_up_option_ids, child_item_option_ids, is_active, metadata, tenant_id,
  target_widget, requires_confirmation, skip_refinement, entity_type, handler_id
) VALUES (
  'announcement.view',
  'View Announcement',
  'View the full details of an announcement.',
  'announcement',
  'Eye',
  ARRAY['view', 'details', 'show', 'open'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  100,
  false,
  '{"type":"object","properties":{"announcement_id":{"type":"string"}},"required":["announcement_id"]}'::jsonb,
  'Show the announcement as an announcement_card widget with Edit and Delete actions.',
  ARRAY['announcement.edit', 'announcement.delete', 'announcement.list'],
  ARRAY['announcement.edit', 'announcement.delete'],
  true,
  '{}'::jsonb,
  NULL,
  'announcement_card',
  false,
  true,
  'announcement',
  'sql'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  follow_up_option_ids = EXCLUDED.follow_up_option_ids,
  child_item_option_ids = EXCLUDED.child_item_option_ids,
  target_widget = EXCLUDED.target_widget;

-- SQL template for announcement.view
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('announcement.view', 'get_announcement',
'SELECT * FROM announcements WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND deleted_at IS NULL',
'{"$1": "params.announcement_id", "$2": "context.tenantId", "$3": "context.userId"}'::jsonb,
0, 'read');

-- announcement.list: add announcement.view to follow_up_option_ids (so list item click opens view first)
-- and set child_item_option_ids for per-item actions
UPDATE option_definitions
SET follow_up_option_ids = ARRAY['announcement.view', 'announcement.create', 'announcement.edit'],
    child_item_option_ids = ARRAY['announcement.view', 'announcement.edit']
WHERE id = 'announcement.list';

-- Add announcement.view to available_option_ids for worker, candidate, representative
UPDATE user_type_configs
SET available_option_ids = array_append(available_option_ids, 'announcement.view')
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT ('announcement.view' = ANY(available_option_ids));
