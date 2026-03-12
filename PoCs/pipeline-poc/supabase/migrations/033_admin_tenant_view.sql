-- Add admin.tenant.view option for viewing tenant details + users

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids) VALUES
('admin.tenant.view', 'View Tenant', 'View tenant details including users, feature flags, and subscription info.', 'admin', 'Eye', ARRAY['view tenant', 'tenant details', 'tenant info'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"}},"required":["tenant_id"]}'::jsonb,
'Show the tenant details with its users and feature flags.',
ARRAY['admin.tenant.edit', 'admin.user.provision', 'admin.user.list', 'admin.feature_flag.manage', 'admin.subscription.manage'])
ON CONFLICT (id) DO UPDATE SET
  summary_prompt = EXCLUDED.summary_prompt,
  follow_up_option_ids = EXCLUDED.follow_up_option_ids;

-- SQL templates for tenant view
DELETE FROM sql_templates WHERE option_id = 'admin.tenant.view';
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.tenant.view', 'get_tenant',
'SELECT t.*, count(DISTINCT u.id) as user_count FROM tenants t LEFT JOIN users u ON t.id = u.tenant_id AND u.deleted_at IS NULL WHERE t.id = $1 GROUP BY t.id',
'{"$1": "params.tenant_id"}'::jsonb,
0, 'read'),
('admin.tenant.view', 'get_tenant_users',
'SELECT u.id, u.display_name, u.email, u.user_type, u.created_at, u.deleted_at FROM users u WHERE u.tenant_id = $1 ORDER BY u.created_at DESC',
'{"$1": "params.tenant_id"}'::jsonb,
1, 'read'),
('admin.tenant.view', 'get_tenant_flags',
'SELECT flag_key, enabled, updated_at FROM tenant_feature_flags WHERE tenant_id = $1 ORDER BY flag_key',
'{"$1": "params.tenant_id"}'::jsonb,
2, 'read');

-- Update admin.tenant.list to point to view instead of edit as primary click action
UPDATE option_definitions SET
  follow_up_option_ids = ARRAY['admin.tenant.view', 'admin.tenant.create', 'admin.tenant.edit']
WHERE id = 'admin.tenant.list';

-- Add admin.tenant.view to system_admin available options
UPDATE user_type_configs SET
  available_option_ids = array_append(available_option_ids, 'admin.tenant.view')
WHERE user_type = 'system_admin' AND NOT ('admin.tenant.view' = ANY(available_option_ids));

-- Similarly, add admin.user.view option
INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, summary_prompt, follow_up_option_ids) VALUES
('admin.user.view', 'View User', 'View user details including activity stats and access info.', 'admin', 'Eye', ARRAY['view user', 'user details', 'user info'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"user_id":{"type":"string"}},"required":["user_id"]}'::jsonb,
'Show the user details with their activity stats.',
ARRAY['admin.user.edit', 'admin.user.list'])
ON CONFLICT (id) DO UPDATE SET
  summary_prompt = EXCLUDED.summary_prompt,
  follow_up_option_ids = EXCLUDED.follow_up_option_ids;

DELETE FROM sql_templates WHERE option_id = 'admin.user.view';
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.user.view', 'get_user',
'SELECT u.id, u.display_name, u.email, u.user_type, u.access_code, u.created_at, u.deleted_at, t.name as tenant_name, t.id as tenant_id FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.id = $1',
'{"$1": "params.user_id"}'::jsonb,
0, 'read'),
('admin.user.view', 'get_user_activity_stats',
'SELECT count(*) as total_activities, count(*) FILTER (WHERE status = ''completed'') as completed, count(*) FILTER (WHERE status = ''in_progress'') as in_progress, count(*) FILTER (WHERE status = ''planned'') as planned FROM activities WHERE created_by = $1 AND deleted_at IS NULL',
'{"$1": "params.user_id"}'::jsonb,
1, 'read');

-- Update admin.user.list to point to view instead of edit as primary click action
UPDATE option_definitions SET
  follow_up_option_ids = ARRAY['admin.user.view', 'admin.user.provision', 'admin.user.edit']
WHERE id = 'admin.user.list';

-- Add admin.user.view to system_admin available options
UPDATE user_type_configs SET
  available_option_ids = array_append(available_option_ids, 'admin.user.view')
WHERE user_type = 'system_admin' AND NOT ('admin.user.view' = ANY(available_option_ids));
