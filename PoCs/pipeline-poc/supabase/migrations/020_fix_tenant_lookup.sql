-- ============================================
-- 020: Fix Tenant Lookup in Admin SQL Templates
-- Accept tenant slug, name, or UUID wherever
-- admins provide a tenant identifier.
-- Also generates access_code automatically
-- when provisioning users.
-- ============================================

-- Helper function: resolve a tenant identifier (slug, name, or UUID) to a UUID
CREATE OR REPLACE FUNCTION resolve_tenant_id(identifier text)
RETURNS uuid AS $$
DECLARE
  result uuid;
BEGIN
  -- Try UUID cast first
  BEGIN
    result := identifier::uuid;
    IF EXISTS (SELECT 1 FROM tenants WHERE id = result AND deleted_at IS NULL) THEN
      RETURN result;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    NULL;
  END;

  -- Try slug match
  SELECT id INTO result FROM tenants WHERE slug = lower(identifier) AND deleted_at IS NULL LIMIT 1;
  IF result IS NOT NULL THEN RETURN result; END IF;

  -- Try name match (case-insensitive)
  SELECT id INTO result FROM tenants WHERE name ILIKE identifier AND deleted_at IS NULL LIMIT 1;
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- Update admin.user.provision to:
-- 1. Resolve tenant by slug/name/UUID
-- 2. Auto-generate access_code if not provided
-- ============================================

UPDATE sql_templates SET
  sql = 'INSERT INTO users (tenant_id, email, display_name, user_type, access_code) VALUES (resolve_tenant_id($1), $2, $3, $4, COALESCE($5, upper(substr(md5(random()::text), 1, 4) || ''-'' || substr(md5(random()::text), 1, 4)))) RETURNING id, email, display_name, user_type, access_code, created_at'
WHERE option_id = 'admin.user.provision' AND name = 'insert_user';

-- ============================================
-- Update admin.user.list to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT u.id, u.email, u.display_name, u.user_type, u.access_code, u.created_at, u.deleted_at, t.name as tenant_name FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE ($1::text IS NULL OR u.tenant_id = resolve_tenant_id($1)) AND ($2::text IS NULL OR u.user_type::text = $2) ORDER BY u.created_at DESC LIMIT $3 OFFSET $4'
WHERE option_id = 'admin.user.list' AND name = 'list_users';

-- ============================================
-- Update admin.tenant.edit to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'UPDATE tenants SET name = COALESCE($2, name), subscription = COALESCE($3, subscription), custom_domain = COALESCE($4, custom_domain), updated_at = now() WHERE id = resolve_tenant_id($1) RETURNING *'
WHERE option_id = 'admin.tenant.edit' AND name = 'update_tenant';

-- ============================================
-- Update admin.feature_flag.manage to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'INSERT INTO tenant_feature_flags (tenant_id, flag_name, enabled) VALUES (resolve_tenant_id($1), $2, $3) ON CONFLICT (tenant_id, flag_name) DO UPDATE SET enabled = $3, updated_at = now() RETURNING *'
WHERE option_id = 'admin.feature_flag.manage' AND name = 'upsert_flag';

UPDATE sql_templates SET
  sql = 'SELECT * FROM tenant_feature_flags WHERE tenant_id = resolve_tenant_id($1) ORDER BY flag_name'
WHERE option_id = 'admin.feature_flag.manage' AND name = 'list_flags';

-- ============================================
-- Update admin.option.list to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT od.id, od.name, od.description, od.category, od.user_types, od.is_active, od.default_priority, too.enabled as override_enabled, too.name_override, too.priority_override FROM option_definitions od LEFT JOIN tenant_option_overrides too ON od.id = too.option_id AND too.tenant_id = resolve_tenant_id($1) WHERE ($2::text IS NULL OR od.category = $2) ORDER BY od.category, od.default_priority LIMIT $3 OFFSET $4'
WHERE option_id = 'admin.option.list' AND name = 'list_options';

-- ============================================
-- Update admin.option.configure to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'INSERT INTO tenant_option_overrides (tenant_id, option_id, enabled, name_override, description_override, icon_override, priority_override) VALUES (resolve_tenant_id($1), $2, COALESCE($3, true), $4, $5, $6, $7) ON CONFLICT (tenant_id, option_id) DO UPDATE SET enabled = COALESCE($3, tenant_option_overrides.enabled), name_override = COALESCE($4, tenant_option_overrides.name_override), description_override = COALESCE($5, tenant_option_overrides.description_override), icon_override = COALESCE($6, tenant_option_overrides.icon_override), priority_override = COALESCE($7, tenant_option_overrides.priority_override), updated_at = now() RETURNING *'
WHERE option_id = 'admin.option.configure' AND name = 'upsert_override';

