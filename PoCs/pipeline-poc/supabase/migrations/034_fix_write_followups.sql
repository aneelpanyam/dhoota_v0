-- Fix admin.user.view SQL: owner_user_id does not exist on activities, use created_by
UPDATE sql_templates SET
  sql = 'SELECT count(*) as total_activities, count(*) FILTER (WHERE status = ''completed'') as completed, count(*) FILTER (WHERE status = ''in_progress'') as in_progress, count(*) FILTER (WHERE status = ''planned'') as planned FROM activities WHERE created_by = $1 AND deleted_at IS NULL'
WHERE option_id = 'admin.user.view' AND name = 'get_user_activity_stats';

-- Fix follow-up options for write operations to provide productive next actions

-- After creating a tenant → view it, provision users, list tenants
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.tenant.view', 'admin.user.provision', 'admin.tenant.list']
WHERE id = 'admin.tenant.create';

-- After editing a tenant → view it, provision users, manage subscription
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.tenant.view', 'admin.user.provision', 'admin.subscription.manage', 'admin.tenant.list']
WHERE id = 'admin.tenant.edit';

-- After managing subscription → view tenant, provision users, list tenants
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.tenant.view', 'admin.user.provision', 'admin.tenant.list']
WHERE id = 'admin.subscription.manage';

-- After provisioning a user → view user, provision another, view tenant, list users
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.user.view', 'admin.user.provision', 'admin.tenant.view', 'admin.user.list']
WHERE id = 'admin.user.provision';

-- After editing a user → view user, list users
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.user.view', 'admin.user.list']
WHERE id = 'admin.user.edit';

-- After managing a feature flag → view tenant, list tenants
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.tenant.view', 'admin.tenant.list']
WHERE id = 'admin.feature_flag.manage';

-- Fix admin.user.edit: allow setting access_code directly and add deactivate support
UPDATE option_definitions SET
  input_schema = '{"type":"object","properties":{"user_id":{"type":"string"},"display_name":{"type":"string"},"user_type":{"type":"string","enum":["worker","candidate","representative"]},"access_code":{"type":"string"},"deactivate":{"type":"boolean"}},"required":["user_id"]}'::jsonb
WHERE id = 'admin.user.edit';

UPDATE sql_templates SET
  sql = 'UPDATE users SET display_name = COALESCE($2, display_name), user_type = COALESCE($3::user_type, user_type), access_code = COALESCE($4, access_code), deleted_at = CASE WHEN $5::boolean = true THEN now() ELSE deleted_at END, updated_at = now() WHERE id = $1 RETURNING id, email, display_name, user_type, access_code, deleted_at',
  param_mapping = '{"$1": "params.user_id", "$2": "params.display_name", "$3": "params.user_type", "$4": "params.access_code", "$5": "params.deactivate"}'::jsonb
WHERE option_id = 'admin.user.edit' AND name = 'update_user';

-- Fix admin.usage.view follow-ups
UPDATE option_definitions SET follow_up_option_ids =
  ARRAY['admin.tenant.list', 'admin.conversation.list', 'admin.report.list']
WHERE id = 'admin.usage.view';
