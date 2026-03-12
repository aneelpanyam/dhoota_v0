-- ============================================
-- 016: Admin Options
-- Option definitions, SQL templates, questions,
-- and user_type_config for system_admin.
-- Also bootstraps the admin tenant and user.
-- ============================================

-- ============================================
-- Bootstrap admin tenant and user
-- ============================================

INSERT INTO tenants (id, name, slug, subscription) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Dhoota Admin', 'dhoota-admin', 'premium')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO users (id, tenant_id, email, display_name, user_type, access_code) VALUES
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'admin@dhoota.com', 'System Admin', 'system_admin', 'ADMIN-BOOTSTRAP')
ON CONFLICT DO NOTHING;

-- ============================================
-- Admin Option Definitions
-- ============================================

INSERT INTO option_definitions (id, name, description, category, icon, keywords, user_types, required_toggles, show_in_defaults, default_priority, accepts_files, input_schema, response_prompt, follow_up_option_ids) VALUES

('admin.tenant.create', 'Create Tenant', 'Provision a new tenant with name, slug, and subscription level.', 'admin', 'Building2', ARRAY['create tenant', 'new tenant', 'provision tenant', 'add organization'], ARRAY['system_admin'], ARRAY[]::text[], true, 10, false,
'{"type":"object","properties":{"name":{"type":"string"},"slug":{"type":"string"},"subscription":{"type":"string","enum":["free","basic","premium"]}},"required":["name","slug"]}'::jsonb,
'Confirm the tenant was created. Show a text_response with the tenant details and next steps (provision users).',
ARRAY['admin.user.provision', 'admin.tenant.list']),

('admin.tenant.list', 'List Tenants', 'View all tenants with subscription info and user counts.', 'admin', 'List', ARRAY['list tenants', 'show tenants', 'view organizations', 'all tenants'], ARRAY['system_admin'], ARRAY[]::text[], true, 20, false,
'{"type":"object","properties":{"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show tenants as a data_list widget with columns for name, slug, subscription, user count, and created date.',
ARRAY['admin.tenant.create', 'admin.tenant.edit']),

('admin.tenant.edit', 'Edit Tenant', 'Update tenant name, subscription level, or custom domain.', 'admin', 'Pencil', ARRAY['edit tenant', 'update tenant', 'change subscription'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"name":{"type":"string"},"subscription":{"type":"string","enum":["free","basic","premium"]},"custom_domain":{"type":"string"}},"required":["tenant_id"]}'::jsonb,
'Show the updated tenant details. Summarize what changed.',
ARRAY['admin.tenant.list']),

('admin.user.provision', 'Provision User', 'Create a user for a tenant with email, user type, and display name. Generates an access code for login.', 'admin', 'UserPlus', ARRAY['provision user', 'create user', 'add user', 'invite user', 'new user'], ARRAY['system_admin'], ARRAY[]::text[], true, 15, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"email":{"type":"string","format":"email"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative"]}},"required":["tenant_id","email","display_name","user_type"]}'::jsonb,
'Show the provisioned user details including the generated access code. Remind admin to share the access code with the user.',
ARRAY['admin.user.list']),

('admin.user.list', 'List Users', 'View users filtered by tenant or user type.', 'admin', 'Users', ARRAY['list users', 'show users', 'view users', 'all users'], ARRAY['system_admin'], ARRAY[]::text[], true, 25, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"user_type":{"type":"string"},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show users as a data_list widget with columns for name, email, user type, tenant, access code, and last login.',
ARRAY['admin.user.provision', 'admin.user.edit']),

('admin.user.edit', 'Edit User', 'Change user type, display name, regenerate access code, or deactivate a user.', 'admin', 'UserCog', ARRAY['edit user', 'update user', 'change user', 'deactivate user', 'regenerate access code'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"user_id":{"type":"string"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative"]},"regenerate_access_code":{"type":"boolean"},"deactivate":{"type":"boolean"}},"required":["user_id"]}'::jsonb,
'Show the updated user details. If access code was regenerated, show the new code prominently.',
ARRAY['admin.user.list']),

('admin.feature_flag.manage', 'Manage Feature Flags', 'Enable or disable feature flags per tenant (dynamic_queries, chat_history, reports_enabled, public_site_enabled, suggestion_box_enabled).', 'admin', 'ToggleLeft', ARRAY['feature flags', 'toggle features', 'enable feature', 'disable feature', 'manage flags'], ARRAY['system_admin'], ARRAY[]::text[], true, 30, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"flag_name":{"type":"string"},"enabled":{"type":"boolean"}},"required":["tenant_id","flag_name","enabled"]}'::jsonb,
'Show the current feature flag state for the tenant. List all flags with their current values.',
ARRAY['admin.tenant.list']),

('admin.option.list', 'List Options', 'View all option definitions with their current config per tenant.', 'admin', 'Settings', ARRAY['list options', 'view options', 'all options', 'option definitions'], ARRAY['system_admin'], ARRAY[]::text[], false, 40, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"category":{"type":"string"},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":30}}}'::jsonb,
'Show options as a data_list with columns for ID, name, category, user_types, active status, and any tenant overrides.',
ARRAY['admin.option.configure', 'admin.option.view']),

('admin.option.configure', 'Configure Option', 'Enable/disable an option for a tenant, override display text, set priority.', 'admin', 'Sliders', ARRAY['configure option', 'enable option', 'disable option', 'override option'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"option_id":{"type":"string"},"enabled":{"type":"boolean"},"name_override":{"type":"string"},"description_override":{"type":"string"},"icon_override":{"type":"string"},"priority_override":{"type":"integer"}},"required":["tenant_id","option_id"]}'::jsonb,
'Confirm the option configuration was saved. Show the effective option configuration for the tenant.',
ARRAY['admin.option.list']),

