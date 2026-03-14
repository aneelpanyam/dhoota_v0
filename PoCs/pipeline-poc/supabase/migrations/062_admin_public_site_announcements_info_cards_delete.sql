-- 062: Admin options for public site config, announcements, info cards, and delete
-- 1. Show admin.public_site.configure in default menu
-- 2. Add admin.public_site.configure to admin.tenant.view follow-ups
-- 3. Create admin.announcement.list, admin.announcement.view, admin.announcement.delete
-- 4. Create admin.info_card.list, admin.info_card.view, admin.info_card.delete
-- 5. Create admin.tenant.delete (soft delete)
-- 6. Add admin.tenant.delete to admin.tenant.view follow-ups

-- 1. Add admin.public_site.configure to default options so it shows in admin menu
UPDATE user_type_configs
SET default_option_ids = array_append(default_option_ids, 'admin.public_site.configure')
WHERE user_type = 'system_admin' AND NOT ('admin.public_site.configure' = ANY(default_option_ids));

-- 2. Add admin.public_site.configure to admin.tenant.view follow-ups
UPDATE option_definitions
SET follow_up_option_ids = array_append(follow_up_option_ids, 'admin.public_site.configure')
WHERE id = 'admin.tenant.view' AND NOT ('admin.public_site.configure' = ANY(follow_up_option_ids));

-- 3. admin.announcement.list
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, child_item_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.announcement.list',
  'List Tenant Announcements',
  'View announcements for a tenant. Filter by visibility or user.',
  'admin',
  'Megaphone',
  ARRAY['list announcements', 'tenant announcements', 'view announcements', 'admin announcements'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  true,
  53,
  false,
  '{"type":"object","properties":{"tenant_id":{"type":"string"},"user_id":{"type":"string"},"visibility":{"type":"string","enum":["private","public"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
  'Show announcements as a data_list with title, visibility, pinned, published date.',
  ARRAY['admin.announcement.view', 'admin.announcement.delete'],
  ARRAY['admin.announcement.view', 'admin.announcement.delete'],
  true,
  'data_list',
  false,
  true,
  'announcement',
  'sql'
) ON CONFLICT (id) DO UPDATE SET follow_up_option_ids = EXCLUDED.follow_up_option_ids, child_item_option_ids = EXCLUDED.child_item_option_ids;

-- Option questions for admin.announcement.list (tenant_id required)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.announcement.list', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}'::jsonb, true);

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.announcement.list', 'list_announcements',
'SELECT a.*, u.display_name as created_by_name FROM announcements a JOIN users u ON a.created_by = u.id WHERE a.tenant_id = $1 AND a.deleted_at IS NULL AND ($2::uuid IS NULL OR a.created_by = $2) AND ($3::text IS NULL OR a.visibility::text = $3) ORDER BY a.pinned DESC, a.created_at DESC LIMIT $4 OFFSET $5',
'{"$1": "params.tenant_id", "$2": "params.user_id", "$3": "params.visibility", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read');

-- admin.announcement.view
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, child_item_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.announcement.view',
  'View Announcement',
  'View full announcement details. Admin can view any tenant announcement.',
  'admin',
  'Eye',
  ARRAY['view announcement', 'announcement details'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  false,
  100,
  false,
  '{"type":"object","properties":{"announcement_id":{"type":"string"}},"required":["announcement_id"]}'::jsonb,
  'Show the announcement as an announcement_card.',
  ARRAY['admin.announcement.delete', 'admin.announcement.list'],
  ARRAY['admin.announcement.delete'],
  true,
  'announcement_card',
  false,
  true,
  'announcement',
  'sql'
) ON CONFLICT (id) DO UPDATE SET follow_up_option_ids = EXCLUDED.follow_up_option_ids, child_item_option_ids = EXCLUDED.child_item_option_ids;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.announcement.view', 'get_announcement',
'SELECT a.*, u.display_name as created_by_name FROM announcements a JOIN users u ON a.created_by = u.id WHERE a.id = $1 AND a.deleted_at IS NULL',
'{"$1": "params.announcement_id"}'::jsonb,
0, 'read')
ON CONFLICT DO NOTHING;

-- admin.announcement.delete (admin can delete any tenant's announcement)
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.announcement.delete',
  'Delete Announcement',
  'Soft-delete an announcement. Admin can delete any tenant announcement.',
  'admin',
  'Trash2',
  ARRAY['delete announcement', 'remove announcement'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  false,
  100,
  false,
  '{"type":"object","properties":{"announcement_id":{"type":"string"}},"required":["announcement_id"]}'::jsonb,
  'Confirm the announcement has been deleted.',
  ARRAY['admin.announcement.list'],
  true,
  'text_response',
  true,
  true,
  'announcement',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.announcement.delete', 'soft_delete_announcement',
'UPDATE announcements SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id, title',
'{"$1": "params.announcement_id"}'::jsonb,
0, 'write');

-- 4. admin.info_card.list
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, child_item_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.info_card.list',
  'List Tenant Info Cards',
  'View info cards for a tenant. Filter by card type or user.',
  'admin',
  'CreditCard',
  ARRAY['list info cards', 'tenant info cards', 'view info cards', 'admin info cards'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  true,
  54,
  false,
  '{"type":"object","properties":{"tenant_id":{"type":"string"},"user_id":{"type":"string"},"card_type":{"type":"string","enum":["about","contact","service","custom"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
  'Show info cards as a data_list with title, card_type, visibility.',
  ARRAY['admin.info_card.view', 'admin.info_card.delete'],
  ARRAY['admin.info_card.view', 'admin.info_card.delete'],
  true,
  'data_list',
  false,
  true,
  'info_card',
  'sql'
) ON CONFLICT (id) DO UPDATE SET follow_up_option_ids = EXCLUDED.follow_up_option_ids, child_item_option_ids = EXCLUDED.child_item_option_ids;

-- Option questions for admin.info_card.list (must be after option_definitions)
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.info_card.list', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}'::jsonb, true);

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.info_card.list', 'list_info_cards',
'SELECT ic.*, u.display_name as created_by_name FROM info_cards ic JOIN users u ON ic.created_by = u.id WHERE ic.tenant_id = $1 AND ic.deleted_at IS NULL AND ($2::uuid IS NULL OR ic.created_by = $2) AND ($3::text IS NULL OR ic.card_type::text = $3) ORDER BY ic.display_order ASC, ic.created_at DESC LIMIT $4 OFFSET $5',
'{"$1": "params.tenant_id", "$2": "params.user_id", "$3": "params.card_type", "$4": "params.pageSize", "$5": "params.offset"}'::jsonb,
0, 'read')
ON CONFLICT DO NOTHING;

