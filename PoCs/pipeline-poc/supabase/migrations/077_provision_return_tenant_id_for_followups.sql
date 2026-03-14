-- ============================================
-- 077: Return tenant_id from provision so "View Tenant" follow-up gets params
-- Without tenant_id in the result, extractResultParams returns nothing and
-- "View Tenant" is invoked with empty params -> validation error.
-- ============================================

UPDATE sql_templates SET
  sql = 'INSERT INTO users (tenant_id, email, display_name, user_type, access_code) VALUES (resolve_tenant_id($1), $2, $3, $4::user_type, COALESCE($5, upper(substr(md5(random()::text), 1, 4) || ''-'' || substr(md5(random()::text), 1, 4)))) RETURNING id, tenant_id, email, display_name, user_type, access_code, created_at'
WHERE option_id = 'admin.user.provision' AND name = 'insert_user';