('admin.option.view', 'View Option Details', 'See full option definition including SQL templates, questions, and follow-ups.', 'admin', 'FileText', ARRAY['view option', 'option details', 'option definition'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"option_id":{"type":"string"}},"required":["option_id"]}'::jsonb,
'Show the full option definition including SQL templates (read-only), questions, and follow-up chain.',
ARRAY['admin.option.list', 'admin.option.configure']),

('admin.conversation.list', 'List Conversations', 'View conversations for any user or tenant, searchable by email, tenant, or date range.', 'admin', 'MessageCircle', ARRAY['list conversations', 'view conversations', 'user conversations', 'debug conversations'], ARRAY['system_admin'], ARRAY[]::text[], false, 50, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"user_email":{"type":"string"},"date_from":{"type":"string","format":"date"},"date_to":{"type":"string","format":"date"},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show conversations as a data_list with columns for user email, tenant, title, message count, and last activity date.',
ARRAY['admin.conversation.view']),

('admin.conversation.view', 'View Conversation', 'Load a specific conversation with full messages and debug traces.', 'admin', 'Eye', ARRAY['view conversation', 'load conversation', 'conversation details'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"conversation_id":{"type":"string"}},"required":["conversation_id"]}'::jsonb,
'Show the full conversation with all messages, widgets, and pipeline debug traces from metadata.',
ARRAY['admin.conversation.list', 'admin.trace.lookup']),

('admin.trace.lookup', 'Lookup Trace', 'Search by traceId to find the message, conversation, user, and full pipeline trace.', 'admin', 'Search', ARRAY['lookup trace', 'find trace', 'trace id', 'debug trace', 'search trace'], ARRAY['system_admin'], ARRAY[]::text[], false, 45, false,
'{"type":"object","properties":{"trace_id":{"type":"string"}},"required":["trace_id"]}'::jsonb,
'Show the message associated with the trace ID, including the user details, conversation, and the full pipeline debug trace from message metadata.',
ARRAY['admin.conversation.view']),

('admin.subscription.manage', 'Manage Subscription', 'Change tenant subscription level and view limits.', 'admin', 'CreditCard', ARRAY['subscription', 'manage subscription', 'change plan', 'upgrade', 'downgrade'], ARRAY['system_admin'], ARRAY[]::text[], false, 60, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"subscription":{"type":"string","enum":["free","basic","premium"]}},"required":["tenant_id","subscription"]}'::jsonb,
'Confirm the subscription change. Show the tenant details with the new subscription level.',
ARRAY['admin.tenant.list']),

('admin.usage.view', 'View Usage', 'Track option executions, LLM token usage, costs, and storage per tenant.', 'admin', 'BarChart3', ARRAY['usage', 'view usage', 'costs', 'llm costs', 'token usage', 'analytics'], ARRAY['system_admin'], ARRAY[]::text[], true, 35, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"period":{"type":"string","default":"month"}}}'::jsonb,
'Show usage stats with stats_card widgets for key metrics (total LLM calls, total cost, tokens used) and a chart for cost breakdown by tenant/model.',
ARRAY['admin.tenant.list']),

('admin.report.list', 'View Report Requests', 'List all report requests across tenants with status.', 'admin', 'FileBarChart', ARRAY['report requests', 'view reports', 'pending reports'], ARRAY['system_admin'], ARRAY[]::text[], true, 55, false,
'{"type":"object","properties":{"tenant_id":{"type":"string"},"status":{"type":"string","enum":["requested","processing","completed","failed"]},"page":{"type":"integer","default":1},"pageSize":{"type":"integer","default":20}}}'::jsonb,
'Show report requests as a data_list with columns for user, tenant, report type, status, and requested date.',
ARRAY['admin.report.process']),

