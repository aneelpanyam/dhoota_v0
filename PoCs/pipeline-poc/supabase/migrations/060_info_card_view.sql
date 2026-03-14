-- 060: info_card.view option and list→view→edit flow
-- Add info_card.view so clicking a list item opens view first, with edit as follow-up.

-- info_card.view option
INSERT INTO option_definitions (
  id, name, description, category, icon, keywords, user_types, required_toggles,
  show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt,
  follow_up_option_ids, child_item_option_ids, is_active, metadata, tenant_id,
  target_widget, requires_confirmation, skip_refinement, entity_type, handler_id
) VALUES (
  'info_card.view',
  'View Info Card',
  'View the full details of an info card.',
  'info_card',
  'Eye',
  ARRAY['view', 'details', 'show', 'open'],
  ARRAY['worker', 'candidate', 'representative'],
  ARRAY['public_site_enabled'],
  false,
  100,
  false,
  '{"type":"object","properties":{"info_card_id":{"type":"string"}},"required":["info_card_id"]}'::jsonb,
  'Show the info card as an info_card widget with Edit and Delete on the card.',
  ARRAY['info_card.list'],
  ARRAY['info_card.edit', 'info_card.delete'],
  true,
  '{}'::jsonb,
  NULL,
  'info_card',
  false,
  true,
  'info_card',
  'sql'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  follow_up_option_ids = EXCLUDED.follow_up_option_ids,
  child_item_option_ids = EXCLUDED.child_item_option_ids,
  target_widget = EXCLUDED.target_widget;

-- SQL template for info_card.view
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('info_card.view', 'get_info_card',
'SELECT * FROM info_cards WHERE id = $1 AND tenant_id = $2 AND created_by = $3 AND deleted_at IS NULL',
'{"$1": "params.info_card_id", "$2": "context.tenantId", "$3": "context.userId"}'::jsonb,
0, 'read');

-- info_card.list: add info_card.view to follow_up_option_ids (so list item click opens view first)
-- and set child_item_option_ids for per-item actions. Edit only on cards, not in follow-ups.
UPDATE option_definitions
SET follow_up_option_ids = ARRAY['info_card.view', 'info_card.create'],
    child_item_option_ids = ARRAY['info_card.view', 'info_card.edit']
WHERE id = 'info_card.list';

-- Add info_card.view to available_option_ids for worker, candidate, representative
UPDATE user_type_configs
SET available_option_ids = array_append(available_option_ids, 'info_card.view')
WHERE user_type IN ('worker', 'candidate', 'representative')
  AND NOT ('info_card.view' = ANY(available_option_ids));