-- admin.info_card.view
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, child_item_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.info_card.view',
  'View Info Card',
  'View full info card details. Admin can view any tenant info card.',
  'admin',
  'Eye',
  ARRAY['view info card', 'info card details'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  false,
  100,
  false,
  '{"type":"object","properties":{"info_card_id":{"type":"string"}},"required":["info_card_id"]}'::jsonb,
  'Show the info card as an info_card widget.',
  ARRAY['admin.info_card.delete', 'admin.info_card.list'],
  ARRAY['admin.info_card.delete'],
  true,
  'info_card',
  false,
  true,
  'info_card',
  'sql'
) ON CONFLICT (id) DO UPDATE SET follow_up_option_ids = EXCLUDED.follow_up_option_ids, child_item_option_ids = EXCLUDED.child_item_option_ids;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.info_card.view', 'get_info_card',
'SELECT ic.*, u.display_name as created_by_name FROM info_cards ic JOIN users u ON ic.created_by = u.id WHERE ic.id = $1 AND ic.deleted_at IS NULL',
'{"$1": "params.info_card_id"}'::jsonb,
0, 'read');

-- admin.info_card.delete
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.info_card.delete',
  'Delete Info Card',
  'Soft-delete an info card. Admin can delete any tenant info card.',
  'admin',
  'Trash2',
  ARRAY['delete info card', 'remove info card'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  false,
  100,
  false,
  '{"type":"object","properties":{"info_card_id":{"type":"string"}},"required":["info_card_id"]}'::jsonb,
  'Confirm the info card has been deleted.',
  ARRAY['admin.info_card.list'],
  true,
  'text_response',
  true,
  true,
  'info_card',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.info_card.delete', 'soft_delete_info_card',
'UPDATE info_cards SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id, title',
'{"$1": "params.info_card_id"}'::jsonb,
0, 'write')
ON CONFLICT DO NOTHING;

-- 5. admin.tenant.delete
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids, is_active, target_widget, requires_confirmation, skip_refinement, entity_type, handler_id)
VALUES (
  'admin.tenant.delete',
  'Delete Tenant',
  'Soft-delete a tenant. Use with caution.',
  'admin',
  'Trash2',
  ARRAY['delete tenant', 'remove tenant', 'deactivate tenant'],
  ARRAY['system_admin'],
  ARRAY[]::text[],
  false,
  100,
  false,
  '{"type":"object","properties":{"tenant_id":{"type":"string"}},"required":["tenant_id"]}'::jsonb,
  'Confirm the tenant has been deleted.',
  ARRAY['admin.tenant.list'],
  true,
  'text_response',
  true,
  true,
  'tenant',
  'sql'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.tenant.delete', 'soft_delete_tenant',
'UPDATE tenants SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING id, name',
'{"$1": "params.tenant_id"}'::jsonb,
0, 'write');

-- Add admin.tenant.delete to admin.tenant.view follow-ups
UPDATE option_definitions
SET follow_up_option_ids = array_append(follow_up_option_ids, 'admin.tenant.delete')
WHERE id = 'admin.tenant.view' AND NOT ('admin.tenant.delete' = ANY(follow_up_option_ids));

-- Add admin.announcement.list and admin.info_card.list to admin.tenant.view follow-ups
UPDATE option_definitions
SET follow_up_option_ids = follow_up_option_ids || ARRAY['admin.announcement.list', 'admin.info_card.list']
WHERE id = 'admin.tenant.view'
  AND NOT (follow_up_option_ids @> ARRAY['admin.announcement.list', 'admin.info_card.list']);

-- Add all new admin options to system_admin available_option_ids
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.announcement.list') WHERE user_type = 'system_admin' AND NOT ('admin.announcement.list' = ANY(available_option_ids));
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.announcement.view') WHERE user_type = 'system_admin' AND NOT ('admin.announcement.view' = ANY(available_option_ids));
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.announcement.delete') WHERE user_type = 'system_admin' AND NOT ('admin.announcement.delete' = ANY(available_option_ids));
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.info_card.list') WHERE user_type = 'system_admin' AND NOT ('admin.info_card.list' = ANY(available_option_ids));
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.info_card.view') WHERE user_type = 'system_admin' AND NOT ('admin.info_card.view' = ANY(available_option_ids));
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.info_card.delete') WHERE user_type = 'system_admin' AND NOT ('admin.info_card.delete' = ANY(available_option_ids));
UPDATE user_type_configs SET available_option_ids = array_append(available_option_ids, 'admin.tenant.delete') WHERE user_type = 'system_admin' AND NOT ('admin.tenant.delete' = ANY(available_option_ids));