('admin.report.process', 'Process Report', 'Update report request status and attach result URL.', 'admin', 'CheckSquare', ARRAY['process report', 'complete report', 'update report status'], ARRAY['system_admin'], ARRAY[]::text[], false, 100, false,
'{"type":"object","properties":{"report_id":{"type":"string"},"status":{"type":"string","enum":["processing","completed","failed"]},"result_url":{"type":"string"}},"required":["report_id","status"]}'::jsonb,
'Confirm the report status was updated. Show the report details.',
ARRAY['admin.report.list']);

-- ============================================
-- Admin SQL Templates
-- ============================================

-- admin.tenant.create
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.tenant.create', 'insert_tenant',
'INSERT INTO tenants (name, slug, subscription) VALUES ($1, $2, COALESCE($3, ''free'')) RETURNING *',
'{"$1": "params.name", "$2": "params.slug", "$3": "params.subscription"}'::jsonb,
0, 'write');

-- admin.tenant.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.tenant.list', 'list_tenants',
'SELECT t.*, count(DISTINCT u.id) as user_count FROM tenants t LEFT JOIN users u ON t.id = u.tenant_id AND u.deleted_at IS NULL GROUP BY t.id ORDER BY t.created_at DESC LIMIT $1 OFFSET $2',
'{"$1": "params.pageSize", "$2": "params.offset"}'::jsonb,
0, 'read');

-- admin.tenant.edit
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.tenant.edit', 'update_tenant',
'UPDATE tenants SET name = COALESCE($2, name), subscription = COALESCE($3, subscription), custom_domain = COALESCE($4, custom_domain), updated_at = now() WHERE id = $1 RETURNING *',
'{"$1": "params.tenant_id", "$2": "params.name", "$3": "params.subscription", "$4": "params.custom_domain"}'::jsonb,
0, 'write');

-- admin.user.provision
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.user.provision', 'insert_user',
'INSERT INTO users (tenant_id, email, display_name, user_type, access_code) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, display_name, user_type, access_code, created_at',
'{"$1": "params.tenant_id", "$2": "params.email", "$3": "params.display_name", "$4": "params.user_type", "$5": "params.access_code"}'::jsonb,
0, 'write');

-- admin.user.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.user.list', 'list_users',
'SELECT u.id, u.email, u.display_name, u.user_type, u.access_code, u.created_at, u.deleted_at, t.name as tenant_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE ($1::uuid IS NULL OR u.tenant_id = $1) AND ($2::text IS NULL OR u.user_type::text = $2) ORDER BY u.created_at DESC LIMIT $3 OFFSET $4',
'{"$1": "params.tenant_id", "$2": "params.user_type", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- admin.user.edit
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.user.edit', 'update_user',
'UPDATE users SET display_name = COALESCE($2, display_name), user_type = COALESCE($3::user_type, user_type), access_code = COALESCE($4, access_code), deleted_at = CASE WHEN $5::boolean = true THEN now() ELSE deleted_at END, updated_at = now() WHERE id = $1 RETURNING id, email, display_name, user_type, access_code, deleted_at',
'{"$1": "params.user_id", "$2": "params.display_name", "$3": "params.user_type", "$4": "params.new_access_code", "$5": "params.deactivate"}'::jsonb,
0, 'write');

-- admin.feature_flag.manage
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.feature_flag.manage', 'upsert_flag',
'INSERT INTO tenant_feature_flags (tenant_id, flag_name, enabled) VALUES ($1, $2, $3) ON CONFLICT (tenant_id, flag_name) DO UPDATE SET enabled = $3, updated_at = now() RETURNING *',
'{"$1": "params.tenant_id", "$2": "params.flag_name", "$3": "params.enabled"}'::jsonb,
0, 'write'),
('admin.feature_flag.manage', 'list_flags',
'SELECT * FROM tenant_feature_flags WHERE tenant_id = $1 ORDER BY flag_name',
'{"$1": "params.tenant_id"}'::jsonb,
1, 'read');