-- ============================================
-- Update admin.subscription.manage to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'UPDATE tenants SET subscription = $2, updated_at = now() WHERE id = resolve_tenant_id($1) RETURNING *'
WHERE option_id = 'admin.subscription.manage' AND name = 'update_subscription';

-- ============================================
-- Update admin.usage.view to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT t.name as tenant_name, l.model, count(*) as call_count, sum(l.prompt_tokens) as total_input_tokens, sum(l.completion_tokens) as total_output_tokens, sum(l.total_cost) as total_cost FROM llm_logs l JOIN tenants t ON l.tenant_id = t.id WHERE ($1::text IS NULL OR l.tenant_id = resolve_tenant_id($1)) AND l.created_at >= date_trunc($2, now()) GROUP BY t.name, l.model ORDER BY total_cost DESC'
WHERE option_id = 'admin.usage.view' AND name = 'usage_by_tenant';

UPDATE sql_templates SET
  sql = 'SELECT oe.option_id, od.name as option_name, count(*) as execution_count, avg(oe.execution_ms) as avg_ms, count(*) FILTER (WHERE oe.success = false) as error_count FROM option_executions oe JOIN option_definitions od ON oe.option_id = od.id WHERE ($1::text IS NULL OR oe.tenant_id = resolve_tenant_id($1)) AND oe.created_at >= date_trunc($2, now()) GROUP BY oe.option_id, od.name ORDER BY execution_count DESC'
WHERE option_id = 'admin.usage.view' AND name = 'option_execution_stats';

-- ============================================
-- Update admin.report.list to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT rr.*, u.email, u.display_name, t.name as tenant_name FROM report_requests rr JOIN users u ON rr.user_id = u.id JOIN tenants t ON rr.tenant_id = t.id WHERE ($1::text IS NULL OR rr.tenant_id = resolve_tenant_id($1)) AND ($2::text IS NULL OR rr.status::text = $2) ORDER BY rr.requested_at DESC LIMIT $3 OFFSET $4'
WHERE option_id = 'admin.report.list' AND name = 'list_reports';

-- ============================================
-- Update admin.conversation.list to resolve tenant
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT c.id, c.title, c.context, c.created_at, c.updated_at, u.email, u.display_name, t.name as tenant_name, count(m.id) as message_count FROM conversations c JOIN users u ON c.user_id = u.id JOIN tenants t ON c.tenant_id = t.id LEFT JOIN messages m ON c.id = m.conversation_id WHERE ($1::text IS NULL OR c.tenant_id = resolve_tenant_id($1)) AND ($2::text IS NULL OR u.email ILIKE ''%'' || $2 || ''%'') GROUP BY c.id, u.email, u.display_name, t.name ORDER BY c.updated_at DESC LIMIT $3 OFFSET $4'
WHERE option_id = 'admin.conversation.list' AND name = 'list_conversations';

-- ============================================
-- Improve admin.conversation.view to show
-- user inputs and pipeline debug details
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT m.id, m.role, m.source, m.content, m.option_id, m.trace_id, m.created_at, m.widgets, m.metadata, u.email as user_email, u.display_name FROM messages m LEFT JOIN conversations c ON m.conversation_id = c.id LEFT JOIN users u ON c.user_id = u.id WHERE m.conversation_id = $1 ORDER BY m.created_at ASC'
WHERE option_id = 'admin.conversation.view' AND name = 'get_conversation_messages';

-- ============================================
-- Improve admin.trace.lookup to include
-- full metadata with debug trace and widgets
-- ============================================

UPDATE sql_templates SET
  sql = 'SELECT m.id, m.conversation_id, m.role, m.source, m.content, m.option_id, m.trace_id, m.widgets, m.metadata, m.created_at, c.title as conversation_title, u.email as user_email, u.display_name, u.user_type, t.name as tenant_name FROM messages m JOIN conversations c ON m.conversation_id = c.id JOIN users u ON c.user_id = u.id JOIN tenants t ON c.tenant_id = t.id WHERE m.trace_id = $1'
WHERE option_id = 'admin.trace.lookup' AND name = 'lookup_trace';