-- admin.option.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.option.list', 'list_options',
'SELECT od.id, od.name, od.description, od.category, od.user_types, od.is_active, od.default_priority, too.enabled as override_enabled, too.name_override, too.priority_override FROM option_definitions od LEFT JOIN tenant_option_overrides too ON od.id = too.option_id AND too.tenant_id = $1 WHERE ($2::text IS NULL OR od.category = $2) ORDER BY od.category, od.default_priority LIMIT $3 OFFSET $4',
'{"$1": "params.tenant_id", "$2": "params.category", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- admin.option.configure
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.option.configure', 'upsert_override',
'INSERT INTO tenant_option_overrides (tenant_id, option_id, enabled, name_override, description_override, icon_override, priority_override) VALUES ($1, $2, COALESCE($3, true), $4, $5, $6, $7) ON CONFLICT (tenant_id, option_id) DO UPDATE SET enabled = COALESCE($3, tenant_option_overrides.enabled), name_override = COALESCE($4, tenant_option_overrides.name_override), description_override = COALESCE($5, tenant_option_overrides.description_override), icon_override = COALESCE($6, tenant_option_overrides.icon_override), priority_override = COALESCE($7, tenant_option_overrides.priority_override), updated_at = now() RETURNING *',
'{"$1": "params.tenant_id", "$2": "params.option_id", "$3": "params.enabled", "$4": "params.name_override", "$5": "params.description_override", "$6": "params.icon_override", "$7": "params.priority_override"}'::jsonb,
0, 'write');

-- admin.option.view
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.option.view', 'get_option',
'SELECT * FROM option_definitions WHERE id = $1',
'{"$1": "params.option_id"}'::jsonb,
0, 'read'),
('admin.option.view', 'get_templates',
'SELECT id, name, sql, param_mapping, execution_order, query_type FROM sql_templates WHERE option_id = $1 ORDER BY execution_order',
'{"$1": "params.option_id"}'::jsonb,
1, 'read'),
('admin.option.view', 'get_questions',
'SELECT * FROM option_questions WHERE option_id = $1 ORDER BY question_order',
'{"$1": "params.option_id"}'::jsonb,
2, 'read');

-- admin.conversation.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.conversation.list', 'list_conversations',
'SELECT c.id, c.title, c.context, c.created_at, c.updated_at, u.email, u.display_name, t.name as tenant_name, count(m.id) as message_count FROM conversations c JOIN users u ON c.user_id = u.id JOIN tenants t ON c.tenant_id = t.id LEFT JOIN messages m ON c.id = m.conversation_id WHERE ($1::uuid IS NULL OR c.tenant_id = $1) AND ($2::text IS NULL OR u.email ILIKE ''%'' || $2 || ''%'') GROUP BY c.id, u.email, u.display_name, t.name ORDER BY c.updated_at DESC LIMIT $3 OFFSET $4',
'{"$1": "params.tenant_id", "$2": "params.user_email", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- admin.conversation.view
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.conversation.view', 'get_conversation_messages',
'SELECT m.*, u.email as user_email, u.display_name FROM messages m LEFT JOIN conversations c ON m.conversation_id = c.id LEFT JOIN users u ON c.user_id = u.id WHERE m.conversation_id = $1 ORDER BY m.created_at ASC',
'{"$1": "params.conversation_id"}'::jsonb,
0, 'read');

-- admin.trace.lookup
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.trace.lookup', 'lookup_trace',
'SELECT m.*, c.title as conversation_title, u.email as user_email, u.display_name, u.user_type, t.name as tenant_name FROM messages m JOIN conversations c ON m.conversation_id = c.id JOIN users u ON c.user_id = u.id JOIN tenants t ON c.tenant_id = t.id WHERE m.trace_id = $1',
'{"$1": "params.trace_id"}'::jsonb,
0, 'read');

-- admin.subscription.manage
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.subscription.manage', 'update_subscription',
'UPDATE tenants SET subscription = $2, updated_at = now() WHERE id = $1 RETURNING *',
'{"$1": "params.tenant_id", "$2": "params.subscription"}'::jsonb,
0, 'write');

-- admin.usage.view
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.usage.view', 'usage_by_tenant',
'SELECT t.name as tenant_name, l.model, count(*) as call_count, sum(l.prompt_tokens) as total_input_tokens, sum(l.completion_tokens) as total_output_tokens, sum(l.total_cost) as total_cost FROM llm_logs l JOIN tenants t ON l.tenant_id = t.id WHERE ($1::uuid IS NULL OR l.tenant_id = $1) AND l.created_at >= date_trunc($2, now()) GROUP BY t.name, l.model ORDER BY total_cost DESC',
'{"$1": "params.tenant_id", "$2": "params.period"}'::jsonb,
0, 'read'),
('admin.usage.view', 'option_execution_stats',
'SELECT oe.option_id, od.name as option_name, count(*) as execution_count, avg(oe.execution_ms) as avg_ms, count(*) FILTER (WHERE oe.success = false) as error_count FROM option_executions oe JOIN option_definitions od ON oe.option_id = od.id WHERE ($1::uuid IS NULL OR oe.tenant_id = $1) AND oe.created_at >= date_trunc($2, now()) GROUP BY oe.option_id, od.name ORDER BY execution_count DESC',
'{"$1": "params.tenant_id", "$2": "params.period"}'::jsonb,
1, 'read');

-- admin.report.list
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.report.list', 'list_reports',
'SELECT rr.*, u.email, u.display_name, t.name as tenant_name FROM report_requests rr JOIN users u ON rr.user_id = u.id JOIN tenants t ON rr.tenant_id = t.id WHERE ($1::uuid IS NULL OR rr.tenant_id = $1) AND ($2::text IS NULL OR rr.status::text = $2) ORDER BY rr.requested_at DESC LIMIT $3 OFFSET $4',
'{"$1": "params.tenant_id", "$2": "params.status", "$3": "params.pageSize", "$4": "params.offset"}'::jsonb,
0, 'read');

-- admin.report.process
INSERT INTO sql_templates (option_id, name, sql, param_mapping, execution_order, query_type) VALUES
('admin.report.process', 'update_report',
'UPDATE report_requests SET status = $2::report_status, result_url = COALESCE($3, result_url), completed_at = CASE WHEN $2 IN (''completed'', ''failed'') THEN now() ELSE completed_at END WHERE id = $1 RETURNING *',
'{"$1": "params.report_id", "$2": "params.status", "$3": "params.result_url"}'::jsonb,
0, 'write');

-- ============================================
-- Admin Option Questions (Q&A flows)
-- ============================================

-- admin.tenant.create
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.tenant.create', 'What is the organization name?', 'name', 0, true, NULL, '{}', true),
('admin.tenant.create', 'URL slug for the tenant (lowercase, no spaces)?', 'slug', 1, true, NULL, '{}', true),
('admin.tenant.create', 'Subscription level?', 'subscription', 2, false, 'select', '{"options": ["free", "basic", "premium"], "default": "free"}', true);

-- admin.user.provision
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.user.provision', 'Which tenant should this user belong to?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}', false),
('admin.user.provision', 'User''s email address?', 'email', 1, true, NULL, '{}', true),
('admin.user.provision', 'User''s display name?', 'display_name', 2, true, NULL, '{}', true),
('admin.user.provision', 'What type of user?', 'user_type', 3, true, 'select', '{"options": ["worker", "candidate", "representative"]}', true);

-- admin.feature_flag.manage
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.feature_flag.manage', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}', false),
('admin.feature_flag.manage', 'Which feature flag?', 'flag_name', 1, true, 'select', '{"options": ["dynamic_queries", "chat_history", "reports_enabled", "public_site_enabled", "suggestion_box_enabled"]}', true),
('admin.feature_flag.manage', 'Enable or disable?', 'enabled', 2, true, 'select', '{"options": ["true", "false"]}', true);

-- admin.option.configure
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.option.configure', 'Which tenant?', 'tenant_id', 0, true, 'select', '{"source": "tenants"}', false),
('admin.option.configure', 'Which option ID?', 'option_id', 1, true, NULL, '{}', false),
('admin.option.configure', 'Enable or disable for this tenant?', 'enabled', 2, false, 'select', '{"options": ["true", "false"]}', true);

-- admin.trace.lookup
INSERT INTO option_questions (option_id, question_text, question_key, question_order, is_required, inline_widget, widget_config, groupable) VALUES
('admin.trace.lookup', 'What is the trace ID?', 'trace_id', 0, true, NULL, '{}', false);

-- ============================================
-- system_admin User Type Config
-- ============================================

INSERT INTO user_type_configs (user_type, init_option_ids, default_option_ids, available_option_ids, theme_config) VALUES
('system_admin',
  ARRAY['admin.tenant.list', 'admin.user.list', 'admin.usage.view'],
  ARRAY['admin.tenant.create', 'admin.tenant.list', 'admin.user.provision',
        'admin.user.list', 'admin.feature_flag.manage', 'admin.option.list',
        'admin.usage.view', 'admin.report.list', 'admin.trace.lookup'],
  ARRAY['admin.tenant.create', 'admin.tenant.list', 'admin.tenant.edit',
        'admin.user.provision', 'admin.user.list', 'admin.user.edit',
        'admin.feature_flag.manage', 'admin.option.list', 'admin.option.configure',
        'admin.option.view', 'admin.conversation.list', 'admin.conversation.view',
        'admin.trace.lookup', 'admin.subscription.manage',
        'admin.usage.view', 'admin.report.list', 'admin.report.process'],
  '{}'::jsonb);
